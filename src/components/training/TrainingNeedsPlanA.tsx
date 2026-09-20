import { Fragment, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, X } from "lucide-react";
import {
  TrainingNeedCategory,
  TrainingPlanOffice,
  TRAINING_NEED_CATEGORIES,
  TRAINING_NEED_COLUMN_LABELS
} from "../../types";
import { apiCall } from "../../utils";
import PlanHeader from "./PlanHeader";

// Plan A of the official form: per employee, the trainings they still need,
// in three columns, grouped under their office.
export default function TrainingNeedsPlanA({ onChanged }: { onChanged?: () => void }) {
  const [offices, setOffices] = useState<TrainingPlanOffice[]>([]);
  const [fiscalYear, setFiscalYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Which cell has its "add" box open, keyed employeeId|category
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await apiCall("/api/training/needs");
      if (res.status === "success") {
        setOffices(res.data?.offices ?? []);
        setFiscalYear(res.data?.fiscalYear ?? "");
      } else {
        setError(res.message || "Unable to load the plan.");
      }
    } catch (err: any) {
      setError(err.message || "Unable to load the plan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addNeed(employeeId: string, category: TrainingNeedCategory) {
    const title = draft.trim();
    if (!title) return;
    setBusy(true);
    try {
      const res = await apiCall("/api/training/needs", {
        method: "POST",
        body: JSON.stringify({ employeeId, category, title, fiscalYear })
      });
      if (res.status === "success") {
        setDraft("");
        await load();
        onChanged?.();
      } else {
        alert(res.message || "Could not add that training.");
      }
    } catch (err: any) {
      alert(err.message || "Could not add that training.");
    } finally {
      setBusy(false);
    }
  }

  async function removeNeed(id: string, title: string) {
    if (!confirm(`Remove "${title}" from the plan?`)) return;
    setBusy(true);
    try {
      const res = await apiCall(`/api/training/needs/${id}`, { method: "DELETE" });
      if (res.status === "success") {
        await load();
        onChanged?.();
      } else {
        alert(res.message || "Could not remove that training.");
      }
    } catch (err: any) {
      alert(err.message || "Could not remove that training.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-16">
        <Loader2 size={16} className="animate-spin" /> Loading the Training and Development Plan…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-start justify-between gap-3">
        <span className="flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{error}</span>
        <button onClick={load} className="font-semibold underline shrink-0">Retry</button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <PlanHeader planTitle="Training and Development Plan - A (Training)" subtitle={`For CY ${fiscalYear}`} />

      <p className="text-xs text-slate-500 mb-3">
        List what each employee still needs. Seminars they actually attend are checked off automatically in <strong>Plan D</strong>.
      </p>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white uppercase text-[9px] tracking-wide">
              <th className="p-2 w-44 border-r border-slate-700">Name</th>
              <th className="p-2 w-40 border-r border-slate-700">Position</th>
              {TRAINING_NEED_CATEGORIES.map(c => (
                <th key={c} className="p-2 border-r border-slate-700 last:border-r-0">{TRAINING_NEED_COLUMN_LABELS[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {offices.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">No employees on record.</td></tr>
            )}
            {offices.map(office => (
              <Fragment key={office.office}>
                <tr className="bg-slate-100">
                  <td colSpan={5} className="p-2 font-bold uppercase text-[10px] tracking-wider text-slate-700">{office.office}</td>
                </tr>
                {office.employees.map(emp => (
                  <tr key={emp.employeeId} className="align-top hover:bg-slate-50/60">
                    <td className="p-2 font-semibold text-slate-800 border-r border-slate-100">{emp.fullName}</td>
                    <td className="p-2 text-slate-500 border-r border-slate-100">{emp.position || "—"}</td>
                    {TRAINING_NEED_CATEGORIES.map(category => {
                      const cellKey = `${emp.employeeId}|${category}`;
                      const rows = emp.needs[category] ?? [];
                      return (
                        <td key={category} className="p-2 border-r border-slate-100 last:border-r-0 min-w-[200px]">
                          <ul className="space-y-1">
                            {rows.map(need => (
                              <li key={need.id} className="group flex items-start justify-between gap-2">
                                <span className="text-slate-700 leading-snug">{need.title}</span>
                                <button
                                  onClick={() => removeNeed(need.id, need.title)}
                                  disabled={busy}
                                  aria-label={`Remove ${need.title}`}
                                  className="shrink-0 text-slate-300 hover:text-rose-600 group-hover:text-slate-400"
                                >
                                  <X size={12} />
                                </button>
                              </li>
                            ))}
                          </ul>

                          {openCell === cellKey ? (
                            <div className="mt-1.5 flex items-center gap-1">
                              <input
                                autoFocus
                                value={draft}
                                disabled={busy}
                                onChange={e => setDraft(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") { e.preventDefault(); addNeed(emp.employeeId, category); }
                                  if (e.key === "Escape") { setOpenCell(null); setDraft(""); }
                                }}
                                onBlur={() => { if (!draft.trim()) { setOpenCell(null); } }}
                                placeholder="Needed training…"
                                className="flex-1 min-w-0 border border-slate-300 rounded p-1 text-[11px] focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                              <button
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => addNeed(emp.employeeId, category)}
                                disabled={busy || !draft.trim()}
                                className="text-[10px] font-bold uppercase text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 disabled:bg-slate-300"
                              >
                                Add
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setOpenCell(cellKey); setDraft(""); }}
                              className="mt-1.5 text-[10px] font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1"
                            >
                              <Plus size={11} /> Add
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
