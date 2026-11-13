import { useRef, type Dispatch, type SetStateAction } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { FILE_INPUT_ACCEPT, fileProblem, pickedFileProblem } from "../../fileRules";
import { OR_NUMBER_MAX } from "../../officialReceipt";
import { manilaDay } from "../../trainingCalendar";

// The official receipt (OR) the Finance Officer issues for cash handed back. HSAC RAB 1 has no cashier, so Finance
// records it (12ai): for an advance refunded in full (the Cash Advance Desk's "Record refund") and for what a seminar's
// liquidation report hands back (the report's View, at validation, with the OR's scan). The same boxes for both, read by
// src/officialReceipt.ts on the screen and the server alike.

const LABEL = "text-[10px] font-bold text-slate-500 uppercase font-mono";
const INPUT =
  "w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-slate-100 aria-[invalid=true]:border-rose-400";

/** The OR's number and date. */
export default function OrNumberFields({ ids, orNo, orDate, onOrNo, onOrDate, minDate, disabled = false, invalid, describedBy }: {
  ids: { no: string; date: string };
  orNo: string;
  orDate: string;
  onOrNo: (value: string) => void;
  onOrDate: (value: string) => void;
  /** The day the cash went out (the DV's date): an OR can't come before it. */
  minDate?: string;
  disabled?: boolean;
  /** Which box is wrong, after a try: the number (`true` too, as the refund form passes it) or the date. */
  invalid?: boolean | "no" | "date";
  /** The id of the message that says what is wrong. */
  describedBy?: string;
}) {
  const badNo = invalid === true || invalid === "no";
  const badDate = invalid === "date";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <label htmlFor={ids.no} className={LABEL}>Official Receipt No.</label>
        <input
          id={ids.no}
          type="text"
          value={orNo}
          maxLength={OR_NUMBER_MAX}
          disabled={disabled}
          onChange={e => onOrNo(e.target.value)}
          aria-required="true"
          aria-invalid={badNo || undefined}
          aria-describedby={badNo ? describedBy : undefined}
          placeholder="0247983"
          className={INPUT}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={ids.date} className={LABEL}>OR Date</label>
        <input
          id={ids.date}
          type="date"
          value={orDate}
          min={minDate || undefined}
          max={manilaDay()}
          disabled={disabled}
          onChange={e => onOrDate(e.target.value)}
          aria-required="true"
          aria-invalid={badDate || undefined}
          aria-describedby={badDate ? describedBy : undefined}
          className={INPUT}
        />
      </div>
    </div>
  );
}

/** A file picked in the browser and read, on its way to the server. */
export interface PickedFile {
  name: string;
  type: string;
  content: string;
}

/** What Validate sends for a report that hands money back (finance-action): the OR Finance issued, and its scan. */
export interface ValidateReceipt {
  refundOrNo: string;
  refundOrDate: string;
  /** Left out when the scan on the report already stands (one filed under the older rule, its OR kept). */
  refundOrFile?: PickedFile;
}

/** The OR for what a liquidation report hands back, as the Finance Officer records it when validating (12ai). */
export interface HandBack {
  orNo: string;
  orDate: string;
  scan: PickedFile | null;
}

/** The box a check found wrong: its number, its date or its scan. */
export type HandBackField = "no" | "date" | "scan";

