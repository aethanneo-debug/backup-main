import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileSpreadsheet, X } from "lucide-react";
import {
  TdpUpload,
  TrainingNeedRow,
  TrainingPlanEmployee,
  TrainingPlanOffice,
  TRAINING_NEED_CATEGORIES,
  TRAINING_NEED_COLUMN_LABELS
} from "../../types";
import { useDialogLayer } from "../ui/ModalDialog";
import PlanHeader from "./PlanHeader";
import { count, tdpSourceText } from "./tdpText";

// Plan A as uploaded, read-only (the instructor's review, R9: the big table moves behind a button, and nobody types
// trainings into it). The official layout: each office, each person's three columns, the mandated badges. Needs carried
// in unmet from an earlier year are marked: they aren't part of the TDP, and stay when it is replaced. Without a TDP
// it shows just those carried needs.
//
// A dialog in the app's stack (useDialogLayer): Esc closes only the one on top, Tab stays inside, and the focus goes
// back to the button that opened it. One scroll area, so the column headings stay in view over ~460 needs.
interface Props {
  fiscalYear: string;
  offices: TrainingPlanOffice[];
  /** The TDP in force, or null when there is none and only carried needs are shown. */
  tdp: TdpUpload | null;
  onClose: () => void;
  /** Removes a need carried in from an earlier year (no TDP's, so the one thing that can be taken out here; the user's
   * decision of 2026-11-02). Resolves to the server's reason when it was refused, else to the seminars it was the last
   * need in the plan for (they now need their own justification, 12z Part C). */
  onRemoveCarried?: (need: TrainingNeedRow) => Promise<{ problem: string } | { outside: string[] }>;
}

const needsOf = (emp: TrainingPlanEmployee): TrainingNeedRow[] =>
  TRAINING_NEED_CATEGORIES.flatMap(c => emp.needs?.[c] ?? []);

const HEAD = "sticky top-0 z-10 border-b border-r border-slate-700 bg-slate-900 p-2 text-[9px] font-bold uppercase tracking-wide text-white last:border-r-0";
const CELL = "border-b border-r border-slate-100 p-2 align-top last:border-r-0";

