import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Printer } from "lucide-react";
import { VehicleRequest } from "../../types";
import VehicleReservationSlip from "./VehicleReservationSlip";

interface Props {
  request: VehicleRequest | null;
  division?: string;
  onClose: () => void;
}

/**
 * Screen wrapper around the printable Vehicle Reservation Slip.
 *
 * Same mechanism as the Liquidation Report: it renders through a portal so the sheet is a
 * direct child of <body>, and the `@media print` block in src/index.css then hides every
 * other body child. That is the only reliable way to strip the sidebar and page chrome
 * from the printout — a visibility trick inherits offsets from the positioned wrappers
 * above it. While open, <body> carries `.vrs-printing`, so the browser's own Ctrl+P
 * behaves exactly like the Print button here.
 */
export default function VehicleReservationSlipModal({ request, division, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [request, onClose]);

  // Focus once per opened slip, not on every parent re-render.
  useEffect(() => {
    if (request) closeRef.current?.focus();
  }, [request?.id]);

  useEffect(() => {
    if (!request) return;
    document.body.classList.add("vrs-printing");
    return () => document.body.classList.remove("vrs-printing");
  }, [request]);

  if (!request) return null;

  return createPortal(
    <div
      id="vrs-print-portal"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm print:static print:block print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-label="Vehicle Reservation Slip preview"
    >
      <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl print:my-0 print:max-w-none print:overflow-visible print:rounded-none print:shadow-none">
        {/* Modal chrome — never printed */}
        <div className="flex items-center justify-between bg-blue-600 px-5 py-3 print:hidden">
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-white">
              Vehicle Reservation Slip
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-blue-200">
              VRS No. {request.vrsNo || "not issued"}
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
              aria-label="Close reservation slip preview"
              className="cursor-pointer rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-blue-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar max-h-[78vh] overflow-y-auto bg-slate-100 p-4 print:max-h-none print:overflow-visible print:bg-white print:p-0">
          <div className="shadow-sm print:shadow-none">
            <VehicleReservationSlip request={request} division={division} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
