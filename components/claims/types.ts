import type { Status, Scenario } from "@/lib/scenarios";
import { roleShort, type UserRole } from "@/lib/permissions";
export type Role = "system" | UserRole;
export type Case = {
  id: string;
  scenario_key: number;
  status: Status;
  revision: number;
  proposal: string;
  updated_at: string;
  // Roles that only see the list get code/title/status fields of the
  // scenario; full content arrives only when detail is true.
  detail: boolean;
  scenario: Scenario;
  audit: { findings_json?: string; rule_version: string } | null;
};
export type History = {
  case_id: string | null;
  action: string;
  note: string;
  created_at: string;
  simulated_role?: Role;
  revision?: number | null;
  actor_name?: string;
};
export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
};
type Totals = { cases: number; amount: number; findings: number };
export type Data = {
  user: SessionUser;
  ruleVersion: string;
  package: string;
  denialRate: number;
  prevented: Totals;
  // Audited cases with findings not yet confirmed by a doctor (§18).
  pending: Totals;
  expiresAt: number;
  cases: Case[];
  history: History[];
};
export type Act = (
  action: string,
  c?: Case,
  extra?: Record<string, unknown>,
) => Promise<boolean>;
export const roleLabels: Record<Role, string> = {
  system: "ข้อมูลตั้งต้น",
  ...roleShort,
};
