import { useEffect, useId, useRef, type ReactNode, type Ref, type RefObject } from "react";
import { AlertTriangle, ListChecks, X } from "lucide-react";
import { TRAINING_NEED_COLUMN_LABELS, type TdpTrainingChoice, type TrainingNeedCategory, type TrainingPlanEmployee } from "../../types";
import {
  existingNeedText, NEED_ADDITION_MAX_EMPLOYEES, NEED_ADDITION_MAX_NEEDS, NEED_ADDITION_MAX_TRAININGS, type NeedAdditionSkip
} from "../../tdpAdditions";
import { columnsText, PROBLEM, type PartProblem } from "./AddNeedParts";

// Add Training Need's selection (12ad; several employees and several trainings in one save since the user's request of
// 2026-11-09): what is ticked, under each list, and what the save will do, above the footer. Every ticked employee gets
// every ticked training, less what each already has, which is skipped and said. The dialog holds the state and the rules
// (src/tdpAdditions.ts); these draw them.

/** A ticked training, as the dialog works it out against the TDP's list as loaded. */
export interface TickedTraining {
  choice: TdpTrainingChoice;
  /** The column it goes under; null while HR hasn't chosen among the several the TDP lists it under. */
  column: TrainingNeedCategory | null;
  /** Every ticked employee already has it, so it adds nothing. */
  addsNothing: boolean;
}

/** One ticked employee's skipped trainings, and where each already is in their plan. */
export interface SkippedGroup {
  employeeId: string;
  name: string;
  items: { key: string; title: string; where: string }[];
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Read out again when the words repeat (a tick, an untick, the same tick again): a live region only speaks on a change,
// so the same words come back with a no-break space after them.
const NBSP = String.fromCharCode(0xa0);
export const again = (text: string) => (prev: string) => (prev === text ? text + NBSP : text);

/** The title as its column stores it (the TDP's spelling there), else its first spelling. */
export const trainingTitle = (choice: TdpTrainingChoice, column: TrainingNeedCategory | null) =>
  (column && choice.spellings[column]) || choice.title;

/** Where a training just ticked goes, read out (and shown under the list). */
export function whereText(choice: TdpTrainingChoice, column: TrainingNeedCategory | null): string {
  const title = `“${trainingTitle(choice, column)}”`;
  if (!column) return `${title} is listed under ${columnsText(choice.categories)}: choose its column below.`;
  const others = choice.categories.filter(c => c !== column);
  return `${title} goes under ${columnsText([column])}.${others.length ? ` It is also listed under ${columnsText(others)}: switch it below if needed.` : ""}`;
}

/** Over the most one save takes, as the server counts it (every pair, skipped ones included), said; else null. */
export function capText(employees: number, trainings: number): string | null {
  if (employees > NEED_ADDITION_MAX_EMPLOYEES) return `Tick at most ${NEED_ADDITION_MAX_EMPLOYEES} employees in one save; ${employees} are ticked.`;
  if (trainings > NEED_ADDITION_MAX_TRAININGS) return `Tick at most ${NEED_ADDITION_MAX_TRAININGS} trainings in one save; ${trainings} are ticked.`;
  const pairs = employees * trainings;
  return pairs > NEED_ADDITION_MAX_NEEDS
    ? `${plural(employees, "employee")} × ${plural(trainings, "training")} is ${pairs} needs in one save, skipped ones included; the most is ${NEED_ADDITION_MAX_NEEDS}. Untick some employees or trainings.`
    : null;
}

/** The pairs a save skips (additionPairs), by employee in the order ticked, with where each already is in their plan. */
export function skippedGroups(
  skip: NeedAdditionSkip[],
  nameOf: (employeeId: string) => string,
  titleOf: (key: string, stored: string) => string
): SkippedGroup[] {
  const groups: SkippedGroup[] = [];
  for (const s of skip) {
    let group = groups[groups.length - 1];
    if (!group || group.employeeId !== s.employeeId) {
      group = { employeeId: s.employeeId, name: nameOf(s.employeeId), items: [] };
      groups.push(group);
    }
    group.items.push({ key: s.key, title: titleOf(s.key, s.title), where: existingNeedText(s.existing) });
  }
  return groups;
}

const BOX = "rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2";
const NONE = "mt-1 text-[11px] text-slate-500";
const UNTICK = "shrink-0 cursor-pointer rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

/** After an untick, the focus goes to the untick button now in its place (the next one), else to the list's search box,
 * rather than to the page. */
function useRefocusAfterUntick(listRef: RefObject<HTMLUListElement | null>, focusSearch: () => void) {
  const at = useRef<number | null>(null);
  useEffect(() => {
    const i = at.current;
    if (i === null) return;
    at.current = null;
    const next = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-tdp="untick"]')[i];
    if (next) next.focus();
    else focusSearch();
  });
  return at;
}

