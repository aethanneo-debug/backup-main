// An employee's training history (the instructor's review, R11): every seminar seat and every training HR recorded,
// one row each, newest first, built from what the records already hold (no money is worked out a second way). HR and
// the Administrator see each row in full. The employee sees their own, without what other people's records hold: a
// group report's lines and totals (12v decision 8) or who went in their place (12z Part B). Used by the server; tested.
import type { EmployeeTrainingHistory, TrainingHistoryRecord, TrainingHistoryRow, TrainingHistorySeminar } from "./types";
import { advancesCovering, currentAdvance, isGroupAdvance, portionCentavos, reportCovering, type CoverableReport, type DatedAdvance } from "./advanceCoverage";
import { centavos, pesos } from "./liquidationMoney";
import { cleanText } from "./inputText";
import { fiscalYearSpan, isoDay, type CoverageFiscalYear } from "./trainingCoverage";

export interface HistorySeat {
  id: string;
  trainingProgramId: string;
  employeeId: string;
  status?: string;
  attendance?: string;
  replacedBy?: { fullName?: string } | null;
  replaces?: string;
}
export interface HistoryProgram {
  id: string;
  fiscalYear?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  venue?: string;
  facilitator?: string;
  totalHours?: number;
  durationDays?: number;
  archivedBeforeUse?: boolean;
}
export interface HistoryCertificate { participantId: string; name?: string; uploadedAt?: string; supersededAt?: string }
export interface HistoryAdvance extends DatedAdvance {
  advanceNo?: string;
  employeeName?: string;
  dvNo?: string;
  dvDate?: string;
  refundOrNo?: string;
}
export interface HistoryReport extends CoverableReport {
  submissionNo?: string;
  status?: string;
  claimType?: string;
  totalSpent?: number | string;
  remainingBalance?: number | string;
  refundOrNo?: string;
  fundReturn?: { amount?: number | string; orNo?: string } | null;
}
export interface HistoryTrainingRecord {
  id: string;
  employeeId: string;
  title?: string;
  organizer?: string;
  dateConducted?: string;
  trainingHours?: number | string;
  status?: string;
  certificateFilename?: string;
  remarks?: string;
}

export interface HistoryInput {
  employee: { id: string; employeeId: string; fullName: string; position?: string; division?: string };
  /** The internal id a key names (internal id first, then staff code, as the TDP rule reads people), or the key. */
  personOf: (employeeKey: string) => string;
  /** The internal id an HR record's key names. Those store staff codes, so a staff code is read first: under a staff code
   * set to another record's internal id (7j), a record stays with the one it was entered for. */
  recordOwnerOf: (employeeKey: string) => string;
  /** A person's name by any key (holders, representatives), or "". */
  nameOf: (employeeKey: string) => string;
  seats: unknown;
  programs: unknown;
  certificates: unknown;
  advances: unknown;
  reports: unknown;
  records: unknown;
  fiscalYears: unknown;
  /** HR or the Administrator: every row in full. */
  full: boolean;
  /** One year, or null for all. */
  fiscalYear: string | null;
}

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x) => !!x && typeof x === "object") : []) as T[];
const text = (v: unknown) => (typeof v === "string" ? v : "");
const money = (v: unknown) => pesos(Math.max(0, centavos(v as number | string)));

/** The fiscal year a date falls in, by the years' spans as the coverage rule reads them (12s), or "". */
function yearOf(date: string, years: CoverageFiscalYear[]): string {
  const day = isoDay(date);
  if (!day) return "";
  const hit = years.find((y) => {
    const span = fiscalYearSpan(y);
    return !!span && span.start <= day && day <= span.end;
  });
  return hit ? String(hit.label) : "";
}

/** A seat's records, as one row of the history or of a seminar's report (src/trainingReports.ts) shows them. */
export interface SeatRecordsInput {
  seats: HistorySeat[];
  certificates: HistoryCertificate[];
  advances: HistoryAdvance[];
  reports: HistoryReport[];
  nameOf: (employeeKey: string) => string;
  /** HR or the Administrator: who went in whose place, and a group report's figures. */
  full: boolean;
}
export type SeatRecords = Pick<TrainingHistorySeminar, "attendance" | "seat" | "replacedBy" | "inLieuOf" | "certificate" | "advance" | "report">;

/** The money a report says was handed back: the leftover Finance recorded at validation, or, until then and on older
 * reports, the balance the employee entered with its OR. */
export function reportRefund(report: HistoryReport): { amount: number; orNo: string } | null {
  if (report.fundReturn && centavos(report.fundReturn.amount as number | string) > 0) {
    return { amount: money(report.fundReturn.amount), orNo: text(report.fundReturn.orNo) };
  }
  if (report.refundOrNo && centavos(report.remainingBalance as number | string) > 0) {
    return { amount: money(report.remainingBalance), orNo: text(report.refundOrNo) };
  }
  return null;
}

/** One seat's place on its seminar, its attendance, the certificate on file, the advance that stands for it and the
 * report that settles it: the one way the history and a seminar's report describe a seat. */
