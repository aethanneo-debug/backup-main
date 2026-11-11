// HR's dashboard (the instructor's suggestions of 2026-11-11, known-issues 12ag Part B): how many staff there are and
// where; how many trainings each attended in a fiscal year, and in which months; who attended each seminar; and whose
// money isn't settled yet. Pure, built only on the rules the training screens already use:
//   - who counts: the staff still with the office (the route passes them, `staffStillWithOffice`, src/staffStatus.ts);
//   - what was attended: `seatAttended` (Plan D's rule: HR's attendance record, or for an older seat never marked, a
//     filed or settled report) and `yearTrainingEntries` (src/trainingCoverage.ts) on those seats and the year's
//     seminars not archived before use, with HR's records that still count (12r);
//   - where a seat's money stands: its cash advance and the report that settles it, its own or a group's
//     (`advancesCovering`, `currentAdvance`, `reportCovering`, src/advanceCoverage.ts), and Finance's own rule for a
//     claim validated but not yet paid (`isPayableClaim`, src/reimbursement.ts). Never the enrolment's status:
//     validation marks a seat "Liquidated" even while its reimbursement is unpaid.
// The charts are the chosen fiscal year's; the follow-up list holds every year's open money, since cash doesn't wait
// for the year (an early-opened year would otherwise hide last year's overdue advances: the code review of Part B).
// Tested (tests/hrDashboard.test.ts).
import { RAW_TEXT_MAX, cleanText } from "./inputText";
import { advancesCovering, currentAdvance, isGroupAdvance, nobodyCoveredAttended, reportCovering, type CoverableReport, type DatedAdvance } from "./advanceCoverage";
import { seatAttended, yearTrainingEntries, type CoverageFiscalYear, type CoverageRecord } from "./trainingCoverage";
import { seminarSpan, seminarTitle } from "./trainingCalendar";
import { isPayableClaim } from "./reimbursement";
import { DIVISIONS, type HrCount, type HrDashboard, type HrFollowUpRow, type HrFollowUpStage, type HrNoClaimRow, type HrSeminarAttendance } from "./types";

export interface HrStaffInput {
  id: string;
  employeeId?: string;
  division?: unknown;
  employmentStatus?: unknown;
}

export interface HrSeatInput {
  id: string;
  employeeId: string;
  trainingProgramId: string;
  status?: string;
  attendance?: string;
}

export interface HrProgramInput {
  id: string;
  title?: unknown;
  fiscalYear?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  archivedBeforeUse?: unknown;
}

export interface HrReportInput extends CoverableReport {
  id: string;
  status?: string;
  submissionNo?: unknown;
  withinAllowance?: unknown;
  claimType?: unknown;
  reimbursementStatus?: unknown;
  reimbursementAmount?: unknown;
}

export interface HrExpenseInput {
  trainingParticipantId?: unknown;
  /** "report" for rows written by a validated report; anything else HR entered by hand. */
  source?: unknown;
  amount?: unknown;
}

export interface HrDashboardInput {
  /** The staff still with the office. */
  staff: readonly HrStaffInput[];
  seats: readonly HrSeatInput[];
  programs: readonly HrProgramInput[];
  records: readonly CoverageRecord[];
  advances: readonly DatedAdvance[];
  reports: readonly HrReportInput[];
  /** HR's hand-entered seminar expenses (`trainingLiquidations`); those not from a report were paid by the office. */
  expenses: readonly HrExpenseInput[];
  fiscalYear: CoverageFiscalYear;
  /** Manila's day, YYYY-MM-DD. */
  today: string;
  /** A seminar's liquidation due date (the server's `liquidationDueDateFor`: 30 days after it ends), or null. */
  dueDateOf: (program: { endDate?: string }) => string | null;
  /** Who a seat's employee key names (the server's `employeeByKey`, internal id first): their name, and whether they
   * are still with the office. null when no staff record carries it. */
  personOf: (key: string) => { name: string; withOffice: boolean } | null;
}

export const NO_DIVISION = "No division recorded";
export const NO_STATUS = "Not recorded";
/** How far apart the first and last month may be for the months between to be shown as zeros. */
const MONTH_GAP_LIMIT = 24;
const UNCOUNTED = new Set(["Cancelled", "Archived"]);

