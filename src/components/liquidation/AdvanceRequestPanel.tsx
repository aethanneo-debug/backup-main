import { useState, type ReactNode } from "react";
import { Banknote, Car, Loader2, Users } from "lucide-react";
import { CashAdvance, type LinkedVehicleSummary } from "../../types";
import { apiCall, formatCurrency, formatDate, getLocalTodayString } from "../../utils";
import { advancesCovering, isGroupAdvance, portionCentavos } from "../../advanceCoverage";
import { vehicleDraftFor, vehicleWithAdvanceFields, type SeminarForVehicle, type VehicleDraft } from "../../vehicleWithAdvance";
import GroupCoverPicker from "./GroupCoverPicker";
import VehicleWithAdvance from "./VehicleWithAdvance";

/**
 * The cash-advance record that stands for a seminar now, as the server picks it: a request
 * waiting for Finance, the advance released, or else the latest one. Its own, or a group advance a
 * co-participant holds that covers it (src/advanceCoverage.ts).
 */
export function currentAdvanceOf(advances: CashAdvance[] | null | undefined, activityId: string): CashAdvance | null {
  const list = advancesCovering(advances ?? [], activityId);
  // Its latest event: a refund or settlement comes after the release.
  const when = (a: CashAdvance) => String(a.refundedAt || a.liquidatedAt || a.decidedAt || a.issuedAt || a.requestedAt || "");
  return list.find(a => a.status === "Requested") || list.find(a => a.status === "Released")
    || [...list].sort((a, b) => when(b).localeCompare(when(a)))[0] || null;
}

interface Props {
  activityId: string;
  /** The employee's allowance for the seminar (allocation ÷ seats): the amount asked for. */
  allowance: number;
  /** From the server (advanceRequestEligibility): whether a request can be sent now, and why not. */
  canRequest: boolean;
  blockedReason?: string | null;
  /** The seminar's current cash-advance record, if any (currentAdvanceOf). */
  advance: CashAdvance | null;
  /** The report a co-participant filed on the group advance covering this seminar: number and status only. */
  groupReport?: { submissionNo: string; status: string; filedBy?: string } | null;
  /** The seminar and the employee's own name: "Also request a vehicle" starts from them. */
  seminar?: SeminarForVehicle;
  selfName?: string;
  /** The vehicle request already filed for this seminar and not rejected: no second one is offered. */
  vehicleOnFile?: LinkedVehicleSummary | null;
  /** After a request is sent (or a group request left): the server's message, for the page to show and reload. */
  onRequested: (message: string) => void;
}

/**
 * On an employee's seminar card (the seminar budget flow): ask Finance for the cash advance,
 * then follow it (waiting, released with its DV, declined and why, settled). The amount is the
 * allowance, set by the server; the employee only asks. Attending together, one participant may
 * ask for one advance for the group (HSAC RAB 1, 2026-10-26): they hold it, and the card of
 * everyone it covers says so.
 */
