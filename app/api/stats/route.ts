import { NextRequest } from "next/server";
import { workspace } from "@/lib/db";
import { workStats } from "@/lib/stats";
import { failure, json, requireUser } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Work statistics: Admin only (PROJECT_PLAN.md §16).
export async function GET(req: NextRequest) {
  try {
    await requireUser(req, "stats");
    return json({ stats: await workStats((await workspace()).id) });
  } catch (e) {
    return failure(e, "stats failed");
  }
}
