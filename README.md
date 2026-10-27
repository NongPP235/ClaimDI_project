# Claim Di

เว็บสาธิตการตรวจแฟ้มก่อนส่งเคลม ใช้ข้อมูลและผล AI จำลอง แต่บันทึกสถานะลงฐานข้อมูล Postgres จริง (Supabase เมื่อขึ้นเว็บ, PGlite ในเครื่อง)

## เปิดในเครื่อง

ต้องใช้ Node.js 24 ขึ้นไป ในเครื่องไม่ต้องติดตั้งฐานข้อมูลเพิ่ม: ถ้าไม่ได้ตั้ง `DATABASE_URL` ระบบใช้ PGlite (Postgres ที่รันในตัว) เก็บไว้ที่ `data/pglite`

```powershell
npm ci
npm run dev
```

ถ้าเคยใช้รุ่นก่อนที่เก็บข้อมูลใน `data/claimdi.sqlite` ย้ายบัญชีและเคสเดิมมาได้ด้วย `npm run import-sqlite` (ทำครั้งเดียว ทุกคนต้องเข้าสู่ระบบใหม่)

ครั้งแรกให้สร้างบัญชี Admin (ถามรหัสผ่านแบบไม่แสดงบนจอ):

```powershell
npm run create-admin -- admin "ชื่อของคุณ"
```

เปิด http://127.0.0.1:3000 แล้วกด “เข้าสู่ระบบเพื่อทดลอง” ฐานข้อมูลสร้างอัตโนมัติที่ `data/pglite` จากนั้น Admin สร้างบัญชีบทบาทอื่นได้ที่เมนู “ผู้ใช้งาน” ไม่ต้องใส่ API key

ทุกบัญชีใช้ข้อมูลเคสชุดเดียวกัน Admin เห็นทุกหน้า บทบาทอื่นเห็นรายการเคสกับสถานะ และหน้างานของตัวเอง (ตารางสิทธิ์อยู่ใน `PROJECT_PLAN.md` §14) การเข้าสู่ระบบหมดอายุเมื่อไม่ใช้งาน 12 ชั่วโมง

## เส้นทางทดลอง

1. Admin สร้างบัญชีเจ้าหน้าที่ แพทย์ CFO และวิศวกร AI ที่เมนู “ผู้ใช้งาน”
2. เจ้าหน้าที่เปิดเคสแนะนำ DEMO-001 ตรวจ ดูหลักฐาน สร้างข้อเสนอ และส่งให้แพทย์ แต่ละประเด็นบอกมูลค่าที่เสี่ยงถูกปฏิเสธ และทุกบทบาทเห็นแถบ “ป้องกันเงินถูกปฏิเสธได้แล้ว” ที่หน้ารายการเคส
3. แพทย์เข้าสู่ระบบอีกเบราว์เซอร์ เห็นเคสในงานรอแพทย์ แล้วยืนยันหรือส่งกลับพร้อมเหตุผล
4. แพทย์หรือเจ้าหน้าที่เปิดเมนู “พร้อมส่งประกัน” ดูเคสที่ยืนยันแล้วและเคสที่ส่งกลับพร้อมเหตุผล แล้วส่งออกไฟล์เป็นเอกสารพิมพ์/PDF, Excel (CSV) หรือ JSON
5. CFO เปิดภาพรวมการเงิน เห็นแพ็กเกจที่ใช้ มูลค่าเคสตามสถานะจริง และมูลค่าที่ช่วยป้องกันได้ (ปรับอัตราการถูกปฏิเสธที่สมมติได้) วิศวกร AI ทดลองกฎ v2.0 และตรวจ Data Drift ที่สถานะโมเดล Admin ดูสถิติการทำงานที่เมนู “สถิติการทำงาน”
6. เจ้าหน้าที่หรือ Admin เปิด “นำเข้าจาก HIS” เลือกไฟล์ 16 แฟ้ม (หรือกดใช้ไฟล์ตัวอย่างใน `samples/his-16`) ตรวจไฟล์ แล้วนำเข้าเป็นเคสใหม่
7. DEMO-006 จำลอง error ครั้งแรกและลองใหม่ได้ Admin รีเซ็ตข้อมูลตัวอย่างได้ (มีผลกับทุกบัญชี)

## คำสั่งตรวจสอบ

```powershell
npm run typecheck
npm test
npm run build
npm run test:critical
node scripts/http-smoke.mjs
```

