import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../lib/calculator.ts";
test("branch discount boundaries and mixed plans", () => {
  for (const [n, discount] of [
    [2, 0],
    [3, 0.1],
    [5, 0.1],
    [6, 0.15],
    [15, 0.15],
    [16, 0.2],
  ])
    assert.equal(calculate([n, 0, 0], 0).discount, discount);
  assert.equal(calculate([1, 1, 1], 60000).total, 2070000);
});
test("zero, invalid and no first-year recovery", () => {
  assert.equal(calculate([0, 0, 0], 0).roi, null);
  assert.equal(calculate([1, 0, 0], 0).payback, null);
  assert.ok(calculate([1, 0, 0], 1000).payback! > 12);
  for (const invalid of [-1, 1.5, NaN, 1001])
    assert.throws(() => calculate([invalid, 0, 0], 100));
  assert.throws(() => calculate([1, 0, 0], -1));
});
