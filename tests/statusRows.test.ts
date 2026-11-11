// Finance's figures by date filed or requested (src/components/finance/status/statusRows.ts, 12ag Part C): what each
// panel lists, the sums it adds, when a figure can be shown, and the range in words. Pure functions, no data touched.
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { statusFigures, type StatusAdvance, type StatusReport } from "../src/components/finance/statusFigures";
import {
  availability, axisStep, choiceProblem, countWords, nextChoice, panelModel, rangeInForce, rangeWords, shareText, worst, type RangeChoice
} from "../src/components/finance/status/statusRows";

const READY = { loading: false, reportsFailed: false, advancesFailed: false };
const ALL = { from: "", to: "" };

const reports: StatusReport[] = [
  { id: "l1", status: "Completed", createdAt: "2026-11-02", totalSpent: 900.1 },
  { id: "l2", status: "Pending HR Review", createdAt: "2026-11-03", totalSpent: 0.2, cashAdvanceId: "a-filed" },
  { id: "l3", status: "Verified & Forwarded", createdAt: "2026-11-04", totalSpent: 100 },
  { id: "l4", status: "Returned", createdAt: "2026-11-05", totalSpent: 50 },
  { id: "c1", status: "Completed", createdAt: "2026-11-06", withinAllowance: true, reimbursementStatus: "Reimbursed", reimbursementAmount: 400 }
];
const advances: StatusAdvance[] = [
  { id: "a-out", status: "Released", requestedAt: "2026-11-02", amount: 1500.5 },
  { id: "a-filed", status: "Released", requestedAt: "2026-11-02", amount: 1000 },
  { id: "a-req", status: "Requested", requestedAt: "2026-11-03", amount: 2000 }
];

test("the range in words", () => {
  assert.deepEqual(
    [
      rangeWords({ from: "2026-11-01", to: "2026-11-30" }),
      rangeWords({ from: "2026-10-01", to: "2026-12-31" }),
      rangeWords({ from: "2026-12-30", to: "2027-01-02" }),
      rangeWords({ from: "2026-11-01", to: "" }),
      rangeWords({ from: "", to: "2026-11-30" }),
      rangeWords(ALL)
    ],
    ["Nov 1–30, 2026", "Oct 1 – Dec 31, 2026", "Dec 30, 2026 – Jan 2, 2027", "From Nov 1, 2026", "Up to Nov 30, 2026", "All dates"]
  );
});

test("liquidations: liquidated against not yet liquidated, the sum in centavos, and the reports filed", () => {
  const m = panelModel("liquidations", statusFigures(reports, advances, ALL), READY);
  assert.deepEqual(m.lines.map(l => l.key), ["liquidated", "notYet", "withHr", "withFinance", "returned", "noReport", "filed"], "no Other line when nothing has an older status");
  assert.deepEqual(m.parts.map(p => p.key), ["liquidated", "withHr", "withFinance", "returned", "noReport"]);
  const notYet = m.lines.find(l => l.key === "notYet")!;
  assert.equal(notYet.sum, true, "a sum of our own, not a status");
  assert.deepEqual(notYet.tally, { count: 4, amount: 1650.7 }, "with HR 0.2 + with Finance 100 + returned 50 + released with no report 1500.5");
  assert.deepEqual(m.whole, { count: 5, amount: 2550.8 }, "the reports filed and the advance with none");
  assert.deepEqual(m.lines.find(l => l.key === "filed")!.tally, { count: 4, amount: 1050.3 });
  assert.equal(m.state, "ready");
  const older = panelModel("liquidations", statusFigures([...reports, { id: "x", status: "Rejected", createdAt: "2026-11-07", totalSpent: 5 }], advances, ALL), READY);
  assert.equal(older.parts.at(-1)?.key, "other", "an older status gets its line once there is one");
});

test("a figure is shown only once every list it needs is loaded", () => {
  const f = statusFigures(reports, null, ALL);
  const noAdvances = panelModel("liquidations", f, { ...READY, advancesFailed: true });
  assert.deepEqual(noAdvances.lines.map(l => [l.key, l.state]),
    [["liquidated", "ready"], ["notYet", "failed"], ["withHr", "ready"], ["withFinance", "ready"], ["returned", "ready"], ["noReport", "failed"], ["filed", "ready"]],
    "released with no report needs the advances, and so does the sum that holds it");
  assert.equal(noAdvances.state, "failed", "nor can the ring be drawn without it");
  assert.equal(panelModel("advances", f, { ...READY, advancesFailed: true }).state, "failed");
  assert.equal(panelModel("reimbursements", f, { ...READY, advancesFailed: true }).state, "ready", "claims need only the reports");
  assert.equal(panelModel("reimbursements", f, { ...READY, reportsFailed: true }).state, "failed");
  assert.ok(panelModel("advances", f, { ...READY, loading: true }).lines.every(l => l.state === "loading"));
  assert.deepEqual([availability(["reports", "advances"], READY), worst(["ready", "failed", "loading"]), worst(["ready", "failed"]), worst(["ready"])],
    ["ready", "loading", "failed", "ready"]);
});

