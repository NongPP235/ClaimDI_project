import { db } from "./db.ts";
import { all } from "./sql.ts";
import { scenarios } from "./scenarios.ts";
import { statColumns } from "./stat-columns.ts";

// Work statistics for Admin (PROJECT_PLAN.md §16), computed from the full
// review_history of the shared workspace. Seeded rows (role "system") are
// left out, and a reset starts the figures again from zero.
type Row = {
  case_id: string | null;
  action: string;
  note: string;
  created_at: string;
  simulated_role: string;
  actor_name: string;
  scenario_key: number | null;
  scenario_json: string | null;
};
const SUBMIT = "ส่งให้แพทย์ตรวจทาน",
  APPROVE = "แพทย์ยืนยันข้อเสนอ",
  RETURN = "แพทย์ส่งกลับ",
  EXPORT = "ส่งออกข้อมูลเคลม";

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b),
    m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export async function workStats(sessionId: string) {
  await db();
  const rows = await all<Row>(
    `SELECT h.case_id,h.action,h.note,h.created_at,h.simulated_role,h.actor_name,c.scenario_key,c.scenario_json
       FROM review_history h LEFT JOIN cases c ON c.id=h.case_id
       WHERE h.session_id=? AND h.simulated_role<>'system'
       ORDER BY h.created_at, h.seq`,
    sessionId,
  );
  const code = (r: Row) =>
    r.scenario_key === null
      ? ""
      : r.scenario_json
        ? JSON.parse(r.scenario_json).code
        : (scenarios[r.scenario_key]?.code ?? "");

  // Time from each submission to the doctor's decision on it.
  const pending = new Map<string, number>(),
    toApprove: number[] = [],
    toDecision: number[] = [];
  let approvals = 0,
    returns = 0;
  const reasons = new Map<string, number>();
  const people = new Map<
    string,
    { name: string; role: string; counts: Record<string, number> }
  >();
  const exports: {
    at: string;
    by: string;
    role: string;
    code: string;
    format: string;
  }[] = [];
  for (const r of rows) {
    const t = Date.parse(r.created_at);
    if (r.case_id && r.action === SUBMIT) pending.set(r.case_id, t);
    if (r.case_id && (r.action === APPROVE || r.action === RETURN)) {
      const start = pending.get(r.case_id);
      if (start !== undefined) {
        toDecision.push(t - start);
        if (r.action === APPROVE) toApprove.push(t - start);
        pending.delete(r.case_id);
      }
      if (r.action === APPROVE) approvals++;
      else {
        returns++;
        const reason = r.note.trim().replace(/\s+/g, " ");
        if (reason) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      }
    }
    const who = `${r.actor_name || "ไม่ระบุชื่อ"}\u0000${r.simulated_role}`;
    const p = people.get(who) ?? {
      name: r.actor_name || "ไม่ระบุชื่อ",
      role: r.simulated_role,
      counts: {},
    };
    p.counts[r.action] = (p.counts[r.action] ?? 0) + 1;
    people.set(who, p);
    if (r.action === EXPORT)
      exports.push({
        at: r.created_at,
        by: r.actor_name || "ไม่ระบุชื่อ",
        role: r.simulated_role,
        code: code(r),
        format: r.note,
      });
  }
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  return {
    since: rows[0]?.created_at ?? null,
    actions: rows.length,
    approval: {
      count: toApprove.length,
      avgMs: avg(toApprove),
      medianMs: median(toApprove),
      maxMs: toApprove.length ? Math.max(...toApprove) : null,
    },
    decision: { avgMs: avg(toDecision) },
    approvals,
    returns,
    returnRate: approvals + returns ? returns / (approvals + returns) : null,
    reasons: [...reasons]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
      .slice(0, 5),
    people: [...people.values()]
      .filter((p) => statColumns.some(([a]) => p.counts[a]))
      .sort((a, b) => a.name.localeCompare(b.name, "th")),
    exports: exports.reverse().slice(0, 50),
  };
}
export type WorkStats = Awaited<ReturnType<typeof workStats>>;
