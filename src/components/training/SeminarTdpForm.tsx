import { useId, useState } from "react";
import { Target } from "lucide-react";
import { SEMINAR_TDP_KINDS, type SeminarTdpJustificationInput, type SeminarTdpKind } from "../../types";
import { readSeminarTdpJustification, TDP_NAME_MAX, TDP_REASON_MAX, TDP_REFERENCE_MAX } from "../../tdpRules";
import { getLocalTodayString } from "../../utils";
import ModalDialog from "../ui/ModalDialog";

// Why a seminar the TDP doesn't cover is held (HSAC RAB 1, 2026-10-28; known-issues 12z Part C): none of
// its needs is in its fiscal year's Plan A. The kind, the reason and who approved it; it covers everyone
// seated on the seminar. Checked with the server's own rules (src/tdpRules.ts) before it is sent.
interface Props {
  seminarTitle: string;
  fiscalYear?: string;
  initial?: SeminarTdpJustificationInput;
  /** Why it is asked again, when it is (e.g. the seminar was renamed). */
  note?: string;
  saving?: boolean;
  /** The server's refusal, if the save that follows fails. */
  error?: string;
  onSave: (value: SeminarTdpJustificationInput) => void;
  onCancel: () => void;
}

const HINT: Record<SeminarTdpKind, string> = {
  "Central Office training": "a training the Central Office pays for or sends participants to",
  "Invitation from another agency": "another agency invited the office",
  "New law or issuance": "a law, circular or issuance that came after the plan",
  "Other": "explain it below"
};
const INPUT = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
const LABEL = "block text-[11px] font-semibold text-slate-700 mb-0.5";
const BUTTON = "rounded-lg px-4 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export default function SeminarTdpForm({ seminarTitle, fiscalYear, initial, note, saving = false, error, onSave, onCancel }: Props) {
  const id = useId();
  const [kind, setKind] = useState<SeminarTdpKind | "">(initial?.kind ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [name, setName] = useState(initial?.approvedBy.name ?? "");
  const [position, setPosition] = useState(initial?.approvedBy.position ?? "");
  const [referenceNo, setReferenceNo] = useState(initial?.referenceNo ?? "");
  const [referenceDate, setReferenceDate] = useState(initial?.referenceDate ?? "");
  const [problem, setProblem] = useState("");

  const submit = () => {
    const read = readSeminarTdpJustification(
      { kind, reason, approvedBy: { name, position }, referenceNo, referenceDate },
      getLocalTodayString()
    );
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
        <p className="text-[11px] text-slate-500">
          This seminar covers no need in the {fiscalYear ? `FY ${fiscalYear} ` : ""}Training and Development Plan, so record why it is held
          and who approved it. It covers everyone seated on it; only HR and the Administrator see it, and the Administrator is notified.
        </p>
        {note && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{note}</p>}
        <fieldset className="space-y-1">
          <legend className={LABEL}>Why it is held</legend>
          {SEMINAR_TDP_KINDS.map(k => (
            <label key={k} className="flex cursor-pointer items-start gap-2">
              <input type="radio" name={`${id}-kind`} className="mt-0.5" checked={kind === k} onChange={() => setKind(k)} />
              <span><span className="font-semibold text-slate-800">{k === "Other" ? "Another reason" : k}</span><span className="text-slate-500">: {HINT[k]}</span></span>
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor={`${id}-reason`} className={LABEL}>Reason</label>
          <textarea id={`${id}-reason`} aria-describedby={`${id}-reason-hint`} className={INPUT} rows={2} value={reason} maxLength={TDP_REASON_MAX} onChange={e => setReason(e.target.value)} />
          {/* About the seminar, so it never needs anyone's personal circumstances (RA 10173). */}
          <p id={`${id}-reason-hint`} className="mt-0.5 text-[10px] text-slate-500">Why the office holds it. Leave out anyone&rsquo;s health, leave or other personal details.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-name`} className={LABEL}>Approved by (name)</label>
            <input id={`${id}-name`} className={INPUT} value={name} maxLength={TDP_NAME_MAX} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-position`} className={LABEL}>Their position</label>
            <input id={`${id}-position`} className={INPUT} value={position} maxLength={TDP_NAME_MAX} onChange={e => setPosition(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-ref`} className={LABEL}>Memo, invitation or issuance No. (optional)</label>
            <input id={`${id}-ref`} className={INPUT} value={referenceNo} maxLength={TDP_REFERENCE_MAX} onChange={e => setReferenceNo(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-date`} className={LABEL}>Its date (optional)</label>
            <input id={`${id}-date`} type="date" className={INPUT} value={referenceDate} max={getLocalTodayString()} onChange={e => setReferenceDate(e.target.value)} />
          </div>
        </div>
        {(problem || error) && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{problem || error}</p>}
      </div>
    </ModalDialog>
  );
}
