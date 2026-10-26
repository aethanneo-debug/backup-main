// Group cash advances (HSAC RAB 1, 2026-10-26: one cash advance for participants who attend
// together, one report, one refund). Which advance pays for an enrolment (src/advanceCoverage.ts),
// and what the seminar then holds in the training budget, through the same chain the server uses:
// stored records → enrolmentsForBudget (src/server/budgetEnrolments.ts) → seminarBudget
// (src/trainingBudget.ts). Pure functions, no data touched. Run with `npm test`.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { seminarBudget } from "../src/trainingBudget";
import { enrolmentsForBudget } from "../src/server/budgetEnrolments";
import {
  advanceCovering, advancesCovering, coveredEnrolmentIds, isGroupAdvance, portionCentavos, releasedByEnrolment, reportCovering,
  spendableCentavos
} from "../src/advanceCoverage";

// ₱10,000 for 4 seats (a ₱2,500 share each). A holds a group advance for A, B and C; D is apart.
const prog = { id: "P", allocatedBudget: 10000, usedBudget: 0, maxParticipants: 4 };
const enrol = (id: string, extra: object = {}): any => ({ id, trainingProgramId: "P", status: "Assigned", attendance: "Attended", ...extra });
const cover = (id: string, amount = 2500) => ({ participantId: id, employeeId: `EMP-${id}`, employeeName: id, amount });
const group = (status: string, extra: object = {}): any => ({
  id: "CA-G", activityId: "A", employeeId: "EMP-A", status, amount: 7500, covers: [cover("A"), cover("B"), cover("C")], ...extra
});
const single = (id: string, status: string, amount = 2500): any => ({ id: `CA-${id}`, activityId: id, employeeId: `EMP-${id}`, status, amount });
const reportRow = (participantId: string, amount: number) => ({ trainingParticipantId: participantId, amount, source: "report" });

// What the seminar holds, from the stored records.
function budget(participants: any[], advances: any[], extra: { rows?: any[]; reports?: any[]; used?: number; program?: any } = {}) {
  const enrolments = enrolmentsForBudget({ participants, advances, ledgerRows: extra.rows ?? [], reports: extra.reports ?? [] });
  return seminarBudget({ ...(extra.program ?? prog), usedBudget: extra.used ?? 0 }, enrolments);
}

describe("which advance pays for an enrolment", () => {
  test("an individual advance pays for its own enrolment only", () => {
    const a = single("D", "Released");
    assert.equal(isGroupAdvance(a), false);
    assert.deepEqual(coveredEnrolmentIds(a), ["D"]);
    assert.equal(portionCentavos(a, "D"), 250000);
    assert.equal(portionCentavos(a, "A"), 0, "not anyone else's");
  });

  test("a group advance pays for everyone it covers, each their own amount", () => {
    const g = group("Released");
    assert.equal(isGroupAdvance(g), true);
    assert.deepEqual(coveredEnrolmentIds(g), ["A", "B", "C"]);
    assert.deepEqual(["A", "B", "C", "D"].map((id) => portionCentavos(g, id)), [250000, 250000, 250000, 0]);
    assert.equal(advanceCovering([g], "B", ["Requested", "Released"])?.id, "CA-G", "B is covered, though the advance names A");
    assert.equal(advanceCovering([g], "D", ["Requested", "Released"]), null, "D is not");
  });

  test("statuses are looked up in the order given, so an open advance wins over a settled one", () => {
    const old = { ...group("Declined"), id: "CA-OLD" };
    const open = group("Requested");
    assert.equal(advanceCovering([old, open], "C", ["Requested", "Released"])?.id, "CA-G");
    assert.equal(advanceCovering([old, open], "C", ["Released"]), null);
    assert.deepEqual(advancesCovering([old, open, single("D", "Released")], "C").map((a) => a.id), ["CA-OLD", "CA-G"]);
  });

  test("cash still out is split by the group's amounts, and only while Released", () => {
    const out = releasedByEnrolment([group("Released"), single("D", "Released", 1000), single("E", "Requested"), { ...group("Liquidated"), id: "X" }]);
    assert.deepEqual(Object.fromEntries(out), { A: 250000, B: 250000, C: 250000, D: 100000 });
  });

  test("a group's report may spend only the shares of those who attended; anyone else's, the whole advance", () => {
    const g = group("Released");
    const attended = (ids: string[]) => (id: string) => ids.includes(id);
    assert.equal(spendableCentavos(g, attended(["A", "B", "C"])), 750000, "everyone attended: all ₱7,500");
    assert.equal(spendableCentavos(g, attended(["B"])), 250000, "only B attended (the holder didn't): B's ₱2,500");
    assert.equal(spendableCentavos(g, attended([])), 0, "nobody attended: nothing (the whole advance is refunded)");
    assert.equal(spendableCentavos(single("D", "Released", 1234.56), attended([])), 123456, "an individual advance: all of it");
  });

  test("the report that settles an enrolment: its own, or the one filed on its group's advance", () => {
    const g = group("Released");
    const groupReport = { submissionNo: "LIQSUB-G", activityId: "A", cashAdvanceId: "CA-G" };
    const ownD = { submissionNo: "LIQSUB-D", activityId: "D", cashAdvanceId: "CA-D" };
    const reports = [groupReport, ownD];
    assert.equal(reportCovering(reports, [g], "A")?.submissionNo, "LIQSUB-G", "the holder's own");
    assert.equal(reportCovering(reports, [g], "B")?.submissionNo, "LIQSUB-G", "a covered member's, through the group");
    assert.equal(reportCovering(reports, [g], "D")?.submissionNo, "LIQSUB-D");
    assert.equal(reportCovering([ownD], [g], "B"), null, "nothing filed for the group yet");
    assert.equal(reportCovering(reports, [single("D", "Released")], "B"), null, "without the group advance, B has no report");
  });
});

