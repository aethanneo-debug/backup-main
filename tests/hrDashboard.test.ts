// HR's dashboard (src/hrDashboard.ts, GET /api/dashboard/hr, 12ag Part B): headcount, trainings attended, attendees by
// month, attendance by seminar, and the attendees whose money isn't settled. Pure functions, no data touched. Run with
// `npm test`. Names are placeholders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hrDashboard, seatStage, NO_DIVISION, type HrDashboardInput } from "../src/hrDashboard";

const FY = { label: "2029", start_date: "2029-01-01", end_date: "2029-12-31" };
const TODAY = "2026-11-20";
const addDays = (iso: string, n: number) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)).toISOString().slice(0, 10);

// Six staff still with the office; emp-9 has left but still has a seat with money open.
const staff = [
  { id: "emp-1", employeeId: "EMP001", division: "Legal Division", employmentStatus: "Permanent" },
  { id: "emp-2", employeeId: "EMP002", division: "Office of the Chief Regional Adjudicator", employmentStatus: "Contractual" },
  { id: "emp-3", employeeId: "EMP003", division: "  Legal   Division ", employmentStatus: "" },
  { id: "emp-4", employeeId: "EMP004", division: "", employmentStatus: "Permanent" },
  { id: "emp-5", employeeId: "EMP005", division: "Records Unit", employmentStatus: "Permanent" },
  { id: "emp-6", employeeId: "EMP006", division: "Legal Division", employmentStatus: "Permanent" }
];
const names: Record<string, string> = {
  "emp-1": "Staff One", "emp-2": "Staff Two", "emp-3": "Staff Three", EMP003: "Staff Three", "emp-4": "Staff Four",
  "emp-5": "Staff Five", "emp-6": "Staff Six", "emp-9": "Staff Nine"
};
const program = (id: string, title: string, startDate: string, endDate: string, extra: Record<string, unknown> = {}) =>
  ({ id, title, fiscalYear: "2029", startDate, endDate, ...extra });
const programs = [
  program("pA", "Ethics", "2026-11-02", "2026-11-04"),
  program("pB", "Records", "2026-10-01", "2026-10-01"),
  program("pC", "Future", "2026-12-10", "2026-12-11"),
  program("pD", "Never held", "2026-11-12", "2026-11-12", { archivedAt: "2026-11-01T00:00:00Z", archivedBeforeUse: true }),
  program("pE", "Old year", "2026-11-05", "2026-11-05", { fiscalYear: "2028" }),
  program("pF", "Held then archived", "2026-11-10", "2026-11-11", { archivedAt: "2026-11-15T00:00:00Z" })
];
const seat = (id: string, employeeId: string, trainingProgramId: string, attendance?: string, status = "Assigned") =>
  ({ id, employeeId, trainingProgramId, attendance, status });
