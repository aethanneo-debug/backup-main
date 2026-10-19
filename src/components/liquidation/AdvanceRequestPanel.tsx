import { useState, type ReactNode } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { CashAdvance } from "../../types";
import { apiCall, formatCurrency, formatDate } from "../../utils";

/**
 * The cash-advance record that stands for a seminar now, as the server picks it: a request
 * waiting for Finance, the advance released, or else the latest one.
 */
export function currentAdvanceOf(advances: CashAdvance[] | null | undefined, activityId: string): CashAdvance | null {
  const list = (advances ?? []).filter(a => a && a.activityId === activityId);
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
  /** After a request is sent: the server's message, for the page to show and reload. */
  onRequested: (message: string) => void;
}

/**
 * On an employee's seminar card (the seminar budget flow): ask Finance for the cash advance,
 * then follow it (waiting, released with its DV, declined and why, settled). The amount is the
 * allowance, set by the server; the employee only asks.
 */
export default function AdvanceRequestPanel({ activityId, allowance, canRequest, blockedReason, advance, onRequested }: Props) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function request() {
    setSending(true);
    setError("");
    try {
      const res = await apiCall("/api/cash-advances/request", { method: "POST", body: JSON.stringify({ activityId }) });
      if (res?.status !== "success") throw new Error(res?.message || "The request could not be sent.");
      onRequested(res.message || "Your request was sent to Finance.");
    } catch (err: any) {
      setError(err?.message || "The request could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const status = advance?.status;
  return (
    <div className="space-y-2 border-t border-slate-100 pt-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-mono text-[10px] uppercase text-slate-400">
          <Banknote size={11} aria-hidden="true" /> Cash Advance
        </span>
        {status === "Requested" && <Pill tone="amber">Waiting for Finance</Pill>}
        {status === "Released" && <Pill tone="blue">Released</Pill>}
        {status === "Liquidated" && <Pill tone="emerald">Liquidated</Pill>}
        {status === "Declined" && <Pill tone="rose">Declined</Pill>}
        {status === "Refunded" && <Pill tone="slate">Refunded</Pill>}
      </div>

      {status === "Requested" && (
        <p className="text-[11px] text-slate-600">
          You asked for <strong>{formatCurrency(Number(advance!.amount))}</strong> on {formatDate(String(advance!.requestedAt || ""))}.
          Finance will release it with a disbursement voucher, or tell you why not.
        </p>
      )}
      {status === "Released" && (
        <p className="text-[11px] text-slate-600">
          <strong>{formatCurrency(Number(advance!.amount))}</strong> released on {advance!.advanceNo}, DV {advance!.dvNo} dated{" "}
          {formatDate(advance!.dvDate)}. Your liquidation report&rsquo;s items can&rsquo;t go past it; hand back whatever you don&rsquo;t spend.
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

      {canRequest ? (
        <button
          type="button"
          onClick={request}
          disabled={sending}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
          {sending ? "Sending…" : `${status === "Declined" || status === "Refunded" ? "Ask again" : "Request cash advance"}: ${formatCurrency(allowance)}`}
        </button>
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
