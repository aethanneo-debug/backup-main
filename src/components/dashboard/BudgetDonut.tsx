import { PieChart as PieIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "../../utils";
import { EmptyState } from "./LoadStates";
import { FREE_GREEN, NAVY, percentOf } from "./chartFormat";
import type { TrainingBudgetFigures } from "./budgetRows";

/**
 * The year's budget as one ring: what the seminars take now (navy) and what is still free (emerald). When the seminars
 * take more than the budget, there is no free part to draw: the ring is all "taken", and a note says by how much it is
 * over, rather than a negative slice.
 */
export default function BudgetDonut({ figures, fiscalYear }: { figures: TrainingBudgetFigures; fiscalYear: string }) {
  const { total, committed, unallocated } = figures;
  const over = unallocated < 0;
  if (total <= 0 && committed <= 0) {
    return (
      <EmptyState icon={<PieIcon size={18} />} title="Nothing to chart yet">
        FY {fiscalYear}&rsquo;s Overall Total Budget is {formatCurrency(total)}, and no seminar takes anything from it.
      </EmptyState>
    );
  }
  const slices = [
    { key: "taken", name: "Taken by seminars", value: committed, fill: NAVY },
    { key: "free", name: "Unallocated", value: over ? 0 : unallocated, fill: FREE_GREEN }
  ];
  const drawn = slices.filter(s => s.value > 0);
  const pct = percentOf(committed, total);
  const summary = `${pct === null ? "" : `${pct}% taken. `}Taken by seminars ${formatCurrency(committed)}; Unallocated ${formatCurrency(unallocated)}; Overall Total Budget ${formatCurrency(total)}.`;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-4">
        {/* At most 10rem square, smaller when the card is narrower (a phone beside the sidebar). */}
        <div data-chart="budget-donut" className="relative aspect-square w-40 max-w-full shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            {/* No keyboard layer: Recharts 3 would make the ring a Tab stop that moves nothing (a pie's tooltip is per
                slice); the legend beside it and "Show the figures" carry every figure. */}
            <PieChart title={`FY ${fiscalYear} training budget`} desc={summary} accessibilityLayer={false}>
              <Pie
                data={drawn}
                dataKey="value"
                nameKey="name"
                innerRadius="64%"
                outerRadius="96%"
                startAngle={90}
                endAngle={-270}
                stroke="#ffffff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {drawn.map(s => <Cell key={s.key} fill={s.fill} />)}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  const slice = active ? payload?.[0] : undefined;
                  if (!slice) return null;
                  const value = Number(slice.value) || 0;
                  const share = percentOf(value, total);
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 shadow-lg">
                      <p className="font-semibold text-slate-800">{String(slice.name ?? "")}</p>
                      <p className="font-mono tabular-nums">{formatCurrency(value)}{share === null ? "" : ` · ${share}% of the budget`}</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* The share taken, in the hole (the chart's own title and description carry it for screen readers). */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-mono text-lg font-bold leading-none tabular-nums ${over ? "text-rose-700" : "text-slate-800"}`}>
              {pct === null ? "—" : `${pct}%`}
            </span>
            <span className="mt-0.5 text-[10px] text-slate-500">taken</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2 text-[11px]">
          {slices.map(s => (
            <li key={s.key} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.fill }} />
              <span className="min-w-0 flex-1 break-words">
                <span className="block font-semibold text-slate-700">{s.name}</span>
                <span className={`block font-mono tabular-nums ${s.key === "free" && over ? "text-rose-700" : "text-slate-800"}`}>
                  {formatCurrency(s.key === "taken" ? committed : unallocated)}
                </span>
                <span className="block text-[10px] text-slate-500">
                  {s.key === "taken" ? "Held for open seminars, or spent by closed ones" : over ? "Nothing is free: the seminars take more" : "Free for new seminars"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {over && (
        <p role="note" className="mt-3 break-words rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
          Over the budget by {formatCurrency(-unallocated)}: the seminars take {formatCurrency(committed)} of the {formatCurrency(total)} budget.
        </p>
      )}
      <details className="mt-3 text-[11px] text-slate-600">
        <summary className="cursor-pointer select-none text-[10px] font-semibold text-blue-700">Show the figures</summary>
        <div className="relative mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">FY {fiscalYear} training budget, taken and free</caption>
            <tbody>
              <tr className="border-b border-slate-100">
                <th scope="row" className="py-1 font-normal">Taken by seminars</th>
                <td className="py-1 text-right font-mono tabular-nums">{formatCurrency(committed)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <th scope="row" className="py-1 font-normal">Unallocated</th>
                <td className="py-1 text-right font-mono tabular-nums">{formatCurrency(unallocated)}</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 font-semibold">Overall Total Budget</th>
                <td className="py-1 text-right font-mono font-semibold tabular-nums">{formatCurrency(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
