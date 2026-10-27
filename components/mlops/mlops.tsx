"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  GitBranch,
  LoaderCircle,
  ScanSearch,
} from "lucide-react";
import {
  driftReport,
  driftStatusLabels,
  driftWindows,
  reference,
  type DriftStatus,
} from "@/lib/drift";
import { findingsFor, scenarios } from "@/lib/scenarios";
import { canAct, canView } from "@/lib/permissions";
import DataTable from "@/components/ui/data-table";
import { date } from "@/components/ui/format";
import { roleLabels, type Act, type Data } from "@/components/claims/types";

const months = ["พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค."];
const scores = [88, 90, 89, 92, 93, 94];

// Model status (/demo/mlops): UX_UI_PLAN §3.6.
export default function Mlops({
  data,
  busy,
  act,
}: {
  data: Data;
  busy: string;
  act: Act;
}) {
  const next = data.ruleVersion === "1.0" ? "2.0" : "1.0";
  // Preview the effect of switching on every scenario before applying.
  const impact = scenarios.map((s, i) => {
    const c = data.cases.find((x) => x.scenario_key === i);
    return {
      code: s.code,
      id: c?.id,
      now: findingsFor(s, data.ruleVersion).length,
      after: findingsFor(s, next).length,
      latest: c?.audit?.rule_version,
    };
  });
  const changed = impact.filter((x) => x.now !== x.after);
  const ruleHistory = data.history.filter(
    (h) =>
      !h.case_id && ["เปลี่ยนกฎจำลอง", "ตรวจ Data Drift"].includes(h.action),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MODEL OPERATIONS</p>
          <h1>สถานะโมเดล</h1>
          <p>ทดลองติดตามและเปลี่ยนเวอร์ชันกฎในพื้นที่ทดลองร่วม</p>
        </div>
        <span className="data-demo-label">ข้อมูลการติดตามจำลอง</span>
      </div>
      <div className="metrics">
        <div>
          <span>โมเดลตัวอย่าง</span>
          <strong>
            Claim Di Core<small>DEMO</small>
          </strong>
        </div>
        <div>
          <span>กฎที่ใช้งาน</span>
          <strong>v{data.ruleVersion}</strong>
        </div>
        <div>
          <span>ชุดข้อมูล</span>
          <strong>
            6 <small>สถานการณ์</small>
          </strong>
        </div>
      </div>
      <div className="operations-grid">
        <section className="chart-section" aria-labelledby="trend-title">
          <p className="eyebrow">SIMULATED MONITORING</p>
          <h2 id="trend-title">ผลประเมินตัวอย่างรายเดือน (%)</h2>
          <p className="muted small">
            พ.ค.–ต.ค. 2569 · ค่าคงที่เพื่อสาธิต ไม่ใช่ผลวัดความแม่นยำจริง
          </p>
          <Trend />
          <DataTable
            caption="ผลประเมินตัวอย่างรายเดือน (%)"
            headers={["เดือน", "ผลประเมินจำลอง (%)"]}
            rows={scores.map((n, i) => [months[i], `${n}%`])}
          />
        </section>
        <section className="rule-panel" aria-labelledby="rule-title">
          <GitBranch size={25} aria-hidden="true" />
          <h2 id="rule-title">
            {next === "2.0"
              ? "กฎเอกสารอ้างอิง v2.0"
              : `กำลังใช้กฎ v2.0 · ย้อนกลับเป็น v1.0 ได้`}
          </h2>
          <p>
            v2.0 เพิ่มประเด็นตรวจวันที่ของผลตรวจที่อ้างถึงใน DEMO-001
            เพื่อสาธิตการเปลี่ยนกฎ
          </p>
          <h3 className="impact-title">ผลต่อสถานการณ์ถ้าเปลี่ยนเป็น v{next}</h3>
          <table className="impact-table">
            <thead>
              <tr>
                <th scope="col">เคส</th>
                <th scope="col" className="num">
                  v{data.ruleVersion}
                </th>
                <th scope="col" className="num">
                  v{next}
                </th>
                <th scope="col">ผลตรวจล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {impact.map((x) => (
                <tr key={x.code} className={x.now !== x.after ? "changed" : ""}>
                  <th scope="row">{x.code}</th>
                  <td className="num">{x.now} ประเด็น</td>
                  <td className="num">
                    {x.after} ประเด็น
                    {x.now !== x.after && (
                      <span className="sr-only"> (เปลี่ยน)</span>
                    )}
                  </td>
                  <td>{x.latest ? `กฎ ${x.latest}` : "ยังไม่ตรวจ"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul>
            <li>
              เปลี่ยนผล {changed.length} จาก {impact.length} เคส เมื่อกดตรวจใหม่
            </li>
            <li>ผลตรวจเดิมยังอ้างเวอร์ชันเดิม ไม่ถูกเปลี่ยนเงียบ ๆ</li>
            <li>มีผลกับข้อมูลร่วมที่ทุกบัญชีเห็น และย้อนกลับได้</li>
          </ul>
          <button
            className="button primary"
            disabled={!!busy}
            onClick={() => act("rule", undefined, { version: next })}
          >
            {busy === "rule" && <LoaderCircle className="spin" size={17} />}
            {busy === "rule"
              ? "กำลังบันทึก…"
              : next === "2.0"
                ? "ใช้กฎจำลอง v2.0"
                : "ย้อนกลับเป็น v1.0"}
            <ArrowRight size={17} />
          </button>
          {changed[0]?.id && canView(data.user.role, "case-detail") && (
            <Link className="text-button" href={`/demo/cases/${changed[0].id}`}>
              เปิด {changed[0].code} เพื่อตรวจใหม่และดูความต่าง
              <ArrowUpRight size={15} />
            </Link>
          )}
        </section>
      </div>
      <Drift data={data} busy={busy} act={act} />
      <section className="history-section" aria-labelledby="version-title">
        <h2 id="version-title">ประวัติเวอร์ชันและการตรวจ</h2>
        {ruleHistory.length ? (
          <ol className="history-list">
            {ruleHistory.map((h, i) => (
              <li className="history-row" key={i}>
                <GitBranch size={17} aria-hidden="true" />
                <div>
                  <strong>{h.action}</strong>
                  <p className="history-meta">
                    {h.actor_name ? `${h.actor_name} · ` : ""}
                    {roleLabels[h.simulated_role ?? "system"]}
                  </p>
                  <p>{h.note}</p>
                </div>
                <time dateTime={h.created_at}>{date(h.created_at)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">ยังไม่มีการเปลี่ยนเวอร์ชัน · ใช้ v1.0 ตั้งต้น</p>
        )}
      </section>
    </>
  );
}

function Trend() {
  const pts = scores.map(
    (n, i) => [20 + i * 112, 180 - (n - 80) * 10.5] as const,
  );
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  return (
    <div className="trend">
      <svg viewBox="0 0 600 190" aria-hidden="true">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--accent)" stopOpacity=".14" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 90, 140].map((y) => (
          <line
            key={y}
            x1="20"
            x2="580"
            y1={y}
            y2={y}
            stroke="var(--border)"
            strokeDasharray="4 4"
          />
        ))}
        <path d={`${line} L580 180 L20 180Z`} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="3" />
        {pts.map(([x, y], i) => (
          <g key={x}>
            <circle
              cx={x}
              cy={y}
              r="5"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="3"
            />
            <text
              x={x}
              y={y - 12}
              textAnchor={
                i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"
              }
              fontSize="13"
              fill="var(--text-secondary)"
            >
              {scores[i]}%
            </text>
          </g>
        ))}
      </svg>
      <div className="chart-labels" aria-hidden="true">
        {months.map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
    </div>
  );
}

const statusIcon: Record<DriftStatus, typeof Eye> = {
  stable: CheckCircle2,
  watch: Eye,
  drift: AlertTriangle,
};
const pct = (n: number) => `${Math.round(n * 100)}%`;

// Data drift check (PROJECT_PLAN.md §16): compares a month's simulated input
// mix with the reference window by PSI and logs each check in history.
function Drift({ data, busy, act }: { data: Data; busy: string; act: Act }) {
  const last = data.history.find((h) => h.action === "ตรวจ Data Drift");
  const lastKey = driftWindows.find((w) => last?.note.startsWith(w.label))?.key;
  const [pick, setPick] = useState(lastKey ?? driftWindows.at(-1)!.key),
    [shown, setShown] = useState(lastKey ?? "");
  const report = shown ? driftReport(shown) : null;
  const can = canAct(data.user.role, "drift");
  const button = useRef<HTMLButtonElement>(null);
  async function run() {
    if (await act("drift", undefined, { window: pick })) setShown(pick);
    // The button is disabled while saving; give focus back afterwards.
    setTimeout(() => button.current?.focus());
  }
  return (
    <section className="drift-section" aria-labelledby="drift-title">
      <div className="drift-head">
        <div>
          <p className="eyebrow">DATA DRIFT</p>
          <h2 id="drift-title">ตรวจ Data Drift ของข้อมูลนำเข้า</h2>
          <p className="muted small">
            เทียบสัดส่วนข้อมูลเดือนที่เลือกกับช่วงอ้างอิง {reference.label} (
            {reference.cases.toLocaleString("th-TH")} เคส) ด้วย PSI ·
            ข้อมูลจำลองคงที่
          </p>
        </div>
        <span className="data-demo-label">ข้อมูลจำลอง</span>
      </div>
      <div className="drift-controls">
        <label>
          <span>ช่วงข้อมูลที่ตรวจ</span>
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            {driftWindows.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label} · {w.cases.toLocaleString("th-TH")} เคส
              </option>
            ))}
          </select>
        </label>
        {can && (
          <button
            ref={button}
            className="button primary"
            disabled={!!busy}
            onClick={run}
          >
            {busy === "drift" ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ScanSearch size={17} aria-hidden="true" />
            )}
            {busy === "drift" ? "กำลังตรวจ…" : "ตรวจ Data Drift"}
          </button>
        )}
        <p className="small muted">
          PSI ต่ำกว่า 0.10 คงที่ · 0.10–0.25 เฝ้าระวัง · ตั้งแต่ 0.25
          เปลี่ยนแปลงมาก
        </p>
      </div>
      {!report ? (
        <p className="notice">
          ยังไม่มีผลตรวจ เลือกช่วงข้อมูลแล้วกด “ตรวจ Data Drift”
        </p>
      ) : (
        <div aria-live="polite">
          <div className={`drift-summary ${report.status}`}>
            {(() => {
              const Icon = statusIcon[report.status];
              return <Icon size={20} aria-hidden="true" />;
            })()}
            <div>
              <strong>
                {report.window.label}: {driftStatusLabels[report.status]}
              </strong>
              <p>
                {report.status === "stable"
                  ? "ข้อมูลนำเข้ายังใกล้เคียงช่วงอ้างอิง ใช้กฎปัจจุบันต่อได้"
                  : `${report.worst.label} เปลี่ยนมากที่สุด (PSI ${report.worst.psi.toFixed(2)}) · ${report.worst.advice}`}
              </p>
              {last && (
                <p className="small">
                  ตรวจล่าสุดโดย {last.actor_name || "ไม่ระบุชื่อ"} ·{" "}
                  {date(last.created_at)}
                </p>
              )}
            </div>
          </div>
          <table className="drift-table">
            <caption className="sr-only">
              ผล Data Drift รายตัวแปร {report.window.label}
            </caption>
            <thead>
              <tr>
                <th scope="col">ตัวแปร</th>
                <th scope="col">สัดส่วน อ้างอิง → เดือนนี้</th>
                <th scope="col" className="num">
                  PSI
                </th>
                <th scope="col">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => {
                const Icon = statusIcon[r.status];
                return (
                  <tr key={r.key}>
                    <th scope="row">{r.label}</th>
                    <td>
                      <ul className="drift-bins">
                        {r.bins.map((b, i) => (
                          <li key={b}>
                            <span>{b}</span>
                            <span className="drift-bar" aria-hidden="true">
                              <i style={{ width: pct(r.reference[i]) }} />
                              <b style={{ width: pct(r.current[i]) }} />
                            </span>
                            <span className="num">
                              {pct(r.reference[i])} → {pct(r.current[i])}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="num">{r.psi.toFixed(2)}</td>
                    <td>
                      <span className={`drift-status ${r.status}`}>
                        <Icon size={15} aria-hidden="true" />
                        {driftStatusLabels[r.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="small muted drift-legend">
            <span className="legend-ref" aria-hidden="true" /> ช่วงอ้างอิง
            <span className="legend-cur" aria-hidden="true" /> เดือนที่ตรวจ
          </p>
        </div>
      )}
    </section>
  );
}
