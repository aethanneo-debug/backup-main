import type { ReactNode, RefObject } from "react";
import type { TrainingPlanEmployee } from "../../types";
import { RequiredMark } from "../ui/RequiredMark";
import ChoiceList from "./ChoiceList";
import { EmptyBox, type PartProblem } from "./AddNeedParts";
import { TickedEmployees } from "./AddNeedSelection";

// Add Training Need's left column, the same in both ways (12ad, 12ae): the employees, what the last tick did (read out),
// and who is ticked. Moved out of AddTrainingNeedDialog.tsx as it was, beside the two right columns (TdpTrainingsColumn,
// OutsideTrainingPart); the dialog still holds the state, and what each way says on a row (`renderItem`).
interface Props {
  fiscalYear: string;
  /** Everyone still with the office, needs or not, in the plan's order. */
  people: TrainingPlanEmployee[];
  /** The ticked employees still on the list, in the order ticked: their ids, and the records. */
  values: string[];
  ticked: TrainingPlanEmployee[];
  /** Ticked, but no longer on the list since it reloaded. */
  gone: number;
  renderItem: (emp: TrainingPlanEmployee) => ReactNode;
  /** What the last tick did, for a screen reader (the count line shows it). */
  note: string;
  disabled: boolean;
  problem?: PartProblem;
  inputRef: RefObject<HTMLInputElement | null>;
  onToggle: (emp: TrainingPlanEmployee) => void;
  onClear: () => void;
}

export default function AddNeedEmployees({ fiscalYear, people, values, ticked, gone, renderItem, note, disabled, problem, inputRef, onToggle, onClear }: Props) {
  return (
    <div className="min-w-0 space-y-2">
      <ChoiceList
        name="employees"
        label={<>Employees<RequiredMark /></>}
        items={people}
        keyOf={e => e.employeeId}
        searchText={e => [e.fullName, e.position, e.division].join(" ")}
        renderItem={renderItem}
        values={values}
        onToggle={onToggle}
        placeholder="Search by name, position or division…"
        noun="employee"
        hint={<>Everyone still with the office. &ldquo;No needs yet&rdquo;: nothing in their FY {fiscalYear} plan.</>}
        empty={<EmptyBox>There is nobody with the office to add a need for.</EmptyBox>}
        disabled={disabled}
        describedBy={problem?.id}
        invalid={!!problem}
        inputRef={inputRef}
        listHeight="max-h-52 lg:max-h-72"
      />
      <p aria-live="polite" data-tdp="employee-note" className="sr-only">{note}</p>
      <TickedEmployees
        people={ticked}
        gone={gone}
        disabled={disabled}
        problem={problem}
        onUntick={onToggle}
        onClear={onClear}
        focusSearch={() => inputRef.current?.focus()}
      />
    </div>
  );
}
