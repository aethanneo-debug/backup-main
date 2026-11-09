// "Add Training Need" (the user's requests of 2026-11-08 and 2026-11-09, known-issues 12ad). The TDP is uploaded once a
// year and Plan A changes only through an amended TDP (Phase 6), so someone hired or designated after the upload had no
// needs. HR now adds the uploaded TDP's own trainings to their plans, each under a column where the TDP lists it, for
// several employees and several trainings in one save: approved trainings extended to more people, never new ones.
// This holds the choices, the column a ticked training takes, the checks on a save the server makes again, and what a
// save adds or skips. Used by the server and the dialog; tested.
import {
  TRAINING_NEED_CATEGORIES, TRAINING_NEED_COLUMN_LABELS, type NeedAdditionBasis, type SeminarTdpJustificationInput, type TdpTrainingChoice,
  type TrainingNeedCategory
} from "./types";
import { normalizeTitle, readSeminarTdpJustification } from "./tdpRules";
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
  outsideTdp?: unknown;
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
    // (Those added outside the TDP aren't the TDP's either, 12ae.)
    : (Array.isArray(yearNeeds) ? yearNeeds : []).filter(n => n && typeof n === "object" && !n.addedAfterTdp && !n.outsideTdp);
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

/** The keys a title is matched by: its own (`normalizeTitle`), and its own once cleaned like typed text. A soft hyphen,
 * a ligature or a full-width letter pasted from a PDF changes the first but not the second, so a title typed in and the
 * same title in the TDP's or the plan's own spelling are matched either way (the security review of 12ae). */
export function titleKeys(title: unknown): string[] {
  if (typeof title !== "string") return [];
  return [...new Set([normalizeTitle(title), normalizeTitle(cleanText(title))].filter(Boolean))];
}

/** The uploaded TDP's own training a typed title is, if it is one: matched by either of its keys against each choice's
 * key and the keys of its spellings, so a training the TDP lists can't be planned outside it (12ae) under a spelling
 * that differs only in invisible or pasted characters. Shared by the server's reader and the form. null when it is none. */
export function tdpChoiceForTitle(typed: unknown, choices: TdpTrainingChoice[] | null | undefined): TdpTrainingChoice | null {
  const keys = new Set(titleKeys(typeof typed === "string" ? typed.trim() : typed));
  if (keys.size === 0) return null;
  for (const c of Array.isArray(choices) ? choices : []) {
    if (!c || typeof c !== "object") continue;
    if (keys.has(c.key)) return c;
    const spelled = [c.title, ...Object.values(c.spellings ?? {})];
    if (spelled.some(s => titleKeys(s).some(k => keys.has(k)))) return c;
  }
  return null;
}

/** Scenario A: the column chosen first lists only the trainings under it; none chosen lists them all. */
export function choicesUnder(choices: TdpTrainingChoice[], category: TrainingNeedCategory | null): TdpTrainingChoice[] {
  return category ? choices.filter(c => c.categories.includes(category)) : choices;
}

/**
 * Scenario B: the column a training takes when it is ticked. Its one column; the filter's when the training is listed
 * under several and the filter is one of them; otherwise null, and HR chooses among `choice.categories` in the ticked
 * list (a training listed under several columns isn't taken to belong to one). The filter never unticks anything (the
 * user's decision of 2026-11-09).
 */
export function columnForTraining(choice: TdpTrainingChoice, current: TrainingNeedCategory | null): TrainingNeedCategory | null {
  if (choice.categories.length === 1) return choice.categories[0];
  return current && choice.categories.includes(current) ? current : null;
}

/** Where a person already has a training this year: its column, and whether it was carried in, added after the TDP, or
 * added outside it (12ae). */
export interface ExistingNeed {
  category: TrainingNeedCategory;
  carriedFrom?: string;
  added: boolean;
  outside?: true;
}

