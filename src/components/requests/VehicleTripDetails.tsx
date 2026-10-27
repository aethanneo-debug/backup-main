import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { RequestType, type VehicleRequestView } from "../../types";
import { formatDate } from "../../utils";
import { clockTime } from "./VehicleReservationSlip";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] font-bold uppercase text-slate-400">{label}</p>
      <div className="text-slate-700">{children}</div>
    </div>
  );
}

/**
 * A vehicle request's trip (its slip number, departure and arrival), and, when it was filed with a
 * seminar's cash advance (HSAC RAB 1: "Yes, pwede"), the seminar and the advance it goes with, as far
 * as the viewer may see them. The two are decided separately: the Division Chief the vehicle, Finance
 * the advance.
 */
export default function VehicleTripDetails({ item }: { item: Partial<VehicleRequestView> | null | undefined }) {
  if (!item || item.requestType !== RequestType.VEHICLE) return null;
  const when = (date?: string, time?: string) => [date ? formatDate(date) : "", clockTime(time)].filter(Boolean).join(", ");
  const seminar = item.linkedSeminar;
  const advance = item.linkedAdvance;
  return (
    <>
      {item.vrsNo && <Field label="VRS No.">{item.vrsNo}</Field>}
      {(item.departureDate || item.departureTime) && <Field label="Departure">{when(item.departureDate, item.departureTime)}</Field>}
      {(item.arrivalDate || item.arrivalTime) && <Field label="Arrival Back">{when(item.arrivalDate, item.arrivalTime)}</Field>}
      {seminar && (
        <Field label="For Seminar">
          {seminar.title}
          {seminar.startDate ? ` (${formatDate(seminar.startDate)}${seminar.endDate && seminar.endDate !== seminar.startDate ? ` to ${formatDate(seminar.endDate)}` : ""})` : ""}
          {seminar.tripProblem && (
            <p role="note" className="mt-1 flex items-start gap-1 font-semibold text-rose-700">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>The trip may be off: {seminar.tripProblem}</span>
            </p>
          )}
        </Field>
      )}
      {advance && (
        <Field label="Filed With Cash Advance">
          {advance.advanceNo
            ? `${advance.advanceNo}: ${advance.status}.`
            : advance.status === "Declined"
              ? "Cash advance request declined."
              : advance.status === "Requested" ? "Cash advance requested, not yet released." : `Cash advance: ${advance.status}.`}
          {" "}Finance decides the cash advance; the Division Chief decides the vehicle.
        </Field>
      )}
    </>
  );
}
