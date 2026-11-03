// The training reports' spreadsheets and file names (the instructor's review, R11).
import test from "node:test";
import assert from "node:assert/strict";
import {
  clockTime,
  completedCsvRows,
  completedFileName,
  coverageCsvRows,
  coverageFileName,
  csvMoney,
  historyCsvRows,
  historyFileName,
  manilaDay,
  programCsvRows,
  programFileName,
  TOTALS_NOTE
} from "../src/components/reports/trainingReportRows";
import type { CompletedTrainingPrograms, EmployeeTrainingHistory, TrainingCoverage, TrainingProgramReport } from "../src/types";
import { csvCell } from "../src/utils";

const person = { id: "emp-1", employeeId: "EMP 001/A", fullName: "Test Person", position: "Clerk", division: "Legal" };

const history = (fiscalYear: string | null): EmployeeTrainingHistory => ({
  employee: person,
  fiscalYear,
  fiscalYears: ["2026"],
  asOf: "2026-11-03",
  rows: [
    {
      kind: "seminar", participantId: "p1", programId: "tp1", fiscalYear: "2026", title: "=Group Course", startDate: "2026-05-10", endDate: "2026-05-11",
      venue: "Hall", hours: 16, facilitator: "Fac", attendance: "Attended", seat: "enrolled", inLieuOf: "Someone Else",
      certificate: { name: "c.pdf", uploadedAt: "2026-05-12T01:00:00.000Z" },
      advance: { advanceNo: "CA-1", status: "Liquidated", amount: 5000, share: 2500, dvNo: "2026-05-0101", dvDate: "2026-05-01", group: { holder: "The Holder", members: 2, isHolder: false } },
      report: { submissionNo: "LIQ-1", status: "Completed", claimType: "Liquidation", totalSpent: 4800.5, refund: { amount: 199.5, orNo: "OR-1" }, group: true }
    },
    { kind: "seminar", participantId: "p2", programId: "tp2", fiscalYear: "2026", title: "Taken off", startDate: "2026-06-01", endDate: "", venue: "", hours: 0, facilitator: "", attendance: "", seat: "cancelled" },
    { kind: "record", id: "t1", fiscalYear: "", title: "A course", organizer: "CSC", dateConducted: "2026-09-01", hours: 12.5, status: "Returned", certificateFilename: "x.pdf", remarks: "Wrong date" }
  ]
});

const tableOf = (rows: unknown[][], first: string) => {
  const at = rows.findIndex(r => r[0] === first);
  const headings = rows[at] as string[];
  const out: Record<string, unknown>[] = [];
  for (const r of rows.slice(at + 1)) {
    if (r.length === 0) break;
    out.push(Object.fromEntries(headings.map((h, i) => [h, r[i]])));
  }
  return out;
};

test("an amount is a plain number with 2 decimals, or blank", () => {
  assert.equal(csvMoney(2500), "2500.00");
  assert.equal(csvMoney(0), "0.00");
  assert.equal(csvMoney(1234.5), "1234.50");
  assert.equal(csvMoney(undefined), "");
  assert.equal(csvMoney(null), "");
  assert.equal(csvMoney(NaN), "");
});

test("a file is named by staff code and year, never a person's name, and holds only safe characters", () => {
  assert.equal(historyFileName(history(null)), "HSAC_RAB1_Training_History_EMP_001_A_All_Years");
  assert.equal(historyFileName(history("2026")), "HSAC_RAB1_Training_History_EMP_001_A_FY2026");
  assert.ok(!historyFileName(history(null)).includes("Person"));
  const noCode = { ...history(null), employee: { ...person, employeeId: "" } };
  assert.equal(historyFileName(noCode), "HSAC_RAB1_Training_History_emp-1_All_Years");
  const program = { program: { id: "tp-1", fiscalYear: "2027", title: "=RA 12009: \"New\" Act / 2026" } } as TrainingProgramReport;
  assert.equal(programFileName(program), "HSAC_RAB1_Training_Program_FY2027_RA_12009_New_Act_2026");
  const untitled = { program: { id: "tp-1", fiscalYear: "2027", title: "===" } } as TrainingProgramReport;
  assert.equal(programFileName(untitled), "HSAC_RAB1_Training_Program_FY2027_tp-1");
  assert.equal(completedFileName({ fiscalYear: "2026", asOf: "2026-11-03" } as CompletedTrainingPrograms), "HSAC_RAB1_Completed_Training_Programs_FY2026_as_of_2026-11-03");
  assert.equal(coverageFileName({ fiscalYear: "2027" } as TrainingCoverage), "HSAC_RAB1_Employees_No_Training_FY2027");
});

