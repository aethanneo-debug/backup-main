import type { ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

/** Grey blocks where content will be, while it loads (pulsing only for those who allow motion). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md bg-slate-100 motion-safe:animate-pulse ${className}`} />;
}

/** "Couldn't be loaded" with the server's reason when it gave one, and a Retry. */
export function LoadFailed({ what, message, onRetry, quiet = false, className = "" }: {
  /** e.g. "The seminars couldn't be loaded." */
  what: string;
  message?: string;
  onRetry: () => void;
  /** Not announced: another panel already alerts about the same failed load (one alert, not three at once). */
  quiet?: boolean;
  className?: string;
}) {
  return (
    <div role={quiet ? undefined : "alert"} className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 ${className}`}>
      <span className="flex min-w-0 flex-1 items-start gap-1.5 break-words">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0">{what}{message ? ` ${message}` : ""}</span>
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
      >
        <RefreshCcw size={12} aria-hidden="true" /> Retry
      </button>
    </div>
  );
}

/** Nothing to show yet: an icon, what is missing and, when there is one, what to do about it. */
export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden="true">{icon}</span>
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      {children && <p className="max-w-sm text-[11px] leading-snug text-slate-500">{children}</p>}
      {action}
    </div>
  );
}

/** The quiet link-button a panel's empty state or header offers ("Open Programs & Budget"). */
export function PanelLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1 rounded text-[11px] font-semibold text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {children}
    </button>
  );
}
