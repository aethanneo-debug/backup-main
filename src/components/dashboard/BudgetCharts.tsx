import { useId, useMemo, type ReactNode } from "react";
import { ArrowRight, BarChart3, PieChart as PieIcon, Wallet } from "lucide-react";
import { seminarBudgetRows } from "./budgetRows";
import BudgetDonut from "./BudgetDonut";
import BudgetFigures from "./BudgetFigures";
import { EmptyState, LoadFailed, PanelLink, Skeleton } from "./LoadStates";
import SeminarBudgetChart from "./SeminarBudgetChart";
import type { TrainingBudgetLoad } from "./useTrainingBudget";
import type { TrainingSchedule } from "./useTrainingSchedule";

interface BudgetChartsProps {
  budget: TrainingBudgetLoad;
  /** The schedule the server priced (for the per-seminar chart). */
  schedule: Pick<TrainingSchedule, "rows" | "loading" | "failed" | "message" | "retry">;
  /** Programs & Budget, where seminars are planned and allocated. */
  onOpenPrograms: () => void;
}

/**
 * The Administrator's view of the year's training budget (the instructor's suggestion of 2026-11-11, 12ag): the figures,
 * a ring of what is taken and what is free, and each seminar's allocation beside what it takes now. The figures are the
 * server's (Budget Monitoring's and Programs & Budget's), so the three screens agree.
 */
export default function BudgetCharts({ budget, schedule, onOpenPrograms }: BudgetChartsProps) {
  const titleId = useId();
  const fy = budget.fiscalYear?.label ?? "";
  const rows = useMemo(() => seminarBudgetRows(schedule.rows, fy), [schedule.rows, fy]);
  const noBudget = !budget.loading && !budget.failed && !budget.figures;

  return (
    <section data-dash="budget" aria-labelledby={titleId} aria-busy={budget.loading || schedule.loading} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h3 id={titleId} className="flex items-center text-xs font-bold uppercase tracking-tight text-slate-800">
            <Wallet size={15} className="mr-1.5 shrink-0 text-blue-600" aria-hidden="true" />
            Training Budget{fy ? `, FY ${fy}` : ""}
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-500">What the year&rsquo;s seminars were allocated, what they take now, and what is still free.</p>
        </div>
        <PanelLink onClick={onOpenPrograms}>Programs &amp; Budget <ArrowRight size={11} aria-hidden="true" /></PanelLink>
      </div>

      {budget.failed && <LoadFailed className="mt-3" what="The training budget couldn't be loaded." message={budget.message} onRetry={budget.retry} />}
      {noBudget ? (
        <div className="mt-3">
          <EmptyState icon={<Wallet size={18} />} title={`No training budget has been set for FY ${fy}`}>
            The Budget Officer sets it in Budget Monitoring. Until then the seminars below are allocated against nothing.
          </EmptyState>
        </div>
      ) : (
        <BudgetFigures figures={budget.figures} fiscalYear={fy} loading={budget.loading} failed={budget.failed} />
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel icon={<PieIcon size={13} aria-hidden="true" />} title="Taken and free">
          {budget.loading ? (
            <Skeleton className="h-40" />
          ) : budget.failed ? (
            <p className="py-6 text-center text-xs italic text-slate-500">—</p>
          ) : budget.figures ? (
            <BudgetDonut figures={budget.figures} fiscalYear={fy} />
          ) : (
            <p className="py-6 text-center text-xs italic text-slate-500">No budget to chart.</p>
          )}
        </Panel>
        <Panel icon={<BarChart3 size={13} aria-hidden="true" />} title="Each seminar: allocated and taken now" className="xl:col-span-2">
          {budget.loading || schedule.loading ? (
            <Skeleton className="h-40" />
          ) : schedule.failed ? (
            // Quiet: the calendar below alerts about the same failed load.
            <LoadFailed what="The seminars couldn't be loaded." message={schedule.message} quiet onRetry={schedule.retry} />
          ) : budget.failed ? (
            <p className="py-6 text-center text-xs italic text-slate-500">Shown once the fiscal year can be loaded.</p>
          ) : rows.length === 0 ? (
            <EmptyState icon={<BarChart3 size={18} />} title={`No seminars in FY ${fy} yet`} action={<PanelLink onClick={onOpenPrograms}>Plan one in Programs &amp; Budget</PanelLink>}>
              Each seminar&rsquo;s allocation will show here once HR adds it.
            </EmptyState>
          ) : (
            <SeminarBudgetChart rows={rows} fiscalYear={fy} />
          )}
        </Panel>
      </div>
    </section>
  );
}

function Panel({ icon, title, className = "", children }: { icon: ReactNode; title: string; className?: string; children: ReactNode }) {
  return (
    // A box of its own from sm up; on a phone, where every pixel counts, just the heading and the chart.
    <div className={`min-w-0 rounded-lg sm:border sm:border-slate-100 sm:p-3 ${className}`}>
      <h4 className="mb-2 flex items-start gap-1.5 text-[11px] font-semibold text-slate-700">
        <span className="mt-px shrink-0 text-blue-600">{icon}</span>
        <span className="min-w-0">{title}</span>
      </h4>
      {children}
    </div>
  );
}
