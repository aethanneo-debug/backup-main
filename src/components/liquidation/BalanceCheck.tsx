import { AlertTriangle, CheckCircle2, Undo2 } from "lucide-react";
import { LiquidationSubmission } from "../../types";
import { formatCurrency, formatDate } from "../../utils";
import { liquidationBalance } from "../../liquidationMoney";

// The seminar budget flow (2026-10-19): a seminar's liquidation report settles the cash advance
// Finance released. Its items may not come to more than the advance, and what is left is handed
// back with an OR; it returns to the training budget when Finance validates the report. The
// figures come from src/liquidationMoney.ts, the same sums in centavos the server checks.

interface BalanceCheckProps {
  /** The cash advance Finance released (its record, never typed). */
  advance: number;
  /** The items' total so far. */
  itemsTotal: number;
  /** Whether the OR number and date for a leftover are filled in on the sheet. */
  orFilled: boolean;
}

const TONE = {
  Balanced: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Not balanced": "border-amber-200 bg-amber-50 text-amber-900",
  Over: "border-rose-200 bg-rose-50 text-rose-800"
} as const;

/** The live check under a seminar's liquidation form: the advance, the items, what is left. */
export default function BalanceCheck({ advance, itemsTotal, orFilled }: BalanceCheckProps) {
  const b = liquidationBalance(advance, itemsTotal);
  const Icon = b.status === "Balanced" ? CheckCircle2 : b.status === "Over" ? AlertTriangle : Undo2;
  return (
    <section aria-labelledby="balance-check-heading" className={`rounded-xl border p-3 ${TONE[b.status]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="balance-check-heading" className="font-mono text-[10px] font-bold uppercase tracking-widest">
          Balance check
        </h3>
        {/* Only the status is announced, so a screen reader isn't read every keystroke. */}
        <p role="status" aria-live="polite" className="inline-flex items-center gap-1 text-xs font-bold">
          <Icon size={13} aria-hidden="true" />
          {b.status === "Over" ? "Over the advance" : b.status}
        </p>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
          <dt className="font-mono text-[9px] font-semibold uppercase text-slate-500">Cash advance</dt>
          <dd className="font-mono text-xs font-bold tabular-nums text-slate-800">{formatCurrency(advance)}</dd>
        </div>
        <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
          <dt className="font-mono text-[9px] font-semibold uppercase text-slate-500">Items total</dt>
          <dd className="font-mono text-xs font-bold tabular-nums text-slate-800">{formatCurrency(itemsTotal)}</dd>
        </div>
        <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
          <dt className="font-mono text-[9px] font-semibold uppercase text-slate-500">{b.status === "Over" ? "Over by" : "Remaining"}</dt>
          <dd className="font-mono text-xs font-bold tabular-nums text-slate-800">{formatCurrency(b.status === "Over" ? b.over : b.leftover)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-snug">
        {b.status === "Balanced"
          ? "Your items use up the cash advance exactly, so there is nothing to hand back."
          : b.status === "Over"
            ? <>A seminar report can&rsquo;t go past its cash advance. Lower or remove an item to submit.</>
            : <>
                Hand the {formatCurrency(b.leftover)} back to the cashier and enter the OR number and date on the sheet
                (AMOUNT REFUNDED). It goes back to the training budget once Finance validates the report.
                {!orFilled && <strong className="font-semibold"> The OR is still missing.</strong>}
              </>}
      </p>
    </section>
  );
}

/**
 * A report's balance for a list: on a seminar report kept within its advance, Balanced, the
 * amount to hand back, or (once validated) what went back to the fund. Nothing for other
 * reports, which show their refund or reimbursement as before.
 */
export function BalanceStatusBadge({ report }: { report: Partial<LiquidationSubmission> }) {
  if (!report?.withinAdvance) return null;
  const b = liquidationBalance(report.totalReleased ?? 0, report.totalSpent ?? 0);
  const [text, tone] = report.fundReturn
    ? [`Returned to fund: ${formatCurrency(report.fundReturn.amount)}`, "bg-emerald-50 text-emerald-700 border-emerald-200"]
    : b.status === "Balanced"
      ? ["Balanced", "bg-emerald-50 text-emerald-700 border-emerald-200"]
      : b.status === "Over"
        ? [`Over the advance by ${formatCurrency(b.over)}`, "bg-rose-50 text-rose-700 border-rose-200"]
        : [`Not balanced: ${formatCurrency(b.leftover)} to hand back`, "bg-amber-50 text-amber-700 border-amber-200"];
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${tone}`}>{text}</span>;
}

/** The fund return recorded when Finance validated a seminar report: person, amount, OR, date. */
export function FundReturnNote({ report }: { report: Partial<LiquidationSubmission> }) {
  const r = report?.fundReturn;
  if (!r) return null;
  return (
    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800">
      <strong>{formatCurrency(r.amount)}</strong> went back to the training budget: handed back by {report.employeeName}
      {" "}(OR {r.orNo}, {formatDate(r.orDate)}), recorded by {r.recordedBy} on {formatDate(r.recordedAt)}.
    </p>
  );
}
