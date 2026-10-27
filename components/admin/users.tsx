"use client";
import { useEffect, useState } from "react";
import { LoaderCircle, UserPlus } from "lucide-react";
import { roleNames, roles, type UserRole } from "@/lib/permissions";
import { date } from "@/components/ui/format";
import type { SessionUser } from "@/components/claims/types";

type Account = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  disabled: boolean;
  created_at: string;
};
const empty = {
  username: "",
  name: "",
  role: "coder" as UserRole,
  password: "",
};

// Account management (/demo/users), Admin only: PROJECT_PLAN.md §14,
// DESIGN_SYSTEM.md §9.
export default function UsersAdmin({ self }: { self: SessionUser }) {
  const [users, setUsers] = useState<Account[] | null>(null),
    [form, setForm] = useState(empty),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(""),
    [reset, setReset] = useState<{ id: string; password: string } | null>(null);
  async function call(body?: Record<string, unknown>) {
    setBusy(body ? String(body.action) + (body.id ?? "") : "load");
    setError("");
    setDone("");
    try {
      const r = await fetch("/api/users", {
        method: body ? "POST" : "GET",
        cache: "no-store",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(d.error || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      setUsers(d.users);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    call();
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (
      await call({
        action: "create",
        username: form.username.trim().toLowerCase(),
        display_name: form.name,
        role: form.role,
        password: form.password,
      })
    ) {
      setDone(`สร้างบัญชี ${form.username} แล้ว`);
      setForm(empty);
    }
  }
  const working = (key: string) => busy === key;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>ผู้ใช้งาน</h1>
          <p>สร้างบัญชี กำหนดบทบาท ปิดการใช้งาน และตั้งรหัสผ่านใหม่</p>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <p className="sr-only" role="status">
        {done}
      </p>
      {done && <p className="success-note">{done}</p>}

      <section className="users-section" aria-labelledby="users-title">
        <h2 id="users-title" className="section-title">
          บัญชีทั้งหมด {users ? `(${users.length})` : ""}
        </h2>
        {!users ? (
          <div className="skeleton" role="status" aria-label="กำลังโหลด">
            <div />
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th scope="col">ผู้ใช้</th>
                <th scope="col">บทบาท</th>
                <th scope="col">สถานะ</th>
                <th scope="col">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const me = u.id === self.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <small>
                        {u.username}
                        {me && " · บัญชีของคุณ"} · สร้าง {date(u.created_at)}
                      </small>
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`role-${u.id}`}>
                        บทบาทของ {u.username}
                      </label>
                      <select
                        id={`role-${u.id}`}
                        value={u.role}
                        disabled={me || !!busy}
                        onChange={(e) =>
                          call({
                            action: "update",
                            id: u.id,
                            role: e.target.value,
                          })
                        }
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {roleNames[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`badge ${u.disabled ? "draft" : "ready"}`}
                      >
                        <span aria-hidden="true" />
                        {u.disabled ? "ปิดใช้งาน" : "ใช้งานได้"}
                      </span>
                    </td>
                    <td className="user-actions">
                      {!me && (
                        <button
                          className="text-button"
                          disabled={!!busy}
                          onClick={() =>
                            call({
                              action: "update",
                              id: u.id,
                              disabled: !u.disabled,
                            })
                          }
                        >
                          {working("update" + u.id)
                            ? "กำลังบันทึก…"
                            : u.disabled
                              ? "เปิดใช้งาน"
                              : "ปิดใช้งาน"}
                        </button>
                      )}
                      <button
                        className="text-button"
                        disabled={!!busy}
                        onClick={() => setReset({ id: u.id, password: "" })}
                      >
                        ตั้งรหัสผ่านใหม่
                      </button>
                      {!me && (
                        <button
                          className="text-button danger-text"
                          disabled={!!busy}
                          onClick={() => {
                            if (
                              confirm(
                                `ลบบัญชี ${u.username}? ประวัติที่บัญชีนี้ทำไว้ยังอยู่`,
                              )
                            )
                              call({ action: "delete", id: u.id });
                          }}
                        >
                          ลบ
                        </button>
                      )}
                      {reset?.id === u.id && (
                        <form
                          className="inline-form"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (
                              await call({
                                action: "update",
                                id: u.id,
                                password: reset.password,
                              })
                            ) {
                              setDone(`ตั้งรหัสผ่านใหม่ให้ ${u.username} แล้ว`);
                              setReset(null);
                            }
                          }}
                        >
                          <label htmlFor={`pw-${u.id}`}>
                            รหัสผ่านใหม่ (8 ตัวขึ้นไป)
                          </label>
                          <input
                            id={`pw-${u.id}`}
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            required
                            autoFocus
                            value={reset.password}
                            onChange={(e) =>
                              setReset({ id: u.id, password: e.target.value })
                            }
                          />
                          <button className="button primary" disabled={!!busy}>
                            บันทึก
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setReset(null)}
                          >
                            ยกเลิก
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="user-create" aria-labelledby="create-title">
        <h2 id="create-title" className="section-title">
          <UserPlus size={19} aria-hidden="true" /> เพิ่มผู้ใช้
        </h2>
        <form onSubmit={create} className="user-form">
          <div className="field">
            <label htmlFor="new-username">ชื่อผู้ใช้</label>
            <input
              id="new-username"
              autoComplete="off"
              required
              autoCapitalize="none"
              spellCheck={false}
              pattern="[a-z0-9._\-]{3,32}"
              title="ใช้ a–z ตัวพิมพ์เล็ก 0–9 จุด ขีด หรือขีดล่าง 3–32 ตัว ไม่มีเว้นวรรค"
              aria-describedby="new-username-help"
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value.toLowerCase() })
              }
            />
            <span className="small muted" id="new-username-help">
              ตัวพิมพ์เล็ก a–z, 0–9, จุด, ขีด 3–32 ตัว ไม่มีเว้นวรรค
              ใช้ตอนเข้าสู่ระบบ
            </span>
          </div>
          <div className="field">
            <label htmlFor="new-name">ชื่อที่แสดง</label>
            <input
              id="new-name"
              required
              maxLength={60}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="new-role">บทบาท</label>
            <select
              id="new-role"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as UserRole })
              }
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleNames[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-password">รหัสผ่านเริ่มต้น</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              aria-describedby="new-password-help"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <span className="small muted" id="new-password-help">
              อย่างน้อย 8 ตัวอักษร แจ้งผู้ใช้ผ่านช่องทางที่ปลอดภัย
            </span>
          </div>
          <button className="button primary" disabled={!!busy}>
            {working("create") ? (
              <LoaderCircle className="spin" size={17} />
            ) : null}
            {working("create") ? "กำลังบันทึก…" : "สร้างบัญชี"}
          </button>
        </form>
      </section>
    </>
  );
}
