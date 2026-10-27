export type Status =
  "draft" | "needs_revision" | "awaiting_review" | "returned" | "ready";
export const statuses: Record<Status, string> = {
  draft: "ยังไม่ตรวจ",
  needs_revision: "ต้องตรวจทานข้อมูล",
  awaiting_review: "รอแพทย์ตรวจทาน",
  returned: "ส่งกลับแก้ไข",
  ready: "พร้อมส่งเคลม",
};
export type Finding = {
  title: string;
  evidence: string;
  suggestion: string;
  severity: "warning" | "info";
  // Claim amount likely denied if the issue goes to the insurer unfixed
  // (baht, demo assumption; PROJECT_PLAN.md §18).
  atRisk: number;
};
export type Scenario = {
  code: string;
  title: string;
  patient: string;
  department: string;
  payer: string;
  amount: number;
  status: Status;
  diagnosis: string;
  sections: { title: string; text: string }[];
  findings: Finding[];
  proposal: string;
  // Set on cases imported from a hospital system (PROJECT_PLAN.md §19).
  source?: "his";
};
export const scenarios: Scenario[] = [
  {
    code: "DEMO-001",
    title: "ปอดอักเสบ · ข้อมูลประกอบไม่ครบ",
    patient: "ผู้ป่วยตัวอย่าง A",
    department: "อายุรกรรม · IPD",
    payer: "ประกันตัวอย่าง A",
    amount: 48500,
    status: "draft",
    diagnosis: "J18.9 · Pneumonia",
    sections: [
      {
        title: "อาการและประวัติ",
        text: "ผู้ป่วยตัวอย่าง A มีไข้ ไอ และหอบเหนื่อย เข้ารับการรักษาเป็นผู้ป่วยใน แพทย์บันทึกการวินิจฉัยปอดอักเสบ (J18.9)",
      },
      {
        title: "ผลตรวจที่บันทึกไว้",
        text: "SpO₂ แรกรับ 91% และ Sodium 128 mEq/L ข้อมูลทั้งหมดสร้างขึ้นเพื่อสาธิต ไม่ใช่ค่าจากผู้ป่วยจริง",
      },
      {
        title: "สรุปการรักษา",
        text: "ได้รับการรักษาและเฝ้าติดตามอาการ ใบสรุปยังไม่ได้อ้างอิงผลตรวจแรกรับ และยังไม่มีคำอธิบายความจำเป็นของการรับไว้รักษา",
      },
    ],
    findings: [
      {
        title: "ขาดข้อมูลประกอบการรับไว้รักษา",
        evidence: "SpO₂ แรกรับ 91%",
        suggestion: "เสนอให้แพทย์ตรวจทานและอ้างอิงข้อมูลแรกรับที่มีอยู่ในแฟ้ม",
        severity: "warning",
        atRisk: 29000,
      },
      {
        title: "ผลตรวจยังไม่เชื่อมกับใบสรุป",
        evidence: "Sodium 128 mEq/L",
        suggestion:
          "ให้แพทย์พิจารณาความเกี่ยวข้องกับสรุปการรักษา ไม่เพิ่มรหัสโรคจากค่าแล็บโดยอัตโนมัติ",
        severity: "info",
        atRisk: 6500,
      },
    ],
    proposal:
      "ข้อเสนอสำหรับแพทย์ตรวจทาน: เพิ่มการอ้างอิงสัญญาณชีพและผลตรวจแรกรับจากแฟ้มเดิม พร้อมระบุเหตุผลการรับไว้รักษาที่แพทย์ยืนยันได้ โดยไม่เพิ่มการวินิจฉัยจากผลแล็บเพียงอย่างเดียว",
  },
  {
    code: "DEMO-002",
    title: "เอกสารครบ · พร้อมตรวจทาน",
    patient: "ผู้ป่วยตัวอย่าง B",
    department: "ศัลยกรรม · IPD",
    payer: "ประกันตัวอย่าง B",
    amount: 32500,
    status: "ready",
    diagnosis: "เคสเอกสารครบ",
    sections: [
      {
        title: "ประวัติและการรักษา",
        text: "เอกสารตัวอย่างระบุอาการ การรักษา และเหตุผลการรับไว้รักษาครบถ้วน",
      },
      {
        title: "สรุปการรักษา",
        text: "ข้อมูลในเอกสารตัวอย่างสอดคล้องกัน มีหลักฐานประกอบครบสำหรับสถานการณ์สาธิตนี้",
      },
    ],
    findings: [],
    proposal: "คงข้อความต้นฉบับ ไม่มีข้อเสนอเพิ่มเติมในสถานการณ์ตัวอย่างนี้",
  },
  {
    code: "DEMO-003",
    title: "รหัสกับข้อความไม่สอดคล้อง",
    patient: "ผู้ป่วยตัวอย่าง C",
    department: "อายุรกรรม · OPD",
    payer: "ประกันตัวอย่าง A",
    amount: 6800,
    status: "draft",
    diagnosis: "ตัวอย่างตรวจรหัส",
    sections: [
      {
        title: "บันทึกการรักษา",
        text: "ข้อความวินิจฉัยในใบสรุปและคำอธิบายรหัสในแบบฟอร์มจำลองเป็นคนละรายการ",
      },
      {
        title: "สรุปการรักษา",
        text: "ยังไม่ได้ตรวจยืนยันรหัสจากแพทย์เจ้าของไข้",
      },
    ],
    findings: [
      {
        title: "ตรวจยืนยันรหัสกับข้อความวินิจฉัย",
        evidence: "เป็นคนละรายการ",
        suggestion:
          "ขอให้ผู้ตรวจรหัสตรวจสอบจากบันทึกที่แพทย์รับรองก่อนเปลี่ยนรหัส",
        severity: "warning",
        atRisk: 4100,
      },
    ],
    proposal:
      "ส่งข้อความวินิจฉัยและรหัสเดิมให้ผู้ตรวจรหัสกับแพทย์ตรวจยืนยัน ไม่เลือกใช้รหัสใหม่โดยระบบอัตโนมัติ",
  },
  {
    code: "DEMO-004",
    title: "หลักฐานไม่เพียงพอ",
    patient: "ผู้ป่วยตัวอย่าง D",
    department: "อุบัติเหตุ · OPD",
    payer: "ประกันตัวอย่าง C",
    amount: 12500,
    status: "draft",
    diagnosis: "เอกสารแนบขาด",
    sections: [
      {
        title: "บันทึกการรักษา",
        text: "บันทึกการรักษาอ้างถึงเอกสารแนบ แต่ไม่มีเอกสารดังกล่าวในชุดตัวอย่าง",
      },
      {
        title: "สรุปการรักษา",
        text: "ไม่สามารถยืนยันรายละเอียดจากข้อมูลที่มีได้",
      },
    ],
    findings: [
      {
        title: "ต้องตรวจสอบเอกสารแนบ",
        evidence: "ไม่มีเอกสารดังกล่าว",
        suggestion:
          "ส่งกลับเพื่อขอเอกสารประกอบ ห้ามเติมรายละเอียดที่ไม่มีหลักฐาน",
        severity: "warning",
        atRisk: 9800,
      },
    ],
    proposal:
      "ขอผู้รับผิดชอบตรวจสอบเอกสารแนบก่อนส่งเคลม ยังไม่ยืนยันรายละเอียดที่ขาดหลักฐาน",
  },
  {
    code: "DEMO-005",
    title: "รอแพทย์ตรวจข้อเสนอ",
    patient: "ผู้ป่วยตัวอย่าง E",
    department: "อายุรกรรม · IPD",
    payer: "ประกันตัวอย่าง B",
    amount: 27900,
    status: "awaiting_review",
    diagnosis: "ตัวอย่างการตรวจทาน",
    sections: [
      {
        title: "บันทึกการรักษา",
        text: "มีการติดตามอาการระหว่างรักษาในบันทึกประจำวัน",
      },
      {
        title: "สรุปการรักษา",
        text: "ใบสรุปไม่ได้อ้างถึงบันทึกการติดตามอาการ",
      },
    ],
    findings: [
      {
        title: "เชื่อมบันทึกติดตามอาการ",
        evidence: "บันทึกประจำวัน",
        suggestion: "เพิ่มการอ้างอิงบันทึกที่มีอยู่เพื่อให้ตรวจทานได้",
        severity: "info",
        atRisk: 5600,
      },
    ],
    proposal:
      "เพิ่มการอ้างอิงบันทึกติดตามอาการประจำวันตามเอกสารเดิม ให้แพทย์ตรวจยืนยันก่อนใช้ในใบสรุป",
  },
  {
    code: "DEMO-006",
    title: "ทดลองข้อผิดพลาดและลองใหม่",
    patient: "ผู้ป่วยตัวอย่าง F",
    department: "อายุรกรรม · OPD",
    payer: "ประกันตัวอย่าง C",
    amount: 4200,
    status: "draft",
    diagnosis: "เคสทดสอบการกู้คืน",
    sections: [
      {
        title: "เอกสารตัวอย่าง",
        text: "การตรวจครั้งแรกของเคสนี้จะจำลองข้อผิดพลาด กดตรวจอีกครั้งเพื่อทดลองการกู้คืน โดยข้อมูลเดิมไม่หาย",
      },
      {
        title: "สรุปการรักษา",
        text: "เอกสารตัวอย่างครบถ้วน ไม่มีข้อเสนอเพิ่มเติม",
      },
    ],
    findings: [],
    proposal: "คงข้อความต้นฉบับ หลังจากลองประมวลผลใหม่สำเร็จ",
  },
];
export function findingsFor(scenario: Scenario, version: string): Finding[] {
  return version === "2.0" && scenario.code === "DEMO-001"
    ? [
        ...scenario.findings,
        {
          title: "กฎใหม่: ตรวจวันที่ของเอกสารอ้างอิง",
          evidence: "ผลตรวจแรกรับ",
          suggestion:
            "ตัวอย่างกฎ 2.0 ขอให้ตรวจวันที่ของผลตรวจที่อ้างถึงก่อนยืนยัน",
          severity: "info",
          atRisk: 4500,
        },
      ]
    : scenario.findings;
}