export default function AdvanceRequestPanel({ activityId, allowance, canRequest, blockedReason, advance, groupReport, seminar, selfName, vehicleOnFile, onRequested }: Props) {
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  // "Also request a vehicle" (HSAC RAB 1): filed with the request, prefilled from the seminar. Not
  // offered while one stands for this seminar, and then never sent, even if it was ticked before the
  // card reloaded (a hidden box would send a trip nobody can see or untick).
  const [withVehicle, setWithVehicle] = useState(false);
  const freshDraft = () => vehicleDraftFor(seminar ?? {}, selfName ? [selfName] : []);
  const [vehicle, setVehicle] = useState<VehicleDraft>(freshDraft);
  const offerVehicle = !vehicleOnFile;
  const sendVehicle = offerVehicle && withVehicle;
  const shownVehicle = advance?.vehicle ?? vehicleOnFile ?? null;

  // Ticking it starts from the seminar as it is now (HR may have moved its dates since the card loaded).
  function toggleVehicle(on: boolean) {
    setWithVehicle(on);
    if (on) setVehicle(freshDraft());
  }

  async function request() {
    setError("");
    // The same checks as the server's, so a mistake in the trip is shown before anything is sent.
    if (sendVehicle) {
      const checked = vehicleWithAdvanceFields(vehicle, getLocalTodayString(), seminar);
      if ("error" in checked) { setError(checked.error); return; }
    }
    setSending(true);
    try {
      const res = await apiCall("/api/cash-advances/request", {
        method: "POST",
        body: JSON.stringify({ activityId, ...(sendVehicle ? { vehicle } : {}) })
      });
      if (res?.status !== "success") throw new Error(res?.message || "The request could not be sent.");
      setWithVehicle(false);
      onRequested(res.message || "Your request was sent to Finance.");
    } catch (err: any) {
      setError(err?.message || "The request could not be sent.");
    } finally {
      setSending(false);
    }
  }

  // A covered member leaves a group request Finance hasn't released, to ask for their own.
  async function leave(group: CashAdvance) {
    if (!window.confirm(`Leave ${group.employeeName}'s group cash advance request? You can then ask Finance for your own.`)) return;
    setSending(true);
    setError("");
    try {
      const res = await apiCall(`/api/cash-advances/${encodeURIComponent(group.id)}/leave`, { method: "POST" });
      if (res?.status !== "success") throw new Error(res?.message || "That didn't go through.");
      onRequested(res.message || "You left the group's request.");
    } catch (err: any) {
      setError(err?.message || "That didn't go through.");
    } finally {
      setSending(false);
    }
  }

  const status = advance?.status;
  const group = advance && isGroupAdvance(advance) ? advance : null;
  // Covered by a co-participant's group advance, rather than holding it.
  const covered = !!group && group.activityId !== activityId;
  const share = group ? portionCentavos(group, activityId) / 100 : 0;
  const others = group ? (group.covers || []).filter(c => c.participantId !== group.activityId).map(c => c.employeeName) : [];
  const groupLine = group && !covered ? ` for your group of ${(group.covers || []).length} (you, ${others.join(", ")})` : "";

  return (
    <div className="space-y-2 border-t border-slate-100 pt-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-mono text-[10px] uppercase text-slate-400">
          {group ? <Users size={11} aria-hidden="true" /> : <Banknote size={11} aria-hidden="true" />}
          {group ? "Group Cash Advance" : "Cash Advance"}
        </span>
        {status === "Requested" && <Pill tone="amber">Waiting for Finance</Pill>}
        {status === "Released" && <Pill tone="blue">Released</Pill>}
        {status === "Liquidated" && <Pill tone="emerald">Liquidated</Pill>}
        {status === "Declined" && <Pill tone="rose">Declined</Pill>}
        {status === "Refunded" && <Pill tone="slate">Refunded</Pill>}
      </div>

      {covered ? (
        <>
          {status === "Requested" && (
            <p className="text-[11px] text-slate-600">
              <strong>{group!.employeeName}</strong> asked Finance on {formatDate(String(group!.requestedAt || ""))} for one cash advance for
              your group ({formatCurrency(Number(group!.amount))}), <strong>{formatCurrency(share)}</strong> of it for you, so you
              don&rsquo;t need to ask for your own.
            </p>
          )}
          {status === "Released" && (
            <p className="text-[11px] text-slate-600">
              <strong>{group!.employeeName}</strong> holds your group&rsquo;s cash advance {group!.advanceNo} (DV {group!.dvNo} dated{" "}
              {formatDate(group!.dvDate)}): <strong>{formatCurrency(share)}</strong> of {formatCurrency(Number(group!.amount))} is for you.
              {" "}{group!.employeeName} files the group&rsquo;s liquidation report, so give them your receipts.
            </p>
          )}
          {status === "Liquidated" && (
            <p className="text-[11px] text-slate-600">{group!.advanceNo} was settled by {group!.employeeName}&rsquo;s group liquidation report.</p>
          )}
          {status === "Refunded" && (
            <p className="text-[11px] text-slate-600">{group!.advanceNo} was refunded in full by {group!.employeeName}.</p>
          )}
          {status === "Declined" && (
            <p className="text-[11px] text-rose-700">
              Finance declined {group!.employeeName}&rsquo;s group request on {formatDate(String(group!.decidedAt || ""))}
              {group!.declineReason ? <>: &ldquo;{group!.declineReason}&rdquo;</> : "."}
            </p>
          )}
          {groupReport && (
            <p className="text-[11px] text-slate-600">
              Group report <span className="font-mono">{groupReport.submissionNo}</span>: {groupReport.status}
              {groupReport.filedBy ? `, filed by ${groupReport.filedBy}` : ""}.
            </p>
          )}
          {status === "Requested" && (
            <button
              type="button"
              onClick={() => leave(group!)}
              disabled={sending}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
              Leave this group request
            </button>
          )}
        </>
      ) : (
        <>
          {status === "Requested" && (
            <p className="text-[11px] text-slate-600">
              You asked for <strong>{formatCurrency(Number(advance!.amount))}</strong>{groupLine} on {formatDate(String(advance!.requestedAt || ""))}.
              Finance will release it with a disbursement voucher, or tell you why not.
            </p>
          )}
          {status === "Released" && (
            <p className="text-[11px] text-slate-600">
              <strong>{formatCurrency(Number(advance!.amount))}</strong> released on {advance!.advanceNo}, DV {advance!.dvNo} dated{" "}
              {formatDate(advance!.dvDate)}{groupLine}. Your liquidation report&rsquo;s items can&rsquo;t go past it; hand back whatever
              {group ? " the group doesn’t spend" : " you don’t spend"}.
            </p>
          )}
          {status === "Liquidated" && (
            <p className="text-[11px] text-slate-600">{advance!.advanceNo} ({formatCurrency(Number(advance!.amount))}) was settled by your liquidation report.</p>
          )}
          {status === "Declined" && (
            <p className="text-[11px] text-rose-700">
              Finance declined your {formatCurrency(Number(advance!.amount))} request on {formatDate(String(advance!.decidedAt || ""))}
              {advance!.declineReason ? <>: &ldquo;{advance!.declineReason}&rdquo;</> : "."}
            </p>
          )}
          {status === "Refunded" && (
            <p className="text-[11px] text-slate-600">
              {advance!.advanceNo} was refunded in full{advance!.refundOrNo ? ` (OR ${advance!.refundOrNo})` : ""}.
            </p>
          )}
        </>
      )}

      {/* The vehicle request filed with it, else the one still standing for this seminar (filed with
          an earlier, declined request), decided by the Division Chief on its own. */}
      {shownVehicle && (
        <p className="flex items-center gap-1 text-[11px] text-slate-600">
          <Car size={12} className="shrink-0 text-slate-500" aria-hidden="true" />
          {/* One flex item, so the gap doesn't split "VRS-…: status". */}
          <span>Vehicle request <span className="font-mono">{shownVehicle.vrsNo || ""}</span>: {shownVehicle.status}</span>
        </p>
      )}

      {canRequest && !picking ? (
        <div className="space-y-2">
          {/* Above the buttons, so it is seen before either is pressed; "For my group…" carries it over. */}
          {offerVehicle && (
            <VehicleWithAdvance idPrefix={activityId} on={withVehicle} onToggle={toggleVehicle} draft={vehicle} onChange={setVehicle} disabled={sending} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={request}
              disabled={sending}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
              {sending ? "Sending…" : `${status === "Declined" || status === "Refunded" ? "Ask again" : "Request cash advance"}: ${formatCurrency(allowance)}`}
            </button>
            <button
              type="button"
              onClick={() => { setError(""); setPicking(true); }}
              disabled={sending}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
            >
              <Users size={12} aria-hidden="true" /> For my group…
            </button>
          </div>
        </div>
      ) : canRequest && picking ? (
        <GroupCoverPicker
          activityId={activityId}
          seminar={seminar}
          selfName={selfName}
          offerVehicle={offerVehicle}
          initialVehicle={sendVehicle ? vehicle : undefined}
          onRequested={message => { setPicking(false); setWithVehicle(false); onRequested(message); }}
          onCancel={() => setPicking(false)}
        />
      ) : !advance && blockedReason ? (
        <p className="text-[10px] italic text-slate-500">{blockedReason}</p>
      ) : null}

      {error && <p role="alert" className="text-[11px] font-semibold text-rose-700">{error}</p>}
    </div>
  );
}

function Pill({ tone, children }: { tone: "amber" | "blue" | "emerald" | "rose" | "slate"; children: ReactNode }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200"
  };
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${tones[tone]}`}>{children}</span>;
}
