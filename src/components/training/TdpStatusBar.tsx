import { Ref } from "react";
import { CheckCircle2, Eye, FileSpreadsheet, Plus, RefreshCw } from "lucide-react";
import { TdpUpload } from "../../types";
import { addedChangesText, addedText, count, manilaDay, tdpCountsText, uploadedBy } from "./tdpText";

// The TDP is uploaded once a year (the instructor's review, R9: "may button dito na TDP na uploaded"). Once it is in,
// this bar takes the upload panel's place: which file, when and by whom, what it holds, and the ways on: Plan A
// read-only, replacing it with an amended TDP (the only way the TDP's own needs change), and, for HR and the
// Administrator, adding one of its trainings to someone's plan (12ad: a new hire, a new designation).
interface Props {
  tdp: TdpUpload;
  /** Needs carried in from an earlier year: in the plan, but not part of the TDP. */
  carried: number;
  /** Needs HR added after the TDP, one of its trainings at a time: in the plan, but not part of the uploaded file. */
  added?: number;
  /** The replace flow is open below (the Replace button controls it). */
  replacing: boolean;
  replacePanelId: string;
  onView: () => void;
  onReplace: () => void;
  /** HR and the Administrator plan trainings (the server checks again): "Add Training Need" is theirs. */
  canPlan?: boolean;
  onAdd?: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
  replaceRef?: Ref<HTMLButtonElement>;
  addRef?: Ref<HTMLButtonElement>;
}

const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1";
const BUTTON = `inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${FOCUS}`;

export default function TdpStatusBar({
  tdp, carried, added = 0, replacing, replacePanelId, onView, onReplace, canPlan = false, onAdd, headingRef, replaceRef, addRef
}: Props) {
  const day = manilaDay(tdp.uploadedAt);
  const who = uploadedBy(tdp);
  const fy = tdp.fiscalYear;
  // A year imported before uploads were recorded: its file, day and officer come from the audit log, when it has them.
  const fromAuditLog = tdp.kind === "before-records" && !!(day || tdp.filename || who);
  // An amended TDP's word on the needs HR had added after the one before ("" when there were none).
  const addedChanges = addedChangesText(tdp.changes);

  return (
    <section data-tdp="bar" aria-labelledby="tdp-bar-title" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-72 items-start gap-2.5">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <h3 id="tdp-bar-title" ref={headingRef} tabIndex={-1} className="text-sm font-bold text-emerald-900 focus:outline-none">
              TDP for FY {fy} uploaded
            </h3>
            {/* Plain text with its separators, so it reads as one line: file · day · who. */}
            <p className="min-w-0 break-words text-xs text-slate-700">
              {tdp.filename && (
                <>
                  <FileSpreadsheet size={13} className="mr-1 inline-block align-[-2px] text-emerald-700" aria-hidden="true" />
                  <span className="break-all font-semibold text-slate-800">{tdp.filename}</span>
                  <span className="text-slate-400"> · </span>
                </>
              )}
              <span>{day || (tdp.kind === "before-records" ? "Uploaded before uploads were recorded" : "Date not recorded")}</span>
              {who && (
                <>
                  <span className="text-slate-400"> · </span>
                  <span>by {who}</span>
                </>
              )}
            </p>
            <p className="text-xs text-slate-600">{tdpCountsText(tdp, carried)}.</p>
            {/* Not the TDP's: one of its trainings each, for someone it didn't list (12ad). */}
            {added > 0 && <p data-tdp="added-count" className="text-xs text-slate-600">{addedText(added)}.</p>}
            {tdp.kind === "replace" && (
              <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-700">
                <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  Amended TDP
                </span>
                {tdp.changes ? (
                  <span>
                    {count(tdp.changes.added, "need")} added, {tdp.changes.moved > 0 ? `${tdp.changes.moved} moved to another column, ` : ""}
                    {tdp.changes.removed} removed, {tdp.changes.kept} kept because still in use.
                    {addedChanges && ` ${addedChanges}`}
                  </span>
                ) : (
                  <span>It replaced an earlier upload.</span>
                )}
              </p>
            )}
            {fromAuditLog && (
              <p className="text-[11px] text-slate-500">Imported before uploads were recorded: these details are from the audit log.</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-tdp="view"
            onClick={onView}
            className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`}
          >
            <Eye size={14} aria-hidden="true" /> View uploaded TDP
          </button>
          <button
            type="button"
            ref={replaceRef}
            data-tdp="replace"
            onClick={onReplace}
            aria-expanded={replacing}
            aria-controls={replacing ? replacePanelId : undefined}
            className={`${BUTTON} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
          >
            <RefreshCw size={14} aria-hidden="true" /> Replace with an amended TDP
          </button>
          {canPlan && onAdd && (
            <button
              type="button"
              ref={addRef}
              data-tdp="add"
              onClick={onAdd}
              className={`${BUTTON} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
            >
              <Plus size={14} aria-hidden="true" /> Add Training Need
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
