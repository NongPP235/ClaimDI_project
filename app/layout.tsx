import type { Metadata } from "next";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Claim Di — ตรวจทานก่อนส่งเคลม",
  description: "ทดลองกระบวนการตรวจแฟ้มและส่งให้แพทย์ตรวจทานด้วยข้อมูลจำลอง",
  openGraph: {
    title: "Claim Di — ตรวจทานให้ชัดก่อนส่งเคลม",
    description:
      "เว็บสาธิต: ตรวจแฟ้มก่อนส่งเคลม พร้อมขั้นตอนให้แพทย์ตรวจทาน ใช้ข้อมูลและผลวิเคราะห์จำลอง",
    type: "website",
    locale: "th_TH",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <a className="skip" href="#main">
          ข้ามไปเนื้อหา
        </a>
        {children}
      </body>
    </html>
  );
}
