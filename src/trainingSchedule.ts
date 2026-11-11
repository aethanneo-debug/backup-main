// The training schedule (12ag): each seminar as the dashboards' calendar, upcoming list and budget chart show it, and
// nothing more. Built on the server (`GET /api/training/schedule`) from the seminar list and the training budget's
// per-enrolment rows (`participantsForBudget`), so each seminar is priced as Programs & Budget and Budget Monitoring
// price it (`seminarBudget`). The dashboards had loaded every enrolment, with its TDP justification and certificate
// details, only to count seats (the security review of 12ag Part A). Read again in the browser, types checked
// (`readSchedule`). Pure; tested.
import { cleanText } from "./inputText";
import { seminarBudget } from "./trainingBudget";
import { seminarSpan, seminarTitle } from "./trainingCalendar";

/** One seminar of the schedule. Amounts in pesos, rounded to centavos. */
export interface ScheduleSeminar {
  id: string;
  title: string;
  /** The fiscal year it was filed under ("2029"), or "" when none is recorded. */
  fiscalYear: string;
  /** Its first and last days, or "" when they can't be read (real dates, in order, at most a year apart). */
  startDate: string;
  endDate: string;
  /** "HH:MM", or "" when not set. */
  startTime: string;
  endTime: string;
  /** "" when none is recorded. */
  venue: string;
  /** Its seats (at least 1), and the enrolments on its roster (every one but those Cancelled or Archived). */
  seats: number;
  filled: number;
  /** Archived once finished. (One archived before use isn't listed: it was never held, 12t.) */
  archived: boolean;
  /** What HR allocated it; what it takes from the year's budget now; what it spent; what it gave back to Unallocated
   * (shares of those who didn't attend, validated attendees' leftovers, and what a closed seminar didn't spend). */
  allocated: number;
  committed: number;
  spent: number;
  returned: number;
}

type BudgetProgram = Parameters<typeof seminarBudget>[0];
type BudgetEnrolments = Parameters<typeof seminarBudget>[1];

const round2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const hhmm = (value: unknown) => (typeof value === "string" && HHMM.test(value.trim()) ? value.trim() : "");
/** A year as text or a number only: String() of a stored object can throw. */
const yearText = (value: unknown) => (typeof value === "number" ? String(value) : cleanText(value).slice(0, 20));
const onRoster = (e: Record<string, unknown>) => e.status !== "Cancelled" && e.status !== "Archived";

/**
 * Every seminar but those archived before use, from the stored list and the training budget's per-enrolment rows (on
 * the server, `participantsForBudget()`, whose rows carry each enrolment's cash still out and settled spending).
 * Anything that isn't a record is passed over.
 */
export function scheduleSeminars(programs: unknown, enrolments: unknown): ScheduleSeminar[] {
  if (!Array.isArray(programs)) return [];
  const rows = (Array.isArray(enrolments) ? enrolments : []).filter(
    (e): e is Record<string, unknown> => isRecord(e) && typeof e.trainingProgramId === "string"
  );
  const filled = new Map<string, number>();
  for (const e of rows) if (onRoster(e)) filled.set(e.trainingProgramId as string, (filled.get(e.trainingProgramId as string) ?? 0) + 1);
  const out: ScheduleSeminar[] = [];
  for (const p of programs) {
    if (!isRecord(p) || typeof p.id !== "string" || !p.id || p.archivedBeforeUse) continue;
    const b = seminarBudget(p as unknown as BudgetProgram, rows as unknown as BudgetEnrolments);
    const span = seminarSpan(p);
    out.push({
      id: p.id,
      title: seminarTitle(p.title) || "Untitled seminar",
      fiscalYear: yearText(p.fiscalYear),
      startDate: span?.from ?? "",
      endDate: span?.to ?? "",
      startTime: hhmm(p.startTime),
      endTime: hhmm(p.endTime),
      venue: cleanText(p.venue).slice(0, 200),
      seats: Math.max(1, Math.trunc(Number(p.maxParticipants)) || 1),
      filled: filled.get(p.id) ?? 0,
      archived: !!p.archivedAt,
      allocated: round2(b.allocated),
      committed: round2(b.committed),
      spent: round2(b.spent),
      returned: round2(b.returned + b.released)
    });
  }
  return out;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const amount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? round2(v) : 0);
const count = (v: unknown, min: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.trunc(v)) : min);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The schedule as the browser receives it, read again with its types checked: a row it can't read is passed over,
 * and a field of the wrong kind reads as none, so a damaged answer can't break a calendar. */
export function readSchedule(seminars: unknown): ScheduleSeminar[] {
  if (!Array.isArray(seminars)) return [];
  const out: ScheduleSeminar[] = [];
  for (const s of seminars) {
    if (!isRecord(s) || typeof s.id !== "string" || !s.id) continue;
    const startDate = typeof s.startDate === "string" && DATE.test(s.startDate) ? s.startDate : "";
    const endDate = typeof s.endDate === "string" && DATE.test(s.endDate) && startDate && s.endDate >= startDate ? s.endDate : "";
    out.push({
      id: s.id.slice(0, 200),
      title: text(s.title, 300) || "Untitled seminar",
      fiscalYear: text(s.fiscalYear, 20),
      startDate: endDate ? startDate : "",
      endDate,
      startTime: hhmm(s.startTime),
      endTime: hhmm(s.endTime),
      venue: text(s.venue, 200),
      seats: count(s.seats, 1),
      filled: count(s.filled, 0),
      archived: s.archived === true,
      allocated: amount(s.allocated),
      committed: amount(s.committed),
      spent: amount(s.spent),
      returned: amount(s.returned)
    });
  }
  return out;
}
