import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { ChevronRight, Search, SearchX, Sparkles, Users, X } from "lucide-react";
import type { TdpJustificationInput, TrainingCandidate } from "../../types";
import { searchTerms } from "../../tableView";
import ParticipantOrderKey from "./ParticipantOrderKey";
import PickRowItem from "./PickRowItem";

// The participant picker's checklist (2026-10-30). It replaced three lists that showed the same people up
// to three times (the Recommended cards, the list with Add buttons, and Selected participants): each
// person in scope now has one row, ticked when selected, and a ticked row stays where it is. Rows keep
// the server's order (rankTrainingCandidates in server.ts) within the modal's groups; "Recommended" marks
// the top of it, one for each free seat, and "How this list is ordered" spells it out. Who is in scope
// and who needs a justification are worked out in ParticipantPickerModal.tsx; this draws them.
// Since the instructor's review (R10, 2026-11-03) two groups fold: "Already trained this FY", whose rows still
// count, and "Already sent to this training", whose rows can't be ticked. A ticked row shows whatever is folded.

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
  /** Already sent to this training and not on this seminar: no box, only when and where they went (R10). */
  readOnly?: boolean;
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
  /** "unlisted": selected, but not among the loaded candidates. "sent": already sent to this training. */
  key: "unlisted" | "first" | "trained" | "sent";
  label: string;
  /** One line under the heading: why these people are here (and, for a folded group, what it hides). */
  reason: string;
  /** The rows shown: after the fold and the search. */
  rows: PickRow[];
  /** A group that opens and closes (R10). Its heading is the toggle, and it is shown even with no row on screen. */
  fold?: { label: string; open: boolean; onToggle: () => void };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface Props {
  /** The groups with anyone shown, the search applied (the row whose form is open always stays), and the folded
   * groups whatever they show. */
  groups: PickGroup[];
  /** Everyone in the groups, folded or not: none, and the list says so. */
  everyone: number;
  /** Rows on screen before the search, and how many it shows. */
  total: number;
  shown: number;
  /** Rows the closed groups hide that match the search. */
  hiddenMatches: number;
  /** Ticked people the search hides. */
  selectedHidden: number;
  query: string;
  onQueryChange: (query: string) => void;
  /** Beside the heading: eligible people on screen not ticked yet; null while every seat is filled. */
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
  /** Opens the person's training history (R10, R11). */
  onHistory: (row: PickRow) => void;
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
  groups, everyone, total, shown, hiddenMatches, selectedHidden, query, onQueryChange, choosable, filled, max, seatNote, bulkCount,
  bulkLabel, onSelectAll, onToggle, onHistory, formFor, onOpenForm, onKeep, onCancelForm, hiddenCount, onShowAll, fyText,
  showOrderKey, anyTarget
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
  const inClosed = hiddenMatches > 0 ? ` ${hiddenMatches} more in the closed lists.` : "";
  const searchCount = !searching ? "" : shown === 0
    ? `No one matches “${query.trim()}”.${inClosed}${notShown}`
    : `${shown} of ${total} shown${hiddenCount > 0 ? " (Plan A listers only)" : ""}.${inClosed}${notShown}`;

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
              disabled={everyone === 0}
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
            {query && everyone > 0 && (
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
          {/* Only people the TDP identifies, up to the free seats: anyone else is ticked one at a time. Not during a
              search: it would tick people the search has hidden. */}
          {bulkCount > 1 && !searching && (
            <button
              type="button"
              onClick={selectAll}
              title={`Ticks the first ${bulkCount} employees on screen whose Plan A lists this training and who need no justification of their own. Anyone else is ticked one at a time.`}
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
        {everyone === 0 ? (
          <EmptyState icon={<Users size={20} aria-hidden="true" />} title="Nobody on this list">
            {hiddenCount > 0 && (
              <>
                <p>&ldquo;All employees&rdquo; lists {plural(hiddenCount, "more employee")} outside the plan.</p>
                <button type="button" onClick={onShowAll} className={`mt-1 ${SMALL_BUTTON}`}>Show all employees</button>
              </>
            )}
          </EmptyState>
        ) : (
          <>
            {searching && shown === 0 && (
              <EmptyState icon={<SearchX size={20} aria-hidden="true" />} title={`No one matches “${query.trim()}”.`}>
                {hiddenMatches > 0 && <p>{hiddenMatches} more in the closed lists below: open them to see who.</p>}
                {hiddenCount > 0 && <p>Only Plan A listers are shown: &ldquo;All employees&rdquo; above lists {hiddenCount} more.</p>}
                {selectedHidden > 0 && <p>{plural(selectedHidden, "selected employee")} not shown.</p>}
                <button type="button" onClick={clearSearch} className={`mt-1 ${SMALL_BUTTON}`}>Clear search</button>
              </EmptyState>
            )}
            {groups.map((g, i) => {
              const headingId = `participant-group-${g.key}`;
              const listId = `${headingId}-list`;
              return (
                <div key={g.key} data-pick-group={g.key} className={i > 0 || (searching && shown === 0) ? "border-t border-slate-200" : undefined}>
                  <div className="border-b border-slate-200 bg-slate-50 py-1.5">
                    {g.fold ? (
                      // The heading is the toggle (an accordion's): the whole bar opens and closes the group.
                      <h5 id={headingId} className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        <button
                          type="button"
                          data-trained-toggle={g.key === "trained" ? "" : undefined}
                          data-sent-toggle={g.key === "sent" ? "" : undefined}
                          aria-expanded={g.fold.open}
                          aria-controls={g.rows.length > 0 ? listId : undefined}
                          onClick={g.fold.onToggle}
                          className="flex w-full cursor-pointer items-center gap-1 px-3 text-left font-bold uppercase tracking-wider hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                        >
                          <ChevronRight
                            size={13}
                            aria-hidden="true"
                            className={`shrink-0 transition-transform duration-150 motion-reduce:transition-none ${g.fold.open ? "rotate-90" : ""}`}
                          />
                          {g.fold.label}
                        </button>
                      </h5>
                    ) : (
                      <h5 id={headingId} className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        {g.label}{" "}
                        <span className="ml-0.5 rounded-full border border-slate-200 bg-white px-1.5 font-semibold tracking-normal text-slate-600">{g.rows.length}</span>
                      </h5>
                    )}
                    <p className={`px-3 text-[11px] leading-snug text-slate-600 ${g.fold ? "pl-[1.85rem]" : ""}`}>{g.reason}</p>
                  </div>
                  {g.rows.length > 0 && (
                    <ul id={listId} aria-labelledby={headingId} className="divide-y divide-slate-100">
                      {g.rows.map(r => (
                        <PickRowItem
                          key={r.id}
                          r={r}
                          boxId={boxId(r.id)}
                          formOpen={formFor === r.id}
                          onToggle={() => onToggle(r)}
                          onHistory={() => onHistory(r)}
                          onOpenForm={() => onOpenForm(r.id)}
                          onKeep={v => { refocus.current = r.id; onKeep(r.id, v); }}
                          onCancel={() => { refocus.current = r.id; onCancelForm(); }}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
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
