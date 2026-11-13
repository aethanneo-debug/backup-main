// A seminar the employee paid for out of their own pocket (HSAC RAB 1 allows it, as the user relayed on
// 2026-10-30; known-issues 12q). A seminar's report is otherwise a Liquidation of the cash advance Finance
// released for the seat (the seminar budget flow, 2026-10-19). With no advance waiting or released for the
// seat, it is a Reimbursement instead: what they spent, up to their share of the seminar's budget less what
// the office paid for them directly (HR's own expense entries), with the official receipts attached.
// Finance pays it from the Reimbursement Queue once it is validated. The employee's form and the server
// run the same checks.
import { centavos, pesos } from "./liquidationMoney";
import { isCalendarDate } from "./inputText";

export type SeminarClaimMode = "liquidation" | "waiting" | "reimbursement";

/** The period a seminar's report covers: the seminar's own first and last days, which HR sets (the user's request of
 * 2026-11-10, known-issues 12af), as a liquidation report states the activity's dates. null when they aren't both real
 * dates in order (an older seminar), and the report keeps what was typed. */
export function seminarPeriod(startDate: unknown, endDate: unknown): { from: string; to: string } | null {
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate) || endDate < startDate) return null;
  return { from: startDate, to: endDate };
}

/** How a seat's report settles, from its current cash advance (the latest record for it, if any):
 * released, a Liquidation of it; a request waiting for Finance, nothing yet (Finance releases or declines
 * it first, so the seat is never funded twice); none, declined or refunded, a Reimbursement. Since 2026-11-12
 * HR's "Attended" closes a request still waiting (12ai), so "waiting" arises only before attendance is recorded. */
export function seminarClaimMode(advanceStatus: string | null | undefined): SeminarClaimMode {
  if (advanceStatus === "Released" || advanceStatus === "Liquidated") return "liquidation";
  if (advanceStatus === "Requested") return "waiting";
  return "reimbursement";
}

/** Why asking for a seat's cash advance is closed. */
export type AdvanceWindowClosed = "attended" | "certificate" | "lastDay";

/** The reason stored on a cash advance request that HR's "Attended" closed before Finance released it (12ai). The
 * request is "Declined" either way; this tells such a closure from Finance's own decline, on the server (the release's
 * refusal) and on the screens. */
export const CLOSED_BY_ATTENDANCE = "HR recorded the seminar's attendance before Finance released it, so the seminar is claimed back as a reimbursement.";

/** Whether a declined cash advance request was closed by HR's "Attended" rather than declined by Finance. */
export const closedByAttendance = (advance: { status?: unknown; declineReason?: unknown } | null | undefined): boolean =>
  !!advance && advance.status === "Declined" && advance.declineReason === CLOSED_BY_ATTENDANCE;

/** How long after HR's attendance closed a request its release can still be recorded, as cash handed out before it (the
 * user's decision of 2026-11-13): Finance is told at the closure, and after this the request stays closed for good. */
export const LATE_RELEASE_DAYS = 30;

/** The last Manila day a closed request's release can be recorded (YYYY-MM-DD), or "" when the closing day isn't a date. */
export function lateReleaseUntil(closedOn: unknown): string {
  if (!isCalendarDate(closedOn)) return "";
  return new Date(Date.parse(`${closedOn}T00:00:00Z`) + LATE_RELEASE_DAYS * 86400000).toISOString().slice(0, 10);
}

/** Whether a new cash advance request for a seat is closed, and why, or null while it is open (the user's rule of
 * 2026-11-12, known-issues 12ai). A cash advance is asked for before the seminar: HR's "Attended" decides the seat's
 * money path (a released advance is liquidated; otherwise the seminar is claimed back as a reimbursement), and asking
 * closes before that, from the seminar's last day, the day a certificate of attendance can first be uploaded, or as soon
 * as one is on file, so a later change of the seminar's dates can't reopen it. A seminar with no dates stays open.
 * "Did not attend" keeps the caller's own reason. Finance may still release a request made before, until HR records
 * the attendance. */
export function advanceRequestWindow(seat: {
  attendance?: string | null;
  hasCertificate: boolean;
  /** The seminar's last day (`seminarLastDay`), "" when it has no dates. */
  lastDay: string;
  /** Manila's day. */
  today: string;
}): AdvanceWindowClosed | null {
  if (seat.attendance === "Attended") return "attended";
  if (seat.hasCertificate) return "certificate";
  if (isCalendarDate(seat.lastDay) && isCalendarDate(seat.today) && seat.today >= seat.lastDay) return "lastDay";
  return null;
}

/** A claim Finance has validated and not yet paid: what the Reimbursement Queue offers to pay (the server refuses to
 * pay a report not yet validated). Moved here from finance/claimChecks.ts, which still exports it, so a shared rule
 * (HR's dashboard, src/hrDashboard.ts) doesn't reach into the screens. */
export function isPayableClaim(sub: { status?: unknown; reimbursementStatus?: unknown; reimbursementAmount?: unknown } | null | undefined): boolean {
  return sub?.status === "Completed" && sub?.reimbursementStatus === "Awaiting Reimbursement" && Number(sub?.reimbursementAmount || 0) > 0;
}

/** What the employee can claim back: their allowance less what HR recorded as spent for them by hand
 * (money the office paid itself), never below zero nor above the allowance (a stray negative figure
 * can't raise it). */
export function reimbursementLimit(allowance: number | string | null | undefined, handEntered: number | string | null | undefined): number {
  const share = Math.max(0, centavos(allowance));
  return pesos(Math.min(share, Math.max(0, share - Math.max(0, centavos(handEntered)))));
}

/** Why a reimbursement can't be filed as it is, or "" when it can. `files` is how many documents are
 * attached; leave it out where none can be added (a correction that didn't ask for one). `money` words an
 * amount the way the caller does ("PHP 1,500.00" on the server, "₱1,500.00" on screen). */
export function reimbursementProblem(
  form: { spent: number; limit: number; files?: number },
  money: (amount: number) => string
): string {
  if (!(centavos(form.limit) > 0)) {
    return "Nothing is left of your share of this seminar's budget to claim back. Ask HR about it.";
  }
  if (!(centavos(form.spent) > 0)) return "A reimbursement claims back what you spent: enter at least one amount above zero.";
  if (centavos(form.spent) > centavos(form.limit)) {
    return `Your items come to ${money(form.spent)}, ${money(pesos(centavos(form.spent) - centavos(form.limit)))} more than you can claim back (${money(form.limit)}: your share of the seminar's budget, less anything the office paid for you). Lower or remove an item.`;
  }
  if (form.files !== undefined && form.files < 1) return "Attach your official receipts (OR) for what you paid.";
  return "";
}
