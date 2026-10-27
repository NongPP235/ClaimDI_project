// Role-based access shared by the server (enforcement) and the UI (what to
// show). The server is the authority: the UI only hides what the server
// would refuse anyway. See PROJECT_PLAN.md §14.
export type UserRole = "admin" | "coder" | "doctor" | "cfo" | "engineer";
export type View =
  | "cases"
  | "case-detail"
  | "approvals"
  | "claims"
  | "finance"
  | "stats"
  | "mlops"
  | "users"
  | "import";
export type Action =
  | "analyze"
  | "proposal"
  | "submit"
  | "approve"
  | "return"
  | "export"
  | "rule"
  | "drift"
  | "package"
  | "denial_rate"
  | "reset"
  | "import";

export const roles: UserRole[] = [
  "admin",
  "coder",
  "doctor",
  "cfo",
  "engineer",
];
export const roleNames: Record<UserRole, string> = {
  admin: "ผู้ดูแลระบบ (Admin)",
  coder: "เจ้าหน้าที่ตรวจเคลม",
  doctor: "แพทย์",
  cfo: "ผู้บริหาร (CFO)",
  engineer: "วิศวกร AI",
};
export const roleShort: Record<UserRole, string> = {
  admin: "Admin",
  coder: "เจ้าหน้าที่",
  doctor: "แพทย์",
  cfo: "CFO",
  engineer: "วิศวกร AI",
};

// Every role sees the case list with statuses; the rest is its own work.
const viewAccess: Record<UserRole, View[]> = {
  admin: [
    "cases",
    "case-detail",
    "approvals",
    "claims",
    "finance",
    "mlops",
    "users",
    "stats",
    "import",
  ],
  coder: ["cases", "case-detail", "claims", "import"],
  doctor: ["cases", "approvals", "claims"],
  cfo: ["cases", "finance"],
  engineer: ["cases", "mlops"],
};
const actionAccess: Record<UserRole, Action[]> = {
  admin: [
    "analyze",
    "proposal",
    "submit",
    "approve",
    "return",
    "export",
    "rule",
    "drift",
    "package",
    "denial_rate",
    "reset",
    "import",
  ],
  coder: ["analyze", "proposal", "submit", "export", "import"],
  doctor: ["approve", "return", "export"],
  cfo: ["denial_rate"],
  engineer: ["rule", "drift"],
};

export const isRole = (v: unknown): v is UserRole =>
  typeof v === "string" && (roles as string[]).includes(v);
export const canView = (role: UserRole, view: View) =>
  viewAccess[role].includes(view);
export const canAct = (role: UserRole, action: string) =>
  (actionAccess[role] as string[]).includes(action);
// Which page opens when this role clicks a case, if any.
export function caseLink(role: UserRole, status: string) {
  if (canView(role, "case-detail")) return "cases";
  if (
    canView(role, "approvals") &&
    ["awaiting_review", "returned", "ready"].includes(status)
  )
    return "approvals";
  return null;
}
// Full case content (document, findings, proposal) is sent only to roles
// that work on that case.
export function seesCaseDetail(role: UserRole, status: string) {
  if (canView(role, "case-detail")) return true;
  return (
    canView(role, "approvals") &&
    ["awaiting_review", "returned", "ready"].includes(status)
  );
}
export function homeFor(role: UserRole) {
  return role === "doctor"
    ? "/demo/approvals"
    : role === "cfo"
      ? "/demo/finance"
      : role === "engineer"
        ? "/demo/mlops"
        : "/demo";
}
