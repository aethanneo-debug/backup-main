// The training reports in Generated Reports (the instructor's review, R11): one seminar's report, and a fiscal year's
// completed seminars. Each seat is described as the history describes it to HR (`seatRecords`). Money comes from what
// already computes it: the training budget (`seminarBudget`, passed in) for a seminar's allocation and spending, and
// the advances' and reports' own amounts, each record counted once. Used by the server; tested.
import type { CompletedTrainingProgram, CompletedTrainingPrograms, TrainingProgramReport, TrainingProgramReportRow } from "./types";
import { advancesCovering, reportCovering } from "./advanceCoverage";
import { centavos, pesos } from "./liquidationMoney";
import { cleanText, isCalendarDate } from "./inputText";
import { isoDay } from "./trainingCoverage";
import {
  programHours, reportRefund, seatRecords,
  type HistoryAdvance, type HistoryCertificate, type HistoryProgram, type HistoryReport, type HistorySeat, type SeatRecordsInput
} from "./trainingHistory";

export interface ReportProgram extends HistoryProgram {
  startTime?: string;
  endTime?: string;
  maxParticipants?: number | string;
  archivedAt?: string | null;
}
export interface ReportPerson { id: string; employeeId: string; fullName: string; position?: string; division?: string }
/** The training budget's figures for a seminar (`seminarBudget`). */
export interface ReportBudget { allocated: number; spent: number; outstanding: number; returned: number; released: number }

export interface ProgramReportInput {
  program: ReportProgram;
  /** The staff record a seat's key names (internal id first, then staff code), or null. */
  personOf: (employeeKey: string) => ReportPerson | null;
  /** A person's name by any key (a group's holder, a representative's original), or "". */
  nameOf: (employeeKey: string) => string;
  seats: unknown;
  certificates: unknown;
  advances: unknown;
  reports: unknown;
  budget: ReportBudget;
  /** Manila's calendar day, YYYY-MM-DD. */
  today: string;
}

export interface CompletedInput {
  fiscalYear: string;
  programs: unknown;
  seats: unknown;
  budgetOf: (program: ReportProgram) => Pick<ReportBudget, "allocated" | "spent">;
  today: string;
}

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x) => !!x && typeof x === "object") : []) as T[];
const text = (v: unknown) => (typeof v === "string" ? v : "");
const sum = (amounts: unknown[]) => pesos(amounts.reduce<number>((s, a) => s + Math.max(0, centavos(a as number | string)), 0));

/** Finance's validation: "Completed"; "Approved" on reports the Division Chief approved under the old rules. */
const VALIDATED = new Set(["Completed", "Approved"]);
/** Cash that left Finance: still out, liquidated, or handed back in full. */
const RELEASED = new Set(["Released", "Liquidated", "Refunded"]);
/** A seat on the roster: not taken off (Cancelled, a representative's original included) or archived with it. */
const onRoster = (s: HistorySeat) => s.status !== "Cancelled" && s.status !== "Archived";

/** Where a seminar stands by its dates on Manila's calendar. It is under way on its last day, and ended from the day
 * after; one without dates hasn't started. Dates are read as the rest of the server reads them (`isoDay`). */
export function programWhen(program: ReportProgram, today: string): "upcoming" | "ongoing" | "ended" {
  const day = (v: unknown) => { const d = isoDay(v); return d && isCalendarDate(d) ? d : ""; };
  const start = day(program.startDate);
  const end = day(program.endDate) || start;
  if (end && end < today) return "ended";
  if (start && start <= today) return "ongoing";
  return "upcoming";
}

const SEAT_ORDER = { enrolled: 0, replaced: 1, cancelled: 2 } as const;

