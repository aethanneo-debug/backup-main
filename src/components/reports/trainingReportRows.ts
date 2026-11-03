// The training reports' spreadsheets and file names (the instructor's review, R11): pure, so they are tested without a
// browser. Amounts are plain numbers with 2 decimals and dates are as stored, so a spreadsheet can work with them; every
// cell goes through csvCell in downloadCsvTable, so typed text can't start a formula. A file is named by a staff code,
// never a person's name.
import type {
  CompletedTrainingPrograms,
  EmployeeTrainingHistory,
  TrainingCoverage,
  TrainingHistorySeminar,
  TrainingProgramReport,
  TrainingProgramReportRow
} from "../../types";

const MASTHEAD: string[][] = [
  ["HUMAN SETTLEMENTS ADJUDICATION COMMISSION"],
  ["Regional Adjudication Branch 1"],
  ["Dona Pepita Building, Quezon Avenue, Barangay II, San Fernando City, La Union"],
  []
];

/** An amount as a spreadsheet reads it, or blank when there is none. */
export const csvMoney = (amount: number | null | undefined) =>
  typeof amount === "number" && Number.isFinite(amount) ? amount.toFixed(2) : "";

/** Letters, digits, hyphens and underscores only, so a typed title can't make a bad file name. */
const safePart = (text: string, limit = 60) =>
  text.replace(/[^A-Za-z0-9-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, limit).replace(/_+$/, "");

const fyPart = (fiscalYear: string | null | undefined) => (fiscalYear ? `FY${safePart(fiscalYear)}` : "All_Years");

/** By staff code, so a person's name doesn't sit in a shared PC's downloads. */
export function historyFileName(data: EmployeeTrainingHistory): string {
  return `HSAC_RAB1_Training_History_${safePart(data.employee.employeeId || data.employee.id)}_${fyPart(data.fiscalYear)}`;
}

export function programFileName(data: TrainingProgramReport): string {
  const title = safePart(data.program.title) || safePart(data.program.id);
  return `HSAC_RAB1_Training_Program_${fyPart(data.program.fiscalYear)}_${title}`;
}

export function completedFileName(data: CompletedTrainingPrograms): string {
  return `HSAC_RAB1_Completed_Training_Programs_${fyPart(data.fiscalYear)}_as_of_${safePart(data.asOf)}`;
}

export function coverageFileName(data: TrainingCoverage): string {
  return `HSAC_RAB1_Employees_No_Training_${fyPart(data.fiscalYear)}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "4 seminars and 1 training HR recorded", leaving out what there is none of. */
export function historyCountText(data: EmployeeTrainingHistory): string {
  const seminars = data.rows.filter(r => r.kind === "seminar").length;
  const records = data.rows.length - seminars;
  return [seminars ? plural(seminars, "seminar") : "", records ? `${records} training${records === 1 ? "" : "s"} HR recorded` : ""].filter(Boolean).join(" and ");
}

export const coverageSentence = (data: TrainingCoverage) => `${data.covered} of ${data.total} have at least one training in FY ${data.fiscalYear}`;

export const seatWord = (seat: TrainingHistorySeminar["seat"]) =>
  seat === "replaced" ? "Replaced by a representative" : seat === "cancelled" ? "Taken off the seminar" : "Enrolled";

export const whenWord = (when: TrainingProgramReport["program"]["when"]) =>
  when === "ended" ? "Ended" : when === "ongoing" ? "Under way" : "Upcoming";

/** "08:00" as "8:00 AM"; anything else as stored. */
export function clockTime(time: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(time || "");
  if (!m) return time || "";
  const hour = Number(m[1]);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m[2]} ${hour < 12 ? "AM" : "PM"}`;
}

/** Someone taken off a seminar was never going to have attendance recorded. */
const attendanceWord = (row: Pick<TrainingHistorySeminar, "attendance" | "seat">) =>
  row.attendance || (row.seat === "enrolled" ? "Not recorded" : "");

/** A stored moment as its day on Manila's calendar (a refund at 7:30 AM Manila is that day, not the day before in UTC);
 * a plain date as it is. */
export function manilaDay(value: string | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Cash that left Finance: still out, liquidated, or handed back in full (a request waiting, or declined, isn't). */
const RELEASED = new Set(["Released", "Liquidated", "Refunded"]);

// A seat's records, in the columns the employee's history and the seminar's report share. Each seat's own: its share of
// a group's advance, and a group's total and its report's figures on the holder's row alone, so no figure is listed
// twice. A column isn't a total: a report not yet validated is as filed, and the reports' totals count each cash advance
// and report once (the seminar's report states them).
const SEAT_RECORD_HEADINGS = [
  "Certificate on File", "Certificate Uploaded",
  "Advance No.", "Advance Status", "Cash Released (Seat's Share)", "Group Advance Total", "Group Holder", "DV No.", "DV Date",
  "Advance Refund OR", "Advance Refunded On",
  "Report No.", "Report Status", "Claim Type", "Group Report", "Spent (as Filed)", "Handed Back (as Filed)", "Handed Back OR"
];

function seatRecordCells(row: Pick<TrainingHistorySeminar, "certificate" | "advance" | "report">): string[] {
  const { certificate, advance, report } = row;
  const group = advance?.group;
  // A group's report on a seat it covers: its figures are the holder's.
  const ownReport = !!report && !report.group;
  return [
    certificate?.name ?? "",
    manilaDay(certificate?.uploadedAt),
    advance?.advanceNo ?? "",
    advance?.status ?? "",
    advance && RELEASED.has(advance.status) ? csvMoney(advance.share ?? advance.amount) : "",
    group?.isHolder ? csvMoney(advance?.amount) : "",
    group?.holder ?? "",
    advance?.dvNo ?? "",
    advance?.dvDate ?? "",
    advance?.refundOrNo ?? "",
    manilaDay(advance?.refundedAt),
    report?.submissionNo ?? "",
    report?.status ?? "",
    report?.claimType ?? "",
    report ? (report.group ? "Yes (filed by the holder)" : group ? "Yes" : "No") : "",
    ownReport ? csvMoney(report?.totalSpent) : "",
    ownReport ? csvMoney(report?.refund?.amount) : "",
    ownReport ? (report?.refund?.orNo ?? "") : ""
  ];
}

export function historyCsvRows(data: EmployeeTrainingHistory, subtitle: string): unknown[][] {
  const headings = [
    "Fiscal Year", "Kind", "Title", "Start Date", "End Date", "Venue", "Hours", "Facilitator or Organizer", "Attendance or Record Status",
    "Seat", "In Lieu Of", "Replaced By", ...SEAT_RECORD_HEADINGS, "Remarks"
  ];
  const blankRecords = SEAT_RECORD_HEADINGS.map(() => "");
  const rows = data.rows.map(row => row.kind === "seminar"
    ? [
        row.fiscalYear, "Seminar", row.title, row.startDate, row.endDate, row.venue, row.hours, row.facilitator, attendanceWord(row),
        seatWord(row.seat), row.inLieuOf ?? "", row.replacedBy ?? "", ...seatRecordCells(row), ""
      ]
    : [
        row.fiscalYear, "HR record", row.title, row.dateConducted, "", "", row.hours, row.organizer,
        // A returned record doesn't count (the user's decision, 2026-11-03).
        row.status === "Returned" || row.status === "Rejected" ? `${row.status} (not counted)` : row.status || "Pending verification",
        "", "", "", row.certificateFilename, ...blankRecords.slice(1), row.remarks ?? ""
      ]);
  return [...MASTHEAD, ["EMPLOYEE TRAINING HISTORY"], [subtitle], ["As of", data.asOf ?? ""], [], headings, ...rows];
}

const programRowCells = (row: TrainingProgramReportRow) => [
  row.fullName, row.employeeId, row.position, row.division, seatWord(row.seat), row.inLieuOf ?? "", row.replacedBy ?? "",
  attendanceWord(row),
  ...seatRecordCells(row)
];

export function programCsvRows(data: TrainingProgramReport): unknown[][] {
  const { program, budget, totals } = data;
  return [
    ...MASTHEAD,
    ["TRAINING PROGRAM REPORT"],
    [program.title],
    ["As of", data.asOf],
    [],
    ["Fiscal Year", program.fiscalYear],
    ["Start Date", program.startDate],
    ["End Date", program.endDate],
    ["Start Time", program.startTime],
    ["End Time", program.endTime],
    ["Venue", program.venue],
    ["Facilitator", program.facilitator],
    ["Hours", program.hours],
    ["Seats", program.seats],
    ["Status", whenWord(program.when)],
    ["Archived", program.archived ? "Yes" : "No"],
    [],
    ["Allocated", csvMoney(budget.allocated)],
    ["Spent", csvMoney(budget.spent)],
    ["Cash Still Out", csvMoney(budget.outstanding)],
    ["Back in Unallocated", csvMoney(budget.back)],
    [],
    ["Name", "Staff Code", "Position", "Division", "Seat", "In Lieu Of", "Replaced By", "Attendance", ...SEAT_RECORD_HEADINGS],
    ...data.rows.map(programRowCells),
    [],
    [TOTALS_NOTE],
    ["Enrolled", totals.enrolled],
    ["Attended", totals.attended],
    ["Did Not Attend", totals.didNotAttend],
    ["Attendance Not Recorded", totals.notRecorded],
    ["Certificates on File", totals.certificates],
    ["Replaced by a Representative", totals.replaced],
    ["Taken off the Seminar", totals.cancelled],
    ["Cash Advanced", csvMoney(totals.advanced)],
    ["Handed Back", csvMoney(totals.handedBack)],
    ["Reports Filed", totals.reports],
    ["Reports Validated", totals.validated]
  ];
}

export function completedCsvRows(data: CompletedTrainingPrograms): unknown[][] {
  const { totals } = data;
  return [
    ...MASTHEAD,
    ["COMPLETED TRAINING PROGRAMS"],
    [`FY ${data.fiscalYear}`],
    ["As of", data.asOf],
    [],
    ["Title", "Start Date", "End Date", "Venue", "Hours", "Enrolled", "Attended", "Allocated", "Spent", "Archived"],
    ...data.rows.map(row => [
      row.title, row.startDate, row.endDate, row.venue, row.hours, row.enrolled, row.attended, csvMoney(row.allocated), csvMoney(row.spent), row.archived ? "Yes" : "No"
    ]),
    [`Total (${plural(totals.programs, "seminar")})`, "", "", "", totals.hours, totals.enrolled, totals.attended, csvMoney(totals.allocated), csvMoney(totals.spent), ""]
  ];
}

/** What a seminar's totals count, said where they are given. */
export const TOTALS_NOTE = "Totals count each cash advance and liquidation report once, however many seats it covers: cash advanced is what Finance released, and handed back is what validated reports returned or a refund in full. The seat columns above are each seat's own records as they stand.";

export function coverageCsvRows(data: TrainingCoverage): unknown[][] {
  return [
    ...MASTHEAD,
    ["EMPLOYEES WITH NO TRAINING YET"],
    [`FY ${data.fiscalYear}`],
    ["As of", data.asOf ?? ""],
    [coverageSentence(data)],
    [],
    ["Name", "Position", "Division"],
    ...data.withoutTraining.map(row => [row.fullName, row.position, row.division])
  ];
}
