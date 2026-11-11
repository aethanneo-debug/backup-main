// The Administrator's dashboard (12ag): the year's training budget as the server works it out, and each seminar of a
// fiscal year with what HR allocated it and what it takes from the year's training budget now. The server prices them
// (`GET /api/training/schedule`, src/trainingSchedule.ts, with `seminarBudget` as Programs & Budget and Budget
// Monitoring price them), so the "allocated vs taken" chart can't disagree with them. Pure (no React); tested.
import type { ScheduleSeminar } from "../../trainingSchedule";

/** The year's training budget as `GET /api/training/budgets` works it out (server.ts, computeTrainingUsage). Pesos. */
export interface TrainingBudgetFigures {
  /** The Overall Total Budget: the carry-over plus the new annual budget. */
  total: number;
  carryOver: number;
  newAnnual: number;
  /** What HR allocated the year's seminars (none archived before use). */
  allocated: number;
  /** What the seminars take now: their allocations while open, less what went back; their spending once closed. */
  committed: number;
  /** The total less what the seminars take. */
  unallocated: number;
  /** What the seminars gave back to Unallocated (closed seminars' leftovers, non-attendees' shares, liquidated
   * attendees' leftovers). */
  returned: number;
  /** What some take beyond their allocations, out of Unallocated: Total − Allocated + Returned − Over = Unallocated. */
  over: number;
  /** How many seminars the figures cover. */
  seminars: number;
}

/** One seminar on the chart: the schedule's own row (its dates, seats and the four amounts). */
export type SeminarBudgetRow = ScheduleSeminar;

const round2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;

/** The server's figures, rounded to centavos; `over` follows from them, so the sum shown always adds up. */
export function budgetFigures(row: Record<string, unknown>): TrainingBudgetFigures {
  const allocated = round2(row.allocated);
  const committed = round2(row.committed);
  const returned = round2(round2(row.returnedFromSettled) + round2(row.releasedForAbsent));
  return {
    total: round2(row.totalBudget),
    carryOver: round2(row.carryOverBudget),
    newAnnual: round2(row.newAnnualBudget),
    allocated,
    committed,
    unallocated: round2(row.remaining),
    returned,
    // Σ (taken − allocated) over the seminars that take more; never below 0 (a centavo of rounding at most).
    over: Math.max(0, round2(committed - allocated + returned)),
    seminars: Math.max(0, Math.trunc(Number(row.programCount) || 0))
  };
}

/**
 * The year's seminars on the chart, earliest first (those without dates last), from the schedule the server priced
 * (`scheduleSeminars`, which leaves out a seminar archived before use, as the year's figures do).
 */
export function seminarBudgetRows(schedule: readonly ScheduleSeminar[], fiscalYear: string): SeminarBudgetRow[] {
  if (!fiscalYear) return [];
  return schedule
    .filter((s) => s.fiscalYear === fiscalYear)
    .sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}
