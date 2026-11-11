import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "../../../utils";
import { TipBox, TipFigures } from "../../dashboard/hr/HrPanel";
import { axisStep, countWords, shareText, type FigureLine } from "./statusRows";

/** Pixels a status takes on the chart, and the axis under them. */
const ROW = 26;
const AXIS = 24;

interface BarRow {
  key: string;
  short: string;
  count: number;
  line: FigureLine;
}

/**
 * One bar per status, by count, each in its status's colour, with the count at its end (the cash advances and the
 * reimbursement claims). Every figure, the amounts too, is in the tooltip, the list beside it and "Show the figures".
 */
export default function StatusBars({ chartId, parts, title }: {
  /** data-chart: "fin-advances", "fin-reimbursements". */
  chartId: string;
  parts: FigureLine[];
  /** The chart's title, with the range: "Cash advances requested, Nov 1–30, 2026". */
  title: string;
}) {
  const rows: BarRow[] = parts.map(p => ({ key: p.key, short: p.short, count: p.tally.count, line: p }));
  const whole = rows.reduce((n, r) => n + r.count, 0);
  const step = axisStep(Math.max(0, ...rows.map(r => r.count)));
  const ticks = [0, step, 2 * step, 3 * step, 4 * step];
  const summary = rows.map(r => `${r.line.label}: ${countWords(r.count, r.line.unit)}, ${formatCurrency(r.line.tally.amount)}`).join("; ");
  return (
    <div data-chart={chartId} className="min-w-0">
      {/* On a phone the chart keeps 15rem and scrolls sideways inside this box; wider, nothing clips its tooltip. */}
      <div className="custom-scrollbar max-sm:overflow-x-auto">
        <div className="max-sm:min-w-[15rem]" style={{ height: rows.length * ROW + AXIS }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 2, right: 28, bottom: 2, left: 2 }}
              barCategoryGap="24%"
              title={title}
              desc={`${summary}. The list beside the chart gives every figure.`}
            >
              <CartesianGrid horizontal={false} stroke="#e2e8f0" />
              <XAxis
                type="number"
                allowDecimals={false}
                domain={[0, 4 * step]}
                ticks={ticks}
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
              />
              <YAxis type="category" dataKey="short" width={92} interval={0} tick={{ fontSize: 10, fill: "#334155" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={({ active, payload }) => {
                  const row = active ? (payload?.[0]?.payload as BarRow | undefined) : undefined;
                  if (!row) return null;
                  return (
                    <TipBox className="w-56">
                      <p className="font-semibold text-slate-800">{row.line.label}</p>
                      {row.line.hint && <p className="text-[10px] text-slate-500">{row.line.hint}</p>}
                      <TipFigures lines={[["Count", countWords(row.count, row.line.unit)], ["Amount", formatCurrency(row.line.tally.amount)], ["Share", shareText(row.count, whole)]]} />
                    </TipBox>
                  );
                }}
              />
              <Bar dataKey="count" name="Count" radius={[0, 3, 3, 0]} maxBarSize={14} isAnimationActive={false}>
                {rows.map(r => <Cell key={r.key} fill={r.line.color} />)}
                <LabelList dataKey="count" position="right" fontSize={10} fill="#334155" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
