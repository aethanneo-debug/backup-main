import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import PostTrainingEvaluationReport from "./PostTrainingEvaluationReport";
import { TrainingEvaluationQueueRow } from "./evaluationQueue";

interface Props {
  /** Null closes the preview. The row's `evaluation` supplies the sheet. */
  row: TrainingEvaluationQueueRow | null;
  onClose: () => void;
}

/**
 * Screen wrapper around the printable Post-Training Performance Evaluation Report.
 *
 * Same mechanism as the COA Liquidation Report and the Vehicle Reservation Slip: it
 * renders through a portal so the sheets are a direct child of <body>, and the `@media
 * print` block in src/index.css then hides every other body child — the only reliable way
 * to strip the sidebar and page chrome from the printout. While open, <body> carries
 * `.pte-printing`, so the browser's own Ctrl+P behaves exactly like the Print button here.
 * The class/id pair is its own, so neither of the two existing print views can be affected.
 */
export default function PostTrainingEvaluationReportModal({ row, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const evaluation = row?.evaluation ?? null;

  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [row, onClose]);

  // Focus once per opened report, not on every parent re-render.
  useEffect(() => {
    if (row) closeRef.current?.focus();
  }, [row?.trainingParticipantId]);

  useEffect(() => {
    if (!row) return;
    document.body.classList.add("pte-printing");
    return () => document.body.classList.remove("pte-printing");
  }, [row]);

  if (!row || !evaluation) return null;

  return createPortal(
    <div
      id="pte-print-portal"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm print:static print:block print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-label="Post-Training Performance Evaluation Report preview"
    >
      <div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl print:my-0 print:max-w-none print:overflow-visible print:rounded-none print:shadow-none">
        {/* Modal chrome — never printed */}
        <div className="flex items-center justify-between bg-blue-600 px-5 py-3 print:hidden">
          <div className="min-w-0">
            <h2 className="truncate font-mono text-xs font-bold uppercase tracking-widest text-white">
              Post-Training Performance Evaluation Report
            </h2>
            <p className="mt-0.5 truncate font-mono text-[10px] text-blue-200">
              {row.employeeName} &middot; {evaluation.status === "Finalized" ? "Finalised" : "Draft"} &middot;{" "}
              {evaluation.overallRating}/20 {evaluation.qualitativeRating}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Printer size={12} aria-hidden="true" />
              Print
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close evaluation report preview"
              className="cursor-pointer rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-blue-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar max-h-[78vh] overflow-y-auto bg-slate-100 p-4 print:max-h-none print:overflow-visible print:bg-white print:p-0">
          <div className="shadow-sm print:shadow-none">
            <PostTrainingEvaluationReport row={row} evaluation={evaluation} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
