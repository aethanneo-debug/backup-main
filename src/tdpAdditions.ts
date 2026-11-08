// "Add Training Need" (the user's request of 2026-11-08, known-issues 12ad). The TDP is uploaded once a year and Plan A
// changes only through an amended TDP (Phase 6), so someone hired or designated after the upload had no needs. HR now
// adds one of the uploaded TDP's own trainings to their plan, under a column where the TDP lists it: an approved
// training extended to another person, never a new one. This holds the choices, the rules that keep the column and the
// training in step on the form, and the checks the server makes again. Used by the server and the dialog; tested.
import { TRAINING_NEED_CATEGORIES, TRAINING_NEED_COLUMN_LABELS, type NeedAdditionBasis, type TdpTrainingChoice, type TrainingNeedCategory } from "./types";
import { normalizeTitle } from "./tdpRules";
import { cleanText } from "./inputText";

export const NEED_ADDITION_TITLE_MAX = 300;   // a Plan A need's room, as on the import
export const NEED_ADDITION_NOTE_MAX = 300;

export const NEED_ADDITION_BASES: { basis: NeedAdditionBasis; label: string }[] = [
  { basis: "Hired after the TDP", label: "Hired after the TDP was approved" },
  { basis: "Designated after the TDP", label: "Newly designated or reassigned after the TDP" },
  { basis: "Other", label: "Another reason" }
];

export function needAdditionBasisLabel(basis: unknown): string {
  return NEED_ADDITION_BASES.find(b => b.basis === basis)?.label ?? "Another reason";
}

const isCategory = (v: unknown): v is TrainingNeedCategory => (TRAINING_NEED_CATEGORIES as readonly unknown[]).includes(v);
const isBasis = (v: unknown): v is NeedAdditionBasis => NEED_ADDITION_BASES.some(b => b.basis === v);

/** A need, as these rules read it (damaged entries are passed over). */
export interface NeedLike {
  category?: unknown;
  title?: unknown;
  carriedFromFiscalYear?: unknown;
  addedAfterTdp?: unknown;
}

/**
 * The uploaded TDP's own trainings, grouped by title as titles are matched everywhere (`normalizeTitle`), each with the
 * columns the TDP lists it under and its spelling in each (the first one seen). `trainings` is the list the upload
 * record keeps. A record from before it was kept has none: then the year's needs stand in, those HR added left out and
 * carried ones included (the import skipped a TDP row its person already had carried, so the year's TDP needs alone
 * would miss trainings the TDP lists). `yearNeeds` are the year's needs only.
 */
