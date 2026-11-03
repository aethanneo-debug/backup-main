import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, GraduationCap, History, Loader2, X } from "lucide-react";
import type { EmployeeTrainingHistory as HistoryData, TrainingHistoryRecord } from "../../types";
import { apiCall } from "../../utils";
import FileViewer, { type CertificateFile } from "../ui/FileViewer";
import { useDialogLayer } from "../ui/ModalDialog";
import { RecordHistoryCard, SeminarHistoryCard } from "./TrainingHistoryCards";

// One employee's training history (the instructor's review, R11): every seminar seat and every training HR recorded,
// newest first, with the certificate, the cash advance and the liquidation report. One view, used in three places:
// Trainings and Seminar (the panel), and the participant picker's "History" link and the PDS (the window below).
// GET /api/employees/:employeeId/training-history decides what each viewer gets: HR and the Administrator anyone's in
// full, anyone else their own only.

type Employee = HistoryData["employee"];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface Props {
  /** The employee's internal id or staff code (the route takes either). */
  employeeKey: string;
  /** Changed by the page to reload the list (after HR adds a training record). */
  reloadKey?: number;
  /** Drawn at the end of each HR record's card (Trainings and Seminar's remarks and Review button). */
  recordExtra?: (row: TrainingHistoryRecord) => ReactNode;
  /** The employee as the server names them, once loaded (the window's subtitle). */
  onEmployee?: (employee: Employee) => void;
}

export default function EmployeeTrainingHistory({ employeeKey, reloadKey = 0, recordExtra, onEmployee }: Props) {
  const fyId = useId();
  // The year chosen, for this employee: another employee starts from all years.
  const [choice, setChoice] = useState({ key: employeeKey, fy: "" });
  const fy = choice.key === employeeKey ? choice.fy : "";
  // The last answer, and whom and which year it was for: switching years keeps it on screen, dimmed, until the next
  // one lands, so the list doesn't jump.
  const [loaded, setLoaded] = useState<{ key: string; fy: string; data: HistoryData } | null>(null);
  const [loading, setLoading] = useState(true);
  // null while there is no error; "" when the server gave no reason.
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [viewing, setViewing] = useState<CertificateFile | null>(null);
  // Read through a ref, so a parent's new callback doesn't reload the list.
  const employeeListener = useRef(onEmployee);
  employeeListener.current = onEmployee;

  useEffect(() => {
    if (!employeeKey) return;
    let alive = true;
    setLoading(true);
    setError(null);
    const query = fy ? `?fiscalYear=${encodeURIComponent(fy)}` : "";
    apiCall(`/api/employees/${encodeURIComponent(employeeKey)}/training-history${query}`)
      .then(res => {
        if (!alive) return;
        if (res?.status === "success" && res.data) {
          setLoaded({ key: employeeKey, fy, data: res.data });
          if (res.data.employee) employeeListener.current?.(res.data.employee);
        } else setError(res?.message || "");
      })
      .catch(err => { if (alive) setError(err?.message || ""); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [employeeKey, fy, reloadKey, retry]);

  const data = loaded?.key === employeeKey ? loaded.data : null;
  const stale = !!data && (loading || loaded?.fy !== fy);
  const rows = data?.rows ?? [];
  const years = [...new Set([...(data?.fiscalYears ?? []), ...(fy ? [fy] : [])])];
  const seminars = rows.filter(r => r.kind === "seminar").length;
  const records = rows.length - seminars;
  const where = fy ? `in FY ${fy}` : "across all years";

  const statusText = error !== null ? ""
    : !data ? "Loading the training history…"
    : stale ? `Loading ${fy ? `FY ${fy}` : "all years"}…`
    : rows.length === 0 ? `Nothing on record ${where}.`
    : `${[seminars ? plural(seminars, "seminar") : "", records ? plural(records, "training HR recorded") : ""].filter(Boolean).join(" and ")} ${where}, newest first.`;

  return (
    <section data-history="panel" aria-busy={loading} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor={fyId} className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Fiscal year</label>
          <select
            id={fyId}
            data-history="fy"
            value={fy}
            disabled={!data}
            onChange={e => setChoice({ key: employeeKey, fy: e.target.value })}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">All years</option>
            {years.map(y => <option key={y} value={y}>FY {y}</option>)}
          </select>
        </div>
        {/* Read out as it changes: a new year, or a reload. */}
        <p data-history="status" role="status" className="flex items-center gap-1.5 text-[11px] text-slate-600">
          {loading && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
          {statusText}
        </p>
      </div>

      {error !== null ? (
        <div role="alert" data-history="error" className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <span className="flex gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>The training history couldn&rsquo;t be loaded.{error ? ` ${error}` : ""}</span>
          </span>
          <button
            type="button"
            onClick={() => setRetry(n => n + 1)}
            className="shrink-0 cursor-pointer rounded font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Retry
          </button>
        </div>
      ) : !data ? (
        <div data-history="loading" aria-hidden="true" className="space-y-3">
          {[0, 1].map(i => (
            <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="h-3 w-24 rounded bg-slate-200 motion-safe:animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-slate-200 motion-safe:animate-pulse" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[0, 1, 2, 3].map(j => <div key={j} className="h-7 rounded bg-slate-100 motion-safe:animate-pulse" />)}
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div data-history="empty" className={`flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center ${stale ? "opacity-60" : ""}`}>
          <GraduationCap size={24} className="text-slate-400" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700">No trainings on record {where}.</p>
          <p className="max-w-md text-xs text-slate-500">Each seminar HR seats the employee in, and each training HR records, is listed here.</p>
          {fy && (
            <button
              type="button"
              onClick={() => setChoice({ key: employeeKey, fy: "" })}
              className="mt-1 cursor-pointer rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Show all years
            </button>
          )}
        </div>
      ) : (
        <ol data-history="list" className={`space-y-3 transition-opacity duration-150 motion-reduce:transition-none ${stale ? "opacity-60" : ""}`}>
          {rows.map(row => row.kind === "seminar"
            ? <SeminarHistoryCard key={`s-${row.participantId}`} row={row} onViewCertificate={r => setViewing({ participantId: r.participantId, name: r.certificate?.name || "Certificate of attendance" })} />
            : <RecordHistoryCard key={`r-${row.id}`} row={row} extra={recordExtra?.(row)} />)}
        </ol>
      )}

      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}

/**
 * The history in a window, over the participant picker or the PDS. A dialog in the app's stack (useDialogLayer): Esc
 * closes only the one on top (a certificate opened from it closes first), Tab stays inside, and the focus goes back to
 * the button that opened it.
 */
export function TrainingHistoryWindow({ employeeKey, name, onClose }: {
  employeeKey: string;
  /** Shown until the server names them. */
  name?: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const [who, setWho] = useState(name || "");
  useDialogLayer(panelRef, onClose);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-2 backdrop-blur-[2px] sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={who ? subtitleId : undefined}
        tabIndex={-1}
        data-history="window"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600">
              <History size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-bold text-slate-800">Training history</h2>
              {who && <p id={subtitleId} className="mt-0.5 break-words text-xs text-slate-500">{who}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the training history"
            className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4 sm:px-5">
          <EmployeeTrainingHistory
            employeeKey={employeeKey}
            onEmployee={e => setWho([e.fullName, e.position, e.division].filter(Boolean).join(" · "))}
          />
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
