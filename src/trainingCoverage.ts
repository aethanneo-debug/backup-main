// "At least one training per year per employee" (the user's rule, 2026-10-23). It replaced
// "at most one seminar per fiscal year" (the old Rule B): an employee may now join several
// seminars in a year, and the system works toward everyone having at least one.
//
// This module decides what counts toward an employee's fiscal year, so the three places that
// need it agree: the participant picker's ranking (no training yet comes first), auto-enrolment
// of a new or edited employee (only someone with none), and Programs & Budget's coverage panel.
// Tested in tests/trainingCoverage.test.ts.
//
// What counts (the user's choice):
// - a seminar of that fiscal year they are enrolled in, unless the enrolment was cancelled or
//   archived, or HR marked them "Did not attend". A seminar still to come counts: they are
//   scheduled.
// - a training HR recorded in Trainings and Seminar, dated within the fiscal year's stored span
//   (1 January to 31 December so far), unless rejected. HR's record of a seminar already counted
//   is listed once.
//
// Unlike Plan D, a record dated after a year was opened early but before its 1 January counts
// toward the earlier calendar year, not the new one: Plan D also counts from the day a need was
// listed. FY 2027 was opened in October 2026 only for testing (the user, 2026-10-23: "leave it
// be"), so this matters only until years are opened on 1 January.
import type { TrainingCoverage, TrainingCoverageEntry } from "./types";

export interface CoverageEmployee {
  id: string;
  employeeId?: string;
  fullName?: string;
  position?: string;
  division?: string;
  isActive?: boolean;
}

export interface CoverageEnrolment {
  employeeId: string;
  trainingProgramId: string;
  status?: string;
  attendance?: string;
}

export interface CoverageProgram {
  id: string;
  title?: string;
  fiscalYear?: string | number;
}

export interface CoverageRecord {
  employeeId: string;
  title?: string;
  dateConducted?: string;
  status?: string;
}

export interface CoverageFiscalYear {
  label: string;
  start_date?: string;
  end_date?: string;
}

export interface CoverageData {
  enrolments: ReadonlyArray<CoverageEnrolment>;
  programs: ReadonlyArray<CoverageProgram>;
  records: ReadonlyArray<CoverageRecord>;
}

/** The trainings that count toward one employee's fiscal year, by title. */
export interface YearTrainings {
  seminars: string[];
  records: string[];
}

/** "YYYY-MM-DD" from a stored date: ISO, or the "MM/DD/YYYY" the PDS parser writes. */
function isoDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

/** The fiscal year's first and last day: its stored dates, else the calendar year its label
 * names. null when neither is known. */
export function fiscalYearSpan(fy: CoverageFiscalYear): { start: string; end: string } | null {
  const year = /^\d{4}$/.test(String(fy.label)) ? String(fy.label) : null;
  const start = isoDay(fy.start_date) || (year ? `${year}-01-01` : null);
  const end = isoDay(fy.end_date) || (year ? `${year}-12-31` : null);
  return start && end ? { start, end } : null;
}

const UNCOUNTED_ENROLMENT = new Set(["Cancelled", "Archived"]);

/** A title as compared: case, punctuation and spacing ignored (as the server's normalizeTitle). */
const titleKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * A counter for one fiscal year: give it an employee and it lists the trainings that count
 * toward that year. Both forms of the employee's id are matched (the record id enrolments
 * store, and the staff code older records use). `excludeProgramId` leaves out the seminar
 * being staffed, so the picker counts only their other trainings.
 */
export function yearTrainingCounter(data: CoverageData, fy: CoverageFiscalYear, excludeProgramId?: string) {
  const label = String(fy.label);
  const span = fiscalYearSpan(fy);
  const yearPrograms = new Map(
    (data.programs ?? []).filter(p => p && String(p.fiscalYear) === label).map(p => [p.id, p] as const)
  );

  return (employee: Pick<CoverageEmployee, "id" | "employeeId">): YearTrainings => {
    const forms = [employee.id, employee.employeeId].filter(Boolean) as string[];
    const seminars: string[] = [];
    for (const e of data.enrolments ?? []) {
      if (!e || !forms.includes(e.employeeId)) continue;
      if (UNCOUNTED_ENROLMENT.has(String(e.status)) || e.attendance === "Did not attend") continue;
      if (excludeProgramId && e.trainingProgramId === excludeProgramId) continue;
      const program = yearPrograms.get(e.trainingProgramId);
      if (program) seminars.push(String(program.title || "Seminar"));
    }
    const records: string[] = [];
    if (span) {
      // HR's own record of a seminar already counted above is the same training, listed once.
      const seen = new Set(seminars.map(titleKey));
      for (const r of data.records ?? []) {
        if (!r || !forms.includes(r.employeeId) || r.status === "Rejected") continue;
        const day = isoDay(r.dateConducted);
        if (!day || day < span.start || day > span.end) continue;
        const title = String(r.title || "Training");
        if (seen.has(titleKey(title))) continue;
        seen.add(titleKey(title));
        records.push(title);
      }
    }
    return { seminars, records };
  };
}

/** How many of the active employees have at least one training in the fiscal year, and who
 * doesn't yet, by name. */
export function trainingCoverage(
  employees: ReadonlyArray<CoverageEmployee>,
  data: CoverageData,
  fy: CoverageFiscalYear
): TrainingCoverage {
  const count = yearTrainingCounter(data, fy);
  const active = (employees ?? []).filter(e => e && e.isActive !== false);
  const withoutTraining: TrainingCoverageEntry[] = active
    .filter(e => {
      const t = count(e);
      return t.seminars.length + t.records.length === 0;
    })
    .map(e => ({
      id: e.id,
      employeeId: String(e.employeeId || ""),
      fullName: String(e.fullName || e.employeeId || e.id),
      position: String(e.position || ""),
      division: String(e.division || "")
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  return { fiscalYear: String(fy.label), total: active.length, covered: active.length - withoutTraining.length, withoutTraining };
}
