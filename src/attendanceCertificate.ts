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
    const day = storedDay(value);
    if (day) return day;
  }
  return "";
}

/** A stored date's day (YYYY-MM-DD), read only from text, so a damaged value can't throw; "" when it isn't one. */
function storedDay(value: unknown): string {
  const day = typeof value === "string" ? value.slice(0, 10) : "";
  return isCalendarDate(day) ? day : "";
}

/** The day a seminar begins: the earlier of its start and end dates (one stored out of order before 12x's date checks
 * begins on the earlier), either when only one is a date. "" when neither is. Asking for a cash advance closes on it,
 * and a request still waiting expires on it (the user's rule of 2026-11-14), so it never comes after the last day. */
export function seminarFirstDay(seminar: { startDate?: unknown; endDate?: unknown } | null | undefined): string {
  const start = storedDay(seminar?.startDate), end = storedDay(seminar?.endDate);
  return start && end ? (start <= end ? start : end) : start || end;
}

/** A moment on Manila's clock (UTC+8, no daylight saving): its day (YYYY-MM-DD) and time (HH:MM). */
export function manilaMoment(ms: number): { day: string; time: string } {
  const iso = new Date(ms + 8 * 60 * 60 * 1000).toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Whether a seminar has officially ended, on Manila's clock (the user's rule of 2026-11-14: HR records the attendance
 * only then): its last day's end time has passed, or, with no end time on record, its last day has. A seminar with no
 * dates hasn't. */
export function seminarHasEnded(seminar: { startDate?: unknown; endDate?: unknown; endTime?: unknown } | null | undefined,
  now: { day: string; time: string }): boolean {
  const last = seminarLastDay(seminar);
  if (!last || !isCalendarDate(now.day)) return false;
  if (now.day !== last) return now.day > last;
  const end = typeof seminar?.endTime === "string" && CLOCK.test(seminar.endTime) ? seminar.endTime : "";
  return !!end && CLOCK.test(now.time) && now.time >= end;
}

/** "5:00 PM" for "17:00"; "" for anything that isn't a time. */
export function clockText(time: unknown): string {
  if (typeof time !== "string" || !CLOCK.test(time)) return "";
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
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