const seats = [
  seat("sA1", "emp-1", "pA", "Attended", "Liquidation Pending"), seat("sA2", "emp-2", "pA", "Attended", "Liquidation Pending"),
  seat("sA3", "emp-3", "pA", "Did not attend"), seat("sA4", "emp-4", "pA"), seat("sA5", "emp-5", "pA", "Attended", "Cancelled"),
  seat("sB1", "emp-1", "pB", "Attended"), seat("sB2", "EMP003", "pB", "Attended"), seat("sB3", "emp-4", "pB", "Attended", "Liquidation Pending"),
  seat("sB4", "emp-5", "pB", "Attended"), seat("sB5", "emp-2", "pB", "Attended", "Liquidated"),
  seat("sC1", "emp-1", "pC"), seat("sD1", "emp-2", "pD", "Attended", "Archived"), seat("sE1", "emp-2", "pE", "Attended"),
  seat("sF1", "emp-5", "pF", "Attended", "Liquidated"), seat("sF2", "emp-4", "pF", "Attended", "Liquidated"),
  seat("sF3", "emp-9", "pF", "Attended", "Liquidation Pending"), seat("sF4", "emp-2", "pF", "Attended", "Liquidation Pending")
];
const records = [
  { employeeId: "EMP001", title: "Leadership", dateConducted: "2029-02-10", status: "Verified" },
  { employeeId: "EMP002", title: "Leadership", dateConducted: "2029-03-01", status: "Returned" },
  { employeeId: "EMP005", title: "Ethics", dateConducted: "2029-04-01", status: "Pending Verification" },
  { employeeId: "EMP001", title: "Outside the year", dateConducted: "2026-11-05", status: "Verified" }
];
const advance = (id: string, activityId: string, status: string, extra: Record<string, unknown> = {}) => ({ id, activityId, status, amount: 1000, ...extra });
const advances = [
  advance("ca-g", "sA1", "Released", { covers: [{ participantId: "sA1", amount: 1000 }, { participantId: "sA2", amount: 1000 }] }),
  advance("ca-b1", "sB1", "Released"), advance("ca-b2", "sB2", "Requested"), advance("ca-b5", "sB5", "Liquidated"),
  advance("ca-f3", "sF3", "Released"), advance("ca-f4", "sF4", "Released")
];
const report = (id: string, activityId: string, status: string, extra: Record<string, unknown> = {}) => ({ id, activityId, status, submissionNo: `LIQ-${id}`, ...extra });
const reports = [
  report("r-g", "sA1", "Pending HR Review", { cashAdvanceId: "ca-g", withinAdvance: true }),
  report("r-b3", "sB3", "Pending HR Review", { withinAllowance: true }),
  report("r-b5", "sB5", "Completed", { cashAdvanceId: "ca-b5", withinAdvance: true }),
  report("r-f1", "sF1", "Completed", { withinAllowance: true, reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 1500 }),
  report("r-f2", "sF2", "Completed", { withinAllowance: true, reimbursementStatus: "Reimbursed", reimbursementAmount: 900 }),
  report("r-f3", "sF3", "Returned", { cashAdvanceId: "ca-f3", withinAdvance: true }),
  report("r-f4", "sF4", "Verified & Forwarded", { cashAdvanceId: "ca-f4", withinAdvance: true })
];
const input = (over: Partial<HrDashboardInput> = {}): HrDashboardInput => ({
  staff, seats, programs, records, advances: advances as any, reports: reports as any,
  expenses: [{ trainingParticipantId: "sB4", source: "manual", amount: 300 }, { trainingParticipantId: "sB1", source: "report", amount: 500 }],
  fiscalYear: FY, today: TODAY,
  dueDateOf: (p) => (p.endDate ? addDays(p.endDate, 30) : null),
  personOf: (key) => (names[key] ? { name: names[key], withOffice: key !== "emp-9" } : null),
  ...over
});

test("headcount: the staff still with the office, by division (the account form's first) and by status", () => {
  const d = hrDashboard(input());
  assert.equal(d.headcount.total, 6);
  assert.deepEqual(d.headcount.byDivision, [
    { name: "Office of the Chief Regional Adjudicator", count: 1 }, { name: "Legal Division", count: 3 },
    { name: "Records Unit", count: 1 }, { name: NO_DIVISION, count: 1 }
  ], "a division typed with extra spaces is the same division; one left blank comes last");
  assert.deepEqual(d.headcount.byStatus, [{ name: "Permanent", count: 4 }, { name: "Contractual", count: 1 }, { name: "Not recorded", count: 1 }]);
});

test("trainings attended in the year: seats recorded Attended and HR's records that count, as coverage reads them", () => {
  const d = hrDashboard(input());
  // emp-1: Ethics, Records, and HR's Leadership (in the year's span) = 3. emp-2: Ethics, Records, Held then archived =
  // 3 (last year's seminar and a returned record don't count). emp-3: Records, on an older seat keyed by staff code =
  // 1 (they didn't attend Ethics). emp-4: Records and Held then archived = 2 (Ethics not recorded yet). emp-5: Records,
  // Held then archived and HR's Ethics record (their own Ethics seat was cancelled) = 3. emp-6: none.
  assert.deepEqual(d.trainingsPerEmployee, [
    { trainings: "0", employees: 1 }, { trainings: "1", employees: 1 }, { trainings: "2", employees: 1 }, { trainings: "3+", employees: 3 }
  ]);
  assert.deepEqual([d.attendance.attended, d.attendance.total, d.attendance.recordsCounted], [5, 6, 2]);
  assert.deepEqual(d.attendeesByMonth, [
    { month: "2026-10", employees: 5, trainings: 5 },
    { month: "2026-11", employees: 4, trainings: 5 },
    { month: "2029-02", employees: 1, trainings: 1 },
    { month: "2029-04", employees: 1, trainings: 1 }
  ], "months more than two years apart aren't filled in; one person twice in a month counts once");
});

test("months a little apart are shown with the empty ones between", () => {
  const d = hrDashboard(input({ records: [] , programs: programs.map(p => (p.id === "pF" ? { ...p, startDate: "2027-01-10", endDate: "2027-01-11" } : p)), today: "2027-02-01" }));
  assert.deepEqual(d.attendeesByMonth.map((m) => [m.month, m.employees]), [["2026-10", 5], ["2026-11", 2], ["2026-12", 0], ["2027-01", 3]]);
});

