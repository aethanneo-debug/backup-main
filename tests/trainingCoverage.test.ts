// "At least one training per year per employee" (src/trainingCoverage.ts): what counts toward
// an employee's fiscal year, and who still has none. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fiscalYearSpan, trainingCoverage, yearTrainingCounter, type CoverageData } from "../src/trainingCoverage";

const FY2027 = { label: "2027", start_date: "2027-01-01", end_date: "2027-12-31" };
const programs = [
  { id: "p27a", title: "Legal Writing", fiscalYear: "2027" },
  { id: "p27b", title: "Records Management", fiscalYear: "2027" },
  { id: "p26", title: "Old Seminar", fiscalYear: "2026" }
];
const data = (over: Partial<CoverageData> = {}): CoverageData => ({ enrolments: [], programs, records: [], ...over });
const ana = { id: "emp-1", employeeId: "EMP001", fullName: "Ana Cruz" };

test("a seminar of the fiscal year counts, matched by either form of the employee's id", () => {
  const count = yearTrainingCounter(data({
    enrolments: [
      { employeeId: "emp-1", trainingProgramId: "p27a", status: "Assigned" },
      { employeeId: "EMP001", trainingProgramId: "p27b", status: "Liquidated", attendance: "Attended" }
    ]
  }), FY2027);
  assert.deepEqual(count(ana), { seminars: ["Legal Writing", "Records Management"], records: [] });
});

test("a cancelled or archived enrolment, a 'Did not attend', and another year's seminar don't count", () => {
  const count = yearTrainingCounter(data({
    enrolments: [
      { employeeId: "emp-1", trainingProgramId: "p27a", status: "Cancelled" },
      { employeeId: "emp-1", trainingProgramId: "p27a", status: "Archived" },
      { employeeId: "emp-1", trainingProgramId: "p27b", status: "Assigned", attendance: "Did not attend" },
      { employeeId: "emp-1", trainingProgramId: "p26", status: "Liquidated", attendance: "Attended" },
      { employeeId: "emp-1", trainingProgramId: "gone", status: "Assigned" }
    ]
  }), FY2027);
  assert.deepEqual(count(ana), { seminars: [], records: [] });
});

test("a seminar still to come counts: they are scheduled", () => {
  const count = yearTrainingCounter(data({ enrolments: [{ employeeId: "emp-1", trainingProgramId: "p27a", status: "Assigned" }] }), FY2027);
  assert.equal(count(ana).seminars.length, 1);
});

test("the seminar being staffed can be left out, so the picker counts only their other trainings", () => {
  const d = data({ enrolments: [{ employeeId: "emp-1", trainingProgramId: "p27a", status: "Assigned" }] });
  assert.deepEqual(yearTrainingCounter(d, FY2027, "p27a")(ana).seminars, []);
  assert.deepEqual(yearTrainingCounter(d, FY2027, "p27b")(ana).seminars, ["Legal Writing"]);
});

test("an HR-recorded training counts when dated within the fiscal year and not rejected", () => {
  const count = yearTrainingCounter(data({
    records: [
      { employeeId: "EMP001", title: "Outside Course", dateConducted: "2027-03-15" },
      { employeeId: "emp-1", title: "PDS-style date", dateConducted: "12/31/2027", status: "Verified" },
      { employeeId: "emp-1", title: "Returned one", dateConducted: "2027-06-01", status: "Returned" },
      { employeeId: "emp-1", title: "Rejected", dateConducted: "2027-03-15", status: "Rejected" },
      { employeeId: "emp-1", title: "Last year", dateConducted: "2026-12-31" },
      { employeeId: "emp-1", title: "Next year", dateConducted: "01/01/2028" },
      { employeeId: "emp-1", title: "Undated", dateConducted: "" },
      { employeeId: "emp-2", title: "Someone else", dateConducted: "2027-03-15" }
    ]
  }), FY2027);
  assert.deepEqual(count(ana).records, ["Outside Course", "PDS-style date", "Returned one"]);
});

