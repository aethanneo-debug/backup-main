import React from "react";
import { RefreshCcw, TrendingUp } from "lucide-react";
import { formatCurrency } from "../../utils";
import type { MonthTotal } from "../finance/overviewFigures";

interface MonthlyLiquidationChartProps {
  months: MonthTotal[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

const PLOT_HEIGHT = 160; // px; the month labels sit below it, outside this height

/** A round y-axis step (1, 2, 2.5 or 5 × a power of ten) giving about four gridlines. */
function niceStep(max: number): number {
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].map(m => m * power).find(s => s >= rough) ?? 10 * power;
}

/** ₱0, ₱500, ₱5K, ₱12.5K, ₱1.2M: compact from 1,000 up, for the axis and the bar labels. */
function compactPeso(n: number): string {
  if (n >= 1_000_000) return `₱${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₱${+(n / 1_000).toFixed(1)}K`;
  return `₱${+n.toFixed(2)}`;
}

/**
 * What validated liquidation reports spent per month (one series, so no legend: the title
 * names it). Bars are the app's blue-500, which passes the dataviz palette checks on white;
 * the brand navy (blue-600) is too dark for a data mark. Every value is on hover and keyboard
 * focus, and in the table under the chart; only the highest and the current month are labelled.
 */
export default function MonthlyLiquidationChart({ months, loading, failed, onRetry }: MonthlyLiquidationChartProps) {
  const max = Math.max(0, ...months.map(m => m.amount));
  const step = max > 0 ? niceStep(max) : 1;
  const top = step * Math.ceil(max / step) || step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const highest = months.findIndex(m => m.amount === max);
  const labelled = new Set([highest, months.length - 1]);
  const range = months.length > 0 ? `${months[0].fullLabel} – ${months[months.length - 1].fullLabel}` : "";

  return (
    <div className="lg:col-span-2 space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-busy={loading}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center text-xs font-bold uppercase tracking-tight text-slate-800">
            <TrendingUp size={15} className="mr-1.5 text-blue-600" aria-hidden="true" />
            Liquidated per month
          </h4>
          <p className="mt-0.5 text-[10px] text-slate-500">What validated reports spent, by the month Finance validated them.</p>
        </div>
        <span className="shrink-0 text-[10px] font-mono text-slate-500">{range}</span>
      </div>

      {loading ? (
        <p className="py-16 text-center text-xs italic text-slate-500">Loading…</p>
      ) : failed ? (
        <p className="flex items-center justify-center gap-2 py-16 text-xs text-rose-700">
          The liquidation reports couldn't be loaded.
          <button type="button" onClick={onRetry} className="inline-flex cursor-pointer items-center gap-1 font-semibold underline">
            <RefreshCcw size={12} aria-hidden="true" /> Retry
          </button>
        </p>
      ) : max === 0 ? (
        <p className="py-16 text-center text-xs italic text-slate-500">No reports were validated in these six months.</p>
      ) : (
        <>
          <div className="flex">
            {/* Y-axis: round, compact ticks. */}
            <div className="relative w-12 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
              {ticks.map(t => (
                <span key={t} className="absolute right-2 translate-y-1/2 text-[9px] font-mono tabular-nums text-slate-500" style={{ bottom: `${(t / top) * 100}%` }}>
                  {compactPeso(t)}
                </span>
              ))}
            </div>
            <div className="relative flex-1" style={{ height: PLOT_HEIGHT }}>
              {/* Solid hairline gridlines; the baseline one step darker. */}
              {ticks.map(t => (
                <div
                  key={t}
                  aria-hidden="true"
                  className={`absolute inset-x-0 border-t ${t === 0 ? "border-slate-300" : "border-slate-100"}`}
                  style={{ bottom: `${(t / top) * 100}%` }}
                />
              ))}
              <div className="absolute inset-0 flex" role="list" aria-label="Liquidated per month">
                {months.map((m, i) => {
                  const height = (m.amount / top) * 100;
                  const name = `${m.fullLabel}${m.current ? " (so far)" : ""}: ${formatCurrency(m.amount)} from ${m.count} report${m.count === 1 ? "" : "s"}`;
                  return (
                    // The whole month is the hit area (bigger than the bar), for hover and focus alike.
                    <div
                      key={m.key}
                      role="listitem"
                      tabIndex={0}
                      aria-label={name}
                      className="group relative flex flex-1 cursor-default items-end justify-center rounded outline-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {m.amount > 0 && (
                        <div className="w-6 rounded-t-[4px] bg-blue-500 group-hover:bg-blue-400 group-focus-visible:bg-blue-400" style={{ height: `${height}%` }} />
                      )}
                      {labelled.has(i) && m.amount > 0 && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute mb-1 text-[10px] font-semibold text-slate-700 group-hover:invisible group-focus-visible:invisible"
                          style={{ bottom: `${height}%` }}
                        >
                          {compactPeso(m.amount)}
                        </span>
                      )}
                      {/* Tooltip: the value leads, the month follows. */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block group-focus-visible:block"
                        style={{ bottom: `calc(${height}% + 8px)` }}
                      >
                        <strong className="block font-mono text-[11px]">{formatCurrency(m.amount)}</strong>
                        <span className="block text-slate-300">
                          {m.fullLabel}{m.current ? " (so far)" : ""} · {m.count} report{m.count === 1 ? "" : "s"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Month labels, below the plot's fixed height. */}
          <div className="flex pl-12" aria-hidden="true">
            {months.map(m => (
              <span key={m.key} className="flex-1 text-center text-[10px] font-semibold uppercase text-slate-500">
                {m.label}
                {m.current && <span className="block text-[9px] font-normal normal-case">so far</span>}
              </span>
            ))}
          </div>
          {/* The table twin: every value without hovering. */}
          <details className="text-[11px] text-slate-600">
            <summary className="cursor-pointer select-none text-[10px] font-semibold text-blue-700">Show the figures</summary>
            <table className="mt-2 w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-500">
                  <th className="py-1 font-semibold">Month</th>
                  <th className="py-1 text-right font-semibold">Reports</th>
                  <th className="py-1 text-right font-semibold">Liquidated</th>
                </tr>
              </thead>
              <tbody>
                {months.map(m => (
                  <tr key={m.key} className="border-b border-slate-50 last:border-0">
                    <td className="py-1">{m.fullLabel}{m.current ? " (so far)" : ""}</td>
                    <td className="py-1 text-right tabular-nums">{m.count}</td>
                    <td className="py-1 text-right font-mono tabular-nums">{formatCurrency(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}
