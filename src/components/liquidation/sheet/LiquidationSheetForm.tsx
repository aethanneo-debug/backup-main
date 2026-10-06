import React, { useState } from "react";
import { Plus } from "lucide-react";
import { LiquidationParticular, TRAINING_EXPENSE_CATEGORIES } from "../../../types";
import { newParticular, round2 } from "../ParticularsEditor";
import { CoaHeaderFields } from "../LiquidationCoaFields";
import { SHEET_FONT, amountText, longDate } from "./sheetFormat";
import { CertificationCell, SheetTotalRow } from "./SheetParts";

/** The cash advance box. Its rules live with the rest of the form's state in the portal. */
export interface SheetCashAdvanceField {
  value: string;
  /** Finance recorded the advance: the amount is theirs, not the employee's to type. */
  locked: boolean;
  onChange: (raw: string) => void;
  onBlur: () => void;
  ariaLabel: string;
}

interface LiquidationSheetFormProps {
  /** Known only once the report has been filed. */
  serialNo?: string;
  /** The filing date the report will carry (YYYY-MM-DD or ISO). */
  date: string;
  employeeName: string;
  coa: CoaHeaderFields;
  onCoaChange: (next: CoaHeaderFields) => void;
  /** The DV reference comes from Finance's record, so its fields are read-only. */
  advanceOnRecord: boolean;
  /** The OR fields open only when part of the advance is being returned. */
  refundDue: boolean;
  particulars: LiquidationParticular[];
  onParticularsChange: (next: LiquidationParticular[]) => void;
  particularErrors?: Record<string, string>;
  /** TOTAL AMOUNT SPENT — derived from the lines, never typed. */
  totalSpent: number;
  totalReleased: number;
  cashAdvance: SheetCashAdvanceField;
  disabled?: boolean;
}

// Fillable boxes are tinted, like a fillable PDF, so the employee sees where to type while
// the page still reads as the printed form. Colours live only in the per-state strings, so
// no element ever carries two text, border or background colours competing for it.
const BASE =
  "rounded-none border-0 border-b px-1 py-0.5 placeholder:text-slate-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:text-slate-400";
const OPEN = `${BASE} border-slate-500 bg-blue-50 text-black focus:bg-white disabled:bg-transparent`;
const LOCKED = `${BASE} border-slate-500 bg-slate-100 text-slate-700`;
const INVALID = `${BASE} border-rose-500 bg-rose-50 text-black`;

/**
 * The Liquidation Report as the filing form: the same sheet as the printed report
 * (LiquidationReportForm), with its blanks as inputs. It holds no data of its own beyond
 * what is being typed into an amount; every value and rule is the portal's.
 */
