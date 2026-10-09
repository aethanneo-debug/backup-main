import { KeyboardEvent, RefObject, useEffect, useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Employee } from "../../types";

/**
 * Search-as-you-type picker over the staff list (WAI-ARIA combobox + listbox).
 *
 * Type part of a name, position or division; Up/Down move through the matches, Enter
 * picks one, Esc closes the list. Clicking the empty box lists everyone. The list opens
 * below the box rather than floating over the form, so it is never cut off by the
 * dialog's scroll area.
 */

interface StaffComboboxProps {
  /** Id of the text box, for the <label htmlFor> the caller renders. */
  id: string;
  /** People who may be picked, already filtered and sorted by the caller. */
  employees: Employee[];
  onSelect: (employee: Employee) => void;
  describedBy?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

const MAX_SHOWN = 50;

function matchesAll(e: Employee, terms: string[]): boolean {
  const text = `${e.fullName ?? ""} ${e.position ?? ""} ${e.division ?? ""}`.toLowerCase();
  return terms.every(t => text.includes(t));
}

export default function StaffCombobox({ id, employees, onSelect, describedBy, inputRef }: StaffComboboxProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const matches = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (employees ?? []).filter(e => matchesAll(e, terms));
  }, [employees, query]);
  const shown = matches.slice(0, MAX_SHOWN);
  const expanded = open && shown.length > 0;
  const optionId = (i: number) => `${listId}-option-${i}`;

  // Keep the highlighted option in view while moving through a long list.
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [active, expanded]);

  function choose(employee: Employee) {
    onSelect(employee);
    setQuery("");
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (shown.length === 0) return;
      const down = e.key === "ArrowDown";
      if (!open) {
        setOpen(true);
        setActive(down ? 0 : shown.length - 1);
        return;
      }
      setActive(i => (down ? Math.min(i + 1, shown.length - 1) : Math.max(i - 1, 0)));
    } else if (e.key === "Enter") {
      // Never submits the surrounding form from the search box.
      e.preventDefault();
      if (expanded && shown[active]) choose(shown[active]);
    } else if (e.key === "Escape" && open) {
      // Closes the list only; the dialog stays open (see ModalDialog).
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder="Search by name, position or division…"
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(e.target.value.trim() ? 0 : -1);
          }}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        />
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Staff list"
        hidden={!expanded}
        // Keeps focus in the text box, so the list doesn't close before a click (or a drag
        // of its scrollbar) lands.
        onMouseDown={e => e.preventDefault()}
        className="custom-scrollbar mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-sm"
      >
        {shown.map((emp, i) => (
          <li
            key={emp.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            onMouseMove={() => setActive(i)}
            onClick={() => choose(emp)}
            className={`cursor-pointer border-l-2 px-3 py-2 text-xs ${
              i === active ? "border-blue-600 bg-blue-50" : "border-transparent"
            }`}
          >
            <span className="block font-semibold text-slate-800">{emp.fullName}</span>
            <span className="block text-slate-500">{[emp.position, emp.division].filter(Boolean).join(" · ")}</span>
          </li>
        ))}
      </ul>

      {open && matches.length > MAX_SHOWN && (
        <p className="mt-1 text-[11px] text-slate-500">
          Showing the first {MAX_SHOWN} of {matches.length}. Keep typing to narrow the list.
        </p>
      )}
      {open && query.trim() !== "" && matches.length === 0 && (
        <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          No staff record matches “{query.trim()}”. You can still type the name and position below.
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {open ? (matches.length === 0 ? "No staff record matches." : `${matches.length} staff found.`) : ""}
      </p>
    </div>
  );
}
