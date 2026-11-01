// The lines of a liquidation report (the instructor's review of 2026-10-31, R2 and R3,
// .claude/context/instructor-review-2026-10-31.md). A line is an expense type and an amount, with no
// description, so it goes by its type wherever it is shown; a report filed earlier keeps the
// descriptions it was filed with. The form and the server run the same checks.
import { isCalendarDate } from "./inputText";
import { TRAINING_EXPENSE_CATEGORIES, type TrainingExpenseCategory } from "./types";

/** The most lines one report can have: far more than a seminar needs, and a bound on the checks below. */
export const MAX_REPORT_LINES = 100;

/** The types an attendee chooses from, in the order the form offers them. */
export const ATTENDEE_EXPENSE_TYPES: TrainingExpenseCategory[] = [
  "Registration Fee",
  "Meals",
  "Accommodation",
  "Transportation",
  "Materials",
  "Miscellaneous"
];

/** Costs of a seminar as a whole: only HR records them, and never against one person. */
export const PROGRAM_ONLY_EXPENSE_TYPES: TrainingExpenseCategory[] = ["Venue Rental", "Speaker Fees"];

export function isProgramOnlyExpense(type: unknown): boolean {
  return (PROGRAM_ONLY_EXPENSE_TYPES as unknown[]).includes(type);
}

/** The server's type for a line that came without one, as it has always been. */
const NO_TYPE: TrainingExpenseCategory = "Miscellaneous";

interface ExpenseLine {
  id?: string;
  description?: string | null;
  amount?: number | string | null;
  category?: string | null;
  participantId?: string;
}

/** What a line is called wherever it is shown: its stored description, on a report filed with one, else its type. */
export function expenseLineLabel(line: ExpenseLine | null | undefined): string {
  return String(line?.description ?? "").trim() || String(line?.category ?? "").trim() || NO_TYPE;
}

/** A row nobody filled in: no type, no amount, and no description from an older report. Never an error, and never a line. */
export function isBlankExpenseLine(line: ExpenseLine | null | undefined): boolean {
  const typed = TRAINING_EXPENSE_CATEGORIES.includes(line?.category as TrainingExpenseCategory);
  return !String(line?.description ?? "").trim() && !typed && !(Number(line?.amount) || 0);
}

/** A line already on the report with this type, for the same person. It stays as it was filed, even if
 * its type couldn't be chosen today. A line moved to someone else is a new claim for them. */
export function keptExpenseType(line: ExpenseLine, stored: ExpenseLine[] | null | undefined): boolean {
  const before = (stored ?? []).find(s => s && s.id === line.id);
  return !!before
    && (before.category || NO_TYPE) === (line.category || NO_TYPE)
    && (before.participantId || "") === (line.participantId || "");
}

/** On the form, the vehicle request standing for whom a line is for: `onVehicle` for an attendee it names
 * on a group's report (their number isn't sent), else the claimant's own. */
export function vehicleNoForLine(
  line: ExpenseLine,
  ownVehicleNo: string | null | undefined,
  attendees: Array<{ participantId: string; onVehicle?: boolean }> | null | undefined
): string | null {
  const named = line.participantId ? attendees?.find(m => m.participantId === line.participantId) : undefined;
  return named ? (named.onVehicle ? "" : null) : ownVehicleNo ?? null;
}

/** Why a line can't have this type, or "". `vehicleNo` is the vehicle request standing for whom it is
 * for: null when none stands, "" when one stands and its number isn't theirs to see. */
export function expenseTypeProblem(type: unknown, vehicleNo: string | null | undefined): string {
  if (isProgramOnlyExpense(type)) return `${type} is a cost of the whole seminar, which HR records. Choose another expense type.`;
  if (type === "Transportation" && vehicleNo != null) {
    return `Transportation can't be claimed while vehicle request ${vehicleNo ? `${vehicleNo} ` : ""}stands for this seminar. Put small fares under Miscellaneous.`;
  }
  return "";
}

/** Whether an ordinary Vehicle Request (one not filed with a cash advance, so not linked to a seminar)
 * is for a seminar's dates: its trip overlaps them. The team's decision of 2026-11-01. */
export function vehicleOverlapsSeminar(
  trip: { departureDate?: string; arrivalDate?: string; dateNeeded?: string },
  seminar: { startDate?: string; endDate?: string }
): boolean {
  const from = trip.departureDate || trip.dateNeeded;
  const to = trip.arrivalDate || from;
  const start = seminar.startDate;
  const end = seminar.endDate || start;
  if (!isCalendarDate(from) || !isCalendarDate(to) || !isCalendarDate(start) || !isCalendarDate(end)) return false;
  return from <= end && to >= start;
}

/** The first problem with a report's lines, or "". Only what a filing or correction changes is checked. */
export function expenseLinesProblem(
  lines: ExpenseLine[] | null | undefined,
  stored: ExpenseLine[] | null | undefined,
  vehicleNoFor: (participantId?: string) => string | null
): string {
  for (const line of lines ?? []) {
    if (keptExpenseType(line, stored)) continue;
    // (Only Transportation asks: the lookup reads every vehicle request.)
    const problem = expenseTypeProblem(line.category, line.category === "Transportation" ? vehicleNoFor(line.participantId) : null);
    if (problem) return problem;
  }
  return "";
}

/** The dropdown's choices for a line: no Transportation while a vehicle request stands, and always the
 * type it has now, so an older report's line shows what it was filed with. */
export function expenseTypeChoices(current: string | null | undefined, vehicleNo: string | null | undefined): string[] {
  const choices: string[] = ATTENDEE_EXPENSE_TYPES.filter(t => t !== "Transportation" || vehicleNo == null);
  return current && !choices.includes(current) ? [...choices, current] : choices;
}
