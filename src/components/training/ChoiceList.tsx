import { KeyboardEvent, ReactNode, Ref, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Check, Search, SearchX, X } from "lucide-react";
import { matchesTerms, searchTerms } from "../../tableView";

// Several choices from a list that can be long, inside a dialog (Add Training Need, 12ad: the employees and the
// trainings; several of each in one save since the user's request of 2026-11-09). A search box over a list that is
// always shown, in the dialog's body rather than floating: the body scrolls, and would clip a popup. The WAI-ARIA
// combobox with its listbox always open and multi-selectable: the focus stays in the search box, Up and Down move through
// the rows, Enter ticks or unticks the row they are on, and Esc clears the search and goes no further (on an empty box it
// is left to the dialog, which closes). Moving through the rows ticks nothing.
// Each row looks like a checklist's, as the participant picker draws its rows: a box at its left, ticked on every chosen
// row. The box is drawn, not a control: the row is the listbox's option (aria-selected says whether it is ticked), and
// an input inside it would add a tab stop the combobox pattern doesn't have.
interface Props<T> {
  /** Which list this is, on the wrapper as data-choice-list (for tests): "employees", "trainings". */
  name: string;
  /** The visible label, with its required mark: it names the search box and the list. */
  label: ReactNode;
  items: T[];
  keyOf: (item: T) => string;
  /** What the search reads: accent-blind, every word must match (src/tableView.ts). */
  searchText: (item: T) => string;
  /** A row that can't be ticked. It is still shown and reachable, so its reason is read out; Enter and clicks pass it
   * by. A ticked row can always be unticked, whatever this says. */
  isDisabled?: (item: T) => boolean;
  renderItem: (item: T) => ReactNode;
  /** The ticked rows' keys, this list's or not (the caller's own filter may leave some out of `items`). */
  values: readonly string[];
  onToggle: (item: T) => void;
  placeholder: string;
  /** "employee", "training": for the counts ("3 employees ticked"). */
  noun: string;
  /** Ticked rows that aren't in `items` at all, as the count line words them ("1 under another column"). */
  outsideText?: (n: number) => string;
  /** Instead of the box and the list, when there is nothing to choose from. */
  empty: ReactNode;
  disabled?: boolean;
  /** A line under the label: what the list holds. */
  hint?: ReactNode;
  /** Ids of more text describing the box: a problem with it. */
  describedBy?: string;
  invalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  /** The list's height, by screen width (it scrolls inside it). */
  listHeight: string;
}

