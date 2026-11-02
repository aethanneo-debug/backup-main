import { useCallback, useEffect, useMemo, useState } from "react";
import { PAGE_SIZE, matchesTerms, pageContaining, pageOf, searchTerms, sortRows, type SortState, type SortValue, type TablePage } from "../../tableView";

export interface TableOptions<T> {
  rows: T[] | null | undefined;
  rowId: (row: T) => string;
  /** The text a row is found by. Without it the search matches every row. */
  searchText?: (row: T) => unknown;
  /** The list's own filter (a claim type, a chip), and a key that changes when it does. */
  filter?: (row: T) => boolean;
  filterKey?: string;
  /** What each sortable column sorts by. A date's value is `firstTimestamp(…) || null`, so a row with none goes last. */
  sorts?: Record<string, (row: T) => SortValue>;
  /** The order the list opens in. Without it, the rows stay in the order given. */
  defaultSort?: SortState;
  pageSize?: number;
  /** Clears the list's own filter, when it hides a row that has to be shown. */
  clearFilter?: () => void;
}

export interface TableView<T> {
  query: string;
  setQuery: (query: string) => void;
  sort: SortState | null;
  /** A click on a column: its own order, then the reverse. */
  toggleSort: (key: string) => void;
  /** Every row that matches, in order, on all pages (Report Excel exports these). */
  matching: T[];
  /** Every row before the search and the filter. */
  all: T[];
  page: TablePage<T>;
  setPage: (page: number) => void;
  /** Goes to a row's page, clearing a search or a filter that hides it (a notice's deep link). Does nothing for a
   * row this list doesn't hold. */
  reveal: (id: string) => void;
}

const NO_ROWS: never[] = [];

/**
 * A list's search, sort and page. A new search, filter or sort starts from the first page; the page is otherwise
 * kept when the rows change, so working down a list and reloading it stays where it was.
 */
export function useTableView<T>({
  rows,
  rowId,
  searchText,
  filter,
  filterKey = "",
  sorts,
  defaultSort,
  pageSize = PAGE_SIZE,
  clearFilter
}: TableOptions<T>): TableView<T> {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);
  const all: T[] = rows ?? NO_ROWS;

  const matching = useMemo(() => {
    const terms = searchTerms(query);
    // With nothing searched, no row's text is even put together.
    const found = all.filter(row => (!filter || filter(row)) && (!searchText || terms.length === 0 || matchesTerms(terms, searchText(row))));
    const valueOf = sort ? sorts?.[sort.key] : undefined;
    return valueOf && sort ? sortRows(found, valueOf, sort.dir) : found;
  }, [all, query, filterKey, sort]);

  // Kept with what it was a page of, so a new search shows its first page at once rather than a moment later, and
  // going back to an earlier order starts from the first page too (set during the render, as React allows).
  const scope = `${query}\u0000${filterKey}\u0000${sort?.key ?? ""}\u0000${sort?.dir ?? ""}`;
  const [paged, setPaged] = useState({ scope, page: 0 });
  if (paged.scope !== scope) setPaged({ scope, page: 0 });
  const page = useMemo(
    () => pageOf(matching, paged.scope === scope ? paged.page : 0, pageSize),
    [matching, paged, scope, pageSize]
  );
  const setPage = useCallback((next: number) => setPaged({ scope, page: next }), [scope]);
  // A list that shrank shows its last page, and keeps it: growing again doesn't jump to the page it had left.
  useEffect(() => {
    if (paged.scope === scope && paged.page !== page.page) setPaged({ scope, page: page.page });
  }, [page.page]);

  const toggleSort = useCallback((key: string) => {
    setSort(now => (now?.key === key ? { key, dir: now.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }, []);

  const [wanted, setWanted] = useState<{ id: string; cleared?: boolean } | null>(null);
  const reveal = useCallback((id: string) => setWanted({ id }), []);
  useEffect(() => {
    if (!wanted) return;
    const isIt = (row: T) => rowId(row) === wanted.id;
    const at = pageContaining(matching, isIt, pageSize);
    if (at >= 0) {
      setPage(at);
      setWanted(null);
    } else if (wanted.cleared || !all.some(isIt)) {
      setWanted(null);
    } else {
      // Hidden by the search or the list's filter. Both go, and the next pass finds its page.
      setQuery("");
      clearFilter?.();
      setWanted({ ...wanted, cleared: true });
    }
  }, [wanted, matching]);

  return { query, setQuery, sort, toggleSort, matching, all, page, setPage, reveal };
}
