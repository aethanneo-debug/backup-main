import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Lock, Printer, Save, ShieldCheck } from "lucide-react";
import { TRAINING_EVALUATION_PROMPTS, TrainingEvaluation, TrainingEvaluationRating } from "../../../types";
import { apiCall, formatDate, getLocalTodayString } from "../../../utils";
import EvaluationRatingGrid from "./EvaluationRatingGrid";
import EvaluationRecordHeader from "./EvaluationRecordHeader";
import {
  BAND_BADGE,
  EvaluationSavePayload,
  TrainingEvaluationQueueRow,
  blankComments,
  blankRatings,
  deriveTotals,
  finaliseBlockers,
  toFiveComments,
  toFiveRatings
} from "./evaluationQueue";

interface Props {
  row: TrainingEvaluationQueueRow;
  /** The server's saved record — authoritative for the derived rating. */
  onSaved: (saved: TrainingEvaluation) => void;
  onClose: () => void;
  onPrint: () => void;
}

const FIELD =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100 disabled:text-slate-500";

/**
 * The Post-Training Performance Evaluation Report as HR fills it in.
 *
 * Mounted with `key={trainingParticipantId}` by the desk, so the initial state below is
 * the whole story: opening a different participant mounts a fresh form rather than
 * leaking one officer's half-typed answers into the next record.
 *
 * A finalised report is rendered read-only. The server rejects any edit to one with a
 * 400, so offering a Save button that is guaranteed to fail would only teach HR to
 * distrust the screen.
 */
