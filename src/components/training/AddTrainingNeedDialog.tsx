import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, ListPlus } from "lucide-react";
import {
  TRAINING_NEED_CATEGORIES,
  TRAINING_NEED_COLUMN_LABELS,
  type NeedAdditionBasis,
  type TdpTrainingChoice,
  type TrainingNeedCategory,
  type TrainingPlanEmployee
} from "../../types";
import {
  choicesUnder, columnForTraining, existingNeedFor, existingNeedText, readNeedAddition, trainingForColumn
} from "../../tdpAdditions";
import { apiCall } from "../../utils";
import ModalDialog from "../ui/ModalDialog";
import ChoiceList from "./ChoiceList";
import { BasisFields, ColumnChoice, columnsText, EmployeeOption, EmptyBox, planCounts, PROBLEM, RequiredMark, TrainingOption } from "./AddNeedParts";

// "Add Training Need" (the user's request of 2026-11-08, known-issues 12ad). The TDP is uploaded once a year and Plan A
// is read-only, so someone hired or designated after the upload had no needs. HR or the Administrator gives one employee
// one of the uploaded TDP's own trainings, under a column where the TDP lists it, and says why. The column and the
// training keep each other in step by the user's two scenarios (src/tdpAdditions.ts): a column chosen first lists only
// its trainings; a training chosen first fills in its column, or asks which when the TDP lists it under several. Checked
// with the server's own rules before it is sent; a refusal stays here, with what was typed.
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
  /** After the server added it, with its own account of it. */
  onSaved: (message: string) => void;
  /** After a refusal: the plan may have changed meanwhile (another officer added the same need), so the page reloads it
   * and the lists show it as it is now. */
  onRefused?: () => void;
}

type Part = "employee" | "column" | "training" | "basis" | "note";