/**
 * Where the person already has a training this year, if they do: one need per person per training per year, in any
 * column, carried ones included (the same training in two columns would show twice in Monitoring). `personNeeds` are
 * the person's needs for the year, matched by both of their ids by the caller.
 */
export function existingNeedFor(personNeeds: NeedLike[] | null | undefined, key: string): ExistingNeed | null {
  for (const n of Array.isArray(personNeeds) ? personNeeds : []) {
    // By either of the need's keys (`titleKeys`): a copy stored in a pasted spelling is the same training.
    if (!n || typeof n !== "object" || typeof n.title !== "string" || !titleKeys(n.title).includes(key)) continue;
    return existingOf(n);
  }
  return null;
}

const existingOf = (n: NeedLike): ExistingNeed => ({
  category: isCategory(n.category) ? n.category : "Function",
  ...(typeof n.carriedFromFiscalYear === "string" && n.carriedFromFiscalYear ? { carriedFrom: n.carriedFromFiscalYear } : {}),
  added: !!n.addedAfterTdp,
  ...(n.outsideTdp ? { outside: true as const } : {})
});

/** Every training a person already has this year, by both of its keys (`titleKeys`), read once (the first need of each,
 * as `existingNeedFor`). */
function existingNeedIndex(personNeeds: NeedLike[] | null | undefined): Map<string, ExistingNeed> {
  const index = new Map<string, ExistingNeed>();
  for (const n of Array.isArray(personNeeds) ? personNeeds : []) {
    if (!n || typeof n !== "object" || typeof n.title !== "string") continue;
    for (const key of titleKeys(n.title)) if (!index.has(key)) index.set(key, existingOf(n));
  }
  return index;
}

/** "Function, carried from 2027": where a person already has a training, for the form and the refusal. */
export function existingNeedText(existing: ExistingNeed): string {
  const origin = existing.carriedFrom ? `, carried from ${existing.carriedFrom}`
    : existing.outside ? ", outside the TDP" : existing.added ? ", added after the TDP" : "";
  return `${TRAINING_NEED_COLUMN_LABELS[existing.category]}${origin}${existing.carriedFrom && existing.outside ? ", outside the TDP" : ""}`;
}

// One save gives every ticked training to every ticked employee (the user's request of 2026-11-09), bounded so that one
// save can't write thousands of needs (the import, by comparison, takes at most 5,000).
export const NEED_ADDITION_MAX_EMPLOYEES = 50;
export const NEED_ADDITION_MAX_TRAININGS = 50;
export const NEED_ADDITION_MAX_NEEDS = 200;
// Needs planned outside the TDP (12ae) a fiscal year takes, carried ones aside: each save can type a new title for up to
// 50 people, where the TDP's own trainings bound 12ad's additions (the security review). A training planned this widely
// belongs in an amended TDP. (The real TDP lists about 480 needs in all.)
export const OUTSIDE_NEEDS_MAX_PER_YEAR = 500;
const EMPLOYEE_ID_MAX = 100;
const COLUMN_CHOICE = "the training needed for the function, for an additional function or designation, or for career advancement";

/** One training of a save, checked: the TDP's spelling under its column (stored as is), and the key it is matched by. */
export interface NeedAdditionTraining {
  key: string;
  category: TrainingNeedCategory;
  title: string;
}

export interface NeedAdditionsValue {
  employeeIds: string[];
  trainings: NeedAdditionTraining[];
  basis: NeedAdditionBasis;
  note?: string;
}

/** The employees a save is for: 1 to 50 staff record ids, each once (the first version's single `employeeId` too). */
function readEmployeeIds(r: Record<string, unknown>): { employeeIds: string[] } | { problem: string } {
  const ids: unknown[] = Array.isArray(r.employeeIds) ? r.employeeIds : r.employeeId !== undefined ? [r.employeeId] : [];
  if (ids.length === 0) return { problem: "Choose the employees whose plans get the trainings." };
  if (ids.length > NEED_ADDITION_MAX_EMPLOYEES) return { problem: `Choose at most ${NEED_ADDITION_MAX_EMPLOYEES} employees in one save.` };
  const employeeIds: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !id.trim() || id.length > EMPLOYEE_ID_MAX) return { problem: "Choose the employees again: one of them isn't a staff record." };
    if (employeeIds.includes(id)) return { problem: "An employee is chosen twice." };
    employeeIds.push(id);
  }
  return { employeeIds };
}

