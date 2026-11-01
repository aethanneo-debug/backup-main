import { LiquidationParticular } from "../../types";
import { isBlankExpenseLine } from "../../expenseLines";
import { sumPesos } from "../../liquidationMoney";

// A row of the form's PARTICULARS block. It starts with no expense type: the employee chooses one.
export function newParticular(): LiquidationParticular {
  return {
    id: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: "",
    amount: 0,
  };
}

// PHP: round at the boundary so the running total never drifts from the server's sum.
export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Added up in whole centavos, as the server does (src/liquidationMoney.ts), so the total the
// form shows is the total the server records.
export function sumParticulars(particulars: LiquidationParticular[]): number {
  return sumPesos((particulars ?? []).map((p) => p.amount));
}

/** Rows the server will actually keep - a blank row is skipped, never an error. */
export function filledParticulars(particulars: LiquidationParticular[]): LiquidationParticular[] {
  return (particulars ?? []).filter((p) => !isBlankExpenseLine(p));
}
