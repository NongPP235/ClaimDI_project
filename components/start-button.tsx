"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
// On the landing page this opens /demo. Inside the workspace (a deep link
// without a session) it stays on the requested page via onStarted.
export default function StartButton({ onStarted }: { onStarted?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      if (onStarted) {
        setBusy(false);
        onStarted();
      } else router.push("/demo");
    } catch (e) {
      setError(
        (e as Error).message || "เริ่มชุดทดลองไม่สำเร็จ ลองใหม่อีกครั้ง",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <button className="button primary" disabled={busy} onClick={start}>
        {busy ? <LoaderCircle className="spin" size={18} /> : null}
        {busy ? "กำลังเตรียมเคส…" : "ทดลองด้วยเคสตัวอย่าง"}
        <ArrowUpRight size={18} />
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
