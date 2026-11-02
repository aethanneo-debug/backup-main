// A report's history in the View window (the instructor's review, R8). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CorrectionRequest } from "../src/types";
import { reportHistory } from "../src/reportHistory";
import { answeredCorrectionSummary } from "../src/components/liquidation/resubmit/correctionModel";

const filed = { employeeName: "Filer One", claimType: "Liquidation" as const, createdAt: "2026-10-01T02:00:00.000Z" };

const round = (fields: Partial<CorrectionRequest>): CorrectionRequest => ({
  id: "c1", round: 1, items: [{ field: "particulars" }], remarks: "The fare is too high.", requestedBy: "Reviewer Two",
  requestedByRole: "HR Officer", requestedAt: "2026-10-02T02:00:00.000Z", returnTo: "Pending HR Review", ...fields
});

test("a filed report has one event, saying what it was filed as and by whom", () => {
  assert.deepEqual(reportHistory(filed), [{ kind: "filed", at: filed.createdAt, title: "Filed as a Liquidation", by: "Filer One" }]);
  assert.equal(reportHistory({ ...filed, createdAt: "", dateSubmitted: "2026-06-01" })[0].at, "2026-06-01", "an older report's date");
  assert.deepEqual(reportHistory(null), []);
  assert.deepEqual(reportHistory({}), []);
});

test("the whole road of a report, newest first, each step with who took it", () => {
  const events = reportHistory({
    ...filed,
    status: "Completed",
    claimBeforeCorrection: { claimType: "Reimbursement", totalReleased: 0, cashAdvanceDvNo: "", changedAt: "2026-10-03T02:00:00.000Z", changedBy: "Filer One" },
    corrections: [round({ resolvedAt: "2026-10-03T02:00:00.000Z", changedFields: ["particulars"] })],
    hrVerifiedAt: "2026-10-04T02:00:00.000Z", hrVerifiedBy: "Reviewer Two", hrRemarks: "Matches the seminar.",
    financeValidatedAt: "2026-10-05T02:00:00.000Z", financeValidatedBy: "Officer Three", financeRemarks: "Vouchers match.",
    divisionChiefRemarks: "Box B certified by a signatory.",
    fundReturn: { amount: 500, orNo: "0247983", orDate: "2026-10-04", recordedAt: "2026-10-05T02:00:00.000Z", recordedBy: "Officer Three" }
  });
  assert.deepEqual(events.map(e => e.kind), ["fundReturned", "validated", "verified", "corrected", "returned", "filed"]);
  assert.equal(events[5].title, "Filed as a Reimbursement", "what it was first filed as");
  assert.equal(events[4].title, "Returned by HR for correction");
  assert.equal(events[4].by, "Reviewer Two");
  assert.equal(events[4].detail, "To fix: Particulars.");
  assert.equal(events[4].note, "The fare is too high.");
  assert.equal(events[3].title, "Corrected and sent back to HR");
  assert.equal(events[3].by, "Filer One");
  assert.equal(events[3].detail, "Changed the particulars.");
  assert.equal(events[2].note, "Matches the seminar.");
  assert.equal(events[1].by, "Officer Three");
  assert.equal(events[1].note, "Vouchers match.");
  assert.equal(events[1].detail, "Box B certified by a signatory.");
  assert.equal(events[0].title, "₱500.00 went back to the training budget");
  assert.match(events[0].detail ?? "", /^OR 0247983, Oct 4, 2026\.$/);
});

test("each Return is its own event, and a round still open has no answer yet", () => {
  const events = reportHistory({
    ...filed,
    status: "Returned",
    corrections: [
      round({ resolvedAt: "2026-10-03T02:00:00.000Z", changedFields: [] }),
      round({ id: "c2", round: 2, requestedAt: "2026-10-04T02:00:00.000Z", requestedBy: "Officer Three", returnTo: "Verified & Forwarded", items: [{ field: "remarks" }] })
    ]
  });
  assert.deepEqual(events.map(e => e.kind), ["returned", "corrected", "returned", "filed"]);
  assert.equal(events[0].title, "Returned by Finance for correction (round 2)");
  assert.equal(events[1].detail, "Resubmitted without changes.");
});

test("a past round still names the file it asked for, though that copy has since been replaced", () => {
  const events = reportHistory({
    ...filed,
    supportingDocs: [{ id: "doc-a", name: "fare.pdf", type: "application/pdf", uploadedAt: "", supersededAt: "2026-10-03T02:00:00.000Z" }],
    corrections: [round({ items: [{ field: "replaceDocuments", documentIds: ["doc-a"] }], resolvedAt: "2026-10-03T02:00:00.000Z", changedFields: ["replaceDocuments"] })]
  });
  assert.equal(events.find(e => e.kind === "returned")?.detail, 'To fix: a new copy of "fare.pdf".');
  assert.equal(events.find(e => e.kind === "corrected")?.detail, "Replaced the files marked for replacing.");
});

