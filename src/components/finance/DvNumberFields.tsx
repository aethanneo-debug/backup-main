import { useEffect, useRef, useState } from "react";
import { apiCall, getLocalTodayString } from "../../utils";
import { dvNumberFrom, dvPrefix, dvPrefixIn, dvSerialInput, readDvNumber } from "../../dvNumber";

// A disbursement voucher's date and number, YYYY-MM-NNNN (src/dvNumber.ts, 12q): the date first, since
// the number's year and month are the voucher date's, then only the serial, as digits. The line under
// it shows the number as it will be saved. Used where Finance releases a cash advance
// (AdvanceRequestsList.tsx) and where it pays a reimbursement (ReimbursementQueue.tsx); the server
// checks the same and refuses a number already used.

/** The voucher number the form would send, when the server would take it ("" otherwise). */
export function validDv(dvDate: string, serial: string): string {
  const number = dvNumberFrom(dvDate, serial);
  return number && !("problem" in readDvNumber(number, dvDate)) ? number : "";
}

const INPUT = "w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:bg-slate-100";

interface Props {
  /** The inputs' ids are `${prefix}-dvd-${recordId}`, `${prefix}-dv-${recordId}` and `${prefix}-dv-hint-${recordId}`. */
  prefix: string;
  recordId: string;
  dvDate: string;
  onDvDate: (date: string) => void;
  serial: string;
  onSerial: (serial: string) => void;
  /** A whole number pasted from another month than the voucher date's, said at once ("" clears it). */
  onWarning: (message: string) => void;
  disabled: boolean;
  /** The earliest voucher date the server takes, if any (e.g. the day the report was validated). */
  minDate?: string;
  /** Changed by the form after the server refused the voucher (another officer took the number meanwhile): the
   * suggestion is asked for again, and replaces the one still in the box. */
  refresh?: number;
}

export default function DvNumberFields({ prefix, recordId, dvDate, onDvDate, serial, onSerial, onWarning, disabled, minDate, refresh = 0 }: Props) {
  const dateId = `${prefix}-dvd-${recordId}`, numberId = `${prefix}-dv-${recordId}`, hintId = `${prefix}-dv-hint-${recordId}`;
  const number = validDv(dvDate, serial);

  // The next serial not yet recorded in this system for the voucher date's month, filled in for Finance (the user's
  // report of 2026-11-13): the server counts every voucher already used on an advance or a reimbursement. The office's
  // other vouchers aren't recorded here, so it is only a suggestion, said so in amber: Finance checks it against the paper
  // voucher. Only a box Finance hasn't typed in is filled (empty, or still holding the earlier suggestion).
  const month = dvPrefix(dvDate);
  // Kept with its month, so the line never names a month it wasn't worked out for (the code review).
  const [suggested, setSuggested] = useState<{ month: string; serial: string } | null>(null);
  const current = useRef(serial);
  current.current = serial;
  const setSerial = useRef(onSerial);
  setSerial.current = onSerial;
  const filled = useRef("");
  useEffect(() => {
    setSuggested(null);
    if (!month) return;
    let live = true;
    apiCall(`/api/disbursement-vouchers/next?month=${encodeURIComponent(month)}`)
      .then(res => {
        if (!live || res?.status !== "success") return;
        const next = String(res.data?.serial || "");
        setSuggested(next ? { month, serial: next } : null);
        if (next && (current.current === "" || current.current === filled.current)) {
          filled.current = next;
          setSerial.current(next);
        }
      })
      // No suggestion is no harm: the box stays as it is.
      .catch(() => {});
    return () => { live = false; };
  }, [month, refresh]);
  return (
    <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <label htmlFor={dateId} className="font-mono text-[10px] font-bold uppercase text-slate-400">Voucher Date</label>
        <input id={dateId} type="date" value={dvDate} min={minDate || undefined} max={getLocalTodayString()} disabled={disabled}
          onChange={e => onDvDate(e.target.value)} className={INPUT} />
      </div>
      <div className="space-y-1">
        <label htmlFor={numberId} className="font-mono text-[10px] font-bold uppercase text-slate-400">Disbursement Voucher No.</label>
        <div className="flex items-center gap-1">
          <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 font-mono text-xs text-slate-600" aria-hidden="true">
            {dvPrefix(dvDate) || "YYYY-MM"}-
          </span>
          {/* No maxLength: the whole number typed or pasted out of habit ("2026-10-0101") gives its
              serial (dvSerialInput), instead of being cut to "2026". */}
          <input id={numberId} type="text" inputMode="numeric" autoComplete="off" value={serial} disabled={disabled}
            onChange={e => {
              const typed = e.target.value;
              onSerial(dvSerialInput(typed));
              const pasted = dvPrefixIn(typed), month = dvPrefix(dvDate);
              onWarning(pasted && pasted !== month
                ? month ? `That number is from ${pasted}, but the voucher date is in ${month}: check the date, or the number.` : "Choose the voucher's date first."
                : "");
            }}
            placeholder="0101" aria-describedby={hintId} className={INPUT} />
        </div>
        {/* The number as it will be saved, only once it is one the server takes. */}
        <p id={hintId} className="font-mono text-[11px] text-slate-600">
          {number
            ? `DV ${number}`
            : /^0+$/.test(serial)
              ? "The voucher's serial can't be 0000."
              : `Serial on the voucher, up to 4 digits: the number reads ${dvPrefix(dvDate) || "YYYY-MM"}-NNNN.`}
          {suggested && suggested.month === month && serial === suggested.serial && (
            <span data-dv-suggested className="mt-0.5 block font-sans text-[10px] font-semibold text-amber-700">
              Filled in: the next number for {month} not yet recorded in this system. Check it against the paper voucher.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