export function tdpTrainingChoices(trainings: unknown, yearNeeds: NeedLike[] | null | undefined): TdpTrainingChoice[] {
  const recorded = Array.isArray(trainings) ? trainings : [];
  const source: NeedLike[] = recorded.length > 0
    ? recorded
    : (Array.isArray(yearNeeds) ? yearNeeds : []).filter(n => n && typeof n === "object" && !n.addedAfterTdp);
  const byKey = new Map<string, TdpTrainingChoice>();
  for (const row of source) {
    if (!row || typeof row !== "object" || typeof row.title !== "string" || !isCategory(row.category)) continue;
    const title = row.title.trim();
    if (!title || title.length > NEED_ADDITION_TITLE_MAX) continue;
    const key = normalizeTitle(title);
    if (!key) continue;
    let choice = byKey.get(key);
    if (!choice) {
      choice = { key, title, categories: [], spellings: {} };
      byKey.set(key, choice);
    }
    if (!choice.spellings[row.category]) {
      choice.spellings[row.category] = title;
      choice.categories.push(row.category);
    }
  }
  for (const choice of byKey.values()) {
    choice.categories.sort((a, b) => TRAINING_NEED_CATEGORIES.indexOf(a) - TRAINING_NEED_CATEGORIES.indexOf(b));
  }
  return [...byKey.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/** Scenario A: the column chosen first lists only the trainings under it; none chosen lists them all. */
export function choicesUnder(choices: TdpTrainingChoice[], category: TrainingNeedCategory | null): TdpTrainingChoice[] {
  return category ? choices.filter(c => c.categories.includes(category)) : choices;
}

/**
 * Scenario B: the column once a training is chosen. Its one column; the current one when the training is listed under
 * several and that is one of them; otherwise null, and HR chooses among `choice.categories` (a training listed under
 * several columns isn't taken to belong to one).
 */
export function columnForTraining(choice: TdpTrainingChoice, current: TrainingNeedCategory | null): TrainingNeedCategory | null {
  if (choice.categories.length === 1) return choice.categories[0];
  return current && choice.categories.includes(current) ? current : null;
}

/** The training once the column changes: kept when it is listed under the new column (or none is chosen), cleared otherwise. */
export function trainingForColumn(choice: TdpTrainingChoice | null, category: TrainingNeedCategory | null): TdpTrainingChoice | null {
  if (!choice || !category) return choice;
  return choice.categories.includes(category) ? choice : null;
}

/**
 * Where the person already has a training this year, if they do: one need per person per training per year, in any
 * column, carried ones included (the same training in two columns would show twice in Monitoring). `personNeeds` are
 * the person's needs for the year, matched by both of their ids by the caller.
 */
export function existingNeedFor(personNeeds: NeedLike[] | null | undefined, key: string): { category: TrainingNeedCategory; carriedFrom?: string; added: boolean } | null {
  for (const n of Array.isArray(personNeeds) ? personNeeds : []) {
    if (!n || typeof n !== "object" || typeof n.title !== "string" || normalizeTitle(n.title) !== key) continue;
    return {
      category: isCategory(n.category) ? n.category : "Function",
      ...(typeof n.carriedFromFiscalYear === "string" && n.carriedFromFiscalYear ? { carriedFrom: n.carriedFromFiscalYear } : {}),
      added: !!n.addedAfterTdp
    };
  }
  return null;
}

/** "Function, carried from 2027": where a person already has a training, for the form and the refusal. */
export function existingNeedText(existing: { category: TrainingNeedCategory; carriedFrom?: string; added: boolean }): string {
  return `${TRAINING_NEED_COLUMN_LABELS[existing.category]}${existing.carriedFrom ? `, carried from ${existing.carriedFrom}` : existing.added ? ", added after the TDP" : ""}`;
}

export interface NeedAdditionValue {
  category: TrainingNeedCategory;
  title: string;            // the TDP's spelling under that column, exactly as stored there
  basis: NeedAdditionBasis;
  note?: string;
}

/**
 * A need to add, checked and cleaned, or why it can't be (`duplicate` when the person already has it: the server answers
 * 409, otherwise 400). The title must be one of `choices`, listed under the chosen column, and is stored in the TDP's own
 * spelling, never cleaned: mandate keys and seminars' needs match the raw text. The note is cleaned like typed text.
 */
export function readNeedAddition(
  raw: unknown,
  ctx: { choices: TdpTrainingChoice[]; personNeeds: NeedLike[] | null | undefined }
): { value: NeedAdditionValue } | { problem: string; duplicate?: true } {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  if (!isCategory(r.category)) return { problem: "Choose the column: the training needed for the function, for an additional function or designation, or for career advancement." };
  const typed = typeof r.title === "string" ? r.title.trim() : "";
  if (!typed || typed.length > NEED_ADDITION_TITLE_MAX) return { problem: "Choose a training from the uploaded TDP." };
  const key = normalizeTitle(typed);
  const choice = key ? ctx.choices.find(c => c.key === key) : undefined;
  if (!choice) return { problem: `${JSON.stringify(typed)} isn't one of the uploaded TDP's trainings.` };
  const spelling = choice.spellings[r.category];
  if (!spelling) {
    return { problem: `${JSON.stringify(choice.title)} isn't listed under "${TRAINING_NEED_COLUMN_LABELS[r.category]}" in the TDP. It is listed under ${choice.categories.map(c => `"${TRAINING_NEED_COLUMN_LABELS[c]}"`).join(" and ")}.` };
  }
  if (!isBasis(r.basis)) return { problem: "Choose why the need is added: hired after the TDP was approved, newly designated or reassigned, or another reason." };
  // (cleanText refuses text far too long before cleaning it, which would read as no note.)
  const rawNote = typeof r.note === "string" ? r.note : "";
  const note = cleanText(rawNote);
  if (rawNote.length > NEED_ADDITION_NOTE_MAX * 4 || note.length > NEED_ADDITION_NOTE_MAX) return { problem: `Keep the note to ${NEED_ADDITION_NOTE_MAX} characters.` };
  if (r.basis === "Other" && !note) return { problem: "Write the reason in the note." };
  const existing = existingNeedFor(ctx.personNeeds, key);
  if (existing) return { problem: `They already have ${JSON.stringify(choice.title)} in their plan (${existingNeedText(existing)}).`, duplicate: true };
  return { value: { category: r.category, title: spelling, basis: r.basis, ...(note ? { note } : {}) } };
}
