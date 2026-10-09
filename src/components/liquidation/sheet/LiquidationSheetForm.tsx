import React, { useState } from "react";
import { Plus } from "lucide-react";
import { ActiveSignatory, CorrectionField, LiquidationParticular, TRAINING_EXPENSE_CATEGORIES } from "../../../types";
import { newParticular, round2 } from "../ParticularsEditor";
import { CoaHeaderFields } from "../LiquidationCoaFields";
import { SHEET_FONT, amountText, longDate } from "./sheetFormat";
import { CertificationCell, SheetTotalRow } from "./SheetParts";
import CorrectionNote from "../resubmit/CorrectionNote";
import { CorrectionAccess } from "../resubmit/correctionModel";

/** Box B's value for "keep the representative copied when the report was filed". */
export const BOX_B_AS_FILED = "__as_filed__";

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
  /** A Reimbursement: paid out of pocket, so there is no advance and its DV boxes are off. */
  noAdvance?: boolean;
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
  /** Box B: the active Authorized Representatives the claimant chooses from. */
  representatives: ActiveSignatory[];
  representativeId: string;
  onRepresentativeChange: (id: string) => void;
  /** A returned report's Box B as copied at filing; offered as BOX_B_AS_FILED. */
  savedRepresentative?: { id?: string; name?: string; position?: string };
  representativeError?: string;
  /** Box C: the Accountant on duty, for information; Finance's validation records it. */
  accountant: ActiveSignatory | null;
  /** Correcting a returned report: which parts reopened, with the reviewer's notes. */
  correction?: Pick<CorrectionAccess, "editable" | "noteFor" | "lineIds">;
}

// Fillable boxes are tinted, like a fillable PDF, so the employee sees where to type while
// the page still reads as the printed form. Colours live only in the per-state strings, so
// no element ever carries two text, border or background colours competing for it.
const BASE =
  "rounded-none border-0 border-b px-1 py-0.5 placeholder:text-slate-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:text-slate-400";