const SMALL_BUTTON = "rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export default function ChoiceList<T>({
  name, label, items, keyOf, searchText, isDisabled, renderItem, values, onToggle, placeholder, noun, outsideText, empty,
  disabled = false, hint, describedBy, invalid = false, inputRef, listHeight
}: Props<T>) {
  const id = useId();
  const optionId = (i: number) => `${id}-option-${i}`;
  const [query, setQuery] = useState("");
  // The row Up and Down are on, by key, so it stays the same row while the list is filtered.
  const [activeKey, setActiveKey] = useState("");
  // The row is outlined only while the box has the focus: it is where Enter would land.
  const [focused, setFocused] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useImperativeHandle(inputRef, () => box.current as HTMLInputElement);

  const ticked = useMemo(() => new Set(values), [values]);
  const terms = searchTerms(query);
  const searching = terms.length > 0;
  const shown = items.filter(item => matchesTerms(terms, searchText(item)));
  const active = shown.findIndex(item => keyOf(item) === activeKey);
  // A ticked row can always be unticked; one that can't be ticked is passed by.
  const toggleable = (item: T) => !disabled && (ticked.has(keyOf(item)) || !isDisabled?.(item));
  const plural = (n: number) => `${n} ${noun}${n === 1 ? "" : "s"}`;

  // What the count line says: how many are ticked, and how many of those the search, or the caller's filter, hides.
  const inList = new Set(items.map(keyOf));
  const outside = values.filter(k => !inList.has(k)).length;
  const hiddenBySearch = searching ? items.filter(item => ticked.has(keyOf(item)) && !matchesTerms(terms, searchText(item))).length : 0;
  const tickedText = values.length === 0 ? `No ${noun} ticked yet.`
    : `${plural(values.length)} ticked${hiddenBySearch ? `, ${hiddenBySearch} hidden by the search` : ""}${
      outside ? `, ${outsideText ? outsideText(outside) : `${outside} not in this list`}` : ""}.`;
  // Read out as the search changes (ticking is read out by the dialog, once).
  const searchNote = !searching ? ""
    : shown.length === 0 ? `No ${noun} matches “${query.trim()}”.${hiddenBySearch ? ` ${hiddenBySearch} ticked hidden by the search.` : ""}`
    : `${shown.length} of ${plural(items.length)} shown.${hiddenBySearch ? ` ${hiddenBySearch} ticked hidden by the search.` : ""}`;

  // The active row is kept in view inside the list only: scrollIntoView would move the dialog's body as well.
  useEffect(() => {
    const list = listRef.current;
    const row = active >= 0 ? document.getElementById(optionId(active)) : null;
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
  }, [active, activeKey]);

  function toggle(item: T) {
    if (!toggleable(item)) return;
    setActiveKey(keyOf(item));
    onToggle(item);
  }

  // From no row, the first press lands on the first ticked row shown (else the first or last row), as a listbox starts
  // from its selected options; then one row at a time, stopping at either end.
  function move(step: 1 | -1) {
    if (shown.length === 0) return;
    if (active < 0) {
      const at = shown.findIndex(item => ticked.has(keyOf(item)));
      setActiveKey(keyOf(shown[at >= 0 ? at : step === 1 ? 0 : shown.length - 1]));
      return;
    }
    setActiveKey(keyOf(shown[Math.min(Math.max(active + step, 0), shown.length - 1)]));
  }

  function search(next: string) {
    setQuery(next);
    // Typing puts a row under Enter: the first match not ticked yet, which Enter then ticks, else the first that can be
    // unticked. So a search for one more can't untick one already chosen (the code review). An empty box keeps the row
    // it was on.
    const words = searchTerms(next);
    if (words.length === 0) return;
    const matches = items.filter(item => toggleable(item) && matchesTerms(words, searchText(item)));
    const first = matches.find(item => !ticked.has(keyOf(item))) ?? matches[0];
    setActiveKey(first ? keyOf(first) : "");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      if (active >= 0) {
        e.preventDefault();
        toggle(shown[active]);
      }
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      e.stopPropagation();
      search("");
    }
  }

  const clearSearch = () => {
    search("");
    box.current?.focus();
  };

  return (
    <div data-choice-list={name} className="min-w-0 space-y-1.5">
      <div>
        <label id={`${id}-label`} htmlFor={items.length > 0 ? `${id}-box` : undefined} className="block text-[11px] font-semibold text-slate-700">
          {label}
        </label>
        {hint && <p id={`${id}-hint`} className="text-[11px] text-slate-500">{hint}</p>}
      </div>

      {items.length === 0 ? empty : (
        <>
          <div className="relative">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={box}
              id={`${id}-box`}
              type="text"
              role="combobox"
              aria-expanded={shown.length > 0}
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={focused && active >= 0 ? optionId(active) : undefined}
              aria-describedby={[hint ? `${id}-hint` : "", `${id}-count`, describedBy ?? ""].filter(Boolean).join(" ")}
              aria-invalid={invalid || undefined}
              value={query}
              disabled={disabled}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              onChange={e => search(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className={`w-full rounded-lg border bg-white py-2 pl-8 pr-9 text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 ${
                invalid ? "border-rose-400" : "border-slate-300"
              }`}
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                disabled={disabled}
                aria-label="Clear the search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {/* How many are ticked, and how many the search hides, always on screen; described on the box. */}
          <p id={`${id}-count`} data-choice-count className="text-[11px] text-slate-600">
            {searching && shown.length > 0 && <>{shown.length} of {items.length} shown · </>}
            <span className={values.length > 0 ? "font-semibold text-slate-700" : undefined}>{tickedText}</span>
          </p>
          <p aria-live="polite" className="sr-only">{searchNote}</p>

          {searching && shown.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">
              <SearchX size={18} className="text-slate-400" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-700">No {noun} matches &ldquo;{query.trim()}&rdquo;.</p>
              <button type="button" onClick={clearSearch} className={SMALL_BUTTON}>Clear search</button>
            </div>
          )}
          {/* A click keeps the focus where it was (mousedown), so a tap on a phone doesn't bring up the keyboard. */}
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={`${id}-label`}
            hidden={shown.length === 0}
            onMouseDown={e => e.preventDefault()}
            className={`custom-scrollbar relative divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white ${listHeight}`}
          >
            {shown.map((item, i) => {
              const key = keyOf(item);
              const on = ticked.has(key);
              // Greyed only while it can't be ticked: once ticked it can always be unticked.
              const off = !on && !!isDisabled?.(item);
              return (
                <li
                  key={key}
                  id={optionId(i)}
                  role="option"
                  data-key={key}
                  aria-selected={on}
                  aria-disabled={off || undefined}
                  onClick={() => toggle(item)}
                  className={`px-3 py-2 transition-colors duration-150 motion-reduce:transition-none ${
                    on ? "bg-blue-50/60 shadow-[inset_3px_0_0_0_var(--color-blue-600)]" : ""
                  } ${off || disabled ? "cursor-not-allowed" : on ? "cursor-pointer" : "cursor-pointer hover:bg-slate-50"} ${
                    focused && i === active ? "ring-2 ring-inset ring-blue-500" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* The checklist's box: ticked on every chosen row, greyed on one that can't be ticked. */}
                    <span
                      aria-hidden="true"
                      data-check={on ? "on" : "off"}
                      className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 motion-reduce:transition-none ${
                        on ? "border-blue-600 bg-blue-600 text-white" : off ? "border-slate-300 bg-slate-100" : "border-slate-400 bg-white"
                      }`}
                    >
                      {on && <Check size={12} strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 flex-1">{renderItem(item)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
