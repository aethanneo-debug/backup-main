import { ReactNode, Ref } from "react";
import { Info, Scale } from "lucide-react";
import {
  TRAINING_NEED_CATEGORIES,
  TRAINING_NEED_COLUMN_LABELS,
  type NeedAdditionBasis,
  type TdpTrainingChoice,
  type TrainingNeedCategory,
  type TrainingPlanEmployee
} from "../../types";
import { existingNeedText, NEED_ADDITION_BASES, NEED_ADDITION_NOTE_MAX } from "../../tdpAdditions";
import { BADGE, TONE } from "./candidateBadges";

// Add Training Need's parts (12ad), out of AddTrainingNeedDialog.tsx to keep it short: the rows of its two lists, the
// column the need goes under, and why it is added. The dialog holds the state, and the rules that keep the column and
// the training in step.

/** Where a person already has a training this year (existingNeedFor's answer). */
export type ExistingNeed = Parameters<typeof existingNeedText>[0];

/** A problem with one part of the form, shown beside it and tied to its control. */
export interface PartProblem {
  id: string;
  text: string;
}

const LABEL = "block text-[11px] font-semibold text-slate-700";
const INPUT = "w-full rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100";
export const PROBLEM = "mt-1 text-[11px] font-semibold text-rose-700";
// "Any column" first: a filter that lists every training, not a column a need can go under.
const COLUMN_OPTIONS: (TrainingNeedCategory | null)[] = [null, ...TRAINING_NEED_CATEGORIES];

/** The required mark beside a label: a star on screen, the word for a screen reader. */
export function RequiredMark() {
  return (
    <>
      <span className="text-rose-600" aria-hidden="true"> *</span>
      <span className="sr-only"> (required)</span>
    </>
  );
}

