import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../utils";

export interface Overspend {
  allocated: number;
  spent: number;
  /** spent − allocated, always > 0 when this object exists. */
  excess: number;
}

/**
 * Did this report spend more than HR set aside?
 *
 * `allocatedAtFiling` is stamped onto every submission server-side at filing time, and
 * `totalSpent` is derived from the claimant's own references — so both figures on a
 * report are trustworthy. Nothing compared them until now: HR and Finance were approving
 * an excess without being told there was one.
 *
 * Returns null when there is nothing to judge — no allocation on record (reports filed
 * before the stamp existed), or a zero allocation, where "over by everything" would be
 * noise rather than a finding.
 */
export function overspendOf(sub: any): Overspend | null {
  const allocated = Number(sub?.allocatedAtFiling);
  if (!isFinite(allocated) || allocated <= 0) return null;

  const spent = Number(sub?.totalSpent || 0);
  const excess = Math.round((spent - allocated) * 100) / 100;
  return excess > 0 ? { allocated, spent, excess } : null;
}

/** Compact marker for a list row. */
export function OverspendBadge({ over }: { over: Overspend }) {
  return (
    <span
      title={`Allocated ${formatCurrency(over.allocated)} · spent ${formatCurrency(over.spent)}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700"
    >
      <AlertTriangle size={10} aria-hidden="true" />
      Over by {formatCurrency(over.excess)}
    </span>
  );
}

/**
 * The full variance, for a screen where someone is about to approve.
 *
 * Deliberately worded as a fact needing a decision, not as an error: HSAC permits a
 * seminar to overspend its allocation, and HR and Finance are the ones who approve the
 * excess. The point is that they see it before they approve, not that it is wrong.
 */
export function OverspendNotice({ over }: { over: Overspend }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800">
        <AlertTriangle size={12} aria-hidden="true" />
        Spent over the allocation
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <span className="block font-mono text-[9px] font-semibold uppercase text-amber-700">HR Allocated</span>
          <strong className="font-mono text-xs text-slate-700">{formatCurrency(over.allocated)}</strong>
        </div>
        <div>
          <span className="block font-mono text-[9px] font-semibold uppercase text-amber-700">Actually Spent</span>
          <strong className="font-mono text-xs text-slate-700">{formatCurrency(over.spent)}</strong>
        </div>
        <div>
          <span className="block font-mono text-[9px] font-semibold uppercase text-amber-700">Excess</span>
          <strong className="font-mono text-xs text-amber-800">{formatCurrency(over.excess)}</strong>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-amber-800">
        Approving this report also approves the excess. Confirm the additional spending was
        justified before endorsing it.
      </p>
    </div>
  );
}
