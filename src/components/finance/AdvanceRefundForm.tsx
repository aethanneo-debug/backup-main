import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Banknote, Loader2 } from "lucide-react";
import { apiCall, formatCurrency } from "../../utils";
import ModalDialog from "../ui/ModalDialog";

interface Props {
  advanceId: string;
  advanceNo: string | null;
  employeeName: string;
  amount: number;
  /** A group advance nobody it covers attended: everyone it covered, the holder first. */
  groupNames?: string[];
  /** Their own advance handed back before the seminar starts (12z Part B): their seat stays until HR
   * sends a representative or takes them off, so their share isn't released by this. */
  beforeSeminar?: boolean;
  /** Called with the server's account of what was recorded (and what returned to Unallocated). */
  onRecorded: (message: string) => void;
  onCancel: () => void;
}

// Today in Manila, as YYYY-MM-DD: the server refuses an OR dated later than that.
const manilaToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

const LABEL = "text-[10px] font-bold text-slate-500 uppercase font-mono";
const INPUT =
  "w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100";

/**
 * Recording that someone who did not attend gave their cash advance back in full
 * (requirement 6). Until it is recorded, their share of the seminar stays held in the
 * training budget, so the money can't fund another seminar while it is still out; once
 * recorded, it returns to Unallocated and the advance is closed. A window of its own, opened
 * from the Cash Advance Desk's table (the instructor's review, R8).
 */
export default function AdvanceRefundForm({ advanceId, advanceNo, employeeName, amount, groupNames, beforeSeminar = false, onRecorded, onCancel }: Props) {
  const [orNo, setOrNo] = useState("");
  const [orDate, setOrDate] = useState(manilaToday());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitRef = useRef<HTMLButtonElement>(null);
  const ids = { orNo: `refund-or-${advanceId}`, orDate: `refund-date-${advanceId}`, error: `refund-error-${advanceId}` };

  // Disabling a button while it saves drops the keyboard focus: after a refusal it goes back to it.
  useEffect(() => {
    if (!error || saving) return;
    if (!document.activeElement || document.activeElement === document.body) submitRef.current?.focus();
  }, [error, saving]);

  async function submit() {
    setError("");
    if (!orNo.trim()) {
      setError("Enter the official receipt (OR) number of the refund.");
      return;
    }
    if (!orDate) {
      setError("Enter the date on the OR.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiCall(`/api/cash-advances/${encodeURIComponent(advanceId)}/refund`, {
        method: "POST",
        body: JSON.stringify({ orNo: orNo.trim(), orDate })
      });
      if (res?.status === "success") onRecorded(res.message || "Refund recorded.");
      else setError(res?.message || "The refund could not be recorded.");
    } catch (err: any) {
      // apiCall throws on a non-2xx with the server's reason.
      setError(err?.message || "The refund could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalDialog
      title="Record refund"
      subtitle={[employeeName, advanceNo].filter(Boolean).join(" · ")}
      icon={<Banknote size={16} aria-hidden="true" />}
      onClose={onCancel}
      busy={saving}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            ref={submitRef}
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
            {saving ? "Recording…" : "Record Refund"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[11px] text-slate-600">
          Refund of <strong className="font-mono text-slate-800">{formatCurrency(amount)}</strong> from{" "}
          <strong className="text-slate-800">{employeeName}</strong>
          {advanceNo ? <> on <span className="font-mono">{advanceNo}</span></> : null}
          {groupNames ? <>, the group&rsquo;s whole advance (nobody it covered attended: {groupNames.join(", ")})</> : null}
          {beforeSeminar ? (
            <>, handed back before the seminar. Recording it closes the advance; their place on the seminar stays until HR sends a
            representative or takes them off.</>
          ) : (
            <>. Recording it closes the advance and returns {groupNames ? "everyone’s share" : "their share"} of the seminar to Unallocated.</>
          )}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={ids.orNo} className={LABEL}>Official Receipt No.</label>
            <input
              id={ids.orNo}
              type="text"
              value={orNo}
              maxLength={50}
              disabled={saving}
              onChange={e => { setOrNo(e.target.value); setError(""); }}
              aria-invalid={error && !orNo.trim() ? true : undefined}
              aria-describedby={error ? ids.error : undefined}
              placeholder="0247983"
              className={INPUT}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={ids.orDate} className={LABEL}>OR Date</label>
            <input
              id={ids.orDate}
              type="date"
              value={orDate}
              max={manilaToday()}
              disabled={saving}
              onChange={e => { setOrDate(e.target.value); setError(""); }}
              aria-describedby={error ? ids.error : undefined}
              className={INPUT}
            />
          </div>
        </div>

        {error && (
          <p id={ids.error} role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </ModalDialog>
  );
}
