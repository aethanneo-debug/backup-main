import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ListChecks, Loader2, X } from "lucide-react";
import { TrainingCandidate, type TdpJustification, type TdpJustificationInput, type TdpStanding } from "../../types";
import { apiCall, getLocalTodayString } from "../../utils";
import { datesText, divisionGaps, seminarWeekdays } from "../../divisionCoverage";
import { tdpBadgeText } from "../../tdpRules";
import { TONE } from "./candidateBadges";
import ParticipantChecklist, { rowMatches, searchTerms, type PickGroup, type PickRow } from "./ParticipantChecklist";
import PlanAViewSwitch from "./PlanAViewSwitch";

// The seminar being staffed: a saved program or an unsaved draft row from the TDP table.
export interface PickerProgram {
  id: string;
  isNew: boolean;
  title: string;
  fiscalYear?: string;
  targetDivision?: string;
  targetSpecialization?: string;
  maxParticipants: number | string;
  // Plan A entries this seminar covers; drives the "Needs this" ranking.
  fulfillsNeedTitles?: string[];
  // Its days (YYYY-MM-DD): who is at another seminar then, and which division would be left with nobody.
  startDate?: string;
  endDate?: string;
  // On its roster but marked "Did not attend", so at the office: left out of the division warning.
  notAwayIds?: string[];
  // A saved seminar's enrolments, by Employee.id: where each stands against the TDP (12z).
  roster?: Record<string, { tdp?: TdpStanding; tdpException?: TdpJustification }>;
  // The seminar is held outside the TDP with its own justification (now, or asked at Save): it covers
  // everyone on it, so nobody needs one of their own (Part C). The row's guess until the server answers.
  seminarCovers?: boolean;
}

interface Props {
  program: PickerProgram;
  initialSelectedIds: string[];
  /** Justifications kept with the draft row, by Employee.id (saved with the seminar). */
  initialJustifications?: Record<string, TdpJustificationInput>;
  /** People the server asked a justification for (OUTSIDE_TDP), by Employee.id. */
  mustJustify?: string[];
  onConfirm: (ids: string[], justifications: Record<string, TdpJustificationInput>) => void;
  onClose: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const seatsLeft = (free: number) => (free <= 0 ? "All seats are filled." : `${plural(free, "seat")} left.`);
const OUTSIDE_TDP = "Not in their TDP: needs a justification";

export default function ParticipantPickerModal({ program, initialSelectedIds, initialJustifications, mustJustify, onConfirm, onClose }: Props) {
  const [candidates, setCandidates] = useState<TrainingCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds ?? []);
  const [reloadKey, setReloadKey] = useState(0);
  // The server's answer for the seminar as drafted (Part C): its own justification will cover everyone on
  // it. Null until it arrives; the row's guess stands in meanwhile.
  const [serverCovers, setServerCovers] = useState<boolean | null>(null);
  // A seminar that covers Plan A needs lists only those whose plan lists one of them; "All employees" is
  // for the exceptions (someone with no plan entry, or one HR knows needs it anyway).
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  // Read out after each tick: the rows stay where they are, so nothing else says what changed.
  const [status, setStatus] = useState("");
  // Unticked since the view last changed: their rows stay put even where the Plan A view would leave them
  // out, so nothing moves under HR's pointer. Switching views lets them go.
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  const switchView = (all: boolean) => {
    setShowAll(all);
    setKept(new Set());
  };
  const coversNeeds = (program.fulfillsNeedTitles ?? []).length > 0;
  const planOnly = coversNeeds && !showAll;
  const inScope = (c: TrainingCandidate) => !planOnly || c.needsThis;

