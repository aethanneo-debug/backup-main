import { useEffect, useId, useRef, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye, Search, X } from "lucide-react";
import type { TableView } from "./useTableView";

// The office's long lists as tables (the instructor's review, R8). The hook (ui/useTableView.ts) holds the search,
// the sort and the page; these draw them. A list's search box, chips and pager are parts of their own, so each
// list can lay them out around its table.

export interface TableColumn<T> {
  /** Also what the column sorts by, when it is sortable (a key of the hook's `sorts`). */
  key: string;
  header: ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  table: TableView<T>;
  columns: TableColumn<T>[];
  /** For screen readers, and the name of the area that scrolls. */
  caption: string;
  rowId: (row: T) => string;
  /** The last column, pinned at the right: the row's View button. */
  actions?: (row: T) => ReactNode;
  actionsHeader?: ReactNode;
  /** Narrower than this, the table scrolls sideways. */
  minWidth?: number;
  /** What shows when the list has no rows at all. */
  empty: ReactNode;
  /** What shows when the list's own filter hides every row. */
  filteredEmpty?: ReactNode;
  /** The list's TableSearch, which takes the focus when the search is cleared from here. */
  searchId?: string;
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

// Each cell paints its own background, and carries its own border: the sticky header and the pinned column have to
// cover what scrolls under them, which a row's colour or a collapsed border can't. The row's hover is opaque for
// the same reason. (index.css's outline of a record a notice opened still wins: it isn't in a layer.)
const HEAD_CELL = "border-b border-slate-200 bg-slate-50 px-2 py-2.5 font-bold";
const BODY_CELL = "border-b border-slate-100 bg-white px-2 py-2.5 align-top group-hover:bg-slate-50";
const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

const sortState = (sort: TableView<unknown>["sort"], key: string) =>
  sort?.key !== key ? "none" : sort.dir === "asc" ? "ascending" : "descending";

function SortIcon({ state }: { state: "none" | "ascending" | "descending" }) {
  const Icon = state === "ascending" ? ChevronUp : state === "descending" ? ChevronDown : ChevronsUpDown;
  return <Icon size={11} className={`shrink-0 ${state === "none" ? "text-slate-400" : "text-blue-700"}`} aria-hidden="true" />;
}

export function DataTable<T>({
  table,
  columns,
  caption,
  rowId,
  actions,
  actionsHeader = "View",
  minWidth = 900,
  empty,
  filteredEmpty,
  searchId
}: DataTableProps<T>) {
  const scroller = useRef<HTMLDivElement>(null);
  // A new page starts at its first row, wherever the last one was left.
  const pageAt = table.page.page;
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [pageAt]);

  if (table.all.length === 0) return <>{empty}</>;
  if (table.matching.length === 0) {
    const searched = table.query.trim();
    if (!searched && filteredEmpty) return <>{filteredEmpty}</>;
    return (
      <div className="m-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
        <p className="text-xs font-semibold text-slate-600">
          {searched ? <>Nothing matches &ldquo;{searched}&rdquo;.</> : "Nothing matches the filter."}
        </p>
        {searched && (
          <button
            type="button"
            onClick={() => {
              table.setQuery("");
              if (searchId) document.getElementById(searchId)?.focus();
            }}
            className={`mt-1 cursor-pointer rounded text-[11px] font-semibold text-blue-700 underline hover:text-blue-800 ${FOCUS}`}
          >
            Clear the search
          </button>
        )}
      </div>
    );
  }

