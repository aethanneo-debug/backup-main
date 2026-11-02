import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BadgeCheck, HandCoins, Loader2, RefreshCw } from "lucide-react";
import { CashAdvance } from "../../types";
import { apiCall, formatCurrency, getLocalTodayString } from "../../utils";
import { useRecordHighlight } from "../ui/useRecordHighlight";
import SectionCard, { SectionCount } from "../ui/SectionCard";
import ModalDialog from "../ui/ModalDialog";
import { DataTable, TablePager, TableSearch, ViewButton } from "../ui/DataTable";
import { useTableView } from "../ui/useTableView";
import { dvNumberFrom, dvPrefix, readDvNumber } from "../../dvNumber";
import { REQUEST_COLUMNS, REQUEST_SORTS, RequestFacts, groupOf, requestSearchText } from "./advanceRequestColumns";
import DvNumberFields from "./DvNumberFields";

interface Props {
  /** From a notification: the request to show, in its window, once loaded. */
  focus?: { id: string; nonce: number } | null;
  /** Called once the focus is taken, so coming back to the desk later doesn't show it again. */
  onFocusHandled?: () => void;
  /** After a release or decline, so the Cash Advance Desk below reloads too. */
  onChanged?: () => void;
}

const INPUT = "w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100";
const BUTTON = "cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 focus-visible:ring-blue-500`;

/**
 * Employees' requests for their seminar's cash advance (the seminar budget flow, decision 3):
 * Finance releases one with its disbursement voucher, or declines it saying why. The amount is
 * the employee's allowance, set by the server, so it is shown, not typed. A group's request is one
 * row (HSAC RAB 1): the one who asked; its window has everyone it covers and the total. Newest first.
 */
