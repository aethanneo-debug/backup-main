import { ChevronDown, ChevronRight, Lock, PenLine, Printer } from "lucide-react";
import { TrainingEvaluation } from "../../../types";
import { formatDate } from "../../../utils";
import TrainingEvaluationForm from "./TrainingEvaluationForm";
import { BAND_BADGE, TrainingEvaluationQueueRow, evaluationState } from "./evaluationQueue";

/** One participant in the queue: the state at a glance, the official form when opened. */
export default function EvaluationQueueItem({
  row,
  open,
  onToggle,
  onSaved,
  onPrint
}: {
  row: TrainingEvaluationQueueRow;
  open: boolean;
  onToggle: () => void;
  onSaved: (saved: TrainingEvaluation) => void;
  onPrint: () => void;
}) {
  const state = evaluationState(row);
  const evaluation = row.evaluation;
  const panelId = `pte-panel-${row.trainingParticipantId}`;

  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-bold text-slate-800">{row.employeeName}</h4>
            {row.position && <span className="text-[10px] text-slate-500">{row.position}</span>}
            <StateBadge row={row} />
          </div>
          <p className="mt-1 truncate text-[11px] text-slate-600" title={row.trainingTitle}>
            {row.trainingTitle || "Untitled seminar"}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">
            Ended {row.dateEnded ? formatDate(row.dateEnded) : "date not recorded"}
            {row.division ? ` · ${row.division}` : ""}
            {evaluation?.supervisorName ? ` · supervisor ${evaluation.supervisorName}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {evaluation && (
            <button
              type="button"
              onClick={onPrint}
              aria-label={`Preview the evaluation report for ${row.employeeName}`}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
            >
              <Printer size={13} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            className={
              state === "finalized"
                ? "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
                : "inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
            }
          >
            {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
            {open
              ? "Hide form"
              : state === "not-evaluated"
              ? "Record Evaluation"
              : state === "draft"
              ? "Continue Draft"
              : "View Report"}
          </button>
        </div>
      </div>

      <div id={panelId} hidden={!open}>
        {open && (
          <TrainingEvaluationForm
            key={row.trainingParticipantId}
            row={row}
            onSaved={onSaved}
            onClose={onToggle}
            onPrint={onPrint}
          />
        )}
      </div>
    </li>
  );
}

/** Not evaluated / Draft / Finalised, with the score once there is one. */
function StateBadge({ row }: { row: TrainingEvaluationQueueRow }) {
  const state = evaluationState(row);
  const evaluation = row.evaluation;

  if (state === "not-evaluated") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
        <PenLine size={10} aria-hidden="true" />
        Not evaluated
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {state === "finalized" ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          <Lock size={10} aria-hidden="true" />
          Finalised
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
          <PenLine size={10} aria-hidden="true" />
          Draft
        </span>
      )}
      {evaluation && state === "finalized" && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${BAND_BADGE[evaluation.qualitativeRating]}`}
        >
          {evaluation.overallRating}/20
          <span className="font-sans font-semibold">{evaluation.qualitativeRating}</span>
        </span>
      )}
      {/* A draft's total is provisional until all five statements are scored, so it is
          shown plainly rather than in its band colour. */}
      {evaluation && state === "draft" && (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
          {evaluation.overallRating}/20
          <span className="font-sans font-normal text-slate-500">so far</span>
        </span>
      )}
    </span>
  );
}
