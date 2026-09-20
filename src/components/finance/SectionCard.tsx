import React, { useId } from "react";

/**
 * The section card used down the Liquidation Desk.
 *
 * Navy is the brand, but four solid `bg-blue-600` bands stacked in one column read as a
 * wall rather than a hierarchy. The colour is therefore an accent here, not a fill: a
 * navy rule along the top edge, a navy icon and a navy count chip on a quiet slate
 * header. That keeps the HSAC identity while letting the actual content carry the page.
 * Saturated navy is reserved for primary actions and the single pipeline band.
 */
interface SectionCardProps {
  /** Small lucide icon. Pass `text-blue-600` and `aria-hidden`. */
  icon?: React.ReactNode;
  title: string;
  /** Right-hand hint in the header — one or two words, not a sentence. */
  caption?: string;
  /** Rendered immediately after the title, e.g. a <SectionCount>. */
  action?: React.ReactNode;
  /** Override the body padding, e.g. "" for a table that bleeds to the card edge. */
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}

export default function SectionCard({
  icon,
  title,
  caption,
  action,
  bodyClassName = "space-y-4 p-4",
  className = "",
  children
}: SectionCardProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={`overflow-hidden rounded-xl border border-slate-200 border-t-2 border-t-blue-600 bg-white shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h2
            id={headingId}
            className="truncate font-mono text-[10px] font-bold uppercase tracking-widest text-slate-700"
          >
            {title}
          </h2>
          {action}
        </div>
        {caption && (
          <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {caption}
          </span>
        )}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Count chip for the section header — the house badge pattern, navy tinted. */
export function SectionCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-bold text-blue-700">
      {children}
    </span>
  );
}