/** A list with nothing to choose from: why, in its place. */
export function EmptyBox({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-500">{children}</p>;
}

/** "Function 3 · Additional Function 1 · Career Advancement 0", or "" while their plan this year holds nothing. */
export function planCounts(emp: TrainingPlanEmployee): string {
  const counts = TRAINING_NEED_CATEGORIES.map(c => [c, (emp.needs?.[c] ?? []).length] as const);
  return counts.some(([, n]) => n > 0) ? counts.map(([c, n]) => `${c} ${n}`).join(" · ") : "";
}

/** "Function and Career Advancement"; "Function, Additional Function and Career Advancement". */
/** Columns as the radios name them, quoted: "“Needed Training for the Function” and “…”". */
export const columnsText = (columns: TrainingNeedCategory[]) => {
  const names = columns.map(c => `“${TRAINING_NEED_COLUMN_LABELS[c]}”`);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

/** An employee's row: who they are, and whether their plan this year is empty (a new hire's is). */
export function EmployeeOption({ emp }: { emp: TrainingPlanEmployee }) {
  const where = [emp.position, emp.division].filter(Boolean).join(" · ");
  return (
    <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-800">{emp.fullName}</span>
        <span className="block text-[11px] text-slate-500">{where || "No position or division on file"}</span>
      </span>
      {!planCounts(emp) && <span className={`${BADGE} ${TONE.firstTraining} shrink-0`}>No needs yet</span>}
    </span>
  );
}

/** A training's row: its title as the chosen column spells it (the spelling stored), the columns the TDP lists it
 * under, the law that requires it, and, when the chosen employee already has it, where (it can't be chosen then). */
export function TrainingOption({ choice, column, existing }: {
  choice: TdpTrainingChoice;
  column: TrainingNeedCategory | null;
  existing: ExistingNeed | null;
}) {
  return (
    <>
      <span className={`block text-xs font-semibold leading-snug ${existing ? "text-slate-500" : "text-slate-800"}`}>
        {(column && choice.spellings[column]) || choice.title}
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1">
        {choice.categories.map(c => <span key={c} className={`${BADGE} ${TONE.neutral}`}>{c}</span>)}
        {/* The law or a rule requires it (12z Part D). */}
        {choice.mandate && (
          <span className={`${BADGE} ${TONE.mandated} inline-flex items-center gap-1`}>
            <Scale size={10} aria-hidden="true" /> Mandated: {choice.mandate.basis}
          </span>
        )}
      </span>
      {existing && <span className="mt-1 block text-[11px] text-slate-600">Already in their plan · {existingNeedText(existing)}</span>}
    </>
  );
}

interface ColumnProps {
  name: string;
  column: TrainingNeedCategory | null;
  /** The chosen training: the columns it is listed under are marked when there are several, or when none is chosen. */
  training: TdpTrainingChoice | null;
  /** What the last change did to the other ("… so it was cleared", "… so that column is chosen"). */
  syncNote: string;
  problem?: PartProblem;
  disabled: boolean;
  firstRef?: Ref<HTMLInputElement>;
  onChange: (column: TrainingNeedCategory | null) => void;
}

/** The column, as the official form names it. The training chosen never switches a column off: a column chosen first
 * lists its trainings (and clears one it doesn't list), so every column is always a way in. */
export function ColumnChoice({ name, column, training, syncNote, problem, disabled, firstRef, onChange }: ColumnProps) {
  // A training chosen with no column (listed under several, or "Any column" chosen since): HR says which.
  const ask = training && !column ? training.categories : null;
  const marked = training && (ask || training.categories.length > 1) ? training.categories : [];
  const line = ask
    ? ask.length > 1 ? `Listed under ${columnsText(ask)}: choose which column.` : `Listed only under ${columnsText(ask)}: choose that column.`
    : syncNote;
  return (
    <fieldset aria-describedby={problem?.id}>
      <legend className={LABEL}>Column<RequiredMark /></legend>
      <div className="mt-1 space-y-1">
        {COLUMN_OPTIONS.map((c, i) => (
          <label key={c ?? "any"} className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              ref={i === 0 ? firstRef : undefined}
              type="radio"
              name={name}
              className="mt-0.5 shrink-0"
              checked={column === c}
              disabled={disabled}
              onChange={() => onChange(c)}
            />
            <span className="min-w-0">
              {c ? (
                <span className="text-slate-800">{TRAINING_NEED_COLUMN_LABELS[c]}</span>
              ) : (
                <>
                  <span className="font-semibold text-slate-800">Any column</span>
                  <span className="text-slate-500">: lists every training; still choose a column</span>
                </>
              )}
              {c && marked.includes(c) && <span className={`${BADGE} ${TONE.needsThis} ml-1.5 inline-block`}>lists it</span>}
            </span>
          </label>
        ))}
      </div>
      {/* Read out as it changes: kept in the page while empty, so the first message is heard too. */}
      <p aria-live="polite" className={`mt-1 text-[11px] ${ask ? "font-semibold text-amber-800" : "text-slate-600"}`}>{line}</p>
      {problem && <p id={problem.id} role="alert" className={PROBLEM}>{problem.text}</p>}
    </fieldset>
  );
}

interface BasisProps {
  name: string;
  noteId: string;
  basis: NeedAdditionBasis | "";
  note: string;
  problem: (PartProblem & { at: "basis" | "note" }) | null;
  disabled: boolean;
  basisRef?: Ref<HTMLInputElement>;
  noteRef?: Ref<HTMLTextAreaElement>;
  onBasis: (basis: NeedAdditionBasis) => void;
  onNote: (note: string) => void;
}

/** Why the need is added, and a note: required for "another reason". The note stays out of the audit log and the
 * notices, as a justification's reason does (12z): it may mention someone's leave. */
export function BasisFields({ name, noteId, basis, note, problem, disabled, basisRef, noteRef, onBasis, onNote }: BasisProps) {
  const other = basis === "Other";
  return (
    <div className="space-y-2">
      <fieldset aria-describedby={problem?.at === "basis" ? problem.id : undefined}>
        <legend className={LABEL}>Why it is added<RequiredMark /></legend>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-5">
          {NEED_ADDITION_BASES.map((b, i) => (
            <label key={b.basis} className="flex cursor-pointer items-start gap-2 text-xs text-slate-800">
              <input
                ref={i === 0 ? basisRef : undefined}
                type="radio"
                name={name}
                className="mt-0.5 shrink-0"
                checked={basis === b.basis}
                disabled={disabled}
                onChange={() => onBasis(b.basis)}
              />
              {b.label}
            </label>
          ))}
        </div>
        {problem?.at === "basis" && <p id={problem.id} role="alert" className={PROBLEM}>{problem.text}</p>}
      </fieldset>
      <div>
        <label htmlFor={noteId} className={LABEL}>
          Note{other ? <RequiredMark /> : <span className="font-normal text-slate-500"> (optional)</span>}
        </label>
        <textarea
          id={noteId}
          ref={noteRef}
          rows={2}
          maxLength={NEED_ADDITION_NOTE_MAX}
          value={note}
          disabled={disabled}
          aria-describedby={[`${noteId}-hint`, problem?.at === "note" ? problem.id : ""].filter(Boolean).join(" ")}
          aria-invalid={problem?.at === "note" || undefined}
          onChange={e => onNote(e.target.value)}
          className={`${INPUT} mt-0.5 ${problem?.at === "note" ? "border-rose-400" : "border-slate-300"}`}
        />
        <p id={`${noteId}-hint`} className="mt-0.5 flex justify-between gap-3 text-[10px] text-slate-500">
          <span>
            {other ? "Required for another reason: say why they need it." : "An SO or Office Order number can go here."} Leave out
            anyone&rsquo;s health, leave or other personal details.
          </span>
          <span className="shrink-0 tabular-nums" aria-hidden="true">{note.length}/{NEED_ADDITION_NOTE_MAX}</span>
        </p>
        {problem?.at === "note" && <p id={problem.id} role="alert" className={PROBLEM}>{problem.text}</p>}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
        <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        HR and the Administrator are told; the note stays out of the audit log.
      </p>
    </div>
  );
}
