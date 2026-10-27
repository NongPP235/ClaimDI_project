import { money } from "@/components/ui/format";
import type { Data } from "./types";

// Claim amounts by current case status, read from the database on every
// load, so the figures follow the work done in the demo (PROJECT_PLAN §16).
const groups = [
  { label: "พร้อมส่งเคลม", statuses: ["ready"], tone: "success" },
  { label: "รอแพทย์ตรวจทาน", statuses: ["awaiting_review"], tone: "info" },
  { label: "ส่งกลับแก้ไข", statuses: ["returned"], tone: "warning" },
  {
    label: "ยังไม่ส่งแพทย์",
    statuses: ["draft", "needs_revision"],
    tone: "neutral",
  },
];
export default function CaseValues({
  data,
  compact = false,
}: {
  data: Data;
  compact?: boolean;
}) {
  const total = data.cases.reduce((s, c) => s + c.scenario.amount, 0);
  return (
    <section
      className={`case-values ${compact ? "compact" : ""}`}
      aria-labelledby="case-values-title"
    >
      <div className="case-values-head">
        <h2 id="case-values-title" className="section-title">
          มูลค่าเคสตามสถานะจริง
        </h2>
        <p className="small muted">
          รวม ฿{money(total)} จาก {data.cases.length} เคส ·
          คำนวณจากสถานะในฐานข้อมูล เปลี่ยนตามงานที่ทำ
        </p>
      </div>
      <dl className="value-tiles">
        {groups.map((g) => {
          const list = data.cases.filter((c) => g.statuses.includes(c.status));
          return (
            <div key={g.label} className={`value-tile ${g.tone}`}>
              <dt>{g.label}</dt>
              <dd>
                <strong>
                  ฿{money(list.reduce((s, c) => s + c.scenario.amount, 0))}
                </strong>
                <span>{list.length} เคส</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
