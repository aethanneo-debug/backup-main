import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Users } from "lucide-react";
import { apiCall, formatCurrency, getLocalTodayString } from "../../utils";
import { sumPesos } from "../../liquidationMoney";
import { vehicleDraftFor, vehicleWithAdvanceFields, type SeminarForVehicle, type VehicleDraft } from "../../vehicleWithAdvance";
import { cleanText } from "../../inputText";
import VehicleWithAdvance from "./VehicleWithAdvance";

interface GroupOption {
  participantId: string;
  employeeName: string;
  /** Their allowance; sent only for someone who can be covered. */
  allowance: number | null;
  canCover: boolean;
  /** Why they can't be covered now, from the server. */
  reason: string | null;
}

interface Props {
  activityId: string;
  /** The seminar and the holder's own name: "Also request a vehicle" starts from them. */
  seminar?: SeminarForVehicle;
  selfName?: string;
  /** False when a vehicle request for this seminar still stands (filed with an earlier request). */
  offerVehicle?: boolean;
  /** The trip already filled in on the card before "For my group…" was pressed: it starts ticked. */
  initialVehicle?: VehicleDraft;
  /** After the request is sent: the server's message, for the page to show and reload. */
  onRequested: (message: string) => void;
  onCancel: () => void;
}

/**
 * "For my group" on a seminar card (HSAC RAB 1, 2026-10-26: participants who attend together may
 * have one cash advance processed for all of them). The one asking holds it: they receive the
 * cash, file the group's one liquidation report and hand back the one leftover. Everyone who can
 * be covered starts ticked; each share is that person's allowance, set by the server.
 */
