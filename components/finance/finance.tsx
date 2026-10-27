"use client";
import { useState } from "react";
import { BadgeCheck, Info } from "lucide-react";
import { calculate, packageNames, prices } from "@/lib/calculator";
import { canAct } from "@/lib/permissions";
import CaseValues from "@/components/claims/case-values";
import Prevented from "./prevented";
import type { Act, Data } from "@/components/claims/types";
import DataTable from "@/components/ui/data-table";
import { money } from "@/components/ui/format";

const packages = packageNames;
const months = ["พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค."];
// Fixture, kept apart from case approvals (PROJECT_PLAN §6).
const collections = [25000, 32000, 38000, 43000, 50000, 57000];

const countError = (n: number) =>
  !Number.isInteger(n) || n < 0 || n > 1000 ? "กรอกจำนวนเต็ม 0–1,000 สาขา" : "";
const benefitError = (n: number) =>
  !Number.isFinite(n) || n < 0 || n > 1e10
    ? "กรอกจำนวนเงินที่ไม่ติดลบ ไม่เกิน 10,000 ล้านบาท"
    : "";

// CFO view (/demo/finance): UX_UI_PLAN §3.5.
export default function Finance({
  data,
  busy,
  act,
}: {
  data: Data;
  busy: string;
  act: Act;
}) {
  const current = Math.max(0, packages.indexOf(data.package));
  const [counts, setCounts] = useState([1, 0, 0]),
    [benefit, setBenefit] = useState(60000);
  const errors = counts.map(countError),
    bError = benefitError(benefit);
  const valid = errors.every((e) => !e) && !bError;
  const result = valid ? calculate(counts, benefit) : null;
  const max = Math.max(...collections);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCIAL OVERVIEW</p>
          <h1>ภาพรวมการเงิน</h1>
          <p>แยกข้อมูลผลลัพธ์ตัวอย่างออกจากการคำนวณสมมติฐาน</p>
        </div>
        <span className="workspace-tag">
          <Info size={15} aria-hidden="true" />
          ตัวเลขเพื่อสาธิตเท่านั้น
        </span>
      </div>

      <section className="package-card" aria-labelledby="package-title">
        <BadgeCheck size={26} aria-hidden="true" />
        <div>
          <p className="eyebrow">CURRENT PACKAGE</p>
          <h2 id="package-title">
            โรงพยาบาลนี้ใช้แพ็กเกจ <strong>{data.package}</strong>
          </h2>
          <p className="small muted">
            ค่าลิขสิทธิ์ ฿{money(prices[current])} ต่อสาขาต่อปี ก่อนส่วนลด ·
            ตั้งค่าเพื่อสาธิต ไม่ใช่สัญญาจริง
          </p>
        </div>
        {canAct(data.user.role, "package") && (
          <label className="package-select">
            <span>เปลี่ยนแพ็กเกจ</span>
            <select
              value={data.package}
              disabled={!!busy}
              onChange={(e) =>
                act("package", undefined, { package: e.target.value })
              }
            >
              {packages.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <CaseValues data={data} />
      <Prevented data={data} busy={busy} act={act} />

      <h2 className="section-title">ข้อมูลผลลัพธ์ตัวอย่าง</h2>
      <div className="metrics">
        <div>
          <span>ยอดรับชำระในข้อมูลตัวอย่าง</span>
          <strong>฿{money(collections.reduce((a, b) => a + b, 0))}</strong>
        </div>
        <div>
          <span>ช่วงข้อมูลตัวอย่าง</span>
          <strong>
            6 <small>เดือน</small>
          </strong>
        </div>
      </div>
      <section className="finance-chart" aria-labelledby="collections-title">
        <div>
          <p className="eyebrow">SAMPLE COLLECTIONS</p>
          <h3 id="collections-title">ยอดรับชำระตัวอย่างรายเดือน (บาท)</h3>
          <p>
            พ.ค.–ต.ค. 2569 · ข้อมูลจำลองคงที่ ไม่เปลี่ยนตามการยืนยันเคสในเดโม
          </p>
          <span className="data-demo-label">ข้อมูลจำลอง</span>
        </div>
        <div>
          <div className="bars" aria-hidden="true">
            {collections.map((n, i) => (
              <div key={i}>
                <span>฿{n / 1000}k</span>
                <i style={{ height: `${(n / max) * 114}px` }} />
                <small>{months[i]}</small>
              </div>
            ))}
          </div>
          <DataTable
            caption="ยอดรับชำระตัวอย่างรายเดือน (บาท)"
            headers={["เดือน", "ยอดรับชำระ (บาท)"]}
            rows={collections.map((n, i) => [months[i], money(n)])}
          />
        </div>
      </section>

      <h2 className="section-title">คำนวณความคุ้มค่าจากสมมติฐาน</h2>
      <section className="calculator" aria-label="เครื่องคำนวณแพ็กเกจ">
        <form
          className="calculator-input"
          noValidate
          onSubmit={(e) => e.preventDefault()}
        >
          <p className="eyebrow">PACKAGE CALCULATOR</p>
          <h3>จำนวนสาขาและผลประโยชน์</h3>
          <p className="muted">
            ส่วนลดคิดจากจำนวนสาขารวมทุกแพ็กเกจ และลดจากค่าลิขสิทธิ์รายปีรวม
          </p>
          {packages.map((name, i) => (
            <div className="package-row" key={name}>
              <label htmlFor={`count-${name}`}>
                <strong>
                  {name}
                  {i === current && (
                    <span className="current-tag">ใช้อยู่</span>
                  )}
                </strong>
                <small>฿{money(prices[i])} / สาขา / ปี</small>
              </label>
              <span>
                <input
                  id={`count-${name}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1000}
                  step={1}
                  value={Number.isNaN(counts[i]) ? "" : counts[i]}
                  aria-invalid={!!errors[i]}
                  aria-describedby={
                    errors[i] ? `count-${name}-error` : undefined
                  }
                  onChange={(e) =>
                    setCounts(
                      counts.map((n, j) =>
                        i === j ? e.target.valueAsNumber : n,
                      ),
                    )
                  }
                />{" "}
                สาขา
              </span>
              {errors[i] && (
                <p className="field-error" id={`count-${name}-error`}>
                  {errors[i]}
                </p>
              )}
            </div>
          ))}
          <div className="field benefit">
            <label htmlFor="benefit">ผลประโยชน์คาดการณ์รวมต่อเดือน (บาท)</label>
            <input
              id="benefit"
              type="number"
              inputMode="decimal"
              min={0}
              max={1e10}
              value={Number.isNaN(benefit) ? "" : benefit}
              aria-invalid={!!bError}
              aria-describedby={`benefit-help${bError ? " benefit-error" : ""}`}
              onChange={(e) => setBenefit(e.target.valueAsNumber)}
            />
            <span className="small muted" id="benefit-help">
              ตัวเลขที่คุณสมมติเอง เช่น ค่าเคลมที่ลดการถูกปฏิเสธได้ต่อเดือน
            </span>
            {bError && (
              <p className="field-error" id="benefit-error">
                {bError}
              </p>
            )}
          </div>
          <details>
            <summary>ดูวิธีคำนวณ</summary>
            <p>
              3–5 สาขา ลด 10% · 6–15 ลด 15% · 16 ขึ้นไป ลด 20%
              ใช้จำนวนสาขารวมกำหนดส่วนลดจากค่าลิขสิทธิ์ทั้งหมด
            </p>
            <p>ค่าบริการรวม = Σ(จำนวนสาขา × ราคาแพ็กเกจ) × (1 − ส่วนลด)</p>
            <p>
              ROI ต่อปี = (ผลประโยชน์ต่อปี − ค่าบริการต่อปี) ÷ ค่าบริการต่อปี ×
              100
            </p>
            <p>
              ระยะคืนทุน = ค่าบริการรายปี ÷ ผลประโยชน์รายเดือน
              สมมติจ่ายรายปีล่วงหน้า ผลประโยชน์สม่ำเสมอ และไม่รวมค่าใช้จ่ายอื่น
              ปัดเศษทศนิยม 1 ตำแหน่ง
            </p>
          </details>
        </form>
        <div className="calculator-result" aria-live="polite">
          <p className="eyebrow">YOUR ESTIMATE</p>
          <h3>ประมาณการค่าบริการรายปี</h3>
          {!result ? (
            <p className="notice">แก้ช่องที่ระบุทางซ้ายเพื่อดูผลคำนวณ</p>
          ) : (
            <>
              <div className="estimate">฿{money(result.total)}</div>
              <p>
                {result.branches} สาขา · ส่วนลด {result.discount * 100}%
              </p>
              <div className="estimate-divider" />
              <dl>
                <div>
                  <dt>ก่อนส่วนลด</dt>
                  <dd>฿{money(result.subtotal)}</dd>
                </div>
                <div>
                  <dt>ส่วนลดค่าบริการ</dt>
                  <dd>฿{money(result.subtotal - result.total)}</dd>
                </div>
                <div>
                  <dt>ผลประโยชน์คาดการณ์ต่อปี</dt>
                  <dd>฿{money(benefit * 12)}</dd>
                </div>
                <div>
                  <dt>ROI ต่อปี</dt>
                  <dd>
                    {result.roi === null ? "—" : `${result.roi.toFixed(1)}%`}
                  </dd>
                </div>
                <div>
                  <dt>ระยะคืนทุนจำลอง</dt>
                  <dd>
                    {result.payback === null
                      ? "—"
                      : `${result.payback.toFixed(1)} เดือน`}
                  </dd>
                </div>
              </dl>
              {result.branches === 0 ? (
                <p className="notice">เลือกอย่างน้อย 1 สาขาเพื่อคำนวณ ROI</p>
              ) : result.payback === null ? (
                <p className="notice">
                  ผลประโยชน์เป็นศูนย์ จึงไม่สามารถคำนวณระยะคืนทุนได้
                </p>
              ) : result.payback > 12 ? (
                <p className="notice">ตามสมมติฐานนี้ ยังไม่คืนทุนภายในปีแรก</p>
              ) : null}
              <p className="result-disclaimer">
                <Info size={16} aria-hidden="true" />
                ค่าประมาณจากสมมติฐาน ไม่ใช่การรับประกันรายได้หรือข้อเสนอขายจริง
                และไม่รวมกับยอดรับชำระตัวอย่าง
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