test("attendance by seminar: the year's seminars that have started, everyone seated, names for the tooltip", () => {
  const d = hrDashboard(input());
  assert.deepEqual(d.attendance.seminars.map((s) => [s.id, s.attended, s.didNotAttend, s.toRecord]), [
    ["pB", 5, 0, 0], ["pA", 2, 1, 1], ["pF", 4, 0, 0]
  ], "the one still to come, the one archived before use and last year's are left out; a cancelled seat isn't on the roster");
  assert.deepEqual(d.attendance.seminars[1].attendees, ["Staff One", "Staff Two"]);
  assert.deepEqual(d.attendance.seminars[2].attendees, ["Staff Five", "Staff Four", "Staff Nine", "Staff Two"], "someone who has since left still attended");
});

test("the attendees whose money isn't settled, the most pressing first, each by the report or advance that settles it", () => {
  const d = hrDashboard(input());
  assert.deepEqual(d.followUp.rows.map((r) => [r.participantId, r.stage, r.claim, r.dueDate, r.overdue, r.group, r.withOffice, r.reportNo ?? null]), [
    ["sB1", "noReport", false, "2026-10-31", true, false, true, null],
    ["sB2", "requested", false, "2026-10-31", false, false, true, null],
    ["sB3", "withHr", true, "2026-10-31", false, false, true, "LIQ-r-b3"],
    ["sA1", "withHr", false, "2026-12-04", false, false, true, "LIQ-r-g"],
    ["sA2", "withHr", false, "2026-12-04", false, true, true, "LIQ-r-g"],
    ["sF3", "returned", false, "2026-12-11", false, false, false, "LIQ-r-f3"],
    ["sF4", "withFinance", false, "2026-12-11", false, false, true, "LIQ-r-f4"],
    ["sF1", "reimbursementUnpaid", true, "2026-12-11", false, false, true, "LIQ-r-f1"]
  ]);
  assert.ok(d.followUp.rows.every((r) => r.fiscalYear === "2029"));
  assert.equal(d.followUp.rows[1].employee, "Staff Three", "an older seat keyed by staff code still names its person");
  // Settled and left out: sB5 (validated liquidation), sF2 (reimbursement paid). Not an attendee: sA3, sA4, sC1.
  assert.deepEqual(d.followUp.noClaim.map((r) => [r.participantId, r.officePaid]), [["sB4", true]], "attended with no advance or claim, the office paying their costs");
});

test("a seat's stage comes from its report and advance, never from the enrolment's status", () => {
  const unpaid = { id: "r", activityId: "s", status: "Completed", withinAllowance: true, reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 500 };
  assert.equal(seatStage({ status: "Liquidated" }, unpaid, null), "reimbursementUnpaid", "validation marks the seat Liquidated before the claim is paid");
  assert.equal(seatStage({ status: "Liquidated" }, { ...unpaid, reimbursementStatus: "Reimbursed" }, null), "settled");
  assert.equal(seatStage({ status: "Liquidation Pending" }, { id: "r", activityId: "s", status: "Verified & Forwarded", claimType: "Reimbursement" }, null), "withFinance", "an older report filed as a reimbursement, with Finance");
  assert.equal(seatStage({ status: "Assigned" }, null, { status: "Refunded" }), "noClaim", "an advance handed back before a seminar they attended after all");
  assert.equal(seatStage({ status: "Assigned" }, null, { status: "Declined" }), "noClaim");
  assert.equal(seatStage({ status: "Liquidated" }, null, null), "settled", "settled by older code with no report on file");
  assert.equal(seatStage({ status: "Assigned" }, { id: "r", activityId: "s", status: "Rejected" }, null), "settled", "a status nothing writes any more");
});

test("records of any shape are read without throwing, and a person nobody carries is unnamed", () => {
  const d = hrDashboard(input({
    staff: [...staff, null as any, { id: 7 } as any],
    seats: [...seats, null as any, { id: "x" } as any, seat("sB9", "ghost", "pB", "Attended")],
    programs: [...programs, null as any, { id: "pX", title: { toString: 1 }, fiscalYear: { x: 1 } } as any],
    records: [...records, null as any, { employeeId: "EMP006", title: { a: 1 }, dateConducted: 42 } as any]
  }));
  assert.equal(d.headcount.total, 6);
  // A seat nobody's record carries reads as someone not with the office: with no advance or claim, nothing is open.
  assert.equal(d.followUp.noClaim.some((r) => r.participantId === "sB9"), false);
});

