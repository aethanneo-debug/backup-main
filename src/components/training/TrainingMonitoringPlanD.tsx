import { Fragment, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  TrainingNeedRow,
  TrainingPlanOffice,
  TRAINING_NEED_CATEGORIES,
  TRAINING_NEED_COLUMN_LABELS
} from "../../types";
import { apiCall, formatDate, getLocalTodayString } from "../../utils";
import PlanHeader from "./PlanHeader";

const SOURCE_LABEL: Record<string, string> = {
  "seminar": "Seminar in the system",
  "recorded-training": "Recorded training",
  "pds": "PDS learning & development",
  "override": "Set by HR"
};

// One needed training with its accomplished/not-accomplished state, plus the
// override control. The official form's paired "NOT ACCOMPLISHED" column.
function NeedStatusRow({ need, onOverride, busy }: {
  need: TrainingNeedRow;
  onOverride: (id: string, value: boolean | null) => void;
  busy: boolean;
}) {
  const { accomplished, source, evidence, date } = need.status;
  const value = need.accomplishedOverride === undefined ? "auto" : need.accomplishedOverride ? "yes" : "no";

  return (
    <li className="border-b border-slate-100 last:border-0 pb-1.5 last:pb-0 space-y-1">
      <p className="text-slate-700 leading-snug">{need.title}</p>
      <div className="flex items-center justify-between gap-2">
        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${
          accomplished ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
        }`}>
          {accomplished ? "Accomplished" : "Not accomplished"}
        </span>
        <select
          value={value}
          disabled={busy}
          aria-label={`Status for ${need.title}`}
          onChange={e => onOverride(need.id, e.target.value === "auto" ? null : e.target.value === "yes")}
          className="text-[10px] border border-slate-200 rounded px-1 py-0.5 bg-white text-slate-600 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="auto">Auto</option>
          <option value="yes">Mark accomplished</option>
          <option value="no">Mark not accomplished</option>
        </select>
      </div>
      {accomplished && source && (
        <p className="text-[9px] text-slate-400 leading-snug">
          {SOURCE_LABEL[source] || source}
          {evidence ? `: ${evidence}` : ""}
          {date ? ` · ${formatDate(date)}` : ""}
        </p>
      )}
    </li>
  );
}

// Plan D: Plan A checked off as of a date.
export default function TrainingMonitoringPlanD() {
  const [offices, setOffices] = useState<TrainingPlanOffice[]>([]);
  const [fiscalYear, setFiscalYear] = useState("");
  const [asOf, setAsOf] = useState(getLocalTodayString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(asOfDate: string) {
    setLoading(true);
    setError("");
    try {
      const res = await apiCall(`/api/training/needs?asOf=${encodeURIComponent(asOfDate)}`);
      if (res.status === "success") {
        setOffices(res.data?.offices ?? []);
        setFiscalYear(res.data?.fiscalYear ?? "");
      } else {
        setError(res.message || "Unable to load the monitoring sheet.");
      }
    } catch (err: any) {
      setError(err.message || "Unable to load the monitoring sheet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(asOf); }, [asOf]);

  async function setOverride(id: string, accomplishedOverride: boolean | null) {
    setBusy(true);
    try {
      const res = await apiCall(`/api/training/needs/${id}`, {
        method: "PUT",
        body: JSON.stringify({ accomplishedOverride })
      });
      if (res.status === "success") await load(asOf);
      else alert(res.message || "Could not update that status.");
    } catch (err: any) {
      alert(err.message || "Could not update that status.");
    } finally {
      setBusy(false);
    }
  }

  const totals = offices.flatMap(o => o.employees).reduce(
    (acc, emp) => {
      for (const c of TRAINING_NEED_CATEGORIES) {
        for (const n of emp.needs[c] ?? []) {
          acc.total++;
          if (n.status.accomplished) acc.done++;
        }
      }
      return acc;
    },
    { total: 0, done: 0 }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-16">
        <Loader2 size={16} className="animate-spin" /> Loading the monitoring sheet…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-start justify-between gap-3">
        <span className="flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{error}</span>
        <button onClick={() => load(asOf)} className="font-semibold underline shrink-0">Retry</button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <PlanHeader planTitle="Training and Development Plan - D" subtitle={`as of ${formatDate(asOf)}`} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-xs text-slate-500">
          Checked off automatically from seminars attended, recorded trainings and PDS learning &amp; development.
          Use <strong>Auto</strong> unless HR needs to decide differently.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-slate-600">
            {totals.done} of {totals.total} accomplished
          </span>
          <label className="text-[11px] text-slate-600 flex items-center gap-1.5">
            As of
            <input
              type="date"
              value={asOf}
              onChange={e => setAsOf(e.target.value || getLocalTodayString())}
              className="border border-slate-300 rounded-lg p-1 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </label>
        </div>
      </div>

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
                  <tr key={emp.employeeId} className="align-top">
                    <td className="p-2 font-semibold text-slate-800 border-r border-slate-100">{emp.fullName}</td>
                    <td className="p-2 text-slate-500 border-r border-slate-100">{emp.position || "—"}</td>
                    {TRAINING_NEED_CATEGORIES.map(category => {
                      const rows = emp.needs[category] ?? [];
                      return (
                        <td key={category} className="p-2 border-r border-slate-100 last:border-r-0 min-w-[220px]">
                          {rows.length === 0 ? (
                            <span className="text-slate-300 italic">Nothing listed</span>
                          ) : (
                            <ul className="space-y-1.5">
                              {rows.map(need => (
                                <NeedStatusRow key={need.id} need={need} onOverride={setOverride} busy={busy} />
                              ))}
                            </ul>
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

      {fiscalYear && <p className="text-[10px] text-slate-400 mt-2">Plan for CY {fiscalYear}.</p>}
    </div>
  );
}
