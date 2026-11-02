// The office's long lists (the instructor's review, R8): search, sorting and pages, worked out here so the rules
// are tested and every table behaves alike. It all happens in the browser: the lists carry no files any more, so a
// thousand rows are small. The state is kept by ui/useTableView.ts, and ui/DataTable.tsx draws the table.

/** Rows on a page. */
export const PAGE_SIZE = 25;

// Case and accents don't count, so "pena" finds "Peña": NFD splits "ñ" into "n" and a combining mark (\p{M}), which
// is dropped.
export const foldText = (text: unknown) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** The words of a search. */
export const searchTerms = (query: string) => foldText(query).split(/\s+/).filter(Boolean);

/** Every word must be in the text, in any order. With no words, nothing is folded: every row matches. */
export function matchesTerms(terms: string[], text: unknown): boolean {
  if (terms.length === 0) return true;
  const folded = foldText(text);
  return terms.every(term => folded.includes(term));
}

/** How much of one field a search reads. A request's reason or purpose has no limit on the server (known-issues 12w). */
export const SEARCH_FIELD_LIMIT = 500;

/** A field as search text: text only, and only its start. */
export const searchField = (value: unknown) => (typeof value === "string" ? value.slice(0, SEARCH_FIELD_LIMIT) : "");

export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}
export type SortValue = string | number | null | undefined;

const isBlank = (value: SortValue) => value === null || value === undefined || value === "" || Number.isNaN(value);

// Numbers inside text count as numbers, so report 9 comes before report 10 whatever its padding.
const TEXT = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/**
 * The rows in order of `valueOf`, a new list. Rows with nothing to sort by go last either way, in the order given.
 * Otherwise descending is the exact reverse of ascending: rows of the same value show the latest entry first, as
 * the request lists do (newest first is the instructor's rule).
 */
export function sortRows<T>(rows: T[], valueOf: (row: T) => SortValue, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((row, at) => ({ row, at, value: valueOf(row) }))
    .sort((a, b) => {
      const aBlank = isBlank(a.value);
      const bBlank = isBlank(b.value);
      if (aBlank || bBlank) return aBlank === bBlank ? a.at - b.at : aBlank ? 1 : -1;
      const order = typeof a.value === "number" && typeof b.value === "number"
        ? a.value - b.value
        : TEXT.compare(String(a.value), String(b.value));
      return sign * (order || a.at - b.at);
    })
    .map(item => item.row);
}

export interface TablePage<T> {
  rows: T[];
  /** Which page this is, from 0. */
  page: number;
  pageCount: number;
  /** Rows on every page together. */
  total: number;
  /** The rows shown, counted from 1: "26–50 of 120". Both 0 when there are none. */
  from: number;
  to: number;
}

/** One page of the rows. A page past the end shows the last one: a list can shrink while it is open. */
export function pageOf<T>(rows: T[], page: number, size = PAGE_SIZE): TablePage<T> {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const at = Math.min(Math.max(0, Math.trunc(page) || 0), pageCount - 1);
  const start = at * size;
  const shown = rows.slice(start, start + size);
  return { rows: shown, page: at, pageCount, total, from: total ? start + 1 : 0, to: start + shown.length };
}

/** The page holding the first row that matches, or -1 when none does. */
export function pageContaining<T>(rows: T[], matches: (row: T) => boolean, size = PAGE_SIZE): number {
  const at = rows.findIndex(matches);
  return at < 0 ? -1 : Math.floor(at / size);
}
