import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Loader2, Search, X } from "lucide-react";
import { TrainingNeedCatalogItem } from "../../types";
import { apiCall } from "../../utils";

interface Props {
  seminarTitle: string;
  fiscalYear?: string;
  selectedTitles: string[];
  onConfirm: (titles: string[]) => void;
  onClose: () => void;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Which entries of Plan A this seminar answers. Picking from the plan's own list
// keeps the link exact — the participant picker and Plan D both rely on it.
export default function NeedCoverageModal({ seminarTitle, fiscalYear, selectedTitles, onConfirm, onClose }: Props) {
  const [needs, setNeeds] = useState<TrainingNeedCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>(selectedTitles ?? []);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiCall(`/api/training/needs/catalog${fiscalYear ? `?fiscalYear=${encodeURIComponent(fiscalYear)}` : ""}`)
      .then(res => {
        if (cancelled) return;
        if (res.status === "success") setNeeds(res.data?.needs ?? []);
        else setError(res.message || "Unable to load the plan.");
      })
      .catch(err => { if (!cancelled) setError(err.message || "Unable to load the plan."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fiscalYear, reloadKey]);

  const selectedKeys = useMemo(() => new Set(selected.map(norm)), [selected]);
  const visible = needs.filter(n => !query.trim() || norm(n.title).includes(norm(query)));

  const toggle = (title: string) => {
    setSelected(prev => prev.some(t => norm(t) === norm(title))
      ? prev.filter(t => norm(t) !== norm(title))
      : [...prev, title]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="need-coverage-title">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start bg-slate-50">
          <div>
            <h3 id="need-coverage-title" className="text-lg font-semibold text-slate-800">Plan needs covered</h3>
            <p className="text-xs text-slate-500 mt-0.5">{seminarTitle || "Untitled seminar"}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
          <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 p-3 rounded-lg flex gap-2">
            <ClipboardList size={16} className="shrink-0 mt-0.5" />
            <p>
              Tick what this seminar answers from <strong>Plan A</strong>. Employees who listed it are marked
              <strong> Needs this</strong> in the participant picker and ranked first, and their Plan D item is
              checked off once they attend.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Loader2 size={16} className="animate-spin" /> Loading the plan…
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-start justify-between gap-3">
              <span className="flex gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{error}</span>
              <button onClick={() => setReloadKey(k => k + 1)} className="font-semibold underline shrink-0">Retry</button>
            </div>
          ) : needs.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">
              Nothing listed in Plan A for this fiscal year yet. Add needed trainings in the <strong>Plan A — Training Needs</strong> tab first.
            </p>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search the plan…"
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-2 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {visible.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Nothing in the plan matches "{query}".</p>
              ) : (
                <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {visible.map(need => {
                    const checked = selectedKeys.has(norm(need.title));
                    return (
                      <li key={need.title}>
                        <label className={`flex items-start gap-3 p-2.5 cursor-pointer ${checked ? "bg-blue-50/60" : "hover:bg-slate-50"}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(need.title)}
                            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm text-slate-800 leading-snug">{need.title}</span>
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              Listed by {need.employeeCount} employee{need.employeeCount === 1 ? "" : "s"} · {need.categories.join(", ")}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center gap-3 shrink-0">
          <span className="text-[11px] text-slate-500">{selected.length} selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={() => onConfirm(selected)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
}
