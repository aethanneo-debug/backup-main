import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ChevronRight, Scale, Search, SearchX, UserPlus, Users, X } from "lucide-react";
import type { TrainingCandidate } from "../../types";
import { tdpBadgeText } from "../../tdpRules";
import { BADGE, CandidateBadges, TONE } from "./candidateBadges";

// The participant picker's full list (it replaced a native <select> on 2026-10-30): everyone in scope
// who isn't selected yet, in the modal's groups and the server's order (rankTrainingCandidates in
// server.ts), searchable by name, position or division. Each row's badges say why it stands where it
// does, and "How this list is ordered" spells the order out.

export interface CandidateGroup {
  key: "first" | "trained" | "ineligible";
  /** The heading, e.g. "No training yet in FY 2027". */
  label: string;
  /** One line under the heading, in plain words: why these people are here. */
  reason: string;
  items: TrainingCandidate[];
}

interface Props {
  /** The modal's groups that have anyone in them, in order. Selected people are already left out. */
  groups: CandidateGroup[];
  /** Eligible people not selected yet (the heading's count). */
  availableCount: number;
  freeSlots: number;
  /** "FY 2027", or "this fiscal year". */
  fyText: string;
  /** The seminar's own justification covers them (12z Part C), so Add asks them nothing. */
  coveredBySeminar: (employeeId: string) => boolean;
  /** The modal's add(): for someone outside the plan it opens the justification form. */
  onAdd: (employeeId: string) => void;
  /** People outside the plan that the Plan A view leaves out (0 while it shows everyone). */
  hiddenCount: number;
  onShowAll: () => void;
}

