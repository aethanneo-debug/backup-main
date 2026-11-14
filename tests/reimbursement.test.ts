// A seminar paid out of the employee's own pocket, claimed back as a Reimbursement (src/reimbursement.ts).
// Pure functions, no data touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceRequestWindow, CLOSED_BY_ATTENDANCE, closedByAttendance, EXPIRED_UNPROCESSED, reimbursementLimit, reimbursementProblem, requestDueToExpire, requestExpired, seminarClaimMode, seminarPeriod } from "../src/reimbursement";

test("a cash advance is asked for before the seminar: its first day, a certificate or HR's \"Attended\" closes it (2026-11-14)", () => {
  const seat = (over: Partial<Parameters<typeof advanceRequestWindow>[0]> = {}) =>
    advanceRequestWindow({ attendance: null, hasCertificate: false, firstDay: "2026-11-14", today: "2026-11-13", ...over });
  assert.equal(seat(), null, "the day before the first day: open");
  assert.equal(seat({ today: "2026-11-14" }), "firstDay", "on the first day: nobody asks in the middle of a seminar");
  assert.equal(seat({ today: "2026-11-15" }), "firstDay", "the user's case: a seminar of Nov. 14 to 15, asked on its second day");
  assert.equal(seat({ today: "2026-12-31" }), "firstDay");
  assert.equal(seat({ hasCertificate: true }), "certificate", "a certificate on file, even if the dates moved later");
  assert.equal(seat({ attendance: "Attended", today: "2026-11-01" }), "attended");
  assert.equal(seat({ attendance: "Attended", hasCertificate: true, today: "2026-11-25" }), "attended", "HR's record first");
  assert.equal(seat({ hasCertificate: true, today: "2026-11-25" }), "certificate", "then the certificate, then the date");
  // "Did not attend" is the caller's own refusal; the window says nothing about it.
  assert.equal(seat({ attendance: "Did not attend" }), null);
  // A seminar with no real dates stays open, as the certificate's own rule can't open on it either.
  assert.equal(seat({ firstDay: "" , today: "2030-01-01" }), null);
  assert.equal(seat({ firstDay: "2026-02-30", today: "2030-01-01" }), null);
});

test("a request still waiting expires on the seminar's first day, and is told from a decline (2026-11-14)", () => {
  const waiting = { status: "Requested" };
  assert.equal(requestDueToExpire(waiting, "2026-11-14", "2026-11-13"), false, "the day before: Finance may still act");
  assert.equal(requestDueToExpire(waiting, "2026-11-14", "2026-11-14"), true, "on the first day");
  assert.equal(requestDueToExpire(waiting, "2026-11-14", "2026-11-20"), true, "and after it");
  for (const status of ["Released", "Declined", "Refunded", "Liquidated", "Cancelled"]) {
    assert.equal(requestDueToExpire({ status }, "2026-11-14", "2026-11-20"), false, `${status}: Finance acted, or it was settled`);
  }
  assert.equal(requestDueToExpire(waiting, "", "2026-11-20"), false, "a seminar with no dates never expires one");
  assert.equal(requestDueToExpire(waiting, "2026-02-30", "2026-11-20"), false, "nor one with a date that isn't real");
  assert.equal(requestDueToExpire(null, "2026-11-14", "2026-11-20"), false);

  const expired = { status: "Declined", declineReason: EXPIRED_UNPROCESSED, expiredAt: "2026-11-13T16:00:00.000Z" };
  assert.equal(requestExpired(expired), true);
  assert.equal(requestExpired({ status: "Declined", declineReason: "No budget yet." }), false, "Finance's own decline");
  assert.equal(requestExpired({ status: "Declined", declineReason: EXPIRED_UNPROCESSED }), false, "the wording alone isn't an expiry");
  assert.equal(requestExpired({ status: "Requested", expiredAt: "2026-11-13T16:00:00.000Z" }), false, "only a closed request");
  assert.equal(requestExpired({ status: "Declined", expiredAt: "" }), false);
  assert.equal(requestExpired(null), false);
  assert.equal(closedByAttendance(expired), false, "not HR's closure of 12ai either, so no late release");
  // An expired seat is a reimbursement, as after any decline.
  assert.equal(seminarClaimMode(expired.status), "reimbursement");
});

