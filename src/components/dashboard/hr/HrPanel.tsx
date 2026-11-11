import { useId, type ReactNode } from "react";
import type { HrDashboard } from "../../../types";
import { LoadFailed, Skeleton } from "../LoadStates";
import type { ApiLoad } from "../useApiLoad";
import { TONE_BADGE, type BadgeTone } from "./hrFormat";

// The parts HR's dashboard panels share (12ag Part B), in the Administrator's dashboard's look (BudgetCharts.tsx).

/** One panel: its heading with an icon, a line on what it shows, an optional link at the right, then its content. */
export function HrPanel({ icon, title, description, action, busy = false, className = "", children }: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  busy?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} aria-busy={busy} className={`min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h3 id={titleId} className="flex items-center text-xs font-bold uppercase tracking-tight text-slate-800">
            <span className="mr-1.5 shrink-0 text-blue-600" aria-hidden="true">{icon}</span>
            <span className="min-w-0">{title}</span>
          </h3>
          {description && <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * A panel's content once HR's dashboard has loaded: a grey block while it loads, "couldn't be loaded" with the server's
 * reason and a Retry when it failed, else the content. Quiet: the cards above announce the failure, once.
 */
export function WhenLoaded({ load, what, skeleton = "h-40", children }: {
  load: ApiLoad<HrDashboard>;
  /** e.g. "The headcount couldn't be loaded." */
  what: string;
  skeleton?: string;
  children: (data: HrDashboard) => ReactNode;
}) {
  if (load.loading) return <Skeleton className={skeleton} />;
  if (load.failed || !load.data) return <LoadFailed quiet what={what} message={load.message} onRetry={load.retry} />;
  return <>{children(load.data)}</>;
}

/** A chart's table twin, folded: every figure without hovering. */
export function ShowFigures({ children }: { children: ReactNode }) {
  return (
    <details className="mt-2 text-[11px] text-slate-600">
      <summary className="cursor-pointer select-none rounded text-[10px] font-semibold text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        Show the figures
      </summary>
      {/* relative: the table's hidden caption stays inside this box (known-issues 12n). */}
      <div className="custom-scrollbar relative mt-2 max-h-80 overflow-auto">{children}</div>
    </details>
  );
}

/**
 * A chart's tooltip box. Recharts sizes it against the chart's own box, so a tooltip wider than a small chart (the
 * ring's) needs a width of its own (`className`), or its lines wrap a word at a time.
 */
export function TipBox({ children, className = "max-w-xs" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 shadow-lg ${className}`}>{children}</div>;
}

/** A tooltip's figures: a term and its value on each line. */
export function TipFigures({ lines }: { lines: [string, ReactNode][] }) {
  return (
    <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
      {lines.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-slate-500">{term}</dt>
          <dd className="text-right font-mono tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What a chart's colours mean. */
export function ChartKey({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600" aria-label="Chart key">
      {items.map(item => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
          <span className="min-w-0">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** A status badge in the house colours. */
export function Badge({ tone, children, className = "" }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${TONE_BADGE[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** A list row's way to its record ("View report", "View attendance"). */
export const OPEN_BUTTON =
  "inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

/** The header cell and body cell styles of the panels' small tables. */
export const TH = "py-1 pr-2 text-[10px] font-semibold text-slate-500";
export const TH_NUM = "py-1 pl-2 text-right text-[10px] font-semibold text-slate-500";
export const TD = "py-1 pr-2 align-top";
export const TD_NUM = "py-1 pl-2 text-right align-top font-mono tabular-nums";
