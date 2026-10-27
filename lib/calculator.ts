export const packageNames = ["Base", "Plus", "Pro"];
export const prices = [500000, 750000, 1050000];
export function calculate(counts: number[], benefit: number) {
  if (
    counts.length !== 3 ||
    counts.some((x) => !Number.isInteger(x) || x < 0 || x > 1000) ||
    !Number.isFinite(benefit) ||
    benefit < 0 ||
    benefit > 1e10
  )
    throw new Error("กรอกจำนวนสาขา 0–1,000 และผลประโยชน์ที่ไม่ติดลบ");
  const branches = counts.reduce((a, b) => a + b, 0),
    discount =
      branches >= 16 ? 0.2 : branches >= 6 ? 0.15 : branches >= 3 ? 0.1 : 0;
  const subtotal = counts.reduce((sum, n, i) => sum + n * prices[i], 0),
    total = subtotal * (1 - discount);
  return {
    branches,
    discount,
    subtotal,
    total,
    roi: total > 0 ? ((benefit * 12 - total) / total) * 100 : null,
    payback: benefit > 0 && total > 0 ? total / benefit : null,
  };
}
