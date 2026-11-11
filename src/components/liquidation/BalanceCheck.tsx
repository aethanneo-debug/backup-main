import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock, Info, Undo2, type LucideIcon } from "lucide-react";
import { CashAdvance, LiquidationSubmission } from "../../types";
import { formatCurrency, formatDate } from "../../utils";
import { centavos, liquidationBalance, pesos } from "../../liquidationMoney";
import { portionCentavos } from "../../advanceCoverage";

// The seminar budget flow (2026-10-19): a seminar's liquidation report settles the cash advance
// Finance released. Its items may not come to more than the advance, and what is left is handed
// back with an OR; it returns to the training budget when Finance validates the report. The
// figures come from src/liquidationMoney.ts, the same sums in centavos the server checks.
//
// The check starts from the budget HR set for the seat (the user's request of 2026-11-10, known-issues 12af): released
// as the cash advance, claimed back by an employee who paid for the seminar themselves (src/reimbursement.ts), or still
// waiting for Finance. The employee types only the breakdown; what they don't spend goes back to Unallocated once
// Finance validates the report.

/** How the seat's report settles: its released advance, a reimbursement, or not yet (a request still with Finance). */
export type SeminarBudgetMode = "liquidation" | "reimbursement" | "waiting";

interface BalanceCheckProps {
  mode: SeminarBudgetMode;
  /** HR's share for the seat now (allocation ÷ seats), from the employee's seminar list; null when it isn't known. */
  share: number | null;
  /** A Liquidation's cash advance, as Finance released it (its record, never typed). */
  advance?: CashAdvance | null;
  /** The seat the report is for: on a group's advance, its own part is what HR's share is compared with. */
  seatId?: string;
  /** A Reimbursement's limit: the share less what the office paid for them; null when it isn't known. */
  limit?: number | null;
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

/** The live check under a seminar's report form: HR's budget for the seat, what is spent so far, what is left. */
export default function BalanceCheck({ mode, share, advance, seatId, limit, itemsTotal, orFilled }: BalanceCheckProps) {
  if (mode === "waiting") return share === null ? null : <WaitingForRelease share={share} />;
  if (mode === "reimbursement") {
    return limit === null || limit === undefined ? null : <ClaimBalance share={share} limit={limit} itemsTotal={itemsTotal} />;
  }
  return advance ? <AdvanceBalance advance={advance} share={share} seatId={seatId} itemsTotal={itemsTotal} orFilled={orFilled} /> : null;
}

/** The panel around a check: its heading and the one line read out as the figures change. */
function CheckPanel({ mode, tone, status, icon: Icon, children }: {
  mode: SeminarBudgetMode;
  tone: string;
  status: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section data-budget-panel="" data-mode={mode} aria-labelledby="balance-check-heading" className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="balance-check-heading" className="font-mono text-[10px] font-bold uppercase tracking-widest">
          Balance check
        </h3>
        {/* Only the status is announced, so a screen reader isn't read every keystroke. */}
        <p role="status" aria-live="polite" className="inline-flex items-center gap-1 text-xs font-bold">
          <Icon size={13} aria-hidden="true" />
          {status}
        </p>
      </div>
      {children}
    </section>
  );
}

/** One figure of the check. `name` is how a figure is found (data-budget); `over` marks one that went past its budget. */
function Figure({ label, value, name, over = false }: { label: string; value: number; name: string; over?: boolean }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
      <dt className="font-mono text-[9px] font-semibold uppercase text-slate-500">{label}</dt>
      <dd data-budget={name} data-over={over ? "" : undefined} className="font-mono text-xs font-bold tabular-nums text-slate-800">
        {formatCurrency(value)}
      </dd>
    </div>
  );
}