const OPEN = `${BASE} border-slate-500 bg-blue-50 text-black focus:bg-white disabled:bg-transparent`;
const LOCKED = `${BASE} border-slate-500 bg-slate-100 text-slate-700`;
// A box a reviewer reopened for correction: amber like their notes, so it stands out from the
// locked ones (the blue fill-in tint is too close to the locked grey to tell apart).
const FIX = `${BASE} border-amber-600 bg-amber-50 text-black focus:bg-white disabled:bg-transparent`;
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
  noAdvance = false,
  refundDue,
  particulars,
  onParticularsChange,
  particularErrors = {},
  totalSpent,
  totalReleased,
  cashAdvance,
  disabled = false,
  representatives,
  representativeId,
  onRepresentativeChange,
  savedRepresentative,
  representativeError,
  accountant,
  correction,
}: LiquidationSheetFormProps) {
  const set = (patch: Partial<CoaHeaderFields>) => onCoaChange({ ...coa, ...patch });
  const rows = particulars ?? [];

  // Correcting a returned report: only the parts the reviewer reopened can change; the rest
  // shows as filed, in the locked style (the server ignores them anyway). With no
  // correction, everything is open.
  const can = (f: CorrectionField) => !correction || correction.editable(f);
  const note = (f: CorrectionField) => correction?.noteFor(f);
  const linesFree = can("particulars") && !correction?.lineIds;
  const lineOpen = (id: string) => can("particulars") && (!correction?.lineIds || correction.lineIds.includes(id));
  const open = correction ? FIX : OPEN;
  // Points a reopened part's inputs at the reviewer's note on it, for screen readers.
  const noteId = (f: CorrectionField) => (note(f) ? `note-${f}` : undefined);

  // Box B. A returned report keeps the copy made at filing ("as filed") unless another
  // representative is picked, so the sheet always shows what will print, even if that
  // person has since left or had their name or position edited.
  const asFiled = !!savedRepresentative?.name && representativeId === BOX_B_AS_FILED;
  const chosenRepresentative = asFiled
    ? { position: savedRepresentative!.position || "" }
    : (representatives ?? []).find((r) => r.id === representativeId);

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
                  readOnly={!can("periodCovered")}
                  onChange={(e) => set({ periodCoveredFrom: e.target.value })}
                  aria-label="Period covered from"
                  aria-describedby={noteId("periodCovered")}
                  className={`${can("periodCovered") ? open : LOCKED} font-bold`}
                />
                <span aria-hidden="true">-</span>
                <input
                  type="date"
                  value={coa.periodCoveredTo}
                  disabled={disabled}
                  readOnly={!can("periodCovered")}
                  min={coa.periodCoveredFrom || undefined}
                  onChange={(e) => set({ periodCoveredTo: e.target.value })}
                  aria-label="Period covered to"
                  aria-describedby={noteId("periodCovered")}
                  className={`${can("periodCovered") ? open : LOCKED} font-bold`}
                />
              </p>
              <div className="flex justify-center"><CorrectionNote id={noteId("periodCovered")} note={note("periodCovered")} /></div>
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
                  readOnly={!can("responsibilityCenterCode")}
                  onChange={(e) => set({ responsibilityCenterCode: e.target.value })}
                  placeholder="09-001-01"
                  aria-label="Responsibility center code"
                  aria-describedby={noteId("responsibilityCenterCode")}
                  className={`${can("responsibilityCenterCode") ? open : LOCKED} mx-auto mt-2 block w-[85%] text-center font-bold`}
                />
                <CorrectionNote id={noteId("responsibilityCenterCode")} note={note("responsibilityCenterCode")} />
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
          {note("particulars") && (
            <tr>
              <td colSpan={2} className="border-r-2 border-black px-2"><CorrectionNote id={noteId("particulars")} note={note("particulars")} /></td>
              <td />
            </tr>
          )}

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
                    readOnly={!lineOpen(p.id)}
                    onChange={(e) => update(p.id, { description: e.target.value })}
                    placeholder="e.g. Meals and incidentals, 12-13 Sept 2026"
                    aria-label={`Particular ${idx + 1} description`}
                    aria-invalid={rowError ? true : undefined}
                    aria-describedby={lineOpen(p.id) ? noteId("particulars") : undefined}
                    className={`w-full resize-none font-bold ${rowError ? INVALID : lineOpen(p.id) ? open : LOCKED}`}
                  />
                  {rowError && <p className="text-[11px] font-bold text-rose-700">{rowError}</p>}
                  {/* Screen-only bookkeeping: which budget line the expense is charged to. */}
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-600">
                    <label className="flex items-center gap-1">
                      Charged to
                      <select
                        value={p.category || "Miscellaneous"}
                        disabled={disabled || !lineOpen(p.id)}
                        onChange={(e) => update(p.id, { category: e.target.value as LiquidationParticular["category"] })}
                        aria-label={`Particular ${idx + 1} expense category`}
                        className={`${lineOpen(p.id) ? open : LOCKED} text-[11px]`}
                      >
                        {TRAINING_EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    {linesFree && (
                      <button
                        type="button"
                        onClick={() => removeRow(p.id)}
                        disabled={disabled}
                        aria-label={`Remove particular ${idx + 1}`}
                        className="ml-auto cursor-pointer text-[11px] text-slate-500 underline hover:text-rose-700 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-2 pt-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amountValue(p)}
                    disabled={disabled}
                    readOnly={!lineOpen(p.id)}
                    onChange={(e) => onAmountInput(p.id, e.target.value)}
                    onBlur={() => onAmountBlur(p.id)}
                    placeholder="0.00"
                    aria-label={`Particular ${idx + 1} amount in pesos`}
                    aria-describedby={lineOpen(p.id) ? noteId("particulars") : undefined}
                    className={`${lineOpen(p.id) ? open : LOCKED} w-full text-right font-bold tabular-nums`}
                  />
                </td>
              </tr>
            );
          })}

          <tr>
            <td colSpan={2} className="border-r-2 border-black px-2 pt-2">
              {linesFree && (
                <button
                  type="button"
                  onClick={() => onParticularsChange([...rows, newParticular()])}
                  disabled={disabled}
                  className="inline-flex cursor-pointer items-center gap-1 border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={11} aria-hidden="true" /> Add particular
                </button>
              )}
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
                  disabled={disabled || noAdvance}
                  readOnly={advanceOnRecord || !can("cashAdvance")}
                  onChange={(e) => set({ cashAdvanceDvNo: e.target.value })}
                  placeholder={noAdvance ? "None" : "2026-08-336"}
                  aria-label="Cash advance DV number"
                  aria-describedby={noteId("cashAdvance")}
                  className={`${advanceOnRecord || !can("cashAdvance") ? LOCKED : open} w-24 font-bold`}
                />
                {/* "DTD." stays with its date if the line has to wrap. */}
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  DTD.
                  <input
                    type="date"
                    value={coa.cashAdvanceDvDate}
                    disabled={disabled || noAdvance}
                    readOnly={advanceOnRecord || !can("cashAdvance")}
                    onChange={(e) => set({ cashAdvanceDvDate: e.target.value })}
                    aria-label="Cash advance DV date"
                    aria-describedby={noteId("cashAdvance")}
                    className={`${advanceOnRecord || !can("cashAdvance") ? LOCKED : open} text-[12px] font-bold`}
                  />
                </span>
                {note("cashAdvance") && <span className="basis-full"><CorrectionNote id={noteId("cashAdvance")} note={note("cashAdvance")} /></span>}
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
                aria-describedby={noteId("cashAdvance")}
                value={cashAdvance.value}
                onChange={(e) => cashAdvance.onChange(e.target.value)}
                onBlur={cashAdvance.onBlur}
                className={`${cashAdvance.locked ? LOCKED : open} w-36 text-right font-bold tabular-nums`}
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
                  readOnly={!can("refundOr")}
                  onChange={(e) => set({ refundOrNo: e.target.value })}
                  placeholder={refundDue ? "0247983" : "No refund due"}
                  aria-label="Refund OR number"
                  aria-describedby={noteId("refundOr")}
                  className={`${can("refundOr") ? open : LOCKED} w-24`}
                />
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  DTD.
                  <input
                    type="date"
                    value={coa.refundOrDate}
                    disabled={disabled || !refundDue}
                    readOnly={!can("refundOr")}
                    onChange={(e) => set({ refundOrDate: e.target.value })}
                    aria-label="Refund OR date"
                    aria-describedby={noteId("refundOr")}
                    className={`${can("refundOr") ? open : LOCKED} text-[12px]`}
                  />
                </span>
                {note("refundOr") && <span className="basis-full"><CorrectionNote id={noteId("refundOr")} note={note("refundOr")} /></span>}
              </span>
            }
            amount={<span className="font-bold tabular-nums">{amountText(refunded)}</span>}
          />
          <SheetTotalRow label="AMOUNT TO BE REIMBURSED" amount={<span className="font-bold tabular-nums">{amountText(reimbursed)}</span>} />

          {/* --- Certifications: A is the employee filing. B is the Authorized Representative
                the employee chooses here; C is the Accountant on duty, recorded when Finance
                validates. Both come from Utilities → Manage Signatories. --- */}
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
              nameSlot={
                <select
                  value={representativeId}
                  onChange={(e) => onRepresentativeChange(e.target.value)}
                  disabled={disabled || !can("representative")}
                  aria-label="Box B: Authorized Representative"
                  aria-required="true"
                  aria-invalid={!!representativeError}
                  aria-describedby={[representativeError && "sheet-box-b-error", noteId("representative")].filter(Boolean).join(" ") || undefined}
                  className={`${representativeError ? INVALID : can("representative") ? open : LOCKED} w-full text-center text-[12px] font-bold uppercase`}
                >
                  <option value="">— Choose representative —</option>
                  {savedRepresentative?.name && (
                    <option value={BOX_B_AS_FILED}>{savedRepresentative.name} (as filed)</option>
                  )}
                  {(representatives ?? []).map((r) => (
                    <option key={r.id} value={r.id}>{r.fullName}</option>
                  ))}
                </select>
              }
              caption={chosenRepresentative?.position || "Representative"}
              className="border-r-2 border-black"
            />
            <CertificationCell
              letter="C"
              statement="Supporting documents complete and proper"
              name={accountant?.fullName}
              caption={accountant?.position || "Accountant"}
              jevNo=""
            />
          </tr>
        </tbody>
      </table>
      {representativeError && (
        <p id="sheet-box-b-error" role="alert" className="mt-1 text-[12px] font-semibold text-rose-700">
          {representativeError}
        </p>
      )}
      {note("representative") && <CorrectionNote id={noteId("representative")} note={`Box B: ${note("representative")}`} />}

      {/* What the figures mean, in words — the same three cases the old summary showed,
          plus a Reimbursement, which has no advance to measure against. */}
      <p className={`mt-2 text-[12px] ${reimbursed > 0 ? "text-amber-700" : refunded > 0 ? "text-emerald-700" : "text-slate-600"}`}>
        {noAdvance
          ? "A reimbursement: there is no cash advance, so everything you spent is to be reimbursed."
          : reimbursed > 0
            ? "You spent more than the cash advance."
            : refunded > 0
              ? "Return this balance and record the OR."
              : "Fully liquidated - nothing to refund."}
      </p>
    </div>
  );
}
