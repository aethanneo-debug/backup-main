import {
  TRAINING_EVALUATION_BANDS,
  TrainingEvaluation,
  TrainingEvaluationRating,
  TrainingQualitativeRating
} from "../../../types";

/**
 * One row of GET /api/training/evaluations: a participant whose seminar has already
 * ended, with their evaluation if one has been started.
 *
 * Every descriptive field here is read from the employee and seminar records by the
 * server, so HR never retypes the trainee's name, position, division, the seminar title,
 * when it ran or who organised it — the report prints exactly what the system already
 * holds.
 */
export interface TrainingEvaluationQueueRow {
  trainingParticipantId: string;
  trainingProgramId: string;
  employeeId: string;
  employeeName: string;
  position: string;
  division: string;
  trainingTitle: string;
  dateConducted: string;
  dateEnded: string;
  organizer: string;
  participantStatus: string;
  evaluation: TrainingEvaluation | null;
}

/** Part I and Part II each have exactly five entries, in printed order. */
export const EVALUATION_ITEM_COUNT = 5;

export function blankRatings(): (TrainingEvaluationRating | null)[] {
  return Array.from({ length: EVALUATION_ITEM_COUNT }, () => null);
}

export function blankComments(): string[] {
  return Array.from({ length: EVALUATION_ITEM_COUNT }, () => "");
}

/** Pads or trims a stored array to the five printed slots. */
export function toFiveRatings(raw: (TrainingEvaluationRating | null)[] | undefined): (TrainingEvaluationRating | null)[] {
  return blankRatings().map((_, i) => {
    const v = Number((raw ?? [])[i]);
    return v === 1 || v === 2 || v === 3 || v === 4 ? (v as TrainingEvaluationRating) : null;
  });
}

export function toFiveComments(raw: string[] | undefined): string[] {
  return blankComments().map((_, i) => String((raw ?? [])[i] ?? ""));
}

/**
 * Mirror of the server's `evaluationTotals` so HR can watch the rating settle as they
 * tick. Display only — the server derives and stores these itself and ignores anything
 * the client sends, so the figure on the printed report can never disagree with the
 * boxes above it.
 */
export function deriveTotals(ratings: (TrainingEvaluationRating | null)[]): {
  overallRating: number;
  qualitativeRating: TrainingQualitativeRating;
} {
  const overallRating = ratings.reduce((sum, r) => sum + (r || 0), 0);
  const band = TRAINING_EVALUATION_BANDS.find(b => overallRating >= b.min && overallRating <= b.max);
  return { overallRating, qualitativeRating: band ? band.label : TRAINING_EVALUATION_BANDS[0].label };
}

/** Where a row sits in the queue. */
export type EvaluationState = "not-evaluated" | "draft" | "finalized";

export function evaluationState(row: TrainingEvaluationQueueRow): EvaluationState {
  if (!row.evaluation) return "not-evaluated";
  return row.evaluation.status === "Finalized" ? "finalized" : "draft";
}

/** House badge pattern (-50 bg, -700 text, -200 border), one tint per band. */
export const BAND_BADGE: Record<TrainingQualitativeRating, string> = {
  "Needs Improvement": "border-rose-200 bg-rose-50 text-rose-700",
  "Satisfactory": "border-amber-200 bg-amber-50 text-amber-700",
  "Very Satisfactory": "border-blue-200 bg-blue-50 text-blue-700",
  "Outstanding": "border-emerald-200 bg-emerald-50 text-emerald-700"
};

/** "2026-09-24" -> "September 24, 2026". Blank stays blank: paper forms keep their rules. */
export function longDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** The three rules the server enforces before it will accept a finalised report. */
export function finaliseBlockers(
  ratings: (TrainingEvaluationRating | null)[],
  supervisorName: string,
  dateOfEvaluation: string
): string[] {
  const blockers: string[] = [];
  const unscored = ratings.reduce<number[]>((acc, r, i) => (r === null ? [...acc, i + 1] : acc), []);
  if (unscored.length > 0) {
    blockers.push(
      `Score all five statements before finalising — ${
        unscored.length === 1 ? `statement ${unscored[0]} is` : `statements ${unscored.join(", ")} are`
      } still blank.`
    );
  }
  if (!supervisorName.trim()) blockers.push("Enter the immediate supervisor's name before finalising.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfEvaluation)) blockers.push("Enter the date of evaluation before finalising.");
  return blockers;
}

/** The payload POST /api/training/evaluations accepts. No derived fields — it ignores them. */
export interface EvaluationSavePayload {
  trainingParticipantId: string;
  dateOfEvaluation: string;
  supervisorName: string;
  supervisorPosition: string;
  ratings: (TrainingEvaluationRating | null)[];
  comments: string[];
  status: TrainingEvaluation["status"];
}
