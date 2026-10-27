import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./db.ts";
import { currentUser, LOGIN_IDLE_HOURS, type User } from "./auth.ts";
import { canView, type View } from "./permissions.ts";

// Shared request handling for the API routes: same-origin check, in-memory
// rate limit (single instance, README), size-limited JSON and the auth cookie.
export const AUTH_COOKIE = "claimdi_auth";
const rates = new Map<string, { n: number; until: number }>();
export function limit(key: string, max: number, windowMs = 60000) {
  const now = Date.now();
  if (rates.size > 5000)
    for (const [k, v] of rates) if (v.until < now) rates.delete(k);
  const rate = rates.get(key);
  if (rate && rate.until > now && rate.n >= max)
    throw new AppError("ทำรายการถี่เกินไป กรุณารอสักครู่", 429);
  rates.set(key, {
    n: rate && rate.until > now ? rate.n + 1 : 1,
    until: rate && rate.until > now ? rate.until : now + windowMs,
  });
}
export const clientKey = (req: NextRequest) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
export function requireSameOrigin(req: NextRequest) {
  let same = false;
  try {
    const parsed = new URL(req.headers.get("origin") || "");
    same = process.env.APP_ORIGIN
      ? parsed.origin === new URL(process.env.APP_ORIGIN).origin
      : parsed.host === req.headers.get("host") &&
        ["http:", "https:"].includes(parsed.protocol);
  } catch {}
  if (!same) throw new AppError("ไม่อนุญาตคำขอจากเว็บไซต์อื่น", 403);
}
export async function readJson(req: NextRequest, max = 4000) {
  if (Number(req.headers.get("content-length") || 0) > max * 2)
    throw new AppError("ข้อมูลยาวเกินกำหนด", 413);
  const raw = await req.text();
  if (raw.length > max) throw new AppError("ข้อมูลยาวเกินกำหนด", 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AppError("ข้อมูลไม่ถูกต้อง");
  }
  if (!body || typeof body !== "object" || typeof body.action !== "string")
    throw new AppError("ข้อมูลไม่ถูกต้อง");
  return body as Record<string, unknown> & { action: string };
}
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
export function failure(e: unknown, label: string) {
  if (!(e instanceof AppError))
    console.error(label, e instanceof Error ? e.name : "unknown");
  return json(
    {
      error:
        e instanceof AppError
          ? e.message
          : "ระบบบันทึกไม่สำเร็จ ลองใหม่อีกครั้ง",
    },
    e instanceof AppError ? e.status : 500,
  );
}
export function setAuthCookie(
  req: NextRequest,
  res: NextResponse,
  token: string | null,
) {
  res.cookies.set(AUTH_COOKIE, token ?? "", {
    httpOnly: true,
    sameSite: "lax",
    secure:
      req.nextUrl.protocol === "https:" ||
      req.headers.get("x-forwarded-proto") === "https",
    maxAge: token ? LOGIN_IDLE_HOURS * 3600 : 0,
    path: "/",
  });
  return res;
}
export async function requireUser(
  req: NextRequest,
  view?: View,
): Promise<User> {
  const user = await currentUser(req.cookies.get(AUTH_COOKIE)?.value);
  if (view && !canView(user.role, view))
    throw new AppError("บัญชีนี้ไม่มีสิทธิ์เข้าถึงส่วนนี้", 403);
  return user;
}
export const publicUser = (u: User) => ({
  id: u.id,
  username: u.username,
  name: u.display_name,
  role: u.role,
});
