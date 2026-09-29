import { TrainingNeedCategory } from "../../types";
import type { SheetGrid } from "./readXlsx";

/**
 * Interprets one worksheet as the RAB-1 "Training and Development Plan - A" sheet.
 *
 * Pure: takes a grid, returns what it found. It never throws for a sheet that simply is
 * not Plan A — it returns `isPlanA: false` with a `reason`, so the caller can tell the
 * user which sheet was rejected and why rather than "parse error".
 */

/** Column position IS the category. The printed D header is misspelt in the source
 *  ("Neded Training for Additional") and wraps across two rows, so it must not be used. */
const COLUMN_CATEGORY: Record<string, TrainingNeedCategory> = {
  C: "Function",
  D: "Additional Function",
  E: "Career Advancement"
};
const NEED_COLUMNS = ["C", "D", "E"] as const;

export interface PlanANeed {
  category: TrainingNeedCategory;
  title: string;
  /** Kept so the preview can say "row 234, column C" instead of just a count. */
  row: number;
  column: string;
}

export interface PlanABlock {
  /** Stable identity for the mapping step, e.g. "Plan A - 2026!A82". */
  key: string;
  startRow: number;
  /** "" when the workbook has a position but no name (row 134 in the 2026 sheet). */
  name: string;
  position: string;
  office: string;
  needs: PlanANeed[];
}

export interface PlanASheetScan {
  isPlanA: boolean;
  reason?: string;
  planLetter: string | null;
  detectedYear: string | null;
  headerRow: number | null;
  endRow: number | null;
  offices: string[];
  blocks: PlanABlock[];
  warnings: string[];
}

const norm = (s: string | undefined) => (s || "").toLowerCase().trim();

