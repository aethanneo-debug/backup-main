import { SEMINAR_TDP_KINDS, type SeminarTdpJustificationInput, type SeminarTdpKind } from "../../types";
import { TDP_NAME_MAX, TDP_REASON_MAX, TDP_REFERENCE_MAX } from "../../tdpRules";
import { RequiredMark } from "../ui/RequiredMark";

// Why a training is held outside the TDP, as typed (HSAC RAB 1, 2026-10-28): the kind, the reason, who approved it, a
// reference optional. One set of fields for a seminar's own justification (12z Part C, SeminarTdpForm.tsx) and for a
// training need planned outside the TDP (12ae, AddOutsideTraining.tsx), whose justification a seminar for it starts
// from, so the two can't drift. Each form checks them with the server's own reader (readSeminarTdpJustification).
// Controlled: the form holds the values. `id` is the form's own base id: the kinds are radios named `${id}-kind`, the
// boxes `${id}-reason`, `${id}-name`, `${id}-position`, `${id}-ref` and `${id}-date`, as SeminarTdpForm has always had them.

/** The fields as typed. */
export interface SeminarTdpValues {
  kind: SeminarTdpKind | "";
  reason: string;
  name: string;
  position: string;
  referenceNo: string;
  referenceDate: string;
}
export type SeminarTdpField = keyof SeminarTdpValues;

/** The fields, empty or filled in from a justification (one on record, or a need's to start from). */
export function seminarTdpValues(j?: SeminarTdpJustificationInput | null): SeminarTdpValues {
  return {
    kind: j?.kind ?? "",
    reason: j?.reason ?? "",
    name: j?.approvedBy?.name ?? "",
    position: j?.approvedBy?.position ?? "",
    referenceNo: j?.referenceNo ?? "",
    referenceDate: j?.referenceDate ?? ""
  };
}

/** The fields in the shape the readers and the server take. */
export function seminarTdpRaw(v: SeminarTdpValues) {
  return { kind: v.kind, reason: v.reason, approvedBy: { name: v.name, position: v.position }, referenceNo: v.referenceNo, referenceDate: v.referenceDate };
}

/** The control a field is typed in, by its id: the radio of its kind for `kind` (the first when none is chosen). */
export function seminarTdpControlId(id: string, field: SeminarTdpField, kind: SeminarTdpKind | "" = ""): string {
  if (field === "kind") return `${id}-kind-${Math.max(0, SEMINAR_TDP_KINDS.indexOf(kind as SeminarTdpKind))}`;
  return `${id}-${{ reason: "reason", name: "name", position: "position", referenceNo: "ref", referenceDate: "date" }[field]}`;
}

const HINT: Record<SeminarTdpKind, string> = {
  "Central Office training": "a training the Central Office pays for or sends participants to",
  "Invitation from another agency": "another agency invited the office",
  "New law or issuance": "a law, circular or issuance that came after the plan",
  "Other": "explain it below"
};
const INPUT = "w-full rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100";
const LABEL = "block text-[11px] font-semibold text-slate-700 mb-0.5";

interface Props {
  /** The form's base id (useId): the fields' ids and the radios' name start with it. */
  id: string;
  values: SeminarTdpValues;
  onChange: (patch: Partial<SeminarTdpValues>) => void;
  /** Manila's day: a reference can't be dated later (the server checks the same). */
  today: string;
  disabled?: boolean;
  /** Mark the required fields (*, and "required" for a screen reader), in a form whose other fields are marked. */
  markRequired?: boolean;
  /** A problem with one field, shown under it and tied to its control. */
  problem?: { field: SeminarTdpField; id: string; text: string } | null;
}

export default function SeminarTdpFields({ id, values, onChange, today, disabled = false, markRequired = false, problem = null }: Props) {
  const req = markRequired ? <RequiredMark /> : null;
  const bad = (field: SeminarTdpField) => problem?.field === field;
  const describedBy = (field: SeminarTdpField, ...ids: string[]) => [...ids, bad(field) ? problem!.id : ""].filter(Boolean).join(" ") || undefined;
  const box = (field: SeminarTdpField) => `${INPUT} ${bad(field) ? "border-rose-400" : "border-slate-300"}`;
  const say = (field: SeminarTdpField) => (bad(field) ? <p id={problem!.id} role="alert" className="mt-1 text-[11px] font-semibold text-rose-700">{problem!.text}</p> : null);
  const off = disabled || undefined;

  return (
    <>
      <fieldset data-justify="kind" className="space-y-1" aria-describedby={describedBy("kind")}>
        <legend className={LABEL}>Why it is held{req}</legend>
        {SEMINAR_TDP_KINDS.map((k, i) => (
          <label key={k} className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              id={`${id}-kind-${i}`}
              name={`${id}-kind`}
              value={k}
              className="mt-0.5"
              checked={values.kind === k}
              disabled={off}
              onChange={() => onChange({ kind: k })}
            />
            <span><span className="font-semibold text-slate-800">{k === "Other" ? "Another reason" : k}</span><span className="text-slate-500">: {HINT[k]}</span></span>
          </label>
        ))}
        {say("kind")}
      </fieldset>
      <div>
        <label htmlFor={`${id}-reason`} className={LABEL}>Reason{req}</label>
        <textarea
          id={`${id}-reason`}
          data-justify="reason"
          aria-describedby={describedBy("reason", `${id}-reason-hint`)}
          aria-invalid={bad("reason") || undefined}
          className={box("reason")}
          rows={2}
          value={values.reason}
          maxLength={TDP_REASON_MAX}
          disabled={off}
          onChange={e => onChange({ reason: e.target.value })}
        />
        {/* About the training, so it never needs anyone's personal circumstances (RA 10173). */}
        <p id={`${id}-reason-hint`} className="mt-0.5 text-[10px] text-slate-500">Why the office holds it. Leave out anyone&rsquo;s health, leave or other personal details.</p>
        {say("reason")}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={LABEL}>Approved by (name){req}</label>
          <input id={`${id}-name`} data-justify="approver-name" aria-describedby={describedBy("name")} aria-invalid={bad("name") || undefined} className={box("name")} value={values.name} maxLength={TDP_NAME_MAX} disabled={off} onChange={e => onChange({ name: e.target.value })} />
          {say("name")}
        </div>
        <div>
          <label htmlFor={`${id}-position`} className={LABEL}>Their position{req}</label>
          <input id={`${id}-position`} data-justify="approver-position" aria-describedby={describedBy("position")} aria-invalid={bad("position") || undefined} className={box("position")} value={values.position} maxLength={TDP_NAME_MAX} disabled={off} onChange={e => onChange({ position: e.target.value })} />
          {say("position")}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-ref`} className={LABEL}>Memo, invitation or issuance No. (optional)</label>
          <input id={`${id}-ref`} data-justify="reference-no" aria-describedby={describedBy("referenceNo")} aria-invalid={bad("referenceNo") || undefined} className={box("referenceNo")} value={values.referenceNo} maxLength={TDP_REFERENCE_MAX} disabled={off} onChange={e => onChange({ referenceNo: e.target.value })} />
          {say("referenceNo")}
        </div>
        <div>
          <label htmlFor={`${id}-date`} className={LABEL}>Its date (optional)</label>
          <input id={`${id}-date`} data-justify="reference-date" type="date" aria-describedby={describedBy("referenceDate")} aria-invalid={bad("referenceDate") || undefined} className={box("referenceDate")} value={values.referenceDate} max={today} disabled={off} onChange={e => onChange({ referenceDate: e.target.value })} />
          {say("referenceDate")}
        </div>
      </div>
    </>
  );
}
