import { AlertTriangle, ArrowUp, CalendarX2 } from "lucide-react";

/**
 * A new liquidation report before its seminar is chosen (the user's request of 2026-11-10, known-issues 12af): the sheet
 * stays locked until the seminar fills in its dates and the budget HR set. With no seminar waiting for a report, it says
 * where to see why instead, rather than pointing at an empty list; and when the seminars couldn't be loaded, it says that.
 */
export default function ChooseSeminarPrompt({ id, loadFailed = false, nothingToFile, onOpenSeminars, onRetry }: {
  id: string;
  /** The employee's seminars couldn't be loaded, so the list may be missing some. */
  loadFailed?: boolean;
  /** The seminar list has loaded and none of them is waiting for this employee's report. */
  nothingToFile: boolean;
  /** Opens My Assigned Activities, where each seminar says when its form opens. */
  onOpenSeminars: () => void;
  /** Loads the portal's lists again. */
  onRetry?: () => void;
}) {
  if (loadFailed) {
    return (
      <div id={id} role="alert" data-liq="load-failed" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          <strong className="font-semibold">Your seminars couldn&rsquo;t be loaded</strong>, so the form can&rsquo;t be filled in yet.{" "}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="cursor-pointer font-semibold text-amber-900 underline hover:text-amber-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Try again
            </button>
          )}
        </p>
      </div>
    );
  }
  if (nothingToFile) {
    return (
      <div id={id} data-liq="none-to-file" className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
        <CalendarX2 size={14} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        <p>
          <strong className="font-semibold text-slate-800">No seminar is waiting for your liquidation report.</strong>{" "}
          <button
            type="button"
            onClick={onOpenSeminars}
            className="cursor-pointer font-semibold text-blue-700 underline hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            My Assigned Activities
          </button>{" "}
          shows where each of your seminars stands and when its form opens.
        </p>
      </div>
    );
  }
  return (
    <p id={id} data-liq="choose-first" className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
      <ArrowUp size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Choose your seminar above:</strong> its dates and your budget fill in.
      </span>
    </p>
  );
}
