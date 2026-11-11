// HR's dashboard (12ag Part B): what its charts and its follow-up list call things, and their colours. Pure (no React),
// shared by the panels in this folder; tested (tests/hrFormat.test.ts). The figures are the server's
// (src/hrDashboard.ts, GET /api/dashboard/hr): nothing here counts what the reply doesn't already hold.
import { isCalendarDate } from "../../../inputText";
import type { HrDashboard, HrFollowUpRow, HrFollowUpStage, HrSeminarAttendance } from "../../../types";
import { percentOf } from "../chartFormat";
import { dateRange, dayDiff } from "../schedule";

// Status colours only where a chart's parts are statuses (attended, did not attend, not yet), so they read as they do on
// HR's attendance list; counts of people are HSAC navy (chartFormat's NAVY). The -600 shades: each keeps 3:1 against
// white, as a chart's marks must. Never purple: it marks "Outside the TDP" (12ae).
/** emerald-600: attended. */
export const ATTENDED_GREEN = "#059669";
/** amber-600: not yet attended, or attendance still to record. */
export const PENDING_AMBER = "#d97706";
/** rose-600: did not attend. */
export const ABSENT_ROSE = "#e11d48";

/** Where a seat's money stands, in the office's words (a liquidation's; `stageLabel` words a claim's). */
export const STAGE_LABEL: Record<HrFollowUpStage, string> = {
  requested: "Cash advance with Finance",
  noReport: "Cash advance released, no report yet",
  withHr: "Report with HR",
  withFinance: "Report with Finance",
  returned: "Returned for correction",
  reimbursementUnpaid: "Reimbursement validated, payment pending",
  attendanceUnrecorded: "Attendance not recorded yet",
  refundDue: "Did not attend: cash advance to refund"
};

/** A row's stage in words: a reimbursement claim (`claim`) says so at each step. */
export function stageLabel(row: Pick<HrFollowUpRow, "stage" | "claim">): string {
  if (row.claim) {
    if (row.stage === "withHr") return "Reimbursement with HR";
    if (row.stage === "withFinance") return "Reimbursement with Finance";
    if (row.stage === "returned") return "Reimbursement returned for correction";
  }
  return STAGE_LABEL[row.stage] ?? "Not known";
}

export type BadgeTone = "amber" | "blue" | "rose" | "emerald" | "slate";

/** The house badge: -50 background, -700 text, -200 border (blue is HSAC navy). */
export const TONE_BADGE: Record<BadgeTone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600"
};

/**
 * A stage's colour: amber where someone has to act (the employee files or corrects, HR verifies, the payment is still
 * owed), blue where it is in progress with another office, rose for a report sent back. The Liquidation Desk's own
 * report badges agree (finance/overviewFigures.ts: with HR amber, with Finance blue, returned rose).
 */
export const STAGE_TONE: Record<HrFollowUpStage, BadgeTone> = {
  requested: "blue",
  noReport: "amber",
  withHr: "amber",
  withFinance: "blue",
  returned: "rose",
  reimbursementUnpaid: "amber",
  attendanceUnrecorded: "amber",
  refundDue: "amber"
};

/**
 * Who acts next on a row. A covered member of a group's advance (`group`) waits on its holder, who files the report.
 * Someone no longer with the office (`withOffice: false`) can't sign in to file or correct their own report, and Finance
 * releases nothing to them (12ab), so their row says so (the security review of 12ag Part B).
 */
export function nextStep(row: Pick<HrFollowUpRow, "stage" | "group"> & { withOffice?: boolean; claim?: boolean }): string {
  if (row.withOffice === false && !row.group) {
    if (row.stage === "requested") return "Finance declines the cash advance: they have left the office";
    if (row.stage === "noReport") return "Their logins are closed: the Administrator restores one so they can file the report";
    if (row.stage === "returned") return "Their logins are closed: the Administrator restores one so they can correct the report";
  }
  switch (row.stage) {
    case "requested": return "Finance releases or declines the cash advance";
    case "noReport": return row.group ? "The group's holder files the report" : "The employee files the report";
    case "withHr": return row.claim ? "HR verifies the claim" : "HR verifies the report";
    case "withFinance": return row.claim ? "Finance validates the claim" : "Finance validates the report";
    case "returned": return row.group ? "The group's holder corrects the report" : row.claim ? "The employee corrects the claim" : "The employee corrects the report";
    case "reimbursementUnpaid": return "Finance records the payment";
    // (HR records it on the employee's certificate of attendance, which they upload first when it isn't on file.)
    case "attendanceUnrecorded": return "The certificate of attendance, then HR records the attendance, so the report can be filed";
    case "refundDue": return "The employee hands the cash advance back; Finance records the refund";
    default: return "";
  }
}