export default function LiquidationSheetForm({
  serialNo,
  date,
  employeeName,
  coa,
  onCoaChange,
  advanceOnRecord,
  refundDue,
  particulars,
  onParticularsChange,
  particularErrors = {},
  totalSpent,
  totalReleased,
  cashAdvance,
  disabled = false,
}: LiquidationSheetFormProps) {
  const set = (patch: Partial<CoaHeaderFields>) => onCoaChange({ ...coa, ...patch });
  const rows = particulars ?? [];

  // What is mid-way through being typed in an amount box, keyed by row. Without it the
  // parsed number is rendered back and "0.50" cannot be typed: the "0" would be normalised
  // away before the decimal point arrives.
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});

  function update(id: string, patch: Partial<LiquidationParticular>) {
    onParticularsChange(rows.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function onAmountInput(id: string, raw: string) {
    setAmountDrafts((d) => ({ ...d, [id]: raw }));
    const parsed = raw === "" ? 0 : Number(raw);
    update(id, { amount: Number.isFinite(parsed) ? parsed : 0 });
  }
  function onAmountBlur(id: string) {
    setAmountDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    const row = rows.find((p) => p.id === id);
    if (row) update(id, { amount: round2(row.amount) });
  }
  function amountValue(p: LiquidationParticular): string {
    if (amountDrafts[p.id] !== undefined) return amountDrafts[p.id];
    return (Number(p.amount) || 0) === 0 ? "" : String(p.amount);
  }
  function removeRow(id: string) {
    setAmountDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    const next = rows.filter((p) => p.id !== id);
    onParticularsChange(next.length > 0 ? next : [newParticular()]);
  }

  const balance = round2(totalReleased - totalSpent);
  const refunded = balance > 0 ? balance : 0;
  const reimbursed = balance < 0 ? Math.abs(balance) : 0;
  const bodySpace = Math.max(36, 150 - 60 * rows.length);

  return (
    <div className="min-w-[680px] bg-white p-4 text-black" style={{ fontFamily: SHEET_FONT }} role="group" aria-label="Liquidation Report">
      <table className="w-full table-fixed border-collapse border border-black text-[13px] leading-snug">
        <colgroup>
          <col style={{ width: "33%" }} />
          <col style={{ width: "33%" }} />
          <col style={{ width: "34%" }} />
        </colgroup>
        <tbody>
          {/* --- Title block --- */}
          <tr>
            <td colSpan={2} className="border-r-2 border-b-2 border-black px-2 pt-3 pb-2 align-top">
              <p className="text-center text-[17px] font-bold">LIQUIDATION REPORT</p>
              <p className="mt-1 flex flex-wrap items-center justify-center gap-1">
                Period Covered:
                <input
                  type="date"
                  value={coa.periodCoveredFrom}
                  disabled={disabled}
                  onChange={(e) => set({ periodCoveredFrom: e.target.value })}
                  aria-label="Period covered from"
                  className={`${OPEN} font-bold`}
                />
                <span aria-hidden="true">-</span>
                <input
                  type="date"
                  value={coa.periodCoveredTo}
                  disabled={disabled}
                  min={coa.periodCoveredFrom || undefined}
                  onChange={(e) => set({ periodCoveredTo: e.target.value })}
                  aria-label="Period covered to"
                  className={`${OPEN} font-bold`}
                />
              </p>
              <div className="mt-5 font-bold">
                <p>Entity Name : HSAC-RAB I</p>
                <p>Fund Cluster : 01 - Regular Fund</p>
              </div>
            </td>
            <td className="border-b-2 border-black p-0 align-top">
              <div className="px-1.5 pt-3 pb-3">
                <p>
                  Serial No.:{" "}
                  {serialNo ? <b>{serialNo}</b> : <span className="italic text-slate-500">assigned when filed</span>}
                </p>
                <p>
                  Date: <b>{longDate(date)}</b>
                </p>
              </div>
              <div className="border-t border-black px-1.5 pt-1 pb-2.5">
                <p>Responsibility Center Code:</p>
                <input
                  type="text"
                  value={coa.responsibilityCenterCode}
                  disabled={disabled}
                  onChange={(e) => set({ responsibilityCenterCode: e.target.value })}
                  placeholder="09-001-01"
                  aria-label="Responsibility center code"
                  className={`${OPEN} mx-auto mt-2 block w-[85%] text-center font-bold`}
                />
              </div>
            </td>
          </tr>

          {/* --- Column headings --- */}
          <tr>
            <th colSpan={2} scope="col" className="border-r-2 border-b border-black py-2 text-center font-normal">
              PARTICULARS
            </th>
            <th scope="col" className="border-b border-black py-2 text-center font-bold">
              AMOUNT
            </th>
          </tr>

          {/* --- Particulars --- */}
          {rows.map((p, idx) => {
            const rowError = particularErrors[p.id];
            return (
              <tr key={p.id} className="align-top">
                <td colSpan={2} className="border-r-2 border-black px-2 pt-2">
                  <textarea
                    rows={2}
                    value={p.description}
                    disabled={disabled}
                    onChange={(e) => update(p.id, { description: e.target.value })}
                    placeholder="e.g. Meals and incidentals, 12-13 Sept 2026"
                    aria-label={`Particular ${idx + 1} description`}
                    aria-invalid={rowError ? true : undefined}
                    className={`w-full resize-none font-bold ${rowError ? INVALID : OPEN}`}
                  />
                  {rowError && <p className="text-[11px] font-bold text-rose-700">{rowError}</p>}
                  {/* Screen-only bookkeeping: which budget line the expense is charged to. */}
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-600">
                    <label className="flex items-center gap-1">
                      Charged to
                      <select
                        value={p.category || "Miscellaneous"}
                        disabled={disabled}
                        onChange={(e) => update(p.id, { category: e.target.value as LiquidationParticular["category"] })}
                        aria-label={`Particular ${idx + 1} expense category`}
                        className={`${OPEN} text-[11px]`}
                      >
                        {TRAINING_EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRow(p.id)}
                      disabled={disabled}
                      aria-label={`Remove particular ${idx + 1}`}
                      className="ml-auto cursor-pointer text-[11px] text-slate-500 underline hover:text-rose-700 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                </td>
                <td className="px-2 pt-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amountValue(p)}
                    disabled={disabled}
                    onChange={(e) => onAmountInput(p.id, e.target.value)}
                    onBlur={() => onAmountBlur(p.id)}
                    placeholder="0.00"
                    aria-label={`Particular ${idx + 1} amount in pesos`}
                    className={`${OPEN} w-full text-right font-bold tabular-nums`}
                  />
                </td>
              </tr>
            );
          })}

          <tr>
            <td colSpan={2} className="border-r-2 border-black px-2 pt-2">
              <button
                type="button"
                onClick={() => onParticularsChange([...rows, newParticular()])}
                disabled={disabled}
                className="inline-flex cursor-pointer items-center gap-1 border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={11} aria-hidden="true" /> Add particular
              </button>
            </td>
            <td />
          </tr>

          {/* COA closing rule - nothing may be added below this line. */}
          <tr>
            <td colSpan={2} className="border-r-2 border-black px-2 pt-1 pb-1 text-center italic">
              -- NOTHING FOLLOWS ---
            </td>
            <td />
          </tr>
          <tr aria-hidden="true">
            <td colSpan={2} className="border-r-2 border-b-2 border-black" style={{ height: bodySpace }} />
            <td className="border-b-2 border-black" />
          </tr>

          {/* --- Totals --- */}
          <SheetTotalRow label="TOTAL AMOUNT SPENT" amount={<span className="font-bold tabular-nums">{amountText(totalSpent)}</span>} />
          <SheetTotalRow
            label={
              <span className="flex flex-wrap items-center gap-1">
                AMOUNT OF CASH ADVANCE PER DV NO.
                <input
                  type="text"
                  value={coa.cashAdvanceDvNo}
                  disabled={disabled}
                  readOnly={advanceOnRecord}
                  onChange={(e) => set({ cashAdvanceDvNo: e.target.value })}
                  placeholder="2026-08-336"
                  aria-label="Cash advance DV number"
                  className={`${advanceOnRecord ? LOCKED : OPEN} w-24 font-bold`}
                />
                {/* "DTD." stays with its date if the line has to wrap. */}
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  DTD.
                  <input
                    type="date"
                    value={coa.cashAdvanceDvDate}
                    disabled={disabled}
                    readOnly={advanceOnRecord}
                    onChange={(e) => set({ cashAdvanceDvDate: e.target.value })}
                    aria-label="Cash advance DV date"
                    className={`${advanceOnRecord ? LOCKED : OPEN} text-[12px] font-bold`}
                  />
                </span>
              </span>
            }
            amount={
              <input
                type={cashAdvance.locked ? "text" : "number"}
                min="0"
                step="0.01"
                disabled={disabled}
                readOnly={cashAdvance.locked}
                aria-label={cashAdvance.ariaLabel}
                value={cashAdvance.value}
                onChange={(e) => cashAdvance.onChange(e.target.value)}
                onBlur={cashAdvance.onBlur}
                className={`${cashAdvance.locked ? LOCKED : OPEN} w-36 text-right font-bold tabular-nums`}
              />
            }
          />
          <SheetTotalRow
            label={
              <span className="flex flex-wrap items-center gap-1">
                AMOUNT REFUNDED PER OR NO.
                <input
                  type="text"
                  value={coa.refundOrNo}
                  disabled={disabled || !refundDue}
                  onChange={(e) => set({ refundOrNo: e.target.value })}
                  placeholder={refundDue ? "0247983" : "No refund due"}
                  aria-label="Refund OR number"
                  className={`${OPEN} w-24`}
                />
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  DTD.
                  <input
                    type="date"
                    value={coa.refundOrDate}
                    disabled={disabled || !refundDue}
                    onChange={(e) => set({ refundOrDate: e.target.value })}
                    aria-label="Refund OR date"
                    className={`${OPEN} text-[12px]`}
                  />
                </span>
              </span>
            }
            amount={<span className="font-bold tabular-nums">{amountText(refunded)}</span>}
          />
          <SheetTotalRow label="AMOUNT TO BE REIMBURSED" amount={<span className="font-bold tabular-nums">{amountText(reimbursed)}</span>} />

          {/* --- Certifications: A is the employee filing; B and C are signed after validation. --- */}
          <tr>
            <CertificationCell
              letter="A"
              statement="Correctness of the above data"
              name={employeeName}
              caption="Employee Name"
              signedAt={date}
              className="border-r border-black"
            />
            <CertificationCell
              letter="B"
              statement="Purpose of travel / cash advance duly accomplished"
              caption="Representative"
              className="border-r-2 border-black"
            />
            <CertificationCell
              letter="C"
              statement="Supporting documents complete and proper"
              caption="Accountant III"
              jevNo=""
            />
          </tr>
        </tbody>
      </table>

      {/* What the figures mean, in words — the same three cases the old summary showed. */}
      <p className={`mt-2 text-[12px] ${reimbursed > 0 ? "text-amber-700" : refunded > 0 ? "text-emerald-700" : "text-slate-600"}`}>
        {reimbursed > 0
          ? "You spent more than the cash advance."
          : refunded > 0
            ? "Return this balance and record the OR."
            : "Fully liquidated - nothing to refund."}
      </p>
    </div>
  );
}