const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const text = (v: unknown, max: number) => (typeof v === "string" ? cleanText(v.slice(0, RAW_TEXT_MAX)).slice(0, max) : "");
/** A year as text or a number only: String() of a stored object can throw. */
const yearText = (v: unknown) => (typeof v === "number" ? String(v) : text(v, 20));
const byName = (a: string, b: string) => a.localeCompare(b);

/** Counts by name. Divisions: the account form's list first, in its order, then any other, "No division" last. */
function tally(names: string[], order: "divisions" | "count"): HrCount[] {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const rows = [...counts].map(([name, count]) => ({ name, count }));
  if (order === "count") return rows.sort((a, b) => b.count - a.count || byName(a.name, b.name));
  const rank = (name: string) => {
    const i = (DIVISIONS as readonly string[]).indexOf(name);
    return name === NO_DIVISION ? Number.MAX_SAFE_INTEGER : i >= 0 ? i : DIVISIONS.length;
  };
  return rows.sort((a, b) => rank(a.name) - rank(b.name) || byName(a.name, b.name));
}

/** Every month from the first to the last (YYYY-MM), when they are at most MONTH_GAP_LIMIT apart; else just these. */
function monthRange(months: string[]): string[] {
  const sorted = [...new Set(months)].sort();
  if (sorted.length < 2) return sorted;
  const index = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
  const first = index(sorted[0]), last = index(sorted[sorted.length - 1]);
  if (last - first > MONTH_GAP_LIMIT) return sorted;
  const out: string[] = [];
  for (let i = first; i <= last; i++) out.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
  return out;
}

/** Whether a report is a reimbursement claim (the office owes the employee) rather than a liquidation of cash out. */
export const isClaim = (report: Pick<HrReportInput, "withinAllowance" | "claimType"> | null) =>
  !!report && (report.withinAllowance === true || report.claimType === "Reimbursement");

/** Where an attendee's money stands, from the report that settles it and its current cash advance. */
export function seatStage(
  seat: Pick<HrSeatInput, "status">,
  report: HrReportInput | null,
  advance: Pick<DatedAdvance, "status"> | null
): HrFollowUpStage | "settled" | "noClaim" {
  if (report) {
    switch (report.status) {
      case "Completed":
      case "Approved":
        return isPayableClaim(report) ? "reimbursementUnpaid" : "settled";
      case "Returned":
        return "returned";
      case "Pending HR Review":
        return "withHr";
      case "Verified & Forwarded":
        return "withFinance";
      default:
        // A status nothing writes any more ("Rejected", "Validated & Endorsed"): closed.
        return "settled";
    }
  }
  if (advance?.status === "Requested") return "requested";
  if (advance?.status === "Released") return "noReport";
  // Settled by older code with no report on file.
  if (seat.status === "Liquidated" || advance?.status === "Liquidated") return "settled";
  // None, declined, refunded (before the seminar, for one who went after all) or cancelled: a reimbursement may still
  // be filed (seminarClaimMode), or nothing will be claimed.
  return "noClaim";
}

const STAGE_ORDER: Record<HrFollowUpStage, number> = {
  noReport: 0, attendanceUnrecorded: 1, returned: 2, refundDue: 3, requested: 4, withHr: 5, withFinance: 6, reimbursementUnpaid: 7
};