export default function GroupCoverPicker({ activityId, seminar, selfName, offerVehicle = true, initialVehicle, onRequested, onCancel }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [own, setOwn] = useState(0);
  const [options, setOptions] = useState<GroupOption[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // "Also request a vehicle" (HSAC RAB 1): its passengers follow the people ticked, until typed by hand.
  // Never sent while it isn't offered (a vehicle request for this seminar stands).
  const [withVehicle, setWithVehicle] = useState(!!initialVehicle);
  const [vehicle, setVehicle] = useState<VehicleDraft>(() => initialVehicle ?? vehicleDraftFor(seminar ?? {}, selfName ? [selfName] : []));
  // Passengers typed on the card (anything but the holder's own name) are kept, not replaced by the ticks.
  const [passengersEdited, setPassengersEdited] = useState(() => !!initialVehicle && initialVehicle.passengers !== cleanText(selfName));
  const sendVehicle = offerVehicle && withVehicle;

  // Ticking it starts from the seminar as it is now, with the people ticked as passengers (the effect
  // below only follows later changes to the ticks).
  function toggleVehicle(on: boolean) {
    setWithVehicle(on);
    if (on) {
      setVehicle(vehicleDraftFor(seminar ?? {}, [selfName || "", ...chosen.map(o => o.employeeName)]));
      setPassengersEdited(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await apiCall(`/api/cash-advances/group-options?activityId=${encodeURIComponent(activityId)}`);
        if (!alive) return;
        const data = res?.data;
        if (!data?.canRequest) throw new Error(data?.reason || "You can't ask for a cash advance for this seminar now.");
        const list: GroupOption[] = Array.isArray(data.options) ? data.options : [];
        setOwn(Number(data.ownAllowance) || 0);
        setOptions(list);
        setPicked(new Set(list.filter(o => o.canCover).map(o => o.participantId)));
      } catch (err: any) {
        if (alive) setLoadError(err?.message || "Could not load your co-participants.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [activityId]);

  const chosen = useMemo(() => (options ?? []).filter(o => o.canCover && picked.has(o.participantId)), [options, picked]);
  const total = useMemo(() => sumPesos([own, ...chosen.map(o => o.allowance)]), [own, chosen]);
  const passengerNames = useMemo(() => [selfName || "", ...chosen.map(o => o.employeeName)].filter(Boolean).join(", "), [selfName, chosen]);
  useEffect(() => {
    if (!passengersEdited) setVehicle(v => (v.passengers === passengerNames ? v : { ...v, passengers: passengerNames }));
  }, [passengerNames, passengersEdited]);

  function toggle(id: string) {
    setError("");
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function send() {
    if (chosen.length === 0) {
      setError("Tick at least one co-participant, or ask for your own cash advance instead.");
      return;
    }
    // The same checks as the server's, so a mistake in the trip is shown before anything is sent.
    if (sendVehicle) {
      const checked = vehicleWithAdvanceFields(vehicle, getLocalTodayString(), seminar);
      if ("error" in checked) { setError(checked.error); return; }
    }
    setSending(true);
    setError("");
    try {
      const res = await apiCall("/api/cash-advances/request", {
        method: "POST",
        body: JSON.stringify({ activityId, coverParticipantIds: chosen.map(o => o.participantId), ...(sendVehicle ? { vehicle } : {}) })
      });
      if (res?.status !== "success") throw new Error(res?.message || "The request could not be sent.");
      onRequested(res.message || "Your group's request was sent to Finance.");
    } catch (err: any) {
      // apiCall throws with the server's reason (e.g. someone was since marked absent).
      setError(err?.message || "The request could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const listId = `group-cover-${activityId}`;
  return (
    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/40 p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
        <Users size={12} className="text-blue-700" aria-hidden="true" /> One cash advance for your group
      </p>
      <p className="text-[10px] leading-snug text-slate-600">
        You receive the cash for everyone you tick, file the group&rsquo;s one liquidation report, and hand back
        what is left with one OR. Each person&rsquo;s share is their allowance.
      </p>

      {loading ? (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Loading your co-participants…
        </p>
      ) : loadError ? (
        <p role="alert" className="flex items-start gap-1.5 text-[11px] text-rose-700">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {loadError}
        </p>
      ) : options.length === 0 ? (
        <p className="text-[11px] italic text-slate-500">Nobody else is enrolled in this seminar.</p>
      ) : (
        <fieldset className="space-y-1">
          <legend className="font-mono text-[10px] font-bold uppercase text-slate-400">Who it covers, besides you</legend>
          <ul id={listId} className="space-y-1">
            {options.map(o => {
              const id = `${listId}-${o.participantId}`;
              return (
                <li key={o.participantId} className="flex items-start gap-2 text-[11px]">
                  <input
                    id={id}
                    type="checkbox"
                    checked={o.canCover && picked.has(o.participantId)}
                    disabled={!o.canCover || sending}
                    onChange={() => toggle(o.participantId)}
                    aria-describedby={o.reason ? `${id}-why` : undefined}
                    className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
                  />
                  <label htmlFor={id} className={o.canCover ? "cursor-pointer text-slate-700" : "text-slate-400"}>
                    {o.employeeName}{" "}
                    {o.canCover && o.allowance !== null && <span className="font-mono text-slate-500">{formatCurrency(o.allowance)}</span>}
                    {o.reason && <span id={`${id}-why`} className="block text-[10px] italic text-slate-500">{o.reason}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {!loading && !loadError && (
        <p className="text-[11px] text-slate-700" aria-live="polite">
          You and {chosen.length} other{chosen.length === 1 ? "" : "s"}: <strong className="font-mono">{formatCurrency(total)}</strong>
        </p>
      )}
      {offerVehicle && !loading && !loadError && options.some(o => o.canCover) && (
        <VehicleWithAdvance
          idPrefix={`group-${activityId}`}
          on={withVehicle}
          onToggle={toggleVehicle}
          draft={vehicle}
          onChange={setVehicle}
          onPassengersEdited={() => setPassengersEdited(true)}
          disabled={sending}
        />
      )}
      {error && <p role="alert" className="text-[11px] font-semibold text-rose-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {!loading && !loadError && options.some(o => o.canCover) && (
          <button
            type="button"
            onClick={send}
            disabled={sending || chosen.length === 0}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
            {sending ? "Sending…" : `Request ${formatCurrency(total)} for ${chosen.length + 1}`}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
