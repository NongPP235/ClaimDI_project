import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { money } from "@/components/ui/format";
import { canView } from "@/lib/permissions";
import { protectedValue } from "@/lib/value";
import type { Data } from "./types";

// Headline figure on the case list for every role (PROJECT_PLAN.md §18):
// value kept by fixing issues before submission, and what still waits on
// a doctor. Totals come from the server, so list-only roles see them too.
export default function ProtectedBanner({ data }: { data: Data }) {
  const rate = data.denialRate,
    done = protectedValue(data.prevented.amount, rate),
    pending = protectedValue(data.pending.amount, rate);
  return (
    <section className="protected-banner" aria-labelledby="protected-title">
      <ShieldCheck size={26} aria-hidden="true" />
      <div className="protected-main">
        <h2 id="protected-title">ป้องกันเงินถูกปฏิเสธได้แล้ว</h2>
        <strong className="num">฿{money(done)}</strong>
        <span>
          {data.prevented.cases
            ? `${data.prevented.cases} เคส · แก้ ${data.prevented.findings} ประเด็นก่อนส่ง · แพทย์ยืนยันแล้ว`
            : "ยังไม่มีเคสที่แก้ประเด็นและแพทย์ยืนยัน"}
        </span>
      </div>
      <div className="protected-pending">
        <span>รอแก้และแพทย์ยืนยันอีก</span>
        <strong className="num">฿{money(pending)}</strong>
        <span>{data.pending.cases} เคสที่พบประเด็น</span>
      </div>
      <p className="protected-note small">
        ประมาณการ: มูลค่าเสี่ยงรายประเด็น × อัตราถูกปฏิเสธที่สมมติ {rate}%
        {canView(data.user.role, "finance") && (
          <>
            {" · "}
            <Link href="/demo/finance">ดูวิธีคำนวณ</Link>
          </>
        )}
      </p>
    </section>
  );
}
