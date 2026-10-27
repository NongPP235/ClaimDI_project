import { NextRequest } from "next/server";
import { AppError } from "@/lib/db";
import { createUser, deleteUser, listUsers, updateUser } from "@/lib/auth";
import {
  failure,
  json,
  limit,
  readJson,
  requireSameOrigin,
  requireUser,
} from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const users = async () =>
  (await listUsers()).map((u) => ({
    id: u.id,
    username: u.username,
    name: u.display_name,
    role: u.role,
    disabled: !!u.disabled,
    created_at: u.created_at,
  }));
// Account management: Admin only (PROJECT_PLAN.md §14).
export async function GET(req: NextRequest) {
  try {
    await requireUser(req, "users");
    return json({ users: await users() });
  } catch (e) {
    return failure(e, "users list failed");
  }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const self = await requireUser(req, "users");
    limit(`users:${self.id}`, 60);
    const body = await readJson(req);
    if (body.action === "create") await createUser(body as never);
    else if (body.action === "update") await updateUser(self, body as never);
    else if (body.action === "delete") await deleteUser(self, body.id);
    else throw new AppError("การกระทำไม่ถูกต้อง");
    return json({ users: await users() });
  } catch (e) {
    return failure(e, "users request failed");
  }
}
