import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, ClipboardCheck, Download, Loader2, RefreshCw, Search } from "lucide-react";
import { TrainingEvaluation } from "../../../types";
import { apiCall, downloadCSV, formatDate } from "../../../utils";
import SectionCard, { SectionCount } from "../../ui/SectionCard";
import EvaluationQueueItem from "./EvaluationQueueItem";
import PostTrainingEvaluationReportModal from "./PostTrainingEvaluationReportModal";
import { TrainingEvaluationQueueRow, evaluationState } from "./evaluationQueue";

const CSV_HEADERS = [
  "Employee",
  "Position",
  "Division",
  "Seminar",
  "Date Ended",
  "Evaluation Status",
  "Overall Rating",
  "Qualitative Rating",
  "Date of Evaluation",
  "Immediate Supervisor"
];

/**
 * Step 4 of the Training and Development Plan: the post-training evaluation work queue.
 *
 * A participant appears the moment their seminar has ended, and stays until the report is
 * finalised — so this list is the answer to "who still owes an evaluation?". Unevaluated
 * rows come first from the server; opening one reveals the official form inline, the same
 * shape as the Cash Advance Desk in Finance.
 */
export default function TrainingEvaluationsDesk() {
  const [rows, setRows] = useState<TrainingEvaluationQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiCall("/api/training/evaluations");
      if (res.status === "success") setRows(res.data ?? []);
      else setLoadError(res.message || "Could not load the evaluation queue.");
    } catch (err: any) {
      setLoadError(err.message || "Could not load the evaluation queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows ?? [];
    return (rows ?? []).filter(r =>
      [r.employeeName, r.position, r.division, r.trainingTitle, r.organizer]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const pending = filtered.filter(r => evaluationState(r) === "not-evaluated");
  const drafts = filtered.filter(r => evaluationState(r) === "draft");
  const finalised = filtered.filter(r => evaluationState(r) === "finalized");
  const printRow = (rows ?? []).find(r => r.trainingParticipantId === printId) ?? null;

  function handleSaved(saved: TrainingEvaluation) {
    setRows(prev =>
      (prev ?? []).map(r =>
        r.trainingParticipantId === saved.trainingParticipantId ? { ...r, evaluation: saved } : r
      )
    );
    setNotice(
      saved.status === "Finalized"
        ? `Finalised at ${saved.overallRating}/20 — ${saved.qualitativeRating}. Print the report for the supervisor's signature.`
        : "Draft saved. It can be finished any time before finalising."
    );
  }

  function exportCsv() {
    const data = (filtered ?? []).map(r => ({
      Employee: r.employeeName,
      Position: r.position,
      Division: r.division,
      Seminar: r.trainingTitle,
      "Date Ended": r.dateEnded ? formatDate(r.dateEnded) : "",
      "Evaluation Status": r.evaluation ? r.evaluation.status : "Not evaluated",
      "Overall Rating": r.evaluation ? `${r.evaluation.overallRating}/20` : "",
      "Qualitative Rating": r.evaluation ? r.evaluation.qualitativeRating : "",
      "Date of Evaluation": r.evaluation?.dateOfEvaluation ? formatDate(r.evaluation.dateOfEvaluation) : "",
      "Immediate Supervisor": r.evaluation?.supervisorName || ""
    }));
    downloadCSV(data, CSV_HEADERS, "post_training_evaluations");
  }

  const group = (
    title: string,
    items: TrainingEvaluationQueueRow[],
    hint: string
  ) =>
    items.length === 0 ? null : (
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-1">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {title} ({items.length})
          </h3>
          <span className="text-[10px] text-slate-400">{hint}</span>
        </div>
        <ul className="space-y-2">
          {items.map(row => (
            <EvaluationQueueItem
              key={row.trainingParticipantId}
              row={row}
              open={openId === row.trainingParticipantId}
              onToggle={() => {
                setNotice("");
                setOpenId(openId === row.trainingParticipantId ? null : row.trainingParticipantId);
              }}
              onSaved={handleSaved}
              onPrint={() => setPrintId(row.trainingParticipantId)}
            />
          ))}
        </ul>
      </div>
    );

  return (
    <SectionCard
      icon={<ClipboardCheck size={12} className="text-blue-600" aria-hidden="true" />}
      title="Post-Training Performance Evaluation"
      action={<SectionCount>{pending.length + drafts.length} to complete</SectionCount>}
      caption="Step 4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[11px] text-slate-500">
          The supervisor&rsquo;s report on what the employee actually brought back. A participant appears here once
          their seminar has ended, and leaves the queue once the report is finalised. Names, positions, divisions and
          seminar details are read from the records &mdash; only the ratings, the narrative and the signatory are keyed.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search employee or seminar"
              aria-label="Search the evaluation queue"
              className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
            />
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:opacity-60"
          >
            <Download size={13} aria-hidden="true" />
            CSV
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Reload the evaluation queue"
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {loadError && (
        <p className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          <span className="flex gap-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            {loadError}
          </span>
          <button type="button" onClick={load} className="shrink-0 cursor-pointer font-semibold underline">
            Retry
          </button>
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800"
        >
          <BadgeCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading finished seminars…
          </p>
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      ) : (rows ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <ClipboardCheck size={28} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
          <p className="text-xs font-semibold text-slate-600">Nothing to evaluate yet</p>
          <p className="mt-1 text-[11px] text-slate-500">
            A participant appears here once the seminar they attended has ended. Create the seminar and pick its
            participants under Programs &amp; Budget first.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <Search size={24} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
          <p className="text-xs font-semibold text-slate-600">No participant matches &ldquo;{query}&rdquo;</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-2 cursor-pointer text-[11px] font-semibold text-blue-700 underline hover:text-blue-800"
          >
            Clear the search
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length === 0 && drafts.length === 0 && (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              <BadgeCheck size={13} className="shrink-0" aria-hidden="true" />
              Every finished seminar in this list has been evaluated and finalised.
            </p>
          )}
          {group("Awaiting evaluation", pending, "seminar has ended, no report started")}
          {group("Drafts", drafts, "saved but not yet finalised")}
          {group("Finalised", finalised, "locked — print for signature")}
        </div>
      )}

      <PostTrainingEvaluationReportModal row={printRow} onClose={() => setPrintId(null)} />
    </SectionCard>
  );
}
