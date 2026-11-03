// An employee's training history (the instructor's review, R11). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { currentAdvance } from "../src/advanceCoverage";
import { employeeTrainingHistory, reportRefund, type HistoryInput } from "../src/trainingHistory";
import type { TrainingHistoryRecord, TrainingHistoryRow, TrainingHistorySeminar } from "../src/types";

const people: Record<string, { id: string; fullName: string }> = {
  "emp-a": { id: "emp-a", fullName: "Person A" }, EMPA: { id: "emp-a", fullName: "Person A" },
  "emp-b": { id: "emp-b", fullName: "Person B" }, EMPB: { id: "emp-b", fullName: "Person B" },
  "emp-c": { id: "emp-c", fullName: "Person C" }
};
const programs = [
  { id: "p1", fiscalYear: "2027", title: "Records Management", startDate: "2027-03-02", endDate: "2027-03-03", venue: "Hall A", facilitator: "CSC", totalHours: 16 },
  { id: "p2", fiscalYear: "2026", title: "Ethics", startDate: "2026-05-10", endDate: "2026-05-10", venue: "", facilitator: "", durationDays: 1 },
  { id: "p3", fiscalYear: "2027", title: "Never held", startDate: "2027-06-01", endDate: "2027-06-01", archivedBeforeUse: true }
];
const base = (over: Partial<HistoryInput> = {}): HistoryInput => ({
  employee: { id: "emp-a", employeeId: "EMPA", fullName: "Person A" },
  personOf: (k) => people[k]?.id ?? k,
  recordOwnerOf: (k) => people[k]?.id ?? k,
  nameOf: (k) => people[k]?.fullName ?? "",
  seats: [], programs, certificates: [], advances: [], reports: [], records: [],
  fiscalYears: [{ label: "2026", start_date: "2026-01-01", end_date: "2026-12-31" }, { label: "2027", start_date: "2027-01-01", end_date: "2027-12-31" }],
  full: true,
  fiscalYear: null,
  ...over
});
/** A row, failing the test if it isn't the kind expected (rather than skipping what it checks). */
const seminar = (r: TrainingHistoryRow | undefined): TrainingHistorySeminar => {
  assert.equal(r?.kind, "seminar");
  return r as TrainingHistorySeminar;
};
const record = (r: TrainingHistoryRow | undefined): TrainingHistoryRecord => {
  assert.equal(r?.kind, "record");
  return r as TrainingHistoryRecord;
};

test("every seat and every HR record, newest first, with the seminar's details; one never held is left out", () => {
  const h = employeeTrainingHistory(base({
    seats: [
      { id: "s1", trainingProgramId: "p1", employeeId: "emp-a", status: "Assigned", attendance: "Attended" },
      { id: "s2", trainingProgramId: "p2", employeeId: "EMPA", status: "Liquidated" },
      { id: "s3", trainingProgramId: "p3", employeeId: "emp-a", status: "Archived" },
      { id: "s4", trainingProgramId: "p1", employeeId: "emp-b", status: "Assigned" }
    ],
    records: [{ id: "t1", employeeId: "EMPA", title: "Leadership", organizer: "DAP", dateConducted: "2026-09-01", trainingHours: 24, status: "Returned", remarks: "Wrong date" }, null, 4]
  }));
  assert.deepEqual(h.rows.map(r => (r.kind === "seminar" ? r.participantId : r.id)), ["s1", "t1", "s2"]);
  const s1 = seminar(h.rows[0]);
  assert.deepEqual([s1.fiscalYear, s1.venue, s1.hours, s1.facilitator, s1.attendance, s1.seat], ["2027", "Hall A", 16, "CSC", "Attended", "enrolled"]);
  const s2 = seminar(h.rows[2]);
  assert.deepEqual([s2.hours, s2.attendance], [8, ""], "hours from the days when none are stored; attendance not recorded");
  const t1 = record(h.rows[1]);
  assert.deepEqual([t1.fiscalYear, t1.organizer, t1.hours, t1.status, t1.remarks], ["2026", "DAP", 24, "Returned", "Wrong date"]);
  assert.deepEqual(h.fiscalYears, ["2027", "2026"]);
});