test("an employee's history: one line per row, dates as stored, a covered seat with its share and none of the group's figures", () => {
  const rows = historyCsvRows(history(null), "Test Person · All fiscal years");
  assert.equal(rows[0][0], "HUMAN SETTLEMENTS ADJUDICATION COMMISSION");
  assert.deepEqual(rows.find(r => r[0] === "As of"), ["As of", "2026-11-03"]);
  const table = tableOf(rows, "Fiscal Year");
  assert.equal(table.length, 3);
  const [group, off, record] = table;
  assert.equal(group["Start Date"], "2026-05-10");
  assert.equal(group["Cash Released (Seat's Share)"], "2500.00");
  // The group's total and its report's figures are the holder's: adding up this person's lines counts nobody else's money.
  assert.equal(group["Group Advance Total"], "");
  assert.deepEqual([group["Spent (as Filed)"], group["Handed Back (as Filed)"], group["Handed Back OR"]], ["", "", ""]);
  assert.equal(group["Group Report"], "Yes (filed by the holder)");
  assert.equal(group["Group Holder"], "The Holder");
  assert.equal(group["DV Date"], "2026-05-01");
  assert.equal(group["Certificate Uploaded"], "2026-05-12", "a stored moment as its Manila day");
  assert.equal(group["In Lieu Of"], "Someone Else");
  assert.equal(off.Seat, "Taken off the seminar");
  assert.equal(off["Attendance or Record Status"], "");
  assert.equal(off["Cash Released (Seat's Share)"], "");
  assert.equal(off["Group Report"], "");
  assert.equal(off["Spent (as Filed)"], "");
  assert.equal(record.Kind, "HR record");
  assert.equal(record["Start Date"], "2026-09-01");
  assert.equal(record["Attendance or Record Status"], "Returned (not counted)");
  assert.equal(record["Certificate on File"], "x.pdf");
  assert.equal(record.Hours, 12.5);
  assert.equal(record.Remarks, "Wrong date");
  // Every line has as many cells as there are headings, an HR record's too.
  const headings = rows.find(r => r[0] === "Fiscal Year")!;
  for (const r of rows.slice(rows.indexOf(headings))) assert.equal(r.length, headings.length);
});

test("a cell that starts like a formula is kept as text by the helper every CSV goes through", () => {
  const title = tableOf(historyCsvRows(history(null), "x"), "Fiscal Year")[0].Title;
  assert.equal(title, "=Group Course");
  assert.equal(csvCell(title), `"'=Group Course"`);
  assert.equal(csvCell(csvMoney(2500)), `"2500.00"`);
});

const report: TrainingProgramReport = {
  program: { id: "tp1", fiscalYear: "2027", title: "Course", startDate: "2026-10-20", endDate: "2026-10-21", startTime: "08:00", endTime: "17:00", venue: "Hall", facilitator: "Fac", hours: 16, seats: 5, when: "ended", archived: true },
  budget: { allocated: 10000, spent: 4800, outstanding: 0, back: 5200 },
  asOf: "2026-11-03",
  rows: [
    {
      participantId: "p1", employeeId: "E1", fullName: "Covered", position: "Clerk", division: "Legal", attendance: "Attended", seat: "enrolled",
      advance: { advanceNo: "CA-G", status: "Liquidated", amount: 5000, share: 2500, group: { holder: "Holder", members: 2, isHolder: false } },
      report: { submissionNo: "LIQ-G", status: "Completed", claimType: "Liquidation", totalSpent: 4800, refund: { amount: 200, orNo: "OR-G" }, group: true }
    },
    {
      participantId: "p2", employeeId: "E2", fullName: "Holder", position: "Clerk", division: "Legal", attendance: "Attended", seat: "enrolled",
      advance: { advanceNo: "CA-G", status: "Liquidated", amount: 5000, share: 2500, group: { holder: "Holder", members: 2, isHolder: true } },
      report: { submissionNo: "LIQ-G", status: "Completed", claimType: "Liquidation", totalSpent: 4800, refund: { amount: 200, orNo: "OR-G" }, group: false }
    },
    { participantId: "p3", employeeId: "E3", fullName: "Gone", position: "", division: "", attendance: "", seat: "replaced", replacedBy: "Other" },
    {
      participantId: "p4", employeeId: "E4", fullName: "Waiting", position: "", division: "", attendance: "", seat: "enrolled",
      advance: { advanceNo: "CA-4", status: "Requested", amount: 2500 },
      report: undefined
    },
    {
      participantId: "p5", employeeId: "E5", fullName: "Back In Full", position: "", division: "", attendance: "Did not attend", seat: "enrolled",
      advance: { advanceNo: "CA-5", status: "Refunded", amount: 2500, refundOrNo: "OR-5", refundedAt: "2026-10-30T23:30:00.000Z" }
    }
  ],
  totals: { enrolled: 2, attended: 2, didNotAttend: 0, notRecorded: 0, certificates: 0, replaced: 1, cancelled: 0, advanced: 5000, handedBack: 200, reports: 1, validated: 1 }
};

