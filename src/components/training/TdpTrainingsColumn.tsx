import type { RefObject } from "react";
import type { TdpTrainingChoice, TrainingNeedCategory } from "../../types";
import ChoiceList from "./ChoiceList";
import { ColumnChoice, columnsText, EmptyBox, RequiredMark, TrainingOption, type PartProblem, type TrainingHave } from "./AddNeedParts";
import { TickedTrainings, type TickedTraining } from "./AddNeedSelection";

// Add Training Need's right column for the uploaded TDP's own trainings (12ad): which column's trainings the list shows,
// the list, where the training just ticked goes, and what is ticked. Moved out of AddTrainingNeedDialog.tsx as it was when
// the second way came (a training outside the TDP, 12ae); the dialog still holds the state and the rules.
interface Props {
  /** The column filter's radio name. */
  name: string;
  filter: TrainingNeedCategory | null;
  onFilter: (filter: TrainingNeedCategory | null) => void;
  /** How many trainings the TDP lists under each column. */
  counts: Record<TrainingNeedCategory, number>;
  /** Every TDP training, and those the filter shows. */
  trainings: TdpTrainingChoice[];
  listed: TdpTrainingChoice[];
  /** The ticked trainings, in the order ticked, and their keys. */
  ticked: TickedTraining[];
  values: string[];
  /** Ticked, but no longer in the TDP's list since it reloaded. */
  gone: number;
  /** How many of the ticked employees already have each training. */
  have: Map<string, TrainingHave>;
  /** Where the training just ticked goes, read out. */
  note: string;
  disabled: boolean;
  problem?: PartProblem;
  inputRef: RefObject<HTMLInputElement | null>;
  onToggle: (choice: TdpTrainingChoice) => void;
  onColumn: (choice: TdpTrainingChoice, column: TrainingNeedCategory) => void;
  onUntick: (choice: TdpTrainingChoice) => void;
  onClear: () => void;
}

export default function TdpTrainingsColumn({
  name, filter, onFilter, counts, trainings, listed, ticked, values, gone, have, note, disabled, problem, inputRef, onToggle, onColumn, onUntick, onClear
}: Props) {
  // Every ticked employee already has it: it can't be ticked (decision 2).
  const everyoneHas = (key: string) => {
    const h = have.get(key);
    return !!h && h.of > 0 && h.n === h.of;
  };
  return (
    <div className="min-w-0 space-y-3">
      <ColumnChoice name={name} filter={filter} counts={counts} total={trainings.length} disabled={disabled} onChange={onFilter} />
      <div className="space-y-2">
        <ChoiceList
          name="trainings"
          label={<>Trainings<RequiredMark /></>}
          items={listed}
          keyOf={c => c.key}
          // Every spelling the TDP has for it, whatever the column.
          searchText={c => [c.title, ...Object.values(c.spellings)].filter(Boolean).join(" ")}
          isDisabled={c => everyoneHas(c.key)}
          renderItem={c => {
            const t = ticked.find(x => x.choice.key === c.key);
            return <TrainingOption choice={c} filter={filter} have={have.get(c.key) ?? null} ticked={!!t} tickedColumn={t?.column ?? null} />;
          }}
          values={values}
          onToggle={onToggle}
          placeholder="Search the TDP's trainings…"
          noun="training"
          outsideText={n => `${n} under another column`}
          hint={filter
            ? <>Listed under {columnsText([filter])}: {listed.length} of {trainings.length}.</>
            : `Every training the uploaded TDP lists (${trainings.length}).`}
          empty={
            <EmptyBox>
              {trainings.length === 0
                ? "The uploaded TDP lists no trainings to choose from."
                : <>The TDP lists no training under {filter ? columnsText([filter]) : "that column"}. Show another column, or &ldquo;Any column&rdquo;.</>}
            </EmptyBox>
          }
          disabled={disabled}
          describedBy={problem?.id}
          invalid={!!problem}
          inputRef={inputRef}
          listHeight="max-h-52 lg:max-h-48"
        />
        {/* Where the training just ticked goes, read out as it changes. */}
        <div aria-live="polite" data-tdp="tick-note" className="text-[11px] text-slate-600">
          {note && <p className="break-words">{note}</p>}
        </div>
        <TickedTrainings
          ticked={ticked}
          gone={gone}
          disabled={disabled}
          problem={problem}
          onColumn={onColumn}
          onUntick={onUntick}
          onClear={onClear}
          focusSearch={() => inputRef.current?.focus()}
        />
      </div>
    </div>
  );
}
