import { VehicleRequest } from "../../types";
import HsacLogo from "../HsacLogo";

/** The controlled form number printed top-right on the official slip. */
const FORM_CODE = "AS-GSD.VRS.012.02";

interface Props {
  request: VehicleRequest;
  /** The requesting employee's division, which the slip prints but the request never stores. */
  division?: string;
}

/** "2026-09-24" -> "September 24, 2026". Blank stays blank; the slip is signed on paper. */
function longDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** "14:30" -> "2:30 PM". The printed form asks for AM/PM explicitly. */
function clockTime(hhmm?: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (!isFinite(h) || !isFinite(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** A ruled blank the office writes on when the system has nothing to print. */
function Ruled({ value }: { value?: string }) {
  return value
    ? <span className="font-semibold text-slate-900">{value}</span>
    : <span className="inline-block min-w-[7rem] border-b border-slate-800 align-bottom">&nbsp;</span>;
}

/**
 * The HSAC Vehicle Reservation Slip, print-faithful.
 *
 * Both signature boxes carry the SAME name: whoever holds Administrator / Division Chief
 * and approved the request. The form names two titles, but at RAB 1 one person signs
 * both, and any admin may do it — so the name always comes from `approvedBy` rather than
 * being hardcoded. Before approval both boxes print blank, because an unapproved slip has
 * no signatory.
 */
export default function VehicleReservationSlip({ request, division }: Props) {
  const signatory = request.approvedBy || "";

  return (
    <div id="vrs-print-root" className="mx-auto w-full max-w-3xl bg-white p-8 text-[11px] text-slate-900">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <HsacLogo size={40} />
          <div className="leading-tight">
            <p className="text-[10px]">Republic of the Philippines</p>
            <p className="text-[12px] font-bold uppercase tracking-tight">Human Settlements Adjudication Commission</p>
            <p className="text-[9px] italic">Komisyon sa Adhudikasyon para sa Pananahanang Pantao</p>
            <p className="text-[9px] font-bold uppercase text-slate-700">Regional Adjudication Branch No. I</p>
          </div>
        </div>
        <p className="shrink-0 font-mono text-[10px] font-semibold">{FORM_CODE}</p>
      </div>

      <table className="w-full border-collapse border border-slate-800">
        <tbody>
          <tr>
            <td className="w-1/2 border border-slate-800 px-3 py-3 text-center align-middle">
              <span className="text-[13px] font-bold uppercase tracking-wide">Vehicle Reservation Slip</span>
            </td>
            <td className="w-1/2 border border-slate-800 px-3 py-2 align-top">
              <p className="mb-2">VRS No.: <Ruled value={request.vrsNo} /></p>
              <p>Date: <Ruled value={longDate(request.dateRequested)} /></p>
            </td>
          </tr>
          <tr>
            <td className="border border-slate-800 px-3 py-2 align-top">
              Requesting Division: <Ruled value={division} />
            </td>
            <td className="border border-slate-800 px-3 py-2 align-top">
              Reservation date: <Ruled value={longDate(request.dateNeeded)} />
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-slate-800 px-3 py-2 align-top">
              <p className="mb-1">Destination:</p>
              <p className="min-h-[1.5rem] font-semibold">{request.destination || ""}</p>
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-slate-800 px-3 py-2 align-top">
              <p className="mb-1">Passenger (s):</p>
              <p className="min-h-[2.5rem] whitespace-pre-line font-semibold">{request.passengers || ""}</p>
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-slate-800 px-3 py-2 align-top">
              <p className="mb-1">Purpose:</p>
              <p className="min-h-[2.5rem] whitespace-pre-line font-semibold">{request.purpose || ""}</p>
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-slate-800 px-3 py-3 align-top">
              <div className="mb-2 flex justify-center gap-16 font-semibold">
                <span>Date:</span>
                <span>Time:</span>
              </div>
              <div className="space-y-2">
                <p className="flex items-end gap-3">
                  <span className="w-24">Departure:</span>
                  <Ruled value={longDate(request.departureDate)} />
                  <Ruled value={clockTime(request.departureTime)} />
                  <span className="text-[10px]">(AM/PM)</span>
                </p>
                <p className="flex items-end gap-3">
                  <span className="w-24">Arrival:</span>
                  <Ruled value={longDate(request.arrivalDate)} />
                  <Ruled value={clockTime(request.arrivalTime)} />
                  <span className="text-[10px]">(AM/PM)</span>
                </p>
              </div>
            </td>
          </tr>
          <tr>
            {/* One person signs both: the Admin / Division Chief who approved it. */}
            <td className="border border-slate-800 px-3 pb-2 pt-2 align-top">
              <p className="mb-8">Authorized by:</p>
              <p className="border-t border-slate-800 pt-1 text-center font-semibold">
                {signatory || <span className="text-slate-400">&nbsp;</span>}
              </p>
              <p className="text-center text-[10px]">Division Head</p>
            </td>
            <td className="border border-slate-800 px-3 pb-2 pt-2 align-top">
              <p className="mb-8">Approved by:</p>
              <p className="border-t border-slate-800 pt-1 text-center font-semibold">
                {signatory || <span className="text-slate-400">&nbsp;</span>}
              </p>
              <p className="text-center text-[10px]">Chief Administrative Officer</p>
            </td>
          </tr>
        </tbody>
      </table>

      {!signatory && (
        <p className="mt-2 text-[9px] italic text-slate-500 print:hidden">
          Signature lines stay blank until the Division Chief approves the request.
        </p>
      )}
    </div>
  );
}
