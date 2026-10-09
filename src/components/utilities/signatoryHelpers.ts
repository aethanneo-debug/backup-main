import { Signatory, SignatoryRole, SINGLE_HOLDER_SIGNATORY_ROLES } from "../../types";
import { formatDate } from "../../utils";

// Shared rules for Utilities → Manage Signatories. Each mirrors a check in server.ts
// (POST/PUT /api/signatories) so the form can say "no" before the request does. The server
// still decides: its message is always shown when it refuses.

/** The server's limit for a name, a position and a deactivation reason. */
export const SIGNATORY_TEXT_MAX = 150;

export const ACCOUNTANT: SignatoryRole = "Accountant";
export const REPRESENTATIVE: SignatoryRole = "Authorized Representative";

/**
 * Today's date in the Philippines (UTC+8, no daylight saving), as YYYY-MM-DD.
 *
 * The server checks "today or earlier" against Manila's calendar. Using the same clock
 * here keeps the date picker's limit and the server's limit on the same day, even on a
 * computer whose clock is set to another time zone.
 */
export function manilaToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Cleans a name or position the way the server does before it saves (server.ts
 * signatoryText): NFKC-normalises it, turns any whitespace into one space, removes
 * invisible characters (zero-width, direction overrides), then trims. Matching the server
 * keeps the form's duplicate warning and length check in line with what it will decide.
 */
export function cleanText(value: string | undefined | null): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\s+/g, " ").replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
}

/** A real calendar date in YYYY-MM-DD form (so 2026-02-30 is refused, as on the server). */
export function isCalendarDate(value: string | undefined | null): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * A stored YYYY-MM-DD date for display, or an em dash when there is none.
 *
 * The date is read as local midnight. `new Date("2026-10-08")` means midnight UTC, which
 * west of Greenwich is still 7 October, so the table would show the day before.
 */
export function displayDate(value?: string | null): string {
  if (!value) return "—";
  return formatDate(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
}

/** Roles one person holds at a time (the Accountant): appointing someone ends the term. */
export function isSingleHolderRole(role: SignatoryRole | ""): boolean {
  return role !== "" && SINGLE_HOLDER_SIGNATORY_ROLES.includes(role);
}

/** The server's "same person" rule: by staff record when both have one, otherwise by name. */
export function isSamePerson(
  a: { employeeId?: string; fullName: string },
  b: { employeeId?: string; fullName: string }
): boolean {
  if (a.employeeId && b.employeeId) return a.employeeId === b.employeeId;
  return cleanText(a.fullName).toLowerCase() === cleanText(b.fullName).toLowerCase();
}

export function activeInRole(list: Signatory[] | null | undefined, role: SignatoryRole): Signatory[] {
  return (list ?? []).filter(s => s.status === "Active" && s.role === role);
}

/** "A", "A and B", "A, B and C" — for sentences that name people. */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Where each role prints on the Liquidation Report. Partial on purpose: a role added to
 * SIGNATORY_ROLES later simply shows no note instead of breaking the page.
 */
export const ROLE_PRINT_NOTE: Partial<Record<SignatoryRole, string>> = {
  Accountant: "Box C · one at a time",
  "Authorized Representative": "Box B · any number"
};

/** What stops working when nobody active holds a role. Used in the confirm dialogs. */
export const VACANCY_IMPACT: Partial<Record<SignatoryRole, string>> = {
  Accountant: "Until a new Accountant is appointed, Finance can't validate liquidation reports.",
  "Authorized Representative": "Until another one is added, employees can't file a liquidation report."
};