test("cash advances and claims: one line per status, then the total", () => {
  const f = statusFigures(reports, advances, ALL);
  const a = panelModel("advances", f, READY);
  assert.deepEqual(a.lines.map(l => [l.key, l.tally.count]),
    [["requested", 1], ["released", 2], ["declined", 0], ["liquidated", 0], ["refunded", 0], ["total", 3]],
    "a status with none still has its line; Cancelled (which nothing sets any more) only when there is one");
  const withCancelled = panelModel("advances", statusFigures(reports, [...advances, { id: "old", status: "Cancelled", amount: 10, requestedAt: "2026-11-02" }], ALL), READY);
  assert.ok(withCancelled.lines.some(l => l.key === "cancelled" && l.tally.count === 1));
  assert.deepEqual(a.whole, { count: 3, amount: 4500.5 });
  const c = panelModel("reimbursements", f, READY);
  assert.deepEqual(c.lines.map(l => [l.key, l.tally.count]),
    [["withHr", 0], ["withFinance", 0], ["returned", 0], ["awaitingPayment", 0], ["paid", 1], ["total", 1]]);
  assert.ok(![...a.parts, ...c.parts].some(p => /^#(7c3aed|8b5cf6|a855f7|9333ea|6d28d9)$/i.test(p.color ?? "")), "never purple: it marks Outside the TDP");
});

test("the bars' axis: four even steps of a round size, never a squeezed last tick", () => {
  assert.deepEqual([0, 1, 4, 7, 10, 23, 104, 1000].map(axisStep), [1, 1, 1, 2, 3, 6, 30, 250],
    "0 to 4 when nothing is there; 10 is drawn on 0, 3, 6, 9, 12, not 0, 3, 6, 9, 10");
  assert.equal(axisStep(Number.NaN), 1);
});

test("counts and shares in words", () => {
  assert.deepEqual([countWords(1, ["claim", "claims"]), countWords(0, ["claim", "claims"]), countWords(3, ["cash advance", "cash advances"])],
    ["1 claim", "0 claims", "3 cash advances"]);
  assert.deepEqual([shareText(1, 3), shareText(0, 0), shareText(2, 2), shareText(199, 200)], ["33%", "—", "100%", "99%"], "rounded down, as the ring: 100% only when every one");
});

test("the range chosen: a preset, days typed in, and a box the browser can't read (the code review of Part C)", () => {
  const days = (p: string) => (p === "thisMonth" ? { from: "2026-11-01", to: "2026-11-30" } : { from: "", to: "" });
  const start: RangeChoice = { kind: "preset", preset: "thisMonth" };
  // Typing a day starts from the preset's days, so the other box keeps its day.
  const typed = nextChoice(start, "to", "2026-11-15", false, days as any);
  assert.deepEqual([rangeInForce(typed, days as any), choiceProblem(typed)], [{ from: "2026-11-01", to: "2026-11-15" }, null]);
  // A box holding a half-typed or impossible day reports "", which must not widen the range to "no bound".
  const half = nextChoice(typed, "from", "", true, days as any);
  assert.deepEqual([choiceProblem(half), rangeInForce(half, days as any)], ["Enter the dates as real days.", { from: "2026-11-01", to: "2026-11-15" }],
    "the last range that could be used stays in force");
  // Mended, the typed range is in force again; one whose first day comes after its last keeps the last good one.
  const mended = nextChoice(half, "from", "2026-11-05", false, days as any);
  assert.deepEqual(rangeInForce(mended, days as any), { from: "2026-11-05", to: "2026-11-15" });
  const reversed = nextChoice(mended, "to", "2026-11-01", false, days as any);
  assert.deepEqual([choiceProblem(reversed), rangeInForce(reversed, days as any)], ["The first day comes after the last.", { from: "2026-11-05", to: "2026-11-15" }]);
  // Clearing a box on purpose is "no bound", and a preset is never a problem.
  const cleared = nextChoice(mended, "from", "", false, days as any);
  assert.deepEqual([choiceProblem(cleared), rangeInForce(cleared, days as any)], [null, { from: "", to: "2026-11-15" }]);
  assert.equal(choiceProblem(start), null);
});
