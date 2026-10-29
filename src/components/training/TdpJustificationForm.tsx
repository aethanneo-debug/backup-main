import { useId, useState } from "react";
import { TDP_COMMITTEES, type TdpCommittee, type TdpExceptionKind, type TdpJustificationInput } from "../../types";
import { readTdpJustification, TDP_NAME_MAX, TDP_REASON_MAX, TDP_REFERENCE_MAX } from "../../tdpRules";
import { getLocalTodayString } from "../../utils";

// Why someone the TDP doesn't identify is seated (HSAC RAB 1, 2026-10-28, known-issues 12z): "case to
// case", designated to do the tasks or identified by the Chief or head of agency, with the reason and
// who identified them. Checked with the server's own rules (src/tdpRules.ts) before it is kept.
interface Props {
  employeeName: string;
  initial?: TdpJustificationInput;
  /** A representative (Part B): the name of the one whose place they take. The kind is then always
   * "In lieu of"; the reason and who identified them are still asked. */
  inLieuOf?: string;
  /** "Keep" in the participant picker (saved with the seminar), "Save" where it is saved at once. */
  saveLabel?: string;
  saving?: boolean;
  onSave: (value: TdpJustificationInput) => void;
  onCancel: () => void;
}

const KINDS: { kind: TdpExceptionKind; label: string; hint: string }[] = [
  { kind: "Designated", label: "Designated to do the tasks", hint: "a Special Order or committee designation" },
  { kind: "Identified by the Chief", label: "Identified by the Chief", hint: "the Chief or head of agency chose them, e.g. in lieu of someone on leave" },
  { kind: "Other", label: "Another reason", hint: "explain it below" }
];
const INPUT = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
const LABEL = "block text-[11px] font-semibold text-slate-700 mb-0.5";
const BUTTON = "rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export default function TdpJustificationForm({ employeeName, initial, inLieuOf, saveLabel = "Keep", saving = false, onSave, onCancel }: Props) {
  const id = useId();
  const [kind, setKind] = useState<TdpExceptionKind | "">(initial?.kind ?? "");
  const [committee, setCommittee] = useState<TdpCommittee | "">(initial?.committee ?? "");
  const [committeeOther, setCommitteeOther] = useState(initial?.committeeOther ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [name, setName] = useState(initial?.identifiedBy.name ?? "");
  const [position, setPosition] = useState(initial?.identifiedBy.position ?? "");
  const [referenceNo, setReferenceNo] = useState(initial?.referenceNo ?? "");
  const [referenceDate, setReferenceDate] = useState(initial?.referenceDate ?? "");
  const [problem, setProblem] = useState("");

  const submit = () => {
    const read = readTdpJustification(
      { kind, committee, committeeOther, reason, identifiedBy: { name, position }, referenceNo, referenceDate },
      getLocalTodayString(),
      { inLieu: inLieuOf !== undefined }
    );
    if ("problem" in read) {
      setProblem(read.problem);
      return;
    }
    setProblem("");
    onSave(read.value);
  };

  return (
    <fieldset className="mt-2 space-y-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs">
      <legend className="px-1 text-[11px] font-bold text-amber-900">
        {inLieuOf !== undefined
          ? <>Why is {employeeName} going in lieu of {inLieuOf}?</>
          : <>Why is {employeeName} seated? Their TDP doesn&rsquo;t list this training.</>}
      </legend>
      {inLieuOf !== undefined ? (
        <p className="text-slate-700"><span className="font-semibold text-slate-800">In lieu of {inLieuOf}</span>: a representative takes their place.</p>
      ) : (
        <div className="space-y-1">
          {KINDS.map((k, i) => (
            <label key={k.kind} className="flex cursor-pointer items-start gap-2">
              {/* The form opens where HR was working: focus moves to its first choice. */}
              <input type="radio" name={`${id}-kind`} className="mt-0.5" checked={kind === k.kind} onChange={() => setKind(k.kind)} autoFocus={i === 0} />
              <span>
                <span className="font-semibold text-slate-800">{k.label}</span>
                <span className="text-slate-500">: {k.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {kind === "Designated" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-committee`} className={LABEL}>Committee</label>
            <select id={`${id}-committee`} className={INPUT} value={committee} onChange={e => setCommittee(e.target.value as TdpCommittee | "")}>
              <option value="">Choose the committee…</option>
              {TDP_COMMITTEES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {committee === "Other" && (
            <div>
              <label htmlFor={`${id}-other`} className={LABEL}>Which committee</label>
              <input id={`${id}-other`} className={INPUT} value={committeeOther} maxLength={TDP_NAME_MAX} onChange={e => setCommitteeOther(e.target.value)} />
            </div>
          )}
        </div>
      )}
      <div>
        <label htmlFor={`${id}-reason`} className={LABEL}>Reason</label>
        {/* A representative's form opens on its reason, as the other one opens on its first choice. */}
        <textarea id={`${id}-reason`} className={INPUT} rows={2} value={reason} maxLength={TDP_REASON_MAX} onChange={e => setReason(e.target.value)} autoFocus={inLieuOf !== undefined} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={LABEL}>Identified by (name)</label>
          <input id={`${id}-name`} className={INPUT} value={name} maxLength={TDP_NAME_MAX} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-position`} className={LABEL}>Their position</label>
          <input id={`${id}-position`} className={INPUT} value={position} maxLength={TDP_NAME_MAX} onChange={e => setPosition(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-ref`} className={LABEL}>SO / Office Order No. (optional)</label>
          <input id={`${id}-ref`} className={INPUT} value={referenceNo} maxLength={TDP_REFERENCE_MAX} onChange={e => setReferenceNo(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-date`} className={LABEL}>Its date (optional)</label>
          <input id={`${id}-date`} type="date" className={INPUT} value={referenceDate} max={getLocalTodayString()} onChange={e => setReferenceDate(e.target.value)} />
        </div>
      </div>
      {problem && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-rose-800">{problem}</p>}
      <p className="text-[11px] text-slate-500">Only HR and the Administrator see this. The Administrator is notified.</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className={`${BUTTON} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`}>{saving ? "Saving…" : saveLabel}</button>
      </div>
    </fieldset>
  );
}