test("a seminar report covers the seminar's own dates, when they are real dates in order (12af)", () => {
  assert.deepEqual(seminarPeriod("2026-03-07", "2026-03-08"), { from: "2026-03-07", to: "2026-03-08" });
  assert.deepEqual(seminarPeriod("2026-03-07", "2026-03-07"), { from: "2026-03-07", to: "2026-03-07" }, "a one-day seminar");
  assert.equal(seminarPeriod("2026-03-08", "2026-03-07"), null, "out of order: the typed period stands");
  assert.equal(seminarPeriod("2026-02-30", "2026-03-01"), null, "not a real date");
  assert.equal(seminarPeriod("", "2026-03-01"), null);
  assert.equal(seminarPeriod(undefined, undefined), null, "an older seminar with no dates");
  assert.equal(seminarPeriod(20260307 as never, "2026-03-08"), null, "not text");
});

const money = (n: number) => `PHP ${n.toFixed(2)}`;

test("a seat's report is a Liquidation of a released advance, waits for a request, and is a Reimbursement otherwise", () => {
  assert.equal(seminarClaimMode("Released"), "liquidation");
  assert.equal(seminarClaimMode("Liquidated"), "liquidation", "settled by its report already");
  assert.equal(seminarClaimMode("Requested"), "waiting", "Finance releases or declines it first: never funded twice");
  assert.equal(seminarClaimMode(null), "reimbursement", "no advance at all");
  assert.equal(seminarClaimMode(undefined), "reimbursement");
  assert.equal(seminarClaimMode("Declined"), "reimbursement", "a declined request leaves them to pay themselves");
  assert.equal(seminarClaimMode("Refunded"), "reimbursement", "handed back before the seminar (Part B)");
});

test("the limit is the allowance less what the office paid for them, in whole centavos, never below zero", () => {
  assert.equal(reimbursementLimit(2000, 0), 2000);
  assert.equal(reimbursementLimit(2000, 750.5), 1249.5);
  assert.equal(reimbursementLimit(3333.33, 0.1), 3333.23, "no float drift");
  assert.equal(reimbursementLimit(1000, 1200), 0, "the office paid more than the share");
  assert.equal(reimbursementLimit(null, null), 0);
  assert.equal(reimbursementLimit("1500", "0"), 1500, "stored figures may be text");
  assert.equal(reimbursementLimit(2000, -500), 2000, "a stray negative figure can't raise it past the allowance");
  assert.equal(reimbursementLimit(-100, 0), 0, "nor a negative allowance make one");
});

test("a claim is refused with nothing left, nothing spent, more than the limit, or no receipt", () => {
  assert.match(reimbursementProblem({ spent: 100, limit: 0, files: 1 }, money), /Nothing is left of your share/);
  assert.match(reimbursementProblem({ spent: 0, limit: 2000, files: 1 }, money), /at least one amount above zero/);
  assert.equal(
    reimbursementProblem({ spent: 2000.01, limit: 2000, files: 1 }, money),
    "Your items come to PHP 2000.01, PHP 0.01 more than you can claim back (PHP 2000.00: your share of the seminar's budget, less anything the office paid for you). Lower or remove an item."
  );
  assert.match(reimbursementProblem({ spent: 500, limit: 2000, files: 0 }, money), /Attach your official receipts/);
  assert.equal(reimbursementProblem({ spent: 2000, limit: 2000, files: 1 }, money), "", "exactly the limit");
  assert.equal(reimbursementProblem({ spent: 0.1 + 0.2, limit: 0.3, files: 2 }, money), "", "0.1 + 0.2 is 0.30 in centavos");
  assert.equal(reimbursementProblem({ spent: 500, limit: 2000 }, money), "", "files not counted where none can be added");
});

test("a request HR's \"Attended\" closed is told from one Finance declined (12ai)", () => {
  assert.equal(closedByAttendance({ status: "Declined", declineReason: CLOSED_BY_ATTENDANCE }), true);
  assert.equal(closedByAttendance({ status: "Declined", declineReason: "No funds yet." }), false, "Finance's own decline");
  assert.equal(closedByAttendance({ status: "Requested", declineReason: CLOSED_BY_ATTENDANCE }), false);
  assert.equal(closedByAttendance(null), false);
});

