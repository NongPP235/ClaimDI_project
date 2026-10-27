import { findingsFor, type Finding, type Scenario } from "./scenarios.ts";

// Protected value, the demo's headline figure (PROJECT_PLAN.md §18).
// Each finding carries the claim amount likely denied if it reaches the
// insurer unfixed; a case's risk is their sum, never more than its claim.
// All figures are demo assumptions, not measured denial data.

// Audits saved before §18 have no atRisk, so fall back to the fixture
// finding with the same title, then to an even share of the claim.
export function findingRisk(
  f: Partial<Finding> & { title: string },
  scenario: Scenario,
  count: number,
) {
  if (typeof f.atRisk === "number") return f.atRisk;
  const known = findingsFor(scenario, "2.0").find((x) => x.title === f.title);
  return known?.atRisk ?? Math.round(scenario.amount / Math.max(count, 1));
}
export function caseRisk(findings: Partial<Finding>[], scenario: Scenario) {
  const sum = findings.reduce(
    (s, f) => s + findingRisk(f as Finding, scenario, findings.length),
    0,
  );
  return Math.min(scenario.amount, sum);
}
// Expected baht kept: the at-risk amount times the assumed denial rate.
export const protectedValue = (risk: number, rate: number) =>
  Math.round((risk * rate) / 100);

// Statuses where issues were found but a doctor has not confirmed yet.
export const pendingStatuses = [
  "needs_revision",
  "awaiting_review",
  "returned",
];
