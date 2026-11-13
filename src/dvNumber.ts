// A disbursement voucher (DV) number, as HSAC RAB 1 numbers its vouchers: YYYY-MM-NNNN, the year and
// month of the voucher's date and a serial of four digits (e.g. 2026-10-0101). Finance types only the
// serial; the year and month come from the voucher date. Pure; shared by the release form and the
// server, tested in tests/dvNumber.test.ts.
import { cleanText, isCalendarDate } from "./inputText";

export const DV_SERIAL_DIGITS = 4;
export const DV_NUMBER_PATTERN = /^(\d{4})-(\d{2})-(\d{4})$/;

/** "2026-10" for a voucher dated 2026-10-29; "" until the date is a real one. */
export function dvPrefix(dvDate: unknown): string {
  return isCalendarDate(dvDate) ? dvDate.slice(0, 7) : "";
}

/** The serial as it may be typed: digits only, at most four. The whole number typed or pasted out of
 * habit ("2026-10-0101", "DV 2026-10-0101") gives its serial, the part after the last hyphen, so
 * typing it key by key ends at the right serial too. */
export function dvSerialInput(typed: string): string {
  const tail = typed.includes("-") ? typed.slice(typed.lastIndexOf("-") + 1) : typed;
  return tail.replace(/\D/g, "").slice(0, DV_SERIAL_DIGITS);
}

/** The year and month a whole number typed or pasted into the serial box carries ("2026-09" for
 * "2026-09-0101"), or "": checked against the voucher date. */
export function dvPrefixIn(typed: string): string {
  const match = /(\d{4})-(\d{2})-\d+\s*$/.exec(typed);
  return match ? `${match[1]}-${match[2]}` : "";
}

/** The full number from the voucher date and the serial (padded: 101 is 0101); "" while either is missing. */
export function dvNumberFrom(dvDate: unknown, serial: string): string {
  const prefix = dvPrefix(dvDate);
  const digits = dvSerialInput(serial);
  return prefix && digits ? `${prefix}-${digits.padStart(DV_SERIAL_DIGITS, "0")}` : "";
}

/** A DV number as the server takes it: YYYY-MM-NNNN, its year and month those of the voucher date
 * (which must be a real date), and a serial other than 0000. */
export function readDvNumber(raw: unknown, dvDate: unknown): { value: string } | { problem: string } {
  const prefix = dvPrefix(dvDate);
  if (!prefix) return { problem: "Choose the voucher's date first." };
  const value = cleanText(raw);
  const match = DV_NUMBER_PATTERN.exec(value);
  if (!match) {
    return { problem: "Enter the disbursement voucher (DV) number as YYYY-MM-NNNN: the voucher's year and month, then its four-digit serial (e.g. 2026-10-0101)." };
  }
  if (match[3] === "0000") return { problem: "The voucher's serial can't be 0000." };
  if (`${match[1]}-${match[2]}` !== prefix) {
    return { problem: `The DV number has to start with the voucher date's year and month (${prefix}).` };
  }
  return { value };
}

/** Whether a stored DV number predates the format (YYYY-MM-NNNN, enforced since 2026-10-29): typed as free text then,
 * e.g. a seminar's reference "TRN-2026-…". Kept as typed; the screens label it (the user's question of 2026-11-13). */
export function olderDv(raw: unknown): boolean {
  const text = cleanText(raw);
  return text !== "" && !DV_NUMBER_PATTERN.test(text);
}

/**
 * The serial to suggest for a new voucher in a month ("2026-11"): one past the highest already used that month, across
 * every number given (cash advances' and reimbursements' DVs, read as `dvKey` reads them, so "2026-11-16" counts as 0016).
 * "0001" for a month with none; "" for a month that isn't one, or once 9999 is used. Only a suggestion (the user's report
 * of 2026-11-13): the system holds no register of paper vouchers, so Finance can still type the one on the voucher.
 */
export function nextDvSerial(used: readonly unknown[], month: unknown): string {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return "";
  let highest = 0;
  for (const raw of used) {
    // Only what reads as a year, a month and a serial: an older free-text "2026-10-12345" or "2026-10-1e3" isn't one
    // (the code review), and mustn't make a month look full.
    const match = DV_NUMBER_PATTERN.exec(dvKey(raw));
    if (!match || `${match[1]}-${match[2]}` !== month) continue;
    const serial = Number(match[3]);
    if (serial > highest) highest = serial;
  }
  return highest >= 9999 ? "" : String(highest + 1).padStart(DV_SERIAL_DIGITS, "0");
}

/** The same voucher however it was typed, for telling whether a number is already used: an earlier
 * advance's number was free text ("2026-10-101", "DV 2026-10-0101"), and those still count. Anything
 * that isn't a year, a month and a serial is compared as it is (ignoring case). */
export function dvKey(raw: unknown): string {
  const text = cleanText(raw);
  const match = /^\D*(\d{4})\D+(\d{1,2})\D+(\d{1,4})\D*$/.exec(text);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(DV_SERIAL_DIGITS, "0")}` : text.toLowerCase();
}
