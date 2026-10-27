import Workspace from "@/components/workspace";
export const metadata = {
  title: "พื้นที่ทดลอง | Claim Di",
  robots: { index: false, follow: false },
};
// The workspace lives in the layout so session data, toasts and dialogs
// survive moves between /demo routes instead of reloading on each one.
export default function DemoLayout() {
  return <Workspace />;
}
