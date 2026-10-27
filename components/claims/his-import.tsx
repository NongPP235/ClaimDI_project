"use client";
import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  FileUp,
  Info,
} from "lucide-react";
import { fileKind, usedFiles, MAX_CHARS, type HisInput } from "@/lib/his";
import { hisSample } from "@/lib/his-sample";
import { caseRisk, protectedValue } from "@/lib/value";
import { money } from "@/components/ui/format";
import type { Data } from "./types";

type Preview = {
  imported: number;
  errors: string[];
  warnings: string[];
  files: string[];
  cases: {
    code: string;
    visit: string;
    diagnosis: string;
    payer: string;
    amount: number;
    findings: { title: string; atRisk: number }[];
    duplicate: boolean;
  }[];
};

// HIS exports are often TIS-620 / windows-874 rather than UTF-8.
async function readText(file: File) {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-874").decode(buf);
  }
}

// Import from HIS (/demo/import), Admin and coders: PROJECT_PLAN.md §19.
export default function HisImport({
  data,
  onImported,
}: {
  data: Data;
  onImported: () => Promise<void> | void;
}) {
  const [files, setFiles] = useState<HisInput>({}),
    [ignored, setIgnored] = useState<string[]>([]),
    [sample, setSample] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(0);

  async function choose(list: FileList | null) {
    if (!list?.length) return;
    const next: HisInput = {},
      skip: string[] = [];
    for (const f of Array.from(list)) {
      const kind = fileKind(f.name);
      if (!kind) skip.push(f.name);
      else next[kind] = await readText(f);
    }
    setFiles(next);
    setIgnored(skip);
    setSample(false);
    setPreview(null);
    setDone(0);
    setError("");
  }
  function useSample() {
    setFiles(hisSample);
    setIgnored([]);
    setSample(true);
    setPreview(null);
    setDone(0);
    setError("");
  }
  async function send(action: "preview" | "import") {
    const size = Object.values(files).reduce((s, t) => s + (t?.length ?? 0), 0);
    if (size > MAX_CHARS) {
      setError("ไฟล์รวมกันใหญ่เกิน 2 ล้านตัวอักษร แบ่งนำเข้าทีละช่วงวันที่");
      return;
    }
    setBusy(action);
    setError("");
    try {
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, files }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(d.error || "นำเข้าไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPreview(d);
      if (action === "import") {
        setDone(d.imported);
        await onImported();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const chosen = Object.keys(files);
  const fresh = preview?.cases.filter((c) => !c.duplicate) ?? [];
  const risk = (c: Preview["cases"][number]) =>
    caseRisk(c.findings, { amount: c.amount } as never);
  const totalRisk = fresh.reduce((s, c) => s + risk(c), 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">HIS IMPORT · 16 แฟ้ม</p>
          <h1>นำเข้าจาก HIS</h1>
          <p>
            นำไฟล์ส่งออกเบิกจ่ายจากระบบของโรงพยาบาลมาสร้างเคส
            แล้วตรวจก่อนส่งเบิกด้วยขั้นตอนเดิม
          </p>
        </div>
        <span className="workspace-tag">
          <DatabaseZap size={15} aria-hidden="true" />
          Admin และเจ้าหน้าที่
        </span>
      </div>

      <div className="notice import-notice" role="note">
        <AlertTriangle size={17} aria-hidden="true" />
        <div>
          <strong>ระบบสาธิต: ควรใช้ข้อมูลที่ไม่ระบุตัวตน</strong>
          <p className="small">
            ระบบปิดชื่อ นามสกุล และเลขบัตร 13 หลักก่อนบันทึก และแสดง HN แค่ 3
            ตัวท้าย แต่ยังไม่ได้ผ่านการประเมินตาม PDPA รูปแบบ 16
            แฟ้มเขียนจากความรู้ทั่วไป ยังไม่ได้ตรวจกับประกาศล่าสุดของแต่ละกองทุน
            ควรให้เจ้าหน้าที่เวชระเบียนหรือฝ่ายเรียกเก็บช่วยยืนยัน
          </p>
        </div>
      </div>

      <div className="import-grid">
        <section className="import-pick" aria-labelledby="pick-title">
          <h2 id="pick-title" className="section-title">
            1. เลือกไฟล์
          </h2>
          <label className="file-drop">
            <FileUp size={26} aria-hidden="true" />
            <span>
              เลือกไฟล์ .txt จาก HIS ได้หลายไฟล์พร้อมกัน
              <small>
                คั่นคอลัมน์ด้วย | แถวแรกเป็นชื่อคอลัมน์ รองรับ UTF-8 และ TIS-620
              </small>
            </span>
            <input
              type="file"
              multiple
              accept=".txt,.csv,text/plain"
              onChange={(e) => choose(e.target.files)}
            />
          </label>
          <button
            className="text-button"
            type="button"
            onClick={useSample}
            disabled={!!busy}
          >
            หรือใช้ไฟล์ตัวอย่าง (4 เคส ข้อมูลสมมติ)
          </button>
          {chosen.length > 0 && (
            <p className="small" aria-live="polite">
              {sample ? "ไฟล์ตัวอย่าง: " : "พบแฟ้ม: "}
              {chosen.join(", ")}
              {ignored.length > 0 &&
                ` · ข้ามไฟล์ที่ไม่รู้จัก: ${ignored.join(", ")}`}
            </p>
          )}
          <button
            className="button primary"
            disabled={!chosen.length || !!busy}
            onClick={() => send("preview")}
          >
            {busy === "preview" ? "กำลังตรวจไฟล์…" : "ตรวจไฟล์"}
          </button>
        </section>

        <section className="import-files" aria-labelledby="files-title">
          <h2 id="files-title" className="section-title">
            แฟ้มที่ระบบอ่าน
          </h2>
          <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th scope="col">แฟ้ม</th>
                  <th scope="col">ต้องมี</th>
                  <th scope="col">ใช้ทำอะไร</th>
                </tr>
              </thead>
              <tbody>
                {usedFiles.map((f) => (
                  <tr key={f.file}>
                    <th scope="row">{f.file}</th>
                    <td>{f.need}</td>
                    <td>{f.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            แฟ้มอื่นใน 16 แฟ้ม (ORF, IRF, CHT, AER, ADP, LVD, DRU)
            รับได้แต่ยังไม่ใช้ แฟ้ม SUMMARY เป็นแฟ้มเสริมของ Claim Di คอลัมน์ AN
            หรือ SEQ, SUMMARY และ LAB ไฟล์ตัวอย่างอยู่ในโฟลเดอร์ samples/his-16
          </p>
        </section>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {preview && (
        <section className="import-preview" aria-labelledby="preview-title">
          <h2 id="preview-title" className="section-title">
            2. ตรวจผลก่อนนำเข้า
          </h2>
          {preview.errors.length > 0 && (
            <ul className="import-errors" role="alert">
              {preview.errors.map((e) => (
                <li key={e}>
                  <AlertTriangle size={15} aria-hidden="true" /> {e}
                </li>
              ))}
            </ul>
          )}
          {preview.warnings.length > 0 && (
            <ul className="import-warnings">
              {preview.warnings.map((w) => (
                <li key={w}>
                  <Info size={15} aria-hidden="true" /> {w}
                </li>
              ))}
            </ul>
          )}
          {preview.cases.length > 0 && (
            <>
              <p className="import-summary">
                พบ {preview.cases.length} เคส · ใหม่ {fresh.length} เคส ·
                มูลค่าเสี่ยงถูกปฏิเสธ <strong>฿{money(totalRisk)}</strong>{" "}
                แก้ก่อนส่งช่วยป้องกันได้ประมาณ ฿
                {money(protectedValue(totalRisk, data.denialRate))}
              </p>
              <div className="table-scroll">
                <table className="stats-table import-table">
                  <thead>
                    <tr>
                      <th scope="col">เคส</th>
                      <th scope="col">วินิจฉัยหลัก</th>
                      <th scope="col">สิทธิ</th>
                      <th scope="col" className="num">
                        ยอดตั้งเบิก
                      </th>
                      <th scope="col">ประเด็นจากกฎตรวจไฟล์</th>
                      <th scope="col" className="num">
                        เสี่ยง
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.cases.map((c) => (
                      <tr key={c.code} className={c.duplicate ? "muted" : ""}>
                        <th scope="row">
                          {c.code}
                          <small>
                            {c.visit}
                            {c.duplicate && " · นำเข้าไว้แล้ว จะข้าม"}
                          </small>
                        </th>
                        <td>{c.diagnosis}</td>
                        <td>{c.payer}</td>
                        <td className="num">฿{money(c.amount)}</td>
                        <td>
                          {c.findings.length
                            ? c.findings.map((f) => f.title).join(" · ")
                            : "ไม่พบประเด็น"}
                        </td>
                        <td className="num">฿{money(risk(c))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {done > 0 ? (
            <div className="notice import-done" role="status">
              <CheckCircle2 size={17} aria-hidden="true" />
              <div>
                <strong>นำเข้าแล้ว {done} เคส</strong>
                <p className="small">
                  เคสอยู่ในรายการเคสสถานะ “ยังไม่ตรวจ” เปิดเคสแล้วกดตรวจ
                  จะเห็นประเด็นและมูลค่าเสี่ยง
                  การรีเซ็ตข้อมูลตัวอย่างจะลบเคสที่นำเข้าด้วย
                </p>
                <Link className="button secondary" href="/demo">
                  ไปที่รายการเคส
                </Link>
              </div>
            </div>
          ) : (
            !preview.errors.length &&
            fresh.length > 0 && (
              <button
                className="button primary"
                disabled={!!busy}
                onClick={() => send("import")}
              >
                {busy === "import"
                  ? "กำลังนำเข้า…"
                  : `นำเข้า ${fresh.length} เคส`}
              </button>
            )
          )}
        </section>
      )}
    </>
  );
}
