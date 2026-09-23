import { formatDate } from "../../../utils";
import { TrainingEvaluationQueueRow } from "./evaluationQueue";

/**
 * The trainee and training block at the head of the paper form, shown on screen as
 * read-only facts rather than fields.
 *
 * Every value comes from the employee record and the seminar the participant was
 * enrolled in, so HR cannot introduce a name or a title that disagrees with the rest of
 * the system — and has nothing to retype.
 */
export default function EvaluationRecordHeader({ row }: { row: TrainingEvaluationQueueRow }) {
  const cells: { label: string; value: string }[] = [
    { label: "Name of Employee", value: row.employeeName },
    { label: "Position", value: row.position },
    { label: "Division / Unit", value: row.division },
    { label: "Title of Training", value: row.trainingTitle },
    { label: "Date Conducted", value: dateRange(row.dateConducted, row.dateEnded) },
    { label: "Organizer / Facilitator", value: row.organizer }
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
        From the employee and seminar records &middot; not editable here
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {cells.map(c => (
          <div key={c.label} className="min-w-0">
            <dt className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">{c.label}</dt>
            <dd className="truncate text-[11px] font-semibold text-slate-800" title={c.value || undefined}>
              {c.value || <span className="font-normal text-slate-400">Not on record</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** "Aug 4, 2026 to Aug 6, 2026", or one date when the seminar ran for a single day. */
export function dateRange(from?: string, to?: string): string {
  const a = from ? formatDate(from) : "";
  const b = to ? formatDate(to) : "";
  if (a && b && a !== b) return `${a} to ${b}`;
  return a || b;
}
