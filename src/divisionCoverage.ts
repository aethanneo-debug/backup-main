// "Someone must stay to man the division" (HSAC RAB 1's answer 1, 2026-10-26,
// .claude/context/hsac-answers.md). On every weekday of a seminar, each division keeps at least one
// active member at the office. A member is away on a day when they are on a seminar that day (this
// one, or another that isn't archived), unless their enrolment was cancelled or archived or HR marked
// them "Did not attend". Leave doesn't count, and weekends need nobody (decision 4, 2026-10-26).
// The server refuses a change that would leave a division empty unless HR confirms it, and the
// participant picker warns as HR chooses; both use these functions.
import { isCalendarDate as isDate } from "./inputText";

export interface CoverageStaff {
  id: string;        // Employee.id
  division: string;
}

export interface DivisionGap {
  division: string;
  dates: string[];   // YYYY-MM-DD weekdays, ascending
}

/** The longest seminar the rule looks at, in days (a mistyped end date can't make it loop for long).
 * The server refuses to save a longer seminar, so none escapes the rule. */
export const MAX_DAYS = 366;

/** The weekdays (Monday to Friday) from the start to the end date, both included. None when either isn't a real date. */
export function seminarWeekdays(startDate: unknown, endDate: unknown): string[] {
  if (!isDate(startDate)) return [];
  const end = isDate(endDate) ? endDate : startDate;
  const days: string[] = [];
  const d = new Date(`${startDate}T00:00:00Z`);
  for (let i = 0; i < MAX_DAYS; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > end) break;
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/**
 * The divisions a seminar would leave with nobody at the office, and on which of `dates`: days when
 * every member is away, here or at another seminar, but someone would have stayed without this one.
 * A division emptied by other seminars alone isn't this one's doing, even if it takes someone already
 * booked elsewhere that day (a double booking, which the picker shows apart). `roster` is who this
 * seminar takes (Employee.id); `awayElsewhere(id, date)` says whether that person is at another
 * seminar that day.
 */
export function divisionGaps(
  staff: CoverageStaff[],
  dates: string[],
  roster: Iterable<string>,
  awayElsewhere: (id: string, date: string) => boolean
): DivisionGap[] {
  const taken = new Set(roster);
  const byDivision = new Map<string, string[]>();
  for (const s of staff ?? []) {
    const division = String(s?.division ?? "").trim();
    if (!s?.id || !division) continue;
    const members = byDivision.get(division) ?? [];
    if (!members.includes(s.id)) members.push(s.id);
    byDivision.set(division, members);
  }
  const gaps: DivisionGap[] = [];
  for (const [division, members] of [...byDivision].sort(([a], [b]) => a.localeCompare(b))) {
    if (!members.some(id => taken.has(id))) continue;
    const empty = [...new Set(dates)].sort().filter(date =>
      members.every(id => taken.has(id) || awayElsewhere(id, date)) && !members.every(id => awayElsewhere(id, date)));
    if (empty.length > 0) gaps.push({ division, dates: empty });
  }
  return gaps;
}

/** The gaps in `after` that weren't in `before`: what a change adds. */
export function addedGaps(before: DivisionGap[], after: DivisionGap[]): DivisionGap[] {
  const had = new Set((before ?? []).flatMap(g => g.dates.map(d => `${g.division}\u0000${d}`)));
  return (after ?? [])
    .map(g => ({ division: g.division, dates: g.dates.filter(d => !had.has(`${g.division}\u0000${d}`)) }))
    .filter(g => g.dates.length > 0);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 5–6, 2026", "Nov 6 and Nov 9, 2026", "Sep 30 – Oct 1, 2026": runs of consecutive days. */
export function datesText(dates: string[]): string {
  const sorted = [...new Set(dates ?? [])].filter(isDate).sort();
  if (sorted.length === 0) return "";
  const runs: string[][] = [];
  for (const iso of sorted) {
    const run = runs[runs.length - 1];
    const next = run ? new Date(`${run[run.length - 1]}T00:00:00Z`) : null;
    next?.setUTCDate(next.getUTCDate() + 1);
    if (run && next!.toISOString().slice(0, 10) === iso) run.push(iso);
    else runs.push([iso]);
  }
  const years = new Set(sorted.map(d => d.slice(0, 4)));
  const day = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
  const runText = (run: string[]) => {
    const first = run[0], last = run[run.length - 1];
    if (first.slice(0, 4) !== last.slice(0, 4)) return `${day(first)}, ${first.slice(0, 4)} – ${day(last)}, ${last.slice(0, 4)}`;
    const text = first === last ? day(first)
      : first.slice(0, 7) === last.slice(0, 7) ? `${day(first)}–${Number(last.slice(8, 10))}`
      : `${day(first)} – ${day(last)}`;
    return years.size > 1 ? `${text}, ${first.slice(0, 4)}` : text;
  };
  const parts = runs.map(runText);
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return years.size > 1 ? joined : `${joined}, ${sorted[0].slice(0, 4)}`;
}

/** "Legal Division on Nov 5–6, 2026; Adjudication Division on Nov 9, 2026". */
export function gapText(gaps: DivisionGap[]): string {
  return (gaps ?? []).map(g => `${g.division} on ${datesText(g.dates)}`).join("; ");
}