export default function AdvanceRequestsList({ focus, onFocusHandled, onChanged }: Props) {
  const [requests, setRequests] = useState<CashAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Loads finished, so a request opened from a notice is shown only from fresh data.
  const [loads, setLoads] = useState(0);
  const [shown, setShown] = useState<{ id: string; key: number; afterLoad: number } | null>(null);
  const [alreadyHandled, setAlreadyHandled] = useState(false);

  // The request in its window (read from the list by id, so a reload refreshes it), and its form.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewed = useMemo(() => requests.find(r => r.id === viewingId) ?? null, [requests, viewingId]);
  const [acting, setActing] = useState<{ id: string; kind: "release" | "decline" } | null>(null);
  // The voucher's date and its serial: the number is YYYY-MM-NNNN, its year and month the date's.
  const [dvSerial, setDvSerial] = useState("");
  // An amount the server said has changed since the request (HR re-priced it, or someone left a
  // group), once shown to Finance: the release then goes out at that amount.
  const [amountSeen, setAmountSeen] = useState<Record<string, number>>({});
  const amountOf = (r: CashAdvance) => amountSeen[r.id] ?? Number(r.amount);
  const [dvDate, setDvDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  // A refusal whose request has since left the list (e.g. HR marked the employee absent, which
  // closed it): its row is gone, so the server's reason shows here instead.
  const [refusal, setRefusal] = useState("");

  const noticeRef = useRef<HTMLParagraphElement>(null);
  const releaseRef = useRef<HTMLButtonElement>(null);
  const declineRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Opened by a notice, the window has no row behind it to go back to: closing it lands on the request's row.
  const openedForNotice = useRef(false);
  const [landing, setLanding] = useState<{ id: string; key: number } | null>(null);
  useRecordHighlight(landing?.id, landing?.key, "[data-view-row]");

  const table = useTableView<CashAdvance>({
    rows: requests,
    rowId: r => r.id,
    searchText: requestSearchText,
    sorts: REQUEST_SORTS,
    defaultSort: { key: "asked", dir: "desc" }
  });

  // The requests still waiting; returns them (null when the load failed).
  const load = useCallback(async (): Promise<CashAdvance[] | null> => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiCall("/api/cash-advances");
      if (res?.status !== "success") throw new Error(res?.message || "Could not load the requests.");
      const waiting = ((res.data ?? []) as CashAdvance[]).filter(a => a && a.status === "Requested");
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
    setAlreadyHandled(false);
    if (loads > 0) load();
    onFocusHandled?.();
  }, [focus?.nonce]);
  const fresh = !!shown && loads > shown.afterLoad && !loading;
  useEffect(() => {
    if (!fresh || !shown) return;
    if (requests.some(r => r.id === shown.id)) {
      table.reveal(shown.id);
      openedForNotice.current = true;
      setViewingId(shown.id);
    } else if (!loadError) {
      setAlreadyHandled(true);
    }
    setShown(null);
  }, [fresh]);

  // The form's first field takes the focus, and Cancel gives it back to the button that opened it.
  const lastKind = useRef<"release" | "decline" | null>(null);
  useEffect(() => {
    if (acting) {
      document.getElementById(acting.kind === "release" ? `rq-dvd-${acting.id}` : `rq-why-${acting.id}`)?.focus();
      lastKind.current = acting.kind;
    } else if (lastKind.current) {
      (lastKind.current === "release" ? releaseRef : declineRef).current?.focus();
      lastKind.current = null;
    }
  }, [acting]);

  // Disabling a button while it saves drops the keyboard focus: after a refusal it goes back to it.
  useEffect(() => {
    if (!formError || saving) return;
    if (!document.activeElement || document.activeElement === document.body) confirmRef.current?.focus();
  }, [formError, saving]);

  // A request acted on has left the list, and its row with it: the focus goes to what was done.
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  function view(id: string) {
    setNotice("");
    setRefusal("");
    setAlreadyHandled(false);
    setViewingId(id);
  }

  function closeView() {
    if (viewingId && openedForNotice.current) setLanding({ id: viewingId, key: Date.now() });
    openedForNotice.current = false;
    lastKind.current = null;
    setActing(null);
    setFormError("");
    setViewingId(null);
  }

  function open(id: string, kind: "release" | "decline") {
    setActing({ id, kind });
    setDvSerial("");
    setDvDate(getLocalTodayString());
    setReason("");
    setFormError("");
    setNotice("");
    setRefusal("");
  }

  async function submit(request: CashAdvance) {
    if (!acting) return;
    setFormError("");
    const dvNo = dvNumberFrom(dvDate, dvSerial);
    if (acting.kind === "release") {
      if (!dvPrefix(dvDate)) { setFormError("Choose the voucher's date first."); return; }
      const read = readDvNumber(dvNo, dvDate);
      if ("problem" in read) {
        setFormError(dvSerial ? read.problem : "Type the voucher's serial number, the digits after its year and month.");
        return;
      }
    }
    if (acting.kind === "decline" && !reason.trim()) {
      setFormError("Say why the request is declined; the employee sees it.");
      return;
    }
    setSaving(true);
    try {
      // The amount can change while the form is open (HR re-prices the allowance, someone leaves a group):
      // the server releases only the amount shown here, and otherwise says what it is now, so the voucher
      // matches the record.
      const res = await apiCall(`/api/cash-advances/${encodeURIComponent(request.id)}/${acting.kind}`, {
        method: "POST",
        body: JSON.stringify(acting.kind === "release" ? { dvNo, dvDate, expectedAmount: amountOf(request) } : { reason: reason.trim() })
      });
      if (res?.status !== "success") throw new Error(res?.message || "That didn't go through.");
      lastKind.current = null;
      openedForNotice.current = false;
      setActing(null);
      setViewingId(null);
      setNotice(res.message || (acting.kind === "release" ? "Released." : "Declined."));
      await load();
      onChanged?.();
    } catch (err: any) {
      // apiCall throws with the server's reason (e.g. the employee was since marked absent).
      const message = err?.message || "That didn't go through.";
      setFormError(message);
      // A changed amount comes with the new figure: now shown, it is the one the next try releases.
      if (typeof err?.data?.amount === "number") setAmountSeen(prev => ({ ...prev, [request.id]: err.data.amount }));
      const waiting = await load();
      if (waiting && !waiting.some(r => r.id === request.id)) {
        lastKind.current = null;
        openedForNotice.current = false;
        setActing(null);
        setViewingId(null);
        setRefusal(`${request.employeeName}'s request is no longer waiting. ${message}`);
      }
    } finally {
      setSaving(false);
    }
  }

  const form = viewed && acting?.id === viewed.id ? acting.kind : null;
  const isGroup = !!viewed && groupOf(viewed).length > 1;

  return (
    <SectionCard
      icon={<HandCoins size={12} className="text-blue-600" aria-hidden="true" />}
      title="Cash Advance Requests"
      action={<SectionCount>{requests.length} waiting</SectionCount>}
      caption="Requests"
      bodyClassName=""
    >
      <div className="space-y-3 p-4 pb-2">
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
            <p ref={noticeRef} tabIndex={-1} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 focus:outline-none">
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
        ) : requests.length === 0 && !loadError && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
            <BadgeCheck size={13} className="shrink-0" aria-hidden="true" />
            No requests waiting.
          </p>
        )}
      </div>

      {requests.length > 0 && (
        <>
          <div className="px-3 py-2">
            <TableSearch table={table} id="request-search" label="Search the cash advance requests" placeholder="Employee, seminar or vehicle" />
          </div>
          <DataTable
            table={table}
            columns={REQUEST_COLUMNS}
            caption="Cash advance requests waiting for Finance, newest first"
            rowId={r => r.id}
            actions={r => <ViewButton label={`${r.employeeName}'s request`} onClick={() => view(r.id)} />}
            minWidth={720}
            searchId="request-search"
            empty={null}
          />
          <TablePager table={table} label="Pages of the cash advance requests" />
        </>
      )}

      {viewed && (
        <ModalDialog
          title="Cash advance request"
          subtitle={[viewed.employeeName, viewed.activityTitle].filter(Boolean).join(" · ")}
          icon={<HandCoins size={16} aria-hidden="true" />}
          onClose={closeView}
          busy={saving}
          size="lg"
          footer={form ? (
            <>
              <button
                type="button"
                onClick={() => { setActing(null); setFormError(""); }}
                disabled={saving}
                className={SECONDARY}
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => submit(viewed)}
                disabled={saving}
                className={`${BUTTON} inline-flex items-center justify-center gap-1.5 text-white shadow-sm ${
                  form === "release" ? "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500" : "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
                }`}
              >
                {saving && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                {form === "release"
                  ? saving ? "Releasing…" : `Release ${formatCurrency(amountOf(viewed))}`
                  : saving ? "Declining…" : "Decline request"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={closeView} className={SECONDARY}>Close</button>
              <button
                ref={declineRef}
                type="button"
                onClick={() => open(viewed.id, "decline")}
                className={`${BUTTON} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 focus-visible:ring-rose-500`}
              >
                Decline<span className="sr-only"> {viewed.employeeName}&rsquo;s request</span>
              </button>
              <button
                ref={releaseRef}
                type="button"
                onClick={() => open(viewed.id, "release")}
                className={`${BUTTON} bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500`}
              >
                Release<span className="sr-only"> {viewed.employeeName}&rsquo;s advance</span>
              </button>
            </>
          )}
        >
          <div className="space-y-3 text-xs text-slate-700">
            <RequestFacts request={viewed} />

            {form && (
              <div className="space-y-3 border-t border-slate-200 pt-3">
                {form === "release" && isGroup && (
                  <p className="text-[11px] text-slate-500">
                    Each person is checked again when you release it: anyone who no longer qualifies (marked absent,
                    no longer active, covered or reported elsewhere) is left out, and the total follows the allowances as they are now.
                  </p>
                )}
                {form === "release" ? (
                  // The date first, then only the serial (DvNumberFields.tsx).
                  <DvNumberFields prefix="rq" recordId={viewed.id} dvDate={dvDate} onDvDate={setDvDate} serial={dvSerial} onSerial={setDvSerial}
                    onWarning={setFormError} disabled={saving} />
                ) : (
                  <div className="space-y-1">
                    <label htmlFor={`rq-why-${viewed.id}`} className="font-mono text-[10px] font-bold uppercase text-slate-500">Why it is declined (the employee sees this)</label>
                    <textarea id={`rq-why-${viewed.id}`} value={reason} maxLength={500} disabled={saving} onChange={e => setReason(e.target.value)} className={`${INPUT} h-16 resize-none font-sans`} />
                  </div>
                )}
              </div>
            )}

            {formError && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {formError}
              </p>
            )}
          </div>
        </ModalDialog>
      )}
    </SectionCard>
  );
}