export function parsePlanASheet(grid: SheetGrid, sheetName: string): PlanASheetScan {
  const warnings: string[] = [];
  const rowNumbers = [...grid.keys()].sort((a, b) => a - b);

  const fail = (reason: string, planLetter: string | null = null): PlanASheetScan => ({
    isPlanA: false, reason, planLetter, detectedYear: null, headerRow: null,
    endRow: null, offices: [], blocks: [], warnings
  });

  // --- Gate 1: the printed title. This is what separates Plan A from B, C and D; the
  // column headers alone are not enough, because Plan D repeats "Needed Training for
  // the Function" and would otherwise import its "NOT ACCOMPLISHED" column as needs.
  let planLetter: string | null = null;
  for (const n of rowNumbers) {
    if (n > 12) break;
    const m = /TRAINING\s+AND\s+DEVELOPMENT\s+PLAN\s*[-–—]\s*([A-D])\b/i.exec(grid.get(n)?.A || "");
    if (m) { planLetter = m[1].toUpperCase(); break; }
  }
  if (!planLetter) {
    return fail("No 'Training and Development Plan' title was found on this sheet.");
  }
  if (planLetter !== "A") {
    return fail(`That sheet is Plan ${planLetter}, not Plan A.`, planLetter);
  }

  // --- Gate 2: the header row, found by its printed labels rather than hardcoded, so
  // the sheet survives a row being inserted above it.
  let headerRow: number | null = null;
  for (const n of rowNumbers) {
    if (n > 30) break;
    const r = grid.get(n) || {};
    if (norm(r.A) === "name" && norm(r.B) === "position" && /needed\s+training\s+for\s+the\s+function/i.test(r.C || "")) {
      headerRow = n;
      break;
    }
  }
  if (headerRow === null) {
    return fail("This sheet has no 'Name / Position / Needed Training for the Function' header row.", planLetter);
  }

  // --- Gate 3: belt and braces against Plan D, whose D column is "NOT ACCOMPLISHED".
  const header = grid.get(headerRow) || {};
  if (/not\s+accomplished/i.test(header.D || "") || /not\s+accomplished/i.test(header.F || "")) {
    return fail("That sheet tracks accomplishment (Plan D), not training needs.", planLetter);
  }

  // --- Year, printed above the header as "For CY 2026".
  let detectedYear: string | null = null;
  for (const n of rowNumbers) {
    if (n >= headerRow) break;
    const m = /^for\s+cy\s+(\d{4})\b/i.exec(grid.get(n)?.A || "");
    if (m) { detectedYear = m[1]; break; }
  }

  // --- End sentinel. Rows 374-379 of the real sheet are a signature block
  // ("Prepared by:" / "Approved by:" / "Date: May 7, 2026"). Without this they parse as
  // four more needs for whoever appears last.
  let endRow: number | null = null;
  for (const n of rowNumbers) {
    if (n <= headerRow) continue;
    const r = grid.get(n) || {};
    const hit = Object.values(r).some(v =>
      /^(prepared|approved|noted|recommended|reviewed|certified|submitted)\s+by\s*:?$/i.test(v.trim()));
    if (hit) { endRow = n; break; }
  }
  if (endRow === null) {
    warnings.push("No signature block was found, so the whole sheet was read.");
  } else {
    warnings.push(`Stopped reading at row ${endRow} (signature block).`);
  }

  // --- Walk the rows.
  const offices: string[] = [];
  const blocks: PlanABlock[] = [];
  let currentOffice = "";
  let open: PlanABlock | null = null;
  let orphanedNeedCells = 0;

  const takeNeeds = (rowNum: number, r: Record<string, string>) => {
    for (const col of NEED_COLUMNS) {
      const title = r[col];
      if (!title) continue;
      // Before the first employee row this is the header's own wrapped second line
      // (row 9 carries "Function/Designation"), which is not data. Only count orphans
      // once a real block has been seen, so the preview does not warn about the header.
      if (!open) { if (blocks.length > 0) orphanedNeedCells++; continue; }
      open.needs.push({ category: COLUMN_CATEGORY[col], title, row: rowNum, column: col });
    }
  };

  for (const n of rowNumbers) {
    if (n <= headerRow) continue;
    if (endRow !== null && n >= endRow) break;

    const r = grid.get(n) || {};
    const hasA = !!r.A;
    const hasB = !!r.B;
    const hasNeeds = NEED_COLUMNS.some(c => !!r[c]);

    if (hasA && !hasB && !hasNeeds) {
      // Office heading — merged across A:E, so only A carries the value.
      currentOffice = r.A;
      if (!offices.includes(currentOffice)) offices.push(currentOffice);
      open = null;
      continue;
    }

    if (hasA && hasB) {
      open = { key: `${sheetName}!A${n}`, startRow: n, name: r.A, position: r.B, office: currentOffice, needs: [] };
      blocks.push(open);
      takeNeeds(n, r);
      continue;
    }

    if (hasA && !hasB && hasNeeds) {
      // A long name wrapped onto a second row: row 82 "Atty. Alyssa Ronalyn C." is
      // continued by row 83 "Flores-Fontanilla". Without this the row looks like an
      // office heading and the person ends up misnamed.
      if (open) {
        open.name = `${open.name} ${r.A}`.replace(/\s+/g, " ").trim();
        takeNeeds(n, r);
      } else {
        currentOffice = r.A;
        if (!offices.includes(currentOffice)) offices.push(currentOffice);
        warnings.push(`Row ${n} was read as an office heading, but it also had training needs beside it.`);
      }
      continue;
    }

    if (!hasA && hasB) {
      // A position with no name. In the 2026 sheet this is row 134 and it owns 22
      // needs; left to fall through they would silently join the person above.
      open = { key: `${sheetName}!A${n}`, startRow: n, name: "", position: r.B, office: currentOffice, needs: [] };
      blocks.push(open);
      takeNeeds(n, r);
      warnings.push(`Row ${n} has a position but no name — assign or skip it below.`);
      continue;
    }

    // Needs only, continuing the block above. Needs with no open block are counted and
    // dropped; that is also what silently discards the split header row.
    takeNeeds(n, r);
  }

  if (orphanedNeedCells > 0) {
    warnings.push(`${orphanedNeedCells} training need(s) appeared before any employee row and were ignored.`);
  }

  return {
    isPlanA: true, planLetter, detectedYear, headerRow, endRow,
    offices, blocks, warnings
  };
}

/** Total needs across every block. */
export const countNeeds = (blocks: PlanABlock[]) => blocks.reduce((n, b) => n + b.needs.length, 0);
