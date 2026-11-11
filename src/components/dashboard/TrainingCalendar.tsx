import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Archive, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { MAX_LANES, addMonths, layoutMonth, manilaDay, type CalendarSeminar } from "../../trainingCalendar";
import CalendarGrid from "./CalendarGrid";
import CalendarPopover from "./CalendarPopover";
import { LoadFailed } from "./LoadStates";
import { ARCHIVED_TONE, monthLabel, type SeminarDetails } from "./schedule";
import { useCalendarPopover } from "./useCalendarPopover";

interface TrainingCalendarProps {
  seminars: CalendarSeminar[];
  details: Record<string, SeminarDetails>;
  /** Manila's day (YYYY-MM-DD): the month shown first, and the day marked. */
  today?: string;
  /** Opens a seminar where it is kept (the dashboard: Programs & Budget). Without it, the details offer no button. */
  onOpenSeminar?: (id: string) => void;
  openLabel?: string;
  /** The fiscal year whose seminars `onOpenSeminar` can show (Programs & Budget lists only the active year's). A seminar
   * of another year says so instead of offering the button. Undefined or null: every seminar can be opened. */
  activeFiscalYear?: string | null;
  /** The seminars are still loading, or couldn't be: the grid waits, faded, or a Retry shows instead. */
  loading?: boolean;
  failed?: boolean;
  message?: string;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * The training calendar (the instructor's suggestions of 2026-11-11, 12ag): a month at a time, each seminar coloured on
 * every day it fills, with its details on hover, focus or click. Shows what it is given and asks for nothing, so any
 * role's dashboard can use it (the Administrator's now, HR's next).
 */
export default function TrainingCalendar({
  seminars, details, today = manilaDay(), onOpenSeminar, openLabel = "Open in Programs & Budget", activeFiscalYear,
  loading = false, failed = false, message, onRetry, title = "Training Calendar", className = ""
}: TrainingCalendarProps) {
  const titleId = useId();
  const host = useRef<HTMLElement>(null);
  const [view, setView] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const list = seminars ?? [];
  const weeks = useMemo(() => layoutMonth(list, view.year, view.month), [list, view]);
  const byId = useMemo(() => new Map(list.map(s => [s.id, s])), [list]);
  const { pop, popRef, close, bar, panel, showSeminar, backToDay } = useCalendarPopover(host);

  // Another month, or another list: whatever was open is about something no longer shown.
  useEffect(() => close(false), [view, seminars, close]);

  const first = `${view.year}-${pad(view.month)}-01`;
  const last = `${view.year}-${pad(view.month)}-${pad(lastDay(view.year, view.month))}`;
  const inMonth = list.filter(s => s.startDate <= last && s.endDate >= first).length;
  // Seminars drawn anywhere on the grid, the neighbouring months' days in its first and last rows included.
  const drawn = new Set(weeks.flatMap(w => w.segments.map(s => s.seminarId))).size;
  const usedLanes = Math.max(0, ...weeks.flatMap(w => w.segments.map(s => s.lane + 1)));
  const more = weeks.some(w => w.hidden.some(n => n > 0));
  const month = monthLabel(view.year, view.month);
  const go = (delta: number) => setView(v => addMonths(v.year, v.month, delta));
  const goToday = () => setView({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });

  return (
    <section
      ref={host}
      data-calendar
      aria-labelledby={titleId}
      aria-busy={loading}
      className={`relative min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 id={titleId} className="flex items-center text-xs font-bold uppercase tracking-tight text-slate-800">
            <CalendarDays size={15} className="mr-1.5 shrink-0 text-blue-600" aria-hidden="true" />
            {title}
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-500">Each seminar is coloured on every day it takes, weekends included.</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* A fixed width from sm up, so the buttons don't move as the month's name changes length. */}
          <h4 data-cal-month aria-live="polite" className="text-sm font-bold text-slate-800 sm:min-w-[8.5rem]">{month}</h4>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Change month">
            <NavButton nav="prev" label="Previous month" onClick={() => go(-1)}><ChevronLeft size={14} aria-hidden="true" /></NavButton>
            <NavButton nav="today" onClick={goToday}>Today</NavButton>
            <NavButton nav="next" label="Next month" onClick={() => go(1)}><ChevronRight size={14} aria-hidden="true" /></NavButton>
          </div>
        </div>
      </div>

      {failed ? (
        <LoadFailed className="mt-3" what="The seminars couldn't be loaded." message={message} onRetry={() => onRetry?.()} />
      ) : (
        <>
          <div className="mt-3">
            <CalendarGrid
              weeks={weeks}
              byId={byId}
              today={today}
              caption={`Seminars in ${month}`}
              lanes={Math.min(MAX_LANES, Math.max(1, usedLanes))}
              more={more}
              expandedKey={pop?.pinned ? pop.key : null}
              dimmed={loading}
              handlers={{ ...bar }}
            />
          </div>
          <p role="status" className="mt-2 text-[11px] text-slate-500">
            {loading
              ? "Loading the seminars…"
              : inMonth > 0
                ? `${inMonth} seminar${inMonth === 1 ? "" : "s"} this month.`
                : drawn > 0
                  ? "No seminars this month; those shown are on the days from the months beside it."
                  : "No seminars this month."}
          </p>
          <Legend todayNumber={Number(today.slice(8, 10))} />
        </>
      )}

      {pop && !failed && (
        <CalendarPopover
          pop={pop}
          popRef={popRef}
          seminars={list}
          byId={byId}
          details={details ?? {}}
          today={today}
          onOpenSeminar={onOpenSeminar}
          openLabel={openLabel}
          activeFiscalYear={activeFiscalYear}
          onClose={() => close(true)}
          onShowSeminar={showSeminar}
          onBackToDay={backToDay}
          panel={panel}
        />
      )}
    </section>
  );
}

function NavButton({ nav, label, onClick, children }: { nav: "prev" | "next" | "today"; label?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      data-cal-nav={nav}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {children}
    </button>
  );
}

/** What the marks mean (each seminar's own colour means nothing more than "this seminar"). */
function Legend({ todayNumber }: { todayNumber: number }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600" aria-label="Legend">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-semibold text-white">
          {todayNumber || ""}
        </span>
        Today
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className={`inline-flex h-3.5 w-7 items-center rounded border px-0.5 ${ARCHIVED_TONE.bar}`}>
          <Archive size={8} />
        </span>
        Archived once finished
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-flex h-3.5 w-7 items-center justify-end rounded-l border border-r-0 border-slate-300 bg-slate-100 text-slate-600">
          <ChevronRight size={9} />
        </span>
        Goes on into the next week or month
      </li>
    </ul>
  );
}