describe("a group advance in the training budget: each share held once, spending counted once", () => {
  test("cash on the holder alone would count three shares twice: why each person's amount is stored", () => {
    // ₱7,500 recorded as A's own advance: A's cash beyond their share sits on top of B's and C's shares.
    const parts = ["A", "B", "C", "D"].map((id) => enrol(id));
    assert.equal(budget(parts, [single("A", "Released", 7500)]).committed, 15000);
    // The same cash as a group advance: each share once.
    assert.equal(budget(parts, [group("Released")]).committed, 10000);
  });

  test("a group out holds exactly what the same people on individual advances would", () => {
    const parts = ["A", "B", "C", "D"].map((id) => enrol(id));
    const asGroup = budget(parts, [group("Released")]);
    const asSingles = budget(parts, [single("A", "Released"), single("B", "Released"), single("C", "Released")]);
    assert.deepEqual([asGroup.committed, asGroup.outstanding, asGroup.released], [10000, 7500, 0]);
    assert.deepEqual([asGroup.committed, asGroup.outstanding, asGroup.held], [asSingles.committed, asSingles.outstanding, asSingles.held]);
  });

  test("a covered member who didn't attend: their share stays held while the group's cash is out", () => {
    const parts = [enrol("A"), enrol("B", { attendance: "Did not attend" }), enrol("C"), enrol("D")];
    const b = budget(parts, [group("Released")]);
    assert.deepEqual([b.committed, b.held, b.heldCount, b.released], [10000, 2500, 1, 0], "nothing released early: the cash is with A");
  });

  test("validating the group's report frees exactly what was handed back, while D is still to report", () => {
    const parts = [enrol("A"), enrol("B", { attendance: "Did not attend" }), enrol("C"), enrol("D")];
    const before = budget(parts, [group("Released")]);
    // A and C spent ₱4,000 of the ₱7,500; ₱3,500 goes back (B's share and the rest).
    const settled = parts.map((p) => (p.id === "A" || p.id === "C" ? { ...p, status: "Liquidated" } : p));
    const after = budget(settled, [group("Liquidated")], { rows: [reportRow("A", 4000)], used: 4000 });
    assert.deepEqual([before.committed, after.committed, before.committed - after.committed], [10000, 6500, 3500]);
    // Lines written for whoever they were for: the same figure.
    const named = budget(settled, [group("Liquidated")], { rows: [reportRow("A", 1500), reportRow("C", 2500)], used: 4000 });
    assert.equal(named.committed, 6500);
  });

  test("covered attendees settled by the group's report never keep their share held (the older-code trap)", () => {
    const settled = [enrol("A", { status: "Liquidated" }), enrol("B", { status: "Liquidated" }), enrol("C", { status: "Liquidated" }), enrol("D")];
    const rows = [reportRow("A", 7000)];
    assert.equal(budget(settled, [group("Liquidated")], { rows, used: 7000 }).committed, 9500, "₱7,000 spent + D's share");
    // Without the group record, B and C look like enrolments older code liquidated: shares held.
    assert.equal(budget(settled, [single("A", "Liquidated", 7500)], { rows, used: 7000 }).committed, 14500);
  });

  test("HR's hand entries for a covered member are paid from their share: nothing counts twice", () => {
    const parts = ["A", "B", "C", "D"].map((id) => enrol(id));
    const b = budget(parts, [group("Released")], { rows: [{ trainingParticipantId: "B", amount: 500, source: "hr" }], used: 500 });
    assert.deepEqual([b.committed, b.outstanding], [10000, 7000], "B's ₱500 came out of the group's cash");
  });

  test("nobody covered attended: one refund of the whole advance frees every share", () => {
    const parts = [enrol("A", { attendance: "Did not attend" }), enrol("B", { attendance: "Did not attend" }), enrol("C", { attendance: "Did not attend" }), enrol("D")];
    const out = budget(parts, [group("Released")]);
    const refunded = budget(parts, [group("Refunded")]);
    assert.deepEqual([out.committed, out.held, refunded.committed, out.committed - refunded.committed], [10000, 7500, 2500, 7500]);
  });

  test("a group beside an individual advance", () => {
    const parts = [enrol("A", { status: "Liquidated" }), enrol("B", { status: "Liquidated" }), enrol("C", { status: "Liquidated" }), enrol("D")];
    const b = budget(parts, [group("Liquidated"), single("D", "Released")], { rows: [reportRow("A", 7000)], used: 7000 });
    assert.deepEqual([b.stage, b.committed, b.outstanding], ["open", 9500, 2500]);
  });

  test("an allowance that doesn't divide evenly (₱10,000 ÷ 3) adds up in centavos", () => {
    const three = { id: "P", allocatedBudget: 10000, usedBudget: 0, maxParticipants: 3 };
    const g = group("Released", { amount: 9999.99, covers: [cover("A", 3333.33), cover("B", 3333.33), cover("C", 3333.33)] });
    const parts = ["A", "B", "C"].map((id) => enrol(id));
    assert.equal(budget(parts, [g], { program: three }).committed, 10000, "the whole allocation, as with three advances");
    // Settled at ₱9,000 spent: ₱1,000 returns; the OR is for ₱999.99 (the known centavo, 12q).
    const settled = parts.map((p) => ({ ...p, status: "Liquidated" }));
    const after = budget(settled, [{ ...g, status: "Liquidated" }], { program: three, rows: [reportRow("A", 9000)], used: 9000 });
    assert.deepEqual([after.stage, after.committed, after.returned], ["settled", 9000, 1000]);
  });
});
