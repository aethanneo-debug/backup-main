// What a seminar takes out of the year's training budget. Used by both server.ts and the
// HR planner, so the Budget Monitoring figures, HR's "Remaining Budget", the allocation
// ceiling and the year-end carry-over can never disagree.

interface SeminarAmounts {
  id: string;
  allocatedBudget?: number | string;
  usedBudget?: number | string;
}

interface SeminarEnrolment {
  trainingProgramId: string;
  status?: string;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Settled: someone is enrolled and everyone still enrolled has been liquidated, so no
 * participant can report more spending against the seminar. An empty seminar is still
 * being planned, so it is not settled. A program-wide cost HR records afterwards (a late
 * venue bill) still counts: it raises what the seminar spent, so it lowers Remaining.
 */
export function isSeminarSettled(programId: string, participants: SeminarEnrolment[]): boolean {
  const enrolled = (participants ?? []).filter((p) =>
    p.trainingProgramId === programId && p.status !== "Cancelled" && p.status !== "Archived");
  return enrolled.length > 0 && enrolled.every((p) => p.status === "Liquidated");
}

/**
 * A settled seminar counts what it actually spent: a refund frees money, an overspend
 * uses more. Any other seminar counts its whole allocation (or its spending, if that is
 * already higher), so money still owed to it is never counted as free.
 * `allocatedOverride` lets the HR planner price an unsaved edit.
 */
export function seminarCommitment(program: SeminarAmounts, participants: SeminarEnrolment[], allocatedOverride?: number): number {
  const allocated = allocatedOverride ?? Number(program.allocatedBudget || 0);
  const spent = Number(program.usedBudget || 0);
  return round2(isSeminarSettled(program.id, participants) ? spent : Math.max(allocated, spent));
}

/**
 * What the seminar would take after an edit that sets its allocation to `newAmount`.
 * `addsParticipants`: the edit enrols someone new, which reopens a settled seminar, so
 * its allocation counts again.
 */
export function commitmentAfterEdit(program: SeminarAmounts, participants: SeminarEnrolment[], newAmount: number, addsParticipants = false): number {
  // An empty enrolment list is never settled.
  return seminarCommitment(program, addsParticipants ? [] : participants, newAmount);
}

/**
 * How much an edit adds to what the year's seminars take: 0 when it adds nothing (an
 * unchanged row, a cut, or a settled seminar, whose spending counts instead). Only an
 * increase needs room in the budget, so an approved overspend that has already taken
 * the year past its budget never blocks an edit that adds nothing.
 * `program` is undefined for a seminar that is not saved yet.
 */
export function allocationIncrease(program: SeminarAmounts | undefined, participants: SeminarEnrolment[], newAmount: number, addsParticipants = false): number {
  const before = program ? seminarCommitment(program, participants) : 0;
  const after = program ? commitmentAfterEdit(program, participants, newAmount, addsParticipants) : round2(newAmount);
  return round2(Math.max(0, after - before));
}
