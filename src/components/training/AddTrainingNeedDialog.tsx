import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ListPlus } from "lucide-react";
import {
  TRAINING_NEED_CATEGORIES,
  type NeedAdditionBasis,
  type TdpTrainingChoice,
  type TrainingNeedCategory,
  type TrainingPlanEmployee
} from "../../types";
import { additionPairs, choicesUnder, columnForTraining, existingNeedFor, readNeedAdditions, type ExistingNeed } from "../../tdpAdditions";
import { apiCall } from "../../utils";
import ModalDialog from "../ui/ModalDialog";
import AddNeedEmployees from "./AddNeedEmployees";
import { AddModeSwitch, AddNeedIntro, BasisFields, EmployeeOption, haveByTraining, type AddMode } from "./AddNeedParts";
import { AddPreview, again, capText, plural, RefusalBox, skippedGroups, trainingTitle, whereText, type TickedTraining } from "./AddNeedSelection";
import { OutsideBelow, OutsideSubmit, OutsideTrainingPart, useOutsideTraining } from "./AddOutsideTraining";
import { columnOnSwitch } from "./outsideTraining";
import TdpTrainingsColumn from "./TdpTrainingsColumn";

// "Add Training Need" (the user's requests of 2026-11-08 and 2026-11-09, known-issues 12ad). The TDP is uploaded once a
// year and Plan A is read-only, so people hired or designated after the upload had no needs. HR or the Administrator
// ticks several employees and several of the uploaded TDP's own trainings, and says why: every ticked employee gets every
// ticked training, each under a column where the TDP lists it, less what each already has, which is skipped and said
// (the user's decisions: the column is only a filter over the list; duplicates are skipped and the rest added; one basis
// and one note for the save). Checked with the server's own rules before it is sent; a refusal stays here, with what was
// ticked and typed. A second way (12ae): a training the TDP doesn't list, typed in with why it is held
// (AddOutsideTraining.tsx). The ticked employees are the same in both, and what each way holds stays when switching.
interface Props {
  fiscalYear: string;
  /** Everyone still with the office, needs or not, in the plan's order. */
  employees: TrainingPlanEmployee[];
  /** The uploaded TDP's own trainings. */
  choices: TdpTrainingChoice[];
  /** Where they come from: the TDP's own list, or, for a TDP uploaded before its list was kept, the year's plan standing in
   * for it (carried needs included), which the dialog says. */
  choicesFrom?: "tdp" | "plan" | null;
  onClose: () => void;
  /** After the server added them, with its own account of it. */
  onSaved: (message: string) => void;
  /** After a refusal: the plan may have changed meanwhile (another officer added the same needs), so the page reloads it
   * and the lists show it as it is now. */
  onRefused?: () => void;
}

type Part = "employees" | "trainings" | "preview" | "basis" | "note";

