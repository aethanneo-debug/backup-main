import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "../../utils";
import type { SeminarBudgetRow } from "./budgetRows";
import { ALLOCATED_BLUE, NAVY, compactPeso } from "./chartFormat";
import { dateRange } from "./schedule";

/** Pixels a seminar takes on the chart (its two bars and the gap), and the axis under them. */
const ROW = 34;
const AXIS = 34;
const TITLE_MAX = 26;

const short = (title: string) => (title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1).trimEnd()}…` : title);
const dates = (r: SeminarBudgetRow) => (r.startDate ? dateRange(r.startDate, r.endDate || r.startDate) : "Dates not set");
const sum = (rows: SeminarBudgetRow[], pick: (r: SeminarBudgetRow) => number) => Math.round(rows.reduce((s, r) => s + Math.round(pick(r) * 100), 0)) / 100;

/**
 * Each seminar of the year: what HR allocated it (light blue) beside what it takes from the budget now (navy), earliest
 * first, priced as Programs & Budget prices it (budgetRows.ts). A seminar taking less than its allocation gave the rest
 * back to Unallocated; one taking more took it from there. Every figure is in the tooltip and in the table under it.
 */
export default function SeminarBudgetChart({ rows, fiscalYear }: { rows: SeminarBudgetRow[]; fiscalYear: string }) {
  const byId = new Map(rows.map(r => [r.id, r]));
  const height = rows.length * ROW + AXIS;
  return (
    <div data-chart="seminar-budgets" className="min-w-0">
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600" aria-label="Chart key">
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: ALLOCATED_BLUE }} /><span className="min-w-0">Allocated</span></li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: NAVY }} /><span className="min-w-0">Taken now</span></li>
      </ul>
      {/* Taller than 26rem (about a dozen seminars) scrolls; narrower than 20rem scrolls sideways. */}
      <div className="custom-scrollbar relative max-h-[26rem] overflow-auto">
        <div className="min-w-[20rem]" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 2, right: 12, bottom: 2, left: 2 }}
              barGap={2}
              barCategoryGap="24%"
              title={`FY ${fiscalYear} seminars: allocated and taken now`}
              desc="Each seminar's allocation beside what it takes from the training budget now. The table under the chart lists every figure."
            >
              <CartesianGrid horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={compactPeso} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="id"
                width={150}
                interval={0}
                tickFormatter={(id: string) => short(byId.get(id)?.title ?? "")}
                tick={{ fontSize: 10, fill: "#334155" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={({ active, payload }) => {
                  const row = active ? (payload?.[0]?.payload as SeminarBudgetRow | undefined) : undefined;
                  return row ? <SeminarTip row={row} /> : null;
                }}
              />
              <Bar dataKey="allocated" name="Allocated" fill={ALLOCATED_BLUE} radius={[0, 3, 3, 0]} maxBarSize={11} isAnimationActive={false} />
              <Bar dataKey="committed" name="Taken now" fill={NAVY} radius={[0, 3, 3, 0]} maxBarSize={11} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <details className="mt-2 text-[11px] text-slate-600">
        <summary className="cursor-pointer select-none text-[10px] font-semibold text-blue-700">Show the figures</summary>
        <div className="custom-scrollbar relative mt-2 max-h-80 overflow-auto">
          <table className="w-full min-w-[36rem] text-left">
            <caption className="sr-only">FY {fiscalYear} seminars: dates, allocated, taken now, spent, returned to Unallocated, and seats</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-[10px] text-slate-500">
                <th scope="col" className="py-1 pr-2 font-semibold">Seminar</th>
                <th scope="col" className="py-1 pr-2 font-semibold">Dates</th>
                <th scope="col" className="py-1 pl-2 text-right font-semibold">Allocated</th>
                <th scope="col" className="py-1 pl-2 text-right font-semibold">Taken now</th>
                <th scope="col" className="py-1 pl-2 text-right font-semibold">Spent</th>
                <th scope="col" className="py-1 pl-2 text-right font-semibold">Returned</th>
                <th scope="col" className="py-1 pl-2 text-right font-semibold">Seats</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-slate-50 align-top">
                  <th scope="row" className="py-1 pr-2 font-normal text-slate-700">
                    {r.title}
                    {r.archived && <span className="ml-1 rounded border border-slate-300 bg-slate-100 px-1 text-[9px] font-semibold text-slate-600">Archived</span>}
                  </th>
                  <td className="whitespace-nowrap py-1 pr-2">{dates(r)}</td>
                  <td className="py-1 pl-2 text-right font-mono tabular-nums">{formatCurrency(r.allocated)}</td>
                  <td className="py-1 pl-2 text-right font-mono tabular-nums">{formatCurrency(r.committed)}</td>
                  <td className="py-1 pl-2 text-right font-mono tabular-nums">{formatCurrency(r.spent)}</td>
                  <td className="py-1 pl-2 text-right font-mono tabular-nums">{formatCurrency(r.returned)}</td>
                  <td className="whitespace-nowrap py-1 pl-2 text-right tabular-nums">{r.filled} of {r.seats}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold text-slate-700">
                <th scope="row" className="py-1 pr-2">Total ({rows.length})</th>
                <td className="py-1 pr-2" />
                <td className="py-1 pl-2 text-right font-mono tabular-nums">{formatCurrency(sum(rows, r => r.allocated))}</td>
                <td className="py-1 pl-2 text-right font-mono tabular-nums">{formatCurrency(sum(rows, r => r.committed))}</td>
                <td className="py-1 pl-2 text-right font-mono tabular-nums">{formatCurrency(sum(rows, r => r.spent))}</td>
                <td className="py-1 pl-2 text-right font-mono tabular-nums">{formatCurrency(sum(rows, r => r.returned))}</td>
                <td className="whitespace-nowrap py-1 pl-2 text-right tabular-nums">{rows.reduce((s, r) => s + r.filled, 0)} of {rows.reduce((s, r) => s + r.seats, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    </div>
  );
}

/** The tooltip: the seminar, its dates, and every figure the chart is drawn from. */
function SeminarTip({ row }: { row: SeminarBudgetRow }) {
  const lines: [string, string][] = [
    ["Allocated", formatCurrency(row.allocated)],
    ["Taken now", formatCurrency(row.committed)],
    ["Spent", formatCurrency(row.spent)],
    ["Returned", formatCurrency(row.returned)],
    ["Seats", `${row.filled} of ${row.seats} filled`]
  ];
  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 shadow-lg">
      <p className="break-words font-semibold text-slate-800">{row.title}</p>
      <p className="text-[10px] text-slate-500">{dates(row)}{row.archived ? " · Archived" : ""}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        {lines.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-slate-500">{term}</dt>
            <dd className="text-right font-mono tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