test("HR's record of a seminar already counted, or the same record twice, is listed once", () => {
  const count = yearTrainingCounter(data({
    enrolments: [{ employeeId: "emp-1", trainingProgramId: "p27a", status: "Assigned" }],
    records: [
      { employeeId: "EMP001", title: "LEGAL WRITING!", dateConducted: "2027-02-01" },
      { employeeId: "emp-1", title: "Outside Course", dateConducted: "2027-03-01" },
      { employeeId: "emp-1", title: "outside  course", dateConducted: "2027-03-02" }
    ]
  }), FY2027);
  assert.deepEqual(count(ana), { seminars: ["Legal Writing"], records: ["Outside Course"] });
});

test("a record dated after an early opening but before 1 January counts toward the earlier calendar year (the user: leave it be)", () => {
  const records = [{ employeeId: "emp-1", title: "October course", dateConducted: "2026-10-20" }];
  assert.deepEqual(yearTrainingCounter(data({ records }), FY2027)(ana).records, []);
  assert.deepEqual(yearTrainingCounter(data({ records }), { label: "2026", start_date: "2026-01-01", end_date: "2026-12-31" })(ana).records, ["October course"]);
});

test("the fiscal year's span: its stored dates, else the calendar year its label names", () => {
  assert.deepEqual(fiscalYearSpan(FY2027), { start: "2027-01-01", end: "2027-12-31" });
  assert.deepEqual(fiscalYearSpan({ label: "2028" }), { start: "2028-01-01", end: "2028-12-31" });
  assert.deepEqual(fiscalYearSpan({ label: "2027", start_date: "2026-10-01", end_date: "2027-12-31" }), { start: "2026-10-01", end: "2027-12-31" });
  assert.equal(fiscalYearSpan({ label: "Special" }), null);
  // Without a span, records can't be placed in the year; seminars still count by their year.
  const count = yearTrainingCounter(data({
    enrolments: [{ employeeId: "emp-1", trainingProgramId: "pS", status: "Assigned" }],
    programs: [{ id: "pS", title: "Special Seminar", fiscalYear: "Special" }],
    records: [{ employeeId: "emp-1", title: "Course", dateConducted: "2027-03-15" }]
  }), { label: "Special" });
  assert.deepEqual(count(ana), { seminars: ["Special Seminar"], records: [] });
});

test("coverage: active employees with at least one training, and the rest by name", () => {
  const employees = [
    { id: "emp-1", employeeId: "EMP001", fullName: "Ana Cruz", position: "Clerk", division: "Legal Division" },
    { id: "emp-2", employeeId: "EMP002", fullName: "Zeny Reyes", position: "Officer", division: "Adjudication Division" },
    { id: "emp-3", employeeId: "EMP003", fullName: "Ben Lim", position: "Driver", division: "Administrative and Finance Division" },
    { id: "emp-4", employeeId: "EMP004", fullName: "Old Staff", isActive: false }
  ];
  const summary = trainingCoverage(employees, data({
    enrolments: [{ employeeId: "emp-1", trainingProgramId: "p27a", status: "Assigned" }],
    records: [{ employeeId: "EMP003", title: "Defensive Driving", dateConducted: "2027-02-02" }]
  }), FY2027);
  assert.deepEqual(summary, {
    fiscalYear: "2027",
    total: 3,
    covered: 2,
    withoutTraining: [{ id: "emp-2", employeeId: "EMP002", fullName: "Zeny Reyes", position: "Officer", division: "Adjudication Division" }]
  });
});

test("coverage lists everyone without training in name order, and handles empty data", () => {
  const employees = [
    { id: "b", fullName: "Bea" },
    { id: "a", fullName: "Abe" }
  ];
  const summary = trainingCoverage(employees, data(), FY2027);
  assert.deepEqual([summary.total, summary.covered, summary.withoutTraining.map(e => e.fullName)], [2, 0, ["Abe", "Bea"]]);
  assert.deepEqual(trainingCoverage([], data(), FY2027), { fiscalYear: "2027", total: 0, covered: 0, withoutTraining: [] });
});
