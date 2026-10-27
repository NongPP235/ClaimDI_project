import { NextRequest } from "next/server";
import { workspace, snapshotFor, mutate, AppError } from "@/lib/db";
import { canAct } from "@/lib/permissions";
import {
  failure,
  json,
  limit,
  publicUser,
  readJson,
  requireSameOrigin,
  requireUser,
} from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const view = async (user: Awaited<ReturnType<typeof requireUser>>) => ({
  user: publicUser(user),
  ...(await snapshotFor(await workspace(), user.role)),
});
export async function GET(req: NextRequest) {
  try {
    return json(await view(await requireUser(req)));
  } catch (e) {
    return failure(e, "demo read failed");
  }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    limit(`demo:${user.id}`, 60);
    const body = await readJson(req);
    if (
      (body.id !== undefined && typeof body.id !== "string") ||
      (body.revision !== undefined &&
        (!Number.isInteger(body.revision) || (body.revision as number) < 0)) ||
      (body.note !== undefined && typeof body.note !== "string") ||
      (body.version !== undefined && typeof body.version !== "string") ||
      (body.format !== undefined && typeof body.format !== "string") ||
      (body.package !== undefined && typeof body.package !== "string") ||
      (body.window !== undefined && typeof body.window !== "string") ||
      (body.rate !== undefined && typeof body.rate !== "number") ||
      (body.ids !== undefined &&
        (!Array.isArray(body.ids) ||
          body.ids.length > 50 ||
          body.ids.some((v) => typeof v !== "string")))
    )
      throw new AppError("รูปแบบข้อมูลไม่ถูกต้อง");
    // Server-side role check for every change (PROJECT_PLAN.md §14).
    if (!canAct(user.role, body.action))
      throw new AppError("บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้", 403);
    if (body.action === "reset") limit(`reset:${user.id}`, 10);
    const result = await mutate(await workspace(), body as never, {
      role: user.role,
      name: user.display_name,
    });
    if (result?.simulatedError)
      throw new AppError(
        "ตรวจตัวอย่างไม่สำเร็จ (จำลองข้อผิดพลาด) ข้อมูลเดิมยังอยู่ ลองใหม่ได้",
        503,
      );
    return json(await view(user));
  } catch (e) {
    return failure(e, "demo request failed");
  }
}
