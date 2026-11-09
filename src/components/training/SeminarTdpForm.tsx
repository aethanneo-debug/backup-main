import { useId, useState } from "react";
import { Target } from "lucide-react";
import type { SeminarTdpJustificationInput } from "../../types";
import { readSeminarTdpJustification } from "../../tdpRules";
import { manilaToday } from "../utilities/signatoryHelpers";
import ModalDialog from "../ui/ModalDialog";
import SeminarTdpFields, { seminarTdpRaw, seminarTdpValues, type SeminarTdpValues } from "./SeminarTdpFields";

// Why a seminar the TDP doesn't cover is held (HSAC RAB 1, 2026-10-28; known-issues 12z Part C): none of
// its needs is in its fiscal year's Plan A. The kind, the reason and who approved it; it covers everyone
// seated on it. Checked with the server's own rules (src/tdpRules.ts) before it is sent. Its fields are
// SeminarTdpFields, shared with a training need planned outside the TDP (12ae), whose justification can
// fill this one in (`initial`, with a `note` saying so).
interface Props {
  seminarTitle: string;
  fiscalYear?: string;
  initial?: SeminarTdpJustificationInput;
  /** Why it is asked again, or where it was filled in from (e.g. the seminar was renamed). */
  note?: string;
  saving?: boolean;
  /** The server's refusal, if the save that follows fails. */
  error?: string;
  onSave: (value: SeminarTdpJustificationInput) => void;
  onCancel: () => void;
}

const BUTTON = "rounded-lg px-4 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export default function SeminarTdpForm({ seminarTitle, fiscalYear, initial, note, saving = false, error, onSave, onCancel }: Props) {
  const id = useId();
  const [values, setValues] = useState<SeminarTdpValues>(() => seminarTdpValues(initial));
  const [problem, setProblem] = useState("");
  // Manila's day, as the server checks a reference's date.
  const today = manilaToday();

  const submit = () => {
    const read = readSeminarTdpJustification(seminarTdpRaw(values), today);
    if ("problem" in read) {
      setProblem(read.problem);
      return;
    }
    setProblem("");
    onSave(read.value);
  };

  return (
    <ModalDialog
      title="Held outside the TDP"
      subtitle={`${seminarTitle || "Untitled seminar"}${fiscalYear ? ` · FY ${fiscalYear}` : ""}`}
      icon={<Target size={16} aria-hidden="true" />}
      onClose={onCancel}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={saving} className={`${BUTTON} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`}>{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="space-y-3 text-xs text-slate-700">
        {/* "No need the TDP lists": a training planned outside the TDP (12ae) is a Plan A need, but not the TDP's. */}
        <p className="text-[11px] text-slate-500">
          This seminar covers no need the {fiscalYear ? `FY ${fiscalYear} ` : ""}TDP lists (a training planned outside it doesn&rsquo;t count), so
          record why it is held and who approved it. It covers everyone seated on it; only HR and the Administrator see it, and the
          Administrator is notified.
        </p>
        {note && <p data-tdp="seminar-why-note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{note}</p>}
        <SeminarTdpFields id={id} values={values} today={today} onChange={patch => setValues(v => ({ ...v, ...patch }))} />
        {(problem || error) && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{problem || error}</p>}
      </div>
    </ModalDialog>
  );
}
