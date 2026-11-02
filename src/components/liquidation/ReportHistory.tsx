import type { LiquidationSubmissionView } from "../../types";
import { reportHistory, type ReportEventKind } from "../../reportHistory";
import { formatDate } from "../../utils";

// Each step's mark on the line, next to its words: the colour never says it alone.
const MARK: Record<ReportEventKind, string> = {
  filed: "bg-slate-400",
  returned: "bg-amber-500",
  corrected: "bg-blue-500",
  verified: "bg-blue-600",
  validated: "bg-emerald-600",
  fundReturned: "bg-emerald-600",
  paid: "bg-emerald-600"
};

// A Return from before they were dated has no date, and an older record may hold anything.
const when = (at: string) => (at && Number.isFinite(Date.parse(at)) ? formatDate(at) : "Date not recorded");

/** What has happened to a report, newest first (the instructor's review, R8). */
export default function ReportHistory({ report }: { report: Partial<LiquidationSubmissionView> | null | undefined }) {
  const events = reportHistory(report);
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] font-bold uppercase text-slate-500">History</p>
      {events.length === 0 ? (
        <p className="text-xs italic text-slate-500">Nothing has been recorded on this report yet.</p>
      ) : (
        <ol className="space-y-2.5 border-l border-slate-200 pl-3">
          {events.map((event, i) => (
            <li key={`${event.kind}-${i}`} className="relative text-[11px] text-slate-600">
              <span className={`absolute -left-[16px] top-1 h-[7px] w-[7px] rounded-full ${MARK[event.kind]}`} aria-hidden="true" />
              <p className="font-semibold text-slate-800">{event.title}</p>
              <p className="font-mono text-[10px] text-slate-500">
                {when(event.at)}{event.by ? ` · ${event.by}` : ""}
              </p>
              {event.detail && <p className="mt-0.5 break-words">{event.detail}</p>}
              {event.note && <p className="mt-0.5 break-words italic text-slate-700">&ldquo;{event.note}&rdquo;</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
