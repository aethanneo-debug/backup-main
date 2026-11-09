// The participant picker's groups (ParticipantPickerModal.tsx), in the view the instructor's review asks for (R10,
// 2026-11-03): at first only the people with no training yet in the seminar's fiscal year, and anyone whose need for it
// is mandated. "Already trained this FY" folds away the rest of the already-trained, who can still be ticked. "Already
// sent to this training" folds away, read-only, those who can't be enrolled. A row ticked for this seminar (or just
// unticked) stays on screen whatever is folded. Each group keeps the server's order (rankTrainingCandidates).
//
// Only the rows in scope reach here: the Plan A switch applies first, to every group. So in the Plan A view "Already
// sent" holds the plan's listers, as "Not eligible" did, and says how many more are outside the plan.
import type { TrainingCandidate } from "../../types";
import { matchesTerms } from "../../tableView";
import type { PickGroup, PickRow } from "./ParticipantChecklist";

const trainedThisYear = (c: TrainingCandidate) => (c.trainingsThisYear ?? []).length > 0;

/** Their own Plan A need for this seminar is a training the law requires (12z Part D). */
const mandatedHere = (c: TrainingCandidate) => (c.mandatedNeeds ?? []).length > 0;

/** Can be chosen from what is on screen: "Recommended", "Select all recommended" and "Add a seminar from the plan" (with
 * the toggle closed) count only these. */
export const onScreenToChoose = (c: TrainingCandidate, showTrained: boolean) =>
  c.eligible && (!trainedThisYear(c) || mandatedHere(c) || showTrained);

/** Their own Plan A lists this seminar's training outside the TDP (12ae): shown with the plan's listers, never counted as
 * identified by the TDP (the server's `needsThis` stays false, and its order doesn't change). */
export const plannedOutside = (c: TrainingCandidate) => (c.outsideNeeds ?? []).length > 0;

/** Their own Plan A lists this seminar's training, from the TDP or outside it: the picker's Plan A view, its listers'
 * count and the representative's list take them (the lead's decision for 12ae), so a training planned outside the TDP
 * has listers to seat. */
export const plansThis = (c: TrainingCandidate) => c.needsThis || plannedOutside(c);

/** Seated with no justification of their own, so "Select all recommended" and "Add a seminar from the plan" may seat them:
 * those the TDP identifies, and, when the seminar's own justification covers everyone on it (`seminarCovers`, 12z Part
 * C), those who planned it outside the TDP. On a seminar in the TDP those still need their own, one at a time. */
export const seatsWithoutJustification = (c: TrainingCandidate, seminarCovers: boolean) =>
  c.needsThis || (seminarCovers && plannedOutside(c));

export const rowMatches = (r: PickRow, terms: string[]) => matchesTerms(terms, `${r.name} ${r.c?.position ?? ""} ${r.c?.division ?? ""}`);

interface Input {
  /** Everyone listed (in scope, ticked, or kept after being unticked), in the server's order. */
  listed: TrainingCandidate[];
  /** Ticked, or unticked since the view last changed: their rows stay whatever is folded. */
  stays: (id: string) => boolean;
  /** Selected but not among the candidates (shown by record id). */
  unlisted: string[];
  toRow: (id: string, c?: TrainingCandidate) => PickRow;
  showTrained: boolean;
  onToggleTrained: () => void;
  showSent: boolean;
  onToggleSent: () => void;
  /** Already sent, but outside the plan, so left out by the Plan A view (0 in the other view). */
  sentOffPlan: number;
  /** The search's words. */
  terms: string[];
  /** The row whose justification form is open: the search never hides it (what was typed would be lost). */
  formFor: string | null;
  /** "FY 2027", or "this fiscal year". */
  fyText: string;
  /** The candidates didn't load. */
  failed: boolean;
}

export interface PickView {
  /** What the checklist draws: groups with a row shown, and the folding groups whatever they show. */
  groups: PickGroup[];
  /** Everyone in any group, folded away or not. */
  everyone: number;
  /** Rows on screen before the search, and after it. */
  total: number;
  shown: number;
  /** Rows the closed groups hide that match the search. */
  hiddenMatches: number;
  /** Already trained, able to be ticked, and folded away. */
  trainedFolded: number;
  shownIds: Set<string>;
}