// Case and accents don't count, so "pena" finds "Peña": NFD splits "ñ" into "n" and a combining mark
// (\p{M}), which is dropped.
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const matchesAll = (c: TrainingCandidate, terms: string[]) => {
  const text = fold(`${c.fullName ?? ""} ${c.position ?? ""} ${c.division ?? ""}`);
  return terms.every(t => text.includes(t));
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-slate-800">{children}</strong>;
// A badge as the rows show it, for the order key.
const Sample = ({ tone, children }: { tone: string; children: ReactNode }) => (
  <span className={`${BADGE} ${tone} inline-flex items-center gap-1 align-middle`}>{children}</span>
);
const SMALL_BUTTON = "rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export default function CandidateList({ groups, availableCount, freeSlots, fyText, coveredBySeminar, onAdd, hiddenCount, onShowAll }: Props) {
  const [query, setQuery] = useState("");
  // Read out after an Add (the row leaves the list).
  const [status, setStatus] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Who was just added, and where their Add button stood among the others.
  const justAdded = useRef<{ name: string; index: number } | null>(null);

  const terms = fold(query).split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const shownGroups = (groups ?? [])
    .map(g => ({ ...g, items: searching ? (g.items ?? []).filter(c => matchesAll(c, terms)) : g.items ?? [] }))
    .filter(g => g.items.length > 0);
  const total = (groups ?? []).reduce((n, g) => n + (g.items ?? []).length, 0);
  const shown = shownGroups.reduce((n, g) => n + g.items.length, 0);
  const canAdd = freeSlots > 0;
  // With no Add to tab to (every seat filled, or only the not eligible shown), the list itself takes
  // focus, so it can still be scrolled from the keyboard.
  const anyAddable = canAdd && shownGroups.some(g => g.items.some(c => c.eligible));
  // A target stored on the seminar ranks those who match it (the screen no longer edits targets, 12s).
  const anyTarget = (groups ?? []).some(g => (g.items ?? []).some(c => c.matchesTarget));

  const addButtons = () => [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-add]:not(:disabled)") ?? [])];
  const handleAdd = (e: MouseEvent<HTMLButtonElement>, c: TrainingCandidate) => {
    justAdded.current = { name: c.fullName, index: addButtons().indexOf(e.currentTarget) };
    onAdd(c.employeeId);
  };

  // After an Add the row leaves the list, and the button pressed with it. Focus goes to the next row's
  // Add (the search box when none is left), so a keyboard user carries on from the same place, unless
  // the justification form for someone outside the plan took it.
  useEffect(() => {
    const added = justAdded.current;
    if (!added) return;
    justAdded.current = null;
    setStatus(`Added ${added.name}. ${freeSlots === 0 ? "All seats are filled." : `${plural(freeSlots, "seat")} left.`}`);
    if (document.activeElement && document.activeElement !== document.body) return;
    const buttons = addButtons();
    (buttons[Math.min(added.index, buttons.length - 1)] ?? searchRef.current)?.focus();
  });

  const clearSearch = () => {
    setQuery("");
    searchRef.current?.focus();
  };

  return (
    <section className="space-y-2">
      <h4 id="participant-list-heading" className="text-xs font-bold uppercase tracking-wider text-slate-600">
        Select or recommend an employee
        {/* How many it offers, so switching lists shows here too. */}
        {freeSlots > 0 && (
          <>{" "}<span className="font-semibold normal-case tracking-normal text-slate-500">· {availableCount} to choose from</span></>
        )}
      </h4>

      {/* Why people stand where they do: the server's ranking, in plain words. */}
      <details id="participant-order-key" className="group text-xs">
        <summary className="inline-flex cursor-pointer select-none list-none items-center gap-1 rounded font-semibold text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
          <ChevronRight size={14} aria-hidden="true" className="transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" />
          How this list is ordered
        </summary>
        <div className="mt-1.5 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 leading-relaxed text-slate-700">
          <p>Who comes first, in order of importance:</p>
          <ol className="list-decimal space-y-1 pl-5 marker:font-semibold marker:text-slate-500">
            <li>
              <B>Those who can be enrolled.</B> The <B>Not eligible</B> come last: already enrolled in this seminar, attended it
              in an earlier year, or HR recorded a training with the same title.
            </li>
            <li>
              <B>No training yet in {fyText}</B> <Sample tone={TONE.firstTraining}>No training yet this FY</Sample>: everyone
              should have at least one training a year.
            </li>
            <li>
              <B>Their own Plan A for {fyText} lists this training</B> <Sample tone={TONE.needsThis}>Needs this</Sample>: the
              Training and Development Plan identifies them.
            </li>
            <li>
              Among those, <B>a training the law requires</B>{" "}
              <Sample tone={TONE.mandated}><Scale size={10} aria-hidden="true" />Mandated</Sample> first.
            </li>
            <li>
              <B>New hires</B> <Sample tone={TONE.newHire}>New hire</Sample>: hired less than 12 months ago.
            </li>
            <li>
              Then{" "}
              {anyTarget && <>those matching the seminar&rsquo;s target <Sample tone={TONE.neutral}>Target match</Sample>, then </>}
              <B>the most recently hired</B>, then <B>by name</B>, A to Z.
            </li>
          </ol>
          <p className="border-t border-slate-200 pt-2 text-slate-600">
            &ldquo;Recommended for this seminar&rdquo; above is the top of this order, one for each free seat.
          </p>
        </div>
      </details>

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
            onChange={e => setQuery(e.target.value)}
            // Esc clears the search and goes no further; on an empty box it is left alone.
            onKeyDown={e => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                e.stopPropagation();
                setQuery("");
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
        <p id="participant-search-count" aria-live="polite" className={searching && shown === 0 ? "sr-only" : "pt-1 text-[11px] text-slate-500 empty:pt-0"}>
          {!searching ? "" : shown === 0
            ? `No one matches “${query.trim()}”.`
            : `${shown} of ${total} shown${hiddenCount > 0 ? " (Plan A listers only)" : ""}.`}
        </p>
      </div>

      {!canAdd && total > 0 && (
        <p className="text-xs italic text-slate-500">Maximum participants reached. Remove someone from Selected participants to add another.</p>
      )}

      {/* scroll-pt keeps a row reached by Tab clear of the sticky group heading. */}
      <div
        ref={listRef}
        id="participant-list"
        role="region"
        aria-labelledby="participant-list-heading"
        tabIndex={anyAddable ? undefined : 0}
        className="custom-scrollbar relative max-h-72 scroll-pt-12 overflow-y-auto rounded-lg border border-slate-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {total === 0 ? (
          <EmptyState icon={<Users size={20} aria-hidden="true" />} title="Nobody left on this list">
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
            <button type="button" onClick={clearSearch} className={`mt-1 ${SMALL_BUTTON}`}>Clear search</button>
          </EmptyState>
        ) : (
          shownGroups.map((g, i) => (
            <div key={g.key} className={i > 0 ? "border-t border-slate-200" : undefined}>
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                <h5 id={`participant-group-${g.key}`} className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  {g.label}{" "}
                  <span className="ml-0.5 rounded-full border border-slate-200 bg-white px-1.5 font-semibold tracking-normal text-slate-600">{g.items.length}</span>
                </h5>
                <p className="text-[11px] leading-snug text-slate-600">{g.reason}</p>
              </div>
              <ul aria-labelledby={`participant-group-${g.key}`} className="divide-y divide-slate-100">
                {g.items.map(c => (
                  <CandidateRow key={c.employeeId} c={c} canAdd={canAdd} covered={coveredBySeminar(c.employeeId)} onAdd={e => handleAdd(e, c)} />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <p id="participant-add-status" role="status" className="sr-only">{status}</p>
    </section>
  );
}

function CandidateRow({ c, canAdd, covered, onAdd }: {
  c: TrainingCandidate;
  canAdd: boolean;
  covered: boolean;
  onAdd: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const where = [c.position, c.division].filter(Boolean).join(" · ");
  // Someone the plan doesn't list: Add asks why they are seated, unless the seminar's own justification
  // covers everyone on it (12z Part C). Word for word what the selected list shows once they are added.
  const outsidePlan = c.eligible && !c.needsThis;
  return (
    <li data-employee-id={c.employeeId} className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <p className={`break-words text-sm font-medium ${c.eligible ? "text-slate-800" : "text-slate-600"}`}>{c.fullName}</p>
        {where && <p className="break-words text-xs text-slate-500">{where}</p>}
        <div className="pt-0.5">
          <CandidateBadges c={c}>
            {outsidePlan && (covered
              ? <span className={`${BADGE} ${TONE.underSeminar}`}>{tdpBadgeText("seminar")}</span>
              : <span className={`${BADGE} ${TONE.needsJustification}`}>Not in their TDP: needs a justification</span>)}
          </CandidateBadges>
        </div>
      </div>
      {/* None for the not eligible: their badge says why. */}
      {c.eligible && (
        <button
          type="button"
          data-add
          onClick={onAdd}
          disabled={!canAdd}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 enabled:hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
        >
          <UserPlus size={13} aria-hidden="true" />
          Add<span className="sr-only"> {c.fullName}</span>
        </button>
      )}
    </li>
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
