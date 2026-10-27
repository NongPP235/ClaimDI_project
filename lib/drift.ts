// Simulated data drift check for the MLOps page (PROJECT_PLAN.md §16).
// Monthly input mixes are fixed demo figures, compared with the reference
// window by Population Stability Index; nothing is measured from real data.
export type DriftStatus = "stable" | "watch" | "drift";
export const driftStatusLabels: Record<DriftStatus, string> = {
  stable: "คงที่",
  watch: "เฝ้าระวัง",
  drift: "เปลี่ยนแปลงมาก",
};
// Common PSI rule of thumb: < 0.1 stable, 0.1–0.25 watch, >= 0.25 drift.
export const statusOf = (psi: number): DriftStatus =>
  psi >= 0.25 ? "drift" : psi >= 0.1 ? "watch" : "stable";

type Feature = {
  key: string;
  label: string;
  bins: string[];
  advice: string;
};
export const features: Feature[] = [
  {
    key: "service",
    label: "ประเภทบริการ",
    bins: ["IPD", "OPD"],
    advice: "ตรวจสัดส่วนผู้ป่วยในก่อนเทียบผลกับช่วงอ้างอิง",
  },
  {
    key: "payer",
    label: "ผู้รับประกัน",
    bins: ["ประกัน A", "ประกัน B", "ประกัน C", "รายอื่น"],
    advice:
      "มีผู้รับประกันรายใหม่มากขึ้น ทบทวนกฎของผู้รับประกันรายนั้นก่อนใช้ผลตรวจ",
  },
  {
    key: "amount",
    label: "ยอดตั้งเบิก",
    bins: ["< 10k", "10k–50k", "50k–100k", "> 100k"],
    advice: "เคสยอดสูงเพิ่มขึ้น ควรสุ่มตรวจเคสยอดสูงเพิ่ม",
  },
  {
    key: "length",
    label: "ความยาวเอกสาร",
    bins: ["< 150 คำ", "150–400 คำ", "> 400 คำ"],
    advice: "รูปแบบเอกสารเปลี่ยน ตรวจว่าการอ่านเอกสารยังครบ",
  },
  {
    key: "labref",
    label: "อ้างอิงผลตรวจแล็บในใบสรุป",
    bins: ["มี", "ไม่มี"],
    advice:
      "ใบสรุปไม่อ้างผลแล็บมากขึ้น สอดคล้องกับกฎ v2.0 ที่ตรวจเอกสารอ้างอิง",
  },
];

export const reference = {
  label: "พ.ค.–ก.ค. 2569",
  cases: 3600,
  mix: {
    service: [0.42, 0.58],
    payer: [0.4, 0.33, 0.25, 0.02],
    amount: [0.38, 0.4, 0.15, 0.07],
    length: [0.2, 0.55, 0.25],
    labref: [0.7, 0.3],
  } as Record<string, number[]>,
};
export const driftWindows = [
  {
    key: "2026-08",
    label: "ส.ค. 2569",
    cases: 1180,
    mix: {
      service: [0.43, 0.57],
      payer: [0.39, 0.34, 0.25, 0.02],
      amount: [0.37, 0.41, 0.15, 0.07],
      length: [0.21, 0.54, 0.25],
      labref: [0.69, 0.31],
    } as Record<string, number[]>,
  },
  {
    key: "2026-09",
    label: "ก.ย. 2569",
    cases: 1240,
    mix: {
      service: [0.44, 0.56],
      payer: [0.35, 0.31, 0.24, 0.1],
      amount: [0.3, 0.42, 0.18, 0.1],
      length: [0.22, 0.53, 0.25],
      labref: [0.62, 0.38],
    } as Record<string, number[]>,
  },
  {
    key: "2026-10",
    label: "ต.ค. 2569",
    cases: 1310,
    mix: {
      service: [0.45, 0.55],
      payer: [0.3, 0.27, 0.21, 0.22],
      amount: [0.29, 0.41, 0.19, 0.11],
      length: [0.25, 0.5, 0.25],
      labref: [0.52, 0.48],
    } as Record<string, number[]>,
  },
];

export function psi(expected: number[], actual: number[]) {
  const eps = 1e-4;
  return expected.reduce((sum, e, i) => {
    const a = Math.max(actual[i], eps),
      x = Math.max(e, eps);
    return sum + (a - x) * Math.log(a / x);
  }, 0);
}

export function driftReport(windowKey: string) {
  const w = driftWindows.find((x) => x.key === windowKey);
  if (!w) return null;
  const rows = features.map((f) => {
    const value = psi(reference.mix[f.key], w.mix[f.key]);
    return {
      ...f,
      psi: value,
      status: statusOf(value),
      reference: reference.mix[f.key],
      current: w.mix[f.key],
    };
  });
  const worst = rows.reduce((a, b) => (b.psi > a.psi ? b : a));
  return { window: w, rows, worst, status: worst.status };
}
// One line for the history log; the window label comes first so the page
// can show the latest check again after a reload.
export function driftNote(windowKey: string) {
  const r = driftReport(windowKey)!;
  return `${r.window.label} · ${driftStatusLabels[r.status]} · PSI สูงสุด ${r.worst.psi.toFixed(2)} (${r.worst.label})`;
}