/** A Liquidation: the advance Finance released is the budget HR set, and the items stay within it. */
function AdvanceBalance({ advance, share, seatId, itemsTotal, orFilled }: {
  advance: CashAdvance;
  share: number | null;
  seatId?: string;
  itemsTotal: number;
  orFilled: boolean;
}) {
  const released = pesos(Math.max(0, centavos(advance.amount)));
  const b = liquidationBalance(released, itemsTotal);
  const covers = Array.isArray(advance.covers) ? advance.covers.filter(Boolean) : [];
  const group = covers.length > 1;
  // What was released for this seat: the whole advance, or its part of the group's (HSAC RAB 1).
  const ownReleased = group ? pesos(seatId ? portionCentavos(advance, seatId) : 0) : released;
  // HR re-priced the seat after the release (its allocation or seats changed): the report still liquidates what was
  // released, which is the server's rule too.
  const repriced = share !== null && ownReleased > 0 && centavos(share) !== centavos(ownReleased);
  const voucher = [advance.dvNo && `DV No. ${advance.dvNo}`, advance.dvDate && `dated ${formatDate(advance.dvDate)}`]
    .filter(Boolean)
    .join(", ");
  return (
    <CheckPanel
      mode="liquidation"
      tone={TONE[b.status]}
      status={b.status === "Over" ? "Over the advance" : b.status}
      icon={b.status === "Balanced" ? CheckCircle2 : b.status === "Over" ? AlertTriangle : Undo2}
    >
      <p className="mt-2 text-xs leading-snug">
        {/* What was released is HR's budget for the seat, unless HR's share has moved since (then the note says so). */}
        {repriced
          ? (group ? "Your group's cash advance for this seminar: " : "The cash advance released for this seminar: ")
          : (group ? "Your group's budget for this seminar, set by HR: " : "Your budget for this seminar, set by HR: ")}
        <strong data-budget="share" className="font-bold tabular-nums">{formatCurrency(released)}</strong>
        {group ? ` for ${covers.length} participants${repriced ? "" : ", released as one cash advance"}` : repriced ? "" : ", released as your cash advance"}
        {voucher ? ` (${voucher})` : ""}.
      </p>
      {repriced && (
        // True whether HR re-priced the seminar after the release or an older advance was released below the share.
        <p data-budget="repriced" className="mt-2 flex items-start gap-1.5 rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-slate-700">
          <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            HR&rsquo;s share for your seat is now <strong className="tabular-nums">{formatCurrency(share!)}</strong>
            {group ? <> ({formatCurrency(ownReleased)} was released for it)</> : null}. This report liquidates
            the {formatCurrency(released)} released.
          </span>
        </p>
      )}
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <Figure label="Cash advance" value={released} name="advance" />
        <Figure label="Spent so far" value={itemsTotal} name="spent" />
        <Figure
          label={b.status === "Over" ? "Over by" : "Remaining"}
          value={b.status === "Over" ? b.over : b.leftover}
          name="left"
          over={b.status === "Over"}
        />
      </dl>
      <p className="mt-2 text-[11px] leading-snug">
        {b.status === "Balanced"
          ? "Your items use up the cash advance exactly, so there is nothing to hand back."
          : b.status === "Over"
            ? <>A seminar report can&rsquo;t go past its cash advance. Lower or remove an item to submit.</>
            : <>
                What&rsquo;s left goes back to the training budget (Unallocated) when Finance validates your report, with
                the refund OR: hand the {formatCurrency(b.leftover)} back to the cashier and enter the OR number and date on
                the sheet (AMOUNT REFUNDED).
                {!orFilled && <strong className="font-semibold"> The OR is still missing.</strong>}
              </>}
      </p>
    </CheckPanel>
  );
}

/** A Reimbursement: the employee paid, and claims back up to their share less what the office paid for them. */
function ClaimBalance({ share, limit, itemsTotal }: { share: number | null; limit: number; itemsTotal: number }) {
  const cap = Math.max(0, centavos(limit));
  const spent = Math.max(0, centavos(itemsTotal));
  const officePaid = share !== null ? Math.max(0, centavos(share) - cap) : 0;
  const left = cap - spent;
  const [status, tone, icon] = cap === 0
    ? ["Nothing to claim", TONE["Not balanced"], AlertTriangle] as const
    : left < 0
      ? ["Over your limit", TONE.Over, AlertTriangle] as const
      : ["Within your limit", TONE.Balanced, CheckCircle2] as const;
  return (
    <CheckPanel mode="reimbursement" tone={tone} status={status} icon={icon}>
      <p className="mt-2 text-xs leading-snug">
        {share !== null && (
          <>
            Your budget for this seminar, set by HR:{" "}
            <strong data-budget="share" className="font-bold tabular-nums">{formatCurrency(share)}</strong>.{" "}
          </>
        )}
        {officePaid > 0 && (
          <>
            The office paid{" "}
            <strong data-budget="office-paid" className="font-bold tabular-nums">{formatCurrency(pesos(officePaid))}</strong>{" "}
            for you directly.{" "}
          </>
        )}
        You can claim up to <strong className="font-bold tabular-nums">{formatCurrency(pesos(cap))}</strong>.
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <Figure label="Your limit" value={pesos(cap)} name="limit" />
        <Figure label="Spent so far" value={pesos(spent)} name="spent" />
        <Figure label={left < 0 ? "Over by" : "Remaining"} value={pesos(Math.abs(left))} name="left" over={left < 0} />
      </dl>
      <p className="mt-2 text-[11px] leading-snug">
        {cap === 0
          ? "Nothing is left of your share of this seminar's budget to claim back. Ask HR about it."
          : left < 0
            ? `You can claim up to ${formatCurrency(pesos(cap))}. Lower or remove an item to submit.`
            : left === 0
              ? "Your claim uses up your budget, so none of it goes back to the training budget."
              : <>What&rsquo;s left of your budget, {formatCurrency(pesos(left))}, goes back to the training budget (Unallocated) when Finance validates your report.</>}
      </p>
    </CheckPanel>
  );
}

/** A cash advance request still with Finance: the budget it is for, and that the report comes after the release. */
function WaitingForRelease({ share }: { share: number }) {
  return (
    <div data-budget-panel="" data-mode="waiting" className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-snug text-blue-900">
      <Clock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        Your budget for this seminar, set by HR:{" "}
        <strong data-budget="share" className="font-bold tabular-nums">{formatCurrency(share)}</strong>. You file this
        report once Finance releases the cash advance.
      </p>
    </div>
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
