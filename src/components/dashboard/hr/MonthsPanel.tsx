import { CalendarRange } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HrDashboard } from "../../../types";
import { EmptyState } from "../LoadStates";
import type { ApiLoad } from "../useApiLoad";
import { NAVY } from "../chartFormat";
import { HrPanel, ShowFigures, TD, TD_NUM, TH, TH_NUM, TipBox, TipFigures, WhenLoaded } from "./HrPanel";
import { monthLong, monthShort, monthTick, plural } from "./hrFormat";

type MonthRow = HrDashboard["attendeesByMonth"][number];

/** Pixels a month needs under the chart (its two-line label), below which the chart scrolls sideways in its box. */
const MONTH_WIDTH = 40;

/**
 * How many of the staff attended a training each month (by the month the training began), with how many trainings they
 * attended between them. The month the figures were drawn up in is still going, so it says "so far".
 */
export default function MonthsPanel({ load }: { load: ApiLoad<HrDashboard> }) {
  return (
    <HrPanel
      icon={<CalendarRange size={15} />}
      title="Attendees per month"
      description="How many of the staff attended a training each month, by the month the training began."
      busy={load.loading}
    >
      <WhenLoaded load={load} what="The attendees per month couldn't be loaded." skeleton="h-52">
        {d => (d.attendeesByMonth ?? []).length === 0 ? (
          <EmptyState icon={<CalendarRange size={18} />} title={`No training attended yet in FY ${d.fiscalYear}`}>
            The months fill in as HR records attendance at the year&rsquo;s seminars, or records trainings dated in it.
          </EmptyState>
        ) : (
          <MonthChart months={d.attendeesByMonth} fiscalYear={d.fiscalYear} current={d.asOf.slice(0, 7)} />
        )}
      </WhenLoaded>
    </HrPanel>
  );
}

function MonthChart({ months, fiscalYear, current }: { months: MonthRow[]; fiscalYear: string; current: string }) {
  const soFar = (m: string) => (m === current ? " (so far)" : "");
  const minWidth = Math.max(288, months.length * MONTH_WIDTH);
  return (
    <div data-chart="hr-months" className="min-w-0">
      {/* Many months scroll sideways inside this box; its tooltip is small enough not to be clipped. */}
      <div className="custom-scrollbar relative overflow-x-auto">
        <div className="h-52" style={{ minWidth }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={months}
              margin={{ top: 16, right: 8, bottom: 2, left: 0 }}
              barCategoryGap="24%"
              title={`FY ${fiscalYear}: attendees per month`}
              desc={`${months.map(m => `${monthLong(m.month)}${soFar(m.month)}: ${plural(m.employees, "employee")}`).join("; ")}. The table under the chart lists every figure.`}
            >
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" interval={0} height={32} tick={<MonthTickLabel current={current} />} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={({ active, payload }) => {
                  const row = active ? (payload?.[0]?.payload as MonthRow | undefined) : undefined;
                  return row ? (
                    <TipBox>
                      <p className="font-semibold text-slate-800">{monthShort(row.month)}{soFar(row.month)}</p>
                      <TipFigures lines={[["Employees who attended", row.employees], ["Trainings attended", row.trainings]]} />
                    </TipBox>
                  ) : null;
                }}
              />
              <Bar dataKey="employees" name="Employees who attended" fill={NAVY} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                <LabelList dataKey="employees" position="top" fontSize={9} fill="#334155" formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ShowFigures>
        <table className="w-full text-left">
          <caption className="sr-only">FY {fiscalYear}: employees who attended a training, and trainings attended, each month</caption>
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200">
              <th scope="col" className={TH}>Month</th>
              <th scope="col" className={TH_NUM}>Employees who attended</th>
              <th scope="col" className={TH_NUM}>Trainings attended</th>
            </tr>
          </thead>
          <tbody>
            {months.map(m => (
              <tr key={m.month} className="border-b border-slate-50">
                <th scope="row" className={`${TD} font-normal text-slate-700`}>{monthShort(m.month)}{soFar(m.month)}</th>
                <td className={TD_NUM}>{m.employees}</td>
                <td className={TD_NUM}>{m.trainings}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
          Trainings attended counts each employee&rsquo;s training once: a seminar three of them attended counts three times.
        </p>
      </ShowFigures>
    </div>
  );
}

/**
 * A month under the chart, "Oct 2026", drawn as "Oct" over "2026" so a year of months fits (Recharts passes the tick's
 * place and value). The space starting the second line keeps its text "Oct 2026" for whatever reads it; SVG drops it
 * when drawing.
 */
function MonthTickLabel({ x, y, payload, current }: { x?: number; y?: number; payload?: { value?: unknown }; current: string }) {
  const value = String(payload?.value ?? "");
  const [month, year] = monthTick(value);
  const now = value === current;
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={10} fill={now ? "#001d85" : "#334155"} fontWeight={now ? 700 : 400}>
      <tspan x={x} dy={10}>{month}</tspan>
      {year && <tspan x={x} dy={11} fill="#64748b">{` ${year}`}</tspan>}
    </text>
  );
}