/**
 * A save, checked and cleaned, or why it can't be (the server answers 400). Every ticked training goes to every ticked
 * employee (the user's request of 2026-11-09), each training under its own column, which must be one the TDP lists it
 * under. The title is stored in that column's spelling, never cleaned: mandate keys and seminars' needs match the raw
 * text. The same training can't be ticked twice, not even under two columns (one need per person and training a year).
 * One basis and one note for the whole save. The single shape the first version sent (`employeeId`, `category`,
 * `title`) reads as one employee and one training. Whether the employees exist, are still with the office or already
 * have a training is for the server to say, which holds the records (`additionPairs`).
 */
export function readNeedAdditions(raw: unknown, ctx: { choices: TdpTrainingChoice[] }): { value: NeedAdditionsValue } | { problem: string } {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;

  const people = readEmployeeIds(r);
  if ("problem" in people) return people;
  const { employeeIds } = people;

  const rows: unknown[] = Array.isArray(r.trainings) ? r.trainings
    : r.category !== undefined || r.title !== undefined ? [{ category: r.category, title: r.title }] : [];
  if (rows.length === 0) return { problem: "Choose a training from the uploaded TDP." };
  if (rows.length > NEED_ADDITION_MAX_TRAININGS) return { problem: `Choose at most ${NEED_ADDITION_MAX_TRAININGS} trainings in one save.` };
  const trainings: NeedAdditionTraining[] = [];
  for (const row of rows) {
    const t = (row && typeof row === "object" && !Array.isArray(row) ? row : {}) as Record<string, unknown>;
    const typed = typeof t.title === "string" ? t.title.trim() : "";
    const key = typed && typed.length <= NEED_ADDITION_TITLE_MAX ? normalizeTitle(typed) : "";
    const choice = key ? ctx.choices.find(c => c.key === key) : undefined;
    if (!isCategory(t.category)) {
      return { problem: rows.length > 1 && choice ? `Choose the column for ${JSON.stringify(choice.title)}.` : `Choose the column: ${COLUMN_CHOICE}.` };
    }
    if (!typed || typed.length > NEED_ADDITION_TITLE_MAX) return { problem: "Choose a training from the uploaded TDP." };
    if (!choice) return { problem: `${JSON.stringify(typed)} isn't one of the uploaded TDP's trainings.` };
    const spelling = choice.spellings[t.category];
    if (!spelling) {
      return { problem: `${JSON.stringify(choice.title)} isn't listed under "${TRAINING_NEED_COLUMN_LABELS[t.category]}" in the TDP. It is listed under ${choice.categories.map(c => `"${TRAINING_NEED_COLUMN_LABELS[c]}"`).join(" and ")}.` };
    }
    if (trainings.some(x => x.key === choice.key)) {
      return { problem: `${JSON.stringify(choice.title)} is chosen twice: a training goes under one column for each person.` };
    }
    trainings.push({ key: choice.key, category: t.category, title: spelling });
  }
  const needs = employeeIds.length * trainings.length;
  if (needs > NEED_ADDITION_MAX_NEEDS) {
    return { problem: `That is ${needs} needs in one save; the most is ${NEED_ADDITION_MAX_NEEDS}. Choose fewer employees or trainings.` };
  }

  if (!isBasis(r.basis)) return { problem: "Choose why the needs are added: hired after the TDP was approved, newly designated or reassigned, or another reason." };
  // (cleanText refuses text far too long before cleaning it, which would read as no note.)
  const rawNote = typeof r.note === "string" ? r.note : "";
  const note = cleanText(rawNote);
  if (rawNote.length > NEED_ADDITION_NOTE_MAX * 4 || note.length > NEED_ADDITION_NOTE_MAX) return { problem: `Keep the note to ${NEED_ADDITION_NOTE_MAX} characters.` };
  if (r.basis === "Other" && !note) return { problem: "Write the reason in the note." };
  return { value: { employeeIds, trainings, basis: r.basis, ...(note ? { note } : {}) } };
}

