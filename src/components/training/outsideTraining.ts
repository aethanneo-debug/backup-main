// "Add Training Need" for a training the uploaded TDP doesn't list (12ae): the pure parts of its form, shared by the
// dialog's two ways (AddTrainingNeedDialog.tsx, AddOutsideTraining.tsx) and tested in tests/outsideTraining.test.ts.
// Whether a save may go is always the server's own reader's to say (readOutsideTdpAddition, src/tdpAdditions.ts).
import type { TdpTrainingChoice, TrainingNeedCategory } from "../../types";
import { cleanText } from "../../inputText";
import { normalizeTitle, TDP_NAME_MAX } from "../../tdpRules";
import { columnForTraining, NEED_ADDITION_TITLE_MAX, tdpChoiceForTitle } from "../../tdpAdditions";
import type { SeminarTdpField } from "./SeminarTdpFields";

/** The typed title as the server reads it: cleaned like typed text, and the key titles are matched by ("" when it is
 * blank or too long to be one). */
export function outsideTitle(typed: unknown): { title: string; key: string } {
  const title = cleanText(typed);
  return { title, key: title.length <= NEED_ADDITION_TITLE_MAX ? normalizeTitle(title) : "" };
}

/** The uploaded TDP's own training a typed title is, if it is one: it goes in from the TDP's list instead, so it counts
 * as a TDP need (the server refuses it as a training outside the TDP). Matched exactly as the server's reader matches it,
 * with the typed text as typed (`tdpChoiceForTitle`): by its own key or its cleaned one, against each choice's key and its
 * spellings, so a soft hyphen or a ligature pasted from a PDF can't pass a TDP training off as one outside it. */
export function tdpChoiceFor(typed: unknown, choices: TdpTrainingChoice[] | null | undefined): TdpTrainingChoice | null {
  return tdpChoiceForTitle(typed, choices);
}

/** The column a TDP training takes when the form sends it to the TDP's list: its only one; else the column chosen for it
 * here, when the TDP lists it there; else the list's filter, when it is one of its columns; else none yet, and HR chooses
 * among its columns in the ticked list (as a training ticked under "Any column" does). */
export function columnOnSwitch(
  choice: TdpTrainingChoice,
  chosen: TrainingNeedCategory | null,
  filter: TrainingNeedCategory | null
): TrainingNeedCategory | null {
  return columnForTraining(choice, chosen) ?? columnForTraining(choice, filter);
}

/** A part of the form a problem can be about: the employees, the title, the column, or a field of the justification. */
export type OutsidePart = "employees" | "title" | "column" | SeminarTdpField;

/**
 * Which part of the form a refusal of `readOutsideTdpAddition` is about, read from the reader's own words (the order it
 * checks in: the employees, the title, the column, then the justification), so the form can point to it. null when the
 * words are none of these. `approver` tells the approver's name from their position, which share one message.
 */
export function outsideProblemPart(problem: string, approver: { name: string; position: string }): OutsidePart | null {
  // First: a title the TDP lists is quoted at the start of its message, and may hold any other words.
  if (/ is in the uploaded TDP: tick it in the list/.test(problem) || /^Type the training's title/.test(problem)) return "title";
  if (/^(Choose the employees|Choose at most \d+ employees|An employee is chosen twice)/.test(problem)) return "employees";
  if (/^Choose the column/.test(problem)) return "column";
  if (/^Choose why it is held/.test(problem)) return "kind";
  if (/^Give the reason/.test(problem)) return "reason";
  if (/^Name who approved it/.test(problem)) {
    const name = cleanText(approver.name);
    return !name || name.length > TDP_NAME_MAX ? "name" : "position";
  }
  if (/reference's date/.test(problem)) return "referenceDate";
  if (/reference number/.test(problem)) return "referenceNo";
  return null;
}
