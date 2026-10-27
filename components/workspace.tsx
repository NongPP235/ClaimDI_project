"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  ChartNoAxesCombined,
  Activity,
  ArrowUpRight,
  ChevronRight,
  RotateCcw,
  Menu,
  X,
  FileText,
  Info,
  AlertTriangle,
  CheckCircle2,
  Users as UsersIcon,
  LogOut,
  Lock,
  Send,
  BarChart3,
  BadgeCheck,
  DatabaseZap,
} from "lucide-react";
import {
  canAct,
  canView,
  homeFor,
  roleNames,
  roleShort,
  type View,
} from "@/lib/permissions";
import UsersAdmin from "./admin/users";
import WorkStatsPage from "./admin/stats";
import CaseList from "./claims/case-list";
import CaseDetail from "./claims/case-detail";
import ClaimsOut from "./claims/claims-out";
import HisImport from "./claims/his-import";
import Finance from "./finance/finance";
import Mlops from "./mlops/mlops";
import type { Act, Data } from "./claims/types";

const nav: {
  href: string;
  label: string;
  icon: typeof Activity;
  view: View;
}[] = [
  { href: "/demo", label: "รายการเคส", icon: LayoutDashboard, view: "cases" },
  {
    href: "/demo/approvals",
    label: "งานรอแพทย์",
    icon: ClipboardCheck,
    view: "approvals",
  },
  {
    href: "/demo/claims",
    label: "พร้อมส่งประกัน",
    icon: Send,
    view: "claims",
  },
  {
    href: "/demo/import",
    label: "นำเข้าจาก HIS",
    icon: DatabaseZap,
    view: "import",
  },
  {
    href: "/demo/finance",
    label: "ภาพรวมการเงิน",
    icon: ChartNoAxesCombined,
    view: "finance",
  },
  { href: "/demo/mlops", label: "สถานะโมเดล", icon: Activity, view: "mlops" },
  {
    href: "/demo/stats",
    label: "สถิติการทำงาน",
    icon: BarChart3,
    view: "stats",
  },
  { href: "/demo/users", label: "ผู้ใช้งาน", icon: UsersIcon, view: "users" },
];
const toasts: Record<string, string> = {
  reset: "รีเซ็ตแล้ว ชุดตัวอย่างเริ่มต้นพร้อมใช้งาน",
  analyze: "ตรวจตัวอย่างแล้ว",
  proposal: "สร้างข้อเสนอแก้ไขแล้ว",
  submit: "ส่งให้แพทย์ตรวจทานแล้ว",
  approve: "บันทึกแล้ว เคสนี้พร้อมส่งเคลมในระบบสาธิต",
  return: "ส่งกลับพร้อมเหตุผลแล้ว",
  rule: "เปลี่ยนเวอร์ชันกฎแล้ว",
  export: "ส่งออกแล้ว บันทึกในประวัติเคส",
  drift: "ตรวจ Data Drift แล้ว บันทึกในประวัติ",
  package: "เปลี่ยนแพ็กเกจแล้ว",
  denial_rate: "บันทึกอัตราการถูกปฏิเสธที่สมมติแล้ว",
};

