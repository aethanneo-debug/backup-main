import { Eye, UserX } from "lucide-react";
import type { HrNoClaimRow, NotificationLink } from "../../../types";
import { Badge, OPEN_BUTTON } from "./HrPanel";
import { dayText } from "./hrFormat";

/**
 * Attendees with no cash advance and no claim at all (12ag Part B): nothing of theirs is open, but they may still file a
 * reimbursement for the seminar (up to their share), or never claim. Folded: it is for reading, not chasing. Each row
 * opens the seat in the seminar's attendance list.
 */
export default function NoClaimList({ rows, fiscalYear, onOpenLink }: {
  rows: HrNoClaimRow[];
  fiscalYear: string;
  onOpenLink: (link: NotificationLink) => void;
}) {
  return (
    <details data-noclaim className="mt-4 rounded-lg border border-slate-200 bg-slate-50 text-xs">
      <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-[11px] font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        Attended with no cash advance or claim ({rows.length})
      </summary>
      <div className="space-y-2 rounded-b-lg border-t border-slate-200 bg-white px-3 py-2.5">
        <p className="text-[11px] leading-snug text-slate-600">
          They attended a FY {fiscalYear} seminar with no cash advance out for them (none released, or one declined or handed back),
          and they haven&rsquo;t filed a claim. They may still file a reimbursement for it, up to their share, if they paid for it
          themselves; or they may claim nothing.
        </p>
        {rows.length === 0 ? (
          <p className="text-[11px] italic text-slate-500">Nobody attended without a cash advance or a claim.</p>
        ) : (
          <div className="custom-scrollbar relative max-h-80 overflow-auto">
            <table className="w-full min-w-[36rem] text-left">
              <caption className="sr-only">FY {fiscalYear}: attendees with no cash advance and no claim</caption>
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-200 text-[10px] text-slate-500">
                  <th scope="col" className="py-1 pr-2 font-semibold">Employee</th>
                  <th scope="col" className="py-1 pr-2 font-semibold">Seminar</th>
                  <th scope="col" className="py-1 pr-2 font-semibold">Ended</th>
                  <th scope="col" className="py-1 pr-2 font-semibold">Note</th>
                  <th scope="col" className="py-1 text-right font-semibold"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.participantId} data-noclaim-row={r.participantId} className="border-b border-slate-100 align-top">
                    <td className="py-1.5 pr-2">
                      <span className="block break-words font-semibold text-slate-800">{r.employee}</span>
                      {!r.withOffice && (
                        <Badge tone="amber" className="mt-1"><UserX size={10} className="shrink-0" aria-hidden="true" />No longer with the office</Badge>
                      )}
                    </td>
                    <td className="break-words py-1.5 pr-2 text-slate-700">{r.seminarTitle}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-slate-600">{dayText(r.endDate)}</td>
                    <td className="py-1.5 pr-2 text-slate-600">
                      {r.officePaid
                        ? <span data-noclaim-office-paid>HR entered expenses the office paid for them</span>
                        : <><span className="text-slate-400" aria-hidden="true">&mdash;</span><span className="sr-only">None</span></>}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        data-noclaim-open
                        onClick={() => onOpenLink({ tab: "training_development", record: { kind: "attendance", id: r.participantId } })}
                        className={OPEN_BUTTON}
                      >
                        <Eye size={12} aria-hidden="true" />
                        View attendance
                        <span className="sr-only"> of {r.employee}, {r.seminarTitle}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
