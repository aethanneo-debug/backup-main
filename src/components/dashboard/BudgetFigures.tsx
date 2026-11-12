import type { ReactNode } from "react";
import { formatCurrency } from "../../utils";
import { allocatedLine, type TrainingBudgetFigures } from "./budgetRows";

/** Unallocated under this reads as running low (as Programs & Budget tints its card, 12af). */
const LOW = 50_000;

/**
 * The year's training budget in four figures, with the sum that joins them: Total Allocated + Unallocated = Overall
 * Total Budget. Total Allocated is what the seminars still hold, so money they gave back leaves it (the user's decision
 * of 2026-11-12, as on Programs & Budget, Finance's overview and Budget Monitoring); its line says what HR allocated and
 * what came back. "…" while loading, "—" when the budget couldn't be loaded; never a zero that isn't known.
 */
export default function BudgetFigures({ figures, fiscalYear, loading, failed }: {
  figures: TrainingBudgetFigures | null;
  fiscalYear: string;
  loading: boolean;
  failed: boolean;
}) {
  const f = figures;
  const shown = (value: number | undefined) => (loading ? "…" : failed || !f || value === undefined ? "—" : formatCurrency(value));
  const pending = loading ? "Loading…" : failed || !f ? "Couldn't be loaded" : null;
  const short = !!f && f.unallocated < 0;
  const low = !!f && !short && f.unallocated < LOW;

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure name="total" label="Overall Total Budget" value={shown(f?.total)}>
          {pending ?? (f!.carryOver > 0
            ? `Carry-over ${formatCurrency(f!.carryOver)} + new annual budget ${formatCurrency(f!.newAnnual)}`
            : `FY ${fiscalYear}'s annual training budget; no carry-over`)}
        </Figure>
        <Figure name="allocated" label="Total Allocated" value={shown(f?.committed)}>
          {pending ?? allocatedLine(f!, fiscalYear)}
        </Figure>
        <Figure
          name="unallocated"
          label="Unallocated"
          value={shown(f?.unallocated)}
          tone={short ? "border-rose-200 bg-rose-50" : low ? "border-amber-200 bg-amber-50" : undefined}
          valueTone={short ? "text-rose-700" : low ? "text-amber-700" : undefined}
        >
          {pending ?? (short
            ? "Seminars take more than the budget holds"
            : low ? `Under ${formatCurrency(LOW)} left for new seminars` : "Free for new seminars")}
        </Figure>
        <Figure name="returned" label="Returned to Unallocated" value={shown(f?.returned)} valueTone="text-emerald-700">
          {pending ?? "Leftovers handed back on liquidated reports, the shares of those who didn’t attend, and what closed seminars didn’t spend."}
        </Figure>
      </div>
      {f && !loading && !failed && (
        <>
          {/* The figures as one sum: what the seminars hold and what is free make up the total. */}
          <p data-budget-sum className="break-words text-[11px] leading-snug text-slate-500">
            Total Allocated {formatCurrency(f.committed)} + Unallocated {formatCurrency(f.unallocated)} ={" "}
            <span className="font-semibold text-slate-700">Overall Total Budget {formatCurrency(f.total)}</span>
          </p>
          {f.over > 0 && (
            <p data-budget-over className="break-words text-[11px] font-semibold leading-snug text-amber-700">
              {formatCurrency(f.over)} spent or held beyond seminars&rsquo; allocations (taken from Unallocated)
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** One figure: its label, its amount (`data-budget-fig`), and a line on what it holds. */
function Figure({ name, label, value, tone = "border-slate-200 bg-slate-50", valueTone = "text-slate-800", children }: {
  name: "total" | "allocated" | "unallocated" | "returned";
  label: string;
  value: string;
  tone?: string;
  valueTone?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-lg border p-2 sm:p-3 ${tone}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p data-budget-fig={name} className={`mt-1 break-words font-mono text-sm font-bold tabular-nums leading-tight sm:text-lg ${valueTone}`}>{value}</p>
      <p className="mt-1 break-words text-[10px] leading-snug text-slate-500">{children}</p>
    </div>
  );
}