export function seatRecords(seat: HistorySeat, input: SeatRecordsInput): SeatRecords {
  const row: SeatRecords = {
    attendance: seat.attendance === "Attended" || seat.attendance === "Did not attend" ? seat.attendance : "",
    seat: seat.status === "Cancelled" ? (seat.replacedBy ? "replaced" : "cancelled") : "enrolled"
  };
  if (input.full && seat.replacedBy?.fullName) row.replacedBy = text(seat.replacedBy.fullName);
  if (input.full && seat.replaces) {
    const original = input.seats.find((s) => s.id === seat.replaces);
    const name = original ? input.nameOf(original.employeeId) : "";
    if (name) row.inLieuOf = name;
  }

  const certificate = input.certificates.find((c) => c.participantId === seat.id && !c.supersededAt);
  if (certificate) row.certificate = { name: text(certificate.name), uploadedAt: text(certificate.uploadedAt) };

  const advance = currentAdvance(advancesCovering(input.advances, seat.id));
  if (advance) {
    const group = isGroupAdvance(advance);
    const isHolder = advance.activityId === seat.id;
    // A covered member's own copy: their share, not the group's total, head count or refund OR, which is the holder's
    // receipt (12v decision 8; the team's decision for the history, 2026-11-01). They do learn when it came back.
    const covered = group && !isHolder && !input.full;
    const share = pesos(portionCentavos(advance, seat.id));
    // The name on the advance: a staff code can be edited and reused (7j), and the holder stays who they were.
    const holder = cleanText(text(advance.employeeName)).slice(0, 200) || input.nameOf(String(advance.employeeId ?? ""));
    row.advance = {
      advanceNo: text(advance.advanceNo),
      status: text(advance.status),
      amount: covered ? share : money(advance.amount),
      ...(group ? { share } : {}),
      ...(advance.dvNo ? { dvNo: text(advance.dvNo), dvDate: text(advance.dvDate) } : {}),
      ...(group ? { group: { holder, ...(covered ? {} : { members: (advance.covers ?? []).length }), isHolder } } : {}),
      ...(advance.refundOrNo && !covered ? { refundOrNo: text(advance.refundOrNo) } : {}),
      ...(advance.refundedAt ? { refundedAt: text(advance.refundedAt) } : {})
    };
  }

  const report = reportCovering(input.reports, input.advances, seat.id);
  if (report) {
    const ofGroup = report.activityId !== seat.id;
    if (ofGroup && !input.full) {
      // A covered member sees the group report's number and status only (12v decision 8).
      row.report = { submissionNo: text(report.submissionNo), status: text(report.status), group: true };
    } else {
      const back = reportRefund(report);
      row.report = {
        submissionNo: text(report.submissionNo),
        status: text(report.status),
        ...(report.claimType ? { claimType: text(report.claimType) } : {}),
        ...(report.totalSpent !== undefined && report.totalSpent !== null ? { totalSpent: money(report.totalSpent) } : {}),
        ...(back ? { refund: back } : {}),
        group: ofGroup
      };
    }
  }
  return row;
}

/** A seminar's hours: as stored, else 8 a day. */
export const programHours = (program: HistoryProgram) => Number(program.totalHours) || (Number(program.durationDays) || 0) * 8;

export function employeeTrainingHistory(input: HistoryInput): EmployeeTrainingHistory {
  const me = input.employee.id;
  const programs = new Map(list<HistoryProgram>(input.programs).map((p) => [p.id, p]));
  const seats = list<HistorySeat>(input.seats);
  const records: SeatRecordsInput = {
    seats,
    certificates: list<HistoryCertificate>(input.certificates),
    advances: list<HistoryAdvance>(input.advances),
    reports: list<HistoryReport>(input.reports),
    nameOf: input.nameOf,
    full: input.full
  };
  const years = list<CoverageFiscalYear>(input.fiscalYears);
  const rows: TrainingHistoryRow[] = [];

  for (const seat of seats) {
    if (typeof seat.employeeId !== "string" || input.personOf(seat.employeeId) !== me) continue;
    const program = programs.get(seat.trainingProgramId);
    // A seminar archived before it was held never happened, and nor did its seats.
    if (!program || program.archivedBeforeUse || seat.status === "Archived") continue;

    rows.push({
      kind: "seminar",
      participantId: seat.id,
      programId: program.id,
      fiscalYear: String(program.fiscalYear ?? ""),
      title: text(program.title),
      startDate: text(program.startDate),
      endDate: text(program.endDate),
      venue: text(program.venue),
      hours: programHours(program),
      // Stored as typed (unlike the title and venue), so cleaned and bounded here.
      facilitator: cleanText(program.facilitator).slice(0, 200),
      ...seatRecords(seat, records)
    });
  }

  for (const r of list<HistoryTrainingRecord>(input.records)) {
    if (typeof r.employeeId !== "string" || input.recordOwnerOf(r.employeeId) !== me) continue;
    const date = text(r.dateConducted);
    const record: TrainingHistoryRecord = {
      kind: "record",
      id: text(r.id),
      fiscalYear: yearOf(date, years),
      title: text(r.title),
      organizer: text(r.organizer),
      dateConducted: date,
      hours: Math.max(0, Number(r.trainingHours) || 0),
      status: text(r.status),
      certificateFilename: text(r.certificateFilename),
      ...(r.remarks ? { remarks: text(r.remarks) } : {})
    };
    rows.push(record);
  }

  const fiscalYears = [...new Set(rows.map((r) => r.fiscalYear).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const dated = (r: TrainingHistoryRow) => isoDay(r.kind === "seminar" ? r.startDate : r.dateConducted);
  const shown = rows
    .filter((r) => !input.fiscalYear || r.fiscalYear === input.fiscalYear)
    // Newest first; undated last; then by title.
    .sort((a, b) => (dated(b) || "").localeCompare(dated(a) || "") || a.title.localeCompare(b.title));

  return {
    employee: {
      id: input.employee.id,
      employeeId: input.employee.employeeId,
      fullName: input.employee.fullName,
      position: input.employee.position || "",
      division: input.employee.division || ""
    },
    fiscalYear: input.fiscalYear,
    fiscalYears,
    rows: shown
  };
}
