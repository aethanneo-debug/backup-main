import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, GraduationCap } from "lucide-react";
import type { Employee } from "../../types";
import { apiCall } from "../../utils";
import CompletedReport from "./CompletedReport";
import CoverageReport from "./CoverageReport";
import EmployeeHistoryReport from "./EmployeeHistoryReport";
import ProgramReport from "./ProgramReport";
import type { FiscalYearOption, ReportKey } from "./reportView";

// The "Training" section of Generated Reports (the instructor's review, R11), for HR and the Administrator: ReportsView
// draws it for them alone, and the routes refuse everyone else. Four reports as tabs, one table at a time. All four stay
// mounted, so a choice survives a change of tab; nothing but the fiscal years loads until a report is opened and chosen.

const TABS: { key: ReportKey; label: string }[] = [
  { key: "history", label: "Employee Training History" },
  { key: "program", label: "Training Program Report" },
  { key: "completed", label: "Completed Training Programs" },
  { key: "coverage", label: "Employees with No Training Yet" }
];

export default function TrainingReports({ employees }: { employees: Employee[] }) {
  const [active, setActive] = useState<ReportKey>("history");
  const tabs = useRef(new Map<ReportKey, HTMLButtonElement>());
  const [years, setYears] = useState<FiscalYearOption[]>([]);
  // Null while there is no error; "" when the server gave no reason.
  const [yearsError, setYearsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setYearsError(null);
    apiCall("/api/fiscal-years")
      .then(res => {
        if (!current) return;
        const list: { label?: unknown; status?: unknown }[] = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setYears(list
          .filter(y => y && y.label !== undefined && y.label !== null && y.label !== "")
          .map(y => ({ label: String(y.label), active: y.status === "Active" }))
          .sort((a, b) => b.label.localeCompare(a.label, undefined, { numeric: true })));
      })
      .catch(err => { if (current) setYearsError(err?.message || ""); });
    return () => { current = false; };
  }, [attempt]);

  // The arrow keys move along the tabs and open them; Tab goes on into the report.
  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    const at = TABS.findIndex(t => t.key === active);
    const next = e.key === "ArrowRight" ? (at + 1) % TABS.length
      : e.key === "ArrowLeft" ? (at + TABS.length - 1) % TABS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? TABS.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(TABS[next].key);
    tabs.current.get(TABS[next].key)?.focus();
  }

  return (
    <section data-training-reports="" aria-labelledby="training-reports-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-5 md:col-span-2">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700">
          <GraduationCap size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="training-reports-title" className="text-xs font-bold text-slate-800">Training</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            Who was sent, what it cost, and who still needs a training. Each report loads once you choose what it is about; then print it, or download it as a CSV.
          </p>
        </div>
      </div>

      {yearsError !== null && (
        <div role="alert" data-report-years-error="" className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <span className="flex min-w-0 gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">The fiscal years couldn&rsquo;t be loaded.{yearsError ? ` ${yearsError}` : ""}</span>
          </span>
          <button
            type="button"
            onClick={() => setAttempt(n => n + 1)}
            className="shrink-0 cursor-pointer rounded font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Retry
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Training reports" onKeyDown={onTabKey} className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(tab => {
          const on = tab.key === active;
          return (
            <button
              key={tab.key}
              ref={el => { if (el) tabs.current.set(tab.key, el); else tabs.current.delete(tab.key); }}
              type="button"
              role="tab"
              id={`training-report-tab-${tab.key}`}
              data-report-tab={tab.key}
              aria-selected={on}
              aria-controls={`training-report-panel-${tab.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(tab.key)}
              className={`-mb-px min-w-0 cursor-pointer rounded-t-lg border border-b-2 px-3 py-2 text-left text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                on ? "border-slate-200 border-b-blue-600 bg-white text-blue-700" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {TABS.map(tab => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`training-report-panel-${tab.key}`}
          aria-labelledby={`training-report-tab-${tab.key}`}
          hidden={tab.key !== active}
          className="pt-4"
        >
          {tab.key === "history" && <EmployeeHistoryReport employees={employees} fiscalYears={years} />}
          {tab.key === "program" && <ProgramReport active={active === "program"} fiscalYears={years} />}
          {tab.key === "completed" && <CompletedReport fiscalYears={years} />}
          {tab.key === "coverage" && <CoverageReport fiscalYears={years} />}
        </div>
      ))}
    </section>
  );
}
