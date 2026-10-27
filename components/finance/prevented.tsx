"use client";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { packageNames, prices } from "@/lib/calculator";
import { canAct } from "@/lib/permissions";
import { protectedValue } from "@/lib/value";
import { money } from "@/components/ui/format";
import type { Act, Data } from "@/components/claims/types";

// Estimated value protected by fixing issues before submission
// (PROJECT_PLAN.md §17–18): per-finding at-risk amounts of confirmed
// claims × an assumed denial rate.
export default function Prevented({
  data,
  busy,
  act,
}: {
  data: Data;
  busy: string;
  act: Act;
}) {
  const { cases, amount, findings } = data.prevented;
  const rate = data.denialRate;
  const [draft, setDraft] = useState(String(rate)),
    [error, setError] = useState("");
  useEffect(() => setDraft(String(rate)), [rate]);
  const value = protectedValue(amount, rate),
    pending = protectedValue(data.pending.amount, rate);
  const price = prices[Math.max(0, packageNames.indexOf(data.package))];
  const can = canAct(data.user.role, "denial_rate");

  function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isInteger(n) || n < 0 || n > 100) {
      setError("กรอกจำนวนเต็ม 0–100");
      return;
    }
    setError("");
    act("denial_rate", undefined, { rate: n });
  }

  return (
    <section className="prevented-card" aria-labelledby="prevented-title">
      <div className="prevented-head">
        <ShieldCheck size={24} aria-hidden="true" />
        <div>
          <p className="eyebrow">PROTECTED VALUE · ESTIMATE</p>
          <h2 id="prevented-title">มูลค่าที่ช่วยป้องกันได้</h2>
        </div>
        <span className="data-demo-label">ค่าประมาณจากสมมติฐาน</span>
      </div>
      {cases === 0 ? (
        <p className="notice">
          ยังไม่มีเคสที่แก้ประเด็นและแพทย์ยืนยันก่อนส่ง
          เมื่อแพทย์ยืนยันเคสที่มีประเด็น ตัวเลขจะคำนวณให้ที่นี่
        </p>
      ) : (
        <div className="prevented-body">
          <div className="prevented-value">
            <strong>฿{money(value)}</strong>
            <span>ประมาณการเงินที่น่าจะไม่ถูกปฏิเสธ</span>
          </div>
          <dl className="prevented-math">
            <div>
              <dt>มูลค่าเสี่ยงถูกปฏิเสธที่แก้แล้ว</dt>
              <dd>
                ฿{money(amount)}
                <small>
                  {cases} เคส · แก้ {findings} ประเด็น · แพทย์ยืนยันแล้ว
                </small>
              </dd>
            </div>
            <div>
              <dt>× อัตราการถูกปฏิเสธที่สมมติ</dt>
              <dd>{rate}%</dd>
            </div>
            <div>
              <dt>รอแก้และแพทย์ยืนยันอีก</dt>
              <dd>
                ฿{money(pending)}
                <small>
                  มูลค่าเสี่ยง ฿{money(data.pending.amount)} ·{" "}
                  {data.pending.cases} เคส
                </small>
              </dd>
            </div>
            <div>
              <dt>เทียบค่าแพ็กเกจ {data.package} (ต่อสาขาต่อปี)</dt>
              <dd>
                ฿{money(price)}
                <small>
                  คิดเป็น {((value / price) * 100).toFixed(1)}% ของค่าบริการ
                </small>
              </dd>
            </div>
          </dl>
        </div>
      )}
      {can ? (
        <form className="rate-form" onSubmit={save} noValidate>
          <label htmlFor="denial-rate">อัตราการถูกปฏิเสธที่สมมติ (%)</label>
          <div>
            <input
              id="denial-rate"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={draft}
              aria-invalid={!!error}
              aria-describedby={`denial-rate-help${error ? " denial-rate-error" : ""}`}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              className="button secondary"
              disabled={!!busy || draft === String(rate)}
            >
              บันทึกอัตรา
            </button>
          </div>
          <span className="small muted" id="denial-rate-help">
            สัดส่วนของเคสที่มีประเด็นซึ่งน่าจะถูกปฏิเสธถ้าไม่แก้ก่อนส่ง ·
            ใช้ร่วมกันทุกบัญชี
          </span>
          {error && (
            <p className="field-error" id="denial-rate-error">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="small muted">
          อัตราที่สมมติ {rate}% ตั้งโดย CFO หรือ Admin
        </p>
      )}
      <p className="result-disclaimer small">
        ไม่ใช่เงินที่ได้รับจริงและไม่รวมกับยอดรับชำระตัวอย่าง
        คิดเฉพาะเคสที่พร้อมส่งเคลม มีประเด็นจากผลตรวจ และแพทย์ยืนยันแล้ว ·
        มูลค่าเสี่ยงแต่ละประเด็นเป็นค่าสมมติของระบบสาธิต
        ไม่เกินยอดตั้งเบิกของเคส
      </p>
    </section>
  );
}
