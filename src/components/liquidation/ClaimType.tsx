import { HandCoins, ReceiptText } from "lucide-react";
import { CLAIM_TYPES, ClaimType } from "../../types";

/**
 * The claim type a report was filed as (the instructor's note 10). It is shown on screen
 * only; the printed COA form does not carry it. A Liquidation settles a cash advance, and
 * a Reimbursement claims back money the employee paid out of their own pocket.
 */

const STYLE: Record<ClaimType, string> = {
  Liquidation: "border-blue-200 bg-blue-50 text-blue-700",
  Reimbursement: "border-purple-200 bg-purple-50 text-purple-700"
};

/** Compact marker for a list row. Shows nothing for a stale copy without a claim type. */
export function ClaimTypeBadge({ claimType }: { claimType?: ClaimType }) {
  if (!claimType || !STYLE[claimType]) return null;
  const Icon = claimType === "Liquidation" ? ReceiptText : HandCoins;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${STYLE[claimType]}`}
    >
      <Icon size={10} aria-hidden="true" />
      {claimType}
    </span>
  );
}

export type ClaimTypeFilterValue = "All" | ClaimType;

export function matchesClaimType(sub: { claimType?: ClaimType } | null | undefined, filter: ClaimTypeFilterValue): boolean {
  return filter === "All" || sub?.claimType === filter;
}

/** "All / Liquidation / Reimbursement", each with how many of the reports it would show. */
export function ClaimTypeFilter({
  value,
  onChange,
  items,
  label = "Filter by claim type"
}: {
  value: ClaimTypeFilterValue;
  onChange: (next: ClaimTypeFilterValue) => void;
  /** The reports being filtered, for the counts. */
  items: ({ claimType?: ClaimType } | null | undefined)[];
  /** Its accessible name, to tell several filters on one page apart. */
  label?: string;
}) {
  const count = (f: ClaimTypeFilterValue) => (items ?? []).filter(s => matchesClaimType(s, f)).length;
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as ClaimTypeFilterValue)}
      aria-label={label}
      className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-[10px] font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <option value="All">All claim types ({count("All")})</option>
      {CLAIM_TYPES.map(t => (
        <option key={t} value={t}>{t} ({count(t)})</option>
      ))}
    </select>
  );
}

/** When the filter hides every report in a list: says so, with the way back. */
export function ClaimTypeFilterEmpty({
  filter,
  onShowAll,
  what = "reports here"
}: {
  filter: ClaimTypeFilterValue;
  onShowAll: () => void;
  /** What the list holds, e.g. "claims ready to pay". */
  what?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
      <p className="text-xs font-semibold text-slate-600">No {filter} {what}.</p>
      <button
        type="button"
        onClick={onShowAll}
        className="mt-1 cursor-pointer rounded text-[11px] font-semibold text-blue-700 underline hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Show all claim types
      </button>
    </div>
  );
}
