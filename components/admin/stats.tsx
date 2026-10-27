"use client";
import { useEffect, useState } from "react";
import { BarChart3, Clock, FileDown, Undo2, Users } from "lucide-react";
import type { WorkStats } from "@/lib/stats";
import { statColumns } from "@/lib/stat-columns";
import { date } from "@/components/ui/format";
import { roleLabels, type Role } from "@/components/claims/types";

// e.g. "45 วินาที", "12 นาที", "3.5 ชั่วโมง", "2.1 วัน"
function duration(ms: number | null) {
  if (ms === null) return "—";
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)} วินาที`;
  if (s < 3600) return `${Math.round(s / 60)} นาที`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} ชั่วโมง`;
  return `${(s / 86400).toFixed(1)} วัน`;
}

// Work statistics (/demo/stats), Admin only: PROJECT_PLAN.md §16.
export default function WorkStatsPage({ refresh }: { refresh: string }) {
  const [stats, setStats] = useState<WorkStats | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch("/api/stats", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "โหลดสถิติไม่สำเร็จ");
        if (live) setStats(d.stats);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [refresh]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORK STATISTICS · ADMIN</p>
          <h1>สถิติการทำงาน</h1>
          <p>
            คำนวณจากประวัติทุกการกระทำในระบบ ไม่รวมข้อมูลตั้งต้น
            {stats?.since ? ` · ตั้งแต่ ${date(stats.since)}` : ""}
          </p>
        </div>
        <span className="workspace-tag">
          <BarChart3 size={15} aria-hidden="true" />
          เห็นเฉพาะ Admin
        </span>
      </div>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : !stats ? (
        <div className="skeleton" role="status" aria-label="กำลังโหลด">
          <div />
          <div />
        </div>
      ) : (
        <>
          <div className="metrics">
            <div>
              <span>
                <Clock size={14} aria-hidden="true" /> ส่งแพทย์ → ยืนยัน
                (เฉลี่ย)
              </span>
              <strong>{duration(stats.approval.avgMs)}</strong>
              <small className="muted">
                {stats.approval.count
                  ? `มัธยฐาน ${duration(stats.approval.medianMs)} · นานสุด ${duration(stats.approval.maxMs)} · ${stats.approval.count} ครั้ง`
                  : "ยังไม่มีเคสที่แพทย์ยืนยันหลังส่ง"}
              </small>
            </div>
            <div>
              <span>
                <Undo2 size={14} aria-hidden="true" /> อัตราการส่งกลับ
              </span>
              <strong>
                {stats.returnRate === null
                  ? "—"
                  : `${Math.round(stats.returnRate * 100)}%`}
              </strong>
              <small className="muted">
                ส่งกลับ {stats.returns} · ยืนยัน {stats.approvals} ครั้ง
              </small>
            </div>
            <div>
              <span>
                <FileDown size={14} aria-hidden="true" /> การส่งออกไฟล์
              </span>
              <strong>
                {stats.exports.length}
                <small>ครั้ง</small>
              </strong>
              <small className="muted">
                ทุกการกระทำ {stats.actions} รายการ
              </small>
            </div>
          </div>

          <section className="stats-block" aria-labelledby="reasons-title">
            <h2 id="reasons-title" className="section-title">
              เหตุผลที่ส่งกลับบ่อย
            </h2>
            {stats.reasons.length ? (
              <ol className="reason-list">
                {stats.reasons.map((r) => (
                  <li key={r.text}>
                    <span>{r.text}</span>
                    <strong>{r.count} ครั้ง</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">ยังไม่มีการส่งกลับ</p>
            )}
          </section>

          <section className="stats-block" aria-labelledby="people-title">
            <h2 id="people-title" className="section-title">
              <Users size={18} aria-hidden="true" /> งานของแต่ละคน
            </h2>
            {stats.people.length ? (
              <div className="table-scroll">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th scope="col">ผู้ใช้</th>
                      {statColumns.map(([, label]) => (
                        <th scope="col" className="num" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.people.map((p) => (
                      <tr key={p.name + p.role}>
                        <th scope="row">
                          {p.name}
                          <small>{roleLabels[p.role as Role] ?? p.role}</small>
                        </th>
                        {statColumns.map(([action, label]) => (
                          <td className="num" key={label}>
                            {p.counts[action] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">ยังไม่มีการทำงานในเคส</p>
            )}
          </section>

          <section className="stats-block" aria-labelledby="exports-title">
            <h2 id="exports-title" className="section-title">
              ประวัติการส่งออกไฟล์
            </h2>
            {stats.exports.length ? (
              <div className="table-scroll">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th scope="col">เวลา</th>
                      <th scope="col">ผู้ส่งออก</th>
                      <th scope="col">เคส</th>
                      <th scope="col">รูปแบบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.exports.map((e, i) => (
                      <tr key={i}>
                        <td>
                          <time dateTime={e.at}>{date(e.at)}</time>
                        </td>
                        <td>
                          {e.by}
                          <small>{roleLabels[e.role as Role] ?? e.role}</small>
                        </td>
                        <td>{e.code}</td>
                        <td>{e.format}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">ยังไม่มีการส่งออกไฟล์</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
