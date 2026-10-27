import {
  randomBytes,
  randomUUID,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db, AppError } from "./db.ts";
import { all, get, isUniqueViolation, run, transaction } from "./sql.ts";
import { isRole, type UserRole } from "./permissions.ts";

// Accounts and sign-in sessions (PROJECT_PLAN.md §14). Passwords are stored
// as scrypt hashes with a per-user salt; session tokens only as SHA-256.
export const LOGIN_IDLE_HOURS = 12;
const IDLE = LOGIN_IDLE_HOURS * 3600000;
export type User = {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  disabled: number;
  created_at: string;
};
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  const [kind, salt, key] = stored.split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
// Used when the username does not exist, so a miss costs the same time.
const dummyHash = hashPassword(randomBytes(12).toString("hex"));

export function validateUsername(u: unknown): string {
  if (typeof u !== "string" || !/^[a-z0-9._-]{3,32}$/.test(u))
    throw new AppError(
      "ชื่อผู้ใช้ต้องเป็น a–z, 0–9, จุด, ขีด หรือขีดล่าง 3–32 ตัวอักษร",
    );
  return u;
}
export function validatePassword(p: unknown): string {
  if (typeof p !== "string" || p.length < 8 || p.length > 128)
    throw new AppError("รหัสผ่านต้องยาว 8–128 ตัวอักษร");
  return p;
}
function validateName(n: unknown): string {
  const v = typeof n === "string" ? n.trim() : "";
  if (!v || v.length > 60)
    throw new AppError("ชื่อที่แสดงต้องยาว 1–60 ตัวอักษร");
  return v;
}
function validateRole(r: unknown): UserRole {
  if (!isRole(r)) throw new AppError("บทบาทไม่ถูกต้อง");
  return r;
}

const userCols = "id,username,display_name,role,disabled,created_at";
export async function listUsers() {
  await db();
  return all<User>(`SELECT ${userCols} FROM users ORDER BY created_at`);
}
export async function countActiveAdmins() {
  await db();
  return (await get<{ n: number }>(
    "SELECT COUNT(*) n FROM users WHERE role='admin' AND disabled=0",
  ))!.n;
}
export async function createUser(input: {
  username: unknown;
  display_name: unknown;
  role: unknown;
  password: unknown;
}) {
  const username = validateUsername(input.username),
    name = validateName(input.display_name),
    role = validateRole(input.role),
    password = validatePassword(input.password);
  await db();
  const id = randomUUID();
  try {
    await run(
      "INSERT INTO users(id,username,display_name,role,password_hash,created_at) VALUES(?,?,?,?,?,?)",
      id,
      username,
      name,
      role,
      hashPassword(password),
      new Date().toISOString(),
    );
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("มีชื่อผู้ใช้นี้แล้ว", 409);
    throw e;
  }
  return id;
}
async function getUser(id: unknown) {
  const u =
    typeof id === "string" &&
    (await get<User>(`SELECT ${userCols} FROM users WHERE id=?`, id));
  if (!u) throw new AppError("ไม่พบผู้ใช้", 404);
  return u;
}
// Admin changes. An admin cannot lock themselves out, and the system always
// keeps at least one active admin.
export async function updateUser(
  self: User,
  input: {
    id: unknown;
    display_name?: unknown;
    role?: unknown;
    disabled?: unknown;
    password?: unknown;
  },
) {
  await db();
  return transaction(async () => {
    const u = await getUser(input.id);
    const role = input.role === undefined ? u.role : validateRole(input.role);
    const disabled =
      input.disabled === undefined ? !!u.disabled : input.disabled === true;
    if (u.id === self.id && (role !== "admin" || disabled))
      throw new AppError("เปลี่ยนบทบาทหรือปิดบัญชีของตัวเองไม่ได้", 409);
    if (
      u.role === "admin" &&
      !u.disabled &&
      (role !== "admin" || disabled) &&
      (await countActiveAdmins()) <= 1
    )
      throw new AppError("ต้องมี Admin ที่ใช้งานได้อย่างน้อย 1 บัญชี", 409);
    const name =
      input.display_name === undefined
        ? u.display_name
        : validateName(input.display_name);
    await run(
      "UPDATE users SET display_name=?,role=?,disabled=? WHERE id=?",
      name,
      role,
      disabled ? 1 : 0,
      u.id,
    );
    if (input.password !== undefined)
      await run(
        "UPDATE users SET password_hash=? WHERE id=?",
        hashPassword(validatePassword(input.password)),
        u.id,
      );
    // Role, status or password changes end that user's open sessions.
    if (
      role !== u.role ||
      disabled !== !!u.disabled ||
      input.password !== undefined
    )
      await run("DELETE FROM auth_sessions WHERE user_id=?", u.id);
  });
}
export async function deleteUser(self: User, id: unknown) {
  await db();
  return transaction(async () => {
    const u = await getUser(id);
    if (u.id === self.id) throw new AppError("ลบบัญชีของตัวเองไม่ได้", 409);
    if (u.role === "admin" && !u.disabled && (await countActiveAdmins()) <= 1)
      throw new AppError("ต้องมี Admin ที่ใช้งานได้อย่างน้อย 1 บัญชี", 409);
    await run("DELETE FROM users WHERE id=?", u.id);
  });
}

export async function login(username: unknown, password: unknown) {
  await db();
  const u =
    typeof username === "string"
      ? await get<User & { password_hash: string }>(
          `SELECT ${userCols},password_hash FROM users WHERE username=?`,
          username.trim().toLowerCase(),
        )
      : undefined;
  const ok = verifyPassword(
    typeof password === "string" ? password : "",
    u?.password_hash ?? dummyHash,
  );
  if (!u || !ok || u.disabled)
    throw new AppError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
  const now = Date.now(),
    token = randomBytes(32).toString("hex");
  await run("DELETE FROM auth_sessions WHERE expires_at < ?", now);
  await run(
    "INSERT INTO auth_sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)",
    randomUUID(),
    u.id,
    sha(token),
    now + IDLE,
    now,
    now,
  );
  return token;
}
export async function logout(token?: string) {
  if (!token) return;
  await db();
  await run("DELETE FROM auth_sessions WHERE token_hash=?", sha(token));
}
// Signed-in user for a cookie token; sessions end after LOGIN_IDLE_HOURS
// without use. last_seen_at is written at most once a minute.
export async function currentUser(token?: string): Promise<User> {
  if (!token || !/^[0-9a-f]{64}$/.test(token))
    throw new AppError("กรุณาเข้าสู่ระบบ", 401);
  await db();
  const now = Date.now();
  const row = await get<User & { sid: string; last_seen_at: number }>(
    `SELECT u.${userCols.split(",").join(",u.")},s.id sid,s.last_seen_at FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`,
    sha(token),
    now,
  );
  if (!row || row.disabled)
    throw new AppError("หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง", 401);
  if (now - row.last_seen_at > 60000)
    await run(
      "UPDATE auth_sessions SET last_seen_at=?,expires_at=? WHERE id=?",
      now,
      now + IDLE,
      row.sid,
    );
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    disabled: row.disabled,
    created_at: row.created_at,
  };
}
