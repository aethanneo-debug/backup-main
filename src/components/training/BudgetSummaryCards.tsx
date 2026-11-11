import type { ReactNode } from "react";
import { AlertTriangle, BookOpen, PiggyBank, Target, type LucideIcon } from "lucide-react";
import { formatCurrency } from "../../utils";

/**
 * Programs & Budget's figures for the year's training budget: what HR allocated, what is free, and what the seminars
 * gave back to it (the user's request of 2026-11-10, known-issues 12af), with the sum that joins them. Every figure comes
 * from the page, priced as it prices its rows (src/trainingBudget.ts), an edit not yet saved included.
 *
 * Three across from 1024 px, a size smaller until 1280 px so the amounts fit beside the sidebar; on a tablet two, with
 * the third under them; on a phone one, without the icons.
 */
export default function BudgetSummaryCards({ total, allocated, unallocated, returned, over }: {
  /** The year's Overall Total Budget. */
  total: number;
  /** What the seminars are allocated, rows being added or edited included. */
  allocated: number;
  /** The total less what the seminars take. */
  unallocated: number;
  /** What the seminars gave back to Unallocated (`budgetReturns`). */
  returned: number;
  /** What some take beyond their allocations, out of Unallocated (`budgetReturns`). */
  over: number;
}) {
  const short = unallocated < 0;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 xl:gap-6">
        <Card icon={BookOpen} iconTone="bg-green-50 text-green-600" label="Total Allocated" value={formatCurrency(allocated)} />
        <Card
          icon={short ? AlertTriangle : Target}
          iconTone={short ? "bg-red-100 text-red-600" : "bg-purple-50 text-purple-600"}
          tone={short ? "border-red-500 bg-red-50" : unallocated < 50000 ? "border-orange-500 bg-orange-50" : "border-slate-200"}
          label="Unallocated"
          labelTone={short ? "text-red-700" : "text-slate-500"}
          value={formatCurrency(unallocated)}
          valueTone={short ? "text-red-700" : "text-slate-800"}
        />
        {/* What came back: emerald, as each seminar's own "Returned to Unallocated" note in the table. Last, so the card
            that is Unallocated itself still comes first. */}
        <Card
          name="returned"
          icon={PiggyBank}
          iconTone="bg-emerald-50 text-emerald-700"
          tone="border-slate-200 md:col-span-2 lg:col-span-1"
          label="Returned to Unallocated"
          value={formatCurrency(returned)}
          valueTone="text-emerald-700"
        >
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Leftovers handed back on liquidated reports, the shares of those who didn&rsquo;t attend, and what closed
            seminars didn&rsquo;t spend.
          </p>
          {over > 0 && (
            <p data-budget-card="over" className="mt-1 text-[11px] font-semibold leading-snug text-amber-700">
              {formatCurrency(over)} spent or held beyond seminars&rsquo; allocations (taken from Unallocated)
            </p>
          )}
        </Card>
      </div>
      {/* The figures as one sum, so it is plain why Unallocated isn't just the total less what is allocated. */}
      <p data-budget-card="sum" className="text-[11px] leading-snug text-slate-500">
        Unallocated = Overall Total Budget {formatCurrency(total)} − Total Allocated {formatCurrency(allocated)} + Returned{" "}
        {formatCurrency(returned)}
        {over > 0 ? ` − taken beyond allocations ${formatCurrency(over)}` : ""} ={" "}
        <span className="font-semibold text-slate-700">{formatCurrency(unallocated)}</span>
      </p>
    </div>
  );
}

/** One figure. `name` marks the card and its amount for finding them (data-budget-card, "returned-amount"). */
function Card({ name, icon: Icon, iconTone, tone = "border-slate-200", label, labelTone = "text-slate-500", value, valueTone = "text-slate-800", children }: {
  name?: string;
  icon: LucideIcon;
  iconTone: string;
  /** The card's border, and any tint or grid span. */
  tone?: string;
  label: string;
  labelTone?: string;
  value: string;
  valueTone?: string;
  children?: ReactNode;
}) {
  return (
    <div data-budget-card={name} className={`bg-white rounded-xl shadow-sm border p-4 xl:p-6 flex items-center gap-3 xl:gap-4 ${tone}`}>
      <div className={`w-10 h-10 xl:w-12 xl:h-12 shrink-0 rounded-full hidden sm:flex items-center justify-center ${iconTone}`} aria-hidden="true">
        <Icon size={22} />
      </div>
      {/* (break-words: on a phone, where the sidebar leaves about 100 px, nothing runs out of the card.) */}
      <div className="min-w-0 break-words">
        <p className={`text-sm font-medium mb-1 ${labelTone}`}>{label}</p>
        <h3 data-budget-card={name ? `${name}-amount` : undefined} className={`text-xl xl:text-2xl font-bold ${valueTone}`}>
          {value}
        </h3>
        {children}
      </div>
    </div>
  );
}