export function pickGroups(input: Input): PickView {
  const { listed, stays, toRow, terms, formFor, fyText, sentOffPlan } = input;
  const searching = terms.length > 0;
  const toRows = (list: TrainingCandidate[]) => list.map(c => toRow(c.employeeId, c));
  const found = (r: PickRow) => !searching || r.id === formFor || rowMatches(r, terms);
  // What a folding group shows, what it folds away, and how many of those the search would have found.
  const fold = (people: TrainingCandidate[], open: boolean, stay: (c: TrainingCandidate) => boolean) => {
    const visible = toRows(open ? people : people.filter(stay));
    const folded = open ? [] : toRows(people.filter(c => !stay(c)));
    return { size: people.length, visible, folded: folded.length, matching: searching ? folded.filter(r => rowMatches(r, terms)).length : 0 };
  };

  const unlisted = input.unlisted.map(id => toRow(id));
  const first = toRows(listed.filter(c => c.eligible && !trainedThisYear(c)));
  const trained = fold(listed.filter(c => c.eligible && trainedThisYear(c)), input.showTrained, c => mandatedHere(c) || stays(c.employeeId));
  const sent = fold(listed.filter(c => !c.eligible), input.showSent, c => stays(c.employeeId));

  // Under a closed group, so a search never seems to miss someone folded away.
  const matchNote = (n: number) => (n > 0 ? ` ${n} folded away ${n === 1 ? "matches" : "match"} the search.` : "");
  const offPlanNote = sentOffPlan > 0 ? ` ${sentOffPlan} more outside the plan: “All employees” above lists them.` : "";
  const trainedReason = input.showTrained
    ? "Already trained this fiscal year; they may still join another seminar."
    : trained.folded === 0
      ? "They already have a training this fiscal year; shown because their need for this one is mandated, or because they are ticked."
      : trained.visible.length === 0
        ? `They already have a training this fiscal year, so they aren't the priority. Open the list to see them; they can still be ticked.${matchNote(trained.matching)}`
        : `They already have a training this fiscal year, so only those with a mandated need for this one, and anyone ticked, are shown. Open the list for the other ${trained.folded === 1 ? "one" : trained.folded}, who can still be ticked.${matchNote(trained.matching)}`;
  const sentWhat = "Sent to another run of it or in an earlier year, or HR recorded it, so they can't be selected.";

  const candidates: (Omit<PickGroup, "rows"> & { visible: PickRow[]; draw: (rows: PickRow[]) => boolean })[] = [
    {
      key: "unlisted",
      label: input.failed ? "Selected" : "Selected, no longer with the office",
      reason: input.failed ? "The list didn't load, so they are shown by record id. Untick to take them off."
        : "On this seminar, but no longer with the office (every account archived), so they aren't offered for new seats. Untick to take them off, or send a representative from the attendance list.",
      visible: unlisted,
      draw: rows => rows.length > 0
    },
    {
      key: "first",
      label: `No training yet in ${fyText}`,
      reason: "Everyone should have at least one training a year, so they come first.",
      visible: first,
      draw: rows => rows.length > 0
    },
    {
      key: "trained",
      label: `Already has a training in ${fyText}`,
      reason: trainedReason,
      fold: { label: `Already trained this FY (${trained.size})`, open: input.showTrained, onToggle: input.onToggleTrained },
      visible: trained.visible,
      draw: () => trained.size > 0
    },
    sent.size > 0
      ? {
          key: "sent",
          label: "Already sent to this training",
          reason: `${sentWhat}${input.showSent ? "" : ` Open the list to see who, and when${sent.visible.length > 0 ? "; anyone ticked stays shown" : ""}.`}${offPlanNote}${matchNote(sent.matching)}`,
          fold: { label: `Already sent to this training (${sent.size})`, open: input.showSent, onToggle: input.onToggleSent },
          visible: sent.visible,
          draw: () => true
        }
      : {
          // Nobody in this view, but some outside the plan: without this line the Plan A view would read as if nobody went.
          key: "sent",
          label: "Already sent to this training",
          reason: `None of those whose Plan A lists this training.${offPlanNote}`,
          visible: [],
          draw: () => sentOffPlan > 0 && !searching
        }
  ];
  const groups = candidates.flatMap(({ visible, draw, ...g }) => {
    const rows = visible.filter(found);
    return draw(rows) ? [{ ...g, rows }] : [];
  });
  const shownIds = new Set(groups.flatMap(g => g.rows.map(r => r.id)));
  return {
    groups,
    everyone: unlisted.length + first.length + trained.size + sent.size,
    total: unlisted.length + first.length + trained.visible.length + sent.visible.length,
    shown: shownIds.size,
    hiddenMatches: trained.matching + sent.matching,
    trainedFolded: trained.folded,
    shownIds
  };
}
