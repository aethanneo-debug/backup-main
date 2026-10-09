import { ReactNode } from "react";
import { AlertTriangle, BadgeCheck, UserPlus, Users } from "lucide-react";
import { Signatory } from "../../types";
import { ACCOUNTANT, REPRESENTATIVE, activeInRole, displayDate, joinNames } from "./signatoryHelpers";

/**
 * Who can sign a liquidation report right now. The two warnings name what is blocked
 * (Finance validating, employees filing) so the Administrator sees why a gap matters.
 */

interface SignatorySummaryProps {
  /** null while the first load is still running: the strip shows placeholders. */
  signatories: Signatory[] | null;
  onAppoint: () => void;
  onAddRepresentative: () => void;
}

const CARD = "flex min-w-0 items-start gap-3 rounded-xl border p-4 shadow-sm";
const CAPTION = "font-mono text-[10px] font-bold uppercase tracking-wider";
const WARN_BUTTON =
  "mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500";

function OkCard({ icon, caption, children }: { icon: ReactNode; caption: string; children: ReactNode }) {
  return (
    <div className={`${CARD} border-slate-200 bg-white`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
        {icon}
      </span>
      <div className="min-w-0 text-xs text-slate-600">
        <p className={`${CAPTION} text-slate-500`}>{caption}</p>
        {children}
      </div>
    </div>
  );
}

function WarnCard({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <div className={`${CARD} border-amber-200 bg-amber-50`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-white text-amber-700">
        <AlertTriangle size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 text-xs text-amber-800">
        <p className="font-semibold">
          {title} — <span className="font-normal">{text}</span>
        </p>
        {action}
      </div>
    </div>
  );
}

export default function SignatorySummary({ signatories, onAppoint, onAddRepresentative }: SignatorySummaryProps) {
  if (signatories === null) {
    return (
      <div className="grid gap-3 lg:grid-cols-2" aria-hidden="true">
        {[0, 1].map(i => (
          <div key={i} className={`${CARD} animate-pulse border-slate-200 bg-white`}>
            <div className="h-9 w-9 rounded-lg bg-slate-100" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-2.5 w-28 rounded bg-slate-100" />
              <div className="h-3 w-48 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const accountants = activeInRole(signatories, ACCOUNTANT);
  const representatives = activeInRole(signatories, REPRESENTATIVE);
  const accountant = accountants[0];

  return (
    <section aria-label="Who signs liquidation reports now" className="grid gap-3 lg:grid-cols-2">
      {accountant ? (
        <OkCard icon={<BadgeCheck size={16} aria-hidden="true" />} caption="Accountant · Box C">
          <p className="mt-0.5 break-words text-sm text-slate-800">
            <strong>{accountant.fullName}</strong>, {accountant.position}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Effective {displayDate(accountant.effectiveFrom)}</p>
          {accountants.length > 1 && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              {accountants.length} Accountants are active, but only one should be. Mark the others Resigned / Replaced.
            </p>
          )}
        </OkCard>
      ) : (
        <WarnCard
          title="No active Accountant"
          text="Finance can't validate liquidation reports until one is appointed."
          action={
            <button type="button" onClick={onAppoint} className={WARN_BUTTON}>
              <BadgeCheck size={13} aria-hidden="true" />
              Appoint Accountant
            </button>
          }
        />
      )}

      {representatives.length > 0 ? (
        <OkCard icon={<Users size={16} aria-hidden="true" />} caption="Authorized Representatives · Box B">
          <p className="mt-0.5 text-sm text-slate-800">
            <strong>{representatives.length}</strong> active
          </p>
          <p className="mt-0.5 break-words text-[11px] text-slate-500">
            {representatives.length <= 3
              ? joinNames(representatives.map(r => r.fullName))
              : `${representatives.slice(0, 3).map(r => r.fullName).join(", ")} and ${representatives.length - 3} more`}
          </p>
        </OkCard>
      ) : (
        <WarnCard
          title="No active Authorized Representative"
          text="employees need at least one to file a liquidation report."
          action={
            <button type="button" onClick={onAddRepresentative} className={WARN_BUTTON}>
              <UserPlus size={13} aria-hidden="true" />
              Add representative
            </button>
          }
        />
      )}
    </section>
  );
}
