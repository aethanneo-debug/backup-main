import { useId, type Ref } from "react";
import { CircleCheck, ClipboardList, Eye, TriangleAlert, UserX, Users } from "lucide-react";
import type { HrDashboard, HrFollowUpRow, NotificationLink } from "../../../types";
import { EmptyState } from "../LoadStates";
import type { ApiLoad } from "../useApiLoad";
import { Badge, OPEN_BUTTON, WhenLoaded } from "./HrPanel";
import { STAGE_TONE, dayText, dueNote, nextStep, stageLabel } from "./hrFormat";
import NoClaimList from "./NoClaimList";

interface FollowUpPanelProps {
  load: ApiLoad<HrDashboard>;
  onOpenLink: (link: NotificationLink) => void;
  /** The heading, which "See who" on the cards brings into view and focuses. */
  headingRef?: Ref<HTMLHeadingElement>;
}

const HEAD = "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500";
// Each cell paints its own background: the pinned last column has to cover what scrolls under it, which a row's colour
// (or a see-through tint) can't. Overdue rows are tinted rose, opaque for the same reason.
const CELL = "border-b border-slate-100 px-2 py-2.5 align-top";
const PINNED = "sticky right-0 border-l border-l-slate-200";

/**
 * The seats whose money isn't settled (12ag Part B), from every fiscal year (cash doesn't wait for the year), the most
 * pressing first as the server orders them: overdue, then the soonest due. Each row opens its report in Request
 * Management, or, with no report filed, the seat in the seminar's attendance list. Anyone who has left the office is
 * still listed, flagged: their money is still out.
 */
export default function FollowUpPanel({ load, onOpenLink, headingRef }: FollowUpPanelProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} aria-busy={load.loading} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4">
      <h3
        id={titleId}
        ref={headingRef}
        tabIndex={-1}
        className="flex items-center rounded text-xs font-bold uppercase tracking-tight text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <ClipboardList size={15} className="mr-1.5 shrink-0 text-blue-600" aria-hidden="true" />
        Not yet liquidated or reimbursed
      </h3>
      <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
        Seats whose cash advance or claim is still open, from every fiscal year (cash doesn&rsquo;t wait for the year), the most pressing first.
        A seat is overdue when, 30 days after the seminar, its report is still to be filed or corrected, its attendance still to be recorded, or its cash advance still to be handed back.
        A reimbursement claim is never overdue: the office owes the employee.
      </p>
      <div className="mt-3">
        <WhenLoaded load={load} what="The follow-up list couldn't be loaded." skeleton="h-40">
          {d => (
            <>
              <FollowUpTable rows={d.followUp.rows ?? []} asOf={d.asOf} onOpenLink={onOpenLink} />
              <NoClaimList rows={d.followUp.noClaim ?? []} fiscalYear={d.fiscalYear} onOpenLink={onOpenLink} />
            </>
          )}
        </WhenLoaded>
      </div>
    </section>
  );
}

function FollowUpTable({ rows, asOf, onOpenLink }: {
  rows: HrFollowUpRow[];
  asOf: string;
  onOpenLink: (link: NotificationLink) => void;
}) {
  if (rows.length === 0) {
    return (
      <div data-followup>
        <EmptyState icon={<CircleCheck size={18} />} title="Every seat is settled">
          No seminar of any fiscal year has a cash advance or a claim still open.
        </EmptyState>
      </div>
    );
  }
  const caption = "Not yet liquidated or reimbursed, every fiscal year, the most pressing first";
  return (
    // Its own height, so the header stays in view down a long list; narrower than the table, it scrolls sideways here.
    <div data-followup role="region" aria-label={caption} tabIndex={0} className="custom-scrollbar relative max-h-[70vh] overflow-auto rounded-lg border border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
      <table className="w-full min-w-[50rem] border-separate border-spacing-0 text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={HEAD}>Employee</th>
            <th scope="col" className={HEAD}>Seminar</th>
            <th scope="col" className={HEAD}>FY</th>
            <th scope="col" className={HEAD}>Stage</th>
            <th scope="col" className={HEAD}>Report due</th>
            <th scope="col" className={HEAD}>Report No.</th>
            <th scope="col" className={`${HEAD} ${PINNED} z-20 text-right`}><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => <FollowUpRowView key={r.participantId} row={r} asOf={asOf} onOpenLink={onOpenLink} />)}
        </tbody>
      </table>
    </div>
  );
}

function FollowUpRowView({ row, asOf, onOpenLink }: { row: HrFollowUpRow; asOf: string; onOpenLink: (link: NotificationLink) => void }) {
  const note = dueNote(row, asOf);
  const open = () => onOpenLink(row.reportId
    ? { tab: "requests", record: { kind: "liquidationReport", id: row.reportId } }
    : { tab: "training_development", record: { kind: "attendance", id: row.participantId } });
  const cell = `${CELL} ${row.overdue ? "bg-rose-50" : "bg-white"}`;
  return (
    <tr data-followup-row={row.participantId} data-stage={row.stage} data-overdue={row.overdue ? "true" : "false"}>
      <td className={cell}>
        <span className="block break-words font-semibold text-slate-800">{row.employee}</span>
        {(!row.withOffice || row.group) && (
          <span className="mt-1 flex flex-wrap gap-1">
            {!row.withOffice && (
              <Badge tone="amber"><UserX size={10} className="shrink-0" aria-hidden="true" /><span data-followup-flag="left">No longer with the office</span></Badge>
            )}
            {row.group && (
              <Badge tone="slate"><Users size={10} className="shrink-0" aria-hidden="true" /><span data-followup-flag="group">Group advance</span></Badge>
            )}
          </span>
        )}
      </td>
      <td className={cell}>
        <span className="block break-words text-slate-700">{row.seminarTitle}</span>
        <span className="block text-[10px] text-slate-500">Ended {dayText(row.endDate)}</span>
      </td>
      <td className={`${cell} whitespace-nowrap text-slate-700`} data-followup-fy>{row.fiscalYear ? `FY ${row.fiscalYear}` : "—"}</td>
      <td className={cell}>
        <Badge tone={STAGE_TONE[row.stage] ?? "slate"}>{stageLabel(row)}</Badge>
        <span className="mt-1 block text-[10px] leading-snug text-slate-500">Next: {nextStep(row)}</span>
      </td>
      <td className={cell}>
        <span className="block whitespace-nowrap text-slate-700">{dayText(row.dueDate)}</span>
        {row.overdue && (
          <Badge tone="rose" className="mt-1"><TriangleAlert size={10} className="shrink-0" aria-hidden="true" />Overdue</Badge>
        )}
        {note && <span className={`mt-0.5 block text-[10px] ${row.overdue ? "font-semibold text-rose-700" : "text-slate-500"}`}>{note}</span>}
      </td>
      <td className={cell}>
        {row.reportNo
          // A report number is one code: it never breaks (the table scrolls sideways instead).
          ? <span className="whitespace-nowrap font-mono text-[11px] text-slate-700">{row.reportNo}</span>
          : row.reportId ? <span className="text-slate-600">Filed, no number</span> : <span className="text-slate-500">Not filed yet</span>}
      </td>
      <td className={`${cell} ${PINNED} z-[1] text-right`}>
        <button type="button" data-followup-open onClick={open} className={OPEN_BUTTON}>
          <Eye size={12} aria-hidden="true" />
          {row.reportId ? "View report" : "View attendance"}
          <span className="sr-only"> of {row.employee}, {row.seminarTitle}</span>
        </button>
      </td>
    </tr>
  );
}
