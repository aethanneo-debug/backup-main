import { useId, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { ArrowRight, CalendarDays, ChevronLeft, Clock, Landmark, MapPin, Users, X, type LucideIcon } from "lucide-react";
import { seminarsOn, seminarDays, type CalendarSeminar } from "../../trainingCalendar";
import type { CalendarPop } from "./useCalendarPopover";
import {
  STANDING_BADGE, STANDING_LABEL, dateRange, dayCount, longDate, seatsText, seminarStanding, seminarTone, timeRange,
  type SeminarDetails
} from "./schedule";

interface CalendarPopoverProps {
  pop: CalendarPop;
  popRef: RefObject<HTMLDivElement | null>;
  seminars: CalendarSeminar[];
  byId: Map<string, CalendarSeminar>;
  details: Record<string, SeminarDetails>;
  today: string;
  onOpenSeminar?: (id: string) => void;
  openLabel: string;
  /** The fiscal year whose seminars `onOpenSeminar` can show (Programs & Budget lists only the active year's); a
   * seminar of another year gets a line saying so instead of the button. Undefined or null: every seminar can. */
  activeFiscalYear?: string | null;
  onClose: () => void;
  onShowSeminar: (id: string) => void;
  onBackToDay: () => void;
  panel: { onMouseEnter: () => void; onMouseLeave: () => void; onBlur: (e: FocusEvent) => void; onKeyDown: (e: KeyboardEvent<HTMLElement>) => void };
}

/**
 * The calendar's details: a seminar's dates, time, venue, seats and standing, with a way to open it; or every seminar
 * on a day ("+N more"), each opening its details. Positioned by useCalendarPopover. A preview (on hover or focus) keeps
 * its buttons out of the Tab order: the keyboard reaches them once it is pinned (a click, or Enter on the bar).
 */
export default function CalendarPopover({
  pop, popRef, seminars, byId, details, today, onOpenSeminar, openLabel, activeFiscalYear, onClose, onShowSeminar, onBackToDay, panel
}: CalendarPopoverProps) {
  const titleId = useId();
  const seminar = pop.kind === "seminar" ? byId.get(pop.id) : undefined;
  const day = pop.kind === "day" ? seminarsOn(seminars, pop.date) : [];
  if (pop.kind === "seminar" && !seminar) return null;
  const tab = pop.pinned ? undefined : -1;
  const openable = !!seminar && !!onOpenSeminar && (activeFiscalYear == null || seminar.fiscalYear === activeFiscalYear);

  return (
    <div
      ref={popRef}
      data-cal-popover
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      onMouseEnter={panel.onMouseEnter}
      onMouseLeave={panel.onMouseLeave}
      onBlur={panel.onBlur}
      onKeyDown={panel.onKeyDown}
      className="absolute z-40 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl focus:outline-none"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {pop.kind === "seminar" && pop.fromDay && (
            <button
              type="button"
              tabIndex={tab}
              onClick={onBackToDay}
              className="mb-1 inline-flex cursor-pointer items-center gap-0.5 rounded text-[10px] font-semibold text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <ChevronLeft size={11} aria-hidden="true" /> All seminars on {dateRange(pop.fromDay, pop.fromDay).replace(/, \d{4}$/, "")}
            </button>
          )}
          <h4 id={titleId} className="break-words text-sm font-bold leading-snug text-slate-800">
            {seminar ? seminar.title : longDate((pop as { date: string }).date)}
          </h4>
          {!seminar && <p className="mt-0.5 text-[11px] text-slate-500">{day.length} seminar{day.length === 1 ? "" : "s"} on this day</p>}
        </div>
        <button
          type="button"
          tabIndex={tab}
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {seminar ? (
        <SeminarFacts seminar={seminar} details={details[seminar.id]} today={today} />
      ) : (
        <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-0.5 custom-scrollbar">
          {day.map(s => {
            const standing = seminarStanding(s, today);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  tabIndex={tab}
                  onClick={() => onShowSeminar(s.id)}
                  className="flex w-full cursor-pointer flex-wrap items-start gap-2 rounded-lg border border-slate-100 p-2 text-left hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span aria-hidden="true" className={`mt-1 h-2 w-2 shrink-0 rounded-full ${seminarTone(s.id, s.archived).dot}`} />
                  <span className="min-w-0 flex-1 basis-32">
                    <span className="block break-words text-[11px] font-semibold text-slate-800">{s.title}</span>
                    <span className="block text-[10px] text-slate-500">{dateRange(s.startDate, s.endDate)}</span>
                  </span>
                  <span className={`max-w-full rounded border px-1.5 py-0.5 text-[9px] font-bold ${STANDING_BADGE[standing]}`}>{STANDING_LABEL[standing]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {seminar && onOpenSeminar && !openable && (
        // Programs & Budget lists only the active year's seminars: the button would land on a table without it.
        <p data-cal-other-year className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] leading-snug text-slate-600">
          {seminar.fiscalYear ? `A seminar of FY ${seminar.fiscalYear}.` : "No fiscal year is recorded for this seminar."} Programs &amp; Budget lists
          FY {activeFiscalYear}&rsquo;s seminars only.
        </p>
      )}
      {seminar && onOpenSeminar && openable && (
        <button
          type="button"
          data-cal-open
          tabIndex={tab}
          onClick={() => onOpenSeminar(seminar.id)}
          className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {openLabel} <ArrowRight size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function SeminarFacts({ seminar, details, today }: { seminar: CalendarSeminar; details?: SeminarDetails; today: string }) {
  const standing = seminarStanding(seminar, today);
  return (
    <>
      <span className={`mt-1.5 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${STANDING_BADGE[standing]}`}>
        {STANDING_LABEL[standing]}
      </span>
      <dl className="mt-2 space-y-1.5 text-[11px]">
        <Fact icon={CalendarDays} term="Dates">
          {dateRange(seminar.startDate, seminar.endDate)} · {dayCount(seminarDays(seminar).length)}
        </Fact>
        <Fact icon={Clock} term="Time">{(details && timeRange(details.startTime, details.endTime)) || "Not set"}</Fact>
        <Fact icon={MapPin} term="Venue">{details?.venue || "Not set"}</Fact>
        <Fact icon={Users} term="Seats">{seatsText(details)}</Fact>
        <Fact icon={Landmark} term="Year">{seminar.fiscalYear ? `FY ${seminar.fiscalYear}` : "Not recorded"}</Fact>
      </dl>
    </>
  );
}

function Fact({ icon: Icon, term, children }: { icon: LucideIcon; term: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="flex w-14 shrink-0 items-center gap-1 text-slate-500">
        <Icon size={12} aria-hidden="true" /> {term}
      </dt>
      <dd className="min-w-0 break-words font-medium text-slate-800">{children}</dd>
    </div>
  );
}
