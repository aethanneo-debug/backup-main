import {
  TrainingNeedCategory,
  TrainingNeedRow,
  TrainingPlanEmployee,
  TrainingPlanOffice,
  TRAINING_NEED_CATEGORIES,
  TRAINING_NEED_COLUMN_LABELS
} from "../../../types";
import { longDate } from "../evaluation/evaluationQueue";

/** GET /api/training/needs, kept whole: the plan year, the date it was judged at, the sheet. */
export interface PlanDSnapshot {
  fiscalYear: string;
  /** YYYY-MM-DD — the date the server actually judged against, not what was typed. */
  asOf: string;
  offices: TrainingPlanOffice[];
}

/** One printed line of an employee's block: the n-th need of each column, if there is one. */
export type PlanDLine = Record<TrainingNeedCategory, TrainingNeedRow | null>;

/**
 * The official sheet gives every need its own row and reads the three columns side by side,
 * so an employee's block is as tall as their longest column. Never fewer than one line: an
 * employee with nothing listed still appears, exactly as on the Plan D tab.
 */
export function planDLines(emp: TrainingPlanEmployee): PlanDLine[] {
  const columns = TRAINING_NEED_CATEGORIES.map(c => emp.needs?.[c] ?? []);
  const height = Math.max(1, ...columns.map(col => col.length));
  return Array.from({ length: height }, (_, i) => {
    const line = {} as PlanDLine;
    TRAINING_NEED_CATEGORIES.forEach((c, k) => { line[c] = columns[k][i] ?? null; });
    return line;
  });
}

export function hasNoNeeds(emp: TrainingPlanEmployee): boolean {
  return TRAINING_NEED_CATEGORIES.every(c => (emp.needs?.[c] ?? []).length === 0);
}

/** Counted the same way as the Plan D tab's "x of y accomplished". */
export function planDTotals(offices: TrainingPlanOffice[]) {
  const totals = { employees: 0, needs: 0, accomplished: 0 };
  for (const office of offices ?? []) {
    for (const emp of office.employees ?? []) {
      totals.employees++;
      for (const c of TRAINING_NEED_CATEGORIES) {
        for (const need of emp.needs?.[c] ?? []) {
          totals.needs++;
          if (need.status?.accomplished) totals.accomplished++;
        }
      }
    }
  }
  return totals;
}

/** The workbook's own convention: a need still outstanding is written again beside itself. */
export function notAccomplishedText(need: TrainingNeedRow | null): string {
  return need && !need.status?.accomplished ? need.title : "";
}

/** Column headings in the workbook's order — each need column followed by its pair. */
export const PLAN_D_HEADINGS: string[] = [
  "Name",
  "Position",
  ...TRAINING_NEED_CATEGORIES.flatMap(c => [TRAINING_NEED_COLUMN_LABELS[c], "NOT ACCOMPLISHED"])
];

/** Which plan, judged as of when — for the CSV, and for the PDF when printed to one. */
export function planDFileName(plan: PlanDSnapshot): string {
  return `HSAC_RAB1_TDP_Plan_D_CY${plan.fiscalYear}_as_of_${plan.asOf}`;
}

/**
 * The sheet as spreadsheet rows, on the rows the official "Plan D" tab uses: the masthead on
 * rows 1–3, the title on 5, "as of" on 6 and the headings on 8.
 */
export function planDCsvRows(plan: PlanDSnapshot): string[][] {
  const rows: string[][] = [
    ["HUMAN SETTLEMENTS ADJUDICATION COMMISSION"],
    ["Regional Adjudication Branch 1"],
    ["Dona Pepita Building, Quezon Avenue, Barangay II, San Fernando City, La Union"],
    [],
    ["TRAINING AND DEVELOPMENT PLAN - D"],
    [`as of ${longDate(plan.asOf)}`],
    [],
    PLAN_D_HEADINGS
  ];
  for (const office of plan.offices ?? []) {
    rows.push([office.office]);
    for (const emp of office.employees ?? []) {
      planDLines(emp).forEach((line, i) => {
        rows.push([
          i === 0 ? emp.fullName : "",
          i === 0 ? emp.position : "",
          ...TRAINING_NEED_CATEGORIES.flatMap(c => [line[c]?.title ?? "", notAccomplishedText(line[c])])
        ]);
      });
    }
  }
  return rows;
}

/**
 * Excel starts a formula at a leading = + - @ even inside quotes, and names and positions can
 * come from an uploaded PDS. A leading apostrophe keeps such a cell as text.
 */
function csvCell(value: string): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * The byte-order mark matters: without it Excel opens the file as ANSI and "Niño" arrives
 * as "NiÃ±o".
 */
export function downloadPlanDCsv(plan: PlanDSnapshot) {
  const text = planDCsvRows(plan).map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${planDFileName(plan)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
