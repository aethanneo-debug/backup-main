// What a seminar takes out of the year's training budget. Used by both server.ts and the
// HR planner, so Budget Monitoring, HR's "Unallocated" figure, the allocation ceiling and
// the year-end carry-over can never disagree. What a seminar doesn't take stays in (or
// returns to) Unallocated.

interface SeminarAmounts {
  id: string;
  allocatedBudget?: number | string;
  usedBudget?: number | string;
  maxParticipants?: number | string;
}

interface SeminarEnrolment {
  trainingProgramId: string;
  status?: string;
  attendance?: string;
  /** A cash advance Finance released to this enrolment that is not yet liquidated or refunded (set by the server). */
  advanceOutstanding?: number | string;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const DID_NOT_ATTEND = "Did not attend";

export type SeminarStage =
  | "planning"        // nobody enrolled yet: the whole allocation is held for it
  | "open"            // someone may still report spending against it
  | "settled"         // everyone who attended has been liquidated
  | "nobodyAttended"; // attendance is recorded and nobody came

export interface SeminarBudget {
  stage: SeminarStage;
  allocated: number;
  spent: number;
  /** One seat's share of the allocation (allocation ÷ seats), as each participant is allotted. */
  share: number;
  /** Participants marked "Did not attend". They drop out of the seminar. */
  absent: number;
  /** Their shares, released to Unallocated as soon as attendance is recorded (open seminars). */
  released: number;
  /** Cash advances still out with non-attendees: held until Finance records the refund. */
  held: number;
  /** How many non-attendees those advances are with. */
  heldCount: number;
  /** Every cash advance still out for the seminar, attendees' too: held until liquidated or refunded. */
  outstanding: number;
  /** What the seminar takes out of the year's training budget. */
  committed: number;
  /** Allocated − spent − cash still out, when positive, once the seminar is closed: back in Unallocated. */
  returned: number;
}

/**
 * Where a seminar stands and what it takes from the year's training budget (requirement 6,
 * the instructor's note 9: unspent money goes back to Unallocated).
 *
 * - Nobody enrolled: it is still being planned, so it holds its whole allocation.
 * - Someone marked "Did not attend" drops out, and their share (allocation ÷ seats) is
 *   released at once, while the others are still to report. A share whose cash advance is
 *   still out with them is held instead, until Finance records the refund (the user's
 *   decision, 2026-10-10): the same money mustn't fund another seminar while uncollected.
 * - Closed (everyone who attended is liquidated, or attendance is recorded and nobody came):
 *   it counts only what it actually spent, plus any advance still out with a non-attendee,
 *   so the rest of the allocation returns to Unallocated. A refund frees money, an approved
 *   overspend uses more, and a program-wide cost HR records afterwards (a late venue bill)
 *   still counts.
 * - Otherwise (open) it holds the attendees' part, their shares or what they have spent and
 *   still have in cash if that is more, plus the cash still out with non-attendees, which
 *   can't stand in for anyone's share. So money still owed to it, or not yet back, is never
 *   counted as free, even after its allocation or seats are cut below the cash Finance has
 *   already released.
 *
 * `allocatedOverride` lets the HR planner price an unsaved edit. Rounded to centavos here,
 * at the boundary, so every figure built from it adds up.
 */
export function seminarBudget(program: SeminarAmounts, participants: SeminarEnrolment[], allocatedOverride?: number): SeminarBudget {
  const allocated = round2(allocatedOverride ?? Number(program.allocatedBudget || 0));
  const spent = round2(Number(program.usedBudget || 0));
  const seats = Math.max(1, Number(program.maxParticipants) || 1);
  const share = round2(allocated / seats);
  const enrolled = (participants ?? []).filter((p) =>
    p?.trainingProgramId === program.id && p.status !== "Cancelled" && p.status !== "Archived");
  const absentees = enrolled.filter((p) => p.attendance === DID_NOT_ATTEND);
  const absent = absentees.length;
  const attending = enrolled.filter((p) => p.attendance !== DID_NOT_ATTEND);
  // Cash still out with non-attendees: the whole unrecovered advance, which can exceed a share
  // the allocation was cut to after it was released.
  const held = round2(absentees.reduce((s, p) => s + Math.max(0, Number(p.advanceOutstanding) || 0), 0));
  // All cash still out for the seminar, attendees' advances included (the server nets each
  // advance against what HR has already entered for that participant). An attendee's advance
  // stops counting when Finance validates their report, as their spending starts to.
  const outstanding = round2(enrolled.reduce((s, p) => s + Math.max(0, Number(p.advanceOutstanding) || 0), 0));

  const stage: SeminarStage = enrolled.length === 0 ? "planning"
    : attending.length === 0 ? "nobodyAttended"
    : attending.every((p) => p.status === "Liquidated") ? "settled"
    : "open";
  const closed = stage === "settled" || stage === "nobodyAttended";
  // Not closed: the attendees' part, plus the cash still out with non-attendees on top. The
  // attendees' part is the larger of:
  // - their shares: the allocation less the non-attendees' shares (which never come out of the
  //   attendees' own), at least each attendee's allowance when seats were cut below the number
  //   attending, plus any attendee's cash beyond their own share; or
  // - what has been spent plus the cash still out with attendees.
  // So no cut and no change of attendance can count cash that is out as free. What that leaves
  // of the allocation is released.
  // Worked out exactly, in centavos times the number of seats, where a share (allocation ÷
  // seats) and every other term is a whole number, then rounded once. With pesos, a share
  // like ₱999.99 ÷ 2 lands on half a centavo and rounds either way depending on the order of
  // the sums, enough for an attendance change to move the figure.
  const units = (pesos: number) => Math.round((Number(pesos) || 0) * 100) * seats;
  const shareUnits = Math.round(allocated * 100);
  const absentShares = Math.max(0, Math.min(absent * shareUnits, units(allocated) - attending.length * shareUnits));
  const attendeesFloor = attending.length > seats ? attending.length * shareUnits : 0;
  const attendeeExcess = attending.reduce((s, p) => s + Math.max(0, units(Math.max(0, Number(p.advanceOutstanding) || 0)) - shareUnits), 0);
  const openUnits = Math.max(Math.max(units(allocated) - absentShares, attendeesFloor) + attendeeExcess, units(spent) + units(outstanding) - units(held)) + units(held);
  const openCommitted = Math.round(openUnits / seats) / 100;
  return {
    stage,
    allocated,
    spent,
    share,
    absent,
    released: stage === "open" ? round2(Math.max(0, allocated - openCommitted)) : 0,
    held,
    heldCount: absentees.filter((p) => Number(p.advanceOutstanding) > 0).length,
    outstanding,
    committed: closed ? round2(spent + outstanding) : openCommitted,
    returned: closed ? round2(Math.max(0, allocated - spent - outstanding)) : 0
  };
}

/**
 * Closed: no participant can report more spending against the seminar, because everyone
 * who attended has been liquidated, or attendance is recorded and nobody came. An empty
 * seminar is still being planned, so it is not closed. Enrolling someone new reopens it.
 */
export function isSeminarSettled(program: SeminarAmounts, participants: SeminarEnrolment[]): boolean {
  const { stage } = seminarBudget(program, participants);
  return stage === "settled" || stage === "nobodyAttended";
}

/** What the seminar takes out of the year's training budget (see seminarBudget). */
export function seminarCommitment(program: SeminarAmounts, participants: SeminarEnrolment[], allocatedOverride?: number): number {
  return seminarBudget(program, participants, allocatedOverride).committed;
}

/**
 * What the seminar would take after an edit, priced as it will be once saved: the new
 * allocation (`newAmount`) and, when given, the new number of seats (a share is
 * allocation ÷ seats, so seats move what a non-attendee releases). `addsParticipants`: the
 * edit enrols someone new, who has no attendance yet, so a closed seminar reopens.
 */
export function commitmentAfterEdit(program: SeminarAmounts, participants: SeminarEnrolment[], newAmount: number, addsParticipants = false, newSeats?: number | string): number {
  const edited = newSeats === undefined ? program : { ...program, maxParticipants: newSeats };
  const roster = addsParticipants
    ? [...(participants ?? []), { trainingProgramId: program.id, status: "Assigned" }]
    : participants;
  return seminarCommitment(edited, roster, newAmount);
}

/**
 * How much an edit adds to what the year's seminars take: 0 when it adds nothing (an
 * unchanged row, a cut, or a closed seminar, whose spending counts instead). Only an
 * increase needs room in the budget, so an approved overspend that has already taken
 * the year past its budget never blocks an edit that adds nothing.
 * `program` is undefined for a seminar that is not saved yet.
 */
export function allocationIncrease(program: SeminarAmounts | undefined, participants: SeminarEnrolment[], newAmount: number, addsParticipants = false, newSeats?: number | string): number {
  const before = program ? seminarCommitment(program, participants) : 0;
  const after = program ? commitmentAfterEdit(program, participants, newAmount, addsParticipants, newSeats) : round2(newAmount);
  return round2(Math.max(0, after - before));
}
