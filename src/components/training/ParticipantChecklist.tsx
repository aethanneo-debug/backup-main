import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { Search, SearchX, Sparkles, Users, X } from "lucide-react";
import type { TdpJustificationInput, TrainingCandidate } from "../../types";
import { BADGE, CandidateBadges, RecommendedBadge } from "./candidateBadges";
import ParticipantOrderKey from "./ParticipantOrderKey";
import TdpJustificationForm from "./TdpJustificationForm";

// The participant picker's checklist (2026-10-30). It replaced three lists that showed the same people up
// to three times (the Recommended cards, the list with Add buttons, and Selected participants): each
// person in scope now has one row, ticked when selected, and a ticked row stays where it is. Rows keep
// the server's order (rankTrainingCandidates in server.ts) within the modal's groups; "Recommended" marks
// the top of it, one for each free seat, and "How this list is ordered" spells it out. Who is in scope
// and who needs a justification are worked out in ParticipantPickerModal.tsx; this draws them.

export type PickWhy = "Record why" | "Add why" | "Change why";

/** One person's row, as the modal works it out. */
export interface PickRow {
  /** Employee.id. */
  id: string;
  /** Missing for someone selected who isn't among the loaded candidates: shown by id. */
  c?: TrainingCandidate;
  name: string;
  ticked: boolean;
  disabled: boolean;
  /** The top of the order among those who can still be ticked, one for each free seat. */
  recommended: boolean;
  /** Where they stand against the TDP, after their other badges. */
  standing: { text: string; tone: string } | null;
  /** A ticked row's justification button, when it has one. */
  why: PickWhy | null;
  /** What the justification form starts from: the one kept here, else the one on record. */
  formInitial?: TdpJustificationInput;
}

export interface PickGroup {
  /** "unlisted": selected, but not among the loaded candidates. */
  key: "unlisted" | "first" | "trained" | "ineligible";
  label: string;
  /** One line under the heading: why these people are here. */
  reason: string;
  rows: PickRow[];
}

