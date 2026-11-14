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
 * it first, so the seat is never funded twice); none, declined, expired or refunded, a Reimbursement. Since
 * 2026-11-14 a request still waiting expires on the seminar's first day (requestDueToExpire), and HR records the
 * attendance only once the seminar has ended, so "waiting" arises only before the seminar. */
export function seminarClaimMode(advanceStatus: string | null | undefined): SeminarClaimMode {
  if (advanceStatus === "Released" || advanceStatus === "Liquidated") return "liquidation";
  if (advanceStatus === "Requested") return "waiting";
  return "reimbursement";
}

/** Why asking for a seat's cash advance is closed. */
export type AdvanceWindowClosed = "attended" | "certificate" | "firstDay";

/** The reason stored on a cash advance request that HR's "Attended" closed before Finance released it (12ai, from
 * 2026-11-12 to 2026-11-14). The request is "Declined" either way; this tells such a closure from Finance's own decline,
 * on the server (the release's refusal) and on the screens. Since 2026-11-14 recording attendance never touches a cash
 * advance request (the user's rule), so only requests closed in those days carry it. */
export const CLOSED_BY_ATTENDANCE = "HR recorded the seminar's attendance before Finance released it, so the seminar is claimed back as a reimbursement.";

/** Whether a declined cash advance request was closed by HR's "Attended" rather than declined by Finance. */
export const closedByAttendance = (advance: { status?: unknown; declineReason?: unknown } | null | undefined): boolean =>
  !!advance && advance.status === "Declined" && advance.declineReason === CLOSED_BY_ATTENDANCE;

/** The reason stored on a cash advance request that expired (the user's rule of 2026-11-14): Finance hadn't released
 * or declined it by the seminar's first day. The request is "Declined", with `expiredAt` set (requestExpired), so the
 * seat is a reimbursement, as after any decline, and the record keeps why. */
export const EXPIRED_UNPROCESSED = "Finance didn't release or decline this request before the seminar's first day, so it expired: the seminar is claimed back as a reimbursement.";

/** Whether a cash advance request expired, rather than being declined by Finance or closed by HR's attendance. */
export const requestExpired = (advance: { status?: unknown; declineReason?: unknown; expiredAt?: unknown } | null | undefined): boolean =>
  !!advance && advance.status === "Declined" && typeof advance.expiredAt === "string" && advance.expiredAt !== "";

/** Whether a request still waiting for Finance is due to expire now: Manila's day is the seminar's first day or later
 * (the user's rule of 2026-11-14). For a group's request, the whole of it. A seminar with no dates never expires one. */
export function requestDueToExpire(request: { status?: unknown } | null | undefined, firstDay: string, today: string): boolean {
  return !!request && request.status === "Requested" && isCalendarDate(firstDay) && isCalendarDate(today) && today >= firstDay;
}

/** Whether a new cash advance request for a seat is closed, and why, or null while it is open. A cash advance is asked
 * for before the seminar (the user's rule of 2026-11-14, which moved 12ai's last day to the first): asking closes on the
 * seminar's first day, since nobody asks for one in the middle of a seminar, or as soon as a certificate of attendance
 * is on file or HR records "Attended", so a later change of the seminar's dates can't reopen it. A request still waiting
 * then expires on the first day (requestDueToExpire). A seminar with no dates stays open. "Did not attend" keeps the
 * caller's own reason. */
export function advanceRequestWindow(seat: {
  attendance?: string | null;
  hasCertificate: boolean;
  /** The seminar's first day (`seminarFirstDay`), "" when it has no dates. */
  firstDay: string;
  /** Manila's day. */
  today: string;
}): AdvanceWindowClosed | null {
  if (seat.attendance === "Attended") return "attended";
  if (seat.hasCertificate) return "certificate";
  if (isCalendarDate(seat.firstDay) && isCalendarDate(seat.today) && seat.today >= seat.firstDay) return "firstDay";
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
