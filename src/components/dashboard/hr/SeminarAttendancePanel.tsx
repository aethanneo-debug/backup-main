import { ArrowRight, ChartBar, ListChecks } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HrDashboard, HrSeminarAttendance } from "../../../types";
import { EmptyState, PanelLink } from "../LoadStates";
import type { ApiLoad } from "../useApiLoad";
import { dateRange } from "../schedule";
import { ChartKey, HrPanel, ShowFigures, TD, TD_NUM, TH, TH_NUM, TipBox, TipFigures, WhenLoaded } from "./HrPanel";
import { ABSENT_ROSE, ATTENDED_GREEN, PENDING_AMBER, namesPreview, plural, seatedOn, shortText } from "./hrFormat";

/** Pixels a seminar takes on the chart (room for its title on two lines: Recharts wraps it), the axis under them,
 * and the shortest chart. */
const ROW = 36;
const AXIS = 30;
const MIN_HEIGHT = 140;
/** About two lines of the axis: a longer title is cut, and shows whole in the tooltip and the table. */
const TITLE_MAX = 56;
/** How many names a tooltip gives before "and N more". */
const TIP_NAMES = 12;

const KEY = [
  { color: ATTENDED_GREEN, label: "Attended" },
  { color: ABSENT_ROSE, label: "Did not attend" },
  { color: PENDING_AMBER, label: "Still to record" }
];

/**
 * Each of the year's seminars that has started, earliest first: everyone seated on it, split into attended, did not
 * attend and attendance still to record (as HR's attendance list records them). The tooltip names who attended.
 */
export default function SeminarAttendancePanel({ load, onOpenPrograms, className = "" }: {
  load: ApiLoad<HrDashboard>;
  /** Programs & Budget, offered when the active year has no seminar started yet (it lists only that year's). */
  onOpenPrograms?: () => void;
  className?: string;
}) {
  return (
    <HrPanel
      icon={<ChartBar size={15} />}
      title="Attendance by training"
      description="Each seminar of the year that has started: who attended, who did not, and whose attendance HR still has to record."
      busy={load.loading}
      className={className}
    >
      <WhenLoaded load={load} what="The attendance by training couldn't be loaded." skeleton="h-48">
        {d => (d.attendance.seminars ?? []).length === 0 ? (
          <EmptyState
            icon={<ListChecks size={18} />}
            title={`No seminar of FY ${d.fiscalYear} has started yet`}
            action={onOpenPrograms ? <PanelLink onClick={onOpenPrograms}>Programs &amp; Budget <ArrowRight size={11} aria-hidden="true" /></PanelLink> : undefined}
          >
            Each seminar shows here from its first day, with everyone seated on it.
          </EmptyState>
        ) : (
          <SeminarChart seminars={d.attendance.seminars} fiscalYear={d.fiscalYear} />
        )}
      </WhenLoaded>
    </HrPanel>
  );
}

