// The Cash Advance Desk's one table (the instructor's review, R8): where each assignment's advance stands, and the
// date it is listed by. Kept apart from the screen so the rules are tested (tests/advanceDeskRows.test.ts).
import { firstTimestamp } from "../../utils";

export interface FundableRow {
  activityId: string;
  activityTitle: string;
  employeeId: string;
  employeeName: string;
  allocated: number;
  assignmentStatus: string;
  funded: boolean;
  advanceNo: string | null;
  advanceAmount: number | null;
  advanceStatus: string | null;
  liquidationFiled: boolean;
  /** HR recorded that the participant did not attend: the advance must come back in full. */
  didNotAttend?: boolean;
  advanceId?: string | null;
  /** Set once the full refund of a non-attendee's advance is recorded. */
  refundOrNo?: string | null;
  refundOrDate?: string | null;
  /** The employee asked for this advance themself: it is released from Cash Advance Requests. */
  pendingRequestId?: string | null;
  /** Why no request can come yet (no Personnel login, no allowance, another advance out), or null. */
  requestBlocked?: string | null;
  /** Why no request can come for this seat any more, or null (12ai): HR recorded "Attended", a certificate of attendance
   * is on file, or the seminar's last day has come, so it is claimed back as a reimbursement. A request already waiting
   * (`pendingRequestId`) can still be released, until HR records the attendance. */
  requestClosed?: string | null;
  requestedAt?: string | null;
  /** The voucher the advance went out on. */
  advanceDvNo?: string | null;
  advanceDvDate?: string | null;
  /** When the assignment was made, and the advance released, settled or refunded (for LIFO). */
  assignedAt?: string | null;
  advanceIssuedAt?: string | null;
  advanceSettledAt?: string | null;
  advanceRefundedAt?: string | null;
  /** A group advance this row holds (HSAC RAB 1): everyone it covers, the holder first. The people
   * it covers have no rows of their own. */
  groupNames?: string[] | null;
  /** Nobody the group covers attended: only then is its advance refunded in full. */
  groupAllAbsent?: boolean;
  /** Their own advance, with the seminar still to come and no attendance recorded: it can be handed back
   * in full (e.g. a representative goes in their place, which waits for it; 12z Part B). */
  refundBeforeSeminar?: boolean;
  /** Handed back before the seminar (as recorded then). */
  refundedBeforeSeminar?: boolean;
  /** A representative went in their place (their enrolment is closed): listed only for the refund. */
  replaced?: boolean;
}

/** The table's chips, in the order an advance moves through them. */
export const ADVANCE_STAGES = [
  { id: "unfunded", label: "Not funded" },
  { id: "released", label: "Released" },
  { id: "settled", label: "Settled" },
  { id: "refunded", label: "Refunded" },
  { id: "returnedEarly", label: "Returned early" }
] as const;
export type AdvanceStage = (typeof ADVANCE_STAGES)[number]["id"];

/**
 * Where a row stands, or null when it has no place on the desk: someone who did not attend or was replaced and has
 * nothing to bring back, a report filed with no advance on record (a reimbursement), which can't take one now, and a
 * seat no request can come for any more with none waiting (claimed back as a reimbursement, 12ai). An advance handed
 * back before the seminar counts as that, even if HR later marked them absent; one refunded after "Did not attend"
 * stays refunded once no request can come, even if HR corrects them back to "Attended".
 */
export function advanceStage(row: FundableRow): AdvanceStage | null {
  if (row.funded) return "released";
  if (row.advanceStatus === "Liquidated") return "settled";
  if (row.advanceStatus === "Refunded" && row.refundedBeforeSeminar) return "returnedEarly";
  if (row.advanceStatus === "Refunded" && (row.didNotAttend || row.requestClosed)) return "refunded";
  if (row.didNotAttend || row.replaced || row.refundedBeforeSeminar || row.liquidationFiled) return null;
  // A request already waiting can still be released, until HR records the attendance.
  if (row.requestClosed && !row.pendingRequestId) return null;
  return "unfunded";
}

/** The assignments liquidated without an advance on record, which the desk only counts. */
export function filedWithoutAdvance(row: FundableRow): boolean {
  return !row.didNotAttend && !row.replaced && !row.refundedBeforeSeminar && !row.funded
    && row.advanceStatus !== "Liquidated" && row.liquidationFiled;
}

/** The assignments no advance can come for any more, with none out, settled or waiting, and no report yet: they are
 * claimed back as reimbursements (12ai). The desk counts them apart, as it counts `filedWithoutAdvance`. */
export function noAdvanceNow(row: FundableRow): boolean {
  return !!row.requestClosed && !row.pendingRequestId && !row.funded && !row.didNotAttend && !row.replaced
    && !row.refundedBeforeSeminar && !row.liquidationFiled && row.advanceStatus !== "Liquidated" && row.advanceStatus !== "Refunded";
}

/** Whether the row's advance is collected back in full: a non-attendee's own, or a group's that nobody it covers
 * attended. (Otherwise the liquidation report settles it.) */
export const refundDue = (row: FundableRow) => (row.groupNames ? !!row.groupAllAbsent : !!row.didNotAttend);

/** The date a row is listed by, newest first (LIFO, the instructor's rule): its own event, the assignment, the
 * release, the settlement or the refund. 0 when it has none. */
export function advanceRowDate(row: FundableRow): number {
  switch (advanceStage(row)) {
    case "released": return firstTimestamp(row.advanceIssuedAt, row.assignedAt);
    case "settled": return firstTimestamp(row.advanceSettledAt, row.advanceIssuedAt);
    case "refunded":
    case "returnedEarly": return firstTimestamp(row.advanceRefundedAt, row.advanceIssuedAt);
    default: return firstTimestamp(row.assignedAt);
  }
}
