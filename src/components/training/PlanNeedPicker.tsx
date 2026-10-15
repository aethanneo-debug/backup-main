import { KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, ClipboardList, Loader2, Search } from "lucide-react";
import {
  TrainingCandidate,
  TrainingNeedCatalogItem,
  TrainingNeedCategory,
  TRAINING_NEED_CATEGORIES,
  TRAINING_NEED_COLUMN_LABELS
} from "../../types";
import { apiCall } from "../../utils";

/**
 * "Add a seminar from the plan": a search-as-you-type picker over one fiscal year's Plan A
 * trainings (WAI-ARIA combobox + listbox, the same pattern as utilities/StaffCombobox).
 *
 * Type part of a title; Up/Down move through the matches, Enter picks one, Esc closes the
 * list (or, once closed, clears the search). Clicking the box lists every training in the
 * chosen column. Picking one hands it to `onPick`, which adds the seminar row.
 *
 * A training that already has a seminar this year is marked, not blocked: a training many
 * employees listed may need a second run.
 */

// Same normalisation as NeedCoverageModal's norm() and the server's normalizeTitle(), so
// "Has a seminar" agrees with how Plan D and the participant picker match a need.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

interface PlanNeedPickerProps {
  /** Fiscal-year label whose plan is listed, e.g. "2026". */
  fiscalYear: string;
  /** This year's saved seminars. A training any of them covers is marked "Has a seminar". */
  seminars: { title: string; fulfillsNeedTitles?: string[] }[];
  onPick: (item: TrainingNeedCatalogItem) => void;
  /** Opens step 1, Training Needs, from the empty state. */
  onOpenPlan?: () => void;
}

