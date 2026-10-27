"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Info,
  ListChecks,
  LoaderCircle,
  Plus,
  ScanLine,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { Finding } from "@/lib/scenarios";
import Badge from "@/components/ui/badge";
import { date, money } from "@/components/ui/format";
import { canAct, canView } from "@/lib/permissions";
import { caseRisk, findingRisk, protectedValue } from "@/lib/value";
import { roleLabels, type Act, type Case, type Data } from "./types";

const steps = [
  "เอกสารตัวอย่าง",
  "ตรวจและเสนอแก้ไข",
  "แพทย์ตรวจทาน",
  "พร้อมส่งเคลม",
];
const tabs = [
  ["document", "เอกสาร"],
  ["results", "ผลตรวจ"],
  ["proposal", "ข้อเสนอ"],
] as const;
type Tab = (typeof tabs)[number][0];

// Case workspace (/demo/cases/[id]) and doctor detail (/demo/approvals/[id]):
// UX_UI_PLAN §3.3–3.4.
export default function CaseDetail({
  data,
  selected,
  approvals,
  busy,
  act,
  onReturn,
}: {
  data: Data;
  selected: Case;
  approvals: boolean;
  busy: string;
  act: Act;
  onReturn: () => void;
}) {
  const [mask, setMask] = useState(true),
    // Mobile opens on the pane that holds the next action.
    [tab, setTab] = useState<Tab>(
      approvals
        ? "proposal"
        : selected.status === "draft"
          ? "document"
          : "results",
    ),
    [evidence, setEvidence] = useState("");
  const actions = useRef<HTMLDivElement>(null);
  const role = data.user.role,
    can = (action: string) => canAct(role, action);
  const findings: Finding[] = selected.audit?.findings_json
    ? JSON.parse(selected.audit.findings_json)
    : [];
  // Value at risk if these issues reach the insurer unfixed (§18).
  const risk = caseRisk(findings, selected.scenario),
    riskOf = (f: Finding) => findingRisk(f, selected.scenario, findings.length),
    kept = protectedValue(risk, data.denialRate);
  const history = data.history.filter((h) => h.case_id === selected.id);
  const submitted = history.find((h) => h.action === "ส่งให้แพทย์ตรวจทาน");
  const approved = history.find((h) => h.action === "แพทย์ยืนยันข้อเสนอ");
  const returned = history.find((h) => h.action === "แพทย์ส่งกลับ");
  const stage =
    selected.status === "ready"
      ? 3
      : selected.status === "awaiting_review"
        ? 2
        : selected.status === "draft"
          ? 0
          : 1;
  const original = selected.scenario.sections.at(-1)?.text ?? "";
  const masked = (text: string) =>
    mask ? text.replaceAll(selected.scenario.patient, "[ปิดบังชื่อ]") : text;

  // Keep keyboard focus on the next step after a status change
  // (UX_UI_PLAN §5): the old button is gone once the case re-renders.
  const lastStatus = useRef(selected.status + selected.revision);
  useEffect(() => {
    const now = selected.status + selected.revision;
    if (lastStatus.current === now) return;
    lastStatus.current = now;
    if (document.activeElement && document.activeElement !== document.body)
      return;
    actions.current
      ?.querySelector<HTMLElement>("button:not(:disabled), a")
      ?.focus();
  }, [selected.status, selected.revision]);

  function run(action: string) {
    return act(action, selected).then((ok) => {
      if (!ok) return;
      if (action === "analyze") setTab("results");
      if (action === "proposal") setTab("proposal");
    });
  }
  function showEvidence(text: string) {
    setEvidence(text);
    setTab("document");
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(".highlight-evidence");
      el?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
      });
      el?.focus({ preventScroll: true });
    }, 50);
  }
  const working = (action: string) => busy === action;

  return (
    <>
      <Link
        className="back-link"
        href={approvals ? "/demo/approvals" : "/demo"}
      >
        <ArrowLeft size={16} />
        กลับ{approvals ? "รายการรอแพทย์" : "รายการเคส"}
      </Link>
      <div className="page-heading case-heading">
        <div>
          <p className="eyebrow">
            {approvals ? "DOCTOR REVIEW" : "CASE WORKSPACE"} /{" "}
            {selected.scenario.code}
          </p>
          <h1>{selected.scenario.title}</h1>
          <p>
            {selected.scenario.department} <span className="middot">·</span>{" "}
            {selected.scenario.payer}
          </p>
        </div>
        <Badge status={selected.status} />
      </div>
      <ol className="case-progress" aria-label="ขั้นตอนของเคส">
        {steps.map((x, i) => (
          <li
            key={x}
            className={i <= stage ? "done" : ""}
            aria-current={i === stage ? "step" : undefined}
          >
            <span>{i < stage ? <Check size={13} /> : i + 1}</span>
            {x}
            {i < 3 && <ChevronRight size={15} aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {approvals && selected.status === "awaiting_review" && (
        <section className="change-summary" aria-labelledby="changes-title">
          <h2 id="changes-title">
            <ListChecks size={19} aria-hidden="true" />
            สิ่งที่ขอให้ตรวจทาน
          </h2>
          <ul>
            <li>
              {findings.length
                ? `${findings.length} ประเด็นจากผลตรวจตัวอย่าง (กฎ ${selected.audit?.rule_version})`
                : "ไม่พบประเด็นในผลตรวจตัวอย่าง ขอให้ตรวจทานต้นฉบับ"}
            </li>
            {findings.map((f) => (
              <li key={f.title}>
                {f.title}{" "}
                <span className="risk-chip">เสี่ยง ฿{money(riskOf(f))}</span>
              </li>
            ))}
            {risk > 0 && (
              <li>
                <strong>ยืนยันแล้วจะป้องกันได้ประมาณ ฿{money(kept)}</strong>{" "}
                <span className="muted">
                  (มูลค่าเสี่ยง ฿{money(risk)} × {data.denialRate}%)
                </span>
              </li>
            )}
            <li>
              ข้อเสนอฉบับที่ส่ง: revision {selected.revision}
              {submitted && ` · ส่งเมื่อ ${date(submitted.created_at)}`}
            </li>
          </ul>
          <p className="small muted">
            การยืนยันจะบันทึกข้อเสนอฉบับนี้ หากเคสเปลี่ยนระหว่างนี้
            ระบบจะให้โหลดข้อมูลล่าสุดก่อน
          </p>
        </section>
      )}

      {selected.status === "returned" && returned && (
        <div className="notice returned-notice" role="note">
          <AlertTriangle size={17} aria-hidden="true" />
          <div>
            <strong>แพทย์ส่งกลับแก้ไข</strong>
            <p>{returned.note}</p>
            <p className="small">
              สร้างข้อเสนอใหม่จากผลตรวจ แล้วส่งให้แพทย์อีกครั้ง
            </p>
          </div>
        </div>
      )}
      <div className="mobile-tabs" role="tablist" aria-label="เนื้อหาเคส">
        {tabs.map(([v, l]) => (
          <button
            role="tab"
            id={`tab-${v}`}
            aria-controls={
              v === "document" ? "pane-document" : "pane-inspector"
            }
            aria-selected={tab === v}
            key={v}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className={`audit-workspace tab-${tab}`}>
        <section className="document-pane" id="pane-document">
          <div className="pane-heading">
            <span>
              <FileText size={18} />
              เอกสารต้นฉบับ
            </span>
            <button
              className="text-button"
              aria-pressed={mask}
              onClick={() => setMask(!mask)}
            >
              {mask ? <EyeOff size={16} /> : <Eye size={16} />}
              ปิดบังชื่อในตัวอย่าง
            </button>
          </div>
          <article className="clinical-paper">
            <div className="document-header">
              <span className="document-seal" aria-hidden="true">
                <Plus size={24} />
              </span>
              <div>
                <h2>สรุปการรักษา</h2>
                <p>DISCHARGE SUMMARY · DEMO</p>
              </div>
              <span className="document-code">{selected.scenario.code}</span>
            </div>
            <dl className="patient-meta">
              <div>
                <dt>ผู้ป่วยตัวอย่าง</dt>
                <dd>{mask ? "[ปิดบังชื่อ]" : selected.scenario.patient}</dd>
              </div>
              <div>
                <dt>ประเภทบริการ</dt>
                <dd>{selected.scenario.department}</dd>
              </div>
              <div>
                <dt>รายการวินิจฉัยจำลอง</dt>
                <dd>{selected.scenario.diagnosis}</dd>
              </div>
              <div>
                <dt>ยอดตั้งเบิกตัวอย่าง</dt>
                <dd className="num">฿{money(selected.scenario.amount)}</dd>
              </div>
            </dl>
            {selected.scenario.sections.map((s, i) => {
              const hit = evidence !== "" && s.text.includes(evidence);
              return (
                <section
                  key={i}
                  className={`document-section ${hit ? "highlight-evidence" : ""}`}
                  id={`evidence-${i}`}
                  tabIndex={-1}
                  aria-label={hit ? `หลักฐาน: ${s.title}` : undefined}
                >
                  <h3>
                    <span>0{i + 1}</span>
                    {s.title}
                  </h3>
                  <p>{masked(s.text)}</p>
                  {hit && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setTab("results");
                        setEvidence("");
                      }}
                    >
                      <ArrowLeft size={14} />
                      กลับไปที่ประเด็น
                    </button>
                  )}
                </section>
              );
            })}
            <div className="document-foot">
              <ShieldCheck size={16} />
              เอกสารสร้างขึ้นเพื่อสาธิตเท่านั้น
            </div>
          </article>
        </section>
        <section className="inspector" id="pane-inspector">
          <div className="pane-heading">
            <span>
              <ScanLine size={18} />
              {approvals ? "ตรวจทานข้อเสนอ" : "ผลตรวจตัวอย่าง"}
            </span>
            {selected.audit && (
              <span className="data-demo-label">
                ผลจำลอง · กฎ {selected.audit.rule_version}
              </span>
            )}
          </div>
          <div className="inspector-content">
            <div className="result-section">
              {!selected.audit ? (
                <div className="scan-empty">
                  <span className="scan-icon" aria-hidden="true">
                    <ScanLine size={32} />
                  </span>
                  <h2>เริ่มจากการตรวจแฟ้ม</h2>
                  <p>ดูประเด็นและหลักฐานที่เตรียมไว้สำหรับเคสตัวอย่างนี้</p>
                  {can("analyze") ? (
                    <button
                      className="button primary"
                      disabled={!!busy}
                      onClick={() => run("analyze")}
                    >
                      {working("analyze") ? (
                        <LoaderCircle className="spin" size={17} />
                      ) : (
                        <ScanLine size={17} />
                      )}
                      {working("analyze")
                        ? "กำลังจำลองการตรวจ…"
                        : "เริ่มตรวจสอบ"}
                    </button>
                  ) : (
                    <p className="action-hint">รอเจ้าหน้าที่ตรวจแฟ้ม</p>
                  )}
                  <small>ผลวิเคราะห์จำลอง ไม่ได้เชื่อม AI จริง</small>
                </div>
              ) : (
                <>
                  <div className="result-summary">
                    <span className="eyebrow">REVIEW FINDINGS</span>
                    <h2>
                      {findings.length
                        ? `พบ ${findings.length} ประเด็นที่ควรตรวจทานในข้อมูลตัวอย่าง`
                        : "ไม่พบประเด็นในข้อมูลตัวอย่างนี้"}
                    </h2>
                    <p>พิจารณาหลักฐานก่อนจัดทำข้อเสนอ</p>
                    {risk > 0 && (
                      <p className="risk-total">
                        รวมมูลค่าเสี่ยงถูกปฏิเสธ{" "}
                        <strong className="num">฿{money(risk)}</strong>
                        <span>
                          แก้ก่อนส่งช่วยป้องกันได้ประมาณ ฿{money(kept)}{" "}
                          (สมมติอัตราถูกปฏิเสธ {data.denialRate}%)
                        </span>
                      </p>
                    )}
                    <span className="data-demo-label">
                      ผลวิเคราะห์จำลอง · กฎ {selected.audit?.rule_version}
                    </span>
                  </div>
                  <ol className="findings">
                    {findings.map((f, i) => (
                      <li key={i} className="finding">
                        <div className="finding-title">
                          <span className={`finding-icon ${f.severity}`}>
                            {f.severity === "warning" ? (
                              <AlertTriangle size={17} aria-hidden="true" />
                            ) : (
                              <Info size={17} aria-hidden="true" />
                            )}
                          </span>
                          <h3>
                            <span className="sr-only">
                              {f.severity === "warning"
                                ? "ควรตรวจ:"
                                : "ข้อมูล:"}
                            </span>
                            {f.title}
                          </h3>
                          <span
                            className="risk-chip"
                            title="ยอดที่อาจถูกปฏิเสธถ้าส่งโดยไม่แก้ (สมมติ)"
                          >
                            เสี่ยง ฿{money(riskOf(f))}
                          </span>
                        </div>
                        <p>{f.suggestion}</p>
                        <button
                          className="evidence-link"
                          onClick={() => showEvidence(f.evidence)}
                        >
                          <FileText size={14} />
                          ดูหลักฐาน “{f.evidence}”
                          <ArrowUpRight size={14} />
                        </button>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
            {selected.proposal ? (
              <section className="proposal-section">
                <p className="eyebrow">BEFORE / AFTER</p>
                <h3>ข้อเสนอสำหรับแพทย์</h3>
                <div className="before">
                  <span>ต้นฉบับ · คงเดิม</span>
                  <p>{masked(original)}</p>
                </div>
                <div className="after">
                  <span>
                    <Plus size={14} aria-hidden="true" />
                    ข้อเสนอ · ข้อความที่เสนอเพิ่ม
                  </span>
                  <p>
                    <ins>{selected.proposal}</ins>
                  </p>
                </div>
                <p className="small muted">
                  ต้องให้แพทย์ตรวจยืนยันก่อนใช้ในใบสรุป ต้นฉบับไม่ถูกแก้ไข
                </p>
              </section>
            ) : (
              <div
                className={`proposal-placeholder ${selected.audit ? "" : "no-audit"}`}
              >
                <Info size={22} aria-hidden="true" />
                <h3>ยังไม่มีข้อเสนอ</h3>
                <p>
                  {selected.audit
                    ? "สร้างข้อเสนอแก้ไขจากประเด็นในผลตรวจ แล้วจึงส่งให้แพทย์ตรวจทาน"
                    : "ตรวจแฟ้มก่อน แล้วจึงสร้างข้อเสนอจากประเด็นที่พบ"}
                </p>
                <button
                  className="text-button mobile-only"
                  onClick={() => setTab("results")}
                >
                  ไปที่ผลตรวจ
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            {selected.status === "ready" && (
              <ReadySummary
                selected={selected}
                findings={findings.length}
                risk={risk}
                kept={kept}
                rate={data.denialRate}
                approvedAt={approved?.created_at}
                mask={mask}
                exportLink={canView(role, "claims")}
              />
            )}
            <div
              ref={actions}
              className={`case-actions ${approvals && selected.status === "awaiting_review" ? "sticky-actions" : ""}`}
            >
              {selected.status === "ready" ? (
                can("analyze") && (
                  <button
                    className="button secondary"
                    disabled={!!busy}
                    onClick={() => run("analyze")}
                  >
                    {working("analyze")
                      ? "กำลังจำลองการตรวจ…"
                      : "ตรวจใหม่ด้วยกฎปัจจุบัน"}
                  </button>
                )
              ) : selected.status === "awaiting_review" ? (
                approvals && can("approve") ? (
                  <>
                    <button
                      className="button primary"
                      disabled={!!busy}
                      onClick={() => run("approve")}
                    >
                      {working("approve") ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : (
                        <Check size={18} />
                      )}
                      {working("approve") ? "กำลังบันทึก…" : "ยืนยันข้อเสนอ"}
                    </button>
                    <button
                      className="button secondary"
                      disabled={!!busy}
                      onClick={onReturn}
                    >
                      ส่งกลับพร้อมเหตุผล
                    </button>
                  </>
                ) : (
                  <>
                    <p className="action-hint" role="status">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      ส่งให้แพทย์แล้ว รอการตรวจทาน
                    </p>
                    {!approvals && canView(role, "approvals") && (
                      <Link
                        className="button primary"
                        href={`/demo/approvals/${selected.id}`}
                      >
                        เปิดในมุมมองแพทย์
                        <ArrowRight size={17} />
                      </Link>
                    )}
                  </>
                )
              ) : selected.audit && can("submit") ? (
                <>
                  <button
                    className="button primary"
                    disabled={!!busy}
                    aria-describedby={
                      selected.proposal ? undefined : "proposal-hint"
                    }
                    onClick={() =>
                      run(selected.proposal ? "submit" : "proposal")
                    }
                  >
                    {busy === "submit" || busy === "proposal" ? (
                      <LoaderCircle size={17} className="spin" />
                    ) : selected.proposal ? (
                      <Send size={17} />
                    ) : (
                      <Plus size={17} />
                    )}
                    {busy === "submit" || busy === "proposal"
                      ? "กำลังบันทึก…"
                      : selected.proposal
                        ? "ส่งให้แพทย์ตรวจทาน"
                        : "สร้างข้อเสนอแก้ไข"}
                  </button>
                  {!selected.proposal && (
                    <p className="action-hint" id="proposal-hint">
                      สร้างข้อเสนอก่อนส่งให้แพทย์
                    </p>
                  )}
                  <button
                    className="text-button"
                    disabled={!!busy}
                    onClick={() => run("analyze")}
                  >
                    {working("analyze") ? "กำลังจำลองการตรวจ…" : "ตรวจใหม่"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </div>
      <section className="history-section" aria-labelledby="history-title">
        <h2 id="history-title">
          <Clock3 size={19} aria-hidden="true" />
          ประวัติการดำเนินการ
        </h2>
        {history.length ? (
          <ol className="history-list">
            {history.map((h, i) => (
              <li className="history-row" key={i}>
                <span className="history-dot" aria-hidden="true" />
                <div>
                  <strong>{h.action}</strong>
                  <p className="history-meta">
                    {h.actor_name ? `${h.actor_name} · ` : ""}
                    {roleLabels[h.simulated_role ?? "system"]}
                    {h.revision ? ` · revision ${h.revision}` : ""}
                  </p>
                  {h.note && <p>{h.note}</p>}
                </div>
                <time dateTime={h.created_at}>{date(h.created_at)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">ยังไม่มีการดำเนินการในเคสนี้</p>
        )}
      </section>
    </>
  );
}

// "Ready" preview: PROJECT_PLAN §4 step 8 — a summary on screen only,
// nothing is sent to an insurer and nothing looks like a receipt.
function ReadySummary({
  selected,
  findings,
  risk,
  kept,
  rate,
  approvedAt,
  mask,
  exportLink,
}: {
  selected: Case;
  findings: number;
  risk: number;
  kept: number;
  rate: number;
  approvedAt?: string;
  mask: boolean;
  exportLink: boolean;
}) {
  return (
    <section className="ready-summary" aria-labelledby="ready-title">
      <div className="ready-note">
        <CheckCircle2 size={23} aria-hidden="true" />
        <div>
          <strong id="ready-title">พร้อมส่งเคลมในระบบสาธิต</strong>
          <p>
            ตัวอย่างสรุปบนจอเท่านั้น
            ไม่มีการส่งไปบริษัทประกันหรือรับชำระเงินจริง
          </p>
        </div>
      </div>
      <dl>
        <div>
          <dt>รหัสเคส</dt>
          <dd>{selected.scenario.code}</dd>
        </div>
        <div>
          <dt>ผู้ป่วยตัวอย่าง</dt>
          <dd>{mask ? "[ปิดบังชื่อ]" : selected.scenario.patient}</dd>
        </div>
        <div>
          <dt>รายการวินิจฉัยจำลอง</dt>
          <dd>{selected.scenario.diagnosis}</dd>
        </div>
        <div>
          <dt>ยอดตั้งเบิกตัวอย่าง</dt>
          <dd className="num">฿{money(selected.scenario.amount)}</dd>
        </div>
        <div>
          <dt>ประเด็นที่ตรวจทานแล้ว</dt>
          <dd>
            {findings} ประเด็น · กฎ {selected.audit?.rule_version ?? "—"}
          </dd>
        </div>
        <div className="ready-value">
          <dt>มูลค่าที่ป้องกันได้</dt>
          <dd>
            {risk > 0 ? (
              <>
                <strong className="num">฿{money(kept)}</strong>
                <small>
                  แก้มูลค่าเสี่ยง ฿{money(risk)} ก่อนส่ง × {rate}%
                </small>
              </>
            ) : (
              "ไม่มีประเด็นต้องแก้ก่อนส่ง"
            )}
          </dd>
        </div>
        <div>
          <dt>แพทย์ยืนยัน</dt>
          <dd>{approvedAt ? date(approvedAt) : "ข้อมูลตั้งต้น"}</dd>
        </div>
      </dl>
      {exportLink && (
        <Link className="button secondary" href="/demo/claims">
          ส่งออกเอกสารสำหรับส่งประกัน
          <ArrowRight size={16} />
        </Link>
      )}
    </section>
  );
}
