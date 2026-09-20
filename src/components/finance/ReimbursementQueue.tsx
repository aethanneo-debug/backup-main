import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, HandCoins, Loader2, Wallet } from "lucide-react";
import { apiCall, formatCurrency, formatDate } from "../../utils";

interface Props {
  /** Every liquidation submission Finance can see. Filtered here, not by the caller. */
  submissions: any[];
  /** Re-runs the parent's fetch so a recorded payment leaves the queue. */
  onRecorded: () => void;
}

/**
 * HR set money aside but the claimant says they received less. Either the advance really
 * was never released (the legitimate case this whole flow exists for), or the claim would
 * pay out money already advanced. Finance cannot read the HR training tables, so this
 * stamped figure is the only thing that makes the difference visible.
 */
function mismatch(sub: any): boolean {
  if (sub?.allocatedAtFiling === undefined) return false;
  return Number(sub.allocatedAtFiling) > Number(sub.totalReleased || 0);
}

/**
 * Claims where the employee spent more than they received.
 *
 * An employee assigned to a seminar who never got the cash advance pays out of pocket,
 * and their Liquidation Report doubles as the claim to get it back. Finance validating
 * that report does NOT hand over any money — until the disbursement voucher is recorded
 * here, the claimant is still out of pocket, which is why these stay visible.
 */
