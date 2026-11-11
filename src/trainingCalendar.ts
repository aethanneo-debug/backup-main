// The training calendar (the instructor's suggestions of 2026-11-11, known-issues 12ag): a month's grid, Sunday first,
// and the seminars on it. A seminar fills every day from its first to its last, a weekend inside it included, so a
// 3-day seminar colours 3 days, and one that crosses a week or a month carries on in the next row or month. Pure, and
// shared by the Administrator's and HR's dashboards; tested.
import { RAW_TEXT_MAX, cleanText, isCalendarDate } from "./inputText";

/** A seminar as the calendar shows it. */
export interface CalendarSeminar {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  /** The fiscal year it was filed under ("2029"), or "" when none is recorded. Programs & Budget lists only the active
   * year's seminars, so only those can be opened there (the code review of 12ag). */
  fiscalYear: string;
  /** Archived once finished: shown, muted. (One archived before use is left off by `calendarSeminars`.) */
  archived: boolean;
}

/** A title fit to show beside others: cleaned like typed text (no direction or invisible characters) and at most 300
 * characters, the room a seminar's title has had since 12x. Cut before cleaning, since `cleanText` gives "" for text
 * longer than RAW_TEXT_MAX and an older, longer title would otherwise read as untitled (the security review of 12ag). */
export function seminarTitle(value: unknown): string {
  return typeof value === "string" ? cleanText(value.slice(0, RAW_TEXT_MAX)).slice(0, 300) : "";
}

/** One box of the grid. `weekday` is 0 for Sunday. */
export interface CalendarDay {
  date: string;
  day: number;
  weekday: number;
  inMonth: boolean;
}

/** One seminar's stretch inside one week's row, from column `startCol` to `endCol` (0 = Sunday), in lane `lane`. */
export interface WeekSegment {
  seminarId: string;
  startCol: number;
  endCol: number;
  lane: number;
  /** It began before this row (an earlier week or month), so its title isn't the start of it. */
  continuesBefore: boolean;
  /** It goes on after this row. */
  continuesAfter: boolean;
}

/** A week's row: its 7 days, the segments shown (lanes below `maxLanes`), and for each day how many more seminars it
 * holds than are shown ("+N more"). */
export interface CalendarWeek {
  days: CalendarDay[];
  segments: WeekSegment[];
  hidden: number[];
}

export type SeminarTiming = "upcoming" | "ongoing" | "done";

/** How many seminars a day shows before "+N more". */
export const MAX_LANES = 3;
/** A seminar's dates are read only when it lasts at most a year (as seminars are refused past 366 days, 12x). */
const MAX_SPAN_DAYS = 366;
const DAY_MS = 86_400_000;

const toUtc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Today on Manila's calendar, YYYY-MM-DD (the office's day, whatever the browser's time zone). */
export function manilaDay(now: number = Date.now()): string {
  return new Date(now + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** A seminar's first and last days, when they are real dates in order and at most a year apart; otherwise null. */
export function seminarSpan(s: { startDate?: unknown; endDate?: unknown }): { from: string; to: string } | null {
  const from = s.startDate, to = s.endDate;
  if (!isCalendarDate(from) || !isCalendarDate(to) || to < from) return null;
  if ((toUtc(to) - toUtc(from)) / DAY_MS + 1 > MAX_SPAN_DAYS) return null;
  return { from, to };
}

/** Every day of a seminar, first to last, weekends included; none when its dates can't be read (`seminarSpan`). */
export function seminarDays(s: { startDate?: unknown; endDate?: unknown }): string[] {
  const span = seminarSpan(s);
  if (!span) return [];
  const days: string[] = [];
  for (let t = toUtc(span.from); t <= toUtc(span.to); t += DAY_MS) days.push(isoOf(t));
  return days;
}

/**
 * The seminars a calendar shows, from the schedule (`GET /api/training/schedule`, src/trainingSchedule.ts) or a stored
 * seminar list: every one with real dates, but not one archived before it was used (it was never held, 12t); one
 * archived once finished is kept, marked. Anything that isn't a seminar record is passed over.
 */
export function calendarSeminars(programs: unknown): CalendarSeminar[] {
  if (!Array.isArray(programs)) return [];
  const out: CalendarSeminar[] = [];
  for (const p of programs) {
    if (!p || typeof p !== "object") continue;
    const r = p as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id || r.archivedBeforeUse) continue;
    const span = seminarSpan(r);
    if (!span) continue;
    const fy = typeof r.fiscalYear === "number" ? String(r.fiscalYear) : cleanText(r.fiscalYear).slice(0, 20);
    // A stored seminar says when it was archived; a schedule row (src/trainingSchedule.ts) just whether.
    const archived = !!r.archivedAt || r.archived === true;
    out.push({ id: r.id, title: seminarTitle(r.title) || "Untitled seminar", startDate: span.from, endDate: span.to, fiscalYear: fy, archived });
  }
  return out;
}

/** The month's weeks, Sunday to Saturday, from the week holding its 1st to the week holding its last day (4 to 6). */
export function monthWeeks(year: number, month: number): CalendarDay[][] {
  const first = Date.UTC(year, month - 1, 1);
  const last = Date.UTC(year, month, 0);
  const start = first - new Date(first).getUTCDay() * DAY_MS;
  const end = last + (6 - new Date(last).getUTCDay()) * DAY_MS;
  const weeks: CalendarDay[][] = [];
  for (let t = start; t <= end; t += 7 * DAY_MS) {
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(t + i * DAY_MS);
      days.push({ date: isoOf(t + i * DAY_MS), day: d.getUTCDate(), weekday: i, inMonth: d.getUTCMonth() === month - 1 });
    }
    weeks.push(days);
  }
  return weeks;
}

