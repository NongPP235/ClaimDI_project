import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const temp = mkdtempSync(join(tmpdir(), "claimdi-test-"));
process.env.PGLITE_DIR = "memory://";
const { newSession, session, snapshot, mutate, closeDb } =
  await import("../lib/db.ts");
const { run } = await import("../lib/sql.ts");
after(async () => {
  await closeDb();
  rmSync(temp, { recursive: true, force: true });
});
test("session isolation, workflow and optimistic concurrency", async () => {
  const a = await session(await newSession()),
    b = await session(await newSession());
  let c = (await snapshot(a)).cases[0];
  await assert.rejects(
    async () =>
      await mutate(b, { action: "analyze", id: c.id, revision: c.revision }),
    /ไม่พบเคส/,
  );
  await assert.rejects(
    async () =>
      await mutate(a, { action: "approve", id: c.id, revision: c.revision }),
    /ไม่ได้รอแพทย์/,
  );
  await mutate(a, { action: "analyze", id: c.id, revision: c.revision });
  await assert.rejects(
    async () =>
      await mutate(a, { action: "analyze", id: c.id, revision: c.revision }),
    /ข้อมูลใหม่/,
  );
  c = (await snapshot(a)).cases[0];
  assert.equal(c.status, "needs_revision");
  await mutate(a, { action: "proposal", id: c.id, revision: c.revision });
  c = (await snapshot(a)).cases[0];
  await mutate(a, { action: "submit", id: c.id, revision: c.revision });
  c = (await snapshot(a)).cases[0];
  assert.equal(c.status, "awaiting_review");
  await assert.rejects(
    async () =>
      await mutate(a, {
        action: "return",
        id: c.id,
        revision: c.revision,
        note: " ",
      }),
    /ระบุเหตุผล/,
  );
  await mutate(a, {
    action: "return",
    id: c.id,
    revision: c.revision,
    note: "ตรวจข้อมูลอ้างอิง",
  });
  c = (await snapshot(a)).cases[0];
  assert.equal(c.status, "returned");
  await mutate(a, { action: "proposal", id: c.id, revision: c.revision });
  c = (await snapshot(a)).cases[0];
  await mutate(a, { action: "submit", id: c.id, revision: c.revision });
  c = (await snapshot(a)).cases[0];
  await mutate(a, { action: "approve", id: c.id, revision: c.revision });
  assert.equal((await snapshot(a)).cases[0].status, "ready");
  assert.equal((await snapshot(b)).cases[0].status, "draft");
});
test("simulated retry, rule versions and scoped reset", async () => {
  const token = await newSession(),
    a = await session(token),
    b = await session(await newSession());
  let c = (await snapshot(a)).cases[5];
  assert.deepEqual(
    await mutate(a, { action: "analyze", id: c.id, revision: c.revision }),
    { simulatedError: true },
  );
  await mutate(a, { action: "analyze", id: c.id, revision: c.revision });
  assert.equal((await snapshot(a)).cases[5].status, "needs_revision");
  await mutate(a, { action: "rule", version: "2.0" });
  const refreshed = await session(token);
  c = (await snapshot(refreshed)).cases[0];
  await mutate(refreshed, {
    action: "analyze",
    id: c.id,
    revision: c.revision,
  });
  const result = (await snapshot(refreshed)).cases[0].audit as {
    rule_version: string;
    findings_json: string;
  };
  assert.equal(result.rule_version, "2.0");
  assert.equal(JSON.parse(result.findings_json).length, 3);
  await mutate(refreshed, { action: "rule", version: "1.0" });
  assert.equal(
    (
      (await snapshot(await session(token))).cases[0].audit as {
        rule_version: string;
      }
    ).rule_version,
    "2.0",
  );
  await mutate(await session(token), { action: "reset" });
  assert.equal((await snapshot(await session(token))).cases[0].status, "draft");
  assert.equal((await snapshot(b)).cases.length, 6);
  assert.equal(
    (await snapshot(await session(token))).history.filter(
      (h) => h.case_id === c.id,
    ).length,
    0,
  );
});
test("history records simulated role and revision", async () => {
  const token = await newSession(),
    a = await session(token);
  let c = (await snapshot(a)).cases[0];
  await mutate(a, { action: "analyze", id: c.id, revision: c.revision });
  c = (await snapshot(a)).cases[0];
  await mutate(a, { action: "proposal", id: c.id, revision: c.revision });
  c = (await snapshot(a)).cases[0];
  await mutate(a, { action: "submit", id: c.id, revision: c.revision });
  c = (await snapshot(a)).cases[0];
  await mutate(a, { action: "approve", id: c.id, revision: c.revision });
  await mutate(a, { action: "rule", version: "2.0" });
  const h = (await snapshot(await session(token))).history as {
    case_id: string | null;
    action: string;
    simulated_role: string;
    revision: number | null;
  }[];
  const mine = h.filter((x) => x.case_id === c.id);
  assert.deepEqual(
    mine.map((x) => [x.simulated_role, x.revision]),
    [
      ["doctor", 4],
      ["coder", 3],
      ["coder", 2],
      ["coder", 1],
    ],
  );
  assert.equal(h.find((x) => !x.case_id)?.simulated_role, "engineer");
});
test("sessions expire after inactivity, not from creation", async () => {
  const token = await newSession();
  const old = Date.now() - 6 * 86400000;
  await run(
    "UPDATE demo_sessions SET created_at=?,last_seen_at=?,expires_at=? WHERE id=?",
    old,
    old,
    old + 7 * 86400000,
    (await session(token)).id,
  );
  const s = await session(token);
  assert.ok(s.expires_at > Date.now() + 6.9 * 86400000);
  await run(
    "UPDATE demo_sessions SET expires_at=? WHERE id=?",
    Date.now() - 1,
    s.id,
  );
  await assert.rejects(async () => await session(token), /หมดอายุ/);
});
