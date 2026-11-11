import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, GraduationCap, Users, Wallet } from "lucide-react";
import type { HrDashboard } from "../../../types";
import { LoadFailed, PanelLink } from "../LoadStates";
import type { ApiLoad } from "../useApiLoad";
import { dayText, percentText, plural } from "./hrFormat";

interface HrCardsProps {
  load: ApiLoad<HrDashboard>;
  /** The Personal Data Sheet, where staff records are kept. */
  onOpenPds: () => void;
  /** Brings the follow-up list into view. */
  onShowFollowUp: () => void;
}

/**
 * HR's three figures at a glance (12ag Part B): the staff, who attended a training in the year, and the attendees whose
 * money isn't settled. "…" while loading, "—" when it couldn't be loaded, never a zero that isn't known. A failed load
 * is announced here, once; the panels below show it quietly.
 */
export default function HrCards({ load, onOpenPds, onShowFollowUp }: HrCardsProps) {
  const d = load.loading || load.failed ? undefined : load.data;
  const pending = load.loading ? "Loading…" : !d ? "Couldn't be loaded" : null;
  const value = (ready: (data: HrDashboard) => string) => (load.loading ? "…" : !d ? "—" : ready(d));
  const rows = d?.followUp.rows ?? [];
  const overdue = rows.filter(r => r.overdue).length;
  const noClaim = d?.followUp.noClaim.length ?? 0;

  return (
    <section aria-label="At a glance" className="space-y-3">
      {load.failed && <LoadFailed what="HR's dashboard couldn't be loaded." message={load.message} onRetry={load.retry} />}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card
          name="staff"
          icon={<Users size={14} />}
          label="Staff"
          value={value(x => String(x.headcount.total))}
          action={<PanelLink onClick={onOpenPds}>Personal Data Sheet <ArrowRight size={11} aria-hidden="true" /></PanelLink>}
        >
          {pending ?? <p>Still with the office, as of {dayText(d!.asOf)}</p>}
        </Card>

        <Card
          name="attended"
          icon={<GraduationCap size={14} />}
          // The chosen year's, which may be a past one.
          label={d ? `Attended a training in FY ${d.fiscalYear}` : "Attended a training"}
          value={value(x => `${x.attendance.attended} of ${x.attendance.total}`)}
          extra={d && (
            <span data-hr-percent className="font-mono text-sm font-semibold tabular-nums text-emerald-700">
              {percentText(d.attendance.attended, d.attendance.total)}
            </span>
          )}
        >
          {pending ?? (
            <>
              <p>Staff HR recorded &ldquo;Attended&rdquo; at a FY {d!.fiscalYear} seminar, or with a training HR recorded in the year.</p>
              <p>A seminar still to come counts once they have attended it.</p>
            </>
          )}
        </Card>

        <Card
          name="followup"
          // Alone on its row between md and lg: the whole row, rather than half of it beside a gap.
          className="md:col-span-2 lg:col-span-1"
          icon={<Wallet size={14} />}
          label="Not yet liquidated or reimbursed"
          value={value(() => String(rows.length))}
          extra={d && (
            overdue > 0 ? (
              <span className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
                <span data-hr-overdue>{overdue}</span>&nbsp;overdue
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-500"><span data-hr-overdue>0</span> overdue</span>
            )
          )}
          action={d && rows.length > 0 ? <PanelLink onClick={onShowFollowUp}>See who <ArrowDown size={11} aria-hidden="true" /></PanelLink> : undefined}
        >
          {pending ?? (
            <>
              <p>Seats of any fiscal year whose cash advance or claim is still open.</p>
              <p><span data-hr-noclaim>{noClaim}</span> attended a FY {d!.fiscalYear} seminar with no cash advance or claim{noClaim > 0 ? "; they may still file a reimbursement" : ""}.</p>
            </>
          )}
        </Card>
      </div>
      {/* For screen readers: what the cards hold once loaded (announced again when another year is chosen). */}
      <p role="status" className="sr-only">
        {load.loading ? "Loading HR's dashboard…" : d ? `FY ${d.fiscalYear}: ${plural(d.headcount.total, "staff member")}, ${d.attendance.attended} attended a training. Every year: ${plural(rows.length, "seat")} not yet liquidated or reimbursed, ${overdue} overdue.` : ""}
      </p>
    </section>
  );
}

/** One figure: `data-hr-card` names it, `data-hr-value` holds its main value. */
function Card({ name, icon, label, value, extra, action, className = "", children }: {
  name: "staff" | "attended" | "followup";
  icon: ReactNode;
  label: string;
  value: string;
  extra?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-hr-card={name} className={`flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 ${className}`}>
      <p className="flex items-start gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <span className="mt-px shrink-0 text-blue-600" aria-hidden="true">{icon}</span>
        <span className="min-w-0">{label}</span>
      </p>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span data-hr-value className="break-words font-mono text-lg font-bold leading-tight tabular-nums text-slate-800 sm:text-2xl">{value}</span>
        {extra}
      </p>
      <div className="mt-1 flex-1 space-y-0.5 break-words text-[11px] leading-snug text-slate-500">{children}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