  // Mirrors the server, which treats a blank or invalid max as 1.
  const max = parseInt(String(program.maxParticipants)) || 1;
  const freeSlots = Math.max(0, max - selectedIds.length);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      title: program.title || "",
      fiscalYear: program.fiscalYear || "",
      targetDivision: program.targetDivision || "",
      targetSpecialization: program.targetSpecialization || "",
      maxParticipants: String(max),
      startDate: program.startDate || "",
      endDate: program.endDate || ""
    });
    if (!program.isNew) params.set("programId", program.id);
    // Repeatable needTitle, so an unsaved draft row ranks by the plan too. A row with no needs sends
    // one empty needTitle: with none at all, the server would go by the saved seminar's needs.
    const needTitles = program.fulfillsNeedTitles ?? [];
    if (needTitles.length === 0) params.append("needTitle", "");
    for (const title of needTitles) params.append("needTitle", title);

    setLoading(true);
    setError("");
    apiCall(`/api/training/recommendations?${params.toString()}`)
      .then(res => {
        if (cancelled) return;
        if (res.status === "success") {
          setCandidates(res.data?.candidates ?? []);
          if (typeof res.data?.seminarCovers === "boolean") setServerCovers(res.data.seminarCovers);
        } else setError(res.message || "Unable to load recommendations.");
      })
      .catch(err => { if (!cancelled) setError(err.message || "Unable to load recommendations."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [program.id, program.isNew, program.title, program.fiscalYear, program.targetDivision, program.targetSpecialization,
      (program.fulfillsNeedTitles ?? []).join("|"), max, program.startDate, program.endDate, reloadKey]);

  const byId = useMemo(() => new Map((candidates ?? []).map(c => [c.employeeId, c])), [candidates]);

  // Someone must stay to man each division (HSAC RAB 1): the divisions this choice would leave with
  // nobody at the office on the seminar's days still to come. The server checks it again on Save,
  // where HR may confirm it; this only warns as people are chosen.
  const divisionGapsNow = useMemo(() => {
    const today = getLocalTodayString();
    const days = seminarWeekdays(program.startDate, program.endDate).filter(d => d >= today);
    if (days.length === 0 || (candidates ?? []).length === 0) return [];
    const away = new Map((candidates ?? []).map(c => [c.employeeId, new Set(c.awayOn ?? [])]));
    // All active staff (the whole candidate list, never the Plan A view of it), and the roster less
    // anyone marked "Did not attend", as the server counts them.
    const notAway = new Set(program.notAwayIds ?? []);
    return divisionGaps((candidates ?? []).map(c => ({ id: c.employeeId, division: c.division })), days,
      selectedIds.filter(id => !notAway.has(id)), (id, day) => !!away.get(id)?.has(day));
  }, [candidates, selectedIds, program.startDate, program.endDate, (program.notAwayIds ?? []).join("|")]);
  // "Recommended" (and "Select all recommended") follow the list in scope.
  const available = (candidates ?? []).filter(c => c.eligible && !selectedIds.includes(c.employeeId) && inScope(c));
  const recommended = available.slice(0, freeSlots);
  const listers = (candidates ?? []).filter(c => c.needsThis).length;
  // What "All employees" adds: everyone off the plan not selected yet (whichever list is on), and, while
  // the Plan A list is on, how many of them are hidden and how many could be picked.
  const outsidePlan = (candidates ?? []).filter(c => !c.needsThis && !selectedIds.includes(c.employeeId));
  // (Not those kept on screen after being unticked: they are shown, not hidden.)
  const offPlan = planOnly ? outsidePlan.filter(c => !kept.has(c.employeeId)) : [];
  const hiddenCount = offPlan.length;
  const hiddenEligible = offPlan.filter(c => c.eligible).length;

  // Someone the TDP doesn't identify is seated only with a justification (HSAC RAB 1, 2026-10-28,
  // 12z): their Plan A for the seminar's year lists none of its needs. The server checks it again on
  // Save. Like it, only what a change adds needs one: a new seat, someone this edit of the seminar's
  // needs turns outside the TDP, or someone the server named. An older enrolment keeps its badge.
  const [justifications, setJustifications] = useState<Record<string, TdpJustificationInput>>(initialJustifications ?? {});
  const [formFor, setFormFor] = useState<string | null>(null);
  const required = new Set(mustJustify ?? []);
  const saved = (id: string) => program.roster?.[id];
  // Someone not among the candidates (the list didn't load, or they're inactive) counts as outside only
  // when the server named them, so a refusal can always be answered here.
  const outsideTdp = (id: string) => { const c = byId.get(id); return c ? !c.needsThis : required.has(id); };
  // The seminar's own justification covers them (Part C); never someone the server named, so a refusal
  // can be answered here even when this answer turns out wrong.
  const seminarCovers = serverCovers ?? !!program.seminarCovers;
  const bySeminar = (id: string) => seminarCovers && !required.has(id);
  const needsJustification = (id: string) => !bySeminar(id) && outsideTdp(id) && !justifications[id] && !saved(id)?.tdpException
    && (!saved(id) || required.has(id) || saved(id)?.tdp === "identified");
  const pending = selectedIds.filter(needsJustification);
  // "Select all recommended" ticks only people the TDP identifies, up to the free seats; anyone else is
  // ticked one at a time.
  const bulk = available.filter(c => c.needsThis).slice(0, freeSlots);
  // In the "All employees" view the top of the order can include someone off the plan, whom the button
  // doesn't tick: then it says whom it ticks instead of "all recommended" (the code review, 2026-10-30).
  const bulkIsRecommended = bulk.length === recommended.length && bulk.every((c, i) => c.employeeId === recommended[i]?.employeeId);

  const add = (ids: string[]) => {
    setSelectedIds(prev => {
      const next = [...prev];
      for (const id of ids) {
        if (next.length >= max) break;
        if (!next.includes(id)) next.push(id);
      }
      return next;
    });
    // Adding someone off the plan opens the form for them, unless another one is open (what was typed in
    // it stays; theirs waits behind "Record why"), or the seminar's own justification covers them.
    if (ids.length === 1 && !bySeminar(ids[0]) && formFor === null && selectedIds.length < max && !selectedIds.includes(ids[0]) && outsideTdp(ids[0]) && !justifications[ids[0]]) {
      setFormFor(ids[0]);
    }
  };
  const remove = (id: string) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
    setJustifications(prev => { const next = { ...prev }; delete next[id]; return next; });
    if (formFor === id) setFormFor(null);
  };
  const keep = (id: string, value: TdpJustificationInput) => {
    setJustifications(prev => ({ ...prev, [id]: value }));
    setFormFor(null);
  };

  const toggle = (r: PickRow) => {
    if (r.ticked) {
      remove(r.id);
      setKept(prev => new Set(prev).add(r.id));
      setStatus(`Removed ${r.name}. ${seatsLeft(max - selectedIds.length + 1)}`);
    } else if (selectedIds.length < max) {
      add([r.id]);
      setStatus(`Selected ${r.name}. ${seatsLeft(freeSlots - 1)}`);
    }
  };
  const selectAll = () => {
    add(bulk.map(c => c.employeeId));
    setStatus(`Selected ${plural(bulk.length, "recommended employee")}. ${seatsLeft(freeSlots - bulk.length)}`);
  };

  // One row per person: everyone in scope, anyone ticked (so a choice is never hidden, the Plan A view
  // included) and anyone just unticked.
  const selected = new Set(selectedIds);
  const recommendedIds = new Set(recommended.map(c => c.employeeId));
  const toRow = (id: string, c?: TrainingCandidate): PickRow => {
    const name = c ? c.fullName : id;
    if (!selected.has(id)) {
      // Off the plan: ticking them asks why they are seated, unless the seminar's own justification
      // covers everyone on it (Part C). Word for word what their row says once ticked.
      const outside = !!c && c.eligible && !c.needsThis;
      return {
        id, c, name, ticked: false, why: null,
        disabled: (!!c && !c.eligible) || freeSlots === 0,
        recommended: recommendedIds.has(id),
        standing: !outside ? null : bySeminar(id)
          ? { text: tdpBadgeText("seminar") ?? "", tone: TONE.underSeminar }
          : { text: OUTSIDE_TDP, tone: TONE.needsJustification }
      };
    }
    const draft = justifications[id];
    const onRecord = saved(id);
    const waiting = needsJustification(id);
    // The justification kept here, else the one on record, else the enrolment's standing; none for
    // someone the TDP identifies (an edit of the needs can make it so).
    const badge = !outsideTdp(id) ? null
      : bySeminar(id) && !draft && !onRecord?.tdpException ? tdpBadgeText("seminar")
      : draft ? tdpBadgeText("justified", draft)
      : onRecord?.tdpException ? tdpBadgeText("justified", onRecord.tdpException)
      : onRecord && onRecord.tdp !== "identified" ? tdpBadgeText(onRecord.tdp) : null;
    // Seated under the seminar's justification (Part C) counts as justified, even once the seminar
    // covers a need, as the server holds it; it needs no reason of its own.
    const underSeminar = !draft && !onRecord?.tdpException && onRecord?.tdp === "seminar";
    const unjustified = !bySeminar(id) && !draft && !onRecord?.tdpException && !underSeminar;
    return {
      // Always on, so anyone ticked can be taken off, someone not eligible included.
      id, c, name, ticked: true, disabled: false, recommended: false,
      standing: waiting ? { text: OUTSIDE_TDP, tone: TONE.needsJustification }
        : badge ? { text: badge, tone: unjustified ? TONE.unjustified : TONE.justified } : null,
      // (A representative's "In lieu of" is changed from the attendance list, Part B.)
      why: outsideTdp(id) && !bySeminar(id) && !underSeminar && onRecord?.tdpException?.kind !== "In lieu of" && formFor !== id
        ? (waiting ? "Record why" : unjustified ? "Add why" : "Change why") : null,
      formInitial: draft ?? onRecord?.tdpException
    };
  };
  const listed = (candidates ?? []).filter(c => inScope(c) || selected.has(c.employeeId) || kept.has(c.employeeId));
  // Anyone selected missing from the candidates (no longer active, or the list didn't load), by id at
  // the top: they can still be unticked, or given a justification the server asked for.
  const unlisted = [...new Set([...(initialSelectedIds ?? []), ...selectedIds])]
    .filter(id => !byId.has(id) && (selected.has(id) || kept.has(id)));
  // At least one training per year per employee: those with none yet in the seminar's fiscal year
  // come first. Each group keeps the server's order (Plan A listers, a mandated need first among them,
  // then new hires, first), ticked people included. Each heading says why in one line.
  const fyText = program.fiscalYear ? `FY ${program.fiscalYear}` : "this fiscal year";
  const groups: PickGroup[] = [
    { key: "unlisted", label: error ? "Selected" : "Selected, not among the active staff",
      reason: error ? "The list didn't load, so they are shown by record id. Untick to take them off."
        : "On this seminar, but not among the active employees, so only their record id is known. Untick to take them off.",
      rows: unlisted.map(id => toRow(id)) },
    { key: "first", label: `No training yet in ${fyText}`, reason: "Everyone should have at least one training a year, so they come first.",
      rows: listed.filter(c => c.eligible && (c.trainingsThisYear ?? []).length === 0).map(c => toRow(c.employeeId, c)) },
    { key: "trained", label: `Already has a training in ${fyText}`, reason: "Already trained this fiscal year; they may still join another seminar.",
      rows: listed.filter(c => c.eligible && (c.trainingsThisYear ?? []).length > 0).map(c => toRow(c.employeeId, c)) },
    { key: "ineligible", label: "Not eligible", reason: "Already enrolled in this seminar, or attended it before: they can't be selected.",
      rows: listed.filter(c => !c.eligible).map(c => toRow(c.employeeId, c)) }
  ];
  // The search filters every row, ticked ones included, but never the row whose form is open: what was
  // typed in it would be lost.
  const terms = searchTerms(query);
  const shownGroups = groups
    .map(g => ({ ...g, rows: terms.length === 0 ? g.rows : g.rows.filter(r => r.id === formFor || rowMatches(r, terms)) }))
    .filter(g => g.rows.length > 0);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const shownIds = new Set(shownGroups.flatMap(g => g.rows.map(r => r.id)));
  const pendingHidden = pending.filter(id => !shownIds.has(id)).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="participant-picker-title">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start bg-slate-50">
          <div>
            <h3 id="participant-picker-title" className="text-lg font-semibold text-slate-800">Select Participants</h3>
            <p className="text-xs text-slate-500 mt-0.5">{program.title || "Untitled seminar"}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>

        {/* The only scroller: the checklist's toolbar sticks to its top, and a form opened under a row has
            room. No top padding on the scroller itself: a sticky element stops below it, and rows would show
            through the gap above the toolbar. */}
        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="space-y-4 pt-4 sm:pt-6">
            {/* The order itself is in "How this list is ordered"; this keeps only what is particular to the seminar. */}
            <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 p-3 rounded-lg flex gap-2">
              <ListChecks size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                Tick the employees who will attend.{" "}
                {coversNeeds && (
                  <>This seminar covers Plan A needs, so at first only the employees whose plan lists it are shown; their badge says in
                  which column: for their <strong>function</strong>, an <strong>additional designation</strong>, or <strong>career advancement</strong>.{" "}</>
                )}
                {seminarCovers && (
                  <>This seminar covers no Plan A need, so it is held <strong>outside the TDP</strong> with its own justification, which
                  covers everyone on it.{" "}</>
                )}
                Employees may join more than one seminar a year; only those who attended this seminar before can&rsquo;t be selected.
              </p>
            </div>

            {coversNeeds && !loading && !error && (
              <PlanAViewSwitch
                planOnly={planOnly}
                listers={listers}
                outsidePlan={outsidePlan.length}
                everyone={(candidates ?? []).length}
                hiddenCount={hiddenCount}
                seminarCovers={seminarCovers}
                fyText={fyText}
                onSwitch={switchView}
              />
            )}

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
                <Loader2 size={16} className="animate-spin" /> Loading recommendations…
              </div>
            ) : (
              <>
                {error && (
                  <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-start justify-between gap-3">
                    <span className="flex gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{error}</span>
                    {/* Reloading redraws the list, so a justification form left open would lose what was typed. */}
                    <button
                      onClick={() => {
                        if (formFor !== null && !window.confirm("Retrying reloads the list, and what you typed in the open justification form will be lost. Retry anyway?")) return;
                        setReloadKey(k => k + 1);
                      }}
                      className="font-semibold underline shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {/* Without the list, still the people already selected: they can be unticked, or given a
                    justification the server asked for. */}
                {(!error || total > 0) && (
                  <ParticipantChecklist
                    groups={shownGroups}
                    total={total}
                    shown={shownIds.size}
                    selectedHidden={selectedIds.filter(id => !shownIds.has(id)).length}
                    query={query}
                    onQueryChange={setQuery}
                    choosable={freeSlots > 0 && !error ? available.length : null}
                    filled={selectedIds.length}
                    max={max}
                    seatNote={error ? null : freeSlots === 0
                      ? `${max === 1 ? "The 1 seat is" : `All ${max} seats are`} filled. Untick someone to choose another.`
                      : recommended.length === 0
                        ? hiddenEligible > 0
                          ? <>Nobody else whose Plan A lists this training can be added. &ldquo;All employees&rdquo; above lists the others.</>
                          : "No more eligible employees to recommend."
                        : null}
                    bulkCount={bulk.length}
                    bulkLabel={bulkIsRecommended ? "Select all recommended" : "Select the top Plan A listers"}
                    onSelectAll={selectAll}
                    onToggle={toggle}
                    formFor={formFor}
                    onOpenForm={setFormFor}
                    onKeep={keep}
                    onCancelForm={() => setFormFor(null)}
                    hiddenCount={hiddenCount}
                    onShowAll={() => switchView(true)}
                    fyText={fyText}
                    showOrderKey={(candidates ?? []).length > 0}
                    anyTarget={listed.some(c => c.matchesTarget)}
                  />
                )}
              </>
            )}
          </div>
        </div>

        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-200 bg-slate-50 space-y-3 shrink-0">
          {/* A division left with nobody at the office: a warning, since HR may go ahead knowingly. Under
              the list, it stays in view while people are ticked, and coming or going it moves no row. */}
          {divisionGapsNow.length > 0 && (
            <div role="status" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">Someone must stay to man the division. With these participants, nobody would be left at the office:</p>
                <ul className="list-disc pl-4">
                  {divisionGapsNow.map(g => <li key={g.division}>{g.division}: on {datesText(g.dates)}</li>)}
                </ul>
                <p>You can still save it. Save asks you to confirm any day this change adds, and records it in the audit log.</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {pending.length > 0 && (
              <p role="status" className="mr-auto text-xs text-amber-800">
                {pending.length === 1 ? "1 person needs" : `${pending.length} people need`} a justification: record why, or untick them
                {pendingHidden > 0 ? ` (${pendingHidden} hidden by the search)` : ""}.
              </p>
            )}
            <button onClick={onClose} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
            <button
              onClick={() => onConfirm(selectedIds, Object.fromEntries(selectedIds.filter(id => justifications[id]).map(id => [id, justifications[id]])))}
              disabled={(loading && !error) || pending.length > 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm Participants ({selectedIds.length})
            </button>
          </div>
        </div>
        {/* Says what each tick did (always in the page, so the first change is read out too). */}
        <p id="participant-pick-status" role="status" className="sr-only">{status}</p>
      </div>
    </div>
  );
}