test("a seminar's report: each figure once, cash only once released, and the totals from the route", () => {
  const rows = programCsvRows(report);
  assert.deepEqual(rows.find(r => r[0] === "As of"), ["As of", "2026-11-03"]);
  const [covered, holder, gone, waiting, backInFull] = tableOf(rows, "Name");
  assert.deepEqual([covered["Staff Code"], holder["Staff Code"]], ["E1", "E2"]);
  // The seats' shares add up to the advance; its total and the report's figures sit on the holder's row alone.
  assert.deepEqual([covered["Cash Released (Seat's Share)"], holder["Cash Released (Seat's Share)"]], ["2500.00", "2500.00"]);
  assert.deepEqual([covered["Group Advance Total"], holder["Group Advance Total"]], ["", "5000.00"]);
  assert.equal(covered["Group Holder"], "Holder");
  assert.deepEqual([covered["Spent (as Filed)"], covered["Handed Back (as Filed)"], covered["Handed Back OR"]], ["", "", ""]);
  assert.deepEqual([holder["Spent (as Filed)"], holder["Handed Back (as Filed)"], holder["Handed Back OR"]], ["4800.00", "200.00", "OR-G"]);
  assert.deepEqual([covered["Report No."], holder["Report No."]], ["LIQ-G", "LIQ-G"]);
  assert.deepEqual([covered["Group Report"], holder["Group Report"]], ["Yes (filed by the holder)", "Yes"]);
  assert.equal(gone.Seat, "Replaced by a representative");
  assert.equal(gone["Replaced By"], "Other");
  assert.equal(gone.Attendance, "");
  // A request still waiting isn't cash out; an advance handed back in full was, and its day is Manila's.
  assert.deepEqual([waiting["Advance Status"], waiting["Cash Released (Seat's Share)"]], ["Requested", ""]);
  assert.deepEqual([backInFull["Cash Released (Seat's Share)"], backInFull["Advance Refunded On"], backInFull["Advance Refund OR"]], ["2500.00", "2026-10-31", "OR-5"]);
  assert.ok(rows.some(r => r[0] === TOTALS_NOTE), "what the totals count is said where they are");
  const value = (key: string) => rows.find(r => r[0] === key)?.[1];
  assert.equal(value("Allocated"), "10000.00");
  assert.equal(value("Cash Still Out"), "0.00");
  assert.equal(value("Back in Unallocated"), "5200.00");
  assert.equal(value("Cash Advanced"), "5000.00");
  assert.equal(value("Reports Validated"), 1);
  assert.equal(value("Status"), "Ended");
  assert.equal(value("Archived"), "Yes");
  assert.equal(value("Start Time"), "08:00");
});

test("a year's completed seminars: the route's totals on the last line, and which were archived", () => {
  const data: CompletedTrainingPrograms = {
    fiscalYear: "2026",
    asOf: "2026-11-03",
    rows: [{ id: "a", title: "One", startDate: "2026-05-10", endDate: "2026-05-11", venue: "Hall", hours: 16, enrolled: 2, attended: 1, allocated: 10000, spent: 2100.5, archived: true }],
    totals: { programs: 1, enrolled: 2, attended: 1, hours: 16, allocated: 10000, spent: 2100.5 }
  };
  const rows = completedCsvRows(data);
  assert.deepEqual(rows.find(r => r[0] === "As of"), ["As of", "2026-11-03"]);
  const table = tableOf(rows, "Title");
  assert.equal(table[0].Archived, "Yes");
  assert.equal(table[0]["Start Date"], "2026-05-10");
  assert.equal(table[0].Spent, "2100.50");
  assert.deepEqual(rows.at(-1), ["Total (1 seminar)", "", "", "", 16, 2, 1, "10000.00", "2100.50", ""]);
});

test("employees with no training yet: N of M, as of the day, and a line per employee", () => {
  const data: TrainingCoverage = { fiscalYear: "2027", total: 40, covered: 11, asOf: "2026-11-03", withoutTraining: [{ id: "e", employeeId: "E", fullName: "Name", position: "Pos", division: "Div" }] };
  const rows = coverageCsvRows(data);
  assert.ok(rows.some(r => r[0] === "11 of 40 have at least one training in FY 2027"));
  assert.deepEqual(rows.find(r => r[0] === "As of"), ["As of", "2026-11-03"]);
  assert.deepEqual(tableOf(rows, "Name"), [{ Name: "Name", Position: "Pos", Division: "Div" }]);
});

test("a stored moment is read as its day on Manila's calendar; a plain date as it is", () => {
  assert.equal(manilaDay("2026-10-30T23:30:00.000Z"), "2026-10-31");
  assert.equal(manilaDay("2026-10-30T15:59:59.000Z"), "2026-10-30");
  assert.equal(manilaDay("2026-10-30"), "2026-10-30");
  assert.equal(manilaDay(""), "");
  assert.equal(manilaDay(undefined), "");
  assert.equal(manilaDay("not a date"), "not a date");
});

test("a seminar's times read on a clock", () => {
  assert.equal(clockTime("08:00"), "8:00 AM");
  assert.equal(clockTime("12:30"), "12:30 PM");
  assert.equal(clockTime("17:00"), "5:00 PM");
  assert.equal(clockTime("00:15"), "12:15 AM");
  assert.equal(clockTime(""), "");
  assert.equal(clockTime("soon"), "soon");
});