// Case and accents don't count, so "pena" finds "Peña": NFD splits "ñ" into "n" and a combining mark
// (\p{M}), which is dropped. Every word must match.
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export const searchTerms = (query: string) => fold(query).split(/\s+/).filter(Boolean);
export const rowMatches = (r: PickRow, terms: string[]) => {
  const text = fold(`${r.name} ${r.c?.position ?? ""} ${r.c?.division ?? ""}`);
  return terms.every(t => text.includes(t));
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface Props {
  /** The groups with anyone shown, the search applied (the row whose form is open always stays). */
  groups: PickGroup[];
  /** Rows before the search, and how many it shows. */
  total: number;
  shown: number;
  /** Ticked people the search hides. */
  selectedHidden: number;
  query: string;
  onQueryChange: (query: string) => void;
  /** Beside the heading: eligible people not ticked yet; null while every seat is filled. */
  choosable: number | null;
  filled: number;
  max: number;
  /** Why no row is marked Recommended (every seat filled, or nobody left to recommend), else null. */
  seatNote: ReactNode;
  /** "Select all recommended (N)", shown when N > 1. */
  bulkCount: number;
  /** Its words: "Select all recommended", or whom it ticks when that isn't everyone badged. */
  bulkLabel: string;
  onSelectAll: () => void;
  onToggle: (row: PickRow) => void;
  formFor: string | null;
  onOpenForm: (id: string) => void;
  onKeep: (id: string, value: TdpJustificationInput) => void;
  onCancelForm: () => void;
  /** People outside the plan the Plan A view leaves out (0 while it shows everyone). */
  hiddenCount: number;
  onShowAll: () => void;
  /** "FY 2027", or "this fiscal year". */
  fyText: string;
  /** False while there is nothing to rank (the list didn't load). */
  showOrderKey: boolean;
  /** A target stored on the seminar ranks those who match it (the screen no longer edits targets, 12s). */
  anyTarget: boolean;
}

const SMALL_BUTTON = "rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export default function ParticipantChecklist({
  groups, total, shown, selectedHidden, query, onQueryChange, choosable, filled, max, seatNote, bulkCount, bulkLabel, onSelectAll,
  onToggle, formFor, onOpenForm, onKeep, onCancelForm, hiddenCount, onShowAll, fyText, showOrderKey, anyTarget
}: Props) {
  const uid = useId();
  const boxId = (id: string) => `${uid}pick-${id}`;
  const searchRef = useRef<HTMLInputElement>(null);
  const searching = searchTerms(query).length > 0;
  const full = filled >= max;

  // The toolbar's height sets the rows' scroll margin (--pick-bar), so a row reached by Tab (or a form
  // opened under one) comes to rest below the toolbar stuck over the list, not under it. Scoped to the
  // rows: as the body's scroll padding it would also apply to the toolbar's own search box, and focusing
  // that while the toolbar is stuck would scroll the list. Set after every render, before the form's
  // effect scrolls (the toolbar can grow in the same render: the last seat taken adds its note), and on
  // any resize in between.
  const barRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const syncBar = () => {
    if (barRef.current && listRef.current) listRef.current.style.setProperty("--pick-bar", `${barRef.current.offsetHeight + 8}px`);
  };
  useLayoutEffect(syncBar);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncBar);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // After Keep or Cancel the form closes: focus goes back to that row's box rather than to the page.
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    const id = refocus.current;
    if (id === null) return;
    refocus.current = null;
    document.getElementById(boxId(id))?.focus();
  });

  const clearSearch = () => {
    onQueryChange("");
    searchRef.current?.focus();
  };
  // The button goes once its people are ticked (nobody it could tick is left), so focus stays in the
  // toolbar, in the search box beside it.
  const selectAll = () => {
    onSelectAll();
    searchRef.current?.focus();
  };

  const notShown = selectedHidden > 0 ? ` ${selectedHidden} selected not shown.` : "";
  const searchCount = !searching ? "" : shown === 0
    ? `No one matches “${query.trim()}”.${notShown}`
    : `${shown} of ${total} shown${hiddenCount > 0 ? " (Plan A listers only)" : ""}.${notShown}`;

  return (
    <section className="space-y-3">
      <h4 id="participant-list-heading" className="text-xs font-bold uppercase tracking-wider text-slate-600">
        Employees
        {/* How many can still be ticked, so switching lists shows here too. */}
        {choosable !== null && (
          <>{" "}<span className="font-semibold normal-case tracking-normal text-slate-500">· {choosable} to choose from</span></>
        )}
      </h4>

      {/* Why people stand where they do: the server's ranking, in plain words. */}
      {showOrderKey && <ParticipantOrderKey fyText={fyText} anyTarget={anyTarget} />}

      {/* Stuck to the top of the dialog's body while the list scrolls under it; bled to the body's edges. */}
      <div ref={barRef} className="sticky top-0 z-10 -mx-4 space-y-2 border-b border-slate-200 bg-white px-4 py-3 sm:-mx-6 sm:px-6">
        <div>
          <label htmlFor="participant-search" className="sr-only">Search employees</label>
          <div className="relative">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              id="participant-search"
              type="search"
              value={query}
              disabled={total === 0}
              onChange={e => onQueryChange(e.target.value)}
              // Esc clears the search and goes no further; on an empty box it is left alone.
              onKeyDown={e => {
                if (e.key === "Escape" && query) {
                  e.preventDefault();
                  e.stopPropagation();
                  onQueryChange("");
                }
              }}
              placeholder="Search by name, position or division…"
              autoComplete="off"
              spellCheck={false}
              aria-controls="participant-list"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && total > 0 && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {/* Read out as it changes. Hidden on screen when nothing matches: the list says so instead. */}
          <p id="participant-search-count" aria-live="polite" className={searching && shown === 0 ? "sr-only" : "pt-1 text-[11px] text-slate-600 empty:pt-0"}>
            {searchCount}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            id="participant-seats"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${
              full ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <Users size={13} aria-hidden="true" />
            {filled} of {max} seat{max === 1 ? "" : "s"} filled
          </span>
          {seatNote && <p className="min-w-0 flex-1 basis-48 text-xs text-slate-600">{seatNote}</p>}
          {/* Only people the TDP identifies, up to the free seats: anyone else is ticked one at a time. */}
          {bulkCount > 1 && (
            <button
              type="button"
              onClick={selectAll}
              title={`Ticks the first ${bulkCount} employees in the list whose Plan A lists this training. Anyone else is ticked one at a time.`}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Sparkles size={13} aria-hidden="true" />
              {bulkLabel} ({bulkCount})
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        id="participant-list"
        role="region"
        aria-labelledby="participant-list-heading"
        className="overflow-clip rounded-lg border border-slate-200 bg-white [&_*]:scroll-mt-[var(--pick-bar,0px)]"
      >
        {total === 0 ? (
          <EmptyState icon={<Users size={20} aria-hidden="true" />} title="Nobody on this list">
            {hiddenCount > 0 && (
              <>
                <p>&ldquo;All employees&rdquo; lists {plural(hiddenCount, "more employee")} outside the plan.</p>
                <button type="button" onClick={onShowAll} className={`mt-1 ${SMALL_BUTTON}`}>Show all employees</button>
              </>
            )}
          </EmptyState>
        ) : shown === 0 ? (
          <EmptyState icon={<SearchX size={20} aria-hidden="true" />} title={`No one matches “${query.trim()}”.`}>
            {hiddenCount > 0 && <p>Only Plan A listers are shown: &ldquo;All employees&rdquo; above lists {hiddenCount} more.</p>}
            {selectedHidden > 0 && <p>{plural(selectedHidden, "selected employee")} not shown.</p>}
            <button type="button" onClick={clearSearch} className={`mt-1 ${SMALL_BUTTON}`}>Clear search</button>
          </EmptyState>
        ) : (
          groups.map((g, i) => (
            <div key={g.key} className={i > 0 ? "border-t border-slate-200" : undefined}>
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                <h5 id={`participant-group-${g.key}`} className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  {g.label}{" "}
                  <span className="ml-0.5 rounded-full border border-slate-200 bg-white px-1.5 font-semibold tracking-normal text-slate-600">{g.rows.length}</span>
                </h5>
                <p className="text-[11px] leading-snug text-slate-600">{g.reason}</p>
              </div>
              <ul aria-labelledby={`participant-group-${g.key}`} className="divide-y divide-slate-100">
                {g.rows.map(r => (
                  <PickRowItem
                    key={r.id}
                    r={r}
                    boxId={boxId(r.id)}
                    formOpen={formFor === r.id}
                    onToggle={() => onToggle(r)}
                    onOpenForm={() => onOpenForm(r.id)}
                    onKeep={v => { refocus.current = r.id; onKeep(r.id, v); }}
                    onCancel={() => { refocus.current = r.id; onCancelForm(); }}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PickRowItem({ r, boxId, formOpen, onToggle, onOpenForm, onKeep, onCancel }: {
  r: PickRow;
  boxId: string;
  formOpen: boolean;
  onToggle: () => void;
  onOpenForm: () => void;
  onKeep: (value: TdpJustificationInput) => void;
  onCancel: () => void;
}) {
  // The box's name is the person's name alone; the rest of the row describes it.
  const nameId = `${boxId}-name`, recId = `${boxId}-rec`, infoId = `${boxId}-info`;
  const where = [r.c?.position, r.c?.division].filter(Boolean).join(" · ");
  const standing = r.standing && <span className={`${BADGE} ${r.standing.tone}`}>{r.standing.text}</span>;
  return (
    <li
      data-employee-id={r.id}
      data-selected={r.ticked ? "true" : "false"}
      data-recommended={r.recommended ? "true" : undefined}
      className={`px-3 transition-colors duration-150 motion-reduce:transition-none ${
        r.ticked ? "bg-blue-50/60 shadow-[inset_3px_0_0_0_var(--color-blue-600)]" : r.disabled ? "" : "hover:bg-slate-50"
      }`}
    >
      {/* The label spans the row, so the whole row ticks the box as in the needs dialog; the buttons
          and the form are its siblings, never inside it. */}
      <div className="flex items-start gap-3">
        <input
          id={boxId}
          type="checkbox"
          data-pick
          checked={r.ticked}
          disabled={r.disabled}
          onChange={onToggle}
          aria-labelledby={nameId}
          aria-describedby={r.recommended ? `${recId} ${infoId}` : infoId}
          className="mt-3 h-4 w-4 shrink-0 cursor-pointer accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed"
        />
        <label htmlFor={boxId} className={`min-w-0 flex-1 py-2.5 ${r.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              id={nameId}
              className={`min-w-0 break-words font-medium ${r.c ? "text-sm" : "font-mono text-xs"} ${
                r.c && !r.c.eligible && !r.ticked ? "text-slate-600" : "text-slate-800"
              }`}
            >
              {r.name}
            </span>
            {r.recommended && <RecommendedBadge id={recId} />}
          </span>
          <span id={infoId} className="block">
            {where && <span className="block break-words text-xs text-slate-600">{where}</span>}
            {r.c
              ? <span className="block pt-1"><CandidateBadges c={r.c} selected={r.ticked}>{standing}</CandidateBadges></span>
              : standing && <span className="flex flex-wrap gap-1 pt-1">{standing}</span>}
          </span>
        </label>
      </div>
      {r.why && (
        <div className="-mt-1 pb-2.5 pl-7">
          <button
            type="button"
            onClick={onOpenForm}
            className="rounded text-xs font-semibold text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {r.why}<span className="sr-only">: {r.name}</span>
          </button>
        </div>
      )}
      {formOpen && (
        <FormSlot>
          <TdpJustificationForm employeeName={r.name} initial={r.formInitial} onSave={onKeep} onCancel={onCancel} />
        </FormSlot>
      )}
    </li>
  );
}

// The justification form opens under its row and scrolls into view, clear of the toolbar (the list's
// scroll margin): whole when it fits below the toolbar, else from its top. ("nearest" alone does nothing
// when the form overflows both edges, which left its question under the toolbar at phone width.)
function FormSlot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let scroller = el.parentElement;
    while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const room = (scroller?.clientHeight ?? window.innerHeight) - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    el.scrollIntoView({ block: el.offsetHeight <= room ? "nearest" : "start" });
  }, []);
  return <div ref={ref} className="pb-3 sm:pl-7">{children}</div>;
}

function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-xs text-slate-500">
      <span className="text-slate-400">{icon}</span>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children}
    </div>
  );
}
