import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Sparkles, UserPlus, Users, X } from "lucide-react";
import { TrainingCandidate } from "../../types";
import { apiCall } from "../../utils";

// The seminar being staffed: a saved program or an unsaved draft row from the TDP table.
export interface PickerProgram {
  id: string;
  isNew: boolean;
  title: string;
  fiscalYear?: string;
  targetDivision?: string;
  targetSpecialization?: string;
  maxParticipants: number | string;
}

interface Props {
  program: PickerProgram;
  initialSelectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

const BADGE = "px-1.5 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap";

function CandidateBadges({ c }: { c: TrainingCandidate }) {
  return (
    <span className="flex flex-wrap gap-1">
      {!c.eligible && <span className={`${BADGE} bg-rose-50 text-rose-700 border-rose-200`}>{c.ineligibleReason}</span>}
      {c.priority === 1 && (
        <span className={`${BADGE} bg-emerald-50 text-emerald-700 border-emerald-200`}>
          New hire{c.monthsSinceHire !== null ? ` · ${c.monthsSinceHire < 1 ? "<1" : c.monthsSinceHire} mo` : ""}
        </span>
      )}
      {c.priority === 2 && <span className={`${BADGE} bg-blue-50 text-blue-700 border-blue-200`}>No TDP history yet</span>}
      {c.matchesTarget && <span className={`${BADGE} bg-slate-50 text-slate-700 border-slate-200`}>Target match</span>}
    </span>
  );
}

function optionLabel(c: TrainingCandidate) {
  const extras = [c.division || "No division"];
  if (c.priority === 1 && c.monthsSinceHire !== null) extras.push(`hired ${c.monthsSinceHire < 1 ? "this month" : `${c.monthsSinceHire} mo ago`}`);
  if (c.matchesTarget) extras.push("target match");
  return `${c.fullName} — ${extras.join(" · ")}`;
}

export default function ParticipantPickerModal({ program, initialSelectedIds, onConfirm, onClose }: Props) {
  const [candidates, setCandidates] = useState<TrainingCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds ?? []);
  const [reloadKey, setReloadKey] = useState(0);

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
      maxParticipants: String(max)
    });
    if (!program.isNew) params.set("programId", program.id);

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
  }, [program.id, program.isNew, program.title, program.fiscalYear, program.targetDivision, program.targetSpecialization, max, reloadKey]);

  const byId = useMemo(() => new Map((candidates ?? []).map(c => [c.employeeId, c])), [candidates]);
  const available = (candidates ?? []).filter(c => c.eligible && !selectedIds.includes(c.employeeId));
  const recommended = available.slice(0, freeSlots);
  const groups: { label: string; items: TrainingCandidate[] }[] = [
    { label: "Priority 1 — New hires", items: available.filter(c => c.priority === 1) },
    { label: "Priority 2 — Never attended a TDP seminar", items: available.filter(c => c.priority === 2) },
    { label: "Other eligible employees", items: available.filter(c => c.priority === 3) },
    { label: "Not eligible", items: (candidates ?? []).filter(c => !c.eligible && !selectedIds.includes(c.employeeId)) }
  ];

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
              Recommendations list <strong>new hires</strong> first, then employees who have <strong>never attended a TDP seminar</strong>.
              Employees who already attended this seminar, or already have a seminar this fiscal year, can't be selected.
            </p>
          </div>

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
                  <p className="text-xs text-slate-500 italic">No more eligible employees to recommend.</p>
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
                  disabled={freeSlots === 0}
                  onChange={(e) => { if (e.target.value) add([e.target.value]); }}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">{freeSlots === 0 ? "Maximum participants reached" : "Choose an employee…"}</option>
                  {groups.filter(g => g.items.length > 0).map(g => (
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
                        {c && <CandidateBadges c={c} />}
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
