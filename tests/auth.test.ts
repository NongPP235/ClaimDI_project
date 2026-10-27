import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const temp = mkdtempSync(join(tmpdir(), "claimdi-auth-"));
process.env.PGLITE_DIR = "memory://";
const { closeDb, workspace, snapshotFor, mutate } =
  await import("../lib/db.ts");
const auth = await import("../lib/auth.ts");
const { canAct, canView } = await import("../lib/permissions.ts");
after(async () => {
  await closeDb();
  rmSync(temp, { recursive: true, force: true });
});
const make = async (username: string, role: string) => {
  await auth.createUser({
    username,
    display_name: username.toUpperCase(),
    role,
    password: "password123",
  });
  return await auth.currentUser(await auth.login(username, "password123"));
};

test("passwords are hashed and verified", async () => {
  const h = auth.hashPassword("password123");
  assert.match(h, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.ok(auth.verifyPassword("password123", h));
  assert.ok(!auth.verifyPassword("password124", h));
});
test("login, wrong password, logout and disabled accounts", async () => {
  const admin = await make("admin", "admin");
  await make("coder1", "coder");
  await assert.rejects(
    async () => await auth.login("coder1", "nope-nope"),
    /ไม่ถูกต้อง/,
  );
  await assert.rejects(
    async () => await auth.login("nobody", "password123"),
    /ไม่ถูกต้อง/,
  );
  const token = await auth.login("Coder1", "password123");
  assert.equal((await auth.currentUser(token)).role, "coder");
  await auth.logout(token);
  await assert.rejects(
    async () => await auth.currentUser(token),
    /เข้าสู่ระบบ/,
  );
  const again = await auth.login("coder1", "password123");
  const id = (await auth.listUsers()).find((u) => u.username === "coder1")!.id;
  await auth.updateUser(admin, { id, disabled: true });
  await assert.rejects(
    async () => await auth.currentUser(again),
    /เข้าสู่ระบบ/,
  );
  await assert.rejects(
    async () => await auth.login("coder1", "password123"),
    /ไม่ถูกต้อง/,
  );
  await assert.rejects(
    async () =>
      await auth.createUser({
        username: "coder1",
        display_name: "x",
        role: "coder",
        password: "password123",
      }),
    /มีชื่อผู้ใช้นี้แล้ว/,
  );
  await assert.rejects(
    async () =>
      await auth.createUser({
        username: "A B",
        display_name: "x",
        role: "coder",
        password: "password123",
      }),
    /ชื่อผู้ใช้/,
  );
  await assert.rejects(
    async () =>
      await auth.createUser({
        username: "short",
        display_name: "x",
        role: "coder",
        password: "1234567",
      }),
    /รหัสผ่าน/,
  );
});
test("an admin cannot lock out the last admin or themselves", async () => {
  const admin = await auth.currentUser(
    await auth.login("admin", "password123"),
  );
  await assert.rejects(
    async () => await auth.updateUser(admin, { id: admin.id, role: "coder" }),
    /ตัวเอง/,
  );
  await assert.rejects(
    async () => await auth.deleteUser(admin, admin.id),
    /ตัวเอง/,
  );
  const other = await make("admin2", "admin");
  await auth.updateUser(other, { id: admin.id, role: "coder" });
  await assert.rejects(
    async () => await auth.updateUser(other, { id: other.id, disabled: true }),
    /ตัวเอง/,
  );
  await auth.updateUser(other, { id: admin.id, role: "admin" });
  await auth.deleteUser(admin, other.id);
  assert.equal(await auth.countActiveAdmins(), 1);
});
test("role permissions: admin sees all, others list + own work", async () => {
  assert.ok(
    [
      "cases",
      "case-detail",
      "approvals",
      "claims",
      "finance",
      "mlops",
      "users",
      "stats",
    ].every((v) => canView("admin", v as never)),
  );
  for (const r of ["coder", "doctor", "cfo", "engineer"] as const) {
    assert.ok(canView(r, "cases"));
    assert.ok(!canView(r, "users") && !canView(r, "stats"));
    assert.ok(!canAct(r, "reset"));
  }
  assert.ok(canView("coder", "case-detail") && !canView("coder", "approvals"));
  assert.ok(
    canView("doctor", "approvals") && !canView("doctor", "case-detail"),
  );
  assert.ok(canView("cfo", "finance") && !canView("cfo", "mlops"));
  assert.ok(canView("engineer", "mlops") && !canView("engineer", "finance"));
  assert.ok(canAct("coder", "submit") && !canAct("coder", "approve"));
  assert.ok(canAct("doctor", "approve") && !canAct("doctor", "analyze"));
  assert.ok(canAct("engineer", "rule") && !canAct("cfo", "rule"));
});
test("shared workspace: coder hands off to doctor; data filtered by role", async () => {
  const w = await workspace();
  assert.equal((await workspace()).id, w.id);
  let c = (await snapshotFor(w, "coder")).cases[0];
  const coder = { role: "coder" as const, name: "ผู้ตรวจ" };
  await mutate(w, { action: "analyze", id: c.id, revision: c.revision }, coder);
  c = (await snapshotFor(w, "coder")).cases[0];
  await mutate(
    w,
    { action: "proposal", id: c.id, revision: c.revision },
    coder,
  );
  c = (await snapshotFor(w, "coder")).cases[0];
  await mutate(w, { action: "submit", id: c.id, revision: c.revision }, coder);
  const doc = await snapshotFor(w, "doctor");
  const mine = doc.cases.find((x) => x.id === c.id)!;
  assert.equal(mine.status, "awaiting_review");
  assert.ok(mine.detail && "sections" in mine.scenario);
  const draft = doc.cases.find((x) => x.status === "draft")!;
  assert.ok(!draft.detail && !("sections" in draft.scenario));
  const cfo = await snapshotFor(w, "cfo");
  assert.ok(
    cfo.cases.every((x) => !x.detail && x.proposal === "" && x.audit === null),
  );
  assert.equal(cfo.cases.length, 6);
  assert.equal(cfo.history.length, 0);
  const history = (await snapshotFor(w, "admin")).history;
  assert.equal(history[0].actor_name, "ผู้ตรวจ");
  assert.equal(history[0].simulated_role, "coder");
});
