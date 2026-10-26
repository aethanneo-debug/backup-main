import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, HandCoins, Loader2, RefreshCw } from "lucide-react";
import { CashAdvance } from "../../types";
import { apiCall, firstTimestamp, formatCurrency, formatDate, getLocalTodayString } from "../../utils";
import { useRecordHighlight } from "../ui/useRecordHighlight";
import SectionCard, { SectionCount } from "../ui/SectionCard";

interface Props {
  /** From a notification: the request to show, scrolled to and outlined once loaded. */
  focus?: { id: string; nonce: number } | null;
  /** Called once the focus is taken, so coming back to the desk later doesn't show it again. */
  onFocusHandled?: () => void;
  /** After a release or decline, so the Cash Advance Desk below reloads too. */
  onChanged?: () => void;
}

const INPUT = "w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100";

/**
 * Employees' requests for their seminar's cash advance (the seminar budget flow, decision 3):
 * Finance releases one with its disbursement voucher, or declines it saying why. The amount is
 * the employee's allowance, set by the server, so it is shown, not typed. A group's request is one
 * row (HSAC RAB 1): the one who asked, everyone it covers and the total. Newest first.
 */
export default function AdvanceRequestsList({ focus, onFocusHandled, onChanged }: Props) {
  const [requests, setRequests] = useState<CashAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Loads finished, so a request opened from a notice is shown only from fresh data.
  const [loads, setLoads] = useState(0);
  const [shown, setShown] = useState<{ id: string; key: number; afterLoad: number } | null>(null);

  // The request being acted on, and its form.
  const [acting, setActing] = useState<{ id: string; kind: "release" | "decline" } | null>(null);
  const [dvNo, setDvNo] = useState("");
  const [dvDate, setDvDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  // A refusal whose request has since left the list (e.g. HR marked the employee absent, which
  // closed it): its row is gone, so the server's reason shows here instead.
  const [refusal, setRefusal] = useState("");

  // The requests still waiting, newest first; returns them (null when the load failed).
  const load = useCallback(async (): Promise<CashAdvance[] | null> => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiCall("/api/cash-advances");
      if (res?.status !== "success") throw new Error(res?.message || "Could not load the requests.");
      const waiting = ((res.data ?? []) as CashAdvance[])
        .filter(a => a && a.status === "Requested")
        .sort((a, b) => firstTimestamp(b.requestedAt) - firstTimestamp(a.requestedAt));
      setRequests(waiting);
      return waiting;
    } catch (err: any) {
      setLoadError(err?.message || "Could not load the requests.");
      return null;
    } finally {
      setLoading(false);
      setLoads(n => n + 1);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // A notification opened this desk on a request: reload (unless the first load, started after
  // the click, is still on its way), then show it.
  useEffect(() => {
    if (!focus) return;
    setShown({ id: focus.id, key: focus.nonce, afterLoad: loads });
    if (loads > 0) load();
    onFocusHandled?.();
  }, [focus?.nonce]);
  const fresh = !!shown && loads > shown.afterLoad && !loading;
  useRecordHighlight(fresh ? shown!.id : null, shown?.key);
  const alreadyHandled = fresh && !loadError && !requests.some(r => r.id === shown!.id);

  function open(id: string, kind: "release" | "decline") {
    setActing({ id, kind });
    setDvNo("");
    setDvDate(getLocalTodayString());
    setReason("");
    setFormError("");
    setNotice("");
    setRefusal("");
  }

  async function submit(request: CashAdvance) {
    if (!acting) return;
    setFormError("");
    if (acting.kind === "release" && (!dvNo.trim() || !dvDate)) {
      setFormError("Enter the disbursement voucher number and its date.");
      return;
    }
    if (acting.kind === "decline" && !reason.trim()) {
      setFormError("Say why the request is declined; the employee sees it.");
      return;
    }
    setSaving(true);
    try {
      // A group's total can change while the form is open (someone leaves): the server releases only
      // the amount shown here, and otherwise says what it is now, so the voucher matches the record.
      const groupTotal = (request.covers ?? []).length > 1 ? { expectedAmount: Number(request.amount) } : {};
      const res = await apiCall(`/api/cash-advances/${encodeURIComponent(request.id)}/${acting.kind}`, {
        method: "POST",
        body: JSON.stringify(acting.kind === "release" ? { dvNo: dvNo.trim(), dvDate, ...groupTotal } : { reason: reason.trim() })
      });
      if (res?.status !== "success") throw new Error(res?.message || "That didn't go through.");
      setActing(null);
      setNotice(res.message || (acting.kind === "release" ? "Released." : "Declined."));
      await load();
      onChanged?.();
    } catch (err: any) {
      // apiCall throws with the server's reason (e.g. the employee was since marked absent).
      const message = err?.message || "That didn't go through.";
      setFormError(message);
      const waiting = await load();
      if (waiting && !waiting.some(r => r.id === request.id)) {
        setActing(null);
        setRefusal(`${request.employeeName}'s request is no longer waiting. ${message}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={<HandCoins size={12} className="text-blue-600" aria-hidden="true" />}
      title="Cash Advance Requests"
      action={<SectionCount>{requests.length} waiting</SectionCount>}
      caption="Requests"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[11px] text-slate-500">
          Employees ask for their seminar&rsquo;s cash advance here. The amount is their allowance (the seminar&rsquo;s
          allocation divided by its seats), so it can&rsquo;t be changed: release it with the disbursement voucher, or
          decline it and say why.
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          aria-label="Reload the requests"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden="true" />
        </button>
      </div>

      <div role="status" aria-live="polite">
        {notice && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
            <BadgeCheck size={13} className="shrink-0" aria-hidden="true" /> {notice}
          </p>
        )}
        {alreadyHandled && (
          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            That request is no longer waiting: it was already released or declined.
          </p>
        )}
      </div>
      {refusal && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {refusal}
        </p>
      )}

      {loadError && (
        <p className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          <span className="flex gap-2"><AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />{loadError}</span>
          <button type="button" onClick={load} className="shrink-0 cursor-pointer font-semibold underline">Retry</button>
        </p>
      )}

      {loading && requests.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading requests…
        </div>
      ) : requests.length === 0 ? (
        !loadError && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
            <BadgeCheck size={13} className="shrink-0" aria-hidden="true" />
            No requests waiting.
          </p>
        )
      ) : (
        <ul className="space-y-3">
          {requests.map(r => {
            const form = acting?.id === r.id ? acting.kind : null;
            return (
              <li key={r.id} data-record-id={r.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-xs font-bold text-slate-800">{r.employeeName}</h3>
                    <p className="truncate text-[11px] text-slate-500">{r.activityTitle}</p>
                    {/* A group advance (HSAC RAB 1): one request, released to the one who asked. */}
                    {(r.covers ?? []).length > 1 && (
                      <p className="text-[11px] text-slate-600">
                        <span className="font-semibold">One advance for {r.covers!.length}:</span>{" "}
                        {r.covers!.map(c => `${c.employeeName} (${formatCurrency(Number(c.amount))})`).join(", ")}
                      </p>
                    )}
                    <p className="font-mono text-[10px] text-slate-400">Asked on {formatDate(String(r.requestedAt || ""))}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="rounded border border-slate-100 bg-white p-2 text-right">
                      <span className="block font-mono text-[9px] font-semibold text-slate-400">{(r.covers ?? []).length > 1 ? "Allowances asked for" : "Allowance asked for"}</span>
                      <strong className="font-mono text-xs text-slate-800">{formatCurrency(Number(r.amount))}</strong>
                    </div>
                    {!form && (
                      <>
                        <button
                          type="button"
                          onClick={() => open(r.id, "decline")}
                          className="cursor-pointer rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          Decline<span className="sr-only"> {r.employeeName}&rsquo;s request</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => open(r.id, "release")}
                          className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
                        >
                          Release<span className="sr-only"> {r.employeeName}&rsquo;s advance</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {form && (
                  <div className="space-y-3 border-t border-slate-200 pt-3">
                    {form === "release" && (r.covers ?? []).length > 1 && (
                      <p className="max-w-xl text-[11px] text-slate-500">
                        Each person is checked again when you release it: anyone who no longer qualifies (marked absent,
                        no longer active, covered or reported elsewhere) is left out, and the total follows the allowances as they are now.
                      </p>
                    )}
                    {form === "release" ? (
                      <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label htmlFor={`rq-dv-${r.id}`} className="font-mono text-[10px] font-bold uppercase text-slate-400">Disbursement Voucher No.</label>
                          <input id={`rq-dv-${r.id}`} type="text" value={dvNo} maxLength={50} disabled={saving} onChange={e => setDvNo(e.target.value)} placeholder="e.g. 2026-08-336" aria-describedby={`rq-dv-hint-${r.id}`} className={INPUT} />
                          <p id={`rq-dv-hint-${r.id}`} className="font-mono text-[9px] text-slate-400">Type the number on the voucher</p>
                        </div>
                        <div className="space-y-1">
                          <label htmlFor={`rq-dvd-${r.id}`} className="font-mono text-[10px] font-bold uppercase text-slate-400">Voucher Date</label>
                          <input id={`rq-dvd-${r.id}`} type="date" value={dvDate} max={getLocalTodayString()} disabled={saving} onChange={e => setDvDate(e.target.value)} className={INPUT} />
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-xl space-y-1">
                        <label htmlFor={`rq-why-${r.id}`} className="font-mono text-[10px] font-bold uppercase text-slate-400">Why it is declined (the employee sees this)</label>
                        <textarea id={`rq-why-${r.id}`} value={reason} maxLength={500} disabled={saving} onChange={e => setReason(e.target.value)} className={`${INPUT} h-16 resize-none font-sans`} />
                      </div>
                    )}

                    {formError && (
                      <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {formError}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => submit(r)}
                        disabled={saving}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          form === "release" ? "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-350" : "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
                        }`}
                      >
                        {saving && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                        {form === "release"
                          ? saving ? "Releasing…" : `Release ${formatCurrency(Number(r.amount))}`
                          : saving ? "Declining…" : "Decline request"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActing(null); setFormError(""); }}
                        disabled={saving}
                        className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
