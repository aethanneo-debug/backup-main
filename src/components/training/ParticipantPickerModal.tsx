import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Sparkles, UserPlus, Users, X } from "lucide-react";
import { TRAINING_NEED_COLUMN_LABELS, TrainingCandidate, type TrainingNeedCategory } from "../../types";
import { apiCall, getLocalTodayString } from "../../utils";
import { datesText, divisionGaps, seminarWeekdays } from "../../divisionCoverage";

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
}

interface Props {
  program: PickerProgram;
  initialSelectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

const BADGE = "px-1.5 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap";

// The Plan A column a need is listed under, as the badge names it (the form's own words, shortened).
// The same training can be needed for the function or for an additional designation (HSAC RAB 1's
// answer 6: RA 12009 for the Admin Officer IV, and for Budget staff on the BAC TWG).
const COLUMN_NAME: Record<TrainingNeedCategory, string> = {
  "Function": "Function",
  "Additional Function": "Additional Function/Designation",
  "Career Advancement": "Career Advancement"
};
const columnsText = (c: TrainingCandidate) => (c.needCategories ?? []).map(k => COLUMN_NAME[k]).join(", ");
// The official column names, for the badge's tooltip.
const columnLabels = (c: TrainingCandidate) => (c.needCategories ?? []).map(k => TRAINING_NEED_COLUMN_LABELS[k]).join("; ");

// `selected`: they are already on this seminar's list, and the server counts only their other
// trainings, so this seminar would be their first of the year, or one more.
function CandidateBadges({ c, selected = false }: { c: TrainingCandidate; selected?: boolean }) {
  // Their other trainings this fiscal year: at least one each year, so none yet is worth seeing.
  const thisYear = c.trainingsThisYear ?? [];
  return (
    <span className="flex flex-wrap gap-1">
      {!c.eligible && <span className={`${BADGE} bg-rose-50 text-rose-700 border-rose-200`}>{c.ineligibleReason}</span>}
      {c.eligible && thisYear.length === 0 && (
        <span className={`${BADGE} bg-blue-50 text-blue-700 border-blue-200`}>{selected ? "First training this FY" : "No training yet this FY"}</span>
      )}
      {thisYear.length > 0 && (
        <span className={`${BADGE} bg-slate-50 text-slate-700 border-slate-200`} title={`This fiscal year: ${thisYear.join("; ")}`}>
          {thisYear.length} {selected ? "other " : ""}training{thisYear.length === 1 ? "" : "s"} this FY
          {/* The titles, for keyboard and screen-reader users (the tooltip needs a mouse). */}
          <span className="sr-only">: {thisYear.join("; ")}</span>
        </span>
      )}
      {c.needsThis && (
        <span
          className={`${BADGE} bg-emerald-50 text-emerald-800 border-emerald-300`}
          title={`Plan A${columnLabels(c) ? `, ${columnLabels(c)}` : ""}: ${c.needMatches.join("; ")}`}
        >
          Needs this{columnsText(c) ? `: ${columnsText(c)}` : ""}
          {/* The titles, for keyboard and screen-reader users (the tooltip needs a mouse). */}
          <span className="sr-only"> ({c.needMatches.join("; ")})</span>
        </span>
      )}
      {c.priority === 1 && (
        <span className={`${BADGE} bg-emerald-50 text-emerald-700 border-emerald-200`}>
          New hire{c.monthsSinceHire !== null ? ` · ${c.monthsSinceHire < 1 ? "<1" : c.monthsSinceHire} mo` : ""}
        </span>
      )}
      {c.matchesTarget && <span className={`${BADGE} bg-slate-50 text-slate-700 border-slate-200`}>Target match</span>}
      {(c.awayOn ?? []).length > 0 && (
        <span className={`${BADGE} bg-amber-50 text-amber-700 border-amber-200`}>At another seminar on {datesText(c.awayOn!)}</span>
      )}
    </span>
  );
}

function optionLabel(c: TrainingCandidate) {
  const extras = [c.division || "No division"];
  if (c.needsThis) extras.push(columnsText(c) ? `listed in their plan (${columnsText(c)})` : "listed in their plan");
  if (c.priority === 1 && c.monthsSinceHire !== null) extras.push(`hired ${c.monthsSinceHire < 1 ? "this month" : `${c.monthsSinceHire} mo ago`}`);
  const trained = (c.trainingsThisYear ?? []).length;
  extras.push(trained === 0 ? "no training yet this FY" : `${trained} training${trained === 1 ? "" : "s"} this FY`);
  if (c.matchesTarget) extras.push("target match");
  if ((c.awayOn ?? []).length > 0) extras.push(`at another seminar on ${datesText(c.awayOn!)}`);
  return `${c.fullName} — ${extras.join(" · ")}`;
}

export default function ParticipantPickerModal({ program, initialSelectedIds, onConfirm, onClose }: Props) {
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

  const add = (ids: string[]) => {
    setSelectedIds(prev => {
      const next = [...prev];
      for (const id of ids) {
        if (next.length >= max) break;
        if (!next.includes(id)) next.push(id);
      }
      return next;
    });
  };
  const remove = (id: string) => setSelectedIds(prev => prev.filter(x => x !== id));

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
                  {recommended.length > 1 && (
                    <button
                      onClick={() => add(recommended.map(c => c.employeeId))}
                      className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100"
                    >
                      Add all recommended ({recommended.length})
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
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-blue-200 bg-blue-50/60">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{c ? c.fullName : id}</p>
                        {c && <CandidateBadges c={c} selected />}
                      </div>
                      <button onClick={() => remove(id)} aria-label={`Remove ${c ? c.fullName : id}`} className="shrink-0 text-slate-400 hover:text-rose-600">
                        <X size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={() => onConfirm(selectedIds)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Confirm Participants ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
}
