import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const temp = mkdtempSync(join(tmpdir(), "claimdi-his-"));
process.env.PGLITE_DIR = "memory://";
const { closeDb, workspace, snapshotFor, mutate, hisImport } =
  await import("../lib/db.ts");
const his = await import("../lib/his.ts");
const { hisSample } = await import("../lib/his-sample.ts");
const { caseRisk } = await import("../lib/value.ts");
const { canAct, canView } = await import("../lib/permissions.ts");
after(async () => {
  await closeDb();
  rmSync(temp, { recursive: true, force: true });
});

test("16-file parsing: names, dates, codes", async () => {
  assert.equal(his.fileKind("C:\\exp\\pat6910.TXT"), "PAT");
  assert.equal(his.fileKind("SUMMARY.txt"), "SUMMARY");
  assert.equal(his.fileKind("notes.txt"), null);
  assert.equal(his.parseDate("20261005"), "2026-10-05");
  assert.equal(his.parseDate("25691005"), "2026-10-05");
  assert.equal(his.parseDate("20261332"), null);
  assert.ok(his.icd10("J189") && his.icd10("K35.80") && !his.icd10("XYZ1"));
  const t = his.parseTable("\uFEFFhn|an\r\n001|A1\r\n\r\n002\r\n");
  assert.deepEqual(t.header, ["HN", "AN"]);
  assert.deepEqual(t.rows[1], { HN: "002", AN: "" });
});
test("sample export becomes four masked cases with rule findings", async () => {
  const r = his.buildCases(hisSample);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(
    r.cases.map((c) => [c.code, c.amount, caseRisk(c.findings, c)]),
    [
      ["HIS-6900101", 42300, 0],
      ["HIS-6900102", 58900, 58900],
      ["HIS-6900103", 18750, 13125],
      ["HIS-69001", 1850, 1850],
    ],
  );
  const text = JSON.stringify(r.cases);
  for (const secret of ["สมมติ", "ทดสอบ", "1100000000011", "0012345"])
    assert.ok(!text.includes(secret), `${secret} must not be stored`);
  // Every finding points at text the reviewer can highlight.
  for (const c of r.cases)
    for (const f of c.findings)
      assert.ok(
        c.sections.some((s) => s.text.includes(f.evidence)),
        f.title,
      );
});
test("missing files and columns are reported, nothing is built", async () => {
  const r = his.buildCases({ PAT: "HN\n1", IPD: "HN|AN\n1|A" });
  assert.equal(r.cases.length, 0);
  assert.ok(r.errors.some((e) => e.includes("CHA")));
  assert.ok(r.errors.some((e) => e.includes("DATEADM")));
});
test("import creates draft cases once; analyze shows their findings", async () => {
  assert.ok(canAct("coder", "import") && canView("coder", "import"));
  assert.ok(!canAct("doctor", "import") && !canView("cfo", "import"));
  await mutate(await workspace(), { action: "reset" });
  const w = await workspace();
  const preview = await hisImport(w, hisSample, false);
  assert.equal(preview.imported, 0);
  assert.equal((await snapshotFor(w, "coder")).cases.length, 6);
  const done = await hisImport(w, hisSample, true, {
    role: "coder",
    name: "จนท",
  });
  assert.equal(done.imported, 4);
  let snap = await snapshotFor(w, "coder");
  assert.equal(snap.cases.length, 10);
  assert.equal(snap.cases.at(-1)!.scenario.code, "HIS-69001");
  assert.ok(
    (await hisImport(w, hisSample, false)).cases.every((c) => c.duplicate),
  );
  await assert.rejects(
    async () => await hisImport(w, hisSample, true),
    /นำเข้าไว้แล้ว/,
  );
  const c = snap.cases.find((x) => x.scenario.code === "HIS-6900102")!;
  assert.equal(c.status, "draft");
  await mutate(w, { action: "analyze", id: c.id, revision: c.revision });
  snap = await snapshotFor(w, "cfo");
  assert.equal(snap.pending.amount, 5600 + 58900);
  // List-only roles never get the imported content.
  const cfoCase = snap.cases.find((x) => x.id === c.id)!;
  assert.equal(cfoCase.detail, false);
  assert.equal(
    (cfoCase.scenario as { sections?: unknown }).sections,
    undefined,
  );
  assert.ok(
    (await snapshotFor(w, "admin")).history.some(
      (h) => h.action === "นำเข้าจาก HIS" && h.actor_name === "จนท",
    ),
  );
  await mutate(w, { action: "reset" });
  assert.equal((await snapshotFor(w, "coder")).cases.length, 6);
});
