"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  FileJson,
  FileSpreadsheet,
  Info,
  Printer,
  Undo2,
} from "lucide-react";
import { canAct, caseLink } from "@/lib/permissions";
import {
  EXPORT_NOTICE,
  buildRecords,
  exportFileName,
  toCsv,
  toJson,
  type ClaimRecord,
} from "@/lib/claim-export";
import { date, money } from "@/components/ui/format";
import type { Act, Case, Data } from "./types";

type Format = "print" | "csv" | "json";
const formats: {
  value: Format;
  label: string;
  hint: string;
  icon: typeof Printer;
}[] = [
  {
    value: "print",
    label: "พิมพ์ / บันทึก PDF",
    hint: "เอกสาร A4 หนึ่งหน้าต่อเคส",
    icon: Printer,
  },
  {
    value: "csv",
    label: "Excel (CSV)",
    hint: "ตารางหนึ่งแถวต่อเคส",
    icon: FileSpreadsheet,
  },
  {
    value: "json",
    label: "JSON",
    hint: "ข้อมูลดิจิทัลสำหรับนำเข้าระบบอื่น",
    icon: FileJson,
  },
];

function download(text: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Ready and returned cases with exports for staff (PROJECT_PLAN.md §15).
export default function ClaimsOut({
  data,
  busy,
  act,
}: {
  data: Data;
  busy: string;
  act: Act;
}) {
  const role = data.user.role;
  const ready = data.cases.filter((c) => c.status === "ready" && c.detail),
    returned = data.cases.filter((c) => c.status === "returned" && c.detail);
  const [tab, setTab] = useState<"ready" | "returned">("ready"),
    [picked, setPicked] = useState<Set<string>>(
      () => new Set(ready.map((c) => c.id)),
    ),
    [mask, setMask] = useState(false),
    [printing, setPrinting] = useState<ClaimRecord[] | null>(null);
  // Newly approved cases join the selection; reset ones drop out.
  const known = useRef(new Set(ready.map((c) => c.id)));
  const readyKey = ready.map((c) => c.id).join();
  useEffect(() => {
    const ids = new Set(ready.map((c) => c.id));
    setPicked((p) => {
      const next = new Set([...p].filter((id) => ids.has(id)));
      ids.forEach((id) => {
        if (!known.current.has(id)) next.add(id);
      });
      return next;
    });
    known.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);

  const chosen = ready.filter((c) => picked.has(c.id));
  const history = data.history;
  const approval = (c: Case) =>
    history.find(
      (h) => h.case_id === c.id && h.action === "แพทย์ยืนยันข้อเสนอ",
    );
  const lastExport = (c: Case) =>
    history.find((h) => h.case_id === c.id && h.action === "ส่งออกข้อมูลเคลม");
  const reason = (c: Case) =>
    history.find((h) => h.case_id === c.id && h.action === "แพทย์ส่งกลับ");
  const href = (c: Case) => {
    const to = caseLink(role, c.status);
    return to ? `/demo/${to}/${c.id}` : null;
  };
  const allPicked = ready.length > 0 && chosen.length === ready.length;
  const canExport = canAct(role, "export");

  async function exportAs(format: Format) {
    if (!chosen.length) return;
    const ids = chosen.map((c) => c.id);
    // The server checks the role and logs the export before any file exists.
    if (!(await act("export", undefined, { ids, format }))) return;
    const now = new Date(),
      records = buildRecords(chosen, history, mask, data.denialRate);
    if (format === "csv")
      download(toCsv(records), "text/csv;charset=utf-8", exportFileName("csv"));
    else if (format === "json")
      download(
        toJson(records, {
          exported_by: data.user.name,
          exported_at: now.toISOString(),
          masked: mask,
        }),
        "application/json",
        exportFileName("json"),
      );
    else setPrinting(records);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CLAIM SUBMISSION</p>
          <h1>เคสพร้อมส่งประกัน</h1>
          <p>
            ดูเคสที่แพทย์ยืนยันแล้วและเคสที่ส่งกลับเจ้าหน้าที่
            แล้วส่งออกไฟล์ให้เจ้าหน้าที่นำไปส่งบริษัทประกัน
          </p>
        </div>
      </div>
      <div className="view-tabs" role="tablist" aria-label="กลุ่มเคส">
        <button
          role="tab"
          id="tab-ready"
          aria-controls="pane-claims"
          aria-selected={tab === "ready"}
          onClick={() => setTab("ready")}
        >
          พร้อมส่งเคลม <span className="tab-count">{ready.length}</span>
        </button>
        <button
          role="tab"
          id="tab-returned"
          aria-controls="pane-claims"
          aria-selected={tab === "returned"}
          onClick={() => setTab("returned")}
        >
          ส่งกลับเจ้าหน้าที่{" "}
          <span className="tab-count">{returned.length}</span>
        </button>
      </div>
      <div
        id="pane-claims"
        role="tabpanel"
        aria-labelledby={tab === "ready" ? "tab-ready" : "tab-returned"}
      >
        {tab === "ready" ? (
          ready.length === 0 ? (
            <div className="empty">
              <ClipboardCheck size={34} aria-hidden="true" />
              <h2>ยังไม่มีเคสพร้อมส่งเคลม</h2>
              <p>เมื่อแพทย์ยืนยันข้อเสนอ เคสจะมาแสดงที่นี่เพื่อส่งออกไฟล์</p>
            </div>
          ) : (
            <>
              {canExport && (
                <section
                  className="export-panel"
                  aria-labelledby="export-title"
                >
                  <div className="export-head">
                    <div>
                      <h2 id="export-title" className="section-title">
                        ส่งออกข้อมูลสำหรับส่งประกัน
                      </h2>
                      <p className="small muted" aria-live="polite">
                        เลือกแล้ว {chosen.length} จาก {ready.length} เคส ·
                        ทุกการส่งออกบันทึกในประวัติเคส
                      </p>
                    </div>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={mask}
                        onChange={(e) => setMask(e.target.checked)}
                      />
                      ปิดบังชื่อผู้ป่วยในไฟล์
                    </label>
                  </div>
                  <div className="export-actions">
                    {formats.map((f) => (
                      <button
                        key={f.value}
                        className={`export-option ${f.value === "print" ? "primary" : ""}`}
                        disabled={!chosen.length || !!busy}
                        onClick={() => exportAs(f.value)}
                      >
                        <f.icon size={20} aria-hidden="true" />
                        <span>
                          <strong>{f.label}</strong>
                          <small>{f.hint}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  {!chosen.length && (
                    <p className="small muted">
                      เลือกอย่างน้อย 1 เคสเพื่อส่งออก
                    </p>
                  )}
                </section>
              )}
              <ul className="claim-rows" aria-label="เคสพร้อมส่งเคลม">
                {canExport && (
                  <li className="claim-row claim-row-head">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={allPicked}
                        onChange={(e) =>
                          setPicked(
                            new Set(
                              e.target.checked ? ready.map((c) => c.id) : [],
                            ),
                          )
                        }
                      />
                      เลือกทั้งหมด
                    </label>
                  </li>
                )}
                {ready.map((c) => {
                  const a = approval(c),
                    ex = lastExport(c),
                    link = href(c);
                  return (
                    <li key={c.id} className="claim-row">
                      {canExport && (
                        <input
                          type="checkbox"
                          aria-label={`เลือก ${c.scenario.code}`}
                          checked={picked.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(picked);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            setPicked(next);
                          }}
                        />
                      )}
                      <div className="claim-main">
                        <span className="case-code">{c.scenario.code}</span>
                        {link ? (
                          <Link className="case-link" href={link}>
                            {c.scenario.title}
                          </Link>
                        ) : (
                          <strong className="case-link">
                            {c.scenario.title}
                          </strong>
                        )}
                        <small>
                          {c.scenario.payer} · ฿{money(c.scenario.amount)}
                        </small>
                      </div>
                      <div className="claim-meta">
                        <span>
                          แพทย์ยืนยัน:{" "}
                          {a
                            ? `${a.actor_name || "แพทย์"} · ${date(a.created_at)}`
                            : "ข้อมูลตั้งต้น"}
                        </span>
                        <span className="muted">
                          {ex
                            ? `ส่งออกล่าสุด ${ex.note} · ${date(ex.created_at)}`
                            : "ยังไม่เคยส่งออก"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )
        ) : returned.length === 0 ? (
          <div className="empty">
            <Undo2 size={34} aria-hidden="true" />
            <h2>ไม่มีเคสที่ส่งกลับเจ้าหน้าที่</h2>
            <p>เคสที่แพทย์ส่งกลับพร้อมเหตุผลจะแสดงที่นี่จนกว่าจะส่งตรวจใหม่</p>
          </div>
        ) : (
          <ul className="claim-rows" aria-label="เคสที่ส่งกลับเจ้าหน้าที่">
            {returned.map((c) => {
              const r = reason(c),
                link = href(c);
              return (
                <li key={c.id} className="claim-row returned">
                  <div className="claim-main">
                    <span className="case-code">{c.scenario.code}</span>
                    {link ? (
                      <Link className="case-link" href={link}>
                        {c.scenario.title}
                      </Link>
                    ) : (
                      <strong className="case-link">{c.scenario.title}</strong>
                    )}
                    <small>
                      {r
                        ? `ส่งกลับโดย ${r.actor_name || "แพทย์"} · ${date(r.created_at)}`
                        : "แพทย์ส่งกลับ"}
                    </small>
                  </div>
                  <div className="claim-reason">
                    <strong>เหตุผล</strong>
                    <p>{r?.note || "—"}</p>
                  </div>
                  {link && role !== "doctor" && (
                    <Link className="text-button" href={link}>
                      แก้ไขเคส <ArrowRight size={16} />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="list-foot">
        <span>
          <Info size={14} aria-hidden="true" />
          {EXPORT_NOTICE} ระบบไม่ได้ส่งข้อมูลไปบริษัทประกันเอง
        </span>
      </div>
      {printing &&
        createPortal(
          <PrintSheet
            records={printing}
            by={data.user.name}
            at={new Date().toISOString()}
          />,
          document.body,
        )}
    </>
  );
}
// Print-only document; the browser's print dialog also saves it as PDF.
function PrintSheet({
  records,
  by,
  at,
}: {
  records: ClaimRecord[];
  by: string;
  at: string;
}) {
  return (
    <div className="print-sheet">
      {records.map((r) => (
        <article key={r.case_code} className="print-page">
          <header>
            <div>
              <strong>Claim Di</strong>
              <span>สรุปข้อมูลประกอบการเคลม</span>
            </div>
            <span className="print-demo">ข้อมูลจำลอง · DEMO</span>
          </header>
          <h1>
            {r.case_code} · {r.title}
          </h1>
          <dl>
            <div>
              <dt>ผู้ป่วย</dt>
              <dd>{r.patient}</dd>
            </div>
            <div>
              <dt>แผนก</dt>
              <dd>{r.department}</dd>
            </div>
            <div>
              <dt>ผู้รับประกัน</dt>
              <dd>{r.payer}</dd>
            </div>
            <div>
              <dt>ยอดตั้งเบิก</dt>
              <dd>฿{money(r.amount)}</dd>
            </div>
            <div>
              <dt>รายการวินิจฉัย</dt>
              <dd>{r.diagnosis}</dd>
            </div>
            <div>
              <dt>มูลค่าที่ป้องกันได้ (ประมาณ)</dt>
              <dd>
                {r.at_risk_total
                  ? `฿${money(r.protected_value)} (เสี่ยง ฿${money(r.at_risk_total)} × ${r.denial_rate}%)`
                  : "ไม่มีประเด็นต้องแก้"}
              </dd>
            </div>
            <div>
              <dt>เวอร์ชันกฎ / revision</dt>
              <dd>
                {r.rule_version || "—"} / {r.revision}
              </dd>
            </div>
          </dl>
          <h2>ข้อความที่แพทย์ยืนยัน</h2>
          <p className="print-box">{r.approved_text || "คงข้อความต้นฉบับ"}</p>
          <h2>ต้นฉบับ</h2>
          <p className="print-box muted">{r.original_text}</p>
          <h2>ประเด็นที่ตรวจทาน ({r.findings.length})</h2>
          {r.findings.length ? (
            <ol>
              {r.findings.map((f, i) => (
                <li key={i}>
                  <strong>{f.title}</strong> — {f.suggestion}{" "}
                  <span className="muted">(เสี่ยง ฿{money(f.at_risk)})</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>ไม่พบประเด็นในผลตรวจตัวอย่าง</p>
          )}
          <div className="print-sign">
            <div>
              <span>แพทย์ผู้ยืนยัน</span>
              <strong>{r.approved_by}</strong>
              <small>{r.approved_at ? date(r.approved_at) : "—"}</small>
            </div>
            <div>
              <span>ผู้ส่งออกเอกสาร</span>
              <strong>{by}</strong>
              <small>{date(at)}</small>
            </div>
          </div>
          <footer>{EXPORT_NOTICE}</footer>
        </article>
      ))}
    </div>
  );
}
