import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Banknote, Loader2, RefreshCw } from "lucide-react";
import { apiCall, formatCurrency } from "../../utils";
import SectionCard, { SectionCount } from "../ui/SectionCard";

interface Props {
  /** Bumped by the parent so a liquidation elsewhere refreshes the funding state here. */
  refreshKey?: number;
  /** Lets the parent reload its own liquidation lists after an advance is released. */
  onReleased?: () => void;
}

interface FundableRow {
  activityId: string;
  activityTitle: string;
  employeeId: string;
  employeeName: string;
  allocated: number;
  assignmentStatus: string;
  funded: boolean;
  advanceNo: string | null;
  advanceAmount: number | null;
  advanceStatus: string | null;
  liquidationFiled: boolean;
}

const todayIso = () => new Date().toISOString().split("T")[0];

/**
 * Releasing the cash advance — the money-out half of the liquidation cycle.
 *
 * The COA form's "AMOUNT OF CASH ADVANCE PER DV NO. __ DTD __" refers to a voucher
 * Finance issues here. Recording it is what makes the claimant's later report checkable:
 * with an advance on file the server overrides whatever they type, and with none the
 * report is genuinely a reimbursement claim.
 */
export default function CashAdvanceDesk({ refreshKey = 0, onReleased }: Props) {
  const [rows, setRows] = useState<FundableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [dvNo, setDvNo] = useState("");
  const [dvDate, setDvDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiCall("/api/cash-advances/fundable");
      if (res.status === "success") setRows(res.data ?? []);
      else setLoadError(res.message || "Could not load the funding list.");
    } catch (err: any) {
      setLoadError(err.message || "Could not load the funding list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const unfunded = useMemo(() => rows.filter(r => !r.funded && r.advanceStatus !== "Liquidated"), [rows]);
  const open = useMemo(() => rows.filter(r => r.funded), [rows]);
  const settled = useMemo(() => rows.filter(r => !r.funded && r.advanceStatus === "Liquidated"), [rows]);
  const outstanding = useMemo(
    () => open.reduce((sum, r) => sum + Number(r.advanceAmount || 0), 0),
    [open]
  );

  function openForm(row: FundableRow) {
    setOpenId(row.activityId);
    // HR's allocation is the ceiling and the usual amount, so start there.
    setAmount(row.allocated > 0 ? String(row.allocated) : "");
    setDvNo("");
    setDvDate(todayIso());
    setFormError("");
  }

  async function release(row: FundableRow) {
    setFormError("");
    const value = Number(amount);
    if (!isFinite(value) || value <= 0) {
      setFormError("Enter the amount released, greater than zero.");
      return;
    }
    // Mirrors the server's ceiling so the officer is told before submitting.
    if (row.allocated > 0 && value > row.allocated) {
      setFormError(`That exceeds the ${formatCurrency(row.allocated)} HR allocated. Ask HR to raise the allocation first.`);
      return;
    }
    if (!dvNo.trim()) {
      setFormError("Enter the disbursement voucher number.");
      return;
    }
    if (!dvDate) {
      setFormError("Enter the voucher date.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiCall("/api/cash-advances", {
        method: "POST",
        body: JSON.stringify({
          activityId: row.activityId,
          employeeId: row.employeeId,
          amount: value,
          dvNo: dvNo.trim(),
          dvDate,
          purpose: row.activityTitle
        })
      });
      if (res.status === "success") {
        setOpenId(null);
        await load();
        onReleased?.();
      } else {
        setFormError(res.message || "Could not release the advance.");
      }
    } catch (err: any) {
      // apiCall throws on a non-2xx, so the server's message only reaches here.
      setFormError(err.message || "Could not release the advance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={<Banknote size={12} className="text-blue-600" aria-hidden="true" />}
      title="Cash Advance Desk"
      action={<SectionCount>{unfunded.length} unfunded</SectionCount>}
      caption="Money Out"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[11px] text-slate-500 max-w-2xl">
          Release the disbursement voucher for an assignment before it happens. Recording it
          here is what makes the later liquidation checkable &mdash; the claimant&rsquo;s report
          takes its advance figure and DV reference from this record, not from what they type.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {open.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-right">
              <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-blue-700">Unliquidated</span>
              <strong className="text-sm font-mono text-blue-800">{formatCurrency(outstanding)}</strong>
            </div>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
            aria-label="Reload the funding list"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loadError && (
        <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start justify-between gap-3">
          <span className="flex gap-2"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{loadError}</span>
          <button onClick={load} className="font-semibold underline shrink-0 cursor-pointer">Retry</button>
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Loading assignments…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <Banknote size={28} className="mx-auto text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-slate-600">No assignments to fund</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Employees appear here once HR assigns them to a seminar or activity.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {unfunded.length === 0 ? (
            <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <BadgeCheck size={13} className="shrink-0" />
              Every current assignment has been funded or settled.
            </p>
          ) : (
            unfunded.map(row => {
              const isOpen = openId === row.activityId;
              return (
                <div key={row.activityId} className="p-4 border border-slate-200 rounded-xl bg-slate-50/40 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-slate-800">{row.employeeName}</h3>
                      <p className="text-[11px] text-slate-500 truncate">{row.activityTitle}</p>
                      <div className="grid grid-cols-2 gap-2 max-w-xs">
                        <div className="bg-white p-2 rounded border border-slate-100">
                          <span className="text-[9px] text-slate-400 font-semibold block font-mono">HR Allocated</span>
                          <strong className="text-xs text-slate-700 font-mono">{formatCurrency(row.allocated)}</strong>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-100">
                          <span className="text-[9px] text-slate-400 font-semibold block font-mono">Released</span>
                          <strong className="text-xs text-amber-700 font-mono">Nothing yet</strong>
                        </div>
                      </div>
                      {row.liquidationFiled && (
                        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                          A liquidation was already filed against this assignment without an advance on record.
                        </p>
                      )}
                    </div>

                    {!isOpen && (
                      <button
                        onClick={() => openForm(row)}
                        className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
                      >
                        Release Advance
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-200 pt-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                        <div className="space-y-1">
                          <label htmlFor={`amt-${row.activityId}`} className="text-[10px] font-bold text-slate-400 uppercase font-mono">Amount Released (₱)</label>
                          <input
                            id={`amt-${row.activityId}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            disabled={saving}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100"
                          />
                          <p className="text-[9px] text-slate-400 font-mono">Ceiling {formatCurrency(row.allocated)}</p>
                        </div>
                        <div className="space-y-1">
                          <label htmlFor={`dv-${row.activityId}`} className="text-[10px] font-bold text-slate-400 uppercase font-mono">Disbursement Voucher No.</label>
                          <input
                            id={`dv-${row.activityId}`}
                            type="text"
                            value={dvNo}
                            disabled={saving}
                            onChange={e => setDvNo(e.target.value)}
                            placeholder="2026-08-336"
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100"
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor={`dvd-${row.activityId}`} className="text-[10px] font-bold text-slate-400 uppercase font-mono">Voucher Date</label>
                          <input
                            id={`dvd-${row.activityId}`}
                            type="date"
                            value={dvDate}
                            disabled={saving}
                            onChange={e => setDvDate(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100"
                          />
                        </div>
                      </div>

                      {formError && (
                        <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
                          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                          {formError}
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => release(row)}
                          disabled={saving}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm cursor-pointer flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
                        >
                          {saving && <Loader2 size={12} className="animate-spin" />}
                          {saving ? "Releasing…" : "Confirm Release"}
                        </button>
                        <button
                          onClick={() => { setOpenId(null); setFormError(""); }}
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
            })
          )}

          {open.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider mb-2">
                Released, Awaiting Liquidation ({open.length})
              </h3>
              <ul className="divide-y divide-slate-100">
                {open.map(row => (
                  <li key={row.activityId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[11px]">
                    <span className="min-w-0">
                      <span className="font-mono text-slate-500">{row.advanceNo}</span>{" "}
                      <span className="text-slate-700">{row.employeeName}</span>{" "}
                      <span className="text-slate-400">· {row.activityTitle}</span>
                    </span>
                    <span className="font-mono text-slate-600 shrink-0">
                      {formatCurrency(Number(row.advanceAmount || 0))}
                      {row.liquidationFiled ? " · liquidation filed" : " · not yet liquidated"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {settled.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider mb-2">
                Settled ({settled.length})
              </h3>
              <ul className="divide-y divide-slate-100">
                {settled.slice(0, 5).map(row => (
                  <li key={row.activityId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[11px]">
                    <span className="flex items-center gap-2 min-w-0">
                      <BadgeCheck size={13} className="text-emerald-600 shrink-0" />
                      <span className="font-mono text-slate-500">{row.advanceNo}</span>
                      <span className="text-slate-700 truncate">{row.employeeName}</span>
                    </span>
                    <span className="font-mono text-slate-500 shrink-0">
                      {formatCurrency(Number(row.advanceAmount || 0))} · liquidated
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