export default function PlanNeedPicker({ fiscalYear, seminars, onPick, onOpenPlan }: PlanNeedPickerProps) {
  const headingId = useId();
  const helpId = useId();
  const listId = useId();
  const [needs, setNeeds] = useState<TrainingNeedCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  // null while there is no error; "" when the server gave no reason.
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [column, setColumn] = useState<TrainingNeedCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiCall(`/api/training/needs/catalog?fiscalYear=${encodeURIComponent(fiscalYear)}`)
      .then(res => {
        if (cancelled) return;
        if (res.status === "success") setNeeds(res.data?.needs ?? []);
        else setError(res.message || "");
      })
      .catch(err => { if (!cancelled) setError(err?.message || ""); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fiscalYear, reloadKey]);

  // Normalised training title -> titles of the seminars that cover it (the badge's tooltip).
  const seminarsByNeed = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const seminar of seminars ?? []) {
      for (const title of seminar.fulfillsNeedTitles ?? []) {
        const key = norm(title);
        if (key) map.set(key, [...(map.get(key) ?? []), seminar.title]);
      }
    }
    return map;
  }, [seminars]);

  // A training listed under two columns (by different employees) counts under each.
  const columnCounts = useMemo(() => {
    const counts = {} as Record<TrainingNeedCategory, number>;
    for (const c of TRAINING_NEED_CATEGORIES) counts[c] = needs.filter(n => (n.categories ?? []).includes(c)).length;
    return counts;
  }, [needs]);

  const visible = useMemo(() => needs.filter(n =>
    (column === "all" || (n.categories ?? []).includes(column)) &&
    (!query.trim() || norm(n.title).includes(norm(query)))
  ), [needs, column, query]);

  const expanded = open && visible.length > 0;
  const optionId = (i: number) => `${listId}-option-${i}`;

  // Keep the highlighted option in view while moving through a long list.
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [active, expanded]);

  function choose(need: TrainingNeedCatalogItem) {
    setQuery("");
    setOpen(false);
    setActive(-1);
    onPick(need);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const down = e.key === "ArrowDown";
      if (!open) {
        setOpen(true);
        // Alt+Down only opens the list; plain arrows also highlight the first or last match.
        setActive(visible.length === 0 || e.altKey ? -1 : down ? 0 : visible.length - 1);
        return;
      }
      if (visible.length === 0) return;
      setActive(i => (down ? Math.min(i + 1, visible.length - 1) : Math.max(i - 1, 0)));
    } else if (e.key === "Enter") {
      if (expanded && visible[active]) {
        e.preventDefault();
        choose(visible[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setActive(-1);
      } else if (query) {
        e.preventDefault();
        setQuery("");
      }
    }
  }

  const noMatch = query.trim()
    ? `Nothing ${column === "all" ? "in the plan" : `under ${column}`} matches "${query.trim()}".`
    : `No trainings are listed under ${column}.`;

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h4 id={headingId} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
        <ClipboardList size={12} className="text-blue-600" aria-hidden="true" /> Add a seminar from the {fiscalYear} plan
      </h4>

      {loading ? (
        <>
          {/* Same footprint as the controls, so the table doesn't jump when they arrive. */}
          <div className="mt-1.5 flex flex-wrap gap-2" aria-hidden="true">
            <div className="h-8 w-44 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-8 min-w-[220px] flex-1 animate-pulse rounded-lg bg-slate-200" />
          </div>
          <p role="status" className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Loading the {fiscalYear} plan…
          </p>
        </>
      ) : error !== null ? (
        <div role="alert" className="mt-1.5 flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <span className="flex gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Couldn't load the {fiscalYear} plan.{error ? ` ${error}` : ""}</span>
          </span>
          <button
            type="button"
            onClick={() => setReloadKey(k => k + 1)}
            className="shrink-0 rounded font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Retry
          </button>
        </div>
      ) : needs.length === 0 ? (
        <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-600">
          <ClipboardList size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
          <p>
            No trainings in the {fiscalYear} plan yet. Add them in{" "}
            {onOpenPlan ? (
              <button
                type="button"
                onClick={onOpenPlan}
                className="rounded font-semibold text-blue-700 underline hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Training Needs, step 1
              </button>
            ) : (
              <strong>Training Needs, step 1</strong>
            )}.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {/* The official form's three columns. Filtering keeps the list closed; the
                counts say how many trainings each column holds. */}
            <select
              value={column}
              onChange={e => { setColumn(e.target.value as TrainingNeedCategory | "all"); setActive(-1); }}
              aria-label="Filter the plan by column"
              className="border border-slate-300 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">All columns ({needs.length})</option>
              {TRAINING_NEED_CATEGORIES.map(c => (
                <option key={c} value={c} title={TRAINING_NEED_COLUMN_LABELS[c]}>{c} ({columnCounts[c]})</option>
              ))}
            </select>

            <div className="relative min-w-[220px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                role="combobox"
                aria-labelledby={headingId}
                aria-describedby={helpId}
                aria-autocomplete="list"
                aria-expanded={expanded}
                aria-controls={listId}
                aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
                autoComplete="off"
                spellCheck={false}
                value={query}
                placeholder={`Search the ${fiscalYear} plan…`}
                onChange={e => {
                  setQuery(e.target.value);
                  setOpen(true);
                  // Typing highlights the first match, so Enter picks it straight away.
                  setActive(e.target.value.trim() ? 0 : -1);
                }}
                onClick={() => setOpen(true)}
                onBlur={() => {
                  setOpen(false);
                  setActive(-1);
                }}
                onKeyDown={handleKeyDown}
                className="w-full border border-slate-300 rounded-lg pl-8 pr-2 py-2 text-xs bg-white text-slate-800 placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />

              {/* Floats over the table rather than pushing it down while HR searches. */}
              <ul
                id={listId}
                role="listbox"
                aria-labelledby={headingId}
                hidden={!expanded}
                // Keeps focus in the search box, so the list doesn't close before a click
                // (or a drag of its scrollbar) lands.
                onMouseDown={e => e.preventDefault()}
                className="custom-scrollbar absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                {visible.map((need, i) => {
                  const covering = seminarsByNeed.get(norm(need.title)) ?? [];
                  const columns = TRAINING_NEED_CATEGORIES.filter(c => (need.categories ?? []).includes(c));
                  return (
                    <li
                      key={need.title}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      onMouseMove={() => setActive(i)}
                      onClick={() => choose(need)}
                      className={`cursor-pointer border-l-2 px-3 py-2 ${i === active ? "border-blue-600 bg-blue-50" : "border-transparent"}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 text-xs font-semibold leading-snug text-slate-800">{need.title}</span>
                        {covering.length > 0 && (
                          <span
                            className="flex shrink-0 items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
                            title={`Covered by: ${covering.join("; ")}`}
                          >
                            <CalendarCheck size={10} aria-hidden="true" /> Has a seminar
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                        <span>{need.employeeCount} employee{need.employeeCount === 1 ? "" : "s"}</span>
                        {columns.map(c => (
                          <span key={c} className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600">{c}</span>
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {open && visible.length === 0 && (
                <p className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 shadow-lg">
                  {noMatch}
                </p>
              )}
            </div>
          </div>

          <p id={helpId} className="mt-1.5 text-[11px] text-slate-500">
            Picking a training adds a seminar row with its title and the employees who listed it.
          </p>
          <p className="sr-only" aria-live="polite">
            {open ? (visible.length === 0 ? noMatch : `${visible.length} training${visible.length === 1 ? "" : "s"} found.`) : ""}
          </p>
        </>
      )}
    </div>
  );
}

/** How a row added from the plan is getting its participants. UI-only: the server ignores it. */
export type PlanFill = "loading" | "done" | "nobody" | "failed";

/**
 * The employees to seat in a seminar named `title` that covers these plan needs: everyone
 * whose Plan A lists any of them and whom the server would enrol. Same endpoint and ranking
 * as the participant picker (GET /api/training/recommendations). Ids are Employee.id, the
 * form participantIds stores.
 */
export async function eligibleListers(title: string, fiscalYear: string, needTitles: string[] = [title]): Promise<string[]> {
  const params = new URLSearchParams({ title, fiscalYear, maxParticipants: "999" });
  for (const need of needTitles) params.append("needTitle", need);
  const res = await apiCall(`/api/training/recommendations?${params.toString()}`);
  if (res?.status !== "success") throw new Error(res?.message || "Unable to load recommendations.");
  const candidates: TrainingCandidate[] = res.data?.candidates ?? [];
  return candidates.filter(c => c.eligible && c.needsThis).map(c => c.employeeId);
}

/**
 * The Participants cell's note for a row added from the plan. It is a live region, so a
 * screen reader hears how the lookup went. The notes go once anyone is selected.
 */
export function PlanFillNote({ status, selected }: { status?: PlanFill; selected: number }) {
  if (!status) return null;
  return (
    <div role="status" className="w-full">
      {status === "loading" ? (
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
          <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden="true" /> Finding who listed it…
        </span>
      ) : status === "done" ? (
        <span className="sr-only">Selected the employees who listed it.</span>
      ) : selected > 0 ? null : (
        <span className={`flex items-start gap-1 rounded border px-1.5 py-1 text-[10px] font-semibold leading-snug ${
          status === "failed" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>
          <AlertTriangle size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
          {status === "failed"
            ? "Couldn't load who listed it. Pick participants manually."
            : "Nobody eligible listed it. Pick participants manually."}
        </span>
      )}
    </div>
  );
}
