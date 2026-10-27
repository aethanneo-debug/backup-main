import { Car } from "lucide-react";
import { getLocalTodayString } from "../../utils";
import type { VehicleDraft } from "../../vehicleWithAdvance";

interface Props {
  /** Prefix for the fields' ids (one form per seminar card). */
  idPrefix: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  draft: VehicleDraft;
  onChange: (next: VehicleDraft) => void;
  disabled?: boolean;
  /** Told when the passengers are typed by hand, so a group's ticks stop rewriting them. */
  onPassengersEdited?: () => void;
}

const LABEL = "block font-mono text-[10px] font-bold uppercase text-slate-400";
// Widths are added per field (one width class each), since a seminar card is narrow.
const BOX = "rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-slate-100";
const INPUT = `${BOX} w-full`;
const DATE = `${BOX} min-w-0 flex-1`;
const TIME = `${BOX} w-24 shrink-0`;

/**
 * "Also request a vehicle" on a seminar's cash advance request (HSAC RAB 1, 2026-10-26: the vehicle
 * request may be filed together with the cash advance). It files the usual Vehicle Request in the
 * same step, prefilled from the seminar and editable. The Division Chief decides it, apart from the
 * advance; the server checks it as src/vehicleWithAdvance.ts says.
 */
export default function VehicleWithAdvance({ idPrefix, on, onToggle, draft, onChange, disabled, onPassengersEdited }: Props) {
  const set = (patch: Partial<VehicleDraft>) => onChange({ ...draft, ...patch });
  const id = (name: string) => `${idPrefix}-vehicle-${name}`;
  const today = getLocalTodayString();
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-700">
        <input
          type="checkbox"
          checked={on}
          disabled={disabled}
          onChange={e => onToggle(e.target.checked)}
          className="h-3.5 w-3.5 cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
        />
        <Car size={12} className="text-slate-500" aria-hidden="true" />
        Also request a vehicle for this seminar
      </label>
      {on && (
        <fieldset className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
          <legend className="sr-only">Vehicle request</legend>
          <div>
            <label htmlFor={id("destination")} className={LABEL}>Destination</label>
            <input id={id("destination")} type="text" maxLength={200} value={draft.destination} disabled={disabled}
              onChange={e => set({ destination: e.target.value })} className={INPUT} />
          </div>
          <div>
            <label htmlFor={id("purpose")} className={LABEL}>Purpose</label>
            <input id={id("purpose")} type="text" maxLength={300} value={draft.purpose} disabled={disabled}
              onChange={e => set({ purpose: e.target.value })} className={INPUT} />
          </div>
          <div>
            <label htmlFor={id("departure-date")} className={LABEL}>Departure</label>
            <div className="flex gap-1">
              <input id={id("departure-date")} type="date" min={today} value={draft.departureDate} disabled={disabled} aria-label="Departure date"
                onChange={e => set({ departureDate: e.target.value })} className={DATE} />
              <input id={id("departure-time")} type="time" value={draft.departureTime} disabled={disabled} aria-label="Departure time"
                onChange={e => set({ departureTime: e.target.value })} className={TIME} />
            </div>
          </div>
          <div>
            <label htmlFor={id("arrival-date")} className={LABEL}>Arrival back</label>
            <div className="flex gap-1">
              <input id={id("arrival-date")} type="date" min={draft.departureDate || today} value={draft.arrivalDate} disabled={disabled} aria-label="Arrival date"
                onChange={e => set({ arrivalDate: e.target.value })} className={DATE} />
              <input id={id("arrival-time")} type="time" value={draft.arrivalTime} disabled={disabled} aria-label="Arrival time"
                onChange={e => set({ arrivalTime: e.target.value })} className={TIME} />
            </div>
          </div>
          <div>
            <label htmlFor={id("passengers")} className={LABEL}>Passengers</label>
            <textarea id={id("passengers")} rows={2} maxLength={500} value={draft.passengers} disabled={disabled}
              onChange={e => { onPassengersEdited?.(); set({ passengers: e.target.value }); }} className={`${INPUT} resize-none`} />
          </div>
          <p className="text-[10px] text-slate-500">
            It goes to the Division Chief as a Vehicle Request with its own slip number, and is decided apart from the cash advance.
          </p>
        </fieldset>
      )}
    </div>
  );
}
