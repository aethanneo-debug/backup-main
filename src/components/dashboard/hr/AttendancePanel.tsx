import { PieChart as PieIcon, Users } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { HrDashboard } from "../../../types";
import { EmptyState } from "../LoadStates";
import type { ApiLoad } from "../useApiLoad";
import { percentOf } from "../chartFormat";
import { dateRange } from "../schedule";
import { HrPanel, ShowFigures, TD, TD_NUM, TH, TH_NUM, TipBox, WhenLoaded } from "./HrPanel";
import { ATTENDED_GREEN, PENDING_AMBER, percentText, plural, recordsPhrase, seminarsAttended } from "./hrFormat";

type Attendance = HrDashboard["attendance"];

/** How many trainings the attended slice's tooltip names before "and N more". */
const TIP_SEMINARS = 10;

/**
 * Of the staff, who attended a training in the year (emerald) and who hasn't yet (amber). Hovering the attended part
 * lists the year's seminars they attended and how many attended each, and how many trainings HR recorded (the
 * instructor's ask, 2026-11-11). The ring has no keyboard layer; the legend and "Show the figures" carry the same.
 */
export default function AttendancePanel({ load }: { load: ApiLoad<HrDashboard> }) {
  return (
    <HrPanel
      icon={<PieIcon size={15} />}
      title="Attendance"
      description="Of the staff still with the office, who attended a training in the year and who hasn't yet."
      busy={load.loading}
    >
      <WhenLoaded load={load} what="The attendance couldn't be loaded." skeleton="h-44">
        {d => d.attendance.total === 0 ? (
          <EmptyState icon={<Users size={18} />} title="No staff on record">Who attended a training will show here.</EmptyState>
        ) : (
          <AttendanceRing attendance={d.attendance} fiscalYear={d.fiscalYear} />
        )}
      </WhenLoaded>
    </HrPanel>
  );
}

