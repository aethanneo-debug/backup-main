import { useEffect, useId, useRef, useState } from "react";
import { CornerUpLeft, Loader2 } from "lucide-react";
import {
  CORRECTION_FIELDS,
  CorrectionField,
  CorrectionItem,
  LiquidationDocument,
  LiquidationSubmission
} from "../../types";
import ModalDialog from "../ui/ModalDialog";
import { ACTION_BUTTON, CANCEL_BUTTON, CONTROL, LABEL, Notice } from "../utilities/signatoryFormParts";
import { ChecklistRow, FilePicker, LinePicker, NoteField, REQUIRED } from "./correction/ChecklistParts";

/**
 * Return a liquidation report for correction (requirement 5, the instructor's note 11).
 * HR or Finance ticks what is wrong, with an optional note on each part and overall
 * remarks. Only the ticked parts reopen on the claimant's form; everything else stays as
 * filed. The activity and the employee's name are never on the list.
 *
 * The server checks all of this again (correctionRequestFrom in server.ts); the dialog only
 * says it first. A refusal comes back through onSubmit and is shown here, and everything the
 * reviewer entered is kept.
 */

interface ReturnForCorrectionDialogProps {
  /** The report being returned. */
  report: LiquidationSubmission;
  /** Who is returning it. The corrected report comes back to them. */
  reviewer: "HR" | "Finance";
  onCancel: () => void;
  /**
   * Sends the Return. Resolves on success (the parent then closes the dialog); rejects with
   * an Error whose message is the server's reason, which the dialog shows and stays open.
   */
  onSubmit: (payload: { remarks: string; items: CorrectionItem[] }) => Promise<void>;
}

const REMARKS_MAX = 1000; // the server's limit (correctionRequestFrom)

/** Why a part can't be returned on this report, or "" when it can. */
function lockedBecause(field: CorrectionField, report: LiquidationSubmission, files: LiquidationDocument[]): string {
  if (field === "cashAdvance" && report.cashAdvanceId) return "Taken from Finance's record of the advance";
  if (field === "cashAdvance" && report.claimType === "Reimbursement") return "A Reimbursement has no cash advance (tick Claim type if one was received)";
  if (field === "refundOr" && report.claimType === "Reimbursement") return "A Reimbursement has no refund";
  if (field === "replaceDocuments" && files.length === 0) return "No files attached";
  return "";
}

const toggled = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter(v => v !== value) : [...list, value];

/** "a", "a and b", "a, b and c". */
const joinAnd = (parts: string[]) =>
  parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

