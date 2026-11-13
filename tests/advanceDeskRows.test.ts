// The Cash Advance Desk's table (the instructor's review, R8). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceRowDate, advanceStage, filedWithoutAdvance, noAdvanceNow, refundDue, type FundableRow } from "../src/components/finance/advanceDeskRows";

const row = (fields: Partial<FundableRow> = {}): FundableRow => ({
  activityId: "tp-1", activityTitle: "A seminar", employeeId: "E1", employeeName: "Someone", allocated: 5000,
  assignmentStatus: "Assigned", funded: false, advanceNo: null, advanceAmount: null, advanceStatus: null, liquidationFiled: false,
  ...fields
});

test("an assignment with no advance yet waits to be funded", () => {
  assert.equal(advanceStage(row()), "unfunded");
  assert.equal(advanceStage(row({ pendingRequestId: "ca-1" })), "unfunded", "a request is on its way");
});

test("an advance out, settled, refunded or handed back has its own place", () => {
  assert.equal(advanceStage(row({ funded: true, advanceStatus: "Released" })), "released");
  assert.equal(advanceStage(row({ funded: true, advanceStatus: "Released", didNotAttend: true })), "released", "still to collect");
  assert.equal(advanceStage(row({ advanceStatus: "Liquidated" })), "settled");
  assert.equal(advanceStage(row({ advanceStatus: "Refunded", didNotAttend: true })), "refunded");
  assert.equal(advanceStage(row({ advanceStatus: "Refunded", refundedBeforeSeminar: true })), "returnedEarly");
  assert.equal(advanceStage(row({ advanceStatus: "Refunded", refundedBeforeSeminar: true, replaced: true })), "returnedEarly", "the replaced person's record of it");
});

test("each row is listed once: an advance handed back early stays that, even if HR then marks them absent", () => {
  assert.equal(advanceStage(row({ advanceStatus: "Refunded", refundedBeforeSeminar: true, didNotAttend: true })), "returnedEarly");
});

test("someone with nothing to fund or bring back isn't listed", () => {
  assert.equal(advanceStage(row({ didNotAttend: true })), null);
  assert.equal(advanceStage(row({ replaced: true })), null);
  assert.equal(advanceStage(row({ liquidationFiled: true })), null, "a reimbursement: no advance can be released now");
});

test("a refund stands once no request can come: corrected back to Attended, the seat is a reimbursement (12ai)", () => {
  // Since 2026-11-12 HR's "Attended" closes asking (as do a certificate on file and the seminar's last day).
  assert.equal(advanceStage(row({ advanceStatus: "Refunded", requestClosed: "HR recorded the attendance" })), "refunded");
  // While asking is still open (before the seminar's last day, nothing recorded) a refunded seat can ask again.
  assert.equal(advanceStage(row({ advanceStatus: "Refunded" })), "unfunded");
});

test("a seat no request can come for any more has no place among those to fund, unless one is waiting (12ai)", () => {
  const closed = "The seminar's last day has come";
  assert.equal(advanceStage(row({ requestClosed: closed })), null, "claimed back as a reimbursement");
  assert.equal(advanceStage(row({ requestClosed: closed, advanceStatus: "Declined" })), null);
  assert.equal(advanceStage(row({ requestClosed: closed, pendingRequestId: "ca-1" })), "unfunded", "Finance may still release it");
  assert.equal(advanceStage(row({ requestClosed: closed, funded: true, advanceStatus: "Released" })), "released");
  assert.equal(advanceStage(row({ requestClosed: closed, advanceStatus: "Liquidated" })), "settled");
  // Counted apart, once: not with a request waiting, an advance out or settled, or a report filed (counted as filed).
  assert.equal(noAdvanceNow(row({ requestClosed: closed })), true);
  assert.equal(noAdvanceNow(row({ requestClosed: closed, pendingRequestId: "ca-1" })), false);
  assert.equal(noAdvanceNow(row({ requestClosed: closed, funded: true, advanceStatus: "Released" })), false);
  assert.equal(noAdvanceNow(row({ requestClosed: closed, liquidationFiled: true })), false);
  assert.equal(noAdvanceNow(row({ requestClosed: closed, advanceStatus: "Refunded" })), false);
  assert.equal(noAdvanceNow(row({ requestClosed: closed, didNotAttend: true })), false);
  assert.equal(noAdvanceNow(row()), false, "asking still open");
});

test("a report filed with no advance on record is counted apart", () => {
  assert.equal(filedWithoutAdvance(row({ liquidationFiled: true })), true);
  assert.equal(filedWithoutAdvance(row({ liquidationFiled: true, funded: true })), false);
  assert.equal(filedWithoutAdvance(row({ liquidationFiled: true, advanceStatus: "Liquidated" })), false);
  assert.equal(filedWithoutAdvance(row({ liquidationFiled: true, didNotAttend: true })), false);
  assert.equal(filedWithoutAdvance(row()), false);
});

test("a refund is due from a non-attendee, or from a group only when nobody it covers attended", () => {
  assert.equal(refundDue(row({ didNotAttend: true })), true);
  assert.equal(refundDue(row()), false);
  assert.equal(refundDue(row({ groupNames: ["A", "B"], didNotAttend: true })), false, "the absent holder still files the group's report");
  assert.equal(refundDue(row({ groupNames: ["A", "B"], groupAllAbsent: true })), true);
});

test("each row is dated by its own event", () => {
  const dated = {
    assignedAt: "2026-10-01T00:00:00.000Z", advanceIssuedAt: "2026-10-02T00:00:00.000Z",
    advanceSettledAt: "2026-10-03T00:00:00.000Z", advanceRefundedAt: "2026-10-04T00:00:00.000Z"
  };
  assert.equal(advanceRowDate(row(dated)), Date.parse(dated.assignedAt));
  assert.equal(advanceRowDate(row({ ...dated, funded: true })), Date.parse(dated.advanceIssuedAt));
  assert.equal(advanceRowDate(row({ assignedAt: dated.assignedAt, funded: true })), Date.parse(dated.assignedAt), "released with no date on record");
  assert.equal(advanceRowDate(row({ ...dated, advanceStatus: "Liquidated" })), Date.parse(dated.advanceSettledAt));
  assert.equal(advanceRowDate(row({ ...dated, advanceStatus: "Refunded", didNotAttend: true })), Date.parse(dated.advanceRefundedAt));
  assert.equal(advanceRowDate(row({ advanceStatus: "Refunded", refundedBeforeSeminar: true })), 0);
});
