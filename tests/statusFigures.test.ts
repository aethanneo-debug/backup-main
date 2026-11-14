// Finance's dashboard by date range (src/components/finance/statusFigures.ts, 12ag Part C): the presets, the range's
// edges, and every status of the reports, cash advances and claims filed or requested in it. Pure functions, no data
// touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inRange, manilaDayOf, presetRange, rangeProblem, statusFigures, type StatusAdvance, type StatusReport } from "../src/components/finance/statusFigures";

const TODAY = "2026-11-11";

test("the presets, around Manila's today", () => {
  assert.deepEqual(presetRange("thisMonth", TODAY), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(presetRange("lastMonth", TODAY), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(presetRange("lastMonth", "2027-01-15"), { from: "2026-12-01", to: "2026-12-31" }, "January's last month is December");
  assert.deepEqual(presetRange("thisQuarter", TODAY), { from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual(presetRange("thisMonth", "2028-02-10"), { from: "2028-02-01", to: "2028-02-29" }, "a leap year's February");
  assert.deepEqual(presetRange("fiscalYear", TODAY, { label: "2029", start: "2029-01-01", end: "2029-12-31" }), { from: "2029-01-01", to: "2029-12-31" },
    "the fiscal year's stored days, whatever today is");
  assert.deepEqual(presetRange("fiscalYear", TODAY, { label: "2027" }), { from: "2027-01-01", to: "2027-12-31" }, "else the year its label names");
  assert.deepEqual(presetRange("fiscalYear", TODAY, null), { from: "", to: "" });
  assert.deepEqual(presetRange("all", TODAY), { from: "", to: "" });
});

test("a typed range, and which days fall in it", () => {
  assert.equal(rangeProblem({ from: "2026-11-01", to: "2026-11-30" }), null);
  assert.equal(rangeProblem({ from: "", to: "2026-11-30" }), null, "one side may be open");
  assert.equal(rangeProblem({ from: "2026-02-30", to: "" }), "Enter the dates as real days.");
  assert.equal(rangeProblem({ from: "2026-12-01", to: "2026-11-30" }), "The first day comes after the last.");
  const nov = { from: "2026-11-01", to: "2026-11-30" };
  assert.deepEqual(["2026-10-31", "2026-11-01", "2026-11-30", "2026-12-01", ""].map(d => inRange(d, nov)), [false, true, true, false, false], "both days included");
  assert.equal(inRange("", { from: "", to: "" }), true, "a record with no date counts only under All time");
  // 16:30 UTC on 31 October is already 1 November in Manila.
  assert.deepEqual([manilaDayOf("2026-10-31T16:30:00.000Z"), manilaDayOf("2026-10-31T15:59:00.000Z"), manilaDayOf("2026-11-05"), manilaDayOf("soon"), manilaDayOf(42)],
    ["2026-11-01", "2026-10-31", "2026-11-05", "", ""]);
});

const report = (id: string, status: string, filed: string, extra: Partial<StatusReport> = {}): StatusReport =>
  ({ id, status, createdAt: filed, totalSpent: 1000, activityId: `seat-${id}`, ...extra });
const advance = (id: string, status: string, requested: string, extra: Partial<StatusAdvance> = {}): StatusAdvance =>
  ({ id, status, amount: 1000, requestedAt: requested, activityId: `seat-${id}`, ...extra });

const reports: StatusReport[] = [
  report("l1", "Completed", "2026-11-02T01:00:00Z", { totalSpent: 900.1, cashAdvanceId: "a-liq" }),
  report("l2", "Approved", "2026-11-03T01:00:00Z", { totalSpent: 0.2 }),
  report("l3", "Pending HR Review", "2026-11-04T01:00:00Z", { cashAdvanceId: "a-out-filed" }),
  report("l4", "Verified & Forwarded", "2026-11-05T01:00:00Z"),
  report("l5", "Returned", "2026-11-06T01:00:00Z"),
  report("l6", "Rejected", "2026-11-07T01:00:00Z"),
  report("l7", "Completed", "2026-10-31T15:00:00Z"),                                              // 31 Oct in Manila: out of November
  report("c1", "Pending HR Review", "2026-11-08T01:00:00Z", { withinAllowance: true, reimbursementAmount: 700 }),
  report("c2", "Verified & Forwarded", "2026-11-08T02:00:00Z", { withinAllowance: true, totalSpent: 650 }),
  report("c3", "Returned", "2026-11-09T01:00:00Z", { withinAllowance: true }),
  report("c4", "Completed", "2026-11-09T02:00:00Z", { withinAllowance: true, reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 500 }),
  report("c5", "Completed", "2026-11-10T01:00:00Z", { withinAllowance: true, reimbursementStatus: "Reimbursed", reimbursementAmount: 400 }),
  report("c6", "Pending HR Review", "2026-11-10T02:00:00Z", { claimType: "Reimbursement", reimbursementAmount: 300 }),   // an older claim
  report("n1", "Completed", "", { dateSubmitted: undefined })                                       // no date
];
const advances: StatusAdvance[] = [
  advance("a-req", "Requested", "2026-11-02T01:00:00Z", { amount: 2000 }),
  advance("a-out", "Released", "2026-11-03T01:00:00Z", { amount: 1500.5 }),                      // no report: not yet liquidated
  advance("a-out-filed", "Released", "2026-11-03T02:00:00Z"),                                     // its report is with HR
  advance("a-out-old", "Released", "2026-11-03T03:00:00Z", { activityId: "seat-l4" }),            // an older report names the seat, not the advance
  advance("a-group", "Released", "2026-11-04T01:00:00Z", { amount: 3000 }),                       // a group's: one record, counted once
  advance("a-dec", "Declined", "2026-11-04T02:00:00Z"),
  advance("a-liq", "Liquidated", "2026-11-05T01:00:00Z"),
  advance("a-ref", "Refunded", "2026-11-05T02:00:00Z"),
  advance("a-can", "Cancelled", "2026-11-05T03:00:00Z"),
  advance("a-old", "Released", "", { requestedAt: undefined, issuedAt: "2026-11-06T01:00:00Z" }), // released directly before requests: its issue day
  advance("a-sep", "Released", "2026-09-20T01:00:00Z")                                            // out of November
];

test("November's statuses: liquidations, cash advances and claims, each counted once", () => {
  const f = statusFigures(reports, advances, { from: "2026-11-01", to: "2026-11-30" });
  const t = (x: { count: number; amount: number }) => [x.count, x.amount];
  assert.deepEqual(
    [t(f.liquidations.liquidated), t(f.liquidations.withHr), t(f.liquidations.withFinance), t(f.liquidations.returned), t(f.liquidations.other), t(f.liquidations.filed)],
    [[1, 900.1], [1, 1000], [1, 1000], [1, 1000], [2, 1000.2], [6, 4900.3]],
    "an older Approved is an older status, as on the overview's Reports panel; added up in centavos (1000 + 0.2); October's and an undated one are left out"
  );
  assert.deepEqual(t(f.liquidations.noReport), [3, 5500.5], "released with no report: the one with none, the group's, and the one released directly; not one whose report is filed");
  assert.deepEqual(
    [t(f.advances.requested), t(f.advances.released), t(f.advances.declined), t(f.advances.liquidated), t(f.advances.refunded), t(f.advances.cancelled), t(f.advances.total)],
    [[1, 2000], [5, 7500.5], [1, 1000], [1, 1000], [1, 1000], [1, 1000], [10, 13500.5]],
    "by the day requested (or issued, for one released directly); September's left out"
  );
  assert.deepEqual(
    [t(f.reimbursements.withHr), t(f.reimbursements.withFinance), t(f.reimbursements.returned), t(f.reimbursements.awaitingPayment), t(f.reimbursements.paid), t(f.reimbursements.total)],
    [[2, 1000], [1, 650], [1, 1000], [1, 500], [1, 400], [6, 3550]],
    "a claim's amount is what it asks (else what was spent); an older report filed as a reimbursement is one too"
  );
});

test("All time takes everything, a record with no date included; a range with nothing in it gives zeros", () => {
  const all = statusFigures(reports, advances, { from: "", to: "" });
  assert.equal(all.liquidations.filed.count, 8);
  assert.equal(all.advances.total.count, 11);
  const empty = statusFigures(reports, advances, { from: "2030-01-01", to: "2030-01-31" });
  assert.deepEqual([empty.liquidations.filed, empty.advances.total, empty.reimbursements.total], [{ count: 0, amount: 0 }, { count: 0, amount: 0 }, { count: 0, amount: 0 }]);
  assert.deepEqual(statusFigures(null, undefined, { from: "", to: "" }).advances.total, { count: 0, amount: 0 });
  assert.equal(statusFigures([null as any, { status: "Completed" } as any], [null as any], { from: "", to: "" }).liquidations.filed.count, 0, "records without an id are passed over");
});

test("the claims are what the Reimbursement Queue pays: an older overspent liquidation's difference, and only what can be paid", () => {
  const range = { from: "", to: "" };
  const f = statusFigures([
    // Filed before 2026-10-20 as a liquidation, spending more than its advance: its difference is owed, then paid.
    report("o1", "Completed", "2026-09-02T01:00:00Z", { claimType: "Liquidation", cashAdvanceId: "a1", totalSpent: 3600, reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 600 }),
    report("o2", "Completed", "2026-09-03T01:00:00Z", { claimType: "Liquidation", cashAdvanceId: "a2", totalSpent: 3400, reimbursementStatus: "Reimbursed", reimbursementAmount: 400 }),
    report("o3", "Pending HR Review", "2026-09-04T01:00:00Z", { claimType: "Liquidation", cashAdvanceId: "a3", totalSpent: 3300, reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 300 }),
    // A liquidation that owes nothing back to the employee isn't a claim.
    report("o4", "Completed", "2026-09-05T01:00:00Z", { claimType: "Liquidation", cashAdvanceId: "a4", reimbursementStatus: "Not Required", reimbursementAmount: 0 }),
    // A validated claim with nothing owed, or one validated under the old rules ("Approved"), can't be paid: older statuses.
    report("o5", "Completed", "2026-09-06T01:00:00Z", { withinAllowance: true, reimbursementStatus: "Not Required" }),
    report("o6", "Approved", "2026-09-07T01:00:00Z", { claimType: "Reimbursement", reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 200 })
  ], [], range);
  const t = (x: { count: number; amount: number }) => [x.count, x.amount];
  assert.deepEqual([t(f.reimbursements.awaitingPayment), t(f.reimbursements.paid), t(f.reimbursements.withHr), t(f.reimbursements.other), t(f.reimbursements.total)],
    [[1, 600], [1, 400], [1, 300], [2, 1200], [5, 2500]], "the difference owed, paid or in review; nothing pending that can't be paid");
  assert.deepEqual([t(f.liquidations.liquidated), t(f.liquidations.withHr)], [[3, 8000], [1, 3300]], "the liquidations still count their spending");
});

test("a damaged record is read as nothing, never thrown on (the security review of Part C)", () => {
  const crafted = { toString: 1, valueOf: 1 } as any;
  // A timestamp at the edge of what dates hold overflows when Manila's 8 hours are added.
  assert.equal(manilaDayOf("+275760-09-13T00:00:00.000Z"), "");
  const odd: StatusReport[] = [
    { id: "x1", status: crafted, createdAt: "2026-11-02T01:00:00Z", dateSubmitted: "+275760-09-13T00:00:00.000Z", totalSpent: 100 },
    { id: "x2", status: "Completed", createdAt: "2026-11-02T01:00:00Z", withinAllowance: true, reimbursementAmount: crafted, totalSpent: 250 }
  ];
  const f = statusFigures(odd, [{ id: "y1", status: crafted, requestedAt: "2026-11-02T01:00:00Z", amount: 50 }], { from: "", to: "" });
  assert.deepEqual([f.liquidations.other.count, f.reimbursements.other.amount, f.reimbursements.awaitingPayment.count, f.advances.other.count], [1, 250, 0, 1],
    "a status that isn't text is an unknown one; an owed amount that isn't one owes nothing, so the claim falls back to what was spent and isn't payable");
  // A fiscal year's stored day shaped like a date but not one: no bounds, and a typed day beside it is checked safely.
  assert.deepEqual(presetRange("fiscalYear", TODAY, { label: "", start: "2026-13-45", end: "2026-12-31" }), { from: "", to: "" });
  assert.equal(rangeProblem({ from: "2026-13-45", to: "2026-12-01" }), "Enter the dates as real days.");
});

test("a request that expired on its seminar's first day is counted apart from Finance's own declines (2026-11-14)", () => {
  const f = statusFigures([], [
    advance("x-dec", "Declined", "2026-11-04T02:00:00Z"),
    advance("x-exp", "Declined", "2026-11-04T03:00:00Z", { expiredAt: "2026-11-13T16:00:00.000Z", amount: 700 }),
    advance("x-odd", "Declined", "2026-11-04T04:00:00Z", { expiredAt: 5 as never })
  ], { from: "", to: "" });
  assert.deepEqual([f.advances.declined.count, f.advances.expired.count, f.advances.expired.amount], [2, 1, 700],
    "a stored expiry that isn't a timestamp reads as a decline");
  assert.equal(f.advances.total.count, 3, "each counted once");
});