export function hrDashboard(input: HrDashboardInput): HrDashboard {
  const { fiscalYear, today } = input;
  const label = String(fiscalYear.label);
  const staff = (input.staff ?? []).filter((s): s is HrStaffInput => isRecord(s) && typeof s.id === "string");
  const seats = (input.seats ?? []).filter((s): s is HrSeatInput => isRecord(s) && typeof s.id === "string" && typeof s.trainingProgramId === "string" && typeof s.employeeId === "string");
  // The seminars that can hold attendance: none archived before use (never held, 12t). Their fields are read as text,
  // and a start day only when the dates are real (seminarSpan), so the shared counter's String() can't meet a stored
  // object and a month is never read from a date that isn't one.
  const held = (input.programs ?? [])
    .filter((p): p is HrProgramInput => isRecord(p) && typeof p.id === "string" && !!p.id && !p.archivedBeforeUse)
    .map(p => {
      const span = seminarSpan(p);
      return { ...p, id: p.id, title: seminarTitle(p.title) || "Untitled seminar", fiscalYear: yearText(p.fiscalYear), startDate: span?.from, span };
    });
  const heldById = new Map(held.map(p => [p.id, p] as const));
  const records = (input.records ?? []).filter((r): r is CoverageRecord => isRecord(r) && typeof r.employeeId === "string")
    .map(r => ({ ...r, title: text(r.title, 300) || "Training", dateConducted: typeof r.dateConducted === "string" ? r.dateConducted : undefined, status: typeof r.status === "string" ? r.status : undefined }));
  const attendedSeats = seats.filter(s => seatAttended(s));
  const advances = (input.advances ?? []).filter((a): a is DatedAdvance => isRecord(a) && typeof a.id === "string");
  const reports = (input.reports ?? []).filter((r): r is HrReportInput => isRecord(r) && typeof r.id === "string");
  const person = (key: string) => input.personOf(key) ?? { name: "Unnamed employee", withOffice: false };

  // Headcount.
  const headcount = {
    total: staff.length,
    byDivision: tally(staff.map(s => text(s.division, 120) || NO_DIVISION), "divisions"),
    byStatus: tally(staff.map(s => text(s.employmentStatus, 60) || NO_STATUS), "count")
  };

  // What each of the staff attended in the year (the coverage rule, on attended seats only).
  const entriesOf = yearTrainingEntries({ enrolments: attendedSeats, programs: held, records }, fiscalYear);
  const perStaff = staff.map(s => entriesOf(s));
  const buckets = { "0": 0, "1": 0, "2": 0, "3+": 0 };
  for (const list of perStaff) buckets[list.length >= 3 ? "3+" : (String(list.length) as "0" | "1" | "2")]++;
  const trainingsPerEmployee = (["0", "1", "2", "3+"] as const).map(trainings => ({ trainings, employees: buckets[trainings] }));
  const months = new Map<string, { employees: Set<number>; trainings: number }>();
  perStaff.forEach((list, i) => {
    for (const t of list) {
      if (!t.day) continue;
      const month = t.day.slice(0, 7);
      const m = months.get(month) ?? { employees: new Set<number>(), trainings: 0 };
      m.employees.add(i);
      m.trainings++;
      months.set(month, m);
    }
  });
  const attendeesByMonth = monthRange([...months.keys()]).map(month => ({
    month, employees: months.get(month)?.employees.size ?? 0, trainings: months.get(month)?.trainings ?? 0
  }));

  // Each of the year's seminars that has started, with everyone seated on it (as HR's attendance list shows them).
  const seminars: HrSeminarAttendance[] = [];
  for (const p of held) {
    if (p.fiscalYear !== label || !p.span || p.span.from > today) continue;
    const roster = seats.filter(s => s.trainingProgramId === p.id && !UNCOUNTED.has(String(s.status)));
    const attended = roster.filter(s => seatAttended(s));
    const absent = roster.filter(s => s.attendance === "Did not attend");
    seminars.push({
      id: p.id, title: p.title, startDate: p.span.from, endDate: p.span.to,
      attended: attended.length,
      didNotAttend: absent.length,
      toRecord: roster.length - attended.length - absent.length,
      attendees: attended.map(s => person(s.employeeId).name).sort(byName)
    });
  }
  seminars.sort((a, b) => a.startDate.localeCompare(b.startDate) || byName(a.title, b.title) || a.id.localeCompare(b.id));

  // Seats whose money isn't settled, from every fiscal year and whoever's: a seat of someone who has left still has its
  // cash or claim open (12ab keeps seats).
  const rows: HrFollowUpRow[] = [];
  const noClaim: HrNoClaimRow[] = [];
  const seatById = new Map(seats.map(s => [s.id, s] as const));
  for (const seat of seats) {
    if (UNCOUNTED.has(String(seat.status))) continue;
    const program = heldById.get(seat.trainingProgramId);
    if (!program) continue;
    const report = reportCovering(reports, advances, seat.id);
    const advance = currentAdvance(advancesCovering(advances, seat.id));
    const ownAdvance = !!advance && advance.activityId === seat.id && !isGroupAdvance(advance);
    let stage: HrFollowUpStage | "settled" | "noClaim";
    if (seatAttended(seat)) stage = seatStage(seat, report, advance);
    // Recorded "Did not attend" with their own advance still out: the whole of it comes back. So does a group's advance
    // they hold once nobody it covers attended: the holder refunds it once (12v). While someone it covers attended, or
    // isn't recorded yet, the group's cash shows on that person's row instead, so it is never listed twice (the code
    // review of 12ag's cleanups: it was on no row at all).
    else if (seat.attendance === "Did not attend") {
      // (The refund route's own test, shared with the employee's reminders: `nobodyCoveredAttended`.)
      const holdsGroup = !!advance && isGroupAdvance(advance) && advance.activityId === seat.id;
      const nobodyAttended = holdsGroup && nobodyCoveredAttended(advance, id => seatById.get(id));
      stage = !report && advance?.status === "Released" && (ownAdvance || nobodyAttended) ? "refundDue" : "settled";
    }
    // The seminar is over, cash is out, and no report can be filed until HR records the attendance.
    else stage = !report && advance?.status === "Released" && !!program.span && program.span.to < today ? "attendanceUnrecorded" : "settled";
    if (stage === "settled") continue;
    const who = person(seat.employeeId);
    const base = {
      participantId: seat.id, employee: who.name, withOffice: who.withOffice, seminarId: program.id, seminarTitle: program.title,
      endDate: program.span?.to ?? ""
    };
    if (stage === "noClaim") {
      // Only the chosen year's, and only someone still with the office: one who has left can't file a reimbursement
      // (the server refuses it, 12ab) and has nothing open (the security review of 12ag Part B).
      if (program.fiscalYear !== label || !who.withOffice) continue;
      const officePaid = (input.expenses ?? []).some(x => isRecord(x) && x.trainingParticipantId === seat.id && x.source !== "report");
      noClaim.push({ ...base, officePaid });
      continue;
    }
    const claim = isClaim(report);
    // Due 30 days after the seminar, read from its real last day: a refund too, as the employee's reminders count it
    // (12ag's cleanups).
    const dueDate = input.dueDateOf({ endDate: program.span?.to });
    rows.push({
      ...base, fiscalYear: program.fiscalYear, stage, claim, dueDate,
      // Overdue: the report is still to be filed or corrected (or can't be, until HR records the attendance), or the
      // cash still to be handed back, after its due date. Never a claim: no cash is out, the office owes the employee.
      overdue: !!dueDate && today > dueDate && !claim
        && (stage === "noReport" || stage === "returned" || stage === "attendanceUnrecorded" || stage === "refundDue"),
      ...(report ? { reportId: report.id, reportNo: text(report.submissionNo, 40) || undefined } : {}),
      // Covered by someone else's group: the group's report (filed by its holder), or, before one is filed, a group
      // advance still open. A declined group's member who claims on their own isn't (the code review of Part B).
      group: report
        ? report.activityId !== seat.id
        : !!advance && isGroupAdvance(advance) && advance.activityId !== seat.id && (advance.status === "Requested" || advance.status === "Released")
    });
  }
  rows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
    || STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || byName(a.seminarTitle, b.seminarTitle) || byName(a.employee, b.employee));
  noClaim.sort((a, b) => b.endDate.localeCompare(a.endDate) || byName(a.seminarTitle, b.seminarTitle) || byName(a.employee, b.employee));

  return {
    fiscalYear: label,
    asOf: today,
    headcount,
    trainingsPerEmployee,
    attendeesByMonth,
    attendance: {
      attended: perStaff.filter(l => l.length > 0).length,
      total: staff.length,
      recordsCounted: perStaff.reduce((n, l) => n + l.filter(t => t.kind === "record").length, 0),
      seminars
    },
    followUp: { rows, noClaim }
  };
}
