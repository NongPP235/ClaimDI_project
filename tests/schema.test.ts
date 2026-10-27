import { test, after } from "node:test";
import assert from "node:assert/strict";
// Postgres schema (PROJECT_PLAN.md §20), run on in-memory PGlite.
process.env.PGLITE_DIR = "memory://";
const { schemaVersions, workspace, snapshot, mutate, closeDb } =
  await import("../lib/db.ts");
const { all } = await import("../lib/sql.ts");
after(() => closeDb());

test("schema is created once and every table has row level security", async () => {
  assert.deepEqual(await schemaVersions(), [1]);
  // A second module load (as after a `next dev` reload) re-checks safely.
  const reload = "../lib/db.ts?reload";
  const again = (await import(reload)) as typeof import("../lib/db.ts");
  assert.deepEqual(await again.schemaVersions(), [1]);
  const tables = await all<{ relname: string; relrowsecurity: boolean }>(
    "SELECT relname,relrowsecurity FROM pg_class WHERE relkind='r' AND relnamespace='public'::regnamespace ORDER BY relname",
  );
  assert.deepEqual(
    tables.map((t) => t.relname),
    [
      "audit_results",
      "auth_sessions",
      "cases",
      "demo_sessions",
      "review_history",
      "schema_migrations",
      "users",
    ],
  );
  assert.ok(tables.every((t) => t.relrowsecurity));
});
test("timestamps in milliseconds come back as numbers", async () => {
  const w = await workspace();
  assert.equal(typeof w.expires_at, "number");
  assert.equal(w.expires_at, Number.MAX_SAFE_INTEGER);
});
test("two changes on the same revision: only one wins", async () => {
  const w = await workspace();
  const c = (await snapshot(w)).cases[0];
  const results = await Promise.allSettled([
    mutate(w, { action: "analyze", id: c.id, revision: c.revision }),
    mutate(w, { action: "analyze", id: c.id, revision: c.revision }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const failed = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.match(failed.reason.message, /ข้อมูลใหม่/);
  assert.equal((await snapshot(w)).cases[0].revision, c.revision + 1);
});
