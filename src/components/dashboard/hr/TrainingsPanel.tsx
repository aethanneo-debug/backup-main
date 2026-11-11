import { GraduationCap, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HrDashboard } from "../../../types";
import { EmptyState } from "../LoadStates";
import type { ApiLoad } from "../useApiLoad";
import { ChartKey, HrPanel, ShowFigures, TD, TD_NUM, TH, TH_NUM, TipBox, WhenLoaded } from "./HrPanel";
import { ATTENDED_GREEN, BUCKET_LABEL, PENDING_AMBER, bucketPhrase, percentText, type TrainingsBucket } from "./hrFormat";

interface BucketRow {
  key: TrainingsBucket;
  label: string;
  employees: number;
  fill: string;
}

/**
 * How many of the staff attended 0, 1, 2, or 3 or more trainings in the year. The "0" bar is amber, as the attendance
 * ring's "Not yet": the same people, the ones the one-training-a-year rule (12s) still waits on.
 */
export default function TrainingsPanel({ load }: { load: ApiLoad<HrDashboard> }) {
  return (
    <HrPanel
      icon={<GraduationCap size={15} />}
      title="Trainings attended per employee"
      description={`How many trainings each of the staff attended${load.data ? ` in FY ${load.data.fiscalYear}` : " this fiscal year"}: seminars HR recorded “Attended”, and trainings HR recorded.`}
      busy={load.loading}
    >
      <WhenLoaded load={load} what="The trainings attended couldn't be loaded." skeleton="h-48">
        {d => d.headcount.total === 0 ? (
          <EmptyState icon={<Users size={18} />} title="No staff on record">Each employee&rsquo;s trainings will be counted here.</EmptyState>
        ) : (
          <BucketChart buckets={d.trainingsPerEmployee ?? []} total={d.attendance.total} fiscalYear={d.fiscalYear} />
        )}
      </WhenLoaded>
    </HrPanel>
  );
}

function BucketChart({ buckets, total, fiscalYear }: { buckets: HrDashboard["trainingsPerEmployee"]; total: number; fiscalYear: string }) {
  const rows: BucketRow[] = buckets.map(b => ({
    key: b.trainings,
    label: BUCKET_LABEL[b.trainings] ?? String(b.trainings),
    employees: b.employees,
    fill: b.trainings === "0" ? PENDING_AMBER : ATTENDED_GREEN
  }));
  const summary = rows.map(r => bucketPhrase(r.key, r.employees)).join("; ");
  return (
    <div data-chart="hr-trainings" className="min-w-0">
      <ChartKey items={[{ color: PENDING_AMBER, label: "No training attended yet" }, { color: ATTENDED_GREEN, label: "Attended at least one" }]} />
      <div className="custom-scrollbar max-sm:overflow-x-auto">
        <div className="h-48 max-sm:min-w-[14rem]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ top: 16, right: 8, bottom: 2, left: 0 }}
              barCategoryGap="28%"
              title={`FY ${fiscalYear}: trainings attended per employee`}
              desc={`${summary}. The table under the chart lists every figure.`}
            >
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" interval={0} tick={{ fontSize: 10, fill: "#334155" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={({ active, payload }) => {
                  const row = active ? (payload?.[0]?.payload as BucketRow | undefined) : undefined;
                  return row ? (
                    <TipBox>
                      <p className="font-semibold text-slate-800">{row.key === "0" ? "No training yet" : `${row.label} training${row.key === "1" ? "" : "s"}`}</p>
                      <p>{bucketPhrase(row.key, row.employees)}</p>
                      <p className="font-mono tabular-nums text-slate-500">{percentText(row.employees, total)} of the staff</p>
                    </TipBox>
                  ) : null;
                }}
              />
              <Bar dataKey="employees" name="Employees" radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                {rows.map(r => <Cell key={r.key} fill={r.fill} />)}
                <LabelList dataKey="employees" position="top" fontSize={10} fill="#334155" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="mt-1 text-center text-[10px] text-slate-500">Trainings attended in FY {fiscalYear}</p>

      <ShowFigures>
        <table className="w-full text-left">
          <caption className="sr-only">FY {fiscalYear}: how many of the staff attended 0, 1, 2, or 3 or more trainings</caption>
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200">
              <th scope="col" className={TH}>Trainings attended</th>
              <th scope="col" className={TH_NUM}>Employees</th>
              <th scope="col" className={TH_NUM}>Share of the staff</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className="border-b border-slate-50">
                <th scope="row" className={`${TD} font-normal text-slate-700`}>{r.key === "0" ? "0 (none yet)" : r.label}</th>
                <td className={TD_NUM}>{r.employees}</td>
                <td className={TD_NUM}>{percentText(r.employees, total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold text-slate-700">
              <th scope="row" className={TD}>Staff</th>
              <td className={TD_NUM}>{total}</td>
              <td className={TD_NUM}>{total > 0 ? "100%" : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </ShowFigures>
    </div>
  );
}