function TickedHeading({ id, title, count, clearHook, clearName, disabled, onClear }: {
  id: string;
  title: string;
  count: number;
  clearHook: string;
  clearName: string;
  disabled: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 id={id} className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
        {title}{" "}
        <span className="ml-0.5 rounded-full border border-slate-200 bg-white px-1.5 font-semibold tabular-nums tracking-normal text-slate-600">{count}</span>
      </h3>
      {count > 0 && (
        <button
          type="button"
          data-tdp={clearHook}
          onClick={onClear}
          disabled={disabled}
          className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear<span className="sr-only"> {clearName}</span>
        </button>
      )}
    </div>
  );
}

/** The ticked employees, under their list: each with an untick button, and Clear. */
export function TickedEmployees({ people, gone, disabled, problem, onUntick, onClear, focusSearch }: {
  people: TrainingPlanEmployee[];
  /** Ticked, but no longer on the list since it reloaded (e.g. they left the office meanwhile): left out. */
  gone: number;
  disabled: boolean;
  problem?: PartProblem;
  onUntick: (emp: TrainingPlanEmployee) => void;
  onClear: () => void;
  focusSearch: () => void;
}) {
  const headingId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const refocus = useRefocusAfterUntick(listRef, focusSearch);
  return (
    <section data-tdp="ticked-employees" aria-labelledby={headingId} className={BOX}>
      <TickedHeading
        id={headingId}
        title="Ticked employees"
        count={people.length}
        clearHook="clear-employees"
        clearName="the ticked employees"
        disabled={disabled}
        onClear={() => { onClear(); focusSearch(); }}
      />
      {people.length === 0 ? (
        <p className={NONE}>None yet: tick the employees whose plans get the trainings.</p>
      ) : (
        <ul ref={listRef} aria-labelledby={headingId} className="mt-1.5 flex flex-wrap gap-1.5">
          {people.map((emp, i) => (
            <li
              key={emp.employeeId}
              data-employee-id={emp.employeeId}
              title={[emp.position, emp.division].filter(Boolean).join(" · ") || undefined}
              className="inline-flex min-w-0 max-w-full items-center gap-0.5 rounded-lg border border-blue-200 bg-white py-0.5 pl-2 pr-0.5 text-[11px] font-medium text-slate-800"
            >
              <span className="min-w-0 break-words">{emp.fullName}</span>
              <button
                type="button"
                data-tdp="untick"
                aria-label={`Untick ${emp.fullName}`}
                disabled={disabled}
                onClick={() => { refocus.current = i; onUntick(emp); }}
                className={UNTICK}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Read out when a reload drops a tick (kept in the page while empty, so the first message is heard). */}
      <div aria-live="polite">
        {gone > 0 && (
          <p className="mt-1 text-[11px] text-amber-800">
            {gone === 1 ? "1 ticked employee is" : `${gone} ticked employees are`} no longer on the list since it reloaded, and left out.
          </p>
        )}
      </div>
      {problem && <p id={problem.id} role="alert" className={PROBLEM}>{problem.text}</p>}
    </section>
  );
}

/** The ticked trainings, under their list: each with its column (fixed when the TDP lists it under one, else chosen among
 * its own), an untick button, and Clear. Add waits until each has a column. */
export function TickedTrainings({ ticked, gone, disabled, problem, onColumn, onUntick, onClear, focusSearch }: {
  ticked: TickedTraining[];
  /** Ticked, but no longer in the TDP's list since it reloaded (the TDP was replaced meanwhile): left out. */
  gone: number;
  disabled: boolean;
  problem?: PartProblem;
  onColumn: (choice: TdpTrainingChoice, column: TrainingNeedCategory) => void;
  onUntick: (choice: TdpTrainingChoice) => void;
  onClear: () => void;
  focusSearch: () => void;
}) {
  const uid = useId();
  const headingId = `${uid}-heading`;
  const listRef = useRef<HTMLUListElement>(null);
  const refocus = useRefocusAfterUntick(listRef, focusSearch);
  return (
    <section data-tdp="ticked-trainings" aria-labelledby={headingId} className={BOX}>
      <TickedHeading
        id={headingId}
        title="Ticked trainings"
        count={ticked.length}
        clearHook="clear-trainings"
        clearName="the ticked trainings"
        disabled={disabled}
        onClear={() => { onClear(); focusSearch(); }}
      />
      {ticked.length === 0 ? (
        <p className={NONE}>None yet: tick the trainings each ticked employee gets.</p>
      ) : (
        <ul ref={listRef} aria-labelledby={headingId} className="mt-1.5 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {ticked.map(({ choice, column, addsNothing }, i) => {
            const title = trainingTitle(choice, column);
            const askId = `${uid}-ask-${i}`;
            return (
              <li key={choice.key} data-training-key={choice.key} className="px-2.5 py-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-xs font-semibold leading-snug text-slate-800">{title}</p>
                    {choice.categories.length === 1 ? (
                      <p className="mt-0.5 break-words text-[11px] text-slate-600">
                        <span className="text-slate-500">Column:</span> {TRAINING_NEED_COLUMN_LABELS[choice.categories[0]]}
                      </p>
                    ) : (
                      <div className="mt-1">
                        {/* Only the columns the TDP lists it under: the "lists it" marks of the single version. */}
                        <select
                          data-tdp="ticked-column"
                          aria-label={`Column for “${title}”`}
                          aria-describedby={column ? undefined : askId}
                          aria-required="true"
                          value={column ?? ""}
                          disabled={disabled}
                          onChange={e => onColumn(choice, e.target.value as TrainingNeedCategory)}
                          className={`w-full min-w-0 max-w-full cursor-pointer rounded-lg border px-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 sm:w-auto ${
                            column ? "border-slate-300 bg-white" : "border-amber-400 bg-amber-50"
                          }`}
                        >
                          {!column && <option value="" disabled>Choose the column</option>}
                          {choice.categories.map(c => <option key={c} value={c}>{TRAINING_NEED_COLUMN_LABELS[c]}</option>)}
                        </select>
                        {!column && (
                          <p id={askId} className="mt-0.5 text-[11px] font-semibold text-amber-800">
                            Listed under {columnsText(choice.categories)}: choose which column.
                          </p>
                        )}
                      </div>
                    )}
                    {addsNothing && (
                      <p className="mt-0.5 text-[11px] font-semibold text-amber-800">Every ticked employee already has it: it adds nothing.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    data-tdp="untick"
                    aria-label={`Untick “${title}”`}
                    disabled={disabled}
                    onClick={() => { refocus.current = i; onUntick(choice); }}
                    className={UNTICK}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div aria-live="polite">
        {gone > 0 && (
          <p className="mt-1 text-[11px] text-amber-800">
            {gone === 1 ? "1 ticked training is" : `${gone} ticked trainings are`} no longer in the TDP&rsquo;s list since it reloaded, and left out.
          </p>
        )}
      </div>
      {problem && <p id={problem.id} role="alert" className={PROBLEM}>{problem.text}</p>}
    </section>
  );
}

/** What the save will do, above the footer: how many needs for how many employees, what is skipped and why, and what
 * still keeps Add off (a column to choose, the most one save takes). */
export function AddPreview({ id, employees, trainings, add, forEmployees, skipped, missingColumns, cap, problem, previewRef }: {
  id: string;
  /** Ticked: employees and trainings. */
  employees: number;
  trainings: number;
  /** Needs it adds, and for how many employees. */
  add: number;
  forEmployees: number;
  skipped: SkippedGroup[];
  /** Ticked trainings still without a column. */
  missingColumns: string[];
  /** Over the most one save takes, said; else null. */
  cap: string | null;
  problem?: PartProblem;
  previewRef?: RefObject<HTMLElement | null>;
}) {
  const skips = skipped.reduce((n, g) => n + g.items.length, 0);
  const ticks = employees > 0 && trainings > 0;
  const headline: ReactNode = !ticks
    ? employees === 0 && trainings === 0 ? "Nothing ticked yet: tick at least one employee and one training."
      : employees === 0 ? "Tick at least one employee: each gets every ticked training."
      : "Tick at least one training: each goes to every ticked employee."
    : add === 0 ? "Nothing to add: every ticked employee already has every ticked training."
    : <>Adds {plural(add, "need")} for {plural(forEmployees, "employee")}.</>;
  return (
    <section
      ref={previewRef}
      id={id}
      tabIndex={-1}
      data-tdp="add-preview"
      aria-labelledby={`${id}-heading`}
      className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <h3 id={`${id}-heading`} className="text-[11px] font-bold uppercase tracking-wider text-slate-600">This save</h3>
      <p
        id={`${id}-count`}
        data-tdp="preview-count"
        className={`flex items-start gap-2 text-xs font-semibold ${ticks && add > 0 ? "text-slate-800" : ticks ? "text-amber-800" : "text-slate-500"}`}
      >
        <ListChecks size={14} className={`mt-0.5 shrink-0 ${ticks && add > 0 ? "text-blue-600" : ""}`} aria-hidden="true" />
        <span className="min-w-0">{headline}</span>
      </p>
      {ticks && (
        <p className="pl-[22px] text-[11px] text-slate-600">
          {plural(employees, "employee")} &times; {plural(trainings, "training")} = {employees * trainings}
          {skips > 0 ? `, less ${skips} already in their plan` : ""}.
        </p>
      )}
      {missingColumns.length > 0 && (
        <p id={`${id}-columns`} data-tdp="preview-columns" className="flex items-start gap-2 text-[11px] font-semibold text-amber-800">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">
            Choose the column for {missingColumns.map(t => `“${t}”`).join(", ")} under Ticked trainings first.
          </span>
        </p>
      )}
      {cap && (
        <p id={`${id}-cap`} data-tdp="preview-cap" className="flex items-start gap-2 text-[11px] font-semibold text-rose-700">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{cap}</span>
        </p>
      )}
      <SkippedList skipped={skipped} trainings={trainings} listProps={{ "data-tdp": "preview-skipped" }} />
      {problem && <p id={problem.id} role="alert" className={PROBLEM}>{problem.text}</p>}
    </section>
  );
}

/** Who a save skips, by employee, and where each already has the training: under each way's "This save" (12ad, 12ae).
 * `trainings`: how many are ticked, so one who has them all is said so. `listProps`: the list's test hook. */
export function SkippedList({ skipped, trainings, listProps }: { skipped: SkippedGroup[]; trainings: number; listProps?: Record<string, string> }) {
  const skips = skipped.reduce((n, g) => n + g.items.length, 0);
  if (skips === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-700">{skips} skipped, already in their plan:</p>
      <ul {...listProps} className="custom-scrollbar mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
        {skipped.map(g => (
          <li key={g.employeeId} data-employee-id={g.employeeId} className="break-words text-[11px] text-slate-700">
            <span className="font-semibold text-slate-800">{g.name}</span>{" "}
            {g.items.length === trainings && trainings > 1 ? "already has every ticked training: " : "already has "}
            {g.items.map((s, i) => (
              <span key={s.key}>
                {i > 0 ? "; " : ""}&ldquo;{s.title}&rdquo; <span className="text-slate-500">({s.where})</span>
              </span>
            ))}
            .
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The server's refusal, under the form, with what was ticked and typed still there. It takes the focus (Add was off
 * while it was on its way). */
export function RefusalBox({ text, boxRef }: { text: string; boxRef: Ref<HTMLParagraphElement> }) {
  if (!text) return null;
  return (
    <p ref={boxRef} tabIndex={-1} role="alert" data-add-refusal className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 focus:outline-none">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}