`npm run test:critical` ทดสอบ critical flow ผ่าน HTTP 11 ขั้น: เว็บและฐานข้อมูลพร้อม → ล็อกอิน → Admin สร้างบัญชี → นำเข้า HIS → ตรวจเคส → ส่งแพทย์ → ตรวจสิทธิ์ → แพทย์ยืนยัน → ส่งออก → ยอดที่ป้องกันได้เพิ่ม → ข้อมูลยังอยู่หลังล็อกอินใหม่ ใช้กับเว็บบน Vercel ได้ด้วย (`TEST_URL`) ดูขั้นตอนและเช็กลิสต์ทดสอบด้วยมือใน `DEPLOY.md`

HTTP smoke ต้องมี server รันอยู่และบัญชี Admin (`TEST_ADMIN_USER`, `TEST_ADMIN_PASSWORD`) สคริปต์สร้างบัญชีทดสอบชั่วคราว เดิน workflow ทุกบทบาท แล้วรีเซ็ตข้อมูลเคสและลบบัญชีทดสอบ จึงควรรันกับฐานข้อมูลแยก เช่น `PGLITE_DIR=./data/smoke` ตั้ง `TEST_URL` หากใช้พอร์ตอื่น

## โครงสร้าง

- `app/`: หน้าแรก หน้า workspace (`app/demo/layout.tsx`) และ API
- `components/workspace.tsx`: โครงหน้า เมนูตามบทบาท การโหลดข้อมูล toast และ dialog
- `components/login-form.tsx`, `components/admin/users.tsx`: หน้าเข้าสู่ระบบและจัดการผู้ใช้
- `lib/auth.ts`, `lib/permissions.ts`, `lib/http.ts`: บัญชี/รหัสผ่าน, ตารางสิทธิ์ และการตรวจคำขอฝั่ง server
- `scripts/create-admin.ts`: สร้างหรือกู้บัญชี Admin
- `components/ui/`: badge, รูปแบบตัวเลข/วันที่ และตารางข้อมูลประกอบกราฟ
- `components/claims/`: รายการเคส/คิวแพทย์ หน้าตรวจเคส/แพทย์ตรวจทาน และหน้าพร้อมส่งประกัน (`claims-out.tsx`)
- `lib/claim-export.ts`: สร้างข้อมูลส่งออก CSV/JSON และข้อมูลเอกสารพิมพ์
- `lib/drift.ts`: ข้อมูลจำลองและการคำนวณ PSI สำหรับ Data Drift
- `lib/stats.ts`, `components/admin/stats.tsx`, `/api/stats`: สถิติการทำงาน (Admin)
- `components/claims/case-values.tsx`: มูลค่าเคสตามสถานะจริง
- `components/finance/prevented.tsx`: มูลค่าที่ช่วยป้องกันได้ (ประมาณการ)
- `lib/his.ts`, `components/claims/his-import.tsx`, `/api/import`: นำเข้า 16 แฟ้มจาก HIS และกฎตรวจไฟล์ (PROJECT_PLAN §19)
- `lib/value.ts`, `components/claims/protected-banner.tsx`: มูลค่าเสี่ยงรายประเด็นและแถบมูลค่าที่ป้องกันได้ (PROJECT_PLAN §18)
- `components/finance/`, `components/mlops/`: หน้า CFO และสถานะโมเดล
- `app/globals.css`: design tokens, component styles และ responsive layouts
- `lib/sql.ts`: การเชื่อมต่อฐานข้อมูล (Postgres ผ่าน `DATABASE_URL` หรือ PGlite ในเครื่อง) และ transaction
- `lib/db.ts`: schema Postgres, migration, shared workspace และ workflow
- `lib/scenarios.ts`: เอกสารและผลจำลอง 6 เคส
- `lib/calculator.ts`: สูตรแพ็กเกจ/ส่วนลด/ROI
- `tests/`: ทดสอบสูตร, workflow, ประวัติบทบาท, อายุ session, schema/RLS และการแก้เคสพร้อมกัน
- `scripts/critical-flow.ts`: ทดสอบ critical flow ผ่าน HTTP
- `scripts/backup.ts`, `scripts/import-sqlite.ts`: สำรองเป็น JSON และย้ายข้อมูลจาก SQLite รุ่นเดิมหรือจาก backup

API: `/api/demo` (ข้อมูลเคส ตรวจบทบาททุกการกระทำ), `/api/auth` (login/logout), `/api/users` (Admin) และ `/api/health` ใช้ตรวจความพร้อม