const BUTTON = "rounded-lg px-4 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export default function AddTrainingNeedDialog({ fiscalYear, employees, choices, choicesFrom, onClose, onSaved, onRefused }: Props) {
  const id = useId();
  const problemId = `${id}-problem`;
  const [employeeId, setEmployeeId] = useState("");
  const [column, setColumn] = useState<TrainingNeedCategory | null>(null);
  const [trainingKey, setTrainingKey] = useState("");
  const [basis, setBasis] = useState<NeedAdditionBasis | "">("");
  const [note, setNote] = useState("");
  // What the last change of column or training did to the other ("… so it was cleared"), read out.
  const [syncNote, setSyncNote] = useState("");
  // The form's own check, beside the part it is about; the server's refusal, under the form.
  const [problem, setProblem] = useState<{ at: Part; text: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const employeeRef = useRef<HTMLInputElement>(null);
  const columnRef = useRef<HTMLInputElement>(null);
  const trainingRef = useRef<HTMLInputElement>(null);
  const basisRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  // A refusal: the Add button was off while it was on its way, so the focus goes to the reason rather than the page.
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [focusError, setFocusError] = useState(0);
  useEffect(() => {
    if (focusError) errorRef.current?.focus();
  }, [focusError]);

  const people = employees ?? [];
  const trainings = choices ?? [];
  const employee = people.find(e => e.employeeId === employeeId) ?? null;
  const training = trainings.find(c => c.key === trainingKey) ?? null;
  // The person's needs this year, every column, carried and added ones included: one need per training per year.
  const personNeeds = useMemo(() => (employee ? TRAINING_NEED_CATEGORIES.flatMap(c => employee.needs?.[c] ?? []) : []), [employee]);
  const existing = useMemo(() => new Map(trainings.map(c => [c.key, existingNeedFor(personNeeds, c.key)])), [trainings, personNeeds]);
  // A training chosen before the employee (or the employee changed since) that is already theirs: it stays on screen,
  // flagged, and Add stays off.
  const duplicate = training ? existing.get(training.key) ?? null : null;
  const listed = choicesUnder(trainings, column);
  const nothingToAdd = people.length === 0 || trainings.length === 0;

  // A change makes the last check, and the server's last refusal, out of date.
  function edited() {
    setProblem(null);
    setError("");
  }

  function chooseEmployee(emp: TrainingPlanEmployee) {
    setEmployeeId(emp.employeeId);
    edited();
  }

  // Scenario A: the column lists only its trainings; one the new column doesn't list is cleared ("Any column" keeps it).
  function chooseColumn(next: TrainingNeedCategory | null) {
    setColumn(next);
    edited();
    if (training && !trainingForColumn(training, next)) {
      setTrainingKey("");
      setSyncNote(`“${training.title}” isn't listed under ${next ? columnsText([next]) : "that column"}, so it was cleared.`);
    } else setSyncNote("");
  }

  // Scenario B: the training fills in its column when the TDP lists it under one, or keeps the column chosen when that
  // is one of its own; otherwise the column group asks which.
  function chooseTraining(choice: TdpTrainingChoice) {
    const next = columnForTraining(choice, column);
    setTrainingKey(choice.key);
    setColumn(next);
    edited();
    setSyncNote(next && next !== column ? `“${choice.title}” is listed only under ${columnsText([next])}, so that column is chosen.` : "");
  }

  // The form's own check says what is missing beside that part, and takes the focus there.
  function refuse(at: Part, text: string) {
    setProblem({ at, text });
    const controls = { employee: employeeRef, column: columnRef, training: trainingRef, basis: basisRef, note: noteRef };
    controls[at].current?.focus();
  }

  async function add() {
    if (saving || nothingToAdd || duplicate) return;
    if (!employee) return refuse("employee", "Choose the employee whose plan gets the training.");
    const read = readNeedAddition({ category: column, title: training?.title ?? "", basis, note }, { choices: trainings, personNeeds });
    if ("problem" in read) {
      // Beside the part it is about, in the order the rules check them: the column, the training (and whether the TDP
      // lists it under that column: a reload can change the TDP under an open dialog), why, the note.
      const at: Part = !column ? "column"
        : !training || read.duplicate ? "training"
        : !training.categories.includes(column) ? "column"
        : !basis ? "basis" : "note";
      return refuse(at, read.problem);
    }
    edited();
    setSaving(true);
    try {
      const res = await apiCall("/api/training/needs/additions", {
        method: "POST",
        body: JSON.stringify({ fiscalYear, employeeId: employee.employeeId, ...read.value })
      });
      if (res?.status !== "success") throw new Error(res?.message || "The training need couldn't be added.");
      onSaved(res.message || `Added ${read.value.title} to ${employee.fullName}'s FY ${fiscalYear} plan.`);
    } catch (err: any) {
      // E.g. already in their plan (409, another officer was quicker), or no longer with the office.
      setSaving(false);
      setError(err?.message || "The training need couldn't be added.");
      setFocusError(n => n + 1);
      onRefused?.();
    }
  }

  const partProblem = (at: Part) => (problem?.at === at ? { id: problemId, text: problem.text } : undefined);
  const describe = (...ids: (string | false)[]) => ids.filter(Boolean).join(" ");

  return (
    <ModalDialog
      title="Add Training Need"
      subtitle={`FY ${fiscalYear} · one of the uploaded TDP's own trainings, for someone it doesn't list`}
      icon={<ListPlus size={16} aria-hidden="true" />}
      size="xl"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={`${BUTTON} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
            Cancel
          </button>
          <button
            type="button"
            data-tdp="add-submit"
            onClick={add}
            disabled={saving || nothingToAdd || !!duplicate}
            className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`}
          >
            {saving ? "Adding…" : "Add training need"}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs text-slate-700">
        <p className="text-[11px] text-slate-500">
          Give someone the TDP doesn&rsquo;t list, such as an employee hired or designated after it was approved, one of its own
          trainings. It then counts as their Plan A need: Monitoring tracks it, and they are listed for the seminars that cover it
          with no justification needed.
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

        {/* Side by side on a wide screen: who on the left; what (the column and the training) on the right. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <ChoiceList
              label={<>Employee<RequiredMark /></>}
              items={people}
              keyOf={e => e.employeeId}
              searchText={e => [e.fullName, e.position, e.division].join(" ")}
              renderItem={e => <EmployeeOption emp={e} />}
              value={employeeId}
              onChoose={chooseEmployee}
              placeholder="Search by name, position or division…"
              noun="employee"
              hint={<>Everyone still with the office. &ldquo;No needs yet&rdquo;: nothing in their FY {fiscalYear} plan.</>}
              empty={<EmptyBox>There is nobody with the office to add a need for.</EmptyBox>}
              disabled={saving}
              describedBy={describe(`${id}-employee`, problem?.at === "employee" && problemId)}
              invalid={problem?.at === "employee"}
              inputRef={employeeRef}
              listHeight="max-h-52 lg:max-h-[22rem]"
            />
            {/* The choice in full, read out when it changes (the search may hide its row). */}
            <p id={`${id}-employee`} aria-live="polite" className="text-[11px] text-slate-600">
              {employee && (
                <>
                  Chosen: <strong className="font-semibold text-slate-800">{employee.fullName}</strong> · their FY {fiscalYear} plan:{" "}
                  {planCounts(employee) || "nothing yet"}.
                </>
              )}
            </p>
            {problem?.at === "employee" && <p id={problemId} role="alert" className={PROBLEM}>{problem.text}</p>}
          </div>

          <div className="min-w-0 space-y-3">
            <ColumnChoice
              name={`${id}-column`}
              column={column}
              training={training}
              syncNote={syncNote}
              problem={partProblem("column")}
              disabled={saving}
              firstRef={columnRef}
              onChange={chooseColumn}
            />
            <div className="space-y-1.5">
              <ChoiceList
                label={<>Training<RequiredMark /></>}
                items={listed}
                keyOf={c => c.key}
                // Every spelling the TDP has for it, whatever the column.
                searchText={c => [c.title, ...Object.values(c.spellings)].filter(Boolean).join(" ")}
                isDisabled={c => !!existing.get(c.key)}
                renderItem={c => <TrainingOption choice={c} column={column} existing={existing.get(c.key) ?? null} />}
                value={trainingKey}
                onChoose={chooseTraining}
                placeholder="Search the TDP's trainings…"
                noun="training"
                hint={column
                  ? <>Listed under {columnsText([column])}: {listed.length} of {trainings.length}. &ldquo;Any column&rdquo; lists them all.</>
                  : `Every training the uploaded TDP lists (${trainings.length}).`}
                empty={
                  <EmptyBox>
                    {trainings.length === 0
                      ? "The uploaded TDP lists no trainings to choose from."
                      : <>The TDP lists no training under {column ? columnsText([column]) : "that column"}. Choose another column, or &ldquo;Any column&rdquo;.</>}
                  </EmptyBox>
                }
                disabled={saving}
                describedBy={describe(`${id}-training`, problem?.at === "training" && problemId)}
                invalid={problem?.at === "training"}
                inputRef={trainingRef}
                listHeight="max-h-52 lg:max-h-60"
              />
              {/* The choice in full (the search may hide its row). Only the flag is read out as it comes: changing the
                  employee is what brings it, and nothing else on screen says so. */}
              <div id={`${id}-training`}>
                <div aria-live="polite">
                  {training && duplicate && employee && (
                    <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>
                        {employee.fullName} already has &ldquo;{training.title}&rdquo; in their plan ({existingNeedText(duplicate)}). Choose
                        another training, or another employee.
                      </span>
                    </p>
                  )}
                </div>
                {training && !duplicate && (
                  <p className="text-[11px] text-slate-600">
                    Chosen: <strong className="font-semibold text-slate-800">&ldquo;{(column && training.spellings[column]) || training.title}&rdquo;</strong>
                    {column ? `, under ${TRAINING_NEED_COLUMN_LABELS[column]}` : ""}.
                  </p>
                )}
              </div>
              {problem?.at === "training" && <p id={problemId} role="alert" className={PROBLEM}>{problem.text}</p>}
            </div>
          </div>
        </div>

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

        {error && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 focus:outline-none">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{error}</span>
          </p>
        )}
      </div>
    </ModalDialog>
  );
}
