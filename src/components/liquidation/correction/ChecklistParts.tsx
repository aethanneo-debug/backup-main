import { ReactNode } from "react";
import { CircleAlert, Lock, Paperclip } from "lucide-react";
import { LiquidationDocument, LiquidationParticular } from "../../../types";
import { formatCurrency, formatDate } from "../../../utils";
import { HINT } from "../../utilities/signatoryFormParts";

// The rows and pickers of the "Return for correction" checklist (ReturnForCorrectionDialog).
// Presentational only: the dialog owns the state and decides which parts are locked.

const NOTE_MAX = 500; // the server's limit for each note (correctionRequestFrom)

const CHECKBOX =
  "h-4 w-4 shrink-0 cursor-pointer accent-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed";
const SUB_LABEL = "mb-1 block text-[11px] font-semibold text-slate-700";
const SUB_LIST = "divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white";
const SUB_OPTION = "flex cursor-pointer items-start gap-2 px-2.5 py-1.5 hover:bg-slate-50";
const NOTE_INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 disabled:cursor-not-allowed disabled:bg-slate-50";

/** The red asterisk after a required label. Hidden from screen readers, so say it in words too. */
export const REQUIRED = <span className="text-rose-600" aria-hidden="true"> *</span>;

/** One part of the report: its tick box, why it is locked if it is, and its details while ticked. */
export function ChecklistRow({ id, label, on, reason, onToggle, children }: {
  id: string;
  label: string;
  on: boolean;
  /** Why it can't be ticked on this report; empty when it can. */
  reason: string;
  onToggle: () => void;
  /** Shown under the label while ticked. */
  children: ReactNode;
}) {
  return (
    <li className={`flex items-start gap-2.5 px-3 py-2.5 ${on ? "bg-amber-50" : reason ? "bg-slate-50" : "bg-white"}`}>
      <input
        id={id}
        type="checkbox"
        checked={on}
        disabled={!!reason}
        onChange={onToggle}
        aria-describedby={reason ? `${id}-reason` : undefined}
        className={CHECKBOX}
      />
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className={`block font-semibold ${reason ? "cursor-not-allowed text-slate-500" : "cursor-pointer text-slate-800"}`}
        >
          {label}
        </label>
        {reason && (
          <p id={`${id}-reason`} className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <Lock size={11} className="shrink-0" aria-hidden="true" />
            {reason}
          </p>
        )}
        {on && <div className="mt-2 space-y-3">{children}</div>}
      </div>
    </li>
  );
}

/** Particulars: which lines reopen. None ticked reopens every line. */
export function LinePicker({ id, lines, chosen, onToggle }: {
  id: string;
  lines: LiquidationParticular[];
  chosen: string[];
  onToggle: (lineId: string) => void;
}) {
  if (lines.length === 0) {
    return (
      <p className="text-[11px] leading-relaxed text-slate-500">
        This report has no itemised lines, so the whole block reopens.
      </p>
    );
  }
  return (
    <fieldset className="min-w-0" aria-describedby={`${id}-hint`}>
      <legend className={SUB_LABEL}>
        Lines to reopen <span className="font-normal text-slate-500">(optional)</span>
      </legend>
      <ul className={SUB_LIST}>
        {lines.map(line => (
          <li key={line.id}>
            <label className={SUB_OPTION}>
              <input
                type="checkbox"
                checked={chosen.includes(line.id)}
                onChange={() => onToggle(line.id)}
                className={CHECKBOX}
              />
              <span className="min-w-0 flex-1 break-words text-slate-700">
                {line.description || <em className="text-slate-500">No description</em>}
                {line.category && <span className="text-slate-500"> · {line.category}</span>}
              </span>
              {/* A space for the accessible name; flex layout ignores it. */}{" "}
              <span className="shrink-0 font-mono tabular-nums text-slate-800">
                {formatCurrency(Number(line.amount) || 0)}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p id={`${id}-hint`} className={HINT}>
        Leave all unticked to reopen every line (the employee may then add or remove lines).
      </p>
    </fieldset>
  );
}

/** Supporting documents: which current files the employee must replace (at least one). */
export function FilePicker({ id, files, chosen, missing, onToggle }: {
  id: string;
  /** The files now on the report (none superseded). */
  files: LiquidationDocument[];
  chosen: string[];
  /** True while none is chosen. */
  missing: boolean;
  onToggle: (docId: string) => void;
}) {
  return (
    <fieldset className="min-w-0" aria-describedby={`${id}-hint`}>
      <legend className={SUB_LABEL}>
        Files to replace{REQUIRED}
        <span className="sr-only"> (choose at least one)</span>
      </legend>
      <ul className={SUB_LIST}>
        {files.map(doc => {
          const meta = [doc.size, doc.uploadedAt ? `uploaded ${formatDate(doc.uploadedAt)}` : ""].filter(Boolean).join(" · ");
          return (
            <li key={doc.id}>
              <label className={SUB_OPTION}>
                <input
                  type="checkbox"
                  checked={chosen.includes(doc.id)}
                  onChange={() => onToggle(doc.id)}
                  className={CHECKBOX}
                />
                <Paperclip size={12} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-slate-700">{doc.name || doc.filename || "Unnamed file"}</span>
                  {meta && <> <span className="block text-[10px] text-slate-500">{meta}</span></>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p id={`${id}-hint`} className={HINT}>
        The employee uploads a replacement for each file ticked. The old file stays on the report, marked as replaced.
      </p>
      {missing && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-800">
          <CircleAlert size={12} className="shrink-0" aria-hidden="true" />
          Choose at least one file.
        </p>
      )}
    </fieldset>
  );
}

/** The reviewer's note on one part, shown beside it on the employee's form. */
export function NoteField({ id, part, value, onChange }: {
  id: string;
  /** The part's label, so a screen reader says which part the note is for. */
  part: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={SUB_LABEL}>
        Note for the employee<span className="sr-only"> about {part}</span>{" "}
        <span className="font-normal text-slate-500">(optional)</span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={NOTE_MAX}
        autoComplete="off"
        onChange={e => onChange(e.target.value)}
        className={NOTE_INPUT}
      />
    </div>
  );
}