## การนำขึ้นโฮสต์ (Vercel + Supabase)

ขั้นตอนเต็มอยู่ใน `DEPLOY.md` สรุป:

- Supabase: สร้างโปรเจกต์ (แนะนำภูมิภาค Singapore) คัดลอก URI แบบ Transaction pooler (port 6543)
- สร้าง Admin บน Supabase จากเครื่อง: ตั้ง `DATABASE_URL` แล้วรัน `npm run create-admin` (คำสั่งนี้สร้างตารางให้ด้วย)
- Vercel: import repo จาก GitHub ตั้ง `DATABASE_URL` ใน Environment Variables และตั้ง Function Region เป็น Singapore (sin1)
- หลัง deploy รัน `npm run test:critical` กับ URL จริง

ตารางทุกตารางเปิด Row Level Security โดยไม่มี policy จึงอ่านผ่าน API key สาธารณะของ Supabase ไม่ได้ แอปเชื่อมต่อด้วยบัญชีเจ้าของตาราง ห้ามนำรหัสผ่านฐานข้อมูลไปใส่ในโค้ดหรือ commit

Rate limit ยังเป็น in-memory ต่อ instance บน Vercel แต่ละ instance นับแยกกัน

## สำรองและกู้คืน

```powershell
npm run backup
```

บันทึกทุกตาราง (ยกเว้น session การเข้าสู่ระบบ) เป็น JSON ใน `backups/` อ่านจาก `DATABASE_URL` ถ้าตั้งไว้ ไม่เขียนทับไฟล์เดิม กู้คืนลงฐานข้อมูลว่างด้วย `npm run import-sqlite -- --json backups/ไฟล์.json` (เพิ่ม `--replace` เพื่อลบข้อมูลเดิมก่อน) Supabase แบบเสียเงินมี backup รายวันของตัวเองด้วย

ระบบลบ session ที่หมดอายุพร้อมข้อมูลลูกเมื่อสร้าง session ใหม่ และระหว่างใช้งานไม่เกินชั่วโมงละครั้ง

## Migration

`lib/db.ts` สร้าง schema รุ่น 1 ของ Postgres (เทียบเท่า SQLite รุ่น 6 เดิม) แล้วรัน migration ที่ยังไม่เคยรันตามลำดับเลขใน transaction เดียว พร้อม advisory lock กันหลาย instance รันพร้อมกัน ห้ามแก้ migration เดิม ให้เพิ่มรุ่นใหม่ และสำรองด้วย `npm run backup` ก่อน deploy รุ่นที่เปลี่ยน schema

## ขอบเขตและข้อแตกต่างจากแผน

- ฐานข้อมูลเป็น Postgres (`pg`) และ PGlite ในเครื่อง ไม่มี native dependency; `node:sqlite` ใช้เฉพาะตอนย้ายข้อมูลจากไฟล์ SQLite เดิม
- ใช้ CSS tokens และ native controls/dialog แทน Tailwind/shadcn ในรุ่นแรก; กราฟตัวอย่างใช้ SVG/CSS พร้อมคำอธิบายข้อมูลแทน Recharts
- ร่างข้อเสนอเป็นข้อความที่เตรียมไว้ ยังไม่มี editor เวชระเบียนจริง
- API รวมเป็น route เดียวต่อกลุ่มงาน
- ไม่มี AI/OCR จริง การส่งเคลมจริง หรือระบบบัญชีโรงพยาบาล
- Rate limit เป็น in-memory สำหรับหนึ่ง instance ไม่ใช่ระบบป้องกัน abuse ระดับ production
- รอบทดลองหมดอายุเมื่อไม่ใช้งาน 7 วัน (เลื่อนอายุไม่เกินชั่วโมงละครั้ง) ล้าง session หมดอายุไม่เกินชั่วโมงละครั้งระหว่างใช้งาน
- ข้อเสนอแก้ไขยังเป็นข้อความที่เตรียมไว้ ไม่เปิดให้พิมพ์เอง เพราะแผนกำหนดไม่รับข้อความเวชระเบียนจากผู้ชม
- การอนุมัติเคสไม่เพิ่มยอดรับชำระในกราฟ ตัวเลขกราฟเป็น fixture แยกต่างหาก

ดูแผนประกอบใน `PROJECT_PLAN.md`, `UX_UI_PLAN.md`, `DESIGN_SYSTEM.md` และผลตรวจจริงใน `VERIFICATION.md`
