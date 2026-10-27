"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Info,
  ScanLine,
  Search,
  ShieldCheck,
} from "lucide-react";
import { statuses } from "@/lib/scenarios";
import Badge from "@/components/ui/badge";
import { date, money } from "@/components/ui/format";
import { caseLink, canView } from "@/lib/permissions";
import CaseValues from "./case-values";
import ProtectedBanner from "./protected-banner";
import type { Data } from "./types";

// Case list (/demo) and doctor queue (/demo/approvals): UX_UI_PLAN §3.2, §3.4.
export default function CaseList({
  data,
  approvals,
}: {
  data: Data;
  approvals: boolean;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const waiting = data.cases.filter(
      (c) => c.status === "awaiting_review",
    ).length,
    ready = data.cases.filter((c) => c.status === "ready").length;
  const scope = approvals
    ? data.cases.filter((c) => c.status === "awaiting_review")
    : data.cases;
  const shown = scope.filter(
    (c) =>
      (approvals || filter === "all" || filter === c.status) &&
      `${c.scenario.code} ${c.scenario.title}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const filtered = search.trim() !== "" || filter !== "all";
  // Every role sees the list and statuses; a case opens only for the role
  // that works on it (PROJECT_PLAN.md §14).
  const role = data.user.role;
  const href = (c: Data["cases"][number]) => {
    const to = approvals ? "approvals" : caseLink(role, c.status);
    return to ? `/demo/${to}/${c.id}` : null;
  };
  const anyLink = shown.some((c) => href(c));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {approvals ? "DOCTOR REVIEW" : "PRE-CLAIM AUDIT"}
          </p>
          <h1>{approvals ? "งานรอแพทย์ตรวจทาน" : "รายการเคส"}</h1>
          <p>
            {approvals
              ? "พิจารณาสิ่งที่เปลี่ยน ต้นฉบับ และข้อเสนอก่อนยืนยัน"
              : canView(data.user.role, "case-detail")
                ? "เลือกเคสตัวอย่าง แล้วตรวจหลักฐานก่อนส่งให้แพทย์"
                : "สถานะของทุกเคสในระบบ อัปเดตตามงานของแต่ละบทบาท"}
          </p>
        </div>
        <span className="workspace-tag">
          <span className="live-dot" />
          ข้อมูลร่วมทุกบัญชี
        </span>
      </div>
      <ProtectedBanner data={data} />
      <div className="metrics">
        <div>
          <span>เคสในชุดทดลอง</span>
          <strong>
            {String(data.cases.length).padStart(2, "0")}
            <small>เคส</small>
          </strong>
        </div>
        <div>
          <span>รอแพทย์ตรวจทาน</span>
          <strong>
            {String(waiting).padStart(2, "0")}
            <small>เคส</small>
          </strong>
        </div>
        <div>
          <span>พร้อมส่งเคลม</span>
          <strong>
            {String(ready).padStart(2, "0")}
            <small>เคสจำลอง</small>
          </strong>
        </div>
        <div className="metrics-note">
          <ShieldCheck size={24} />
          <p>
            ทุกข้อเสนอมีหลักฐาน
            <br />
            ทุกการยืนยันมีประวัติ
          </p>
        </div>
      </div>
      {!approvals && <CaseValues data={data} compact />}
      {!approvals && canView(role, "case-detail") && (
        <div className="suggested">
          <span className="suggested-icon">
            <ScanLine size={23} />
          </span>
          <div>
            <strong>ครั้งแรกใช่ไหม? เริ่มจากเคสปอดอักเสบ</strong>
            <p>ทดลองตรวจแฟ้ม ดูข้อเสนอ และส่งให้แพทย์ในเคสเดียว</p>
          </div>
          <Link
            href={`/demo/cases/${data.cases[0].id}`}
            className="text-button"
          >
            เปิดเคสแนะนำ
            <ArrowRight size={17} />
          </Link>
        </div>
      )}
      <div className="list-toolbar">
        <h2 id="case-list-title">
          {approvals ? "รายการรอตรวจทาน" : "รายการเคส"}{" "}
          <span aria-live="polite">
            {filtered ? `${shown.length} จาก ${scope.length}` : scope.length}
          </span>
        </h2>
        {scope.length > 0 && (
          <div className="filters">
            <label className="search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">ค้นหาเคส</span>
              <input
                type="search"
                placeholder="รหัสหรือสถานการณ์"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {!approvals && (
              <label className="filter-select">
                <span className="sr-only">กรองสถานะ</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">ทุกสถานะ</option>
                  {Object.entries(statuses).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {filtered && (
              <button
                className="text-button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        )}
      </div>
      {shown.length > 0 && (
        <>
          <table className="cases-table" aria-labelledby="case-list-title">
            <thead>
              <tr>
                <th scope="col">เคส / สถานการณ์</th>
                <th scope="col">ผู้รับประกันตัวอย่าง</th>
                <th scope="col" className="num">
                  ยอดตั้งเบิก
                </th>
                <th scope="col">สถานะ</th>
                <th scope="col">อัปเดตล่าสุด</th>
                {anyLink && (
                  <th scope="col">
                    <span className="sr-only">เปิดเคส</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="case-cell">
                      <span className="file-icon" aria-hidden="true">
                        <FileText size={20} />
                      </span>
                      <div>
                        <span className="case-code">{c.scenario.code}</span>
                        {href(c) ? (
                          <Link className="case-link" href={href(c)!}>
                            {c.scenario.title}
                          </Link>
                        ) : (
                          <strong className="case-link">
                            {c.scenario.title}
                          </strong>
                        )}
                        <small>{c.scenario.department}</small>
                      </div>
                    </div>
                  </td>
                  <td className="payer-cell">{c.scenario.payer}</td>
                  <td className="amount-cell num">
                    ฿{money(c.scenario.amount)}
                  </td>
                  <td>
                    <Badge status={c.status} />
                  </td>
                  <td className="updated-cell">
                    <time dateTime={c.updated_at}>{date(c.updated_at)}</time>
                  </td>
                  {anyLink && (
                    <td className="open-cell">
                      {href(c) && (
                        <Link
                          href={href(c)!}
                          className="text-button"
                          aria-label={`เปิด ${c.scenario.code}`}
                        >
                          เปิด
                          <ChevronRight size={16} />
                        </Link>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="case-list-mobile" aria-label="รายการเคส">
            {shown.map((c) => (
              <li key={c.id}>
                <div>
                  <span className="case-code">{c.scenario.code}</span>
                  <strong>{c.scenario.title}</strong>
                  <Badge status={c.status} />
                </div>
                {href(c) && (
                  <Link
                    href={href(c)!}
                    className="button secondary"
                    aria-label={`เปิด ${c.scenario.code}`}
                  >
                    เปิด
                    <ChevronRight size={16} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {shown.length === 0 && (
        <div className="empty">
          <ClipboardCheck size={34} aria-hidden="true" />
          {approvals && scope.length === 0 ? (
            <>
              <h2>ยังไม่มีงานรอแพทย์</h2>
              <p>
                เมื่อเจ้าหน้าที่ตรวจแฟ้มและส่งข้อเสนอให้แพทย์ เคสจะแสดงที่นี่
              </p>
              <Link href="/demo" className="button secondary">
                ไปที่รายการเคส
                <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <h2>ไม่พบเคสตามตัวกรองที่เลือก</h2>
              <button
                className="button secondary"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                ล้างตัวกรอง
              </button>
            </>
          )}
        </div>
      )}
      <div className="list-foot">
        <span>
          <Info size={14} aria-hidden="true" />
          ข้อมูลตัวอย่างทั้งหมด ไม่มีข้อมูลผู้ป่วยจริง
        </span>
        {!anyLink && (
          <span>
            บัญชีนี้ดูรายการและสถานะได้ การเปิดเคสเป็นงานของเจ้าหน้าที่
          </span>
        )}
      </div>
    </>
  );
}
