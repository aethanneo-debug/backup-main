// The official receipt (OR) for cash handed back. HSAC RAB 1 has no cashier: the Finance Officer receives the money and
// issues the OR (the user's report of 2026-11-12, known-issues 12ai), so Finance records it, for a cash advance refunded
// in full (the Cash Advance Desk's "Record refund") and for what a seminar's liquidation report hands back (when Finance
// validates it). One reading for both, the same on Finance's screens and the server.
import { cleanText, isCalendarDate } from "./inputText";

/** An OR number's room, as the forms allow. */
export const OR_NUMBER_MAX = 50;

/** What an OR number is made of: the receipt's serial, in letters and digits (at least one digit), with spaces, ".",
 * "/", "#" or "-" between them (a leading "#" too). So quotes, colons and other punctuation can't be recorded in one
 * (it prints on the LR and in the employee's notice), nor a look-alike letter from another script (12ai's security
 * review). A short phrase of letters, digits and spaces still passes: only the Finance Officer types an OR. */
const OR_SHAPE = /^[A-Za-z0-9#][A-Za-z0-9 .\/#-]*$/;

/** The same receipt however it was typed, for telling whether an OR is already used: case, spaces and punctuation, a
 * leading "OR" or "No." and leading zeros don't make another receipt ("OR No. 0247-983" is "0247983" is "247983"), as
 * `dvKey` does for vouchers. An older OR typed as free text is compared the same way. */
export function orKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.normalize("NFKC").toUpperCase()
    .replace(/^\s*(?:O\.?\s*R\.?\s*)?(?:NO\.?\s*)?#?\s*/, "")
    .replace(/[^0-9A-Z]/g, "")
    .replace(/^0+(?=\d)/, "");
}

/** The OR as Finance typed it, cleaned and checked, or why it can't be recorded. In order: a number of at most 50
 * characters, shaped as a receipt's serial; not already on another report or refund, however it was spelled (`usedOn`
 * names where, or gives null); a real date no later than Manila's today; and not before the cash went out (the DV's
 * date, when known). The messages are the refund route's, which has asked for an OR since 2026-10-13. */
export function readRefundOr(
  raw: { orNo: unknown; orDate: unknown },
  facts: { today: string; releasedOn?: unknown; usedOn: (orNo: string) => string | null | undefined }
): { value: { orNo: string; orDate: string } } | { problem: string } {
  const orNo = cleanText(raw.orNo);
  if (!orNo || orNo.length > OR_NUMBER_MAX) {
    return { problem: "Enter the official receipt (OR) number of the refund, up to 50 characters." };
  }
  if (!OR_SHAPE.test(orNo) || !/\d/.test(orNo)) {
    return { problem: "Enter the OR number as printed on the receipt: letters and digits, with spaces, \".\", \"/\", \"#\" or \"-\" between them." };
  }
  const usedOn = facts.usedOn(orNo);
  if (usedOn) return { problem: `OR ${orNo} is already recorded on ${usedOn}. Each official receipt is used once: check the number.` };
  const orDate = raw.orDate;
  if (!isCalendarDate(orDate) || orDate > facts.today) return { problem: "Enter the OR date as YYYY-MM-DD, no later than today." };
  // Money can't come back before it went out.
  if (isCalendarDate(facts.releasedOn) && orDate < facts.releasedOn) {
    return { problem: `The OR date can't be before the advance was released (DV dated ${facts.releasedOn}).` };
  }
  return { value: { orNo, orDate } };
}
