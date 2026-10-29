// Sending a representative in lieu of someone enrolled on a seminar (HSAC RAB 1, 2026-10-28: "naka-leave
// si accountant, at may paid training by central office, need mag-identify ng representative in lieu of
// the accountant. Kasi sayang yung budget allotted"; known-issues 12z Part B).
//
// The original's enrolment is closed ("Cancelled", with `replacedBy`) and the representative gets a new
// one: a cash advance belongs to its enrolment, and can't move to another person. So whatever cash the
// original holds is settled before their enrolment closes, and the training budget's figures stay as
// they are (they leave cancelled enrolments out). What the swap does with it, the user's decision 4
// (2026-10-28). Pure, shared by the server and its tests.

import { advancesCovering, isGroupAdvance, type CoverableAdvance } from "./advanceCoverage";

export type SwapAdvanceStep =
  /** No advance, or one declined, refunded or settled: the swap goes ahead. */
  | { action: "proceed" }
  /** Their own request, not yet released: closed, as "Did not attend" closes one. */
  | { action: "closeRequest"; advanceId: string }
  /** Covered by someone else's unreleased group request: taken off it, as "Leave" does. */
  | { action: "leaveGroup"; advanceId: string }
  /** The swap waits: a group request they hold (it covers others; Finance declines it), their own
   * advance released (Finance records its refund, which it can before the seminar starts), or a
   * released group advance covering them (the group's report or refund settles it). */
  | { action: "wait"; why: "holdsGroupRequest" | "ownAdvanceOut" | "groupAdvanceOut"; advanceId: string };

/** What sending a representative in lieu of an enrolment does with the cash advances that pay for it. */
export function swapAdvanceStep(advances: readonly CoverableAdvance[] | null | undefined, enrolmentId: string): SwapAdvanceStep {
  const open = advancesCovering(advances, enrolmentId).filter((a) => a.status === "Requested" || a.status === "Released");
  // Cash out comes first: it has to come back before the seat can change hands.
  const out = open.find((a) => a.status === "Released");
  if (out) return { action: "wait", why: isGroupAdvance(out) ? "groupAdvanceOut" : "ownAdvanceOut", advanceId: out.id };
  const request = open.find((a) => a.status === "Requested");
  if (!request) return { action: "proceed" };
  if (!isGroupAdvance(request)) return { action: "closeRequest", advanceId: request.id };
  // A group request names its holder's enrolment: theirs covers others, so Finance decides it.
  if (request.activityId === enrolmentId) return { action: "wait", why: "holdsGroupRequest", advanceId: request.id };
  return { action: "leaveGroup", advanceId: request.id };
}
