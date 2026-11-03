// A training HR records for an employee (Trainings and Seminar; the instructor's review, R11), and HR's review of one
// (known-issues 12r): what the form asks and the server checks, the same on both, and whether a record counts. The form
// used to send field names the server didn't read, so every record got 8 hours, no date and a file name nobody chose. A
// record's certificate is only a name: no file is kept with it. Used by the server and the screens; tested.
import { cleanText, isCalendarDate, RAW_TEXT_MAX } from "./inputText";

export const TRAINING_TITLE_MAX = 300;
export const TRAINING_ORGANIZER_MAX = 200;
export const TRAINING_CERTIFICATE_NAME_MAX = 200;
export const TRAINING_HOURS_MAX = 1000;
export const TRAINING_REMARKS_MAX = 500;
/** No training on a staff record goes back further than this. */
export const TRAINING_EARLIEST_DATE = "1950-01-01";

/**
 * Whether an HR record counts: toward the year's training (12s), Plan D's accomplished needs, and the "already sent"
 * check that keeps someone off a training they had. A record HR returned (it is wrong, and HR records the corrected one)
 * or rejected doesn't; the user's decision of 2026-11-03, replacing "only Rejected stops a record counting". It stays in
 * the history, marked, with HR's reason, and the printed PDS leaves it out.
 */
export const recordCounts = (record: { status?: unknown } | null | undefined): boolean =>
  !!record && record.status !== "Returned" && record.status !== "Rejected";

export interface TrainingRecordFields {
  title: string;
  organizer: string;
  dateConducted: string;
  trainingHours: number;
  certificateFilename: string;
}

/** What a form or a request brings, checked: the fields as they will be stored, or why they can't be. */
export function readTrainingRecord(raw: unknown, today: string): TrainingRecordFields | { problem: string } {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = cleanText(body.title);
  if (!title) return { problem: "Enter the training's title." };
  if (title.length > TRAINING_TITLE_MAX) return { problem: `The training's title can be at most ${TRAINING_TITLE_MAX} characters.` };
  const organizer = cleanText(body.organizer);
  if (!organizer) return { problem: "Enter the agency that organized it." };
  if (organizer.length > TRAINING_ORGANIZER_MAX) return { problem: `The organizing agency can be at most ${TRAINING_ORGANIZER_MAX} characters.` };
  const dateConducted = typeof body.dateConducted === "string" ? body.dateConducted.trim() : "";
  if (!isCalendarDate(dateConducted) || dateConducted < TRAINING_EARLIEST_DATE) return { problem: "Enter the date it was conducted." };
  if (dateConducted > today) return { problem: "The date it was conducted can't be in the future." };
  // Digits with up to 2 decimals, typed or as a number: nothing that merely converts to one ("0x10", "1e3", true, [8]).
  const rawHours = body.trainingHours;
  const typedHours = typeof rawHours === "number" ? String(rawHours) : typeof rawHours === "string" ? rawHours.trim() : "";
  const hours = /^\d{1,4}(\.\d{1,2})?$/.test(typedHours) ? Number(typedHours) : NaN;
  if (!(hours > 0) || hours > TRAINING_HOURS_MAX) {
    return { problem: `Enter its credit hours: more than 0, up to ${TRAINING_HOURS_MAX.toLocaleString("en-US")}, with at most 2 decimals.` };
  }
  // (cleanText reads nothing past RAW_TEXT_MAX, so a name that long would otherwise be dropped without a word.)
  const rawName = body.certificateFilename;
  const certificateFilename = cleanText(rawName);
  if ((typeof rawName === "string" && rawName.length > RAW_TEXT_MAX) || certificateFilename.length > TRAINING_CERTIFICATE_NAME_MAX) {
    return { problem: `The certificate's file name can be at most ${TRAINING_CERTIFICATE_NAME_MAX} characters.` };
  }
  return { title, organizer, dateConducted, trainingHours: hours, certificateFilename };
}

export type TrainingReviewStatus = "Verified" | "Returned";

/** HR's review of a record: verified, or returned with the reason. */
export function readTrainingReview(raw: unknown): { status: TrainingReviewStatus; remarks: string } | { problem: string } {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (body.status !== "Verified" && body.status !== "Returned") return { problem: "A review either verifies the record or returns it." };
  const remarks = cleanText(body.remarks);
  if (remarks.length > TRAINING_REMARKS_MAX) return { problem: `The remarks can be at most ${TRAINING_REMARKS_MAX} characters.` };
  if (body.status === "Returned" && !remarks) return { problem: "Say why the record is being returned." };
  return { status: body.status, remarks };
}
