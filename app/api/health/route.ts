import { db } from "@/lib/db";
import { get } from "@/lib/sql";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// When the database is unreachable, say why in plain words (DEPLOY.md
// "ปัญหาที่พบบ่อย"). Only the error kind is returned, never the address or
// password.
function reason(e: unknown) {
  const err = e as { code?: string; message?: string };
  const msg = err?.message ?? "";
  if (msg.includes("DATABASE_URL is required"))
    return "ยังไม่ได้ตั้ง DATABASE_URL ใน Vercel → Settings → Environment Variables แล้ว Redeploy";
  if (err?.code === "ENOTFOUND")
    return "หาเครื่องฐานข้อมูลไม่พบ: ตรวจชื่อ host ใน DATABASE_URL ให้ตรงกับปุ่ม Connect ของ Supabase";
  if (err?.code === "28P01") return "รหัสผ่านฐานข้อมูลไม่ถูกต้อง";
  if (/tenant or user not found/i.test(msg))
    return "ชื่อผู้ใช้หรือ host ของ pooler ไม่ตรงกับโปรเจกต์: คัดลอก Transaction pooler URI จากปุ่ม Connect ของ Supabase ใหม่";
  if (["ETIMEDOUT", "ECONNREFUSED", "ENETUNREACH"].includes(err?.code ?? ""))
    return "เชื่อมต่อฐานข้อมูลไม่ได้: ใช้ Transaction pooler (port 6543) และตรวจว่าโปรเจกต์ Supabase ไม่ได้ถูกหยุดชั่วคราว";
  if (/invalid url|password must be a string/i.test(msg))
    return "รูปแบบ DATABASE_URL ไม่ถูกต้อง: ตรวจว่าไม่มีช่องว่างหรือเครื่องหมายคำพูด และรหัสผ่านที่มีอักขระพิเศษต้องเข้ารหัส URL";
  return `ฐานข้อมูลตอบกลับผิดพลาด (${err?.code ?? "unknown"})`;
}
export async function GET() {
  try {
    await db();
    await get("SELECT 1");
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const why = reason(e);
    console.error("health check failed:", why);
    return Response.json(
      { status: "unavailable", reason: why },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
