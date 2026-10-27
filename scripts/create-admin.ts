// Create the first Admin, or reset an existing account to Admin with a new
// password: npm run create-admin -- <username> [display name]
// It writes to DATABASE_URL (Supabase) when set, otherwise local data/pglite.
// The password is read from ADMIN_PASSWORD or typed at a hidden prompt.
import { createInterface } from "node:readline";
import { db } from "../lib/db.ts";
import { closeDb, get, run } from "../lib/sql.ts";
import {
  createUser,
  hashPassword,
  validatePassword,
  validateUsername,
} from "../lib/auth.ts";

// One readline for both questions so piped input works too; typed
// characters are not echoed.
const rl = createInterface({ input: process.stdin, output: process.stdout });
let muted = false;
(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (
  s: string,
) => {
  if (!muted) process.stdout.write(s);
};
const lines = rl[Symbol.asyncIterator]();
async function ask(question: string): Promise<string> {
  muted = false;
  process.stdout.write(question);
  muted = true;
  const line = await lines.next();
  muted = false;
  process.stdout.write("\n");
  return line.done ? "" : line.value;
}

const [rawName, ...nameParts] = process.argv.slice(2);
const username = rawName?.trim().toLowerCase();
try {
  validateUsername(username);
  const name = nameParts.join(" ").trim() || "ผู้ดูแลระบบ";
  let password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    password = await ask("รหัสผ่าน (อย่างน้อย 8 ตัวอักษร): ");
    if ((await ask("พิมพ์รหัสผ่านอีกครั้ง: ")) !== password)
      throw new Error("รหัสผ่านทั้งสองครั้งไม่ตรงกัน");
  }
  validatePassword(password);
  await db();
  const existing = await get<{ id: string }>(
    "SELECT id FROM users WHERE username=?",
    username,
  );
  if (existing) {
    await run(
      "UPDATE users SET role='admin',disabled=0,password_hash=? WHERE id=?",
      hashPassword(password),
      existing.id,
    );
    await run("DELETE FROM auth_sessions WHERE user_id=?", existing.id);
    console.log(`อัปเดต ${username} เป็น Admin และตั้งรหัสผ่านใหม่แล้ว`);
  } else {
    await createUser({ username, display_name: name, role: "admin", password });
    console.log(`สร้าง Admin ${username} แล้ว เข้าสู่ระบบที่ /login`);
  }
  await closeDb();
  rl.close();
} catch (e) {
  console.error((e as Error).message);
  console.error('วิธีใช้: npm run create-admin -- <username> "ชื่อที่แสดง"');
  process.exit(1);
}
rl.close();
