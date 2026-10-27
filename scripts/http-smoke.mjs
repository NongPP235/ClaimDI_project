// End-to-end HTTP check against a running server. It changes the shared
// case data and resets it at the end, so run it against a test database:
//   DATABASE_PATH=./data/smoke.sqlite npm run start   (other terminal)
//   TEST_ADMIN_USER=... TEST_ADMIN_PASSWORD=... node scripts/http-smoke.mjs
import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const adminUser = process.env.TEST_ADMIN_USER,
  adminPass = process.env.TEST_ADMIN_PASSWORD;
if (!adminUser || !adminPass) {
  console.error("ตั้ง TEST_ADMIN_USER และ TEST_ADMIN_PASSWORD ก่อน");
  process.exit(1);
}
async function call(path, body, cookie = "", origin = base) {
  const r = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
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
const login = async (username, password) => {
  const r = await call("/api/auth", { action: "login", username, password });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookie;
};

assert.equal((await fetch(base)).status, 200);
assert.equal((await fetch(`${base}/login`)).status, 200);
assert.equal((await fetch(`${base}/api/health`)).status, 200);
assert.equal((await call("/api/demo")).status, 401);
assert.equal((await call("/api/users")).status, 401);
assert.equal(
  (
    await call("/api/auth", {
      action: "login",
      username: adminUser,
      password: "wrong-password",
    })
  ).status,
  401,
);
assert.equal(
  (
    await call(
      "/api/auth",
      { action: "login", username: adminUser, password: adminPass },
      "",
      "https://other.invalid",
    )
  ).status,
  403,
);
const admin = await login(adminUser, adminPass);
const tag = `smoke${Date.now().toString(36)}`;
const cookies = {};
for (const role of ["coder", "doctor", "cfo", "engineer"]) {
  const r = await call(
    "/api/users",
    {
      action: "create",
      username: `${tag}-${role}`,
      display_name: `Smoke ${role}`,
      role,
      password: "smoke-pass-123",
    },
    admin,
  );
  assert.equal(r.status, 200, JSON.stringify(r.body));
  cookies[role] = await login(`${tag}-${role}`, "smoke-pass-123");
}
try {
  // Everyone sees all cases and statuses; full content only where they work.
  for (const role of Object.keys(cookies)) {
    const r = await call("/api/demo", null, cookies[role]);
    assert.equal(r.status, 200);
    assert.equal(r.body.cases.length, 6);
    assert.equal(r.body.user.role, role);
    assert.equal((await call("/api/users", null, cookies[role])).status, 403);
    assert.equal(
      (await call("/api/demo", { action: "reset" }, cookies[role])).status,
      403,
    );
  }
  const cfoView = (await call("/api/demo", null, cookies.cfo)).body;
  assert.ok(cfoView.cases.every((c) => !c.detail && !c.scenario.sections));
  // Coder works the case, doctor approves; each blocked from the other's step.
  let c = (await call("/api/demo", null, cookies.coder)).body.cases[0];
  assert.equal(
    (
      await call(
        "/api/demo",
        { action: "analyze", id: c.id, revision: c.revision },
        cookies.doctor,
      )
    ).status,
    403,
  );
  for (const action of ["analyze", "proposal", "submit"]) {
    const r = await call(
      "/api/demo",
      { action, id: c.id, revision: c.revision },
      cookies.coder,
    );
    assert.equal(r.status, 200, JSON.stringify(r.body));
    c = r.body.cases[0];
  }
  assert.equal(
    (
      await call(
        "/api/demo",
        { action: "approve", id: c.id, revision: c.revision },
        cookies.coder,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/demo",
        { action: "approve", id: c.id, revision: c.revision },
        cookies.cfo,
      )
    ).status,
    403,
  );
  const ok = await call(
    "/api/demo",
    { action: "approve", id: c.id, revision: c.revision },
    cookies.doctor,
  );
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.cases[0].status, "ready");
  assert.equal(
    (
      await call(
        "/api/demo",
        { action: "approve", id: c.id, revision: c.revision },
        cookies.doctor,
      )
    ).status,
    409,
  );
  assert.equal(
    (await call("/api/demo", { action: "rule", version: "2.0" }, cookies.cfo))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/demo",
        { action: "rule", version: "2.0" },
        cookies.engineer,
      )
    ).status,
    200,
  );
  const hist = (await call("/api/demo", null, admin)).body.history;
  assert.ok(
    hist.some(
      (h) => h.actor_name === "Smoke doctor" && h.simulated_role === "doctor",
    ),
  );
  // Logout ends the session.
  await call("/api/auth", { action: "logout" }, cookies.cfo);
  assert.equal((await call("/api/demo", null, cookies.cfo)).status, 401);
} finally {
  assert.equal(
    (await call("/api/demo", { action: "reset" }, admin)).status,
    200,
  );
  const users = (await call("/api/users", null, admin)).body.users;
  for (const u of users.filter((u) => u.username.startsWith(tag)))
    await call("/api/users", { action: "delete", id: u.id }, admin);
}
console.log(
  "PASS: pages, health, sign-in required, wrong password, CSRF, per-role visibility and actions, coder→doctor workflow, stale revision, rule change, actor in history, logout, admin reset and cleanup.",
);
