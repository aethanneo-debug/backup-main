import React from "react";
import { formatCurrency } from "../../utils";
import { CalendarRange, Receipt, Banknote } from "lucide-react";

/** The COA Liquidation Report header fields the claimant fills in. */
export interface CoaHeaderFields {
  periodCoveredFrom: string;
  periodCoveredTo: string;
  responsibilityCenterCode: string;
  cashAdvanceDvNo: string;
  cashAdvanceDvDate: string;
  refundOrNo: string;
  refundOrDate: string;
}

export const emptyCoaHeaderFields: CoaHeaderFields = {
  periodCoveredFrom: "",
  periodCoveredTo: "",
  responsibilityCenterCode: "",
  cashAdvanceDvNo: "",
  cashAdvanceDvDate: "",
  refundOrNo: "",
  refundOrDate: "",
};

const labelClass = "text-[10px] font-bold text-slate-400 uppercase font-mono";
const inputClass =
  "w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className={labelClass}>{label}</label>
      {children}
      {hint ? <p className="font-mono text-[9px] leading-snug text-slate-400">{hint}</p> : null}
    </div>
  );
}

function SectionBar({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 bg-blue-600 px-3 py-2">
      {icon}
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-white">{title}</h3>
    </div>
  );
}

interface LiquidationCoaFieldsProps {
  value: CoaHeaderFields;
  onChange: (next: CoaHeaderFields) => void;
  /** OR fields open only when the cash advance exceeds what was actually spent. */
  refundEnabled: boolean;
  disabled?: boolean;
}

export default function LiquidationCoaFields({
  value,
  onChange,
  refundEnabled,
  disabled = false,
}: LiquidationCoaFieldsProps) {
  const set = (patch: Partial<CoaHeaderFields>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionBar
          icon={<CalendarRange size={13} className="text-blue-200" aria-hidden="true" />}
          title="Period Covered & Responsibility Center"
        />
        <div className="grid grid-cols-1 gap-4 p-3 md:grid-cols-3">
          <Field label="Period Covered (From)">
            <input
              type="date"
              value={value.periodCoveredFrom}
              disabled={disabled}
              onChange={(e) => set({ periodCoveredFrom: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Period Covered (To)">
            <input
              type="date"
              value={value.periodCoveredTo}
              disabled={disabled}
              min={value.periodCoveredFrom || undefined}
              onChange={(e) => set({ periodCoveredTo: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Responsibility Center Code" hint="As printed on the DV, e.g. 09-001-01">
            <input
              type="text"
              value={value.responsibilityCenterCode}
              disabled={disabled}
              onChange={(e) => set({ responsibilityCenterCode: e.target.value })}
              placeholder="09-001-01"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionBar
          icon={<Receipt size={13} className="text-blue-200" aria-hidden="true" />}
          title="Cash Advance & Refund References"
        />
        <div className="grid grid-cols-1 gap-4 p-3 md:grid-cols-4">
          <Field label="Cash Advance DV No.">
            <input
              type="text"
              value={value.cashAdvanceDvNo}
              disabled={disabled}
              onChange={(e) => set({ cashAdvanceDvNo: e.target.value })}
              placeholder="2026-08-336"
              className={inputClass}
            />
          </Field>
          <Field label="DV Date">
            <input
              type="date"
              value={value.cashAdvanceDvDate}
              disabled={disabled}
              onChange={(e) => set({ cashAdvanceDvDate: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field
            label="Refund OR No."
            hint={refundEnabled ? "Official Receipt for the returned balance" : "Only required when you refund a balance"}
          >
            <input
              type="text"
              value={value.refundOrNo}
              disabled={disabled || !refundEnabled}
              onChange={(e) => set({ refundOrNo: e.target.value })}
              placeholder={refundEnabled ? "0247983" : "No refund due"}
              className={inputClass}
            />
          </Field>
          <Field label="OR Date">
            <input
              type="date"
              value={value.refundOrDate}
              disabled={disabled || !refundEnabled}
              onChange={(e) => set({ refundOrDate: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/**
 * Live read-out of the three derived figures. `balance = released - spent`: positive is
 * money the claimant refunds per OR, negative is money the agency owes back. One stored
 * figure, split here only for display - exactly as the printed form splits it.
 */
export function SettlementSummary({
  totalReleased,
  totalSpent,
}: {
  totalReleased: number;
  totalSpent: number;
}) {
  const balance = Math.round((totalReleased - totalSpent) * 100) / 100;
  const isRefund = balance > 0;
  const isReimbursement = balance < 0;

  const balanceLabel = isReimbursement
    ? "Amount to be Reimbursed"
    : "Amount Refunded per OR No.";
  const balanceTone = isReimbursement
    ? "bg-amber-50 border-amber-200 text-amber-700"
    : isRefund
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : "bg-slate-50 border-slate-200 text-slate-600";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
          Amount of Cash Advance
        </p>
        <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-800">
          {formatCurrency(totalReleased)}
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
        <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-blue-700">
          Total Amount Spent
        </p>
        <p className="mt-1 font-mono text-sm font-bold tabular-nums text-blue-700">
          {formatCurrency(totalSpent)}
        </p>
        <p className="mt-0.5 font-mono text-[9px] text-blue-700">Derived from particulars</p>
      </div>

      <div className={`rounded-xl border p-3 shadow-sm ${balanceTone}`}>
        <p className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider">
          <Banknote size={11} aria-hidden="true" />
          {balanceLabel}
        </p>
        <p className="mt-1 font-mono text-sm font-bold tabular-nums">{formatCurrency(Math.abs(balance))}</p>
        <p className="mt-0.5 font-mono text-[9px]">
          {isReimbursement
            ? "You spent more than the cash advance."
            : isRefund
              ? "Return this balance and record the OR."
              : "Fully liquidated - nothing to refund."}
        </p>
      </div>
    </div>
  );
}