export default function TrainingEvaluationForm({ row, onSaved, onClose, onPrint }: Props) {
  const existing = row.evaluation;
  const readOnly = existing?.status === "Finalized";

  const [dateOfEvaluation, setDateOfEvaluation] = useState(existing?.dateOfEvaluation || getLocalTodayString());
  const [supervisorName, setSupervisorName] = useState(existing?.supervisorName || "");
  const [supervisorPosition, setSupervisorPosition] = useState(existing?.supervisorPosition || "");
  const [ratings, setRatings] = useState<(TrainingEvaluationRating | null)[]>(
    existing ? toFiveRatings(existing.ratings) : blankRatings()
  );
  const [comments, setComments] = useState<string[]>(
    existing ? toFiveComments(existing.comments) : blankComments()
  );

  const [saving, setSaving] = useState<"Draft" | "Finalized" | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const blockers = useMemo(
    () => (readOnly ? [] : finaliseBlockers(ratings, supervisorName, dateOfEvaluation)),
    [readOnly, ratings, supervisorName, dateOfEvaluation]
  );
  const live = deriveTotals(ratings);
  const busy = saving !== null;

  function setRating(index: number, value: TrainingEvaluationRating) {
    setRatings(prev => prev.map((r, i) => (i === index ? value : r)));
    setError("");
  }

  function setComment(index: number, value: string) {
    setComments(prev => prev.map((c, i) => (i === index ? value : c)));
  }

  async function save(status: "Draft" | "Finalized") {
    setError("");
    // The server's own three rules, checked here so HR is told before submitting.
    if (status === "Finalized" && blockers.length > 0) {
      setConfirming(false);
      setError(blockers[0]);
      return;
    }

    setSaving(status);
    try {
      // overallRating and qualitativeRating are deliberately absent: the server derives
      // them and ignores anything sent, so sending them would only invite drift.
      const payload: EvaluationSavePayload = {
        trainingParticipantId: row.trainingParticipantId,
        dateOfEvaluation,
        supervisorName: supervisorName.trim(),
        supervisorPosition: supervisorPosition.trim(),
        ratings,
        comments,
        status
      };
      const res = await apiCall("/api/training/evaluations", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (res.status === "success" && res.data) {
        setConfirming(false);
        onSaved(res.data as TrainingEvaluation);
      } else {
        setError(res.message || "Could not save the evaluation.");
      }
    } catch (err: any) {
      // apiCall throws on a non-2xx, so the server's message only reaches here.
      setError(err.message || "Could not save the evaluation.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      {readOnly && existing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="flex items-start gap-2 text-[11px] text-emerald-800">
            <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Finalised</strong> on{" "}
              {existing.dateOfEvaluation ? formatDate(existing.dateOfEvaluation) : formatDate(existing.evaluatedAt)} by{" "}
              {existing.evaluatedBy || "HR"}. A finalised report is a signed record and can no longer be edited &mdash;
              print it for the supervisor&rsquo;s signature.
            </span>
          </p>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
          >
            <Printer size={13} aria-hidden="true" />
            Print Report
          </button>
        </div>
      )}

      <EvaluationRecordHeader row={row} />

      <fieldset disabled={readOnly || busy} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <legend className="sr-only">Evaluation particulars</legend>
        <div className="space-y-1">
          <label
            htmlFor={`pte-date-${row.trainingParticipantId}`}
            className="block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500"
          >
            Date of Evaluation <span className="text-rose-600">*</span>
          </label>
          <input
            id={`pte-date-${row.trainingParticipantId}`}
            type="date"
            value={dateOfEvaluation}
            onChange={e => setDateOfEvaluation(e.target.value)}
            className={`${FIELD} font-mono`}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`pte-sup-${row.trainingParticipantId}`}
            className="block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500"
          >
            Immediate Supervisor <span className="text-rose-600">*</span>
          </label>
          <input
            id={`pte-sup-${row.trainingParticipantId}`}
            type="text"
            value={supervisorName}
            onChange={e => setSupervisorName(e.target.value)}
            placeholder="Full name as it should print"
            className={FIELD}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`pte-suppos-${row.trainingParticipantId}`}
            className="block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500"
          >
            Supervisor Position
          </label>
          <input
            id={`pte-suppos-${row.trainingParticipantId}`}
            type="text"
            value={supervisorPosition}
            onChange={e => setSupervisorPosition(e.target.value)}
            placeholder="Designation"
            className={FIELD}
          />
        </div>
      </fieldset>

      <section aria-labelledby={`pte-part1-${row.trainingParticipantId}`} className="space-y-2">
        <h4
          id={`pte-part1-${row.trainingParticipantId}`}
          className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-700"
        >
          Part I &mdash; Performance Indicators
        </h4>
        <EvaluationRatingGrid
          idPrefix={`pte-${row.trainingParticipantId}`}
          ratings={ratings}
          onChange={setRating}
          readOnly={readOnly}
        />
      </section>

      <section aria-labelledby={`pte-part2-${row.trainingParticipantId}`} className="space-y-3">
        <h4
          id={`pte-part2-${row.trainingParticipantId}`}
          className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-700"
        >
          Part II &mdash; Narrative
        </h4>
        {(TRAINING_EVALUATION_PROMPTS ?? []).map((prompt, i) => (
          <div key={i} className="space-y-1">
            <label
              htmlFor={`pte-c${i}-${row.trainingParticipantId}`}
              className="flex gap-1.5 text-[11px] leading-snug text-slate-700"
            >
              <span className="font-mono text-[10px] font-bold text-slate-400">{i + 1}.</span>
              <span>{prompt}</span>
            </label>
            <textarea
              id={`pte-c${i}-${row.trainingParticipantId}`}
              rows={3}
              value={comments[i] ?? ""}
              readOnly={readOnly}
              disabled={busy}
              onChange={e => setComment(i, e.target.value)}
              placeholder={readOnly ? "" : "Answer in the supervisor's own words."}
              className={`${FIELD} leading-snug ${readOnly ? "bg-slate-50 text-slate-600" : ""}`}
            />
          </div>
        ))}
      </section>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {!readOnly && blockers.length > 0 && (
        <div
          id={`pte-blockers-${row.trainingParticipantId}`}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
        >
          <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber-800">
            Before this can be finalised
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-amber-800">
            {blockers.map(b => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-amber-700">A draft may be saved incomplete and finished later.</p>
        </div>
      )}

      {!readOnly && confirming && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3">
          <p className="flex items-start gap-2 text-[11px] text-blue-800">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Finalise this evaluation for <strong className="font-semibold">{row.employeeName}</strong> at{" "}
              <strong className="font-semibold">{live.overallRating}/20</strong>{" "}
              <span
                className={`inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${BAND_BADGE[live.qualitativeRating]}`}
              >
                {live.qualitativeRating}
              </span>
              ? This cannot be undone &mdash; the ratings, the narrative and the signatory are locked, and only a print
              for signature remains.
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => save("Finalized")}
              disabled={busy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving === "Finalized" && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
              {saving === "Finalized" ? "Finalising…" : "Yes, finalise"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:opacity-60"
            >
              Go back
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={() => save("Draft")}
              disabled={busy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving === "Draft" ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Save size={12} aria-hidden="true" />
              )}
              {saving === "Draft" ? "Saving…" : "Save Draft"}
            </button>
            {!confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={busy || blockers.length > 0}
                aria-describedby={blockers.length > 0 ? `pte-blockers-${row.trainingParticipantId}` : undefined}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck size={12} aria-hidden="true" />
                Finalise
              </button>
            )}
          </>
        )}
        {existing && !readOnly && (
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
          >
            <Printer size={12} aria-hidden="true" />
            Preview Report
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:opacity-60"
        >
          Close
        </button>
      </div>
    </div>
  );
}