function AttendanceRing({ attendance, fiscalYear }: { attendance: Attendance; fiscalYear: string }) {
  const { attended, total, recordsCounted } = attendance;
  const notYet = Math.max(0, total - attended);
  const slices = [
    { key: "attended", name: "Attended a training", value: attended, fill: ATTENDED_GREEN },
    { key: "notYet", name: "Not yet", value: notYet, fill: PENDING_AMBER }
  ];
  const drawn = slices.filter(s => s.value > 0);
  const pct = percentOf(attended, total);
  const list = seminarsAttended(attendance.seminars, TIP_SEMINARS);
  const all = seminarsAttended(attendance.seminars, Number.MAX_SAFE_INTEGER).shown;
  const summary = `${pct === null ? "" : `${pct}% attended. `}Attended a training: ${attended} of ${total} staff; not yet: ${notYet}. ${recordsPhrase(recordsCounted)}.`;

  return (
    <div data-chart="hr-attendance" className="min-w-0">
      <div className="flex flex-wrap items-center gap-4">
        {/* At most 10rem square, smaller when the card is narrower (a phone beside the sidebar). */}
        <div className="relative aspect-square w-40 max-w-full shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            {/* No keyboard layer: Recharts 3 would make the ring a Tab stop that moves nothing (a pie's tooltip is per
                slice); the legend beside it and "Show the figures" carry every figure. */}
            <PieChart title={`FY ${fiscalYear}: staff who attended a training`} desc={summary} accessibilityLayer={false}>
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
                // The list can be taller and wider than the ring: it may go past the ring's box (nothing around clips it).
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 30 }}
                content={({ active, payload }) => {
                  const slice = active ? payload?.[0] : undefined;
                  if (!slice) return null;
                  const key = (slice.payload as { key?: string } | undefined)?.key;
                  return key === "attended"
                    ? <AttendedTip attended={attended} total={total} list={list} recordsCounted={recordsCounted} fiscalYear={fiscalYear} />
                    : (
                      <TipBox className="w-56">
                        <p className="font-semibold text-slate-800">Not yet: {notYet} of {total} staff</p>
                        <p>No training attended yet in FY {fiscalYear} ({percentText(notYet, total)}).</p>
                      </TipBox>
                    );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* The share that attended, in the hole (the chart's own title and description carry it for screen readers). */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-lg font-bold leading-none tabular-nums text-slate-800">{pct === null ? "—" : `${pct}%`}</span>
            <span className="mt-0.5 text-[10px] text-slate-500">attended</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2 text-[11px]">
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: ATTENDED_GREEN }} />
            <span className="min-w-0 flex-1 break-words">
              <span className="block font-semibold text-slate-700">Attended a training</span>
              <span className="block font-mono tabular-nums text-slate-800">{attended} of {total} staff ({percentText(attended, total)})</span>
              <span className="block text-[10px] text-slate-500">
                {plural(all.length, "seminar")} attended · {recordsPhrase(recordsCounted)}
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: PENDING_AMBER }} />
            <span className="min-w-0 flex-1 break-words">
              <span className="block font-semibold text-slate-700">Not yet</span>
              <span className="block font-mono tabular-nums text-slate-800">{notYet} staff ({percentText(notYet, total)})</span>
              <span className="block text-[10px] text-slate-500">No training attended yet this fiscal year</span>
            </span>
          </li>
        </ul>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-slate-500">
        Point at the green part to see which trainings they attended; the same list is under &ldquo;Show the figures&rdquo;.
      </p>

      <ShowFigures>
        <table className="w-full text-left">
          <caption className="sr-only">FY {fiscalYear}: staff who attended a training, and who hasn&rsquo;t yet</caption>
          <thead>
            <tr className="border-b border-slate-200">
              <td className={TH} />
              <th scope="col" className={TH_NUM}>Staff</th>
              <th scope="col" className={TH_NUM}>Share</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <th scope="row" className={`${TD} font-normal`}>Attended a training</th>
              <td className={TD_NUM}>{attended}</td>
              <td className={TD_NUM}>{percentText(attended, total)}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <th scope="row" className={`${TD} font-normal`}>Not yet</th>
              <td className={TD_NUM}>{notYet}</td>
              <td className={TD_NUM}>{percentText(notYet, total)}</td>
            </tr>
            <tr>
              <th scope="row" className={`${TD} font-semibold`}>Staff</th>
              <td className={`${TD_NUM} font-semibold`}>{total}</td>
              <td className={TD_NUM} />
            </tr>
          </tbody>
        </table>
        <table data-hr-attended-trainings className="mt-3 w-full text-left">
          <caption className="mb-1 text-left text-[10px] font-semibold text-slate-600">
            The trainings they attended, the most attended first
          </caption>
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200">
              <th scope="col" className={TH}>Seminar</th>
              <th scope="col" className={TH}>Dates</th>
              <th scope="col" className={TH_NUM}>Attended</th>
            </tr>
          </thead>
          <tbody>
            {all.length === 0 ? (
              <tr><td colSpan={3} className={`${TD} italic text-slate-500`}>No seminar of FY {fiscalYear} has an attendee recorded yet.</td></tr>
            ) : all.map(s => (
              <tr key={s.id} className="border-b border-slate-50">
                <th scope="row" className={`${TD} font-normal text-slate-700`}>{s.title}</th>
                <td className={`${TD} whitespace-nowrap`}>{dateRange(s.startDate, s.endDate)}</td>
                <td className={TD_NUM}>{s.attended}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 text-slate-700">
              <th scope="row" colSpan={2} className={`${TD} font-semibold`}>{recordsPhrase(recordsCounted)}</th>
              <td className={TD_NUM}>{recordsCounted}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
          A seminar&rsquo;s count is everyone HR recorded &ldquo;Attended&rdquo; on it, anyone who has since left the office included.
        </p>
      </ShowFigures>
    </div>
  );
}

/** The attended slice's tooltip: the seminars they attended, how many attended each, and HR's own records. */
function AttendedTip({ attended, total, list, recordsCounted, fiscalYear }: {
  attended: number;
  total: number;
  list: ReturnType<typeof seminarsAttended>;
  recordsCounted: number;
  fiscalYear: string;
}) {
  return (
    <TipBox className="w-64">
      <p className="font-semibold text-slate-800">Attended a training: {attended} of {total} staff</p>
      {list.shown.length > 0 ? (
        <>
          <p className="mt-1.5 flex justify-between gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Trainings attended</span><span>Attended</span>
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {list.shown.map(s => (
              <li key={s.id} className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words">{s.title}</span>
                <span className="shrink-0 font-mono tabular-nums">{s.attended}</span>
              </li>
            ))}
          </ul>
          {list.more > 0 && <p className="mt-0.5 text-[10px] text-slate-500">and {plural(list.more, "more training")}</p>}
        </>
      ) : (
        <p className="mt-1 text-[10px] text-slate-500">No seminar of FY {fiscalYear} has an attendee recorded yet.</p>
      )}
      <p className="mt-1.5 border-t border-slate-100 pt-1 text-[10px] text-slate-600">{recordsPhrase(recordsCounted)}</p>
    </TipBox>
  );
}
