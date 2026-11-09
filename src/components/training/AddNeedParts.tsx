import { ReactNode, Ref, useId, useState } from "react";
import { AlertTriangle, Info, Scale } from "lucide-react";
import {
  TRAINING_NEED_CATEGORIES,
  TRAINING_NEED_COLUMN_LABELS,
  type NeedAdditionBasis,
  type TdpTrainingChoice,
  type TrainingNeedCategory,
  type TrainingPlanEmployee
} from "../../types";
import { existingNeedText, NEED_ADDITION_BASES, NEED_ADDITION_NOTE_MAX, type ExistingNeed } from "../../tdpAdditions";
import { RequiredMark } from "../ui/RequiredMark";
import { BADGE, TONE } from "./candidateBadges";

// Add Training Need's parts (12ad), out of AddTrainingNeedDialog.tsx to keep it short: the rows of its two lists, the
// column filter over the trainings, and why the needs are added. What is ticked, and what the save will do, are in
// AddNeedSelection.tsx. The dialog holds the state and the rules (src/tdpAdditions.ts).

/** A problem with one part of the form, shown beside it and tied to its control. */
export interface PartProblem {
  id: string;
  text: string;
}

const LABEL = "block text-[11px] font-semibold text-slate-700";
const INPUT = "w-full rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100";
export const PROBLEM = "mt-1 text-[11px] font-semibold text-rose-700";
// "Any column" first: it lists every training.
const COLUMN_OPTIONS: (TrainingNeedCategory | null)[] = [null, ...TRAINING_NEED_CATEGORIES];

// The required mark beside a label, shared since the training outside the TDP came (12ae).
export { RequiredMark };

