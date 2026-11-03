// The training reports in Generated Reports (the instructor's review, R11). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { completedTrainingPrograms, programWhen, trainingProgramReport, type ProgramReportInput } from "../src/trainingReports";

const people: Record<string, { id: string; employeeId: string; fullName: string; position: string; division: string }> = {
  "emp-a": { id: "emp-a", employeeId: "EMPA", fullName: "Person A", position: "Clerk", division: "Admin" },
  "emp-b": { id: "emp-b", employeeId: "EMPB", fullName: "Person B", position: "Lawyer", division: "Legal" },
  "emp-c": { id: "emp-c", employeeId: "EMPC", fullName: "Person C", position: "Clerk", division: "Admin" },
  "emp-d": { id: "emp-d", employeeId: "EMPD", fullName: "Person D", position: "Driver", division: "Admin" }
};
const byKey = (k: string) => people[k] ?? Object.values(people).find((p) => p.employeeId === k) ?? null;
const program = { id: "p1", fiscalYear: "2027", title: "Records Management", startDate: "2027-03-02", endDate: "2027-03-03", startTime: "08:00", endTime: "17:00", venue: "Hall A", facilitator: "CSC", totalHours: 16, maxParticipants: 5 };
const budget = { allocated: 10000, spent: 6800.5, outstanding: 0, returned: 3199.5, released: 0 };
const input = (over: Partial<ProgramReportInput> = {}): ProgramReportInput => ({
  program, personOf: byKey, nameOf: (k) => byKey(k)?.fullName ?? "",
  seats: [], certificates: [], advances: [], reports: [], budget, today: "2027-03-10", ...over
});

test("a seminar's seats with their records, enrolled first; a group's advance and report counted once in the totals", () => {
  const r = trainingProgramReport(input({
    seats: [
      { id: "s1", trainingProgramId: "p1", employeeId: "emp-b", status: "Liquidated", attendance: "Attended" },
      { id: "s2", trainingProgramId: "p1", employeeId: "EMPA", status: "Liquidated", attendance: "Attended" },
      { id: "s3", trainingProgramId: "p1", employeeId: "emp-c", status: "Cancelled", replacedBy: { fullName: "Person D" } },
      { id: "s4", trainingProgramId: "p1", employeeId: "emp-d", status: "Assigned", attendance: "Did not attend", replaces: "s3" },
      { id: "s5", trainingProgramId: "p1", employeeId: "emp-x", status: "Cancelled" },
      { id: "s6", trainingProgramId: "p9", employeeId: "emp-a", status: "Assigned" },
      { id: "s7", trainingProgramId: "p1", employeeId: "emp-a", status: "Archived" }
    ],
    certificates: [{ participantId: "s1", name: "b.pdf", uploadedAt: "2027-03-03" }, { participantId: "s2", name: "a.pdf", uploadedAt: "2027-03-04" }],
    advances: [
      { id: "g1", advanceNo: "CA-G", activityId: "s1", employeeId: "EMPB", status: "Liquidated", amount: 4000, dvNo: "2027-02-0001", dvDate: "2027-02-20",
        covers: [{ participantId: "s1", amount: 2000 }, { participantId: "s2", amount: 2000 }] },
      { id: "a4", advanceNo: "CA-4", activityId: "s4", employeeId: "EMPD", status: "Refunded", amount: 2000.25, refundOrNo: "OR-9", refundedAt: "2027-03-05" },
      { id: "a3", advanceNo: "CA-3", activityId: "s3", employeeId: "EMPC", status: "Declined", amount: 2000 }
    ],
    reports: [{ activityId: "s1", cashAdvanceId: "g1", submissionNo: "LIQSUB-G", status: "Completed", claimType: "Liquidation", totalSpent: 3800, fundReturn: { amount: 200, orNo: "OR-1" } }]
  }));
  assert.deepEqual(r.rows.map((x) => [x.participantId, x.seat]), [["s2", "enrolled"], ["s1", "enrolled"], ["s4", "enrolled"], ["s3", "replaced"], ["s5", "cancelled"]]);
  assert.deepEqual([r.rows[0].fullName, r.rows[0].employeeId, r.rows[0].division], ["Person A", "EMPA", "Admin"], "a seat stored by staff code is found");
  assert.equal(r.rows[4].fullName, "No staff record");
  assert.deepEqual(r.rows[0].report, { submissionNo: "LIQSUB-G", status: "Completed", claimType: "Liquidation", totalSpent: 3800, refund: { amount: 200, orNo: "OR-1" }, group: true }, "HR sees a group's report in full");
  assert.deepEqual([r.rows[0].advance?.share, r.rows[0].advance?.group], [2000, { holder: "Person B", members: 2, isHolder: false }]);
  assert.deepEqual([r.rows[2].inLieuOf, r.rows[3].replacedBy], ["Person C", "Person D"]);
  assert.deepEqual(r.totals, {
    enrolled: 3, attended: 2, didNotAttend: 1, notRecorded: 0, certificates: 2, replaced: 1, cancelled: 1,
    advanced: 6000.25, handedBack: 2200.25, reports: 1, validated: 1
  });
  assert.deepEqual(r.budget, { allocated: 10000, spent: 6800.5, outstanding: 0, back: 3199.5 });
  assert.deepEqual([r.program.when, r.program.hours, r.program.seats, r.program.archived], ["ended", 16, 5, false]);
});