const BUTTON = "rounded-lg px-4 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export default function AddTrainingNeedDialog({ fiscalYear, employees, choices, choicesFrom, onClose, onSaved, onRefused }: Props) {
  const id = useId();
  const problemId = `${id}-problem`;
  const previewId = `${id}-preview`;
  // In the order ticked, which the ticked lists and the save keep.
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [ticked, setTicked] = useState<{ key: string; column: TrainingNeedCategory | null }[]>([]);
  const [filter, setFilter] = useState<TrainingNeedCategory | null>(null);
  const [basis, setBasis] = useState<NeedAdditionBasis | "">("");
  const [note, setNote] = useState("");
  // What the last tick did: an employee's for screen readers (the count line shows it), a training's on screen too.
  const [employeeNote, setEmployeeNote] = useState("");
  const [trainingNote, setTrainingNote] = useState({ key: "", text: "" });
  // The form's own check, beside the part it is about; the server's refusal, under the form.
  const [problem, setProblem] = useState<{ at: Part; text: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const employeeRef = useRef<HTMLInputElement>(null);
  const trainingRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const basisRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  // A refusal: the Add button was off while it was on its way, so the focus goes to the reason rather than the page.
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [focusError, setFocusError] = useState(0);
  useEffect(() => {
    if (focusError) errorRef.current?.focus();
  }, [focusError]);

  const people = useMemo(() => employees ?? [], [employees]);
  const trainings = useMemo(() => (choices ?? []).filter(c => c && (c.categories ?? []).length > 0), [choices]);
  const personById = useMemo(() => new Map(people.map(e => [e.employeeId, e])), [people]);
  const choiceByKey = useMemo(() => new Map(trainings.map(c => [c.key, c])), [trainings]);
  const counts = useMemo(
    () => Object.fromEntries(TRAINING_NEED_CATEGORIES.map(c => [c, choicesUnder(trainings, c).length])) as Record<TrainingNeedCategory, number>,
    [trainings]
  );
  // Each person's needs this year, every column, carried and added ones included: one need per training a year.
  const needsOf = useMemo(() => new Map(people.map(e => [e.employeeId, TRAINING_NEED_CATEGORIES.flatMap(c => e.needs?.[c] ?? [])])), [people]);
  // Where a person already has a training (existingNeedFor), worked out once per pair when first needed, until a reload.
  const existingCache = useMemo(() => new Map<string, ExistingNeed | null>(), [needsOf]);
  const existingOf = (employeeId: string, key: string): ExistingNeed | null => {
    const at = `${employeeId}\u0000${key}`;
    if (!existingCache.has(at)) existingCache.set(at, existingNeedFor(needsOf.get(employeeId), key));
    return existingCache.get(at) ?? null;
  };

  // The ticks, against the lists as loaded: a reload (after a refusal) can take someone off the list or a training out of
  // the TDP, who are then left out and said; a column the TDP no longer lists a training under is asked again.
  const tickedPeople = useMemo(
    () => employeeIds.map(key => personById.get(key)).filter((e): e is TrainingPlanEmployee => !!e),
    [employeeIds, personById]
  );
  const tickedBase = useMemo(() => ticked.flatMap(t => {
    const choice = choiceByKey.get(t.key);
    if (!choice) return [];
    const column = t.column && choice.categories.includes(t.column) ? t.column : choice.categories.length === 1 ? choice.categories[0] : null;
    return [{ choice, column }];
  }), [ticked, choiceByKey]);
  const employeeValues = useMemo(() => tickedPeople.map(e => e.employeeId), [tickedPeople]);
  const trainingValues = useMemo(() => tickedBase.map(t => t.choice.key), [tickedBase]);

  // How many of the ticked employees already have each training: every one of them, and it can't be ticked (decision 2).
  const have = useMemo(() => haveByTraining(trainings, tickedPeople, existingOf), [trainings, tickedPeople, existingCache]);
  const everyoneHas = (key: string) => {
    const h = have.get(key);
    return !!h && h.of > 0 && h.n === h.of;
  };
  const tickedTrainings: TickedTraining[] = tickedBase.map(t => ({ ...t, addsNothing: everyoneHas(t.choice.key) }));

  // What the save adds (the server works it out again): every ticked training for every ticked employee, less what each
  // already has. A training still without a column counts under its first one here: whether it is skipped doesn't depend
  // on the column (one need per training a year, in any column).
  const pairs = useMemo(() => additionPairs(
    employeeValues,
    tickedBase.map(({ choice, column }) => {
      const category = column ?? choice.categories[0];
      return { key: choice.key, category, title: trainingTitle(choice, category) };
    }),
    person => needsOf.get(person)
  ), [employeeValues, tickedBase, needsOf]);
  const addCount = pairs.add.length;
  const forEmployees = new Set(pairs.add.map(p => p.employeeId)).size;
  const skipped = skippedGroups(
    pairs.skip,
    person => personById.get(person)?.fullName ?? person,
    (key, stored) => {
      const t = tickedBase.find(x => x.choice.key === key);
      return t ? trainingTitle(t.choice, t.column) : stored;
    }
  );
  const missingColumns = tickedBase.filter(t => !t.column).map(t => t.choice.title);
  const cap = capText(tickedPeople.length, tickedBase.length);
  const nothingToAdd = people.length === 0 || trainings.length === 0;
  const canAdd = !saving && !nothingToAdd && tickedPeople.length > 0 && tickedBase.length > 0 && missingColumns.length === 0 && addCount > 0 && !cap;
  const listed = choicesUnder(trainings, filter);

  // The second way (12ae): a training the TDP doesn't list, for the same ticked employees.
  const [mode, setMode] = useState<AddMode>("tdp");
  const outside = useOutsideTraining({
    fiscalYear, choices: trainings, employeeIds: employeeValues, needsOf, onSaved, onRefused,
    nameOf: person => personById.get(person)?.fullName ?? person
  });
  const busy = saving || outside.saving;
  const [focusTrainings, setFocusTrainings] = useState(0);
  useEffect(() => {
    if (focusTrainings) trainingRef.current?.focus();
  }, [focusTrainings]);

  // A change makes the last check, and the server's last refusal, out of date (either way's).
  function edited() {
    setProblem(null);
    setError("");
    outside.clear();
  }

  function chooseMode(next: AddMode) {
    setMode(next);
    edited();
  }

  // Esc, the close button and Cancel: a training typed in outside the TDP, or why it is held, would be lost, so that is
  // asked first (12ae). Ticks alone close at once, as before.
  function requestClose() {
    if (outside.hasText && !window.confirm("Close without adding? The training typed under “Not in the TDP”, and why it is held, will be lost.")) return;
    onClose();
  }

  // A typed title the TDP lists goes in from its list instead (12ae): ticked there, under its column, and the focus
  // follows to the list.
  function toTdp(choice: TdpTrainingChoice) {
    const already = tickedBase.find(t => t.choice.key === choice.key);
    const column = already ? already.column : columnOnSwitch(choice, outside.column, filter);
    if (!already) setTicked([...ticked, { key: choice.key, column }]);
    setTrainingNote(prev => ({ key: choice.key, text: again(already ? `“${trainingTitle(choice, column)}” is already ticked.` : whereText(choice, column))(prev.text) }));
    chooseMode("tdp");
    setFocusTrainings(n => n + 1);
  }

  function toggleEmployee(emp: TrainingPlanEmployee) {
    const on = employeeIds.includes(emp.employeeId);
    const next = on ? employeeIds.filter(key => key !== emp.employeeId) : [...employeeIds, emp.employeeId];
    setEmployeeIds(next);
    setEmployeeNote(again(`${emp.fullName} ${on ? "unticked" : "ticked"}: ${plural(next.filter(key => personById.has(key)).length, "employee")} ticked.`));
    edited();
  }

  function clearEmployees() {
    setEmployeeIds([]);
    setEmployeeNote(again("Every employee unticked."));
    edited();
  }

  // Decision 1: a training ticked under a column takes that column; under "Any column", its only one, or none yet when
  // the TDP lists it under several, which the ticked list then asks. Changing the filter changes nothing ticked.
  function toggleTraining(choice: TdpTrainingChoice) {
    if (ticked.some(t => t.key === choice.key)) return untickTraining(choice);
    const column = columnForTraining(choice, filter);
    setTicked([...ticked, { key: choice.key, column }]);
    setTrainingNote(prev => ({ key: choice.key, text: again(whereText(choice, column))(prev.text) }));
    edited();
  }

  function untickTraining(choice: TdpTrainingChoice) {
    const column = tickedBase.find(t => t.choice.key === choice.key)?.column ?? null;
    setTicked(ticked.filter(t => t.key !== choice.key));
    setTrainingNote(prev => ({ key: choice.key, text: again(`“${trainingTitle(choice, column)}” unticked.`)(prev.text) }));
    edited();
  }

  function chooseColumn(choice: TdpTrainingChoice, column: TrainingNeedCategory) {
    setTicked(ticked.map(t => (t.key === choice.key ? { ...t, column } : t)));
    // A note asking for this training's column is answered: the select says which.
    setTrainingNote(prev => (prev.key === choice.key ? { key: "", text: "" } : prev));
    edited();
  }

  function clearTrainings() {
    setTicked([]);
    setTrainingNote(prev => ({ key: "", text: again("Every training unticked.")(prev.text) }));
    edited();
  }

  // The form's own check says what is missing beside that part, and takes the focus there.
  function refuse(at: Part, text: string) {
    setProblem({ at, text });
    const controls = { employees: employeeRef, trainings: trainingRef, preview: previewRef, basis: basisRef, note: noteRef };
    controls[at].current?.focus();
  }

  async function add() {
    if (!canAdd) return;
    const raw = {
      employeeIds: employeeValues,
      trainings: tickedBase.map(({ choice, column }) => ({ category: column, title: trainingTitle(choice, column) })),
      basis,
      note
    };
    const read = readNeedAdditions(raw, { choices: trainings });
    if ("problem" in read) {
      // Add is on only with people and trainings ticked, each with its column, within the caps, so what the rules can
      // still refuse is why, or the note; anything else is said under the preview.
      const at: Part = !basis ? "basis" : /note/i.test(read.problem) ? "note" : "preview";
      return refuse(at, read.problem);
    }
    edited();
    setSaving(true);
    try {
      const { employeeIds: ids, trainings: chosen, basis: why, note: cleaned } = read.value;
      const res = await apiCall("/api/training/needs/additions", {
        method: "POST",
        body: JSON.stringify({
          fiscalYear,
          employeeIds: ids,
          trainings: chosen.map(t => ({ category: t.category, title: t.title })),
          basis: why,
          ...(cleaned ? { note: cleaned } : {})
        })
      });
      if (res?.status !== "success") throw new Error(res?.message || "The training needs couldn't be added.");
      onSaved(res.message || `Added ${plural(addCount, "training need")} to the FY ${fiscalYear} plan.`);
    } catch (err: any) {
      // E.g. everything already in their plans (409, another officer was quicker), or someone no longer with the office.
      setSaving(false);
      setError(err?.message || "The training needs couldn't be added.");
      setFocusError(n => n + 1);
      onRefused?.();
    }
  }

  const partProblem = (at: Part) => (problem?.at === at ? { id: problemId, text: problem.text } : undefined);

  return (
    <ModalDialog
      title="Add Training Need"
      subtitle={mode === "outside"
        ? `FY ${fiscalYear} · a training the uploaded TDP doesn't list, with why it is held`
        : `FY ${fiscalYear} · the uploaded TDP's own trainings, for employees it doesn't list`}
      icon={<ListPlus size={16} aria-hidden="true" />}
      size="xl"
      onClose={requestClose}
      busy={busy}
      // Into the employees' search, as before the second way came: the switch above it is one Shift+Tab away.
      initialFocusRef={employeeRef}
      footer={
        <>
          <button type="button" onClick={requestClose} disabled={busy} className={`${BUTTON} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
            Cancel
          </button>
          {mode === "outside" ? <OutsideSubmit o={outside} className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`} /> : (
            <button
              type="button"
              data-tdp="add-submit"
              onClick={add}
              disabled={!canAdd}
              // What the save does and what still keeps it off; not the list of skips, which can be long.
              aria-describedby={`${previewId}-count ${previewId}-columns ${previewId}-cap`}
              className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`}
            >
              {saving ? "Adding…" : addCount > 0 ? `Add ${plural(addCount, "training need")}` : "Add training needs"}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-xs text-slate-700">
        <AddModeSwitch mode={mode} disabled={busy} onChange={chooseMode} />
        <AddNeedIntro fiscalYear={fiscalYear} choicesFrom={choicesFrom} mode={mode} />

        {/* Side by side on a wide screen: who on the left; what (the filter and the trainings, or the training typed in)
            on the right. What is ticked sits under each list. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <AddNeedEmployees
            fiscalYear={fiscalYear}
            people={people}
            values={employeeValues}
            ticked={tickedPeople}
            gone={employeeIds.length - tickedPeople.length}
            renderItem={e => mode === "outside" ? <EmployeeOption emp={e} note={outside.haveNote(e.employeeId)} /> : (
              <EmployeeOption
                emp={e}
                has={tickedBase.length ? { n: tickedBase.filter(t => existingOf(e.employeeId, t.choice.key)).length, of: tickedBase.length } : undefined}
              />
            )}
            note={employeeNote}
            disabled={busy}
            problem={partProblem("employees")}
            inputRef={employeeRef}
            onToggle={toggleEmployee}
            onClear={clearEmployees}
          />

          {mode === "outside" ? <OutsideTrainingPart o={outside} onUseTdp={toTdp} /> : (
            <TdpTrainingsColumn
              name={`${id}-column`}
              filter={filter}
              onFilter={setFilter}
              counts={counts}
              trainings={trainings}
              listed={listed}
              ticked={tickedTrainings}
              values={trainingValues}
              gone={ticked.length - tickedBase.length}
              have={have}
              note={trainingNote.text}
              disabled={saving}
              problem={partProblem("trainings")}
              inputRef={trainingRef}
              onToggle={toggleTraining}
              onColumn={chooseColumn}
              onUntick={untickTraining}
              onClear={clearTrainings}
            />
          )}
        </div>

        {mode === "outside" ? <OutsideBelow o={outside} /> : (
          <>
            <BasisFields
              name={`${id}-basis`}
              noteId={`${id}-note`}
              basis={basis}
              note={note}
              problem={problem && (problem.at === "basis" || problem.at === "note") ? { at: problem.at, id: problemId, text: problem.text } : null}
              disabled={saving}
              basisRef={basisRef}
              noteRef={noteRef}
              onBasis={b => { setBasis(b); edited(); }}
              onNote={text => { setNote(text); edited(); }}
            />

            <AddPreview
              id={previewId}
              previewRef={previewRef}
              employees={tickedPeople.length}
              trainings={tickedBase.length}
              add={addCount}
              forEmployees={forEmployees}
              skipped={skipped}
              missingColumns={missingColumns}
              cap={cap}
              problem={partProblem("preview")}
            />

            <RefusalBox text={error} boxRef={errorRef} />
          </>
        )}
      </div>
    </ModalDialog>
  );
}
