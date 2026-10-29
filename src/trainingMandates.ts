// Trainings the law requires come first (HSAC RAB 1's step 5, "Prioritization – statutory/legal
// mandates"; known-issues 12z Part D). HR or the Administrator marks a training title as mandated,
// with its basis, for every year. Titles are matched as everywhere else (normalizeTitle), and several
// titles may share one basis, since the plan words one law several ways. Pure; shared by the server
// and the screens, tested in tests/trainingMandates.test.ts.
import { cleanText } from "./inputText";
import { normalizeTitle } from "./tdpRules";

export const MANDATE_BASIS_MAX = 100;
/** As a Plan A need's title. */
export const MANDATE_TITLE_MAX = 300;

/** The bases HSAC RAB 1 itself named (2026-10-28), offered as suggestions; HR may type any other. */
export const MANDATE_SUGGESTIONS = [
  "R.A. 6713 (Code of Conduct and Ethical Standards)",
  "R.A. 11032 (Ease of Doing Business / ARTA)",
  "R.A. 12009 (New Government Procurement Act)",
  "COA compliance",
  "R.A. 11313 (Safe Spaces Act)",
  "Gender and Development (HGDG)",
  "R.A. 11058 (Occupational Safety and Health)",
  "R.A. 10121 (Disaster Risk Reduction and Management)"
] as const;

export interface MandateRef { key: string; basis: string }

/** A stored mark as the readers need it. A hand edit or a bad restore could leave anything in the
 * list, so the readers skip what isn't one instead of failing on it (the load rewrites nothing). */
export function isMandate(m: unknown): m is MandateRef & { id: string; title: string } {
  const r = m as Record<string, unknown> | null;
  return !!r && typeof r === "object" && typeof r.id === "string" && typeof r.title === "string"
    && typeof r.key === "string" && r.key !== "" && typeof r.basis === "string" && r.basis !== "";
}

/** The basis of each mandated title, by its normalised title. */
export function mandateIndex(mandates: readonly unknown[] | null | undefined): Map<string, string> {
  return new Map((Array.isArray(mandates) ? mandates : []).filter(isMandate).map(m => [m.key, m.basis]));
}

/** The title HR chose, as the plan has it. The key is taken from the text as sent, since every plan
 * title is matched as stored (`normalizeTitle` on its own text): cleaning first would let a soft
 * hyphen, a ligature or an invisible character give the mark a key no plan row has. The cleaned text
 * is what is shown and logged, and it is bounded after cleaning (NFKC can lengthen it). */
export function readMandateTitle(raw: unknown): { title: string; key: string } | { problem: string } {
  const text = typeof raw === "string" ? raw.trim() : "";
  const title = text.length <= MANDATE_TITLE_MAX ? cleanText(text) : "";
  const key = title && title.length <= MANDATE_TITLE_MAX ? normalizeTitle(text) : "";
  return key ? { title, key } : { problem: `Choose the training, by its title in the plan (up to ${MANDATE_TITLE_MAX} characters).` };
}

/** The law or rule that makes a training mandatory, or null when its title isn't marked. */
export function mandateFor(title: unknown, index: ReadonlyMap<string, string>): { basis: string } | null {
  const key = normalizeTitle(title);
  const basis = key ? index.get(key) : undefined;
  return basis ? { basis } : null;
}

/** A basis as typed: cleaned like a name, required, up to MANDATE_BASIS_MAX characters. */
export function readMandateBasis(raw: unknown): { value: string } | { problem: string } {
  const value = cleanText(raw);
  if (!value || value.length > MANDATE_BASIS_MAX) return { problem: `Name the law or rule that requires it, up to ${MANDATE_BASIS_MAX} characters.` };
  return { value };
}

/** Plan D's order within one person's column: the unmet mandated needs first, everything else as it
 * was (a stable sort, so the order HR entered them is kept within each group). */
export function unmetMandatedFirst<T>(items: readonly T[], isMandated: (t: T) => boolean, isDone: (t: T) => boolean): T[] {
  const first = (t: T) => isMandated(t) && !isDone(t);
  return [...items].sort((a, b) => Number(first(b)) - Number(first(a)));
}

/** The plan's trainings for planning: mandated titles first, then by how many people list them, then by title. */
export function catalogOrder<T extends { title: string; employeeCount: number; mandate?: { basis: string } | null }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    Number(!!b.mandate) - Number(!!a.mandate) || b.employeeCount - a.employeeCount || a.title.localeCompare(b.title));
}
