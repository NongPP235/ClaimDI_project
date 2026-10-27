// Back up every table to one JSON file: npm run backup [-- file.json]
// Reads DATABASE_URL (Supabase) when set, otherwise local data/pglite.
// Restore into an empty database with: npm run import-sqlite -- --json file.json
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { db } from "../lib/db.ts";
import { all, closeDb } from "../lib/sql.ts";
import { tables } from "./tables.ts";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});

const destination = resolve(
  process.argv[2] || `./backups/claimdi-${Date.now()}.json`,
);
if (existsSync(destination))
  throw Error("Destination already exists; use a new backup filename.");
await db();
const data: Record<string, unknown[]> = {};
for (const t of tables)
  data[t.name] = await all(
    `SELECT ${t.cols.join(",")} FROM ${t.name} ORDER BY ${t.order}`,
  );
await closeDb();
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(
  destination,
  JSON.stringify({ version: 1, at: new Date().toISOString(), data }),
);
console.log(
  `Backup saved: ${destination} (${Object.entries(data)
    .map(([k, v]) => `${k} ${v.length}`)
    .join(", ")})`,
);
