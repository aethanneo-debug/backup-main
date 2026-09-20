import React, { useState } from "react";
import { LiquidationParticular, TRAINING_EXPENSE_CATEGORIES } from "../../types";
import { formatCurrency } from "../../utils";
import { Plus, Trash2, ListPlus } from "lucide-react";

interface ParticularsEditorProps {
  particulars: LiquidationParticular[];
  onChange: (next: LiquidationParticular[]) => void;
  /** Running sum of the rows - shown read-only as TOTAL AMOUNT SPENT. */
  total: number;
  /** Per-row validation messages keyed by particular id. */
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function newParticular(): LiquidationParticular {
  return {
    id: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: "",
    amount: 0,
    // Matches the server's fallback, so an untouched picker and an absent one agree.
    category: "Miscellaneous",
  };
}

// PHP: round at the boundary so the running total never drifts from the server's sum.
export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function sumParticulars(particulars: LiquidationParticular[]): number {
  return round2((particulars ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
}

/** Rows the server will actually keep - a blank row is skipped, never an error. */
export function filledParticulars(particulars: LiquidationParticular[]): LiquidationParticular[] {
  return (particulars ?? []).filter(
    (p) => (p.description || "").trim() !== "" || (Number(p.amount) || 0) !== 0
  );
}

/**
 * The PARTICULARS block of the COA Liquidation Report, as an editor.
 *
 * The total is derived here and re-derived server-side from the same rows, so the
 * claimant can never type a TOTAL AMOUNT SPENT that disagrees with its line items.
 */
export default function ParticularsEditor({
  particulars,
  onChange,
  total,
  errors = {},
  disabled = false,
}: ParticularsEditorProps) {
  const rows = particulars ?? [];

  // What the user is mid-way through typing in an amount box, keyed by row id. Without
  // this, rendering the parsed number back into the input makes "0.50" impossible to
  // type: the leading "0" would be normalised away before the decimal point arrives.
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});

  function update(id: string, patch: Partial<LiquidationParticular>) {
    onChange(rows.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function onAmountInput(id: string, raw: string) {
    setAmountDrafts((d) => ({ ...d, [id]: raw }));
    const parsed = raw === "" ? 0 : Number(raw);
    update(id, { amount: Number.isFinite(parsed) ? parsed : 0 });
  }

  function onAmountBlur(id: string) {
    // Drop the draft so the row re-renders from its stored, rounded number.
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

  function addRow() {
    onChange([...rows, newParticular()]);
  }

  function removeRow(id: string) {
    setAmountDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    const next = rows.filter((p) => p.id !== id);
    onChange(next.length > 0 ? next : [newParticular()]);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Section header - HSAC navy */}
      <div className="flex items-center justify-between gap-2 bg-blue-600 px-3 py-2">
        <div className="flex items-center gap-2">
          <ListPlus size={13} className="text-blue-200" aria-hidden="true" />
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-white">
            Particulars
          </h3>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-blue-200">
          Itemise every expense charged to the cash advance
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th
                scope="col"
                className="w-8 px-2 py-1.5 text-center font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400"
              >
                #
              </th>
              <th
                scope="col"
                className="px-2 py-1.5 text-left font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400"
              >
                Description
              </th>
              <th
                scope="col"
                className="w-44 px-2 py-1.5 text-left font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400"
              >
                Charged To
              </th>
              <th
                scope="col"
                className="w-40 px-2 py-1.5 text-right font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400"
              >
                Amount (PHP)
              </th>
              <th scope="col" className="w-10 px-2 py-1.5">
                <span className="sr-only">Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, idx) => {
              const rowError = errors[p.id];
              return (
                <tr key={p.id} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-1.5 text-center font-mono text-[10px] text-slate-400">{idx + 1}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={p.description}
                      disabled={disabled}
                      onChange={(e) => update(p.id, { description: e.target.value })}
                      placeholder="e.g. Meals and incidentals, 12-13 Sept 2026"
                      aria-label={`Particular ${idx + 1} description`}
                      aria-invalid={rowError ? true : undefined}
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100 ${
                        rowError ? "border-rose-300 bg-rose-50" : "border-slate-200"
                      }`}
                    />
                    {rowError && (
                      <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-wider text-rose-700">
                        {rowError}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={p.category || "Miscellaneous"}
                      disabled={disabled}
                      onChange={(e) => update(p.id, { category: e.target.value as LiquidationParticular["category"] })}
                      aria-label={`Particular ${idx + 1} expense category`}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100"
                    >
                      {TRAINING_EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
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
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right font-mono text-xs tabular-nums text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(p.id)}
                      disabled={disabled}
                      aria-label={`Remove particular ${idx + 1}`}
                      title="Remove this line"
                      className="cursor-pointer rounded p-1 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50">
              <td colSpan={3} className="px-2 py-2">
                <button
                  type="button"
                  onClick={addRow}
                  disabled={disabled}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={11} aria-hidden="true" />
                  Add Particular
                </button>
              </td>
              <td className="border-t-2 border-slate-300 px-2 py-2 text-right">
                <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Total Amount Spent
                </span>
                <span className="block font-mono text-sm font-bold tabular-nums text-blue-700">
                  {formatCurrency(total)}
                </span>
              </td>
              <td className="border-t-2 border-slate-300" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