/** "1 employee", "3 employees". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "64%" of the whole, or "—" when there is no whole to measure against. */
export function percentText(part: number, whole: number): string {
  const p = percentOf(Number(part) || 0, Number(whole) || 0);
  return p === null ? "—" : `${p}%`;
}

/** Text cut to `max` characters with an ellipsis, for an axis. */
export function shortText(text: unknown, max: number): string {
  const s = typeof text === "string" ? text : String(text ?? "");
  return s.length > max ? `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…` : s;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEAR_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "Oct 2026" from "2026-10"; anything else as it came. */
export function monthShort(ym: string): string {
  const m = YEAR_MONTH.exec(String(ym ?? ""));
  return m ? `${MONTHS[Number(m[2]) - 1].slice(0, 3)} ${m[1]}` : String(ym ?? "");
}

/** "October 2026" from "2026-10"; anything else as it came. */
export function monthLong(ym: string): string {
  const m = YEAR_MONTH.exec(String(ym ?? ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(ym ?? "");
}

/** A month's two lines under the chart: ["Oct", "2026"]. */
export function monthTick(ym: string): [string, string] {
  const m = YEAR_MONTH.exec(String(ym ?? ""));
  return m ? [MONTHS[Number(m[2]) - 1].slice(0, 3), m[1]] : [String(ym ?? ""), ""];
}

/**
 * "Nov 11, 2026": a calendar day (YYYY-MM-DD) read as one, never through the PC's time zone (`formatDate` reads it as
 * UTC midnight, so west of UTC it would show the day before). "Not set" when there is none.
 */
export function dayText(iso: string | null | undefined): string {
  return isCalendarDate(iso) ? dateRange(iso, iso) : "Not set";
}

/**
 * What a report's due date means on `asOf`: how late it is when overdue; for a report still to be filed or corrected,
 * attendance still to be recorded, or cash still to be handed back, how soon it is due (the employee is reminded on the
 * same days). Nothing for a report already with a reviewer (it was filed; HR and Finance have their own pace).
 */
export function dueNote(row: Pick<HrFollowUpRow, "dueDate" | "overdue" | "stage">, asOf: string): string | null {
  if (!isCalendarDate(row.dueDate) || !isCalendarDate(asOf)) return null;
  const days = dayDiff(asOf, row.dueDate);
  if (row.overdue) return `${plural(Math.max(1, -days), "day")} late`;
  if (!["noReport", "returned", "attendanceUnrecorded", "refundDue"].includes(row.stage)) return null;
  if (days < 0) return null;
  return days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

export type TrainingsBucket = HrDashboard["trainingsPerEmployee"][number]["trainings"];

export const BUCKET_LABEL: Record<TrainingsBucket, string> = { "0": "0", "1": "1", "2": "2", "3+": "3 or more" };

/** "5 employees haven't attended a training yet", "1 employee attended 1 training", "2 employees attended 3 or more trainings". */
export function bucketPhrase(trainings: TrainingsBucket, employees: number): string {
  const who = plural(employees, "employee");
  if (trainings === "0") return `${who} ${employees === 1 ? "hasn't" : "haven't"} attended a training yet`;
  return `${who} attended ${trainings === "3+" ? "3 or more trainings" : plural(Number(trainings), "training")}`;
}

/** "No trainings recorded by HR", "1 training recorded by HR", "3 trainings recorded by HR". */
export const recordsPhrase = (n: number) => (n > 0 ? `${plural(n, "training")} recorded by HR` : "No trainings recorded by HR");

/** The first `max` names, and how many more there are (a tooltip names about a dozen). */
export function namesPreview(names: readonly unknown[] | null | undefined, max = 12): { shown: string[]; more: number } {
  const list = (names ?? []).filter((n): n is string => typeof n === "string" && n !== "");
  return { shown: list.slice(0, max), more: Math.max(0, list.length - max) };
}

/**
 * The seminars someone attended, for the attendance ring's tooltip: the most attended first, then the earliest, at most
 * `max`, with how many more there are. A seminar nobody attended (yet) isn't one they attended.
 */
export function seminarsAttended(seminars: readonly HrSeminarAttendance[] | null | undefined, max = 10): {
  shown: HrSeminarAttendance[];
  more: number;
} {
  const list = (seminars ?? [])
    .filter(s => !!s && Number(s.attended) > 0)
    .sort((a, b) => b.attended - a.attended || String(a.startDate).localeCompare(String(b.startDate)) || String(a.title).localeCompare(String(b.title)));
  return { shown: list.slice(0, max), more: Math.max(0, list.length - max) };
}

/** Everyone seated on a seminar: attended, did not attend, or still to record. */
export const seatedOn = (s: Pick<HrSeminarAttendance, "attended" | "didNotAttend" | "toRecord">) =>
  (Number(s.attended) || 0) + (Number(s.didNotAttend) || 0) + (Number(s.toRecord) || 0);
