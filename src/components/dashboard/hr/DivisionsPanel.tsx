import { Building2, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NO_DIVISION, NO_STATUS } from "../../../hrDashboard";
import type { HrCount, HrDashboard } from "../../../types";
import { EmptyState, PanelLink } from "../LoadStates";
import type { ApiLoad } from "../useApiLoad";
import { NAVY, percentOf } from "../chartFormat";
import { HrPanel, ShowFigures, TD, TD_NUM, TH, TH_NUM, TipBox, WhenLoaded } from "./HrPanel";
import { percentText, plural, shortText } from "./hrFormat";

/** Pixels a division takes on the chart (room for its name on two lines: Recharts wraps it), and the axis under them. */
const ROW = 36;
const AXIS = 30;
/** About two lines of the axis: a longer name is cut, and shows whole in the tooltip and the table. */
const NAME_MAX = 56;

/** Headcount by division (a bar each), and by employment status (a short list): the staff still with the office. */
export default function DivisionsPanel({ load, onOpenPds }: { load: ApiLoad<HrDashboard>; onOpenPds: () => void }) {
  return (
    <HrPanel
      icon={<Building2 size={15} />}
      title="Headcount by division"
      description="The staff still with the office today, whatever year is chosen, by division and by employment status."
      busy={load.loading}
    >
      <WhenLoaded load={load} what="The headcount couldn't be loaded." skeleton="h-56">
        {d => d.headcount.total === 0 ? (
          <EmptyState icon={<Users size={18} />} title="No staff on record" action={<PanelLink onClick={onOpenPds}>Open the Personal Data Sheet</PanelLink>}>
            Staff still with the office will show here once their records are kept.
          </EmptyState>
        ) : (
          <DivisionChart headcount={d.headcount} />
        )}
      </WhenLoaded>
    </HrPanel>
  );
}

function DivisionChart({ headcount }: { headcount: HrDashboard["headcount"] }) {
  const rows = headcount.byDivision ?? [];
  const total = headcount.total;
  const height = rows.length * ROW + AXIS;
  return (
    <div data-chart="hr-divisions" className="min-w-0">
      {/* On a phone the chart keeps 18rem and scrolls sideways inside this box; wider, nothing clips its tooltip. */}
      <div className="custom-scrollbar max-sm:overflow-x-auto">
        <div className="max-sm:min-w-[18rem]" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 2, right: 28, bottom: 2, left: 2 }}
              barCategoryGap="22%"
              title="Staff by division"
              desc={`Staff still with the office in each division, ${plural(total, "staff member")} in all. The table under the chart lists every figure.`}
            >
              <CartesianGrid horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                interval={0}
                tickFormatter={(name: string) => shortText(name, NAME_MAX)}
                tick={{ fontSize: 10, fill: "#334155" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={({ active, payload }) => {
                  const row = active ? (payload?.[0]?.payload as HrCount | undefined) : undefined;
                  return row ? (
                    <TipBox>
                      <p className="break-words font-semibold text-slate-800">{row.name}</p>
                      <p className="font-mono tabular-nums">{plural(row.count, "staff member")} · {percentText(row.count, total)} of the staff</p>
                    </TipBox>
                  ) : null;
                }}
              />
              <Bar dataKey="count" name="Staff" fill={NAVY} radius={[0, 3, 3, 0]} maxBarSize={14} isAnimationActive={false}>
                <LabelList dataKey="count" position="right" fontSize={10} fill="#334155" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <StatusSplit rows={headcount.byStatus ?? []} total={total} />

      <ShowFigures>
        <table className="w-full text-left">
          <caption className="sr-only">Staff still with the office, by division</caption>
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200">
              <th scope="col" className={TH}>Division</th>
              <th scope="col" className={TH_NUM}>Staff</th>
              <th scope="col" className={TH_NUM}>Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name} className="border-b border-slate-50">
                <th scope="row" className={`${TD} font-normal ${r.name === NO_DIVISION ? "italic text-slate-500" : "text-slate-700"}`}>{r.name}</th>
                <td className={TD_NUM}>{r.count}</td>
                <td className={TD_NUM}>{percentText(r.count, total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold text-slate-700">
              <th scope="row" className={TD}>Total</th>
              <td className={TD_NUM}>{total}</td>
              <td className={TD_NUM}>{total > 0 ? "100%" : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </ShowFigures>
    </div>
  );
}

/** The staff by employment status, as a list whose every figure shows (no chart to hover). */
function StatusSplit({ rows, total }: { rows: HrCount[]; total: number }) {
  return (
    <div data-hr-status className="mt-3 border-t border-slate-100 pt-3">
      <h4 className="text-[11px] font-semibold text-slate-700">By employment status</h4>
      <ul className="mt-1.5 space-y-1.5">
        {rows.map(r => (
          <li key={r.name} className="text-[11px]">
            <span className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className={`min-w-0 break-words ${r.name === NO_STATUS ? "italic text-slate-500" : "text-slate-700"}`}>{r.name}</span>
              <span className="font-mono tabular-nums text-slate-800">
                {r.count} <span className="text-slate-500">({percentText(r.count, total)})</span>
              </span>
            </span>
            <span aria-hidden="true" className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full" style={{ width: `${percentOf(r.count, total) ?? 0}%`, backgroundColor: NAVY }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
