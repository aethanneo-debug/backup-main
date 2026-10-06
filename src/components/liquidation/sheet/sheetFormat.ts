// How HSAC RAB 1's Excel liquidation sheet writes dates and amounts. Shared by the printed
// report and the filing form, so the two can never disagree.

export const SHEET_FONT = 'Cambria, "Times New Roman", Times, serif';

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = MONTHS.map((m) => m.slice(0, 3));

// Calendar parts of "2026-09-16" or an ISO timestamp. A bare date is read as a calendar
// date, never through UTC, so the printed day cannot slip a day in another time zone.
function dateParts(value?: string | null): { y: number; m: number; d: number } | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (plain) return { y: Number(plain[1]), m: Number(plain[2]) - 1, d: Number(plain[3]) };
  const t = new Date(s);
  return isNaN(t.getTime()) ? null : { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
}

/** "September 21, 2026" */
export function longDate(value?: string | null): string {
  const p = dateParts(value);
  return p ? `${MONTHS[p.m]} ${p.d}, ${p.y}` : "";
}

/** "17-Aug-2026", as the totals block writes DV and OR dates. */
export function sheetDate(value?: string | null): string {
  const p = dateParts(value);
  return p ? `${String(p.d).padStart(2, "0")}-${MON[p.m]}-${p.y}` : "";
}

/** "September 16 - 18, 2026"; spans across months or years keep both ends readable. */
export function periodRange(from?: string | null, to?: string | null): string {
  const a = dateParts(from);
  const b = dateParts(to);
  if (a && b) {
    if (a.y === b.y && a.m === b.m && a.d === b.d) return longDate(from);
    if (a.y === b.y && a.m === b.m) return `${MONTHS[a.m]} ${a.d} - ${b.d}, ${a.y}`;
    if (a.y === b.y) return `${MONTHS[a.m]} ${a.d} - ${MONTHS[b.m]} ${b.d}, ${a.y}`;
    return `${longDate(from)} - ${longDate(to)}`;
  }
  return longDate(from) || longDate(to);
}

/** "4,000.00" — no peso sign, and zero prints as "-", as on the sheet. */
export function amountText(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v === 0 ? "-" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
