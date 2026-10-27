import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const temp = mkdtempSync(join(tmpdir(), "claimdi-export-"));
process.env.PGLITE_DIR = "memory://";
const { closeDb, workspace, snapshotFor, mutate } =
  await import("../lib/db.ts");
const { canAct, canView } = await import("../lib/permissions.ts");
const ex = await import("../lib/claim-export.ts");
type ExportCase = import("../lib/claim-export.ts").ExportCase;
after(async () => {
  await closeDb();
  rmSync(temp, { recursive: true, force: true });
});

test("only admin, coder and doctor see the claims page and export", async () => {
  for (const r of ["admin", "coder", "doctor"] as const) {
    assert.ok(canView(r, "claims") && canAct(r, "export"));
  }
  for (const r of ["cfo", "engineer"] as const) {
    assert.ok(!canView(r, "claims") && !canAct(r, "export"));
  }
});
test("export accepts only ready cases and records each one", async () => {
  const w = await workspace();
  const doctor = { role: "doctor" as const, name: "หมอทดสอบ" };
  const all = (await snapshotFor(w, "doctor")).cases;
  const ready = all.find((c) => c.status === "ready")!,
    waiting = all.find((c) => c.status === "awaiting_review")!;
  await assert.rejects(
    async () =>
      await mutate(w, { action: "export", ids: [waiting.id], format: "csv" }),
    /เฉพาะเคสที่พร้อมส่งเคลม/,
  );
  await assert.rejects(
    async () =>
      await mutate(w, { action: "export", ids: [ready.id], format: "exe" }),
    /รูปแบบไฟล์/,
  );
  await assert.rejects(
    async () =>
      await mutate(w, { action: "export", ids: ["nope"], format: "csv" }),
    /ไม่พบเคส/,
  );
  // Approve the waiting case, then export both; duplicates count once.
  await mutate(
    w,
    { action: "approve", id: waiting.id, revision: waiting.revision },
    doctor,
  );
  await mutate(
    w,
    { action: "export", ids: [ready.id, waiting.id, ready.id], format: "json" },
    doctor,
  );
  const snap = await snapshotFor(w, "doctor");
  const logs = snap.history.filter((h) => h.action === "ส่งออกข้อมูลเคลม");
  assert.equal(logs.length, 2);
  assert.ok(
    logs.every((h) => h.actor_name === "หมอทดสอบ" && h.note === "JSON"),
  );
  // Exporting does not change the case.
  const after = snap.cases.find((c) => c.id === ready.id)!;
  assert.equal(after.status, "ready");
  assert.equal(after.revision, ready.revision);

  const cases = snap.cases.filter(
    (c) => c.status === "ready",
  ) as unknown as ExportCase[];
  const recs = ex.buildRecords(cases, snap.history, false, 30);
  const approved = recs.find((r) => r.case_code === waiting.scenario.code)!;
  assert.equal(approved.approved_by, "หมอทดสอบ");
  assert.ok(approved.approved_text.length > 0);
  // Protected value travels with the file (§18): DEMO-005 risks ฿5,600.
  assert.equal(approved.at_risk_total, 5600);
  assert.equal(approved.protected_value, 1680);
  assert.equal(approved.findings[0].at_risk, 5600);
  assert.equal(
    recs.find((r) => r.case_code === ready.scenario.code)!.approved_by,
    "ข้อมูลตั้งต้น",
  );
  const masked = ex.buildRecords(cases, snap.history, true, 30);
  assert.ok(masked.every((r) => r.patient === ex.MASKED));
  assert.ok(
    !JSON.stringify(masked).includes(
      (waiting.scenario as { patient: string }).patient,
    ),
    "patient name stays out of masked files",
  );
});
test("CSV opens in Excel and JSON is self-describing", async () => {
  const rec = {
    case_code: "DEMO-9",
    title: 'มี "คำพูด", และจุลภาค',
    patient: "ก",
    department: "=cmd",
    payer: "P",
    amount: 1000,
    diagnosis: "บรรทัด\nใหม่",
    approved_text: "",
    original_text: "",
    findings: [{ title: "A", suggestion: "B", at_risk: 700 }],
    at_risk_total: 700,
    denial_rate: 30,
    protected_value: 210,
    rule_version: "1.0",
    approved_by: "หมอ",
    approved_at: "",
    revision: 3,
  };
  const csv = ex.toCsv([rec]);
  assert.ok(csv.startsWith("﻿รหัสเคส,"));
  assert.ok(csv.includes('"มี ""คำพูด"", และจุลภาค"'));
  assert.ok(csv.includes(",'=cmd,"), "formula text is neutralised");
  assert.ok(csv.includes('"บรรทัด\nใหม่"'));
  assert.ok(csv.includes("A: B [เสี่ยง 700 บาท]"));
  assert.ok(csv.includes(",700,30,210,"));
  const json = JSON.parse(
    ex.toJson([rec], { exported_by: "x", exported_at: "t", masked: false }),
  );
  assert.equal(json.format, "claimdi.claim-export");
  assert.equal(json.demo, true);
  assert.equal(json.count, 1);
  assert.equal(json.claims[0].case_code, "DEMO-9");
});
