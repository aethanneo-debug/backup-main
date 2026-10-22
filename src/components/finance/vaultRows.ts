// The Documents Vault's list (Financial Tracking → Documents Vault), worked out from the rows the
// server sends (src/server/liquidationDocuments.ts): which files show, in what order, and the
// counts on the stage chips. Kept apart from the screen so the rules are tested
// (tests/vaultRows.test.ts). A file counts in its report's fiscal year, the rule the Liquidation
// Desk and the overview use (reportFiscalYear), so the three never disagree.
import type { LiquidationDocumentRow } from "../../types";
import { firstTimestamp } from "../../utils";
import { REPORT_STAGES, reportFiscalYear } from "./overviewFigures";

/** The stage chips: every file, or the files of the reports at one stage. */
export const VAULT_STAGES = [
  { id: "all", label: "All files" },
  { id: REPORT_STAGES.withHr, label: "With HR" },
  { id: REPORT_STAGES.withFinance, label: "With Finance" },
  { id: REPORT_STAGES.validated, label: "Validated" },
  { id: REPORT_STAGES.returned, label: "Returned" }
] as const;
export type VaultStage = (typeof VAULT_STAGES)[number]["id"];

export interface VaultFilter {
  fiscalYear: string;
  stage: VaultStage;
  query: string;
  /** Also list the copies a correction replaced (kept for the record). */
  includeReplaced: boolean;
}

export interface VaultView {
  /** What the table shows, newest upload first. */
  rows: LiquidationDocumentRow[];
  /** Each chip's count, under the same year, search and replaced-copies setting. */
  stageCounts: Record<VaultStage, number>;
  /** Replaced copies left out of `rows`: what ticking "Include replaced copies" would add. */
  hiddenReplaced: number;
  /** Every file of the fiscal year, before the search, the stage and the replaced-copies setting. */
  yearTotal: number;
}

const norm = (s: string | undefined) => (s || "").toLocaleLowerCase().trim();

/** Searches the file name, the report number, the employee and the seminar. */
function matchesQuery(row: LiquidationDocumentRow, query: string): boolean {
  const q = norm(query);
  return !q || [row.name, row.submissionNo, row.employeeName, row.title].some(v => norm(v).includes(q));
}

export function vaultView(rows: LiquidationDocumentRow[] | null | undefined, filter: VaultFilter): VaultView {
  // Nothing is listed until the year is known, as on the rest of Financial Tracking.
  const ofYear = filter.fiscalYear ? (rows ?? []).filter(r => reportFiscalYear(r) === filter.fiscalYear) : [];
  const searched = ofYear.filter(r => matchesQuery(r, filter.query));
  const inStage = (r: LiquidationDocumentRow, stage: VaultStage) => stage === "all" || r.status === stage;

  const stageCounts = Object.fromEntries(VAULT_STAGES.map(s => [s.id, 0])) as Record<VaultStage, number>;
  for (const r of searched) {
    if (r.supersededAt && !filter.includeReplaced) continue;
    for (const s of VAULT_STAGES) if (inStage(r, s.id)) stageCounts[s.id] += 1;
  }

  const staged = searched.filter(r => inStage(r, filter.stage));
  const shown = staged.filter(r => filter.includeReplaced || !r.supersededAt);
  return {
    // Newest upload first (LIFO); files uploaded at the same moment keep the server's order,
    // latest first. firstTimestamp never returns NaN, which would scramble the sort.
    rows: shown
      .map((r, i) => ({ r, i, t: firstTimestamp(r.uploadedAt, r.createdAt, r.dateSubmitted) }))
      .sort((a, b) => b.t - a.t || b.i - a.i)
      .map(x => x.r),
    stageCounts,
    hiddenReplaced: staged.length - shown.length,
    yearTotal: ofYear.length
  };
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "tif", "tiff"];
const WORD_EXTENSIONS = ["doc", "docx", "odt", "rtf"];
const SPREADSHEET_EXTENSIONS = ["xls", "xlsx", "ods", "csv"];

/**
 * A short label for what a file is. The name's extension decides it when there is one: that is
 * what Windows opens the downloaded file with, and the declared type is only the employee's
 * browser's word for it, never checked (a "receipt.pdf.hta" can be declared a PDF). Any kind of
 * file can be attached, so another extension is named as it is ("HTA file").
 */
export function fileKindLabel(type: string | undefined, name?: string): string {
  const ext = /\.([a-z0-9]{1,8})$/i.exec((name || "").trim())?.[1]?.toLowerCase();
  if (ext) {
    if (ext === "pdf") return "PDF";
    if (IMAGE_EXTENSIONS.includes(ext)) return "Image";
    if (WORD_EXTENSIONS.includes(ext)) return "Word";
    if (SPREADSHEET_EXTENSIONS.includes(ext)) return "Spreadsheet";
    return `${ext.toUpperCase()} file`;
  }
  // No extension: the declared type is all there is.
  const t = norm(type);
  if (t === "application/pdf") return "PDF";
  if (t.startsWith("image/")) return "Image";
  if (t.includes("word")) return "Word";
  if (t.includes("sheet") || t.includes("excel") || t === "text/csv") return "Spreadsheet";
  return "File";
}
