import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCcw, UserCheck } from "lucide-react";
import type { TrainingCoverage } from "../../types";
import { apiCall } from "../../utils";

interface Props {
  /** The fiscal year in view; "" until it is known. */
  fiscalYear: string;
  /** Changes whenever the planner reloads its data (a seminar or its roster saved), so the
   * coverage follows. */
  reloadToken?: unknown;
}

// Names shown before "Show all"; the rest stay one click away.
const FIRST_NAMES = 8;

/**
 * Programs & Budget: at least one training per year per employee (the user's rule, 2026-10-23).
 * How many active employees have one this fiscal year (a seminar, or a training HR recorded) and
 * who doesn't yet, so HR can give them a seat. The counting is the server's
 * (src/trainingCoverage.ts), the same the participant picker ranks by.
 */
export default function TrainingCoveragePanel({ fiscalYear, reloadToken }: Props) {
  // undefined while loading, null when it couldn't be loaded.
  const [coverage, setCoverage] = useState<TrainingCoverage | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!fiscalYear) return;
    let cancelled = false;
    setError("");
    apiCall(`/api/training/coverage?fiscalYear=${encodeURIComponent(fiscalYear)}`)
      .then(res => { if (!cancelled) setCoverage(res?.data ?? null); })
      .catch(err => {
        if (cancelled) return;
        setCoverage(null);
        setError(err?.message || "");
      });
    return () => { cancelled = true; };
  }, [fiscalYear, reloadToken, retry]);

  const fy = fiscalYear || "…";
  const total = coverage?.total ?? 0;
  const covered = coverage?.covered ?? 0;
  const without = coverage?.withoutTraining ?? [];
  const complete = !!coverage && total > 0 && without.length === 0;
  // Rounded down, so the bar reads 100% only when nobody is left.
  const percent = complete ? 100 : total > 0 ? Math.floor((covered / total) * 100) : 0;
  const shown = showAll ? without : without.slice(0, FIRST_NAMES);

  return (
    <section aria-labelledby="training-coverage" aria-busy={coverage === undefined} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex flex-wrap justify-between items-start gap-3 pb-3 mb-4 border-b border-slate-200">
        <div>
          <h3 id="training-coverage" className="text-sm font-extrabold uppercase tracking-wider text-slate-800">Training Coverage ({fy})</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Every employee should have at least one training each fiscal year: a seminar here, or a training HR recorded in Trainings and Seminar.
          </p>
        </div>
        <UserCheck size={18} className="text-blue-600 shrink-0" aria-hidden="true" />
      </div>

      {coverage === undefined ? (
        <p className="text-xs italic text-slate-500">Loading coverage…</p>
      ) : coverage === null ? (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <span className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            The training coverage couldn't be loaded.{error ? ` ${error}` : ""}
          </span>
          <button
            type="button"
            onClick={() => { setCoverage(undefined); setRetry(n => n + 1); }}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <RefreshCcw size={12} aria-hidden="true" /> Retry
          </button>
        </div>
      ) : total === 0 ? (
        <p className="text-xs italic text-slate-500">There are no active employees.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-700">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{covered}</span>
              <span className="text-slate-500"> of {total} employees</span> have at least one training in FY {fy}.
            </p>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={`${covered} of ${total} employees (${percent}%) have at least one training in FY ${fy}`}
            >
              <div className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${percent}%` }} />
            </div>
          </div>

          {complete ? (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={14} aria-hidden="true" /> Every employee has at least one training this fiscal year.
            </p>
          ) : (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Still without a training ({without.length})
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                The participant picker offers them first. A seminar counts once they are enrolled, unless HR marks them &ldquo;Did not attend&rdquo;.
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map(e => (
                  <li key={e.id} className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-800 truncate" title={e.fullName}>{e.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate" title={[e.position, e.division].filter(Boolean).join(" · ")}>
                      {[e.position, e.division].filter(Boolean).join(" · ") || "No position or division on file"}
                    </p>
                  </li>
                ))}
              </ul>
              {without.length > FIRST_NAMES && (
                <button
                  type="button"
                  onClick={() => setShowAll(v => !v)}
                  aria-expanded={showAll}
                  className="mt-2 cursor-pointer text-xs font-semibold text-blue-700 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  {showAll ? "Show fewer" : `Show all ${without.length}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