export function trainingProgramReport(input: ProgramReportInput): TrainingProgramReport {
  const program = input.program;
  const allSeats = list<HistorySeat>(input.seats);
  const advances = list<HistoryAdvance>(input.advances);
  const reports = list<HistoryReport>(input.reports);
  const records: SeatRecordsInput = {
    seats: allSeats,
    certificates: list<HistoryCertificate>(input.certificates),
    advances,
    reports,
    nameOf: input.nameOf,
    full: true
  };
  // Every seat it has had but those archived with it (a seminar archived before use has no report at all).
  const seats = allSeats.filter((s) => s.trainingProgramId === program.id && s.status !== "Archived");

  const rows: TrainingProgramReportRow[] = seats
    .map((seat) => {
      const person = typeof seat.employeeId === "string" ? input.personOf(seat.employeeId) : null;
      return {
        participantId: seat.id,
        employeeId: text(person?.employeeId),
        fullName: text(person?.fullName) || "No staff record",
        position: text(person?.position),
        division: text(person?.division),
        ...seatRecords(seat, records)
      };
    })
    .sort((a, b) => SEAT_ORDER[a.seat] - SEAT_ORDER[b.seat] || a.fullName.localeCompare(b.fullName));

  // The seminar's records, each once: a group's advance and report cover several seats.
  const seatAdvances = new Map<string, HistoryAdvance>();
  const seatReports = new Set<HistoryReport>();
  for (const seat of seats) {
    for (const a of advancesCovering(advances, seat.id)) seatAdvances.set(a.id, a);
    const report = reportCovering(reports, advances, seat.id);
    if (report) seatReports.add(report);
  }
  const released = [...seatAdvances.values()].filter((a) => RELEASED.has(a.status));
  const validated = [...seatReports].filter((r) => VALIDATED.has(String(r.status)));
  const enrolled = rows.filter((r) => r.seat === "enrolled");

  return {
    program: {
      id: program.id,
      fiscalYear: String(program.fiscalYear ?? ""),
      title: text(program.title),
      startDate: text(program.startDate),
      endDate: text(program.endDate),
      startTime: text(program.startTime),
      endTime: text(program.endTime),
      venue: text(program.venue),
      // Stored as typed (unlike the title and venue), so cleaned and bounded here before a report prints it.
      facilitator: cleanText(program.facilitator).slice(0, 200),
      hours: programHours(program),
      seats: Math.max(0, Number(program.maxParticipants) || 0),
      when: programWhen(program, input.today),
      archived: !!program.archivedAt
    },
    budget: {
      allocated: pesos(centavos(input.budget.allocated)),
      spent: pesos(centavos(input.budget.spent)),
      outstanding: pesos(centavos(input.budget.outstanding)),
      // An open seminar releases as it goes, a closed one returns what it didn't take: never both.
      back: sum([input.budget.returned, input.budget.released])
    },
    asOf: input.today,
    rows,
    totals: {
      enrolled: enrolled.length,
      attended: enrolled.filter((r) => r.attendance === "Attended").length,
      didNotAttend: enrolled.filter((r) => r.attendance === "Did not attend").length,
      notRecorded: enrolled.filter((r) => !r.attendance).length,
      certificates: enrolled.filter((r) => r.certificate).length,
      replaced: rows.filter((r) => r.seat === "replaced").length,
      cancelled: rows.filter((r) => r.seat === "cancelled").length,
      advanced: sum(released.map((a) => a.amount)),
      handedBack: sum([
        ...validated.map((r) => reportRefund(r)?.amount ?? 0),
        ...released.filter((a) => a.status === "Refunded").map((a) => a.amount)
      ]),
      reports: seatReports.size,
      validated: validated.length
    }
  };
}

/** A fiscal year's seminars that have ended, newest first, leaving out any archived before use (it was never held). */
export function completedTrainingPrograms(input: CompletedInput): CompletedTrainingPrograms {
  const seats = list<HistorySeat>(input.seats);
  const rows: CompletedTrainingProgram[] = list<ReportProgram>(input.programs)
    .filter((p) => String(p.fiscalYear ?? "") === input.fiscalYear && !p.archivedBeforeUse && programWhen(p, input.today) === "ended")
    .map((p) => {
      const roster = seats.filter((s) => s.trainingProgramId === p.id && onRoster(s));
      const budget = input.budgetOf(p);
      return {
        id: p.id,
        title: text(p.title),
        startDate: text(p.startDate),
        endDate: text(p.endDate),
        venue: text(p.venue),
        hours: programHours(p),
        enrolled: roster.length,
        attended: roster.filter((s) => s.attendance === "Attended").length,
        allocated: pesos(centavos(budget.allocated)),
        spent: pesos(centavos(budget.spent)),
        archived: !!p.archivedAt
      };
    })
    .sort((a, b) => (b.endDate || b.startDate).localeCompare(a.endDate || a.startDate) || b.startDate.localeCompare(a.startDate) || a.title.localeCompare(b.title));

  return {
    fiscalYear: input.fiscalYear,
    asOf: input.today,
    rows,
    totals: {
      programs: rows.length,
      enrolled: rows.reduce((s, r) => s + r.enrolled, 0),
      attended: rows.reduce((s, r) => s + r.attended, 0),
      hours: rows.reduce((s, r) => s + r.hours, 0),
      allocated: sum(rows.map((r) => r.allocated)),
      spent: sum(rows.map((r) => r.spent))
    }
  };
}
