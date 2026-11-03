import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { useDialogLayer } from "../ui/ModalDialog";
import PlanHeader from "../training/PlanHeader";
import ReportSheet from "./ReportSheet";
import type { ReportView } from "./reportView";

/**
 * Print preview for a training report, on the same mechanism as Plan D, the Liquidation Report and the Vehicle Reservation
 * Slip: it renders through a portal so the sheet is a direct child of <body>, and while it is open <body> carries
 * `.trr-printing`, whose block in src/index.css hides every other body child and turns the page landscape. So Ctrl+P and
 * the Print button give the same bare sheet. A dialog in the app's stack (useDialogLayer): Esc closes it, Tab stays in it,
 * and the focus goes back to the button that opened it.
 */
export default function ReportPreview({ view, onClose }: { view: ReportView; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogLayer(panelRef, onClose);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("trr-printing");
    // "Save as PDF" names the file after the page title: a staff code, never a person's name.
    const previousTitle = document.title;
    document.title = view.fileName;
    return () => {
      document.body.classList.remove("trr-printing");
      document.title = previousTitle;
    };
  }, [view.fileName]);

  return createPortal(
    <div
      ref={panelRef}
      id="trr-print-portal"
      data-report-preview={view.key}
      role="dialog"
      aria-modal="true"
      aria-label={`${view.title} print preview`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-2 backdrop-blur-sm focus:outline-none sm:p-4 print:static print:block print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none"
    >
      <div className="my-auto w-full min-w-0 max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl print:my-0 print:max-w-none print:overflow-visible print:rounded-none print:shadow-none">
        {/* Modal chrome: never printed. */}
        <div className="flex items-center justify-between gap-3 bg-blue-600 px-4 py-3 sm:px-5 print:hidden">
          <div className="min-w-0">
            <h2 className="truncate font-mono text-xs font-bold uppercase tracking-widest text-white">{view.title}</h2>
            <p className="mt-0.5 truncate font-mono text-[10px] text-blue-200">{view.subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-report-preview-print=""
              onClick={() => window.print()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Printer size={12} aria-hidden="true" />
              Print
            </button>
            <button
              ref={closeRef}
              type="button"
              data-report-preview-close=""
              onClick={onClose}
              aria-label={`Close the ${view.title} print preview`}
              className="cursor-pointer rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-blue-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar max-h-[78vh] overflow-auto bg-slate-100 p-2 sm:p-4 print:max-h-none print:overflow-visible print:bg-white print:p-0">
          <div className="w-fit min-w-full shadow-sm print:w-auto print:shadow-none">
            <div id="trr-print-root" className="mx-auto min-w-[960px] bg-white p-8 text-slate-900 print:min-w-0 print:p-0">
              <PlanHeader planTitle={view.title} subtitle={view.subtitle} />
              <ReportSheet view={view} variant="print" />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
