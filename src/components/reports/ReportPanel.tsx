import { useRef, useState, type ReactNode, type Ref } from "react";
import { AlertTriangle, Download, Loader2, MousePointerClick, Printer } from "lucide-react";
import { downloadCsvTable } from "../../utils";
import ReportPreview from "./ReportPreview";
import ReportSheet from "./ReportSheet";
import type { ReportKey, ReportLoad, ReportView } from "./reportView";

// One training report's frame (the instructor's review, R11): its pickers, what is being read out, Print and CSV, then
// its contents in whichever state they are: nothing chosen yet, loading, couldn't load, nothing to report, or the report.

// At phone width the app's sidebar keeps its 272 px, which leaves this column about 55 px: no icon, and less padding.
const EXPORT_BUTTON = "inline-flex items-center gap-1 rounded-lg py-1.5 px-2 text-[10px] font-bold uppercase shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3";
const EXPORT_ICON = "hidden shrink-0 sm:block";

export function ReportSelect({ label, hook, value, onChange, disabled, children, selectRef }: {
  label: string;
  hook: "employee" | "program" | "fy";
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
  selectRef?: Ref<HTMLSelectElement>;
}) {
  return (
    <label className={`block min-w-0 ${hook === "fy" ? "sm:w-44" : "flex-1 sm:min-w-[16rem] sm:max-w-md"}`}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
      <select
        ref={selectRef}
        data-report-employee={hook === "employee" ? "" : undefined}
        data-report-program={hook === "program" ? "" : undefined}
        data-report-fy={hook === "fy" ? "" : undefined}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full min-w-0 cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {children}
      </select>
    </label>
  );
}

interface Props {
  id: ReportKey;
  title: string;
  description: string;
  pickers: ReactNode;
  /** What to choose before anything loads, while nothing is chosen. */
  prompt: string | null;
  load: Pick<ReportLoad<unknown>, "loading" | "error" | "retry">;
  /** What to call the report in the words "The … couldn't be loaded." */
  errorName: string;
  view: ReportView | null;
}

export default function ReportPanel({ id, title, description, pickers, prompt, load, errorName, view }: Props) {
  const root = useRef<HTMLElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const canExport = !prompt && !load.loading && load.error === null && !!view?.canExport;
  // (On a failure the alert speaks for itself.)
  const status = prompt ?? (load.error !== null ? "" : load.loading ? `Loading the ${errorName}…` : view?.status ?? "");
  // The box below says the same on screen while there is nothing to report, so this is for a screen reader then.
  const quiet = !!prompt || (!load.loading && load.error === null && view?.rows.length === 0);

  // Retry goes away as it is pressed: the focus goes to the first picker, not to the page.
  function retry() {
    root.current?.querySelector<HTMLElement>("select:not([disabled])")?.focus();
    load.retry();
  }

  return (
    <section ref={root} data-report={id} aria-busy={load.loading} className="min-w-0 space-y-3">
      <div>
        <h3 className="text-xs font-bold text-slate-800">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{description}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">{pickers}</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-report-print=""
            disabled={!canExport}
            onClick={() => setPreviewing(true)}
            className={`${EXPORT_BUTTON} cursor-pointer border border-slate-300 bg-white text-slate-700 enabled:hover:bg-slate-50`}
          >
            <Printer size={11} className={EXPORT_ICON} aria-hidden="true" />
            Print<span className="sr-only"> the {title}</span>
          </button>
          <button
            type="button"
            data-report-csv=""
            disabled={!canExport}
            onClick={() => { if (view) downloadCsvTable(view.csv(), view.fileName); }}
            className={`${EXPORT_BUTTON} cursor-pointer border border-slate-900 bg-slate-900 text-white enabled:hover:bg-slate-800`}
          >
            <Download size={11} className={EXPORT_ICON} aria-hidden="true" />
            <span><span className="hidden sm:inline">Download </span>CSV<span className="sr-only"> of the {title}</span></span>
          </button>
        </div>
      </div>

      {/* Read out as it changes: what was chosen, loading, or how it went. */}
      <p data-report-status="" role="status" className={quiet ? "sr-only" : "flex min-w-0 items-start gap-1.5 break-words text-[11px] text-slate-600"}>
        {load.loading && <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin" aria-hidden="true" />}
        <span className="min-w-0">{status}</span>
      </p>

      {prompt ? (
        <div data-report-state="prompt" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          <MousePointerClick size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0">{prompt}</span>
        </div>
      ) : load.error !== null ? (
        <div role="alert" data-report-state="error" className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <span className="flex min-w-0 gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">The {errorName} couldn&rsquo;t be loaded.{load.error ? ` ${load.error}` : ""}</span>
          </span>
          <button
            type="button"
            data-report-retry=""
            onClick={retry}
            className="shrink-0 cursor-pointer rounded font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Retry
          </button>
        </div>
      ) : load.loading || !view ? (
        <div data-report-state="loading" aria-hidden="true" className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="grid grid-cols-4 gap-3">
              {[0, 1, 2, 3].map(j => <div key={j} className="h-4 rounded bg-slate-100 motion-safe:animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : (
        <ReportSheet view={view} variant="screen" />
      )}

      {previewing && view && <ReportPreview view={view} onClose={() => setPreviewing(false)} />}
    </section>
  );
}
