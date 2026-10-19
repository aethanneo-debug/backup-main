// Money for liquidation reports (src/liquidationMoney.ts): sums in whole centavos, and how a
// report's items stand against its cash advance. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { centavos, pesos, sumPesos, liquidationBalance } from "../src/liquidationMoney";

test("amounts become whole centavos, and anything that isn't a number counts as 0", () => {
  assert.equal(centavos(2500), 250000);
  assert.equal(centavos("1234.56"), 123456);
  assert.equal(centavos(0.29), 29); // 0.29 × 100 is 28.999999999999996 in floating point
  assert.equal(centavos(1.15), 115);
  assert.equal(centavos(999999999.99), 99999999999);
  for (const bad of [null, undefined, "", "abc", NaN, Infinity]) assert.equal(centavos(bad as any), 0, String(bad));
});

test("sums never drift: ₱0.10 + ₱0.20 is ₱0.30", () => {
  assert.equal(0.1 + 0.2 === 0.3, false); // what plain floating point does
  assert.equal(sumPesos([0.1, 0.2]), 0.3);
  assert.equal(sumPesos(Array(1000).fill(0.01)), 10);
  assert.equal(sumPesos([1250.35, 749.65, "100.10"]), 2100.1);
  assert.equal(sumPesos([]), 0);
  assert.equal(pesos(123456), 1234.56);
});

test("balanced: the items use up the advance exactly", () => {
  assert.deepEqual(liquidationBalance(2500, 2500), { status: "Balanced", leftover: 0, over: 0 });
  assert.deepEqual(liquidationBalance("2500.00", sumPesos([1000.1, 1499.9])), { status: "Balanced", leftover: 0, over: 0 });
});

test("not balanced: the leftover is what goes back to the fund", () => {
  assert.deepEqual(liquidationBalance(2500, 2000), { status: "Not balanced", leftover: 500, over: 0 });
  assert.deepEqual(liquidationBalance(2500, 2499.99), { status: "Not balanced", leftover: 0.01, over: 0 });
  assert.deepEqual(liquidationBalance(2500, 0), { status: "Not balanced", leftover: 2500, over: 0 });
});

test("over: items past the advance, which a seminar report may not have", () => {
  assert.deepEqual(liquidationBalance(2500, 2600.5), { status: "Over", leftover: 0, over: 100.5 });
  assert.deepEqual(liquidationBalance(2500, 2500.01), { status: "Over", leftover: 0, over: 0.01 });
});
