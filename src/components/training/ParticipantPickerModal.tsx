import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Sparkles, UserPlus, Users, X } from "lucide-react";
import { TrainingCandidate, type TdpJustification, type TdpJustificationInput, type TdpStanding } from "../../types";
import { apiCall, getLocalTodayString } from "../../utils";
import { datesText, divisionGaps, seminarWeekdays } from "../../divisionCoverage";
import { tdpBadgeText } from "../../tdpRules";
import { BADGE, CandidateBadges, optionLabel } from "./candidateBadges";
import TdpJustificationForm from "./TdpJustificationForm";

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

export default function ParticipantPickerModal({ program, initialSelectedIds, initialJustifications, mustJustify, onConfirm, onClose }: Props) {
  const [candidates, setCandidates] = useState<TrainingCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds ?? []);
  const [reloadKey, setReloadKey] = useState(0);
  // A seminar that covers Plan A needs lists only those whose plan lists one of them; "Show all
  // employees" is for the exceptions (someone with no plan entry, or one HR knows needs it anyway).
  const [showAll, setShowAll] = useState(false);
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
        if (res.status === "success") setCandidates(res.data?.candidates ?? []);
        else setError(res.message || "Unable to load recommendations.");
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
  // Recommended (and "Add all recommended") and the dropdown follow the list in scope.
  const available = (candidates ?? []).filter(c => c.eligible && !selectedIds.includes(c.employeeId) && inScope(c));
  const recommended = available.slice(0, freeSlots);
  const listers = (candidates ?? []).filter(c => c.needsThis).length;
  // What "Show all employees" adds: everyone off the plan not selected yet, and how many of them can be picked.
  const offPlan = planOnly ? (candidates ?? []).filter(c => !c.needsThis && !selectedIds.includes(c.employeeId)) : [];
  const hiddenCount = offPlan.length;
  const hiddenEligible = offPlan.filter(c => c.eligible).length;
  // At least one training per year per employee: those with none yet in the seminar's fiscal year
  // come first. Each group keeps the server's order (Plan A listers, then new hires, first).
  const fyText = program.fiscalYear ? `FY ${program.fiscalYear}` : "this fiscal year";
  const groups: { label: string; items: TrainingCandidate[] }[] = [
    { label: `No training yet in ${fyText}`, items: available.filter(c => (c.trainingsThisYear ?? []).length === 0) },
    { label: `Already has a training in ${fyText}`, items: available.filter(c => (c.trainingsThisYear ?? []).length > 0) },
    { label: "Not eligible", items: (candidates ?? []).filter(c => !c.eligible && !selectedIds.includes(c.employeeId) && inScope(c)) }
  ];
  const choices = groups.filter(g => g.items.length > 0);

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
  const needsJustification = (id: string) => outsideTdp(id) && !justifications[id] && !saved(id)?.tdpException
    && (!saved(id) || required.has(id) || saved(id)?.tdp === "identified");
  const pending = selectedIds.filter(needsJustification);
  // "Add all recommended" adds only people the TDP identifies, up to the free seats; anyone else is
  // added one at a time.
  const bulk = available.filter(c => c.needsThis).slice(0, freeSlots);

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
    // it stays; theirs waits behind "Record why").
    if (ids.length === 1 && formFor === null && selectedIds.length < max && !selectedIds.includes(ids[0]) && outsideTdp(ids[0]) && !justifications[ids[0]]) {
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

        <div className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 p-3 rounded-lg flex gap-2">
            <Sparkles size={16} className="shrink-0 mt-0.5" />
            <p>
              Every employee should have <strong>at least one training a year</strong>, so those with <strong>no training yet in {fyText}</strong> come first
              (a seminar or a training HR recorded counts; &ldquo;Did not attend&rdquo; doesn&rsquo;t). Within each group, employees whose{" "}
              <strong>Plan A</strong> lists this training come first, then <strong>new hires</strong>.{" "}
              {coversNeeds && (
                <>This seminar covers Plan A needs, so at first only those employees are shown, and their badge says in which column:
                for their <strong>function</strong>, an <strong>additional designation</strong>, or <strong>career advancement</strong>.{" "}</>
              )}
              Employees may join more than one seminar a year; only those who already attended this seminar can&rsquo;t be selected.
            </p>
          </div>

          {/* Plan A first: who is listed, and the way to everyone else. */}
          {coversNeeds && !loading && !error && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              {/* Read out when it changes, so a screen reader hears what the switch did. The switch itself
                  has no pressed state: its label already says what a click does. */}
              <p aria-live="polite">
                {planOnly
                  ? listers === 0
                    ? `Nobody's Plan A for ${fyText} lists this training.`
                    : `Showing the ${listers} employee${listers === 1 ? "" : "s"} whose Plan A for ${fyText} lists this training.`
                  : "Showing all employees."}
              </p>
              {(!planOnly || hiddenCount > 0) && (
                <button
                  type="button"
                  onClick={() => setShowAll(v => !v)}
                  className="text-xs font-semibold text-blue-700 bg-white border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50"
                >
                  {planOnly ? `Show all employees (${hiddenCount} more)` : "Show only those whose Plan A lists it"}
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Loader2 size={16} className="animate-spin" /> Loading recommendations…
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-start justify-between gap-3">
              <span className="flex gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{error}</span>
              <button onClick={() => setReloadKey(k => k + 1)} className="font-semibold underline shrink-0">Retry</button>
            </div>
          ) : (
            <>
              {/* RECOMMENDED — the top-ranked eligible employees for the open seats */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Recommended for this seminar</h4>
                  {bulk.length > 1 && (
                    <button
                      onClick={() => add(bulk.map(c => c.employeeId))}
                      className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100"
                    >
                      Add all recommended ({bulk.length})
                    </button>
                  )}
                </div>
                {freeSlots === 0 ? (
                  <p className="text-xs text-slate-500 italic">All {max} seat{max === 1 ? " is" : "s are"} filled. Remove someone below to add another.</p>
                ) : recommended.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    {hiddenEligible > 0
                      ? <>Nobody else whose Plan A lists this training can be added. &ldquo;Show all employees&rdquo; lists the others.</>
                      : "No more eligible employees to recommend."}
                  </p>
                ) : (
                  <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {recommended.map(c => (
                      <li key={c.employeeId} className="flex items-center justify-between gap-3 p-2.5">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{c.fullName}</p>
                          <p className="text-xs text-slate-500 truncate">{c.position}{c.division ? ` · ${c.division}` : ""}</p>
                          <CandidateBadges c={c} />
                        </div>
                        <button
                          onClick={() => add([c.employeeId])}
                          className="shrink-0 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          <UserPlus size={13} /> Add
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* DROPDOWN — pick anyone eligible, grouped by priority */}
              <section className="space-y-1.5">
                <label htmlFor="participant-dropdown" className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  Select or recommend an employee
                </label>
                <select
                  id="participant-dropdown"
                  value=""
                  disabled={freeSlots === 0 || choices.length === 0}
                  onChange={(e) => { if (e.target.value) add([e.target.value]); }}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">{freeSlots === 0 ? "Maximum participants reached" : choices.length === 0 ? "Nobody left on this list" : "Choose an employee…"}</option>
                  {choices.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map(c => (
                        <option key={c.employeeId} value={c.employeeId} disabled={!c.eligible}>
                          {c.eligible ? optionLabel(c) : `${c.fullName} — ${c.ineligibleReason}`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </section>
            </>
          )}

          {/* A division left with nobody at the office: a warning, since HR may go ahead knowingly. */}
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

          {/* SELECTED */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Users size={13} /> Selected participants
              <span className={`ml-1 ${BADGE} ${selectedIds.length >= max ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                {selectedIds.length} / {max}
              </span>
            </h4>
            {selectedIds.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No participants selected yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {selectedIds.map(id => {
                  const c = byId.get(id);
                  const name = c ? c.fullName : id;
                  const draft = justifications[id];
                  const onRecord = saved(id);
                  const waiting = needsJustification(id);
                  // The justification kept here, else the one on record, else the enrolment's standing; none
                  // for someone the TDP identifies (an edit of the needs can make it so).
                  const badge = !outsideTdp(id) ? null
                    : draft ? tdpBadgeText("justified", draft)
                    : onRecord?.tdpException ? tdpBadgeText("justified", onRecord.tdpException)
                    : onRecord && onRecord.tdp !== "identified" ? tdpBadgeText(onRecord.tdp) : null;
                  const unjustified = !draft && !onRecord?.tdpException;
                  return (
                    <li key={id} className="p-2 rounded-lg border border-blue-200 bg-blue-50/60">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                          <span className="flex flex-wrap gap-1">
                            {c && <CandidateBadges c={c} selected />}
                            {waiting && <span className={`${BADGE} bg-amber-50 text-amber-800 border-amber-300`}>Not in their TDP: needs a justification</span>}
                            {!waiting && badge && (
                              <span className={`${BADGE} ${unjustified ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-slate-50 text-slate-700 border-slate-300"}`}>{badge}</span>
                            )}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {outsideTdp(id) && formFor !== id && (
                            <button type="button" onClick={() => setFormFor(id)} className="text-xs font-semibold text-blue-700 hover:underline">
                              {waiting ? "Record why" : unjustified ? "Add why" : "Change why"}<span className="sr-only">: {name}</span>
                            </button>
                          )}
                          <button onClick={() => remove(id)} aria-label={`Remove ${name}`} className="text-slate-400 hover:text-rose-600">
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      {formFor === id && (
                        <TdpJustificationForm employeeName={name} initial={draft ?? onRecord?.tdpException} onSave={v => keep(id, v)} onCancel={() => setFormFor(null)} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-end gap-3 shrink-0">
          {pending.length > 0 && (
            <p role="status" className="mr-auto text-xs text-amber-800">
              {pending.length === 1 ? "1 person needs" : `${pending.length} people need`} a justification: record why, or remove them.
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
    </div>
  );
}