test("every year's open money; cash out with no report possible yet; a declined group's member on their own claim; an older seat", () => {
  const d = hrDashboard(input({
    programs: [...programs, program("pG", "Last year's seminar", "2026-09-01", "2026-09-02", { fiscalYear: "2028" })],
    seats: [...seats,
      seat("sG1", "emp-6", "pG", "Attended"),                       // last year's, advance out, no report
      seat("sF5", "emp-6", "pF"),                                   // the seminar is over, attendance never recorded, advance out
      seat("sF6", "emp-3", "pF", "Did not attend"),                 // didn't go, their own advance still out
      seat("sF7", "emp-1", "pF", "Attended"),                       // a declined group's member, claiming on their own
      seat("sF8", "emp-6", "pF", undefined, "Liquidation Pending")  // an older seat, never marked, with a report filed
    ],
    advances: [...advances, advance("ca-g1", "sG1", "Released"), advance("ca-f5", "sF5", "Released"), advance("ca-f6", "sF6", "Released"),
      advance("ca-gx", "sF4", "Declined", { covers: [{ participantId: "sF4", amount: 1000 }, { participantId: "sF7", amount: 1000 }] })] as any,
    reports: [...reports, report("r-f7", "sF7", "Returned", { withinAllowance: true })] as any
  }));
  const row = (id: string) => d.followUp.rows.find((r) => r.participantId === id);
  assert.deepEqual([row("sG1")?.fiscalYear, row("sG1")?.stage, row("sG1")?.overdue], ["2028", "noReport", true],
    "last year's advance still out is listed, overdue, while this year's charts are shown (cash doesn't wait for the year)");
  assert.deepEqual([row("sF5")?.stage, row("sF5")?.dueDate, row("sF5")?.overdue], ["attendanceUnrecorded", "2026-12-11", false]);
  assert.deepEqual([row("sF6")?.stage, row("sF6")?.dueDate, row("sF6")?.overdue], ["refundDue", "2026-12-11", false],
    "a refund is due 30 days after the seminar too, as the employee's reminders count it (12ag's cleanups)");
  assert.deepEqual([row("sF7")?.stage, row("sF7")?.claim, row("sF7")?.group, row("sF7")?.overdue], ["returned", true, false, false],
    "their own claim, not the declined group's; a returned claim is never overdue (no cash is out)");
  assert.equal(d.followUp.noClaim.some((r) => r.participantId === "sG1"), false, "the no-claim list is the chosen year's");
  // Plan D's rule: a seat never marked, with a report filed, was attended.
  const pF = d.attendance.seminars.find((s) => s.id === "pF");
  assert.deepEqual(pF && [pF.attended, pF.didNotAttend, pF.toRecord], [6, 1, 1]);
});

test("someone who has left stays on the follow-up list while their money is open, but not on the no-claim list", () => {
  // emp-9 attended Held then archived with no advance or claim: they can't file one now (the server refuses it).
  const d = hrDashboard(input({ seats: [...seats, seat("sF9", "emp-9", "pF", "Attended")] }));
  assert.equal(d.followUp.noClaim.some((r) => r.participantId === "sF9"), false);
  assert.deepEqual(d.followUp.rows.filter((r) => !r.withOffice).map((r) => [r.participantId, r.stage]), [["sF3", "returned"]]);
});

test("a group's advance nobody it covers attended is its holder's to refund, on one row only (the code review of 12ag's cleanups)", () => {
  const groupAdvance = advance("ca-gx", "g1", "Released", { covers: [{ participantId: "g1", amount: 1000 }, { participantId: "g2", amount: 1000 }] });
  const stages = (g2: ReturnType<typeof seat>, status = "Released") => Object.fromEntries(
    hrDashboard(input({ seats: [seat("g1", "emp-1", "pB", "Did not attend"), g2], advances: [{ ...groupAdvance, status }] as any, reports: [] }))
      .followUp.rows.map((r) => [r.participantId, r.stage]));
  assert.deepEqual(stages(seat("g2", "emp-2", "pB", "Did not attend")), { g1: "refundDue" }, "nobody attended: the holder refunds the whole advance once");
  assert.deepEqual(stages(seat("g2", "emp-2", "pB")), { g2: "attendanceUnrecorded" }, "someone not recorded yet: the cash shows on their row, not twice");
  assert.deepEqual(stages(seat("g2", "emp-2", "pB", "Attended")), { g2: "noReport" }, "someone attended: their row, whose report the holder files, as before");
  assert.deepEqual(stages(seat("g2", "emp-2", "pB", "Did not attend"), "Refunded"), {}, "refunded: settled");
  const holder = hrDashboard(input({ seats: [seat("g1", "emp-1", "pB", "Did not attend"), seat("g2", "emp-2", "pB", "Did not attend")], advances: [groupAdvance] as any, reports: [] }))
    .followUp.rows.find((r) => r.participantId === "g1");
  assert.deepEqual([holder?.dueDate, holder?.overdue], ["2026-10-31", true], "and it is overdue once 30 days after the seminar have passed");
});