test("one fiscal year at a time; a record is placed by the year its date falls in, as the coverage rule reads dates", () => {
  const input = base({
    seats: [{ id: "s1", trainingProgramId: "p1", employeeId: "emp-a", status: "Assigned" }],
    records: [
      { id: "t1", employeeId: "EMPA", title: "Undated", dateConducted: "" },
      { id: "t2", employeeId: "EMPA", title: "2026 course", dateConducted: "2026-02-02" },
      { id: "t3", employeeId: "EMPA", title: "PDS format", dateConducted: "03/15/2026" },
      { id: "t4", employeeId: "EMPA", title: "With a time", dateConducted: "2026-01-20T00:00:00.000Z" }
    ]
  });
  assert.deepEqual(employeeTrainingHistory({ ...input, fiscalYear: "2026" }).rows.map(r => r.title), ["PDS format", "2026 course", "With a time"], "newest first across date formats");
  assert.deepEqual(employeeTrainingHistory({ ...input, fiscalYear: "2027" }).rows.map(r => r.title), ["Records Management"]);
  assert.equal(employeeTrainingHistory(input).rows.at(-1)?.title, "Undated", "undated last, only under all years");
});

test("the certificate on file, the advance and the report, money in centavos", () => {
  const h = employeeTrainingHistory(base({
    seats: [{ id: "s1", trainingProgramId: "p1", employeeId: "emp-a", status: "Liquidated", attendance: "Attended" }],
    certificates: [{ participantId: "s1", name: "old.pdf", uploadedAt: "2027-03-03", supersededAt: "2027-03-04" }, { participantId: "s1", name: "cert.pdf", uploadedAt: "2027-03-04" }],
    advances: [{ id: "ca1", advanceNo: "CA-1", activityId: "s1", employeeId: "EMPA", status: "Liquidated", amount: "2500.005", dvNo: "2027-03-0001", dvDate: "2027-03-01" }],
    reports: [{ activityId: "s1", submissionNo: "LIQSUB-1", status: "Completed", claimType: "Liquidation", totalSpent: 2100.1, fundReturn: { amount: 399.9, orNo: "OR-1" } }]
  }));
  const r = seminar(h.rows[0]);
  assert.deepEqual(r.certificate, { name: "cert.pdf", uploadedAt: "2027-03-04" }, "the one not replaced");
  assert.deepEqual(r.advance, { advanceNo: "CA-1", status: "Liquidated", amount: 2500.01, dvNo: "2027-03-0001", dvDate: "2027-03-01" });
  assert.deepEqual(r.report, { submissionNo: "LIQSUB-1", status: "Completed", claimType: "Liquidation", totalSpent: 2100.1, refund: { amount: 399.9, orNo: "OR-1" }, group: false });
});

test("the money a report says was handed back: Finance's record first, else the balance entered with its OR", () => {
  assert.deepEqual(reportRefund({ activityId: "s1", fundReturn: { amount: 200, orNo: "OR-F" }, refundOrNo: "OR-E", remainingBalance: 300 }), { amount: 200, orNo: "OR-F" });
  assert.deepEqual(reportRefund({ activityId: "s1", refundOrNo: "OR-E", remainingBalance: 300 }), { amount: 300, orNo: "OR-E" });
  assert.equal(reportRefund({ activityId: "s1", remainingBalance: 300 }), null, "a balance with no OR isn't money handed back");
  assert.equal(reportRefund({ activityId: "s1", refundOrNo: "OR-E", remainingBalance: 0 }), null);
});

const group = (over: Partial<HistoryInput> = {}) => base({
  seats: [{ id: "s1", trainingProgramId: "p1", employeeId: "emp-b", status: "Assigned" }, { id: "s2", trainingProgramId: "p1", employeeId: "emp-a", status: "Liquidated" }],
  advances: [{ id: "g1", advanceNo: "CA-G", activityId: "s1", employeeId: "EMPB", employeeName: "Person B", status: "Refunded", amount: 5000, dvNo: "2027-03-0002", dvDate: "2027-03-01",
    refundOrNo: "OR-G", refundedAt: "2027-03-09", covers: [{ participantId: "s1", amount: 2000 }, { participantId: "s2", amount: 3000 }] }],
  reports: [{ activityId: "s1", cashAdvanceId: "g1", submissionNo: "LIQSUB-G", status: "Completed", totalSpent: 4800 }],
  ...over
});

test("a covered group member sees their share and the group report's number and status only; HR sees it all", () => {
  const mine = seminar(employeeTrainingHistory(group({ full: false })).rows[0]);
  assert.deepEqual(mine.advance, { advanceNo: "CA-G", status: "Refunded", amount: 3000, share: 3000, dvNo: "2027-03-0002", dvDate: "2027-03-01", group: { holder: "Person B", isHolder: false }, refundedAt: "2027-03-09" },
    "not the group's total, head count or refund OR (12v decision 8)");
  assert.deepEqual(mine.report, { submissionNo: "LIQSUB-G", status: "Completed", group: true }, "not the group's spending");
  const hr = seminar(employeeTrainingHistory(group()).rows[0]);
  assert.deepEqual([hr.advance?.amount, hr.advance?.share, hr.advance?.group?.members, hr.advance?.refundOrNo, hr.report?.totalSpent], [5000, 3000, 2, "OR-G", 4800]);
});

