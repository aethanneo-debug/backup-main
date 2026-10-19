// Money for liquidation reports, worked out in whole centavos so sums never drift (₱0.10 +
// ₱0.20 is ₱0.30, not 0.30000000000000004). Amounts are stored as pesos with two decimals;
// every sum, difference and comparison goes through centavos first. Used by both server.ts
// and the employee's form, so the balance the form shows is the balance the server records.

/** A peso amount as whole centavos. Anything that isn't a finite number counts as 0. */
export function centavos(pesos: number | string | null | undefined): number {
  const n = Number(pesos);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Whole centavos back to pesos with two decimals. */
export function pesos(cents: number): number {
  return Math.round(cents) / 100;
}

/** The total of some peso amounts, added up in centavos. */
export function sumPesos(amounts: Array<number | string | null | undefined>): number {
  return pesos((amounts ?? []).reduce<number>((s, a) => s + centavos(a), 0));
}

export type LiquidationBalanceStatus = "Balanced" | "Not balanced" | "Over";

export interface LiquidationBalance {
  /** Balanced: the items use up the cash advance exactly. Not balanced: some is left to hand
   * back. Over: the items come to more than the advance, which a seminar report may not. */
  status: LiquidationBalanceStatus;
  /** What is left of the advance (0 when balanced or over). */
  leftover: number;
  /** How far the items go past the advance (0 unless over). */
  over: number;
}

/** How a report's items stand against its cash advance. */
export function liquidationBalance(advance: number | string, itemsTotal: number | string): LiquidationBalance {
  const diff = centavos(advance) - centavos(itemsTotal);
  if (diff === 0) return { status: "Balanced", leftover: 0, over: 0 };
  return diff > 0
    ? { status: "Not balanced", leftover: pesos(diff), over: 0 }
    : { status: "Over", leftover: 0, over: pesos(-diff) };
}