test("a report returned before checklists existed says so, first, with its reviewer's remarks", () => {
  const events = reportHistory({ ...filed, status: "Returned", hrStatus: "Returned by HR", hrRemarks: "Please attach the receipt." });
  assert.deepEqual(events.map(e => e.kind), ["returned", "filed"]);
  assert.equal(events[0].at, "");
  assert.equal(events[0].title, "Returned by HR for correction");
  assert.equal(events[0].note, "Please attach the receipt.");
  const finance = reportHistory({ ...filed, status: "Returned", financeStatus: "Returned by Finance", financeRemarks: "See the voucher." });
  assert.equal(finance[0].title, "Returned by Finance for correction");
  assert.equal(finance[0].note, "See the voucher.");
});

test("a payment comes after the validation of the same day, though a voucher's date has no time", () => {
  const events = reportHistory({
    ...filed, claimType: "Reimbursement",
    financeValidatedAt: "2026-10-05T14:00:00.000Z", financeValidatedBy: "Officer Three",
    reimbursementStatus: "Reimbursed", reimbursementAmount: 1250.5, reimbursementDate: "2026-10-05", reimbursementDvNo: "2026-10-0007", reimbursedBy: "Officer Four"
  });
  assert.deepEqual(events.map(e => e.kind), ["paid", "validated", "filed"]);
  assert.equal(events[0].title, "₱1,250.50 paid back to Filer One");
  assert.equal(events[0].by, "Officer Four");
  assert.equal(events[0].detail, "DV No. 2026-10-0007.");
});

test("what was recorded at one moment reads in the order it happened", () => {
  const at = "2026-10-05T02:00:00.000Z";
  const events = reportHistory({
    ...filed, createdAt: at, hrVerifiedAt: at, financeValidatedAt: at,
    fundReturn: { amount: 1, orNo: "1", orDate: "", recordedAt: at, recordedBy: "Officer Three" }
  });
  assert.deepEqual(events.map(e => e.kind), ["fundReturned", "validated", "verified", "filed"]);
});

test("an older report approved without a validation date keeps that approval", () => {
  const events = reportHistory({ ...filed, divisionChiefApprovedAt: "2026-10-06T02:00:00.000Z", divisionChiefApprovedBy: "A Chief", divisionChiefRemarks: "Approved." });
  assert.equal(events[0].title, "Approved");
  assert.equal(events[0].by, "A Chief");
  assert.equal(events[0].note, "Approved.");
});

test("a claim not yet paid, or awaiting payment, says nothing of a payment", () => {
  const events = reportHistory({ ...filed, reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 500, reimbursementDate: "" });
  assert.deepEqual(events.map(e => e.kind), ["filed"]);
});

test("damaged fields on an old record can't reach the screen, which can only draw text", () => {
  const damaged = {
    ...filed, status: "Completed",
    hrVerifiedAt: "2026-10-04T02:00:00.000Z", hrVerifiedBy: { name: "x" }, hrRemarks: ["x"],
    corrections: [null, { round: 1 }, round({ remarks: { x: 1 } as never, requestedBy: 7 as never })]
  } as never;
  for (const event of reportHistory(damaged)) {
    for (const value of [event.title, event.by, event.detail, event.note]) assert.ok(value === undefined || typeof value === "string");
  }
  assert.deepEqual(reportHistory(damaged).map(e => e.kind), ["verified", "returned", "filed"]);
});

test("a damaged round's lists are read only when they are lists, and its empty entries are passed over", () => {
  const answered = round({
    resolvedAt: "2026-10-03T02:00:00.000Z",
    changedFields: "particulars" as never,
    items: [null, { field: "replaceDocuments", documentIds: "d1" }, { field: "addDocument", documentKinds: { x: 1 } }, { field: "remarks" }] as never
  });
  const report = { ...filed, status: "Completed", supportingDocs: "none" as never, corrections: [answered] } as never;
  const events = reportHistory(report);
  assert.deepEqual(events.map(e => e.kind), ["corrected", "returned", "filed"]);
  assert.equal(events[0].detail, "Resubmitted without changes.");
  assert.equal(events[1].detail, "To fix: a new copy of a file, a missing document and The employee's notes.");
  assert.equal(answeredCorrectionSummary({ corrections: "broken" as never }), null);
  assert.equal(answeredCorrectionSummary({ corrections: [answered, null] as never }), "Corrected after Return by Reviewer Two: resubmitted without changes.");
});

test("the reviewers' summary of a correction still reads as it did", () => {
  assert.equal(
    answeredCorrectionSummary({ corrections: [round({ round: 2, resolvedAt: "2026-10-03T02:00:00.000Z", changedFields: ["particulars"], items: [{ field: "particulars" }, { field: "remarks" }] })] }),
    "Corrected after Return round 2 by Reviewer Two: changed the particulars; left the notes as it was."
  );
  assert.equal(answeredCorrectionSummary({ corrections: [round({})] }), null);
});