test("the holder of a group sees the group's advance and their own report in full", () => {
  const own = seminar(employeeTrainingHistory(group({ full: false, employee: { id: "emp-b", employeeId: "EMPB", fullName: "Person B" } })).rows[0]);
  assert.deepEqual([own.advance?.amount, own.advance?.share, own.advance?.group, own.advance?.refundOrNo], [5000, 2000, { holder: "Person B", members: 2, isHolder: true }, "OR-G"]);
  assert.deepEqual(own.report, { submissionNo: "LIQSUB-G", status: "Completed", totalSpent: 4800, group: false });
});

test("a group's holder is named as the advance names them, even if their staff code later names someone else (7j)", () => {
  const input = group({ full: false, nameOf: () => "Somebody New" });
  assert.equal(seminar(employeeTrainingHistory(input).rows[0]).advance?.group?.holder, "Person B");
  const older = group({ full: false, nameOf: () => "Person B", advances: [{ id: "g1", activityId: "s1", employeeId: "EMPB", status: "Released", amount: 5000, covers: [{ participantId: "s2", amount: 5000 }] }] });
  assert.equal(seminar(employeeTrainingHistory(older).rows[0]).advance?.group?.holder, "Person B", "an advance with no name on it");
});

test("an HR record stays with the one it was entered for, however seats are read", () => {
  const records = [{ id: "t1", employeeId: "CODE", title: "Theirs", dateConducted: "2026-02-02" }];
  // "CODE" is one person's staff code and, through an edit (7j), another's internal id: seats and records read it differently.
  const seen = (id: string) => employeeTrainingHistory(base({
    employee: { id, employeeId: "", fullName: "" }, records, personOf: () => "someone-else", recordOwnerOf: () => "owner"
  })).rows.map(r => r.title);
  assert.deepEqual(seen("owner"), ["Theirs"]);
  assert.deepEqual(seen("someone-else"), []);
});

test("someone replaced by a representative learns that one went, never who; HR sees who, both ways", () => {
  const input = base({
    seats: [
      { id: "s1", trainingProgramId: "p1", employeeId: "emp-a", status: "Cancelled", replacedBy: { fullName: "Person C" } },
      { id: "s9", trainingProgramId: "p1", employeeId: "emp-c", status: "Assigned", replaces: "s1" }
    ]
  });
  const mine = seminar(employeeTrainingHistory({ ...input, full: false }).rows[0]);
  assert.deepEqual([mine.seat, mine.replacedBy], ["replaced", undefined]);
  const hr = seminar(employeeTrainingHistory(input).rows[0]);
  assert.deepEqual([hr.seat, hr.replacedBy], ["replaced", "Person C"]);
  const repHr = seminar(employeeTrainingHistory({ ...input, employee: { id: "emp-c", employeeId: "", fullName: "Person C" } }).rows[0]);
  assert.equal(repHr.inLieuOf, "Person A");
  const repOwn = seminar(employeeTrainingHistory({ ...input, full: false, employee: { id: "emp-c", employeeId: "", fullName: "Person C" } }).rows[0]);
  assert.equal(repOwn.inLieuOf, undefined, "nor whom they replaced, to the representative");
});

test("a seat taken off a seminar reads as cancelled, with nothing about anyone else", () => {
  const r = seminar(employeeTrainingHistory(base({ full: false, seats: [{ id: "s1", trainingProgramId: "p1", employeeId: "emp-a", status: "Cancelled" }] })).rows[0]);
  assert.deepEqual([r.seat, r.replacedBy, r.advance, r.report], ["cancelled", undefined, undefined, undefined]);
});

test("the advance that stands: one waiting, else one out, else the latest settled", () => {
  const a = (id: string, status: string, at = "") => ({ id, activityId: "s1", status, amount: 1, refundedAt: at });
  assert.equal(currentAdvance([a("x", "Declined"), a("y", "Requested")])?.id, "y");
  assert.equal(currentAdvance([a("x", "Liquidated"), a("y", "Released")])?.id, "y");
  assert.equal(currentAdvance([a("x", "Refunded", "2027-01-01"), a("y", "Refunded", "2027-02-01")])?.id, "y");
  assert.equal(currentAdvance([]), null);
});

test("damaged records are passed over", () => {
  const h = employeeTrainingHistory(base({ seats: "x", programs: null, certificates: 5, advances: [null], reports: {}, records: [{ id: 1 }], fiscalYears: "y" }));
  assert.deepEqual(h.rows, []);
  assert.deepEqual(h.fiscalYears, []);
});
