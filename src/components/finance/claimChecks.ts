// What Finance has to look at before paying a claim, on the Reimbursement Queue and in a report's View.
import type { Report } from "../liquidation/reportColumns";

type Claim = Partial<Report> | null | undefined;

/**
 * HR set money aside but the claimant says they received less. Either the advance really
 * was never released (the legitimate case this whole flow exists for), or the claim would
 * pay out money already advanced. Finance cannot read the HR training tables, so this
 * stamped figure is the only thing that makes the difference visible.
 */
export function mismatch(sub: Claim): boolean {
  if (sub?.allocatedAtFiling === undefined) return false;
  return Number(sub.allocatedAtFiling) > Number(sub.totalReleased || 0);
}

/** Shown in red: a mismatch, but not on a seminar paid out of pocket, which has no advance by design. */
export const flagged = (sub: Claim) => mismatch(sub) && !sub?.withinAllowance;

/** The server refuses to pay a report that is not yet validated: this is what can be paid. */
export const isPayableClaim = (sub: Claim) =>
  sub?.status === "Completed" && sub?.reimbursementStatus === "Awaiting Reimbursement" && Number(sub?.reimbursementAmount || 0) > 0;

/** The Manila day of a stored timestamp (YYYY-MM-DD), or "" when there is none. */
export function manilaDay(at: unknown): string {
  const t = Date.parse(String(at || ""));
  return Number.isFinite(t) ? new Date(t + 8 * 3600e3).toISOString().slice(0, 10) : "";
}
