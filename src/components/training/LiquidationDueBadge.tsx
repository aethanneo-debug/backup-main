import { CalendarClock } from "lucide-react";
import { daysUntil, formatDate } from "../../utils";

// "Liquidation due <date>" with a countdown badge. Emerald while there is time,
// amber within the last 3 days, rose once overdue.
export default function LiquidationDueBadge({ dueDate }: { dueDate?: string | null }) {
  if (!dueDate) return null;

  const days = daysUntil(dueDate);
  const tone =
    days < 0 ? "bg-rose-50 text-rose-700 border-rose-200"
    : days <= 3 ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";
  const label =
    days < 0 ? `Overdue by ${-days} day${days === -1 ? "" : "s"}`
    : days === 0 ? "Due today"
    : `${days} day${days === 1 ? "" : "s"} left`;

  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="flex items-center gap-1.5 text-slate-600">
        <CalendarClock size={13} className="text-slate-400 shrink-0" />
        <span>
          Liquidation due <strong className="text-slate-800">{formatDate(dueDate)}</strong>
        </span>
      </span>
      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${tone}`}>{label}</span>
    </div>
  );
}
