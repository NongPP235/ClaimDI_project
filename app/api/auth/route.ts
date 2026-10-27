import { NextRequest } from "next/server";
import { AppError } from "@/lib/db";
import { login, logout } from "@/lib/auth";
import {
  AUTH_COOKIE,
  clientKey,
  failure,
  json,
  limit,
  publicUser,
  readJson,
  requireSameOrigin,
  requireUser,
  setAuthCookie,
} from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    return json({ user: publicUser(await requireUser(req)) });
  } catch (e) {
    return failure(e, "auth check failed");
  }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const body = await readJson(req);
    if (body.action === "logout") {
      await logout(req.cookies.get(AUTH_COOKIE)?.value);
      return setAuthCookie(req, json({ ok: true }), null);
    }
    if (body.action !== "login") throw new AppError("การกระทำไม่ถูกต้อง");
    // Slow down password guessing per address and per account.
    limit(`login-ip:${clientKey(req)}`, 30, 10 * 60000);
    limit(`login-user:${String(body.username).toLowerCase()}`, 10, 10 * 60000);
    const token = await login(body.username, body.password);
    const res = json({ ok: true });
    return setAuthCookie(req, res, token);
  } catch (e) {
    return failure(e, "auth request failed");
  }
}