  return (
    // Its own height, so the header stays in view over 25 rows, and the sideways scrollbar and the pager with it.
    <div
      ref={scroller}
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="custom-scrollbar relative max-h-[65vh] overflow-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
    >
      <table style={{ minWidth }} className="w-full border-separate border-spacing-0 text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            {columns.map(column => {
              const state = sortState(table.sort, column.key);
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sortable ? state : undefined}
                  className={`sticky top-0 z-10 ${HEAD_CELL} ${ALIGN[column.align ?? "left"]}`}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => table.toggleSort(column.key)}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded font-bold uppercase tracking-wider hover:text-slate-800 ${FOCUS}`}
                    >
                      {column.header}
                      <SortIcon state={state} />
                    </button>
                  ) : column.header}
                </th>
              );
            })}
            {actions && (
              <th scope="col" className={`sticky right-0 top-0 z-20 border-l text-right ${HEAD_CELL}`}>
                {actionsHeader}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {table.page.rows.map(row => {
            const id = rowId(row);
            return (
              <tr key={id} data-record-id={id} className="group">
                {columns.map(column => (
                  <td key={column.key} className={`${BODY_CELL} ${ALIGN[column.align ?? "left"]} ${column.className ?? ""}`}>
                    {column.cell(row)}
                  </td>
                ))}
                {actions && <td className={`sticky right-0 z-[1] border-l border-l-slate-200 text-right ${BODY_CELL}`}>{actions(row)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface TableSearchProps<T> {
  table: TableView<T>;
  /** The box's name, for a screen reader. */
  label: string;
  placeholder?: string;
  id?: string;
}

/** The list's search box. Esc clears it. */
export function TableSearch<T>({ table, label, placeholder, id }: TableSearchProps<T>) {
  const generated = useId();
  const inputId = id ?? generated;
  const input = useRef<HTMLInputElement>(null);
  const narrowed = table.query.trim() !== "" || table.matching.length !== table.all.length;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="relative w-full max-w-xs">
        <label htmlFor={inputId} className="sr-only">{label}</label>
        <Search size={13} className="pointer-events-none absolute left-2.5 top-2 text-slate-400" aria-hidden="true" />
        <input
          ref={input}
          id={inputId}
          type="search"
          // What is searched for (a name, words from a leave reason) stays out of a shared PC's form history.
          autoComplete="off"
          value={table.query}
          onChange={e => table.setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key !== "Escape" || !table.query) return;
            e.preventDefault();
            table.setQuery("");
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {table.query && (
          <button
            type="button"
            onClick={() => {
              table.setQuery("");
              input.current?.focus();
            }}
            aria-label="Clear the search"
            className={`absolute right-1.5 top-1.5 cursor-pointer rounded p-0.5 text-slate-500 hover:text-slate-800 ${FOCUS}`}
          >
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>
      <span role="status" aria-live="polite" className="shrink-0 font-mono text-[10px] text-slate-600">
        {narrowed ? `${table.matching.length} of ${table.all.length}` : ""}
      </span>
    </div>
  );
}

function PageButton({ label, off, onClick }: { label: string; off: boolean; onClick: () => void }) {
  // Not `disabled`: a disabled button loses the keyboard focus, which reaching the last page would drop on the page.
  return (
    <button
      type="button"
      aria-disabled={off || undefined}
      onClick={off ? undefined : onClick}
      className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${FOCUS} ${
        off ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400" : "cursor-pointer border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

/** Which rows are showing, and the way through the pages. With one page, just the count. */
export function TablePager<T>({ table, label }: { table: TableView<T>; label: string }) {
  const { page, pageCount, total, from, to } = table.page;
  if (total === 0) return null;
  const count = <p className="text-[11px] text-slate-600">Showing {from}&ndash;{to} of {total}</p>;
  if (pageCount < 2) return <div className="border-t border-slate-200 px-3 py-2">{count}</div>;
  const last = pageCount - 1;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
      {count}
      <div className="flex flex-wrap items-center gap-1">
        <PageButton label="First" off={page === 0} onClick={() => table.setPage(0)} />
        <PageButton label="Previous" off={page === 0} onClick={() => table.setPage(page - 1)} />
        <span className="px-1.5 font-mono text-[10px] text-slate-600">Page {page + 1} of {pageCount}</span>
        <PageButton label="Next" off={page === last} onClick={() => table.setPage(page + 1)} />
        <PageButton label="Last" off={page === last} onClick={() => table.setPage(last)} />
      </div>
    </nav>
  );
}

/** A row's way into its details: a button, so it works by keyboard. `label` names the row for a screen reader. */
export function ViewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-view-row
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 ${FOCUS}`}
    >
      <Eye size={12} aria-hidden="true" />
      View<span className="sr-only"> {label}</span>
    </button>
  );
}

/** Puts the focus on a row's View button, for when the button that opened a window has since been redrawn. */
export function focusViewButton(id: string) {
  document.querySelector<HTMLElement>(`[data-record-id="${CSS.escape(id)}"] [data-view-row]`)?.focus();
}

interface TableChip<K extends string> {
  id: K;
  label: string;
  count: number;
}

/** A list's stages as chips, each with how many rows it holds. */
export function TableChips<K extends string>({ chips, value, onChange, label }: {
  chips: TableChip<K>[];
  value: K;
  onChange: (id: K) => void;
  /** The group's name, for a screen reader. */
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {chips.map(chip => {
        const on = chip.id === value;
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(chip.id)}
            className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${FOCUS} ${
              on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {chip.label} ({chip.count})
          </button>
        );
      })}
    </div>
  );
}
