import type { Finding, Scenario } from "./scenarios.ts";

// Import from a hospital information system (PROJECT_PLAN.md §19).
// Reads the pipe-delimited "16 แฟ้ม" claim export most Thai HIS can produce,
// plus an optional SUMMARY file of discharge-summary text, and turns each
// admission (AN) or outpatient visit (SEQ) into a case. Columns are read by
// header name, so extra or reordered columns are fine. The file layout is
// written from general knowledge and must be confirmed with the hospital's
// medical-records or billing staff before real use.
export const hisFiles = [
  "INS",
  "PAT",
  "OPD",
  "ORF",
  "ODX",
  "OOP",
  "IPD",
  "IRF",
  "IDX",
  "IOP",
  "CHT",
  "CHA",
  "AER",
  "ADP",
  "LVD",
  "DRU",
  "SUMMARY",
] as const;
export type HisFile = (typeof hisFiles)[number];
export type HisInput = Partial<Record<HisFile, string>>;
// Files this import reads; the others are accepted and ignored.
export const usedFiles: { file: HisFile; need: string; use: string }[] = [
  {
    file: "PAT",
    need: "จำเป็น",
    use: "HN ผู้ป่วย (ชื่อและเลขบัตรถูกปิดก่อนบันทึก)",
  },
  {
    file: "IPD",
    need: "IPD หรือ OPD",
    use: "ผู้ป่วยใน: AN วันรับไว้ วันจำหน่าย แผนก",
  },
  {
    file: "OPD",
    need: "IPD หรือ OPD",
    use: "ผู้ป่วยนอก: SEQ วันที่รับบริการ คลินิก",
  },
  { file: "CHA", need: "จำเป็น", use: "ค่าใช้จ่ายรายหมวด รวมเป็นยอดตั้งเบิก" },
  { file: "IDX", need: "แนะนำ", use: "รหัสวินิจฉัยผู้ป่วยใน (ICD-10)" },
  { file: "ODX", need: "แนะนำ", use: "รหัสวินิจฉัยผู้ป่วยนอก (ICD-10)" },
  { file: "IOP", need: "ถ้ามี", use: "รหัสหัตถการผู้ป่วยใน (ICD-9-CM)" },
  { file: "OOP", need: "ถ้ามี", use: "รหัสหัตถการผู้ป่วยนอก" },
  { file: "INS", need: "แนะนำ", use: "สิทธิการรักษา" },
  {
    file: "SUMMARY",
    need: "แนะนำ",
    use: "ใบสรุปการรักษาและผลแล็บ (แฟ้มเสริมของ Claim Di)",
  },
];
export const MAX_CASES = 200;
export const MAX_CHARS = 2_000_000;

// "PAT6910.txt", "pat.TXT" → "PAT"; unknown names → null.
export function fileKind(name: string): HisFile | null {
  const base = name.split(/[\\/]/).pop()!.toUpperCase();
  return (
    [...hisFiles]
      .sort((a, b) => b.length - a.length)
      .find((f) => base.startsWith(f)) ?? null
  );
}

type Row = Record<string, string>;
export function parseTable(text: string): { header: string[]; rows: Row[] } {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split("|").map((h) => h.trim().toUpperCase());
  const rows = lines.slice(1).map((l) => {
    const cells = l.split("|");
    return Object.fromEntries(
      header.map((h, i) => [h, (cells[i] ?? "").trim()]),
    );
  });
  return { header, rows };
}

