import Link from "next/link";
import {
  ArrowRight,
  FileCheck2,
  ScanLine,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { scenarios } from "@/lib/scenarios";
import { caseRisk, protectedValue } from "@/lib/value";
import { money } from "@/components/ui/format";

// Worked example for the landing story (PROJECT_PLAN.md §18), computed
// from the same demo fixture and formula the workspace uses.
const example = scenarios.find((s) => s.code === "DEMO-001")!,
  exampleRisk = caseRisk(example.findings, example),
  exampleRate = 30;
export default function Home() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand">
          <img className="brand-logo" src="/claimdi-logo.png" alt="Claim Di" />
          <span className="brand-caption">PRE-CLAIM WORKSPACE</span>
        </Link>
        <a href="#how">
          วิธีทำงาน <ArrowUpRight size={16} />
        </a>
      </nav>
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="live-dot" /> A LITTLE CLARITY. A BETTER CLAIM.
            </p>
            <h1>
              Claim Di
              <span>
                ตรวจก่อนส่ง
                <br />
                ป้องกันเงินถูกปฏิเสธ
              </span>
            </h1>
            <p className="hero-description">
              หาประเด็นที่ทำให้เคลมถูกปฏิเสธ บอกมูลค่าที่เสี่ยงทุกประเด็น
              <br />
              ให้เจ้าหน้าที่แก้และแพทย์ยืนยันก่อนส่งประกัน
            </p>
            <Link className="button primary" href="/login">
              เข้าสู่ระบบเพื่อทดลอง <ArrowUpRight size={18} />
            </Link>
            <p className="hero-note">
              ใช้บัญชีที่ผู้ดูแลระบบสร้างให้ · ใช้ข้อมูลและผลวิเคราะห์จำลอง
            </p>
          </div>
          <div
            className="hero-art"
            aria-label="ภาพประกอบการตรวจเอกสารและยืนยันข้อเสนอ"
          >
            <div className="orb" />
            <div className="art-label">FROM RECORD TO REVIEW</div>
            <div className="paper-illustration">
              <div className="paper-top">
                <FileCheck2 size={27} />
                <span>
                  CLINICAL RECORD
                  <br />
                  <small>เอกสารตัวอย่าง / 001</small>
                </span>
                <span className="paper-tag">IPD</span>
              </div>
              <div className="paper-lines">
                <i />
                <i />
                <i />
              </div>
              <div className="evidence-preview">
                <span>01</span>
                <div>
                  หลักฐานจากเอกสาร
                  <small>เชื่อมข้อมูลกับข้อเสนอที่ตรวจทานได้</small>
                </div>
                <ScanLine size={22} />
              </div>
              <div className="paper-lines short">
                <i />
                <i />
              </div>
              <div className="paper-approval">
                <span className="check-disc">
                  <Check size={23} />
                </span>
                <div>
                  พร้อมให้แพทย์ตรวจทาน<small>ทุกข้อเสนอมีคนยืนยัน</small>
                </div>
                <ArrowRight size={21} />
              </div>
            </div>
            <div className="art-bottom">
              01 / DOCUMENT　 →　 02 / REVIEW　 →　 03 / CONFIRM
            </div>
          </div>
        </section>
        <section className="value-story" aria-labelledby="value-title">
          <div className="value-story-copy">
            <p className="eyebrow">PROTECTED VALUE</p>
            <h2 id="value-title">
              ทุกประเด็นที่แก้ก่อนส่ง
              <br />
              คือเงินที่ไม่ถูกปฏิเสธ
            </h2>
            <p>
              ระบบบอกว่าแต่ละประเด็นเสี่ยงเงินเท่าไร
              และรวมเป็นมูลค่าที่ป้องกันได้ให้ทุกบทบาทเห็นตรงกัน
              ตั้งแต่เจ้าหน้าที่ แพทย์ จนถึงผู้บริหาร
            </p>
          </div>
          <div className="value-example">
            <div className="value-example-head">
              <span>
                ตัวอย่าง {example.code} · {example.title}
              </span>
              <span className="data-demo-label">ข้อมูลจำลอง</span>
            </div>
            <p className="small muted">ยอดตั้งเบิก ฿{money(example.amount)}</p>
            <ul>
              {example.findings.map((f) => (
                <li key={f.title}>
                  <span>{f.title}</span>
                  <span className="risk-chip">เสี่ยง ฿{money(f.atRisk)}</span>
                </li>
              ))}
            </ul>
            <dl>
              <div>
                <dt>มูลค่าเสี่ยงถูกปฏิเสธ</dt>
                <dd>฿{money(exampleRisk)}</dd>
              </div>
              <div>
                <dt>× อัตราถูกปฏิเสธที่สมมติ</dt>
                <dd>{exampleRate}%</dd>
              </div>
              <div className="value-example-total">
                <dt>ป้องกันได้ประมาณ</dt>
                <dd>฿{money(protectedValue(exampleRisk, exampleRate))}</dd>
              </div>
            </dl>
            <p className="small muted">
              ค่าประมาณจากสมมติฐานของระบบสาธิต ไม่ใช่ผลเคลมจริง
            </p>
          </div>
        </section>
        <section id="how" className="how">
          <div>
            <p className="eyebrow">A CLEARER WORKFLOW</p>
            <h2>
              จากแฟ้มหนึ่งชุด
              <br />
              สู่การตรวจทานที่เป็นขั้นตอน
            </h2>
          </div>
          <div className="how-steps">
            {[
              [
                "01",
                "เลือกเคสตัวอย่าง",
                "เปิดเอกสารและดูข้อมูลตั้งต้นในพื้นที่ทดลองร่วม",
              ],
              [
                "02",
                "เห็นประเด็นและมูลค่าที่เสี่ยง",
                "ตรวจหลักฐาน แก้ข้อเสนอ แล้วส่งให้แพทย์ตรวจทาน",
              ],
              [
                "03",
                "ยืนยันแล้วนับเป็นเงินที่ป้องกันได้",
                "แพทย์ยืนยันหรือส่งกลับ ตัวเลขป้องกันได้อัปเดตทันที",
              ],
            ].map(([n, title, body]) => (
              <div key={n}>
                <span>{n}</span>
                <section>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </section>
                <ArrowUpRight size={21} />
              </div>
            ))}
          </div>
        </section>
        <section className="landing-end">
          <div>
            <p className="eyebrow">ROLE-BASED WORKSPACE</p>
            <h2>ลองเดินผ่านขั้นตอนด้วยตัวเอง</h2>
            <p>
              แต่ละบทบาทเห็นรายการเคส สถานะ และงานในส่วนที่รับผิดชอบ
              ผู้ดูแลระบบเห็นทุกส่วน
            </p>
          </div>
          <Link className="button primary" href="/login">
            เข้าสู่ระบบเพื่อทดลอง <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
      <footer>
        <img
          className="brand-logo small"
          src="/claimdi-logo.png"
          alt="Claim Di"
        />
        <span>ระบบสาธิตเท่านั้น ไม่ใช้สำหรับการวินิจฉัยหรือส่งเคลมจริง</span>
        <span>PROJECT DEMO · 2026</span>
      </footer>
    </div>
  );
}
