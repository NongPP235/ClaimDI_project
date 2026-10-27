import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const temp = mkdtempSync(join(tmpdir(), "claimdi-insights-"));
process.env.PGLITE_DIR = "memory://";
const { closeDb, workspace, snapshotFor, mutate } =
  await import("../lib/db.ts");
const { canAct } = await import("../lib/permissions.ts");
const drift = await import("../lib/drift.ts");
const { workStats } = await import("../lib/stats.ts");
const value = await import("../lib/value.ts");
const { scenarios } = await import("../lib/scenarios.ts");
after(async () => {
  await closeDb();
  rmSync(temp, { recursive: true, force: true });
});

test("PSI and drift thresholds", async () => {
  assert.equal(drift.psi([0.5, 0.5], [0.5, 0.5]), 0);
  assert.ok(Math.abs(drift.psi([0.5, 0.5], [0.6, 0.4]) - 0.0405) < 1e-3);
  assert.equal(drift.statusOf(0.099), "stable");
  assert.equal(drift.statusOf(0.1), "watch");
  assert.equal(drift.statusOf(0.25), "drift");
  const [aug, sep, oct] = drift.driftWindows.map((w) =>
    drift.driftReport(w.key)!,
  );
  assert.equal(aug.status, "stable");
  assert.equal(sep.status, "watch");
  assert.equal(oct.status, "drift");
  assert.equal(oct.worst.key, "payer");
  for (const w of drift.driftWindows)
    for (const f of drift.features)
      assert.ok(
        Math.abs(w.mix[f.key].reduce((a, b) => a + b, 0) - 1) < 1e-9,
        `${w.key} ${f.key} sums to 1`,
      );
  assert.equal(drift.driftReport("1999-01"), null);
});
test("package defaults to Plus, admin changes it, reset keeps it", async () => {
  assert.ok(canAct("admin", "package"));
  assert.ok(
    !["coder", "doctor", "cfo", "engineer"].some((r) =>
      canAct(r as never, "package"),
    ),
  );
  let w = await workspace();
  assert.equal((await snapshotFor(w, "cfo")).package, "Plus");
  await assert.rejects(
    async () => await mutate(w, { action: "package", package: "Gold" }),
    /แพ็กเกจ/,
  );
  await mutate(
    w,
    { action: "package", package: "Pro" },
    { role: "admin", name: "แอดมิน" },
  );
  w = await workspace();
  assert.equal((await snapshotFor(w, "coder")).package, "Pro");
  await mutate(w, { action: "reset" });
  assert.equal((await snapshotFor(await workspace(), "coder")).package, "Pro");
  await mutate(await workspace(), { action: "package", package: "Plus" });
});
test("drift checks are logged for engineer and admin", async () => {
  assert.ok(canAct("engineer", "drift") && canAct("admin", "drift"));
  assert.ok(!canAct("cfo", "drift") && !canAct("coder", "drift"));
  const w = await workspace();
  await assert.rejects(
    async () => await mutate(w, { action: "drift", window: "x" }),
    /ช่วงข้อมูล/,
  );
  await mutate(
    w,
    { action: "drift", window: "2026-10" },
    { role: "engineer", name: "วิศวกร" },
  );
  const h = (await snapshotFor(w, "engineer")).history[0];
  assert.equal(h.action, "ตรวจ Data Drift");
  assert.match(
    h.note,
    /^ต\.ค\. 2569 · เปลี่ยนแปลงมาก · PSI สูงสุด 0\.53 \(ผู้รับประกัน\)$/,
  );
  assert.equal(h.actor_name, "วิศวกร");
});
test("work stats from history", async () => {
  await mutate(await workspace(), { action: "reset" });
  const w = await workspace();
  assert.equal((await workStats(w.id)).actions, 0, "seed rows are not counted");
  const coder = { role: "coder" as const, name: "เจ้าหน้าที่ ก" },
    doctor = { role: "doctor" as const, name: "แพทย์ ข" };
  const step = async (
    code: string,
    action: string,
    actor: typeof coder | typeof doctor,
    note?: string,
  ) => {
    const c = (await snapshotFor(w, "admin")).cases.find(
      (x) => x.scenario.code === code,
    )!;
    await mutate(w, { action, id: c.id, revision: c.revision, note }, actor);
  };
  for (const code of ["DEMO-001", "DEMO-003", "DEMO-004"]) {
    await step(code, "analyze", coder);
    await step(code, "proposal", coder);
    await step(code, "submit", coder);
  }
  await step("DEMO-001", "approve", doctor);
  await step("DEMO-003", "return", doctor, "ขอผลแล็บเพิ่ม");
  await step("DEMO-004", "return", doctor, "ขอผลแล็บเพิ่ม");
  const ready = (await snapshotFor(w, "admin")).cases.filter(
    (c) => c.status === "ready",
  );
  await mutate(
    w,
    { action: "export", ids: ready.map((c) => c.id), format: "csv" },
    coder,
  );
  const s = await workStats(w.id);
  assert.equal(s.approvals, 1);
  assert.equal(s.returns, 2);
  assert.ok(Math.abs(s.returnRate! - 2 / 3) < 1e-9);
  assert.equal(s.approval.count, 1);
  assert.ok(s.approval.avgMs! >= 0);
  assert.deepEqual(s.reasons, [{ text: "ขอผลแล็บเพิ่ม", count: 2 }]);
  const k = s.people.find((p) => p.name === "เจ้าหน้าที่ ก")!;
  assert.equal(k.counts["ตรวจตัวอย่าง"], 3);
  assert.equal(k.counts["ส่งออกข้อมูลเคลม"], 2);
  assert.equal(
    s.people.find((p) => p.name === "แพทย์ ข")!.counts["แพทย์ส่งกลับ"],
    2,
  );
  assert.equal(s.exports.length, 2);
  assert.deepEqual(s.exports.map((e) => e.code).sort(), [
    "DEMO-001",
    "DEMO-002",
  ]);
  assert.equal(s.exports[0].format, "Excel (CSV)");
});
test("protected value: fixed, doctor-confirmed claims × assumed denial rate", async () => {
  assert.ok(canAct("cfo", "denial_rate") && canAct("admin", "denial_rate"));
  assert.ok(
    !canAct("coder", "denial_rate") && !canAct("doctor", "denial_rate"),
  );
  await mutate(await workspace(), { action: "reset" });
  let w = await workspace();
  // Seeded ready case (DEMO-002) has no findings, so nothing is counted yet.
  let snap = await snapshotFor(w, "cfo");
  assert.deepEqual(snap.prevented, { cases: 0, amount: 0, findings: 0 });
  assert.equal(snap.denialRate, 30);
  // The seeded case waiting for the doctor (DEMO-005) risks ฿5,600.
  assert.deepEqual(snap.pending, { cases: 1, amount: 5600, findings: 1 });
  const waiting = (await snapshotFor(w, "doctor")).cases.find(
    (c) => c.status === "awaiting_review",
  )!;
  await mutate(w, {
    action: "approve",
    id: waiting.id,
    revision: waiting.revision,
  });
  snap = await snapshotFor(w, "cfo");
  assert.equal(snap.prevented.cases, 1);
  assert.equal(snap.prevented.amount, 5600);
  assert.equal(snap.pending.cases, 0);
  assert.ok(snap.prevented.findings > 0);
  await assert.rejects(
    async () => await mutate(w, { action: "denial_rate", rate: 101 }),
    /0–100/,
  );
  await assert.rejects(
    async () => await mutate(w, { action: "denial_rate", rate: 2.5 }),
    /0–100/,
  );
  await mutate(
    w,
    { action: "denial_rate", rate: 45 },
    { role: "cfo", name: "ซีเอฟโอ" },
  );
  w = await workspace();
  assert.equal((await snapshotFor(w, "coder")).denialRate, 45);
  assert.equal((await snapshotFor(w, "admin")).history[0].note, "30% → 45%");
});
test("per-finding risk: fixture value, old audits, cap at the claim", async () => {
  const sc = scenarios.find((x) => x.code === "DEMO-001")!;
  assert.equal(value.caseRisk(sc.findings, sc), 35500);
  // Audits saved before §18 have no atRisk; the fixture title fills it in.
  const old = sc.findings.map(({ title }) => ({ title }));
  assert.equal(value.caseRisk(old, sc), 35500);
  // Unknown titles share the claim evenly, and a case never exceeds it.
  assert.equal(value.findingRisk({ title: "?" }, sc, 2), 24250);
  assert.equal(value.caseRisk([{ title: "x", atRisk: 90000 }], sc), sc.amount);
  assert.equal(value.protectedValue(35500, 30), 10650);
});
