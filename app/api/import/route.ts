import { NextRequest } from "next/server";
import { AppError, hisImport, workspace } from "@/lib/db";
import { hisFiles, MAX_CHARS, type HisInput } from "@/lib/his";
import { canAct } from "@/lib/permissions";
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
// Import from HIS (PROJECT_PLAN.md §19): Admin and coders. "preview" only
// parses; "import" creates the cases.
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const user = await requireUser(req, "import");
    if (!canAct(user.role, "import"))
      throw new AppError("บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้", 403);
    limit(`import:${user.id}`, 30);
    const body = await readJson(req, MAX_CHARS + 20000);
    const files = body.files as Record<string, unknown> | undefined;
    if (
      !["preview", "import"].includes(body.action) ||
      !files ||
      typeof files !== "object" ||
      Array.isArray(files) ||
      Object.entries(files).some(
        ([k, v]) =>
          !(hisFiles as readonly string[]).includes(k) || typeof v !== "string",
      )
    )
      throw new AppError("รูปแบบข้อมูลไม่ถูกต้อง");
    const result = await hisImport(
      await workspace(),
      files as HisInput,
      body.action === "import",
      { role: user.role, name: user.display_name },
    );
    return json({
      imported: result.imported,
      errors: result.errors,
      warnings: result.warnings,
      files: result.files,
      cases: result.cases.map((c) => ({
        code: c.code,
        visit: c.visit,
        diagnosis: c.diagnosis,
        payer: c.payer,
        amount: c.amount,
        findings: c.findings.map((f) => ({ title: f.title, atRisk: f.atRisk })),
        duplicate: c.duplicate,
      })),
    });
  } catch (e) {
    return failure(e, "import failed");
  }
}