export interface OutsideTdpAdditionValue {
  employeeIds: string[];
  /** The typed title, cleaned (typed text, unlike the TDP's own spellings), its key and its column. */
  training: NeedAdditionTraining;
  justification: SeminarTdpJustificationInput;
}

/**
 * A training the uploaded TDP doesn't list, for several employees in one save (12ae, the user's request of 2026-11-09),
 * checked, or why it can't be (the server answers 400). The title is typed, so it is cleaned as seminar titles are (12z
 * Part C); one the TDP does list is refused, pointing back to its list, so a TDP training is never marked outside it.
 * The justification is a seminar outside the TDP's (`readSeminarTdpJustification`): why, the reason, who approved it,
 * a reference optional. One training a save, since the justification is for that training.
 */
export function readOutsideTdpAddition(
  raw: unknown,
  ctx: { choices: TdpTrainingChoice[]; today: string }
): { value: OutsideTdpAdditionValue } | { problem: string } {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const people = readEmployeeIds(r);
  if ("problem" in people) return people;
  const title = typeof r.title === "string" ? cleanText(r.title) : "";
  const key = title.length <= NEED_ADDITION_TITLE_MAX ? normalizeTitle(title) : "";
  if (!key) return { problem: `Type the training's title, up to ${NEED_ADDITION_TITLE_MAX} characters.` };
  // By the typed text's own key or its cleaned one (`tdpChoiceForTitle`): a TDP training pasted with a soft hyphen or a
  // ligature is still the TDP's (the security review).
  const listed = tdpChoiceForTitle(r.title, ctx.choices);
  if (listed) return { problem: `${JSON.stringify(listed.title)} is in the uploaded TDP: tick it in the list of the TDP's trainings instead.` };
  if (!isCategory(r.category)) return { problem: `Choose the column: ${COLUMN_CHOICE}.` };
  const justification = readSeminarTdpJustification(r.justification, ctx.today);
  if ("problem" in justification) return justification;
  return { value: { employeeIds: people.employeeIds, training: { key, category: r.category, title }, justification: justification.value } };
}

export interface NeedAdditionPair extends NeedAdditionTraining {
  employeeId: string;
}
export interface NeedAdditionSkip {
  employeeId: string;
  key: string;
  title: string;
  existing: ExistingNeed;
}

/**
 * What a save adds: every training for every employee, in the order ticked, less what each one already has this year
 * (any column, carried ones and earlier additions included), which is skipped and said, never added twice (the user's
 * decision of 2026-11-09). `needsOf` gives a person's needs for the year, matched by both of their ids by the caller.
 */
export function additionPairs(
  employeeIds: string[],
  trainings: NeedAdditionTraining[],
  needsOf: (employeeId: string) => NeedLike[] | null | undefined
): { add: NeedAdditionPair[]; skip: NeedAdditionSkip[] } {
  const add: NeedAdditionPair[] = [];
  const skip: NeedAdditionSkip[] = [];
  for (const employeeId of employeeIds) {
    // Each person's needs are read once, not once for every training (the security review).
    const index = existingNeedIndex(needsOf(employeeId));
    for (const t of trainings) {
      // By its key, or either key of its title: the TDP's spelling and a copy typed in are the same training.
      const existing = index.get(t.key) ?? titleKeys(t.title).map(k => index.get(k)).find(Boolean);
      if (existing) skip.push({ employeeId, key: t.key, title: t.title, existing });
      else add.push({ employeeId, ...t });
    }
  }
  return { add, skip };
}
