import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/login-form";
export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | Claim Di",
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