export default function Workspace() {
  const path = usePathname(),
    router = useRouter();
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [expired, setExpired] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [toast, setToast] = useState("");
  const [modal, setModal] = useState<"reset" | "return" | null>(null),
    [note, setNote] = useState(""),
    [noteError, setNoteError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    drawer = useRef<HTMLDialogElement>(null),
    noteField = useRef<HTMLTextAreaElement>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/demo", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 401) {
          toLogin();
          return;
        }
        throw Error(d.error);
      }
      setData(d);
      setExpired("");
      setError("");
    } catch (e) {
      setError((e as Error).message || "โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }
  function toLogin() {
    setExpired("1");
    router.replace(`/login?next=${encodeURIComponent(location.pathname)}`);
  }
  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    router.replace("/login");
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    setError("");
    drawer.current?.close();
  }, [path]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);

  const parts = path.split("/");
  const isApproval = parts[2] === "approvals",
    isFinance = path === "/demo/finance",
    isMlops = path === "/demo/mlops",
    isUsers = path === "/demo/users",
    isClaims = path === "/demo/claims",
    isStats = path === "/demo/stats",
    isImport = path === "/demo/import";
  const id = parts[2] === "cases" || isApproval ? parts[3] : undefined;
  const user = data?.user;
  const view: View = isFinance
    ? "finance"
    : isMlops
      ? "mlops"
      : isUsers
        ? "users"
        : isClaims
          ? "claims"
          : isStats
            ? "stats"
            : isImport
              ? "import"
              : isApproval
                ? "approvals"
                : id
                  ? "case-detail"
                  : "cases";
  const allowed = !user || canView(user.role, view);
  const selected = id ? data?.cases.find((c) => c.id === id) : undefined;

  // Values typed into dialogs stay put on failure (UX_UI_PLAN §4).
  const act: Act = async (action, c, extra = {}) => {
    setBusy(action);
    setError("");
    try {
      const r = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: c?.id,
          revision: c?.revision,
          ...extra,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 401) toLogin();
        throw Error(d.error || "ระบบบันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
      setData(d);
      setToast(toasts[action] ?? "บันทึกแล้ว");
      setModal(null);
      setNote("");
      if (action === "reset") router.push("/demo");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy("");
    }
  };
  function submitReturn() {
    const value = note.trim();
    if (!value) {
      setNoteError("ระบุเหตุผลที่ต้องแก้ไขก่อนส่งกลับ");
      noteField.current?.focus();
      return;
    }
    setNoteError("");
    act("return", selected, { note: value });
  }

  const waiting =
    data?.cases.filter((c) => c.status === "awaiting_review").length || 0;
  const readyCount =
    data?.cases.filter((c) => c.status === "ready").length || 0;
  const title = isFinance
    ? "ภาพรวมการเงิน"
    : isMlops
      ? "สถานะโมเดล"
      : isUsers
        ? "ผู้ใช้งาน"
        : isClaims
          ? "พร้อมส่งประกัน"
          : isStats
            ? "สถิติการทำงาน"
            : isImport
              ? "นำเข้าจาก HIS"
              : isApproval
                ? "งานรอแพทย์"
                : "รายการเคส";
  const navigation = (
    <>
      <Link className="brand" href="/">
        <img className="brand-logo" src="/claimdi-logo.png" alt="Claim Di" />
      </Link>
      {data && (
        <p className="package-chip">
          <BadgeCheck size={15} aria-hidden="true" />
          <span>
            โรงพยาบาลตัวอย่าง · แพ็กเกจ <strong>{data.package}</strong>
          </span>
        </p>
      )}
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="เมนูหลัก">
        {nav
          .filter((n) => user && canView(user.role, n.view))
          .map((n) => {
            const active =
              n.href === "/demo"
                ? path === "/demo" || parts[2] === "cases"
                : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                href={n.href}
              >
                <n.icon size={19} aria-hidden="true" />
                {n.label}
                {n.href === "/demo/approvals" && waiting > 0 && (
                  <span className="nav-count">
                    {waiting}
                    <span className="sr-only"> เคสรอตรวจทาน</span>
                  </span>
                )}
                {n.view === "claims" && readyCount > 0 && (
                  <span className="nav-count">
                    {readyCount}
                    <span className="sr-only"> เคสพร้อมส่ง</span>
                  </span>
                )}
              </Link>
            );
          })}
      </nav>
      <div className="sidebar-bottom">
        <div className="demo-indicator">
          <span className="live-dot" /> DEMO ENVIRONMENT
        </div>
        <p>
          {user ? roleNames[user.role] : ""}
          <br />
          ข้อมูลตัวอย่างใช้ร่วมกันทุกบัญชี
        </p>
        <Link href="/">
          เกี่ยวกับ Claim Di <ArrowUpRight size={15} />
        </Link>
      </div>
    </>
  );
  return (
    <div className="workspace">
      <aside className="sidebar">{navigation}</aside>
      <dialog ref={drawer} className="nav-drawer" aria-label="เมนู">
        <button
          className="icon-button close"
          aria-label="ปิดเมนู"
          onClick={() => drawer.current?.close()}
        >
          <X />
        </button>
        {navigation}
      </dialog>
      <div className="workspace-body">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="เปิดเมนู"
            onClick={() => drawer.current?.showModal()}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            พื้นที่ทดลอง <ChevronRight size={14} aria-hidden="true" />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            {user?.role === "admin" && (
              <label className="role-select">
                <span>ดูหน้า</span>
                <select
                  value={view === "case-detail" ? "cases" : view}
                  onChange={(e) =>
                    router.push(
                      nav.find((n) => n.view === e.target.value)!.href,
                    )
                  }
                >
                  {nav.map((n) => (
                    <option key={n.view} value={n.view}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {user && (
              <span className="user-chip">
                <strong>{user.name}</strong>
                <span>{roleShort[user.role]}</span>
              </span>
            )}
            {user && canAct(user.role, "reset") && (
              <button
                className="icon-button"
                aria-label="รีเซ็ตข้อมูลตัวอย่าง"
                title="รีเซ็ตข้อมูลตัวอย่าง"
                onClick={() => setModal("reset")}
                disabled={!data || !!busy}
              >
                <RotateCcw size={18} />
              </button>
            )}
            <button
              className="icon-button"
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <div className="demo-banner">
          <Info size={15} aria-hidden="true" />
          <span>ระบบสาธิต · ใช้ข้อมูลและผลวิเคราะห์จำลอง</span>
          <span className="banner-right">บันทึกสถานะทดลองด้วย SQLite</span>
        </div>
        <main id="main" className="main-content">
          {error && !expired && !modal && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{error}</span>
              <button className="text-button" onClick={load}>
                โหลดข้อมูลล่าสุด
              </button>
            </div>
          )}
          {loading && !data && !expired ? (
            <div className="skeleton" role="status" aria-label="กำลังโหลด">
              <div />
              <div />
              <div />
            </div>
          ) : expired ? (
            <div
              className="skeleton"
              role="status"
              aria-label="กำลังไปหน้าเข้าสู่ระบบ"
            >
              <div />
            </div>
          ) : !data ? (
            <div className="empty">
              <h1>ยังโหลดข้อมูลไม่ได้</h1>
              <button className="button primary" onClick={load}>
                ลองใหม่
              </button>
            </div>
          ) : !allowed || (selected && !selected.detail) ? (
            <div className="empty">
              <Lock size={38} aria-hidden="true" />
              <h1>บัญชีนี้ไม่มีสิทธิ์เปิดหน้านี้</h1>
              <p>
                {roleNames[data.user.role]} ดูรายการเคสและสถานะได้
                และทำงานในส่วนที่รับผิดชอบ
              </p>
              <Link className="button secondary" href={homeFor(data.user.role)}>
                ไปหน้างานของฉัน
              </Link>
            </div>
          ) : id && !selected ? (
            <div className="empty">
              <FileText size={40} aria-hidden="true" />
              <h1>ไม่พบเคสนี้</h1>
              <p>ลิงก์อาจไม่ถูกต้อง หรือข้อมูลตัวอย่างถูกรีเซ็ตไปแล้ว</p>
              <Link className="button secondary" href="/demo">
                กลับรายการเคส
              </Link>
            </div>
          ) : selected ? (
            <CaseDetail
              key={selected.id + (isApproval ? ":doctor" : "")}
              data={data}
              selected={selected}
              approvals={isApproval}
              busy={busy}
              act={act}
              onReturn={() => {
                setNoteError("");
                setModal("return");
              }}
            />
          ) : isFinance ? (
            <Finance data={data} busy={busy} act={act} />
          ) : isMlops ? (
            <Mlops data={data} busy={busy} act={act} />
          ) : isClaims ? (
            <ClaimsOut data={data} busy={busy} act={act} />
          ) : isStats ? (
            <WorkStatsPage refresh={data.history[0]?.created_at ?? ""} />
          ) : isImport ? (
            <HisImport data={data} onImported={load} />
          ) : isUsers ? (
            <UsersAdmin self={data.user} />
          ) : (
            <CaseList data={data} approvals={isApproval} />
          )}
        </main>
        <footer className="app-footer">
          <span>
            Claim Di <span className="muted">/</span> PRE-CLAIM WORKSPACE
          </span>
          <span>ระบบสาธิตเท่านั้น ไม่ใช้สำหรับการวินิจฉัยหรือส่งเคลมจริง</span>
        </footer>
      </div>
      <div
        role="status"
        aria-live="polite"
        className={toast ? "toast visible" : "toast"}
      >
        {toast && (
          <>
            <CheckCircle2 size={18} aria-hidden="true" />
            {toast}
          </>
        )}
      </div>
      <dialog
        ref={dialog}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setModal(null);
        }}
        onClose={() => setModal(null)}
        className="confirm-dialog"
        aria-labelledby="dialog-title"
        aria-describedby={modal === "reset" ? "dialog-desc" : undefined}
      >
        <div className="dialog-heading">
          <h2 id="dialog-title">
            {modal === "reset" ? "รีเซ็ตข้อมูลตัวอย่าง?" : "ส่งกลับแก้ไข"}
          </h2>
          <button
            className="icon-button"
            aria-label="ปิด"
            onClick={() => setModal(null)}
            disabled={!!busy}
          >
            <X size={20} />
          </button>
        </div>
        {modal === "reset" ? (
          <p id="dialog-desc">
            เคส ผลตรวจ และประวัติทั้งหมดจะกลับเป็นชุดตั้งต้น
            ทุกบัญชีจะเห็นข้อมูลชุดใหม่ ส่วนบัญชีผู้ใช้ยังอยู่ครบ
          </p>
        ) : (
          <div className="field">
            <label htmlFor="return-note">เหตุผลที่ต้องแก้ไข</label>
            <textarea
              id="return-note"
              ref={noteField}
              autoFocus
              maxLength={500}
              rows={4}
              value={note}
              aria-invalid={!!noteError}
              aria-describedby={`note-help${noteError ? " note-error" : ""}`}
              onChange={(e) => {
                setNote(e.target.value);
                if (noteError && e.target.value.trim()) setNoteError("");
              }}
            />
            <span className="small muted" id="note-help">
              {note.length}/500 ตัวอักษร · ระบุสิ่งที่ควรตรวจทาน
              ห้ามกรอกข้อมูลผู้ป่วยจริง
            </span>
            {noteError && (
              <p className="field-error" id="note-error">
                {noteError}
              </p>
            )}
          </div>
        )}
        {error && modal && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button secondary"
            autoFocus={modal === "reset"}
            onClick={() => setModal(null)}
            disabled={!!busy}
          >
            ยกเลิก
          </button>
          <button
            className={`button ${modal === "reset" ? "danger" : "primary"}`}
            disabled={!!busy}
            onClick={() => (modal === "reset" ? act("reset") : submitReturn())}
          >
            {busy
              ? "กำลังบันทึก…"
              : modal === "reset"
                ? "รีเซ็ตข้อมูลตัวอย่าง"
                : "ส่งกลับพร้อมเหตุผล"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
