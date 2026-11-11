import type { FocusEvent } from "react";
import { Archive, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarSeminar, CalendarWeek, WeekSegment } from "../../trainingCalendar";
import { dateRange, longDate, seminarTone, weekdayName } from "./schedule";

/** Pixels: the day number's line, one lane (an 18 px bar and its gap), the "+N more" line, and the space under them. */
const DAY_HEAD = 24;
const LANE = 20;
const BAR = 18;
const MORE = 16;
const FOOT = 4;

/** The handlers a bar and a "+N more" button call (useCalendarPopover's). `key` names the control. */
export interface GridHandlers {
  onEnter: (id: string, anchor: HTMLElement, key: string) => void;
  onLeave: () => void;
  onFocus: (id: string, anchor: HTMLElement, key: string) => void;
  onBlur: (e: FocusEvent) => void;
  onClick: (id: string, anchor: HTMLElement, key: string) => void;
  onMore: (date: string, anchor: HTMLElement, key: string) => void;
}

interface CalendarGridProps {
  weeks: CalendarWeek[];
  byId: Map<string, CalendarSeminar>;
  today: string;
  /** For screen readers: "Seminars in November 2026". */
  caption: string;
  /** The lanes each day makes room for this month (1 to 3), and whether any day needs a "+N more" line. */
  lanes: number;
  more: boolean;
  /** The control whose popover is pinned open (aria-expanded). */
  expandedKey: string | null;
  /** While the seminars load: the bare grid, faded. */
  dimmed: boolean;
  handlers: GridHandlers;
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * The month as a table, Sunday first: one row a week, a cell a day (`data-cal-day`). A seminar is one bar per week it
 * touches, drawn from its first day in the row across every day it fills there, in its lane; one that goes on before or
 * after the row has a squared end with an arrow. Days past the third lane say "+N more".
 */
export default function CalendarGrid({ weeks, byId, today, caption, lanes, more, expandedKey, dimmed, handlers }: CalendarGridProps) {
  const height = DAY_HEAD + lanes * LANE + (more ? MORE : 0) + FOOT;
  return (
    // Its own sideways scroll below 28rem (a phone beside the sidebar), so the page never scrolls sideways.
    <div className={`custom-scrollbar relative overflow-x-auto ${dimmed ? "opacity-50" : ""}`}>
      <table className="w-full min-w-[28rem] table-fixed border-separate border-spacing-0 border-l border-t border-slate-200 text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map(i => (
              <th key={i} scope="col" className="border-b border-r border-slate-200 bg-slate-50 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <span aria-hidden="true">{weekdayName(i).slice(0, 3)}</span>
                <span className="sr-only">{weekdayName(i)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={week.days[0].date}>
              {week.days.map((day, col) => {
                const isToday = day.date === today;
                const starting = week.segments.filter(s => s.startCol === col).sort((a, b) => a.lane - b.lane);
                const hidden = week.hidden[col] ?? 0;
                const moreKey = `more-${day.date}`;
                return (
                  <td
                    key={day.date}
                    data-cal-day={day.date}
                    aria-current={isToday ? "date" : undefined}
                    className={`p-0 align-top ${isToday ? "bg-blue-50" : day.inMonth ? "bg-white" : "bg-slate-50"}`}
                  >
                    <div className="relative border-b border-r border-slate-200" style={{ height }}>
                      <span
                        aria-hidden="true"
                        className={`absolute left-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums ${
                          isToday ? "bg-blue-600 text-white" : day.inMonth ? "text-slate-700" : "text-slate-500"
                        }`}
                      >
                        {day.day}
                      </span>
                      <span className="sr-only">{longDate(day.date)}{isToday ? ", today" : ""}</span>
                      {starting.map(seg => {
                        const s = byId.get(seg.seminarId);
                        const key = `w${w}-${seg.seminarId}`;
                        return s ? <SeminarBar key={key} seg={seg} seminar={s} barKey={key} expanded={expandedKey === key} handlers={handlers} /> : null;
                      })}
                      {hidden > 0 && (
                        <button
                          type="button"
                          data-cal-more={day.date}
                          aria-label={`${hidden} more seminar${hidden === 1 ? "" : "s"} on ${longDate(day.date)}`}
                          aria-haspopup="dialog"
                          aria-expanded={expandedKey === moreKey}
                          onClick={e => handlers.onMore(day.date, e.currentTarget, moreKey)}
                          className="absolute left-0.5 right-1 cursor-pointer truncate rounded px-1 text-left text-[10px] font-semibold leading-4 text-blue-700 hover:bg-blue-50 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          style={{ top: DAY_HEAD + lanes * LANE, height: MORE }}
                        >
                          +{hidden} more
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One seminar's stretch in one week. It sits in the cell of its first day there and reaches across the next ones: each
 * cell's box is its column less the 1 px line on its right, so `span` columns are span × (100% + 1 px).
 */
function SeminarBar({ seg, seminar, barKey, expanded, handlers }: {
  seg: WeekSegment;
  seminar: CalendarSeminar;
  barKey: string;
  expanded: boolean;
  handlers: GridHandlers;
}) {
  const span = seg.endCol - seg.startCol + 1;
  const insetLeft = seg.continuesBefore ? 0 : 2;
  const insetRight = seg.continuesAfter ? 1 : 3;
  const tone = seminarTone(seminar.id, seminar.archived);
  return (
    <button
      type="button"
      data-cal-seminar={seminar.id}
      aria-label={`${seminar.title}, ${dateRange(seminar.startDate, seminar.endDate)}${seminar.archived ? ", archived" : ""}`}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onMouseEnter={e => handlers.onEnter(seminar.id, e.currentTarget, barKey)}
      onMouseLeave={handlers.onLeave}
      onFocus={e => handlers.onFocus(seminar.id, e.currentTarget, barKey)}
      onBlur={handlers.onBlur}
      onClick={e => handlers.onClick(seminar.id, e.currentTarget, barKey)}
      className={`absolute z-[1] flex cursor-pointer items-center gap-0.5 overflow-hidden border px-1 text-[10px] font-semibold leading-none hover:brightness-95 focus:outline-none focus-visible:z-[2] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ${tone.bar} ${
        seg.continuesBefore ? "rounded-l-none border-l-0" : "rounded-l"
      } ${seg.continuesAfter ? "rounded-r-none border-r-0" : "rounded-r"} ${seminar.archived ? "italic" : ""}`}
      style={{ top: DAY_HEAD + seg.lane * LANE, left: insetLeft, height: BAR, width: `calc(${span * 100}% + ${span - insetLeft - insetRight}px)` }}
    >
      {seg.continuesBefore && <ChevronLeft size={10} className="shrink-0" aria-hidden="true" />}
      {seminar.archived && <Archive size={9} className="shrink-0" aria-hidden="true" />}
      <span className="min-w-0 truncate">{seminar.title}</span>
      {seg.continuesAfter && <ChevronRight size={10} className="ml-auto shrink-0" aria-hidden="true" />}
    </button>
  );
}
