import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { longDate } from "../evaluation/evaluationQueue";
import PlanDSheet from "./PlanDSheet";
import { PlanDSnapshot, planDFileName, planDTotals } from "./planDRows";

interface Props {
  /** Null closes the preview. */
  plan: PlanDSnapshot | null;
  onClose: () => void;
}

/**
 * Print preview for Plan D, on the same mechanism as the Liquidation Report, the Vehicle
 * Reservation Slip and the evaluation report: it renders through a portal so the sheet is a
 * direct child of <body>, and while it is open <body> carries `.tdpd-printing`, whose block
 * in src/index.css hides every other body child and turns the page landscape. Ctrl+P and the
 * Print button therefore give the same bare form.
 */
export default function PlanDPrintModal({ plan, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!plan) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [plan, onClose]);

  useEffect(() => {
    if (!plan) return;
    closeRef.current?.focus();
    document.body.classList.add("tdpd-printing");
    // "Save as PDF" names the file after the page title.
    const previousTitle = document.title;
    document.title = planDFileName(plan);
    return () => {
      document.body.classList.remove("tdpd-printing");
      document.title = previousTitle;
    };
  }, [plan]);

  if (!plan) return null;
  const totals = planDTotals(plan.offices);

  return createPortal(
    <div
      id="tdpd-print-portal"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm print:static print:block print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-label="Training and Development Plan D print preview"
    >
      <div className="my-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl print:my-0 print:max-w-none print:overflow-visible print:rounded-none print:shadow-none">
        {/* Modal chrome — never printed */}
        <div className="flex items-center justify-between gap-3 bg-blue-600 px-5 py-3 print:hidden">
          <div className="min-w-0">
            <h2 className="truncate font-mono text-xs font-bold uppercase tracking-widest text-white">
              Training and Development Plan - D
            </h2>
            <p className="mt-0.5 truncate font-mono text-[10px] text-blue-200">
              CY {plan.fiscalYear} &middot; as of {longDate(plan.asOf)} &middot; {totals.accomplished} of {totals.needs} accomplished
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
              aria-label="Close Plan D print preview"
              className="cursor-pointer rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-blue-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar max-h-[78vh] overflow-auto bg-slate-100 p-4 print:max-h-none print:overflow-visible print:bg-white print:p-0">
          <div className="shadow-sm print:shadow-none">
            <PlanDSheet plan={plan} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
