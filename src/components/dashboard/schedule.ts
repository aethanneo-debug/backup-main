// What the training calendar and the upcoming list say about a seminar (12ag): its time, venue and seats, its dates as
// the office writes them, where it stands today, and the colour it keeps. Pure (no React), shared by the Administrator's
// dashboard and, later, HR's; tested. Which days a seminar fills, and the month's layout, are src/trainingCalendar.ts's.
import { seminarTiming, type CalendarSeminar, type SeminarTiming } from "../../trainingCalendar";
import type { ScheduleSeminar } from "../../trainingSchedule";

/** A seminar's particulars for the calendar's details and the upcoming list. Times are "HH:MM", or "" when not set. */
export interface SeminarDetails {
  startTime: string;
  endTime: string;
  /** "" when none is recorded. */
  venue: string;
  seats: number;
  /** Enrolments on its roster: every one but those Cancelled or Archived. */
  filled: number;
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/**
 * Each seminar's time, venue and seats, keyed by its id, from the schedule the server sends (`GET /api/training/schedule`,
 * read by `readSchedule`, src/trainingSchedule.ts, which has cleaned the venue and checked the times).
 */
export function scheduleDetails(schedule: readonly ScheduleSeminar[]): Record<string, SeminarDetails> {
  const out: Record<string, SeminarDetails> = Object.create(null);
  for (const s of schedule) {
    out[s.id] = { startTime: s.startTime, endTime: s.endTime, venue: s.venue, seats: s.seats, filled: s.filled };
  }
  return out;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const parts = (iso: string) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) });
const short = (m: number) => (MONTHS[m - 1] ?? "").slice(0, 3);

/** "November 2026". */
export const monthLabel = (year: number, month: number) => `${MONTHS[month - 1] ?? ""} ${year}`;

/** The full name of a weekday, 0 = Sunday. */
export const weekdayName = (weekday: number) => WEEKDAYS[weekday] ?? "";

/** "Nov 11, 2026", "Nov 11–13, 2026", "Oct 30 – Nov 2, 2026", "Dec 30, 2026 – Jan 2, 2027" (dates YYYY-MM-DD). */
export function dateRange(from: string, to: string): string {
  const a = parts(from), b = parts(to);
  if (from === to || !to) return `${short(a.m)} ${a.d}, ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${short(a.m)} ${a.d}–${b.d}, ${a.y}`;
  if (a.y === b.y) return `${short(a.m)} ${a.d} – ${short(b.m)} ${b.d}, ${a.y}`;
  return `${short(a.m)} ${a.d}, ${a.y} – ${short(b.m)} ${b.d}, ${b.y}`;
}

/** "Wednesday, November 25, 2026". */
export function longDate(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${weekdayName(new Date(Date.UTC(y, m - 1, d)).getUTCDay())}, ${MONTHS[m - 1] ?? ""} ${d}, ${y}`;
}

/** "8:00 AM" from "08:00"; "" when it isn't a time. */
export function clockTime(value: string): string {
  const m = HHMM.exec(value);
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** "8:00 AM – 5:00 PM"; the one end that is set; "" when neither is. */
export function timeRange(start: string, end: string): string {
  const a = clockTime(start), b = clockTime(end);
  return a && b ? `${a} – ${b}` : a ? `From ${a}` : b ? `Until ${b}` : "";
}

/** Whole days from one YYYY-MM-DD to another; negative when the second is earlier. */
export function dayDiff(from: string, to: string): number {
  const a = parts(from), b = parts(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** "1 day", "3 days". */
export const dayCount = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** "3 of 4 seats filled". */
export const seatsText = (d: { seats: number; filled: number } | undefined) =>
  d ? `${d.filled} of ${d.seats} seat${d.seats === 1 ? "" : "s"} filled` : "Seats not known";

/** Where a seminar stands on `today`: one archived (after it was held) is "archived", whatever its dates. */
export type SeminarStanding = SeminarTiming | "archived";

export function seminarStanding(s: CalendarSeminar, today: string): SeminarStanding {
  return s.archived ? "archived" : seminarTiming(s, today);
}

export const STANDING_LABEL: Record<SeminarStanding, string> = { upcoming: "Upcoming", ongoing: "Ongoing", done: "Done", archived: "Archived" };

/** The house badge: -50 background, -700 text, -200 border (blue is HSAC navy). */
export const STANDING_BADGE: Record<SeminarStanding, string> = {
  upcoming: "border-blue-200 bg-blue-50 text-blue-700",
  ongoing: "border-emerald-200 bg-emerald-50 text-emerald-700",
  done: "border-slate-200 bg-slate-50 text-slate-600",
  archived: "border-slate-300 bg-slate-100 text-slate-600"
};

/** When it is, seen from `today`: "Starts tomorrow", "Starts in 7 days", "Today only", "Day 2 of 3", "Ended Nov 4". */
export function whenText(s: CalendarSeminar, today: string): string {
  const total = dayDiff(s.startDate, s.endDate) + 1;
  const until = dayDiff(today, s.startDate);
  if (until > 1) return `Starts in ${until} days`;
  if (until === 1) return "Starts tomorrow";
  if (today <= s.endDate) return total === 1 ? "Today only" : `Day ${dayDiff(s.startDate, today) + 1} of ${total}`;
  return `Ended ${dateRange(s.endDate, s.endDate).replace(/, \d{4}$/, "")}`;
}

/** A seminar's colours: the bar on the calendar, and the dot beside it in lists. */
export interface SeminarTone {
  bar: string;
  dot: string;
}

// No status hue (emerald, amber, rose) and nothing near purple ("Outside the TDP" elsewhere, so no fuchsia or violet:
// the code review of 12ag), so a colour never reads as a state; each pairs a -900 (or navy -800) text with its -100
// background, well above 4.5:1. Full class names, for Tailwind.
const TONES: SeminarTone[] = [
  { bar: "border-blue-300 bg-blue-100 text-blue-800", dot: "bg-blue-600" },
  { bar: "border-teal-300 bg-teal-100 text-teal-900", dot: "bg-teal-600" },
  { bar: "border-orange-300 bg-orange-100 text-orange-900", dot: "bg-orange-500" },
  { bar: "border-sky-300 bg-sky-100 text-sky-900", dot: "bg-sky-600" },
  { bar: "border-lime-400 bg-lime-100 text-lime-900", dot: "bg-lime-600" },
  { bar: "border-indigo-300 bg-indigo-100 text-indigo-900", dot: "bg-indigo-600" },
  { bar: "border-cyan-300 bg-cyan-100 text-cyan-900", dot: "bg-cyan-600" }
];

/** One archived once finished (12t): muted, with a dashed edge (and the word "archived" wherever it is named). */
export const ARCHIVED_TONE: SeminarTone = { bar: "border-dashed border-slate-400 bg-slate-100 text-slate-600", dot: "bg-slate-400" };

/** The colour a seminar keeps: picked from its id, so it is the same on every visit and in every list. */
export function seminarTone(id: string, archived = false): SeminarTone {
  if (archived) return ARCHIVED_TONE;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
