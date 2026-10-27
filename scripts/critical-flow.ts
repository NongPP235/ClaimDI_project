// Critical flow test (PROJECT_PLAN.md §20): the path a hospital uses the
// demo for, end to end over HTTP, against a running server: local or the
// deployed Vercel site. Run it after every deploy:
//   TEST_URL=https://your-app.vercel.app TEST_ADMIN_USER=... TEST_ADMIN_PASSWORD=... npm run test:critical
// It creates two temporary accounts, imports the sample HIS files, works one
// case through to the insurer export, then resets the shared case data and
// deletes the temporary accounts. Against a non-local URL it asks for
// CONFIRM_RESET=yes, because the reset clears the demo's case data.
import assert from "node:assert/strict";
import { hisSample } from "../lib/his-sample.ts";

const base = (process.env.TEST_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const adminUser = process.env.TEST_ADMIN_USER,
  adminPass = process.env.TEST_ADMIN_PASSWORD;
if (!adminUser || !adminPass) {
  console.error("ตั้ง TEST_ADMIN_USER และ TEST_ADMIN_PASSWORD ก่อน");
  process.exit(1);
}
const local = ["127.0.0.1", "localhost"].includes(new URL(base).hostname);
if (!local && process.env.CONFIRM_RESET !== "yes") {
  console.error(
    `การทดสอบนี้จะรีเซ็ตข้อมูลเคสบน ${base} เมื่อจบ ตั้ง CONFIRM_RESET=yes ถ้ายืนยัน`,
  );
  process.exit(1);
}

type Res = { status: number; body: any; cookie?: string };
async function call(path: string, body?: unknown, cookie = ""): Promise<Res> {
  const r = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    body: await r.json().catch(() => ({})),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
const expect = (r: Res, status: number) =>
  assert.equal(r.status, status, JSON.stringify(r.body).slice(0, 300));
const login = async (username: string, password: string) => {
  const r = await call("/api/auth", { action: "login", username, password });
  expect(r, 200);
  return r.cookie!;
};
let n = 0;
const step = async (name: string, fn: () => Promise<void>) => {
  const t = Date.now();
  try {
    await fn();
    console.log(`✓ ${++n}. ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    console.error(`✗ ${++n}. ${name}\n  ${(e as Error).message}`);
    throw e;
  }
};
const find = (body: any, code: string) =>
  body.cases.find((c: any) => c.scenario.code === code);

const tag = `cf${Date.now().toString(36)}`;
let admin = "",
  coder = "",
  doctor = "";
let failed = false;
try {
  await step("เว็บและฐานข้อมูลพร้อม", async () => {
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/login`)).status, 200);
    expect(await call("/api/health"), 200);
  });
  await step("ต้องล็อกอิน และรหัสผิดเข้าไม่ได้", async () => {
    expect(await call("/api/demo"), 401);
    expect(
      await call("/api/auth", {
        action: "login",
        username: adminUser,
        password: "wrong-password",
      }),
      401,
    );
    admin = await login(adminUser, adminPass);
  });
  await step("Admin สร้างบัญชีเจ้าหน้าที่และแพทย์", async () => {
    for (const role of ["coder", "doctor"]) {
      expect(
        await call(
          "/api/users",
          {
            action: "create",
            username: `${tag}-${role}`,
            display_name: `ทดสอบ ${role}`,
            role,
            password: "critical-pass-1",
          },
          admin,
        ),
        200,
      );
    }
    coder = await login(`${tag}-coder`, "critical-pass-1");
    doctor = await login(`${tag}-doctor`, "critical-pass-1");
    expect(await call("/api/demo", { action: "reset" }, admin), 200);
  });
  await step("นำเข้าไฟล์ HIS: ตรวจก่อน แล้วนำเข้า 4 เคส", async () => {
    const preview = await call(
      "/api/import",
      { action: "preview", files: hisSample },
      coder,
    );
    expect(preview, 200);
    assert.equal(preview.body.cases.length, 4);
    assert.equal(preview.body.errors.length, 0);
    const imported = await call(
      "/api/import",
      { action: "import", files: hisSample },
      coder,
    );
    expect(imported, 200);
    assert.equal(imported.body.imported, 4);
    const list = (await call("/api/demo", null, coder)).body;
    const his = list.cases.filter((c: any) => c.source === "his");
    assert.equal(his.length, 4);
    // Names and ID numbers never reach the stored case.
    const text = JSON.stringify(list);
    for (const leak of ["ทดลอง มีสุข", "1100000000033", "0034567"])
      assert.ok(!text.includes(leak), `พบข้อมูลที่ควรปิด: ${leak}`);
    expect(
      await call("/api/import", { action: "import", files: hisSample }, coder),
      409,
    );
  });
  let before = 0;
  await step("เจ้าหน้าที่ตรวจเคส เห็นประเด็นและมูลค่าเสี่ยง", async () => {
    const d = (await call("/api/demo", null, coder)).body;
    before = d.prevented.amount;
    let c = find(d, "DEMO-001");
    const r = await call(
      "/api/demo",
      { action: "analyze", id: c.id, revision: c.revision },
      coder,
    );
    expect(r, 200);
    c = find(r.body, "DEMO-001");
    assert.equal(c.status, "needs_revision");
    const findings = JSON.parse(c.audit.findings_json);
    assert.ok(findings.length > 0);
    assert.ok(findings.every((f: any) => f.atRisk > 0));
  });
  await step("สร้างข้อเสนอแก้ไขและส่งให้แพทย์", async () => {
    for (const action of ["proposal", "submit"]) {
      const c = find((await call("/api/demo", null, coder)).body, "DEMO-001");
      expect(
        await call(
          "/api/demo",
          { action, id: c.id, revision: c.revision },
          coder,
        ),
        200,
      );
    }
    const c = find((await call("/api/demo", null, coder)).body, "DEMO-001");
    assert.equal(c.status, "awaiting_review");
  });
  await step("สิทธิ์: เจ้าหน้าที่ยืนยันแทนแพทย์ไม่ได้", async () => {
    const c = find((await call("/api/demo", null, coder)).body, "DEMO-001");
    expect(
      await call(
        "/api/demo",
        { action: "approve", id: c.id, revision: c.revision },
        coder,
      ),
      403,
    );
    expect(
      await call("/api/import", { action: "preview", files: {} }, doctor),
      403,
    );
  });
  await step("แพทย์ยืนยันข้อเสนอ เคสพร้อมส่งประกัน", async () => {
    const c = find((await call("/api/demo", null, doctor)).body, "DEMO-001");
    assert.ok(c.detail, "แพทย์ต้องเห็นรายละเอียดเคสที่รอตรวจ");
    const r = await call(
      "/api/demo",
      { action: "approve", id: c.id, revision: c.revision },
      doctor,
    );
    expect(r, 200);
    assert.equal(find(r.body, "DEMO-001").status, "ready");
    // The same revision cannot be approved twice.
    expect(
      await call(
        "/api/demo",
        { action: "approve", id: c.id, revision: c.revision },
        doctor,
      ),
      409,
    );
  });
  await step("ส่งออกไฟล์สำหรับส่งประกัน และบันทึกในประวัติ", async () => {
    const c = find((await call("/api/demo", null, coder)).body, "DEMO-001");
    expect(
      await call(
        "/api/demo",
        { action: "export", ids: [c.id], format: "csv" },
        coder,
      ),
      200,
    );
    const hist = (await call("/api/demo", null, admin)).body.history;
    assert.ok(
      hist.some(
        (h: any) =>
          h.case_id === c.id &&
          h.action === "ส่งออกข้อมูลเคลม" &&
          h.actor_name === "ทดสอบ coder",
      ),
    );
  });
  await step("ยอดเงินที่ป้องกันได้เพิ่มขึ้น", async () => {
    const d = (await call("/api/demo", null, admin)).body;
    assert.ok(
      d.prevented.amount > before,
      `ก่อน ${before} หลัง ${d.prevented.amount}`,
    );
    console.log(
      `   มูลค่าเสี่ยงที่แก้แล้ว ฿${d.prevented.amount.toLocaleString()} ป้องกันได้ประมาณ ฿${Math.round((d.prevented.amount * d.denialRate) / 100).toLocaleString()}`,
    );
  });
  await step(
    "ข้อมูลยังอยู่หลังล็อกอินใหม่ (บันทึกลงฐานข้อมูลจริง)",
    async () => {
      await call("/api/auth", { action: "logout" }, coder);
      expect(await call("/api/demo", null, coder), 401);
      coder = await login(`${tag}-coder`, "critical-pass-1");
      const d = (await call("/api/demo", null, coder)).body;
      assert.equal(find(d, "DEMO-001").status, "ready");
      assert.equal(d.cases.filter((c: any) => c.source === "his").length, 4);
    },
  );
} catch {
  failed = true;
} finally {
  if (admin) {
    await call("/api/demo", { action: "reset" }, admin);
    const users = (await call("/api/users", null, admin)).body.users ?? [];
    for (const u of users.filter((u: any) => u.username.startsWith(tag)))
      await call("/api/users", { action: "delete", id: u.id }, admin);
    console.log("ล้างข้อมูลทดสอบแล้ว: รีเซ็ตเคสและลบบัญชีชั่วคราว");
  }
}
if (failed) {
  console.error(`FAIL: critical flow ไม่ผ่าน (${base})`);
  process.exit(1);
}
console.log(`PASS: critical flow ผ่านครบ ${n} ขั้น (${base})`);
