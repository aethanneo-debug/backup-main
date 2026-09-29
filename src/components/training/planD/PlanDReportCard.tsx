import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardCheck, Download, Loader2, Printer } from "lucide-react";
import { apiCall, getLocalTodayString } from "../../../utils";
import { PlanDSnapshot, downloadPlanDCsv, planDTotals } from "./planDRows";
import PlanDPrintModal from "./PlanDPrintModal";

/**
 * Plan D on the Generated Reports page: the same sheet the Plan D tab shows, judged as of a
 * date, printed in the official RAB-1 layout or downloaded as CSV. Read-only — HR's
 * accomplished / not-accomplished overrides stay on the Plan D tab.
 *
 * Rendered for HR and the Admin only; the route it reads refuses every other role.
 */
export default function PlanDReportCard() {
  const [asOf, setAsOf] = useState(getLocalTodayString());
  const [plan, setPlan] = useState<PlanDSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    // Changing the date again can overtake this request; only the newest answer is kept,
    // and nothing from the previous date stays printable while the new one loads.
    let current = true;
    setLoading(true);
    setError("");
    setPlan(null);
    setPreviewing(false);
    apiCall(`/api/training/needs?asOf=${encodeURIComponent(asOf)}`)
      .then(res => {
        if (!current) return;
        if (res.status !== "success") throw new Error(res.message || "Plan D could not be loaded.");
        setPlan({
          fiscalYear: res.data?.fiscalYear ?? "",
          asOf: res.data?.asOf ?? asOf,
          offices: res.data?.offices ?? []
        });
      })
      .catch((err: any) => {
        if (current) setError(err.message || "Plan D could not be loaded.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [asOf, attempt]);

  const totals = planDTotals(plan?.offices ?? []);
  const canExport = !loading && !!plan && totals.needs > 0;

  return (
    <>
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
        <div className="space-y-3">
          <div className="h-9 w-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700 border border-slate-200">
            <ClipboardCheck size={16} />
          </div>

          <div>
            <h3 className="text-xs font-bold font-sans text-slate-800">Training and Development Plan - D (Monitoring Sheet)</h3>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Plan A checked off as of the date you choose, in the official RAB-1 layout. A needed training is written
              again under NOT ACCOMPLISHED until a seminar, recorded training or PDS entry covers it.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className="text-[11px] text-slate-600 flex items-center gap-1.5">
              As of
              <input
                type="date"
                value={asOf}
                onChange={e => setAsOf(e.target.value || getLocalTodayString())}
                className="border border-slate-300 rounded-lg p-1 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </label>
            {plan && (
              <span className="text-[10px] font-mono text-slate-400">
                CY {plan.fiscalYear} plan &middot; {totals.employees} employee{totals.employees === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {loading ? (
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-mono font-bold text-slate-400">
              <Loader2 size={11} className="animate-spin" aria-hidden="true" /> Checking Plan D…
            </span>
          ) : error ? (
            <span className="flex items-center gap-1.5 text-[10px] text-rose-700">
              <AlertTriangle size={11} className="shrink-0" aria-hidden="true" />
              {error}
              <button type="button" onClick={() => setAttempt(n => n + 1)} className="font-semibold underline">
                Retry
              </button>
            </span>
          ) : totals.needs === 0 ? (
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">No needs listed in Plan A yet</span>
          ) : (
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">
              {totals.accomplished} of {totals.needs} Accomplished
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewing(true)}
              disabled={!canExport}
              className="bg-white enabled:hover:bg-slate-50 text-slate-700 border border-slate-300 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={11} />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => plan && downloadPlanDCsv(plan)}
              disabled={!canExport}
              className="bg-slate-900 enabled:hover:bg-slate-800 text-white border border-slate-900 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={11} />
              <span>Download CSV</span>
            </button>
          </div>
        </div>
      </div>

      <PlanDPrintModal plan={previewing ? plan : null} onClose={() => setPreviewing(false)} />
    </>
  );
}