/** A list with nothing to choose from: why, in its place. */
export function EmptyBox({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-500">{children}</p>;
}

/** "Function 3 · Additional Function 1 · Career Advancement 0", or "" while their plan this year holds nothing. */
export function planCounts(emp: TrainingPlanEmployee): string {
  const counts = TRAINING_NEED_CATEGORIES.map(c => [c, (emp.needs?.[c] ?? []).length] as const);
  return counts.some(([, n]) => n > 0) ? counts.map(([c, n]) => `${c} ${n}`).join(" · ") : "";
}

/** Columns as the official form names them, quoted: "“Needed Training for the Function” and “…”". */
export const columnsText = (columns: TrainingNeedCategory[]) => {
  const names = columns.map(c => `“${TRAINING_NEED_COLUMN_LABELS[c]}”`);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

/** How many of the ticked employees already have a training this year, and the first one's name and where. */
export interface TrainingHave {
  n: number;
  of: number;
  first: { name: string; existing: ExistingNeed } | null;
}

/** How many of the ticked employees already have each training. `existingOf` answers for one person and training
 * (existingNeedFor over their needs this year). */
export function haveByTraining(
  trainings: TdpTrainingChoice[],
  people: TrainingPlanEmployee[],
  existingOf: (employeeId: string, key: string) => ExistingNeed | null
): Map<string, TrainingHave> {
  const map = new Map<string, TrainingHave>();
  for (const c of trainings) {
    let n = 0;
    let first: TrainingHave["first"] = null;
    for (const e of people) {
      const existing = existingOf(e.employeeId, c.key);
      if (!existing) continue;
      n++;
      first ??= { name: e.fullName, existing };
    }
    map.set(c.key, { n, of: people.length, first });
  }
  return map;
}

/** "Already in the plan of 2 of 3 ticked employees", or "" while none of them has it. */
export function haveText(have: TrainingHave): string {
  if (have.n === 0) return "";
  if (have.of === 1 && have.first) return `Already in ${have.first.name}’s plan (${existingNeedText(have.first.existing)}).`;
  return have.n === have.of ? `Already in the plan of all ${have.of} ticked employees.` : `Already in the plan of ${have.n} of ${have.of} ticked employees.`;
}

/** The two ways a training comes in (12ae): one of the uploaded TDP's own, or one it doesn't list. */
export type AddMode = "tdp" | "outside";

const MODES: [AddMode, string, string][] = [
  ["tdp", "From the TDP", "From the TDP: tick the employees and the TDP's own trainings, and say why they are added."],
  ["outside", "Not in the TDP", "Not in the TDP: tick the employees, type the training, choose its column, and say why it is held."]
];

/** Which way the training comes in: two fixed options, the one on highlighted and pressed, as the participant picker's
 * Plan A switch. What is ticked and typed in each way stays when switching. */
export function AddModeSwitch({ mode, disabled, onChange }: { mode: AddMode; disabled: boolean; onChange: (mode: AddMode) => void }) {
  const labelId = useId();
  // What a switch brings, read out (only after a switch: nothing is said on opening).
  const [said, setSaid] = useState("");
  return (
    <div data-tdp="add-mode" className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span id={labelId} className={LABEL}>The training is</span>
      <div role="group" aria-labelledby={labelId} className="inline-flex rounded-lg border border-blue-200 bg-white p-0.5">
        {MODES.map(([which, label, note]) => (
          <button
            key={which}
            type="button"
            data-add-mode={which}
            aria-pressed={mode === which}
            disabled={disabled}
            onClick={() => {
              if (mode !== which) setSaid(note);
              onChange(which);
            }}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
              mode === which ? "bg-blue-600 text-white" : "text-blue-700 hover:bg-blue-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="sr-only">{said}</p>
    </div>
  );
}

/** What the dialog is for in each way, and where the TDP's trainings come from when its own list wasn't kept. */
export function AddNeedIntro({ fiscalYear, choicesFrom, mode = "tdp" }: { fiscalYear: string; choicesFrom?: "tdp" | "plan" | null; mode?: AddMode }) {
  if (mode === "outside") {
    return (
      <p data-outside="intro" className="text-[11px] text-slate-500">
        A training the uploaded TDP doesn&rsquo;t list, such as one on a new law or a Central Office training, is planned and
        tracked in Plan A for every ticked employee who doesn&rsquo;t have it yet, marked &ldquo;Outside the TDP&rdquo;. The TDP
        doesn&rsquo;t identify anyone by it: a seminar for it is held with its own justification, filled in from this one.
      </p>
    );
  }
  return (
    <>
      <p className="text-[11px] text-slate-500">
        Give employees the TDP doesn&rsquo;t list, such as those hired or designated after it was approved, some of its own
        trainings. Every ticked employee gets every ticked training they don&rsquo;t have yet. Each counts as their Plan A need:
        Monitoring tracks it, and they are listed for the seminars that cover it with no justification needed.
      </p>
      {/* A TDP uploaded before its list of trainings was kept (12ad): the server offers the year's plan instead, which may
          hold trainings carried from last year that this TDP dropped. Said, with the way to the exact list. */}
      {choicesFrom === "plan" && (
        <p data-tdp="choices-from-plan" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            This TDP was uploaded before its list of trainings was kept, so the trainings below come from the FY {fiscalYear} plan,
            needs carried from last year included. To offer exactly the TDP&rsquo;s own trainings, replace it once with the same
            workbook.
          </span>
        </p>
      )}
    </>
  );
}

/** An employee's row: who they are, whether their plan this year is empty (a new hire's is), and how many of the ticked
 * trainings it already holds (those are skipped for them). `note`, in its place: what the typed training outside the
 * TDP is to them (12ae). */
export function EmployeeOption({ emp, has, note }: { emp: TrainingPlanEmployee; has?: { n: number; of: number }; note?: string }) {
  const where = [emp.position, emp.division].filter(Boolean).join(" · ");
  return (
    <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
      <span className="min-w-0">
        <span className="block break-words text-xs font-semibold text-slate-800">{emp.fullName}</span>
        <span className="block break-words text-[11px] text-slate-500">{where || "No position or division on file"}</span>
        {note ? <span className="mt-0.5 block text-[11px] text-slate-600">{note}</span> : has && has.n > 0 && (
          <span className="mt-0.5 block text-[11px] text-slate-600">
            {has.n < has.of ? `Already has ${has.n} of the ${has.of} ticked trainings.`
              : has.of === 1 ? "Already has the ticked training." : `Already has all ${has.of} ticked trainings.`}
          </span>
        )}
      </span>
      {!planCounts(emp) && <span className={`${BADGE} ${TONE.firstTraining} shrink-0`}>No needs yet</span>}
    </span>
  );
}

/** A training's row: its title as the filter's column spells it, the columns the TDP lists it under, the law that
 * requires it, and how many of the ticked employees already have it. Every one of them: it can't be ticked (or, ticked
 * before they were, it adds nothing). */
export function TrainingOption({ choice, filter, have, ticked, tickedColumn = null }: {
  choice: TdpTrainingChoice;
  filter: TrainingNeedCategory | null;
  have: TrainingHave | null;
  ticked: boolean;
  /** The column it was ticked under, when ticked: its spelling there is the one stored, whatever the filter shows. */
  tickedColumn?: TrainingNeedCategory | null;
}) {
  const everyone = !!have && have.of > 0 && have.n === have.of;
  const text = have ? haveText(have) : "";
  // Ticked under another of its columns than the filter shows: said, so the row's spelling isn't taken for the column.
  const elsewhere = ticked && tickedColumn && filter && tickedColumn !== filter ? tickedColumn : null;
  return (
    <>
      <span className={`block break-words text-xs font-semibold leading-snug ${everyone && !ticked ? "text-slate-500" : "text-slate-800"}`}>
        {(tickedColumn && choice.spellings[tickedColumn]) || (filter && choice.spellings[filter]) || choice.title}
      </span>
      {elsewhere && <span className="mt-0.5 block text-[11px] text-slate-600">Ticked under {columnsText([elsewhere])}.</span>}
      <span className="mt-1 flex flex-wrap items-center gap-1">
        {choice.categories.map(c => <span key={c} className={`${BADGE} ${TONE.neutral}`}>{c}</span>)}
        {/* The law or a rule requires it (12z Part D). */}
        {choice.mandate && (
          <span className={`${BADGE} ${TONE.mandated} inline-flex items-center gap-1`}>
            <Scale size={10} aria-hidden="true" /> Mandated: {choice.mandate.basis}
          </span>
        )}
      </span>
      {text && (
        <span className={`mt-1 block text-[11px] ${everyone && ticked ? "font-semibold text-amber-800" : "text-slate-600"}`}>
          {text}{everyone && ticked ? " It adds nothing." : ""}
        </span>
      )}
    </>
  );
}

interface FilterProps {
  name: string;
  filter: TrainingNeedCategory | null;
  /** How many trainings the TDP lists under each column, and in all. */
  counts: Record<TrainingNeedCategory, number>;
  total: number;
  disabled: boolean;
  onChange: (filter: TrainingNeedCategory | null) => void;
}

/** Which trainings the list shows, by the official form's columns. Only a filter (the user's decision of 2026-11-09):
 * what is ticked stays ticked, under its own column, whatever it shows. */
export function ColumnChoice({ name, filter, counts, total, disabled, onChange }: FilterProps) {
  return (
    <fieldset data-tdp="column-filter" aria-describedby={`${name}-hint`}>
      <legend className={LABEL}>Show trainings under</legend>
      <p id={`${name}-hint`} className="text-[11px] text-slate-500">Only filters the list: what is ticked stays ticked, under its own column.</p>
      <div className="mt-1 space-y-1">
        {COLUMN_OPTIONS.map(c => (
          <label key={c ?? "any"} className="flex cursor-pointer items-start gap-2 text-xs text-slate-800">
            <input
              type="radio"
              name={name}
              className="mt-0.5 shrink-0 accent-blue-600"
              checked={filter === c}
              disabled={disabled}
              onChange={() => onChange(c)}
            />
            {/* Each label starts with the column's own words. */}
            <span className="min-w-0">
              {c ? TRAINING_NEED_COLUMN_LABELS[c] : <span className="font-semibold">Any column</span>}
              <span className="text-slate-500 tabular-nums"> ({c ? counts[c] : total}<span className="sr-only"> trainings</span>)</span>
            </span>
          </label>
        ))}
      </div>
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

/** Why the needs are added, and a note: required for "another reason". One of each for the whole save (the user's
 * decision of 2026-11-09). The note stays out of the audit log and the notices, as a justification's reason does (12z):
 * it may mention someone's leave. */
export function BasisFields({ name, noteId, basis, note, problem, disabled, basisRef, noteRef, onBasis, onNote }: BasisProps) {
  const other = basis === "Other";
  return (
    <div className="space-y-2">
      <fieldset aria-describedby={[`${name}-scope`, problem?.at === "basis" ? problem.id : ""].filter(Boolean).join(" ")}>
        <legend className={LABEL}>Why they are added<RequiredMark /></legend>
        <p id={`${name}-scope`} data-tdp="basis-scope" className="text-[11px] text-slate-500">
          One basis and one note for every need in this save. Employees added for different reasons go in separate saves.
        </p>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-5">
          {NEED_ADDITION_BASES.map((b, i) => (
            <label key={b.basis} className="flex cursor-pointer items-start gap-2 text-xs text-slate-800">
              <input
                ref={i === 0 ? basisRef : undefined}
                type="radio"
                name={name}
                className="mt-0.5 shrink-0 accent-blue-600"
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
            {other ? "Required for another reason: say why they need these trainings." : "An SO or Office Order number can go here."} Leave
            out anyone&rsquo;s health, leave or other personal details.
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
