// A seminar the employee paid for out of their own pocket (HSAC RAB 1 allows it, as the user relayed on
// 2026-10-30; known-issues 12q). A seminar's report is otherwise a Liquidation of the cash advance Finance
// released for the seat (the seminar budget flow, 2026-10-19). With no advance waiting or released for the
// seat, it is a Reimbursement instead: what they spent, up to their share of the seminar's budget less what
// the office paid for them directly (HR's own expense entries), with the official receipts attached.
// Finance pays it from the Reimbursement Queue once it is validated. The employee's form and the server
// run the same checks.
import { centavos, pesos } from "./liquidationMoney";

export type SeminarClaimMode = "liquidation" | "waiting" | "reimbursement";

/** How a seat's report settles, from its current cash advance (the latest record for it, if any):
 * released, a Liquidation of it; a request waiting for Finance, nothing yet (Finance releases or declines
 * it first, so the seat is never funded twice); none, declined or refunded, a Reimbursement. */
export function seminarClaimMode(advanceStatus: string | null | undefined): SeminarClaimMode {
  if (advanceStatus === "Released" || advanceStatus === "Liquidated") return "liquidation";
  if (advanceStatus === "Requested") return "waiting";
  return "reimbursement";
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
