import { useId } from "react";
import { LayoutDashboard, RefreshCcw } from "lucide-react";
import type { ApiLoad } from "../useApiLoad";
import { dayText } from "./hrFormat";
import type { FiscalYearOption } from "./useHrDashboard";

interface HrHeaderProps {
  /** The fiscal year shown (its label), or "" until it is known. */
  fiscalYear: string;
  /** The Manila day the figures were drawn up, once they have loaded. */
  asOf?: string;
  /** The years the chooser offers, newest first. */
  years: ApiLoad<FiscalYearOption[]>;
  /** Whether the year shown is the active one (null: the dashboard asked for the active year). */
  showingActive: boolean;
  onChoose: (label: string, active: boolean) => void;
}

/** "HR Dashboard", what it shows and as of when, and the fiscal-year chooser (the active year first chosen). */
export default function HrHeader({ fiscalYear, asOf, years, showingActive, onChoose }: HrHeaderProps) {
  const selectId = useId();
  // Until the years load (or if they can't be), the chooser offers the year shown, so it never reads blank.
  const listed: FiscalYearOption[] = years.data ?? [];
  const options = fiscalYear && !listed.some(y => y.label === fiscalYear)
    ? [{ label: fiscalYear, active: showingActive }, ...listed]
    : listed;

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-800">
          <LayoutDashboard size={18} className="shrink-0 text-blue-600" aria-hidden="true" />
          HR Dashboard
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Staff, the trainings they attended, and the attendees&rsquo; liquidations{fiscalYear ? ` for FY ${fiscalYear}` : ""}.
          {asOf ? ` As of ${dayText(asOf)}.` : ""}
        </p>
      </div>
      <div className="flex min-w-0 max-w-full flex-col gap-1">
        <label htmlFor={selectId} className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fiscal year</label>
        <select
          id={selectId}
          data-hr-fy
          value={fiscalYear}
          disabled={options.length === 0}
          onChange={e => {
            const label = e.target.value;
            onChoose(label, !!options.find(y => y.label === label)?.active);
          }}
          className="max-w-full cursor-pointer rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-8 text-xs font-semibold text-slate-800 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:text-slate-500"
        >
          {/* No year to show yet: still loading, or none is active (the server then says why, below). */}
          {!fiscalYear && (
            <option value="" disabled={options.length > 0}>
              {options.length > 0 ? "Choose a fiscal year" : years.failed ? "No fiscal year" : "Loading…"}
            </option>
          )}
          {options.map(y => (
            <option key={y.label} value={y.label}>FY {y.label}{y.active ? " (active)" : ""}</option>
          ))}
        </select>
        {years.failed && (
          <p className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-rose-700">
            The other fiscal years couldn&rsquo;t be loaded.
            <button
              type="button"
              onClick={years.retry}
              className="inline-flex cursor-pointer items-center gap-0.5 rounded font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <RefreshCcw size={10} aria-hidden="true" /> Retry
            </button>
          </p>
        )}
      </div>
    </header>
  );
}