test("a report not yet validated isn't money back; an older report's refund counts once it is", () => {
  const seats = [{ id: "s1", trainingProgramId: "p1", employeeId: "emp-a", status: "Liquidation Pending", attendance: "Attended" }];
  const advances = [{ id: "a1", advanceNo: "CA-1", activityId: "s1", status: "Released", amount: 2500 }];
  const pending = trainingProgramReport(input({ seats, advances, reports: [{ activityId: "s1", status: "Pending HR Review", totalSpent: 2000, refundOrNo: "OR-2", remainingBalance: 500 }] }));
  assert.deepEqual([pending.totals.advanced, pending.totals.handedBack, pending.totals.reports, pending.totals.validated], [2500, 0, 1, 0]);
  assert.deepEqual(pending.rows[0].report?.refund, { amount: 500, orNo: "OR-2" }, "the row still shows what the employee entered");
  const old = trainingProgramReport(input({ seats, advances, reports: [{ activityId: "s1", status: "Approved", totalSpent: 2000, refundOrNo: "OR-2", remainingBalance: 500 }] }));
  assert.deepEqual([old.totals.handedBack, old.totals.validated], [500, 1]);
  const none = trainingProgramReport(input({ seats: [{ id: "s1", trainingProgramId: "p1", employeeId: "emp-a", status: "Assigned" }], advances: [{ id: "a1", activityId: "s1", status: "Requested", amount: 2500 }] }));
  assert.deepEqual([none.totals.advanced, none.totals.notRecorded, none.totals.certificates], [0, 1, 0], "a request waiting isn't cash out");
});

test("where a seminar stands by its dates: under way on its last day, ended from the day after", () => {
  const p = (startDate: string, endDate: string) => ({ id: "p", startDate, endDate });
  assert.equal(programWhen(p("2027-03-02", "2027-03-03"), "2027-03-01"), "upcoming");
  assert.equal(programWhen(p("2027-03-02", "2027-03-03"), "2027-03-02"), "ongoing");
  assert.equal(programWhen(p("2027-03-02", "2027-03-03"), "2027-03-03"), "ongoing");
  assert.equal(programWhen(p("2027-03-02", "2027-03-03"), "2027-03-04"), "ended");
  assert.equal(programWhen(p("2027-03-02", ""), "2027-03-04"), "ended", "a one-day seminar with no end date ends on its start");
  assert.equal(programWhen(p("", ""), "2027-03-04"), "upcoming");
  // Dates read as the rest of the server reads them: a stored moment by its day, a form's MM/DD/YYYY too.
  assert.equal(programWhen(p("2027-03-02T00:00:00.000Z", "2027-03-03T00:00:00.000Z"), "2027-03-04"), "ended");
  assert.equal(programWhen(p("03/02/2027", "03/03/2027"), "2027-03-02"), "ongoing");
  assert.equal(programWhen(p("2027-03-02", "2027-02-30"), "2027-03-04"), "ended", "an impossible end date falls back to the start");
});

test("a year's completed seminars, newest first, with what the training budget counts; none archived before use", () => {
  const programs = [
    { id: "p1", fiscalYear: "2027", title: "Ended first", startDate: "2027-02-01", endDate: "2027-02-02", venue: "A", totalHours: 16, allocatedBudget: 1000 },
    { id: "p2", fiscalYear: "2027", title: "Ended last", startDate: "2027-03-01", endDate: "2027-03-01", venue: "B", durationDays: 1, allocatedBudget: 2000, archivedAt: "2027-03-05" },
    { id: "p3", fiscalYear: "2027", title: "Not held", startDate: "2027-01-10", endDate: "2027-01-10", archivedAt: "2027-01-01", archivedBeforeUse: true },
    { id: "p4", fiscalYear: "2027", title: "Ends today", startDate: "2027-03-09", endDate: "2027-03-10" },
    { id: "p5", fiscalYear: "2026", title: "Last year", startDate: "2026-05-01", endDate: "2026-05-02" },
    null
  ];
  const seats = [
    { id: "s1", trainingProgramId: "p1", employeeId: "emp-a", status: "Liquidated", attendance: "Attended" },
    { id: "s2", trainingProgramId: "p1", employeeId: "emp-b", status: "Assigned", attendance: "Did not attend" },
    { id: "s3", trainingProgramId: "p1", employeeId: "emp-c", status: "Cancelled" },
    { id: "s4", trainingProgramId: "p2", employeeId: "emp-a", status: "Liquidated", attendance: "Attended" }
  ];
  const spentOf: Record<string, number> = { p1: 800.1, p2: 1999.95 };
  const c = completedTrainingPrograms({
    fiscalYear: "2027", programs, seats, today: "2027-03-10",
    budgetOf: (p) => ({ allocated: Number((p as { allocatedBudget?: number }).allocatedBudget) || 0, spent: spentOf[p.id] ?? 0 })
  });
  assert.deepEqual(c.rows.map((r) => r.id), ["p2", "p1"]);
  assert.deepEqual(c.rows[1], { id: "p1", title: "Ended first", startDate: "2027-02-01", endDate: "2027-02-02", venue: "A", hours: 16, enrolled: 2, attended: 1, allocated: 1000, spent: 800.1, archived: false });
  assert.deepEqual([c.rows[0].hours, c.rows[0].archived], [8, true], "a finished seminar archived with its records stays");
  assert.deepEqual(c.totals, { programs: 2, enrolled: 3, attended: 2, hours: 24, allocated: 3000, spent: 2800.05 });
  assert.deepEqual([c.fiscalYear, c.asOf], ["2027", "2027-03-10"]);
  assert.deepEqual(completedTrainingPrograms({ fiscalYear: "2027", programs: "x", seats: 5, today: "2027-03-10", budgetOf: () => ({ allocated: 0, spent: 0 }) }).rows, [], "damaged lists are passed over");
});