export default function ReimbursementQueue({ submissions, onRecorded }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [dvNo, setDvNo] = useState("");
  const [payDate, setPayDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const claims = useMemo(
    () => (submissions ?? []).filter(
      s => s?.reimbursementStatus === "Awaiting Reimbursement" && Number(s?.reimbursementAmount || 0) > 0
    ),
    [submissions]
  );

  // The server refuses to release money on a report that is not yet validated, so showing
  // a "Record Payment" button on one would only produce a 400. Those claims are counted
  // below instead, so Finance can still see money is coming.
  const pending = useMemo(() => claims.filter(s => s.status === "Completed"), [claims]);
  const notYetValidated = useMemo(() => claims.filter(s => s.status !== "Completed"), [claims]);

  const settled = useMemo(
    () => (submissions ?? [])
      .filter(s => s?.reimbursementStatus === "Reimbursed")
      .sort((a, b) => String(b.reimbursementDate || "").localeCompare(String(a.reimbursementDate || ""))),
    [submissions]
  );

  const owedTotal = useMemo(
    () => pending.reduce((sum, s) => sum + Number(s.reimbursementAmount || 0), 0),
    [pending]
  );

  function openForm(id: string) {
    setOpenId(id);
    setDvNo("");
    // Default to today; Finance can back-date to the DV's actual release date.
    setPayDate(new Date().toISOString().split("T")[0]);
    setError("");
  }

  async function recordPayment(sub: any) {
    setError("");
    if (!dvNo.trim()) {
      setError("Enter the disbursement voucher number.");
      return;
    }
    if (!payDate) {
      setError("Enter the date the voucher was released.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiCall(`/api/liquidation-submissions/${sub.id}/record-reimbursement`, {
        method: "PUT",
        body: JSON.stringify({ dvNo: dvNo.trim(), date: payDate })
      });
      if (res.status === "success") {
        setOpenId(null);
        onRecorded();
      } else {
        setError(res.message || "Could not record the reimbursement.");
      }
    } catch (err: any) {
      // apiCall throws on a non-2xx, so the server's message only surfaces here.
      setError(err.message || "Could not record the reimbursement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold font-sans text-slate-800 uppercase tracking-tight flex items-center">
            <HandCoins size={15} className="mr-2 text-amber-600" />
            Reimbursement Queue ({pending.length})
          </h2>
          <p className="text-[11px] text-slate-500 mt-1 max-w-2xl">
            Employees who paid out of their own pocket because the cash advance never reached
            them. Validating the liquidation does not release any money &mdash; record the
            disbursement voucher here to close the claim.
          </p>
        </div>
        {pending.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-right shrink-0">
            <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-amber-700">Total Owed</span>
            <strong className="text-sm font-mono text-amber-800">{formatCurrency(owedTotal)}</strong>
          </div>
        )}
      </div>

      {notYetValidated.length > 0 && (
        <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {notYetValidated.length} further claim{notYetValidated.length === 1 ? "" : "s"} worth{" "}
          <strong>{formatCurrency(notYetValidated.reduce((t, s) => t + Number(s.reimbursementAmount || 0), 0))}</strong>{" "}
          {notYetValidated.length === 1 ? "is" : "are"} still moving through HR verification and validation.
          {notYetValidated.length === 1 ? " It becomes" : " They become"} payable once validated.
        </p>
      )}

      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <Wallet size={28} className="mx-auto text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-slate-600">No reimbursements ready to pay</p>
          <p className="text-[11px] text-slate-500 mt-1">
            A claim becomes payable here once a <strong>validated</strong> liquidation shows more spent than was advanced.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {pending.map(sub => {
            const owed = Number(sub.reimbursementAmount || 0);
            const isOpen = openId === sub.id;
            return (
              <div key={sub.id} className="p-4 border border-amber-200 rounded-xl bg-amber-50/20 space-y-3">
                {mismatch(sub) && (
                  <p className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>
                      HR set aside <strong>{formatCurrency(Number(sub.allocatedAtFiling))}</strong> for this
                      assignment, but the claimant reports receiving{" "}
                      <strong>{formatCurrency(Number(sub.totalReleased || 0))}</strong>. Confirm the advance was
                      never released before paying &mdash; otherwise this would pay the same money twice.
                    </span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                    {sub.serialNo || sub.submissionNo}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDate(sub.createdAt || sub.dateSubmitted)}
                  </span>
                </div>

                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-800">{sub.employeeName}</h3>
                    <p className="text-[11px] text-slate-500 truncate">{sub.activityTitle || sub.activityId}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-2xl">
                      <div className="bg-white p-2 rounded border border-slate-100">
                        <span className="text-[9px] text-slate-400 font-semibold block font-mono">HR Allocated</span>
                        <strong className="text-xs text-slate-700 font-mono">
                          {sub.allocatedAtFiling === undefined ? "Not on record" : formatCurrency(Number(sub.allocatedAtFiling))}
                        </strong>
                      </div>
                      <div className={`p-2 rounded border ${mismatch(sub) ? "bg-rose-50 border-rose-200" : "bg-white border-slate-100"}`}>
                        <span className={`text-[9px] font-semibold block font-mono ${mismatch(sub) ? "text-rose-700" : "text-slate-400"}`}>Claimant States Received</span>
                        <strong className={`text-xs font-mono ${mismatch(sub) ? "text-rose-800" : "text-slate-700"}`}>{formatCurrency(Number(sub.totalReleased || 0))}</strong>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-100">
                        <span className="text-[9px] text-slate-400 font-semibold block font-mono">Total Spent</span>
                        <strong className="text-xs text-slate-700 font-mono">{formatCurrency(Number(sub.totalSpent || 0))}</strong>
                      </div>
                      <div className="bg-amber-50 p-2 rounded border border-amber-200">
                        <span className="text-[9px] text-amber-700 font-semibold block font-mono">Owed to Employee</span>
                        <strong className="text-xs text-amber-800 font-mono">{formatCurrency(owed)}</strong>
                      </div>
                    </div>
                  </div>

                  {!isOpen && (
                    <button
                      onClick={() => openForm(sub.id)}
                      className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
                    >
                      Record Payment
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-amber-200 pt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                      <div className="space-y-1">
                        <label htmlFor={`dv-${sub.id}`} className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                          Disbursement Voucher No.
                        </label>
                        <input
                          id={`dv-${sub.id}`}
                          type="text"
                          value={dvNo}
                          disabled={saving}
                          onChange={e => setDvNo(e.target.value)}
                          placeholder="2026-09-412"
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`dt-${sub.id}`} className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                          Date Released
                        </label>
                        <input
                          id={`dt-${sub.id}`}
                          type="date"
                          value={payDate}
                          disabled={saving}
                          onChange={e => setPayDate(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100"
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                        {error}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => recordPayment(sub)}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm cursor-pointer flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
                      >
                        {saving && <Loader2 size={12} className="animate-spin" />}
                        {saving ? "Recording…" : `Confirm ${formatCurrency(owed)} Released`}
                      </button>
                      <button
                        onClick={() => { setOpenId(null); setError(""); }}
                        disabled={saving}
                        className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {settled.length > 0 && (
        <div className="border-t border-slate-200 pt-3">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider mb-2">
            Recently Reimbursed
          </h3>
          <ul className="divide-y divide-slate-100">
            {settled.slice(0, 5).map(sub => (
              <li key={sub.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[11px]">
                <span className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span className="font-mono text-slate-500">{sub.serialNo || sub.submissionNo}</span>
                  <span className="text-slate-700 truncate">{sub.employeeName}</span>
                </span>
                <span className="text-slate-500 font-mono shrink-0">
                  {formatCurrency(Number(sub.reimbursementAmount || 0))} &middot; DV {sub.reimbursementDvNo || "—"} &middot; {formatDate(sub.reimbursementDate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