/** The month `delta` months from the one given (1 = January). */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
}

/**
 * Lays the seminars on a month's weeks. Each seminar gets one segment for every week's row it touches, so a 3-day one
 * covers 3 boxes, and one crossing a weekend or a month carries on. Within a row, segments take the lowest lane free
 * across all their days: the earlier start first, then the longer one, then by title and id, so the layout is the same
 * every time. Lanes from `maxLanes` on aren't shown; each day counts them in `hidden`.
 */
export function layoutMonth(seminars: CalendarSeminar[], year: number, month: number, maxLanes: number = MAX_LANES): CalendarWeek[] {
  const ordered = [...(seminars ?? [])].sort((a, b) =>
    a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  return monthWeeks(year, month).map((days) => {
    const rowFrom = days[0].date, rowTo = days[6].date;
    const lanes: boolean[][] = [];
    const segments: WeekSegment[] = [];
    const hidden = new Array<number>(7).fill(0);
    for (const s of ordered) {
      if (s.endDate < rowFrom || s.startDate > rowTo) continue;
      const startCol = s.startDate <= rowFrom ? 0 : days.findIndex((d) => d.date === s.startDate);
      const endCol = s.endDate >= rowTo ? 6 : days.findIndex((d) => d.date === s.endDate);
      let lane = 0;
      while (lanes[lane] && lanes[lane].slice(startCol, endCol + 1).some(Boolean)) lane++;
      lanes[lane] = lanes[lane] ?? new Array<boolean>(7).fill(false);
      for (let c = startCol; c <= endCol; c++) lanes[lane][c] = true;
      if (lane < maxLanes) {
        segments.push({ seminarId: s.id, startCol, endCol, lane, continuesBefore: s.startDate < rowFrom, continuesAfter: s.endDate > rowTo });
      } else {
        for (let c = startCol; c <= endCol; c++) hidden[c]++;
      }
    }
    return { days, segments, hidden };
  });
}

/** The seminars on one day, earliest first (for a day's "+N more" and its details). */
export function seminarsOn(seminars: CalendarSeminar[], date: string): CalendarSeminar[] {
  return (seminars ?? []).filter((s) => s.startDate <= date && date <= s.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

/** Whether a seminar is still to come, under way, or over, on Manila's `today`. */
export function seminarTiming(s: { startDate: string; endDate: string }, today: string): SeminarTiming {
  return today < s.startDate ? "upcoming" : today <= s.endDate ? "ongoing" : "done";
}

/** The seminars under way or still to come on `today`, soonest first, at most `limit` (archived ones left out). */
export function upcomingSeminars(seminars: CalendarSeminar[], today: string, limit = 5): CalendarSeminar[] {
  return (seminars ?? []).filter((s) => !s.archived && s.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}