// YYYYMMDD in ค.ศ. or พ.ศ. → "YYYY-MM-DD" (ค.ศ.), or null.
export function parseDate(v: string | undefined) {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec((v ?? "").trim());
  if (!m) return null;
  let y = Number(m[1]);
  if (y > 2400) y -= 543;
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1) return null;
  return d.toISOString().slice(0, 10);
}
const thaiDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${y + 543}`;
};
const baht = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const icd10 = (c: string) =>
  /^[A-Z][0-9]{2}(\.?[0-9A-Z]{1,4})?$/.test(c);
export const icd9 = (c: string) => /^[0-9]{2}(\.?[0-9]{1,3})?$/.test(c);
const dxTypes: Record<string, string> = {
  "1": "หลัก",
  "2": "โรคร่วม",
  "3": "โรคแทรก",
  "4": "อื่น ๆ",
  "5": "สาเหตุภายนอก",
};
const payers: Record<string, string> = {
  UCS: "หลักประกันสุขภาพแห่งชาติ (UCS)",
  WEL: "หลักประกันสุขภาพแห่งชาติ (WEL)",
  SSS: "ประกันสังคม (SSS)",
  OFC: "สวัสดิการข้าราชการ (OFC)",
  LGO: "องค์กรปกครองส่วนท้องถิ่น (LGO)",
};
// Keep only the last 3 characters of an identifier.
const maskId = (v: string) =>
  v.length > 3 ? "•".repeat(Math.min(v.length - 3, 4)) + v.slice(-3) : v;

const required: Partial<Record<HisFile, string[]>> = {
  PAT: ["HN"],
  IPD: ["HN", "AN", "DATEADM", "DATEDSC"],
  OPD: ["HN", "SEQ", "DATEOPD"],
  IDX: ["AN", "DIAG", "DXTYPE"],
  ODX: ["SEQ", "DIAG", "DXTYPE"],
  IOP: ["AN", "OPER"],
  OOP: ["SEQ", "OPER"],
  CHA: ["AMOUNT"],
  INS: ["HN", "INSCL"],
  SUMMARY: ["SUMMARY"],
};

export type ImportedCase = Scenario & { key: string; visit: "IPD" | "OPD" };
export type ImportResult = {
  cases: ImportedCase[];
  errors: string[];
  warnings: string[];
  files: HisFile[];
};

export function buildCases(input: HisInput): ImportResult {
  const errors: string[] = [],
    warnings: string[] = [];
  const files = hisFiles.filter((f) => input[f]?.trim());
  const t: Partial<Record<HisFile, Row[]>> = {};
  for (const f of files) {
    const { header, rows } = parseTable(input[f]!);
    const missing = (required[f] ?? []).filter((h) => !header.includes(h));
    if (missing.length) {
      errors.push(`แฟ้ม ${f} ไม่มีคอลัมน์ ${missing.join(", ")}`);
      continue;
    }
    if (f === "CHA" && !header.includes("AN") && !header.includes("SEQ"))
      errors.push("แฟ้ม CHA ต้องมีคอลัมน์ AN หรือ SEQ");
    if (f === "SUMMARY" && !header.includes("AN") && !header.includes("SEQ"))
      errors.push("แฟ้ม SUMMARY ต้องมีคอลัมน์ AN หรือ SEQ");
    t[f] = rows;
  }
  if (!input.PAT?.trim()) errors.push("ต้องมีแฟ้ม PAT");
  if (!input.IPD?.trim() && !input.OPD?.trim())
    errors.push("ต้องมีแฟ้ม IPD หรือ OPD อย่างน้อยหนึ่งแฟ้ม");
  if (!input.CHA?.trim()) errors.push("ต้องมีแฟ้ม CHA เพื่อคำนวณยอดตั้งเบิก");
  if (errors.length) return { cases: [], errors, warnings, files };

  const pat = new Map((t.PAT ?? []).map((r) => [r.HN, r]));
  const by = (rows: Row[] | undefined, col: string, v: string) =>
    v ? (rows ?? []).filter((r) => r[col] === v) : [];
  const visits = [
    ...(t.IPD ?? []).map((r) => ({ visit: "IPD" as const, key: r.AN, r })),
    ...(t.OPD ?? []).map((r) => ({ visit: "OPD" as const, key: r.SEQ, r })),
  ];
  const seen = new Set<string>();
  const cases: ImportedCase[] = [];
  for (const { visit, key, r } of visits) {
    const label = `${visit === "IPD" ? "AN" : "SEQ"} ${key || "(ว่าง)"}`;
    if (!key) {
      warnings.push(
        `ข้าม 1 แถวในแฟ้ม ${visit} เพราะไม่มี ${visit === "IPD" ? "AN" : "SEQ"}`,
      );
      continue;
    }
    if (seen.has(visit + key)) {
      warnings.push(`ข้าม ${label} ที่ซ้ำในแฟ้ม ${visit}`);
      continue;
    }
    seen.add(visit + key);
    if (cases.length >= MAX_CASES) {
      warnings.push(
        `นำเข้าได้ครั้งละไม่เกิน ${MAX_CASES} เคส แถวที่เหลือถูกข้าม`,
      );
      break;
    }
    const p = pat.get(r.HN);
    if (!p) warnings.push(`${label}: ไม่พบ HN นี้ในแฟ้ม PAT`);
    const col = visit === "IPD" ? "AN" : "SEQ";
    const dx = by(visit === "IPD" ? t.IDX : t.ODX, col, key).map((d) => ({
      code: d.DIAG.toUpperCase(),
      type: d.DXTYPE,
    }));
    const ops = by(visit === "IPD" ? t.IOP : t.OOP, col, key).map((o) =>
      o.OPER.trim(),
    );
    const charges = by(t.CHA, col, key).map((c) => ({
      item: c.CHRGITEM || "—",
      amount: Number(c.AMOUNT.replace(/,/g, "")),
    }));
    const badCharge = charges.filter((c) => !Number.isFinite(c.amount));
    if (badCharge.length)
      warnings.push(
        `${label}: ข้ามค่าใช้จ่าย ${badCharge.length} รายการที่ยอดไม่เป็นตัวเลข`,
      );
    const amount =
      Math.round(
        charges
          .filter((c) => Number.isFinite(c.amount))
          .reduce((s, c) => s + c.amount, 0) * 100,
      ) / 100;
    const ins =
      by(t.INS, col, key)[0] ??
      (t.INS ?? []).find((i) => i.HN === r.HN && !i.AN && !i.SEQ) ??
      (t.INS ?? []).find((i) => i.HN === r.HN);
    const sum = by(t.SUMMARY, col, key)[0];

    // Names and ID numbers never leave this function.
    const secrets = [
      p?.NAMEPAT,
      p && [p.FNAME, p.LNAME].filter(Boolean).join(" "),
      p?.FNAME,
      p?.LNAME,
    ].filter((s): s is string => !!s && s.trim().length >= 2);
    const clean = (s: string) =>
      secrets
        .sort((a, b) => b.length - a.length)
        .reduce((acc, x) => acc.replaceAll(x.trim(), "[ปิดบังชื่อ]"), s)
        .replace(/(?<!\d)\d{13}(?!\d)/g, "[ปิดบังเลขบัตร]");

    const adm = parseDate(visit === "IPD" ? r.DATEADM : r.DATEOPD),
      dsc = visit === "IPD" ? parseDate(r.DATEDSC) : adm;
    const los =
      adm && dsc
        ? Math.round((Date.parse(dsc) - Date.parse(adm)) / 86400000)
        : null;
    const payer = ins
      ? (payers[ins.INSCL.toUpperCase()] ?? `สิทธิ ${ins.INSCL}`)
      : "สิทธิ ไม่พบข้อมูล";
    const dept = visit === "IPD" ? r.DEPT || r.WARDDSC : r.CLINIC;
    const dateText =
      visit === "IPD"
        ? `รับไว้ ${adm ? thaiDate(adm) : `"${r.DATEADM || "ว่าง"}"`} · จำหน่าย ${dsc ? thaiDate(dsc) : `"${r.DATEDSC || "ว่าง"}"`}${los !== null ? ` · นอน ${los} วัน` : ""}`
        : `วันที่รับบริการ ${adm ? thaiDate(adm) : `"${r.DATEOPD || "ว่าง"}"`}`;
    const dxText = (d: { code: string; type: string }) =>
      `${d.code || "(ว่าง)"} (${dxTypes[d.type] ?? `ประเภท ${d.type || "ว่าง"}`})`;
    const NO_DX = "ไม่มีรหัสวินิจฉัยในไฟล์",
      NO_SUMMARY = "ไม่พบใบสรุปการรักษาในไฟล์ที่นำเข้า";
    const summaryText = sum?.SUMMARY ? clean(sum.SUMMARY) : NO_SUMMARY;
    const top = [...charges]
      .filter((c) => Number.isFinite(c.amount))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const sections = [
      {
        title: `ข้อมูลรับบริการ (${visit})`,
        text: `${label} · HN ${maskId(r.HN)} · ${dateText} · ${dept ? `แผนก/คลินิก ${dept}` : "ไม่ระบุแผนก"} · ${payer}`,
      },
      {
        title: "รหัสวินิจฉัย",
        text: dx.length ? dx.map(dxText).join(" · ") : NO_DX,
      },
      {
        title: "หัตถการ",
        text: ops.length ? ops.join(" · ") : "ไม่มีรหัสหัตถการ",
      },
      {
        title: "ค่าใช้จ่าย",
        text: charges.length
          ? `รวม ${charges.length} รายการ ฿${baht(amount)} · ${top.map((c) => `หมวด ${c.item} ฿${baht(c.amount)}`).join(" · ")}`
          : "ไม่มีรายการค่าใช้จ่าย",
      },
      { title: "ใบสรุปการรักษา", text: summaryText },
      ...(sum?.LAB ? [{ title: "ผลแล็บ", text: clean(sum.LAB) }] : []),
    ];
    const principal = dx.filter((d) => d.type === "1");
    const findings = hisRules({
      visit,
      amount,
      dx,
      principal,
      ops,
      adm,
      dsc,
      los,
      hasIns: !!ins,
      hasSummary: !!sum?.SUMMARY,
      chargeCount: charges.length,
      dateText,
      dxText,
      payer,
      NO_DX,
      NO_SUMMARY,
    });
    cases.push({
      key: `${visit}:${key}`,
      visit,
      code: `HIS-${key}`,
      title: `นำเข้าจาก HIS · ${visit} ${principal[0]?.code ?? "ไม่มีรหัสวินิจฉัยหลัก"}`,
      patient: `ผู้ป่วย HN ${maskId(r.HN)}`,
      department: `${dept ? `แผนก ${dept}` : "ไม่ระบุแผนก"} · ${visit}`,
      payer,
      amount,
      status: "draft",
      diagnosis: principal.map((d) => d.code).join(", ") || "—",
      sections,
      findings,
      proposal: findings.length
        ? `ข้อเสนอสำหรับแพทย์ตรวจทาน (สร้างจากผลตรวจไฟล์ HIS): ${findings.map((f) => f.suggestion).join(" ")}`
        : "คงข้อมูลตามไฟล์ HIS ไม่พบประเด็นจากกฎตรวจไฟล์",
      source: "his",
    });
  }
  if (!cases.length && !errors.length)
    errors.push("ไม่พบเคสในแฟ้ม IPD หรือ OPD");
  return { cases, errors, warnings, files };
}

// Rule checks for imported cases. atRisk shares are demo assumptions
// (PROJECT_PLAN.md §19), capped at the claim by caseRisk().
function hisRules(c: {
  visit: "IPD" | "OPD";
  amount: number;
  dx: { code: string; type: string }[];
  principal: { code: string; type: string }[];
  ops: string[];
  adm: string | null;
  dsc: string | null;
  los: number | null;
  hasIns: boolean;
  hasSummary: boolean;
  chargeCount: number;
  dateText: string;
  dxText: (d: { code: string; type: string }) => string;
  payer: string;
  NO_DX: string;
  NO_SUMMARY: string;
}): Finding[] {
  const A = c.amount,
    share = (p: number) => Math.round(A * p);
  const out: Finding[] = [];
  if (!c.principal.length)
    out.push({
      title: "ไม่มีรหัสวินิจฉัยหลัก",
      evidence: c.dx.length ? c.dxText(c.dx[0]) : c.NO_DX,
      suggestion:
        "ให้แพทย์ระบุการวินิจฉัยหลักในใบสรุป แล้วให้เจ้าหน้าที่ลงรหัส DXTYPE 1 หนึ่งรหัส",
      severity: "warning",
      atRisk: A,
    });
  if (c.principal.length > 1)
    out.push({
      title: "มีรหัสวินิจฉัยหลักมากกว่า 1 รหัส",
      evidence: c.dxText(c.principal[1]),
      suggestion:
        "เลือกการวินิจฉัยหลักเพียงรหัสเดียว รหัสอื่นให้เป็นโรคร่วมหรือโรคแทรก",
      severity: "warning",
      atRisk: share(0.3),
    });
  for (const d of c.dx.filter((d) => !icd10(d.code)))
    out.push({
      title: `รูปแบบรหัส ICD-10 ไม่ถูกต้อง: ${d.code || "(ว่าง)"}`,
      evidence: c.dxText(d),
      suggestion: "ตรวจรหัสวินิจฉัยกับเวชระเบียนและแก้ให้ตรงรูปแบบ ICD-10-TM",
      severity: "warning",
      atRisk: share(0.2),
    });
  for (const o of c.ops.filter((o) => !icd9(o)))
    out.push({
      title: `รูปแบบรหัสหัตถการไม่ถูกต้อง: ${o || "(ว่าง)"}`,
      evidence: o || "ไม่มีรหัสหัตถการ",
      suggestion:
        "ตรวจรหัสหัตถการกับบันทึกการผ่าตัดหรือหัตถการ แล้วแก้ให้ตรงรูปแบบ ICD-9-CM",
      severity: "info",
      atRisk: share(0.1),
    });
  if (!c.adm || !c.dsc || (c.los !== null && c.los < 0))
    out.push({
      title:
        c.visit === "IPD"
          ? "วันที่รับไว้หรือวันจำหน่ายไม่ถูกต้อง"
          : "วันที่รับบริการไม่ถูกต้อง",
      evidence: c.dateText,
      suggestion:
        "ตรวจวันที่กับเวชระเบียน ข้อมูลวันที่ผิดมักทำให้ระบบของกองทุนไม่รับเคลม",
      severity: "warning",
      atRisk: A,
    });
  else if (c.visit === "IPD" && c.los === 0)
    out.push({
      title: "ผู้ป่วยในนอนไม่ถึง 1 วัน",
      evidence: c.dateText,
      suggestion:
        "ให้แพทย์ยืนยันเหตุผลการรับไว้เป็นผู้ป่วยในในใบสรุป หรือพิจารณาเบิกแบบผู้ป่วยนอก",
      severity: "info",
      atRisk: share(0.5),
    });
  if (c.visit === "IPD" && !c.hasSummary)
    out.push({
      title: "ไม่มีใบสรุปการรักษา",
      evidence: c.NO_SUMMARY,
      suggestion:
        "ขอใบสรุปการรักษาที่แพทย์ลงนามแล้ว และแนบในแฟ้ม SUMMARY ก่อนส่งเบิก",
      severity: "warning",
      atRisk: share(0.6),
    });
  if (!c.hasIns)
    out.push({
      title: "ไม่พบข้อมูลสิทธิการรักษา (INS)",
      evidence: c.payer,
      suggestion: "ตรวจสิทธิผู้ป่วยและเพิ่มข้อมูลในแฟ้ม INS ก่อนส่งเบิก",
      severity: "warning",
      atRisk: A,
    });
  if (!c.chargeCount)
    out.push({
      title: "ไม่มีรายการค่าใช้จ่าย (CHA)",
      evidence: "ไม่มีรายการค่าใช้จ่าย",
      suggestion: "ตรวจว่า HIS ส่งออกแฟ้ม CHA ของเคสนี้ครบ",
      severity: "info",
      atRisk: 0,
    });
  return out;
}
