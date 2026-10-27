// Move data into Postgres / Supabase (PROJECT_PLAN.md §20), from the SQLite
// file the demo used before or from a JSON backup:
//   DATABASE_URL=... npm run import-sqlite                 (data/claimdi.sqlite)
//   DATABASE_URL=... npm run import-sqlite -- old.sqlite
//   DATABASE_URL=... npm run import-sqlite -- --json backups/claimdi-1.json
// Without DATABASE_URL it fills the local data/pglite database instead.
// The target must be empty; add --replace to delete its rows first.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../lib/db.ts";
import { closeDb, get, run, transaction } from "../lib/sql.ts";
import { tables } from "./tables.ts";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const jsonAt = args.indexOf("--json");
const rest = args.filter((a, i) => !a.startsWith("--") && i !== jsonAt + 1);
let data: Record<string, Record<string, unknown>[]>;
if (jsonAt >= 0) {
  const file = resolve(args[jsonAt + 1] ?? "");
  if (!existsSync(file)) throw Error(`ไม่พบไฟล์ ${file}`);
  data = JSON.parse(readFileSync(file, "utf8")).data;
} else {
  const file = resolve(rest[0] || "./data/claimdi.sqlite");
  if (!existsSync(file)) throw Error(`ไม่พบไฟล์ ${file}`);
  const { DatabaseSync } = await import("node:sqlite");
  const old = new DatabaseSync(file, { readOnly: true });
  const version = (
    old.prepare("SELECT MAX(version) v FROM schema_migrations").get() as {
      v: number;
    }
  ).v;
  if (version < 6)
    throw Error(
      `ไฟล์นี้เป็น schema รุ่น ${version} เปิดด้วย ClaimDi รุ่นก่อนหน้าหนึ่งครั้งเพื่ออัปเกรดเป็นรุ่น 6 ก่อน`,
    );
  data = {};
  for (const t of tables)
    data[t.name] = old
      .prepare(
        `SELECT ${t.cols.join(",")} FROM ${t.name} ORDER BY ${t.sqliteOrder}`,
      )
      .all() as Record<string, unknown>[];
  old.close();
}

await db();
await transaction(async () => {
  const count = async (name: string) =>
    (await get<{ n: number }>(`SELECT COUNT(*) n FROM ${name}`))!.n;
  const used = (await count("users")) + (await count("demo_sessions"));
  if (used && !replace)
    throw Error(
      "ฐานข้อมูลปลายทางมีข้อมูลอยู่แล้ว เพิ่ม --replace ถ้าต้องการลบข้อมูลเดิมแล้วนำเข้าใหม่",
    );
  if (replace)
    for (const t of [...tables].reverse()) await run(`DELETE FROM ${t.name}`);
  await run("DELETE FROM auth_sessions");
  for (const t of tables) {
    const sql = `INSERT INTO ${t.name}(${t.cols.join(",")}) VALUES(${t.cols.map(() => "?").join(",")})`;
    for (const row of data[t.name] ?? [])
      await run(sql, ...t.cols.map((c) => row[c] ?? null));
  }
});
await closeDb();
console.log(
  `นำเข้าแล้ว: ${tables.map((t) => `${t.name} ${(data[t.name] ?? []).length}`).join(", ")} ทุกคนต้องเข้าสู่ระบบใหม่`,
);
