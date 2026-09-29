/**
 * Matching a workbook name to an employee record.
 *
 * The workbook writes people as the office types them — "Atty. Korrine Madeleine
 * Flores - Fontanilla", "Dr. Niño Romyr H. Saavedra" — while the system stores plain
 * full names. This normalises both sides and matches exactly; anything short of an exact
 * match returns suggestions only, which pre-select a dropdown for a human to confirm.
 * Nothing here ever decides on its own.
 */

export interface NameMatchResult {
  employeeId: string | null;
  confidence: "exact" | "none";
  suggestions: { employeeId: string; fullName: string; score: number }[];
}

interface MatchableEmployee {
  id: string;
  fullName: string;
  isActive?: boolean;
}

/** Honorifics and post-nominals that appear in the workbook but never in a stored name. */
const DROPPED_TOKENS = new Set([
  "atty", "dr", "hon", "engr", "arch", "mr", "mrs", "ms", "miss", "prof", "rev",
  "sr", "jr", "phd", "cpa", "md", "rn", "cese", "ceso", "lpt", "iii", "ii", "iv"
]);

/**
 * Lowercase, strip diacritics ("Niño" -> "nino"), turn punctuation into spaces, and drop
 * honorifics. Deliberately keeps middle initials — they are discriminating between two
 * people who share a surname.
 */
export function normalizeEmployeeName(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,'`’\-_/\\]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t && !DROPPED_TOKENS.has(t))
    .join(" ")
    .trim();
}

/** Tokens worth comparing: single letters are middle initials, not evidence. */
const tokensOf = (normalized: string) => new Set(normalized.split(" ").filter(t => t.length >= 2));

/** Jaccard overlap. 1 = identical token sets, 0 = nothing shared. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Threshold is deliberately high. The 2026 sheet contains two different people whose
 * surnames both normalise to "flores fontanilla"; they score ~0.43 against each other,
 * so anything at or below that would offer each as a suggestion for the other.
 */
const SUGGEST_THRESHOLD = 0.5;

export function matchWorkbookName(raw: string, employees: MatchableEmployee[]): NameMatchResult {
  const target = normalizeEmployeeName(raw);
  if (!target) return { employeeId: null, confidence: "none", suggestions: [] };

  const active = (employees || []).filter(e => e && e.fullName && e.isActive !== false);

  for (const e of active) {
    if (normalizeEmployeeName(e.fullName) === target) {
      return { employeeId: e.id, confidence: "exact", suggestions: [] };
    }
  }

  const t = tokensOf(target);
  const suggestions = active
    .map(e => ({ employeeId: e.id, fullName: e.fullName, score: overlap(t, tokensOf(normalizeEmployeeName(e.fullName))) }))
    .filter(s => s.score >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return { employeeId: null, confidence: "none", suggestions };
}
