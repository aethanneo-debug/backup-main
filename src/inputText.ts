// Text and dates typed by people, cleaned and checked the same way on the screens and on the server:
// signatory names, OR and DV numbers, reasons, file names, and a vehicle request's trip.

/**
 * The longest raw text any cleaner reads. Normalising (NFKC) can turn one character into 18, and the
 * body limit is 50 MB, so a huge field could hold the server for a minute or exhaust its memory. Every
 * field's own limit is far below this, so a longer value is never legitimate.
 */
export const RAW_TEXT_MAX = 4000;

/**
 * Text as typed, cleaned like a name: one space for any run of whitespace, no invisible or control
 * characters (zero-width, direction overrides), which would let a lookalike pass a duplicate check or
 * print differently from what is stored. "" when it isn't text, or is longer than RAW_TEXT_MAX: the
 * caller then refuses it as missing, or drops it.
 */
export function cleanText(value: unknown): string {
  if (typeof value !== "string" || value.length > RAW_TEXT_MAX) return "";
  // Whitespace (tabs, newlines) becomes one space first, so "Juan\tDela Cruz" keeps its gap, and again
  // once the invisible characters are gone, so "A ​ B" doesn't keep two spaces.
  return value.normalize("NFKC").replace(/\s+/g, " ").replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim();
}

/** A real calendar date in YYYY-MM-DD (the shape alone would let 2026-02-30 through). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
