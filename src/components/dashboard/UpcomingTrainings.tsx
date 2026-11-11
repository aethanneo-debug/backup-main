import { useId, type ReactNode } from "react";
import { CalendarClock, CalendarX, Clock, MapPin, Users } from "lucide-react";
import { manilaDay, seminarDays, upcomingSeminars, type CalendarSeminar } from "../../trainingCalendar";
import { EmptyState, LoadFailed, Skeleton } from "./LoadStates";
import {
  STANDING_BADGE, STANDING_LABEL, dateRange, dayCount, seatsText, seminarStanding, seminarTone, timeRange, whenText,
  type SeminarDetails
} from "./schedule";

interface UpcomingTrainingsProps {
  seminars: CalendarSeminar[];
  details: Record<string, SeminarDetails>;
  today?: string;
  /** How many to list (the soonest first). */
  limit?: number;
  loading?: boolean;
  failed?: boolean;
  message?: string;
  onRetry?: () => void;
  /** Opens a seminar where it is kept; without it the items are plain text. */
  onOpenSeminar?: (id: string) => void;
  /** The fiscal year whose seminars `onOpenSeminar` can show (Programs & Budget lists only the active year's): another
   * year's seminar is listed with its year, as plain text. Undefined or null: every item opens. */
  activeFiscalYear?: string | null;
  /** The failure is announced by another panel showing the same load (the calendar beside it). */
  quietFailure?: boolean;
  /** What the empty list offers instead (e.g. a way to Programs & Budget). */
  emptyAction?: ReactNode;
  className?: string;
}

/**
 * The seminars under way or still to come, soonest first (12ag): when, where, how many seats are taken, and how far off.
 * Archived ones aren't listed. Each item opens its seminar. Shared like the calendar (HR's dashboard reuses it).
 */
export default function UpcomingTrainings({
  seminars, details, today = manilaDay(), limit = 5, loading = false, failed = false, message, onRetry, onOpenSeminar,
  activeFiscalYear, quietFailure = false, emptyAction, className = ""
}: UpcomingTrainingsProps) {
  const titleId = useId();
  const list = upcomingSeminars(seminars ?? [], today, limit);
  const opens = (s: CalendarSeminar) => !!onOpenSeminar && (activeFiscalYear == null || s.fiscalYear === activeFiscalYear);

  return (
    <section aria-labelledby={titleId} aria-busy={loading} className={`min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4 ${className}`}>
      <h3 id={titleId} className="flex items-center text-xs font-bold uppercase tracking-tight text-slate-800">
        <CalendarClock size={15} className="mr-1.5 shrink-0 text-blue-600" aria-hidden="true" />
        Upcoming Trainings
      </h3>
      <p className="mt-0.5 text-[10px] text-slate-500">Under way or still to come, the soonest first.</p>

      <div className="mt-3">
        {loading ? (
          <div className="space-y-2" role="status">
            {/* The skeletons are hidden from screen readers, so the status says it in words. */}
            <span className="sr-only">Loading the upcoming trainings…</span>
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : failed ? (
          <LoadFailed what="The upcoming trainings couldn't be loaded." message={message} quiet={quietFailure} onRetry={() => onRetry?.()} />
        ) : list.length === 0 ? (
          <EmptyState icon={<CalendarX size={18} />} title="No trainings coming up" action={emptyAction}>
            No seminar is under way or scheduled from today on.
          </EmptyState>
        ) : (
          <ul data-upcoming className="space-y-2">
            {list.map(s => (
              <li key={s.id} data-upcoming-item={s.id}>
                {opens(s) ? (
                  <button
                    type="button"
                    onClick={() => onOpenSeminar?.(s.id)}
                    className="block w-full cursor-pointer rounded-lg border border-slate-100 p-2.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Item seminar={s} details={details?.[s.id]} today={today} />
                  </button>
                ) : (
                  // Another year's seminar (Programs & Budget lists the active year's only), or no way to open any.
                  <div className="rounded-lg border border-slate-100 p-2.5">
                    <Item seminar={s} details={details?.[s.id]} today={today} otherYear={!!onOpenSeminar && activeFiscalYear != null ? activeFiscalYear : undefined} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** One item. `otherYear`: the active fiscal year, when this seminar is of another one and so can't be opened. */
function Item({ seminar, details, today, otherYear }: { seminar: CalendarSeminar; details?: SeminarDetails; today: string; otherYear?: string }) {
  const standing = seminarStanding(seminar, today);
  const time = details ? timeRange(details.startTime, details.endTime) : "";
  return (
    <span className="flex items-start gap-2">
      <span aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${seminarTone(seminar.id).dot}`} />
      <span className="min-w-0 flex-1 break-words">
        <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <span className="min-w-0 text-xs font-semibold leading-snug text-slate-800">{seminar.title}</span>
          <span className={`max-w-full rounded border px-1.5 py-0.5 text-[9px] font-bold ${STANDING_BADGE[standing]}`}>{STANDING_LABEL[standing]}</span>
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-slate-700">
          {dateRange(seminar.startDate, seminar.endDate)} · {dayCount(seminarDays(seminar).length)} · <span className="text-slate-500">{whenText(seminar, today)}</span>
        </span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1"><Clock size={10} aria-hidden="true" />{time || "Time not set"}</span>
          <span className="inline-flex min-w-0 items-center gap-1"><MapPin size={10} className="shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{details?.venue || "Venue not set"}</span></span>
          <span className="inline-flex items-center gap-1"><Users size={10} aria-hidden="true" />{seatsText(details)}</span>
        </span>
        {otherYear !== undefined && (
          <span data-upcoming-other-year className="mt-1 block text-[10px] text-slate-500">
            {seminar.fiscalYear ? `FY ${seminar.fiscalYear}` : "No fiscal year recorded"}: Programs &amp; Budget lists FY {otherYear}&rsquo;s seminars only.
          </span>
        )}
      </span>
    </span>
  );
}