export default function ReturnForCorrectionDialog({ report, reviewer, onCancel, onSubmit }: ReturnForCorrectionDialogProps) {
  const [ticked, setTicked] = useState<CorrectionField[]>([]);
  const [notes, setNotes] = useState<Partial<Record<CorrectionField, string>>>({});
  const [lineIds, setLineIds] = useState<string[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [remarks, setRemarks] = useState("");
  const [remarksTouched, setRemarksTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const ids = {
    remarks: `${uid}-remarks`,
    remarksHint: `${uid}-remarks-hint`,
    remarksError: `${uid}-remarks-error`,
    status: `${uid}-status`
  };

  // Only what the server can match is offered: lines with an id, and the files now on the
  // report (a file replaced in an earlier round stays on it, marked superseded).
  const lines = (report.particulars ?? []).filter(l => l && l.id);
  const files = (report.supportingDocs ?? []).filter(d => d && d.id && !d.supersededAt);

  // What would be sent, checked against the report as it is now, so a tick left on a part
  // that has since locked, or on a file since replaced, is never sent.
  const chosen = CORRECTION_FIELDS.filter(c => ticked.includes(c.field) && !lockedBecause(c.field, report, files));
  const chosenLines = lines.filter(l => lineIds.includes(l.id)).map(l => l.id);
  const chosenFiles = files.filter(d => documentIds.includes(d.id)).map(d => d.id);
  const filesMissing = chosen.some(c => c.field === "replaceDocuments") && chosenFiles.length === 0;
  const remarksBlank = remarks.trim() === "";
  const remarksError = remarksTouched && remarksBlank;

  const missing = [
    chosen.length === 0 ? "tick at least one part to correct" : "",
    filesMissing ? "choose the files to replace" : "",
    remarksBlank ? "enter the remarks" : ""
  ].filter(Boolean);
  const ready = missing.length === 0;
  const status = busy
    ? "Returning the report…"
    : ready
      ? `${chosen.length} ${chosen.length === 1 ? "part" : "parts"} will reopen on the employee's form.`
      : `To return the report, ${joinAnd(missing)}.`;

  // After a refusal: bring the message into view, and put focus back on the Return button
  // (disabling it while sending dropped focus) so a keyboard user can retry or move on.
  useEffect(() => {
    if (!error) return;
    errorRef.current?.scrollIntoView({ block: "nearest" });
    if (!document.activeElement || document.activeElement === document.body) submitRef.current?.focus();
  }, [error]);

  async function handleSubmit() {
    if (!ready || inFlight.current) return;
    const items = chosen.map(({ field }) => {
      const item: CorrectionItem = { field };
      const note = (notes[field] ?? "").trim();
      if (note) item.remark = note;
      if (field === "particulars" && chosenLines.length > 0) item.lineIds = chosenLines;
      if (field === "replaceDocuments") item.documentIds = chosenFiles;
      return item;
    });
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await onSubmit({ remarks: remarks.trim(), items });
      // Sent. The parent closes the dialog; staying busy until then means the Return can't
      // be sent twice.
    } catch (err) {
      const reason = err instanceof Error ? err.message : typeof err === "string" ? err : "";
      inFlight.current = false;
      setBusy(false);
      setError(reason.trim() || "The report could not be returned. Please try again.");
    }
  }

  // The number the reviewer's list and queue show, so it matches the row they opened.
  const subtitle = [report.submissionNo || report.serialNo, report.employeeName, report.activityTitle]
    .map(s => String(s ?? "").trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <ModalDialog
      title="Return for correction"
      subtitle={subtitle}
      icon={<CornerUpLeft size={16} aria-hidden="true" />}
      onClose={onCancel}
      busy={busy}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className={CANCEL_BUTTON}>
            Cancel
          </button>
          <button
            ref={submitRef}
            type="button"
            onClick={handleSubmit}
            disabled={!ready || busy}
            aria-describedby={ids.status}
            className={`${ACTION_BUTTON} bg-amber-700 hover:bg-amber-800 focus-visible:ring-amber-700`}
          >
            {busy
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : <CornerUpLeft size={14} aria-hidden="true" />}
            {busy ? "Returning…" : "Return for correction"}
          </button>
          {/* What the Return still needs, beside the button it explains. Last in the DOM so it
              sits above the buttons when they stack on a narrow screen. */}
          <p
            id={ids.status}
            role="status"
            aria-live="polite"
            className="text-[11px] leading-snug text-slate-600 sm:order-first sm:mr-auto sm:self-center"
          >
            {status}
          </p>
        </>
      }
    >
      <div className="space-y-4 text-xs text-slate-700">
        <p className="leading-relaxed">
          Tick only what the employee must fix. Only those parts reopen on their form; everything else stays as
          filed. The activity and the employee's name can't be changed.{" "}
          <strong className="font-semibold text-slate-800">The corrected report comes back to {reviewer}.</strong>
        </p>

        <fieldset disabled={busy} className="min-w-0">
          <legend className={LABEL}>
            What needs correcting{REQUIRED}
            <span className="sr-only"> (tick at least one)</span>
          </legend>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
            {CORRECTION_FIELDS.map(({ field, label }) => {
              const reason = lockedBecause(field, report, files);
              // "part-" keeps the "remarks" part's id apart from the Remarks box below.
              const id = `${uid}-part-${field}`;
              return (
                <ChecklistRow
                  key={field}
                  id={id}
                  label={label}
                  on={!reason && ticked.includes(field)}
                  reason={reason}
                  onToggle={() => setTicked(t => toggled(t, field))}
                >
                  {field === "particulars" && (
                    <LinePicker
                      id={`${id}-lines`}
                      lines={lines}
                      chosen={lineIds}
                      onToggle={lineId => setLineIds(l => toggled(l, lineId))}
                    />
                  )}
                  {field === "replaceDocuments" && (
                    <FilePicker
                      id={`${id}-files`}
                      files={files}
                      chosen={documentIds}
                      missing={filesMissing}
                      onToggle={docId => setDocumentIds(d => toggled(d, docId))}
                    />
                  )}
                  <NoteField
                    id={`${id}-note`}
                    part={label}
                    value={notes[field] ?? ""}
                    onChange={value => setNotes(n => ({ ...n, [field]: value }))}
                  />
                </ChecklistRow>
              );
            })}
          </ul>
        </fieldset>

        <div>
          <label htmlFor={ids.remarks} className={LABEL}>
            Remarks{REQUIRED}
          </label>
          <textarea
            id={ids.remarks}
            rows={3}
            value={remarks}
            maxLength={REMARKS_MAX}
            disabled={busy}
            onChange={e => setRemarks(e.target.value)}
            onBlur={() => setRemarksTouched(true)}
            aria-required="true"
            aria-invalid={remarksError}
            aria-describedby={remarksError ? `${ids.remarksHint} ${ids.remarksError}` : ids.remarksHint}
            className={`${CONTROL} ${remarksError ? "border-rose-400" : "border-slate-300"} resize-y disabled:cursor-not-allowed disabled:bg-slate-50`}
          />
          <div className="mt-1 flex items-start justify-between gap-3">
            <p id={ids.remarksHint} className="text-[11px] leading-relaxed text-slate-500">
              Why the report is being returned, up to 1,000 characters. The employee sees this with the checklist.
            </p>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500" aria-hidden="true">
              {remarks.length}/{REMARKS_MAX}
            </span>
          </div>
          {remarksError && (
            <p id={ids.remarksError} className="mt-1 text-[11px] font-medium text-rose-700">
              Enter the remarks: they tell the employee why the report came back.
            </p>
          )}
        </div>

        {error && (
          <div ref={errorRef}>
            <Notice tone="rose" role="alert">
              <strong>Not returned.</strong> {error}
            </Notice>
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
