import { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

// Small form building blocks shared by the signatory dialogs, so labels, hints, errors,
// notices and footer buttons look and behave the same in each.

export const CONTROL =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30";
/** A text box / select, outlined in rose while it has an error. */
export const control = (error?: string) => `${CONTROL} ${error ? "border-rose-400" : "border-slate-300"}`;
export const LABEL = "mb-1 block text-xs font-semibold text-slate-700";
export const HINT = "mt-1 text-[11px] leading-relaxed text-slate-500";

export const CANCEL_BUTTON =
  "cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
/** Footer action button; add the colour classes (navy for saving, rose for ending a term). */
export const ACTION_BUTTON =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

/** Label above, then the control, its hint and its error. Ids: `${id}-hint`, `${id}-error`. */
export function FormField({ id, label, required, hint, error, children }: {
  id: string; label: string; required?: boolean; hint?: ReactNode; error?: string; children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
        {required && <span className="text-rose-600" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <p id={`${id}-hint`} className={HINT}>{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-[11px] font-medium text-rose-700">{error}</p>}
    </div>
  );
}

/** The aria-describedby value for a FormField control: its hint, then its error. */
export const describedBy = (id: string, hasHint: boolean, error?: string) =>
  [hasHint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

const TONES = {
  amber: { cls: "border-amber-200 bg-amber-50 text-amber-800", Icon: AlertTriangle },
  blue: { cls: "border-blue-200 bg-blue-50 text-blue-800", Icon: Info },
  rose: { cls: "border-rose-200 bg-rose-50 text-rose-800", Icon: AlertTriangle }
} as const;

/** A boxed note with an icon, so colour is never the only signal. */
export function Notice({ tone, id, role, children }: {
  tone: keyof typeof TONES; id?: string; role?: "alert"; children: ReactNode;
}) {
  const { cls, Icon } = TONES[tone];
  return (
    <p id={id} role={role} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${cls}`}>
      <Icon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
