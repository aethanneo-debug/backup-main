import { getLocalTodayString } from "../../utils";
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
}

export default function DvNumberFields({ prefix, recordId, dvDate, onDvDate, serial, onSerial, onWarning, disabled, minDate }: Props) {
  const dateId = `${prefix}-dvd-${recordId}`, numberId = `${prefix}-dv-${recordId}`, hintId = `${prefix}-dv-hint-${recordId}`;
  const number = validDv(dvDate, serial);
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
        </p>
      </div>
    </div>
  );
}
