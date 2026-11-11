// The training budget charts' colours and amounts (12ag).

/** HSAC navy (blue-600): what the seminars take. */
export const NAVY = "#001d85";
/** blue-350: what HR allocated; the lightest blue that keeps 3:1 against white, beside navy's "taken". */
export const ALLOCATED_BLUE = "#6b8eff";
/** emerald-500: the budget still free (Unallocated). */
export const FREE_GREEN = "#10b981";

/** ₱0, ₱500, ₱5K, ₱12.5K, ₱1.2M: compact from 1,000 up, for an axis. */
export function compactPeso(n: number): string {
  const v = Number(n) || 0;
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  // Rounding can carry into the next unit (₱999,950 is ₱1000.0K): that is ₱1M, not "₱1000K".
  if (a >= 1_000_000 || +(a / 1_000).toFixed(1) >= 1_000) return `${sign}₱${+(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000 || +a.toFixed(2) >= 1_000) return `${sign}₱${+(a / 1_000).toFixed(1)}K`;
  return `${sign}₱${+a.toFixed(2)}`;
}

/** Whole percent of `part` in `whole`; null when there is no whole to measure against. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}
