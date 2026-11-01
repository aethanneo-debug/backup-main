// A seminar's certificate of attendance (the instructor's review, R4): uploaded once, and used three ways.
// The attendee uploads it from their seminar card, HR records "Attended" on it, and their liquidation report
// carries it. HR or the Administrator uploads it for staff with no Personnel login.
import { fileExtension } from "./fileRules";
import { cleanText, isCalendarDate } from "./inputText";

/** Each upload stays on disk, as a report's replaced file does, so one seat can't fill it. */
export const MAX_CERTIFICATE_UPLOADS = 5;
/** HR or the Administrator can go past that, so a seat at the limit isn't stuck, but only this far. */
export const MAX_OFFICER_CERTIFICATE_UPLOADS = 10;

/** The day a seminar ends: the first day of a one-day seminar with no end date. "" when neither is a date. */
export function seminarLastDay(seminar: { startDate?: unknown; endDate?: unknown } | null | undefined): string {
  for (const value of [seminar?.endDate, seminar?.startDate]) {
    const day = String(value ?? "").slice(0, 10);
    if (isCalendarDate(day)) return day;
  }
  return "";
}

export interface CertificateSeat {
  /** The enrolment's status. */
  status?: string;
  attendance?: string | null;
  seminarArchived: boolean;
  lastDay: string;
  today: string;
  onFile: boolean;
  /** How many have been uploaded for this seat, replaced ones included. */
  uploads: number;
  /** HR or the Administrator is the one uploading, not the employee. */
  byOfficer?: boolean;
}

/** Why a certificate can't be uploaded for this seat now, or "". It can from the seminar's last day, when
 * it is handed out. It can after "Did not attend" (HR corrects that on it), and on a seat recorded
 * "Attended" with none on file (from before the rule). Once "Attended" stands on one, it is replaced only
 * when a report's reviewer asks for a new copy. */
export function certificateUploadProblem(seat: CertificateSeat): string {
  if (seat.status === "Cancelled" || seat.status === "Archived") return "This enrolment is no longer on the seminar.";
  if (seat.seminarArchived) return "This seminar is archived.";
  if (!seat.lastDay) return "This seminar has no dates yet.";
  if (seat.today < seat.lastDay) return `The certificate can be uploaded from ${seat.lastDay}, the seminar's last day.`;
  if (seat.attendance === "Attended" && seat.onFile) {
    return "HR recorded the attendance on this certificate, so it can't be replaced here. If a reviewer asks for a new copy, it goes in the report's correction.";
  }
  const limit = seat.byOfficer ? MAX_OFFICER_CERTIFICATE_UPLOADS : MAX_CERTIFICATE_UPLOADS;
  if (seat.uploads >= limit) {
    // (HR's or the Administrator's uploads count too, so the count can be past the employee's limit.)
    if (!seat.byOfficer && seat.uploads < MAX_OFFICER_CERTIFICATE_UPLOADS) {
      return `You can upload the certificate up to ${MAX_CERTIFICATE_UPLOADS} times, and it has been uploaded ${seat.uploads} times. Send it to HR, who can upload it for you.`;
    }
    return `The certificate has been uploaded ${seat.uploads} times, the most allowed.${seat.byOfficer ? "" : " If the one on file isn't right, tell HR."}`;
  }
  return "";
}

/** What a certificate is called on a report: the server's words, never the name it was uploaded under,
 * since a group's holder sees it too. The extension is what the file is, which the viewer checks. */
export function certificateDocumentName(employeeName: unknown, type: unknown): string {
  const name = cleanText(employeeName).slice(0, 120);
  return `Certificate of Attendance${name ? ` - ${name}` : ""}.${fileExtension(type)}`;
}
