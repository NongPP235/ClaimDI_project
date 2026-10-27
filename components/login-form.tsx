"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, LogIn } from "lucide-react";

// Sign-in (DESIGN_SYSTEM.md §9). Only same-site paths are accepted as the
// return address so the form cannot be used to redirect elsewhere.
export default function LoginForm() {
  const router = useRouter(),
    params = useSearchParams();
  const next = params.get("next") || "";
  const target = /^\/demo(\/[\w\-/]*)?$/.test(next) ? next : "/demo";
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // Already signed in: go straight on.
  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.ok && router.replace(target))
      .catch(() => {});
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(d.error || "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง");
      router.replace(target);
    } catch (e) {
      setError((e as Error).message);
      setPassword("");
      setBusy(false);
    }
  }
  return (
    <main id="main" className="login-page">
      <form className="login-card" onSubmit={submit} noValidate={false}>
        <Link href="/" className="brand">
          <img className="brand-logo" src="/claimdi-logo.png" alt="Claim Di" />
        </Link>
        <h1>เข้าสู่ระบบ</h1>
        <p className="muted">
          ใช้บัญชีที่ผู้ดูแลระบบสร้างให้ สิ่งที่เห็นจะขึ้นกับบทบาทของบัญชี
        </p>
        {error && (
          <p className="error-banner" role="alert" id="login-error">
            {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="username">ชื่อผู้ใช้</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
            aria-describedby={error ? "login-error" : undefined}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">รหัสผ่าน</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          className="button primary"
          disabled={busy || !username || !password}
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <LogIn size={18} />
          )}
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
        <p className="small muted">
          ระบบสาธิต · ใช้ข้อมูลและผลวิเคราะห์จำลอง ไม่ใส่ข้อมูลผู้ป่วยจริง
        </p>
      </form>
    </main>
  );
}