function SeminarChart({ seminars, fiscalYear }: { seminars: HrSeminarAttendance[]; fiscalYear: string }) {
  const byId = new Map(seminars.map(s => [s.id, s]));
  const height = Math.max(MIN_HEIGHT, seminars.length * ROW + AXIS);
  const totals = seminars.reduce(
    (t, s) => ({ attended: t.attended + s.attended, didNotAttend: t.didNotAttend + s.didNotAttend, toRecord: t.toRecord + s.toRecord }),
    { attended: 0, didNotAttend: 0, toRecord: 0 }
  );
  return (
    <div data-chart="hr-by-seminar" className="min-w-0">
      <ChartKey items={KEY} />
      {/* No height cap here: a box that scrolls would clip the tooltip's names. On a phone the chart keeps 20rem and
          scrolls sideways inside this box. */}
      <div className="custom-scrollbar max-sm:overflow-x-auto">
        <div className="max-sm:min-w-[20rem]" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={seminars}
              layout="vertical"
              margin={{ top: 2, right: 12, bottom: 2, left: 2 }}
              barCategoryGap="26%"
              title={`FY ${fiscalYear}: attendance by seminar`}
              desc={`${plural(seminars.length, "seminar")}: ${totals.attended} attended, ${totals.didNotAttend} did not attend, ${totals.toRecord} still to record. The table under the chart lists every figure and who attended.`}
            >
              <CartesianGrid horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="id"
                width={170}
                interval={0}
                tickFormatter={(id: string) => shortText(byId.get(id)?.title ?? "", TITLE_MAX)}
                tick={{ fontSize: 10, fill: "#334155" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                // Its names can be taller than a short chart: below it is the page, which doesn't clip it.
                allowEscapeViewBox={{ x: false, y: true }}
                wrapperStyle={{ zIndex: 30 }}
                content={({ active, payload }) => {
                  const row = active ? (payload?.[0]?.payload as HrSeminarAttendance | undefined) : undefined;
                  return row ? <SeminarTip seminar={row} /> : null;
                }}
              />
              {/* White edges keep the three parts apart where they meet. */}
              <Bar dataKey="attended" stackId="seats" name="Attended" fill={ATTENDED_GREEN} stroke="#ffffff" strokeWidth={1} maxBarSize={14} isAnimationActive={false} />
              <Bar dataKey="didNotAttend" stackId="seats" name="Did not attend" fill={ABSENT_ROSE} stroke="#ffffff" strokeWidth={1} maxBarSize={14} isAnimationActive={false} />
              <Bar dataKey="toRecord" stackId="seats" name="Still to record" fill={PENDING_AMBER} stroke="#ffffff" strokeWidth={1} maxBarSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ShowFigures>
        <table className="w-full min-w-[44rem] text-left">
          <caption className="sr-only">FY {fiscalYear}: each seminar that has started, its attendance, and who attended</caption>
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200">
              <th scope="col" className={TH}>Seminar</th>
              <th scope="col" className={TH}>Dates</th>
              <th scope="col" className={TH_NUM}>Attended</th>
              <th scope="col" className={TH_NUM}>Did not attend</th>
              <th scope="col" className={TH_NUM}>Still to record</th>
              <th scope="col" className={TH_NUM}>Seated</th>
              <th scope="col" className={`${TH} pl-3`}>Who attended</th>
            </tr>
          </thead>
          <tbody>
            {seminars.map(s => (
              <tr key={s.id} className="border-b border-slate-50">
                <th scope="row" className={`${TD} font-normal text-slate-700`}>{s.title}</th>
                <td className={`${TD} whitespace-nowrap`}>{dateRange(s.startDate, s.endDate)}</td>
                <td className={TD_NUM}>{s.attended}</td>
                <td className={TD_NUM}>{s.didNotAttend}</td>
                <td className={TD_NUM}>{s.toRecord}</td>
                <td className={TD_NUM}>{seatedOn(s)}</td>
                <td className={`${TD} pl-3 text-slate-600`}>{(s.attendees ?? []).length > 0 ? s.attendees.join(", ") : <span className="italic text-slate-500">Nobody yet</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold text-slate-700">
              <th scope="row" className={TD}>Total ({seminars.length})</th>
              <td className={TD} />
              <td className={TD_NUM}>{totals.attended}</td>
              <td className={TD_NUM}>{totals.didNotAttend}</td>
              <td className={TD_NUM}>{totals.toRecord}</td>
              <td className={TD_NUM}>{totals.attended + totals.didNotAttend + totals.toRecord}</td>
              <td className={TD} />
            </tr>
          </tfoot>
        </table>
      </ShowFigures>
    </div>
  );
}

/** The tooltip: the seminar, its dates, its counts, and about a dozen of the names of who attended. */
function SeminarTip({ seminar }: { seminar: HrSeminarAttendance }) {
  const names = namesPreview(seminar.attendees, TIP_NAMES);
  return (
    <TipBox>
      <p className="break-words font-semibold text-slate-800">{seminar.title}</p>
      <p className="text-[10px] text-slate-500">{dateRange(seminar.startDate, seminar.endDate)}</p>
      <TipFigures lines={[
        ["Attended", seminar.attended],
        ["Did not attend", seminar.didNotAttend],
        ["Still to record", seminar.toRecord],
        ["Seated", seatedOn(seminar)]
      ]} />
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Who attended</p>
      {names.shown.length > 0 ? (
        <>
          <ul className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
            {names.shown.map((n, i) => <li key={`${i}-${n}`} className="min-w-0 break-words">{n}</li>)}
          </ul>
          {names.more > 0 && <p className="mt-0.5 text-[10px] text-slate-500">and {names.more} more</p>}
        </>
      ) : (
        <p className="text-[10px] italic text-slate-500">Nobody recorded as attending yet</p>
      )}
    </TipBox>
  );
}