/** The report's View, at validation: the OR's number, date and scan for the cash handed back. */
export function HandBackReceipt({ id, amount, minDate, value, onChange, onFile, onProblem, invalid = null, describedBy, disabled = false }: {
  id: string;
  /** The amount handed back, as shown. */
  amount: string;
  /** The DV's date. */
  minDate?: string;
  value: HandBack;
  /** A state setter: a scan read after the number was typed keeps the number. */
  onChange: Dispatch<SetStateAction<HandBack>>;
  onFile?: { name: string } | null;
  onProblem: (message: string) => void;
  /** The box a check found wrong, marked and tied to the message (`describedBy`). */
  invalid?: HandBackField | null;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
      <legend className="px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800">
        Official receipt for the {amount} handed back
      </legend>
      <OrNumberFields
        ids={{ no: `${id}-no`, date: `${id}-date` }}
        orNo={value.orNo}
        orDate={value.orDate}
        onOrNo={orNo => { onChange(prev => ({ ...prev, orNo })); onProblem(""); }}
        onOrDate={orDate => { onChange(prev => ({ ...prev, orDate })); onProblem(""); }}
        minDate={minDate}
        disabled={disabled}
        invalid={invalid === "no" || invalid === "date" ? invalid : undefined}
        describedBy={describedBy}
      />
      <OrScanField id={`${id}-scan`} scan={value.scan} onScan={scan => onChange(prev => ({ ...prev, scan }))} onProblem={onProblem} onFile={onFile}
        invalid={invalid === "scan"} describedBy={describedBy} disabled={disabled} />
    </fieldset>
  );
}

/**
 * The OR's scan: one of the report's required documents (R5), attached by the Finance Officer who issued it. Checked by
 * the same rules as a report's files (src/fileRules.ts: PDF, JPEG or PNG, at most 5 MB, really what its name says),
 * here and again on the server.
 */
export function OrScanField({ id, scan, onScan, onProblem, onFile, invalid = false, describedBy, disabled = false }: {
  id: string;
  scan: PickedFile | null;
  onScan: (file: PickedFile | null) => void;
  /** Why a picked file can't be used, or "" once one can. */
  onProblem: (message: string) => void;
  /** A scan already on the report (an older report's, attached by the employee): it counts unless replaced. */
  onFile?: { name: string } | null;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const attach = useRef<HTMLButtonElement>(null);
  // A pick answered after a newer one (or after the window moved on) is dropped.
  const latest = useRef(0);

  function pick(file: File | undefined) {
    if (!file) return;
    const problem = pickedFileProblem(file.name, file.size);
    if (problem) {
      onProblem(problem);
      return;
    }
    const mine = ++latest.current;
    const reader = new FileReader();
    reader.onerror = () => { if (mine === latest.current) onProblem(`"${file.name}" couldn't be read. Choose it again.`); };
    reader.onload = () => {
      if (mine !== latest.current) return;
      const content = String(reader.result || "");
      const bad = fileProblem(file.name, content, file.type);
      if (bad) {
        onProblem(bad);
        return;
      }
      onProblem("");
      onScan({ name: file.name, type: file.type, content });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-1">
      <span id={`${id}-label`} className={LABEL}>OR Scan</span>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <input
          ref={input}
          id={id}
          type="file"
          accept={FILE_INPUT_ACCEPT}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          disabled={disabled}
          onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }}
        />
        <button
          ref={attach}
          id={`${id}-attach`}
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled}
          aria-describedby={[`${id}-label`, `${id}-status`, invalid ? describedBy : ""].filter(Boolean).join(" ")}
          aria-invalid={invalid || undefined}
          className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 ${invalid ? "border-rose-400 bg-rose-50" : "border-blue-200 bg-blue-50"}`}
        >
          <Paperclip size={12} aria-hidden="true" />
          {scan || onFile ? "Replace the scan" : "Attach the scan"}
        </button>
        {/* Read out when a scan is picked or removed. */}
        <span id={`${id}-status`} aria-live="polite" className="inline-flex min-w-0 items-center gap-1">
          {scan ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-slate-700">
              <FileText size={12} className="shrink-0 text-slate-500" aria-hidden="true" />
              <span className="break-all font-mono">{scan.name}</span>
            </span>
          ) : onFile ? (
            <span className="text-slate-600">On file: <span className="break-all font-mono">{onFile.name}</span></span>
          ) : (
            <span className="text-slate-500">PDF, JPEG or PNG, up to 5 MB</span>
          )}
        </span>
        {scan && (
          <button
            type="button"
            // The button goes with the scan, so the focus goes back to Attach.
            onClick={() => { latest.current++; onScan(null); attach.current?.focus(); }}
            disabled={disabled}
            className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={12} aria-hidden="true" />
            <span className="sr-only">Remove {scan.name}</span>
          </button>
        )}
      </div>
    </div>
  );
}
