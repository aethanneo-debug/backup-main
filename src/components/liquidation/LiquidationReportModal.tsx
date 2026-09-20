import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LiquidationSubmission } from "../../types";
import { X, Printer } from "lucide-react";
import LiquidationReportForm from "./LiquidationReportForm";

interface LiquidationReportModalProps {
  submission: LiquidationSubmission | null;
  activityLabel?: string;
  onClose: () => void;
}

/**
 * Screen wrapper around the printable COA Liquidation Report.
 *
 * It renders through a portal so the sheet is a direct child of <body>: the `@media
 * print` block in src/index.css can then hide every other body child outright, which is
 * the only reliable way to strip the sidebar and page chrome from the printout. While it
 * is open <body> carries `.lr-printing`, so the browser's own Ctrl+P behaves exactly
 * like the Print button here.
 */
export default function LiquidationReportModal({
  submission,
  activityLabel,
  onClose,
}: LiquidationReportModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc closes, matching the other modals in the portal.
  useEffect(() => {
    if (!submission) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submission, onClose]);

  // Focus once per opened report - not on every parent re-render, which would yank
  // focus back while the user is reading.
  useEffect(() => {
    if (submission) closeRef.current?.focus();
  }, [submission?.id]);

  // Scope the print stylesheet to the time this modal is actually on screen.
  useEffect(() => {
    if (!submission) return;
    document.body.classList.add("lr-printing");
    return () => document.body.classList.remove("lr-printing");
  }, [submission]);

  if (!submission) return null;

  return createPortal(
    <div
      id="lr-print-portal"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm print:static print:block print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-label="Liquidation Report preview"
    >
      <div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl print:my-0 print:max-w-none print:overflow-visible print:rounded-none print:shadow-none">
        {/* Modal chrome - never printed */}
        <div className="flex items-center justify-between bg-blue-600 px-5 py-3 print:hidden">
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-white">
              Liquidation Report
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-blue-200">
              Serial No. {submission.serialNo || submission.submissionNo}
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
              aria-label="Close liquidation report preview"
              className="cursor-pointer rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-blue-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar max-h-[78vh] overflow-y-auto bg-slate-100 p-4 print:max-h-none print:overflow-visible print:bg-white print:p-0">
          <div className="shadow-sm print:shadow-none">
            <LiquidationReportForm submission={submission} activityLabel={activityLabel} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
