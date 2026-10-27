import type { Finding, Scenario } from "./scenarios.ts";
import { caseRisk, findingRisk, protectedValue } from "./value.ts";

// Files staff take to an insurer for "ready" cases (PROJECT_PLAN.md §15).
// Everything is demo data; each file says so.
export const EXPORT_NOTICE =
  "ข้อมูลจำลองจากระบบสาธิต Claim Di ไม่ใช่เอกสารเคลมจริง";
export const MASKED = "[ปิดบังชื่อ]";

export type ExportCase = {
  id: string;
  revision: number;
  proposal: string;
  scenario: Scenario;
  audit: { findings_json?: string; rule_version: string } | null;
};
export type ExportHistory = {
  case_id: string | null;
  action: string;
  created_at: string;
  actor_name?: string;
};
export type ClaimRecord = {
  case_code: string;
  title: string;
  patient: string;
  department: string;
  payer: string;
  amount: number;
  diagnosis: string;
  approved_text: string;
  original_text: string;
  // at_risk: baht likely denied had the issue gone out unfixed (§18).
  findings: { title: string; suggestion: string; at_risk: number }[];
  at_risk_total: number;
  denial_rate: number;
  protected_value: number;
  rule_version: string;
  approved_by: string;
  approved_at: string;
  revision: number;
};

export function buildRecords(
  cases: ExportCase[],
  history: ExportHistory[],
  mask: boolean,
  rate: number,
): ClaimRecord[] {
  return cases.map((c) => {
    const sc = c.scenario;
    // History is newest first; seeded ready cases have no approval row.
    const approved = history.find(
      (h) => h.case_id === c.id && h.action === "แพทย์ยืนยันข้อเสนอ",
    );
    const findings: Finding[] = c.audit?.findings_json
      ? JSON.parse(c.audit.findings_json)
      : [];
    const risk = caseRisk(findings, sc);
    const hide = (t: string) => (mask ? t.replaceAll(sc.patient, MASKED) : t);
    return {
      case_code: sc.code,
      title: sc.title,
      patient: mask ? MASKED : sc.patient,
      department: sc.department,
      payer: sc.payer,
      amount: sc.amount,
      diagnosis: sc.diagnosis,
      approved_text: hide(c.proposal),
      original_text: hide(sc.sections.at(-1)?.text ?? ""),
      findings: findings.map((f) => ({
        title: f.title,
        suggestion: f.suggestion,
        at_risk: findingRisk(f, sc, findings.length),
      })),
      at_risk_total: risk,
      denial_rate: rate,
      protected_value: protectedValue(risk, rate),
      rule_version: c.audit?.rule_version ?? "",
      approved_by: approved ? approved.actor_name || "แพทย์" : "ข้อมูลตั้งต้น",
      approved_at: approved?.created_at ?? "",
      revision: c.revision,
    };
  });
}

const csvColumns: [keyof ClaimRecord, string][] = [
  ["case_code", "รหัสเคส"],
  ["title", "สถานการณ์"],
  ["patient", "ผู้ป่วย"],
  ["department", "แผนก"],
  ["payer", "ผู้รับประกัน"],
  ["amount", "ยอดตั้งเบิก (บาท)"],
  ["diagnosis", "รายการวินิจฉัย"],
  ["approved_text", "ข้อความที่แพทย์ยืนยัน"],
  ["findings", "ประเด็นที่ตรวจทาน"],
  ["at_risk_total", "มูลค่าเสี่ยงที่แก้แล้ว (บาท)"],
  ["denial_rate", "อัตราถูกปฏิเสธที่สมมติ (%)"],
  ["protected_value", "มูลค่าที่ป้องกันได้ (บาท)"],
  ["rule_version", "เวอร์ชันกฎ"],
  ["approved_by", "แพทย์ผู้ยืนยัน"],
  ["approved_at", "เวลายืนยัน"],
  ["revision", "revision"],
];
function cell(v: unknown) {
  let s = Array.isArray(v)
    ? v
        .map((f) => `${f.title}: ${f.suggestion} [เสี่ยง ${f.at_risk} บาท]`)
        .join(" | ")
    : String(v ?? "");
  // Keep spreadsheet apps from running cell text as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
// UTF-8 with BOM so Excel shows Thai correctly.
export function toCsv(records: ClaimRecord[]) {
  const lines = [
    csvColumns.map(([, h]) => h).join(","),
    ...records.map((r) => csvColumns.map(([k]) => cell(r[k])).join(",")),
    "",
    cell(EXPORT_NOTICE),
  ];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
export function toJson(
  records: ClaimRecord[],
  meta: { exported_by: string; exported_at: string; masked: boolean },
) {
  return JSON.stringify(
    {
      format: "claimdi.claim-export",
      version: 2,
      demo: true,
      notice: EXPORT_NOTICE,
      ...meta,
      count: records.length,
      claims: records,
    },
    null,
    2,
  );
}
export const exportFileName = (ext: string, now = new Date()) =>
  `claimdi-claims-${now.toISOString().slice(0, 10)}.${ext}`;