export default function TdpPlanWindow({ fiscalYear, offices, tdp, onClose, onRemoveCarried }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  // A carried need being removed, and what came of the last removal.
  const [removing, setRemoving] = useState<string | null>(null);
  const [removal, setRemoval] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  // Esc waits while a removal is on its way, so its answer has somewhere to land.
  useDialogLayer(panelRef, onClose, removing !== null);

  async function removeCarried(need: TrainingNeedRow, name: string) {
    if (!onRemoveCarried || removing) return;
    if (!confirm(`Remove “${need.title}” for ${name}? It was carried in unmet from CY ${need.carriedFromFiscalYear} and isn't part of the TDP. The removal is recorded in the audit log.`)) return;
    setRemoving(need.id);
    setRemoval(null);
    const result = await onRemoveCarried(need);
    setRemoving(null);
    if ("problem" in result) {
      setRemoval({ tone: "error", text: result.problem });
      return;
    }
    const left = result.outside;
    setRemoval({
      tone: left.length ? "warn" : "ok",
      text: `“${need.title}” is removed for ${name}.` + (left.length
        ? ` ${left.map(t => `“${t}”`).join(", ")} now ${left.length === 1 ? "covers" : "cover"} no need in the plan, so ${left.length === 1 ? "it needs its" : "they need their"} own justification in Programs & Budget.`
        : "")
    });
    // Its button is gone with it: the focus goes back into the plan rather than to the page.
    regionRef.current?.focus();
  }

  // Into the plan on open, so the arrow keys scroll it; back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    regionRef.current?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  // The needs an amended TDP left out but kept because still in use (a seminar covers them, or they were accomplished):
  // in the plan, but not in the uploaded file, so they are marked and counted apart.
  const keptIds = useMemo(() => new Set(tdp?.keptNeedIds ?? []), [tdp]);

  // Only people the plan lists anything for: the TDP's rows, and anyone with needs carried in.
  const { listed, needs, carried, kept, unlisted, carriedYear } = useMemo(() => {
    let needs = 0, carried = 0, kept = 0, unlisted = 0;
    let carriedYear = "";
    const listed = (offices ?? [])
      .map(office => {
        const employees = (office.employees ?? []).filter(emp => {
          const rows = needsOf(emp);
          if (rows.length === 0) unlisted++;
          for (const need of rows) {
            if (need.carriedFromFiscalYear) {
              carried++;
              carriedYear ||= need.carriedFromFiscalYear;
            } else if (keptIds.has(need.id)) kept++;
            else needs++;
          }
          return rows.length > 0;
        });
        return { ...office, employees };
      })
      .filter(office => office.employees.length > 0);
    return { listed, needs, carried, kept, unlisted, carriedYear };
  }, [offices, keptIds]);
  const people = listed.reduce((n, o) => n + o.employees.length, 0);

  const removable = !!onRemoveCarried && carried > 0;
  const title = tdp ? `Uploaded TDP, FY ${fiscalYear}` : `Needs carried into FY ${fiscalYear}`;
  const subtitle = tdp
    ? `${tdpSourceText(tdp)} · read-only${removable ? ", but for needs carried in from an earlier year" : ""}`
    : `No TDP is uploaded for FY ${fiscalYear} yet. These were carried in unmet from an earlier year${removable ? " and can be removed" : " · read-only"}`;
  const summary = tdp
    ? `${count(needs, "TDP need")} for ${count(people, "employee")}${kept > 0 ? `, ${kept} kept from before because still in use` : ""}` +
      `${carried > 0 ? `, and ${carried} carried from an earlier year` : ""}.`
    : `${count(carried, "need")} carried in for ${count(people, "employee")}.`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-2 backdrop-blur-[2px] sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        tabIndex={-1}
        data-tdp="window"
        className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600">
              <FileSpreadsheet size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="break-words text-sm font-bold text-slate-800">{title}</h2>
              <p id={subtitleId} className="mt-0.5 break-words text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the uploaded TDP"
            className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* The one scroll area, both ways: the headings stick at its top; on a narrow screen the table scrolls sideways. */}
        <div
          ref={regionRef}
          role="region"
          aria-label={`Plan A for FY ${fiscalYear}, read-only${removable ? " but for needs carried in from an earlier year" : ""}`}
          tabIndex={0}
          className="custom-scrollbar min-h-0 flex-1 overflow-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        >
          <div className="px-4 pt-4 sm:px-6">
            <PlanHeader planTitle="Training and Development Plan - A (Training)" subtitle={`For CY ${fiscalYear}`} />
            <div className="mb-3 space-y-1 text-[11px] text-slate-500">
              {carried > 0 && (
                <p>
                  Needs marked{" "}
                  <span className="rounded border border-amber-200 bg-amber-50 px-1 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700">from {carriedYear}</span>{" "}
                  were carried in unmet from an earlier year (the year they were first listed).{" "}
                  {tdp ? "They aren't part of the uploaded TDP, and stay when it is replaced." : "They aren't part of any TDP, and stay when the TDP is uploaded."}
                  {removable && " One that no longer applies can be removed here."}
                </p>
              )}
              {kept > 0 && (
                <p>
                  Needs marked{" "}
                  <span className="rounded border border-slate-300 bg-slate-100 px-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">Kept</span>{" "}
                  aren't in the amended TDP: they stay because their person is seated for them on a seminar, or they were accomplished.
                </p>
              )}
              {unlisted > 0 && <p>{count(unlisted, "employee")} with nothing in the plan {unlisted === 1 ? "is" : "are"} not listed.</p>}
            </div>
          </div>

          {listed.length === 0 ? (
            <p className="mx-4 mb-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500 sm:mx-6">
              Nothing is listed in the FY {fiscalYear} plan.
            </p>
          ) : (
            <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left text-xs">
              <caption className="sr-only">Training and Development Plan A for CY {fiscalYear}, by office: what each employee still needs, in the form's three columns.</caption>
              <thead>
                <tr>
                  <th scope="col" className={`${HEAD} w-44`}>Name</th>
                  <th scope="col" className={`${HEAD} w-40`}>Position</th>
                  {TRAINING_NEED_CATEGORIES.map(c => (
                    <th key={c} scope="col" className={HEAD}>{TRAINING_NEED_COLUMN_LABELS[c]}</th>
                  ))}
                </tr>
              </thead>
              {/* One row group per office, under its heading. */}
              {listed.map(office => (
                <tbody key={office.office}>
                  <tr>
                    <th colSpan={5} scope="rowgroup" className="border-b border-slate-200 bg-slate-100 p-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      {office.office}
                    </th>
                  </tr>
                  {office.employees.map(emp => (
                    <tr key={emp.employeeId}>
                      <th scope="row" className={`${CELL} text-left font-semibold text-slate-800`}>{emp.fullName}</th>
                      <td className={`${CELL} text-slate-500`}>{emp.position || "—"}</td>
                      {TRAINING_NEED_CATEGORIES.map(category => {
                        const rows = emp.needs?.[category] ?? [];
                        return (
                          <td key={category} className={`${CELL} min-w-[200px]`}>
                            {rows.length === 0 ? (
                              <>
                                <span className="text-slate-300" aria-hidden="true">—</span>
                                <span className="sr-only">None</span>
                              </>
                            ) : (
                              <ul className="space-y-1">
                                {rows.map(need => (
                                  <li key={need.id} className="leading-snug text-slate-700">
                                    {need.title}
                                    {/* Brought forward unmet by the fiscal-year rollover; the year it was first raised. */}
                                    {need.carriedFromFiscalYear && (
                                      <span
                                        title={`Still unmet since CY ${need.carriedFromFiscalYear}: carried in, not part of the TDP`}
                                        className="ml-1.5 inline-block rounded border border-amber-200 bg-amber-50 px-1 py-px align-middle font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700"
                                      >
                                        from {need.carriedFromFiscalYear}<span className="sr-only">: carried in from an earlier year</span>
                                      </span>
                                    )}
                                    {need.carriedFromFiscalYear && onRemoveCarried && (
                                      <button
                                        type="button"
                                        data-tdp="remove-carried"
                                        onClick={() => removeCarried(need, emp.fullName)}
                                        disabled={removing !== null}
                                        aria-label={`Remove “${need.title}”, carried in from ${need.carriedFromFiscalYear}, for ${emp.fullName}`}
                                        className="ml-1.5 cursor-pointer rounded align-middle text-[10px] font-semibold text-rose-700 underline hover:text-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {removing === need.id ? "Removing…" : "Remove"}
                                      </button>
                                    )}
                                    {/* Left out of the amended TDP, kept because still in use. */}
                                    {keptIds.has(need.id) && (
                                      <span
                                        title="Not in the amended TDP: kept because its person is seated for it on a seminar, or it was accomplished"
                                        className="ml-1.5 inline-block rounded border border-slate-300 bg-slate-100 px-1 py-px align-middle text-[9px] font-bold uppercase tracking-wider text-slate-600"
                                      >
                                        Kept<span className="sr-only">: not in the amended TDP, kept because still in use</span>
                                      </span>
                                    )}
                                    {/* The law or a rule requires it (12z Part D): first in Monitoring and planning. */}
                                    {need.mandate && (
                                      <span
                                        title={`Mandated: ${need.mandate.basis}`}
                                        className="ml-1.5 inline-block rounded border border-blue-200 bg-blue-50 px-1 py-px align-middle text-[9px] font-bold uppercase tracking-wider text-blue-700"
                                      >
                                        Mandated<span className="sr-only">: {need.mandate.basis}</span>
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] text-slate-600">
              {summary} <span className="text-slate-500">Read-only: Plan A changes only through an amended TDP{removable ? ", but for needs carried in from an earlier year" : ""}.</span>
            </p>
            {/* A removal's outcome, read out as it changes. */}
            <p role="status" aria-live="polite" data-tdp="removal" className={`text-[11px] font-semibold ${removal?.tone === "error" ? "text-rose-700" : removal?.tone === "warn" ? "text-amber-800" : "text-emerald-700"}`}>
              {removal?.text ?? ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
