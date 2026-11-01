// The Documents Vault's list (Financial Tracking → Documents Vault): one row for every file attached
// to a liquidation report, without the file itself. A file's content is sent only when someone
// opens it (GET /api/liquidation-submissions/:id/documents/:docId).
import type { LiquidationDocument, LiquidationDocumentRow, LiquidationSubmissionView } from "../types";
import { SAFE_FILE_URL } from "../utils";
import { cleanText } from "../inputText";

/**
 * A file's name as the vault shows it, saves it and logs it. The employee chose it, so invisible
 * and direction-changing characters are dropped: a right-to-left mark makes "receipt‮fdp.exe"
 * read as "receiptexe.pdf". Runs of whitespace become one space. "" when nothing is left.
 */
export function cleanFileName(value: unknown): string {
  return cleanText(value);
}

/** Whether a record has a file to open: one in the file store, or a real data URL not yet moved there
 * (the same check the per-file route makes, 7f, so a list says up front when there is nothing to open). */
export function documentHasFile(d: Pick<LiquidationDocument, "stored" | "content"> | null | undefined): boolean {
  return !!d?.stored || (typeof d?.content === "string" && SAFE_FILE_URL.test(d.content));
}

/** Every attached file of every report, as rows for the vault. Malformed entries are skipped, and
 * values are read as text, since older records may hold other shapes. */
export function liquidationDocumentRows(
  reports: ReadonlyArray<Partial<LiquidationSubmissionView> | null | undefined> | null | undefined
): LiquidationDocumentRow[] {
  const rows: LiquidationDocumentRow[] = [];
  for (const r of reports ?? []) {
    if (!r || !r.id) continue;
    for (const d of Array.isArray(r.supportingDocs) ? r.supportingDocs : []) {
      if (!d || !d.id) continue;
      rows.push({
        reportId: String(r.id),
        submissionNo: String(r.submissionNo || ""),
        employeeName: String(r.employeeName || ""),
        status: String(r.status || ""),
        claimType: r.claimType || undefined,
        title: String(r.activityTitle || r.submissionNo || "Liquidation report"),
        fiscalYear: r.fiscalYear ? String(r.fiscalYear) : undefined,
        createdAt: r.createdAt || undefined,
        dateSubmitted: r.dateSubmitted || undefined,
        docId: String(d.id),
        name: cleanFileName(String(d.name || d.filename || "")) || "File",
        kind: d.kind || undefined,
        type: String(d.type || ""),
        size: d.size || undefined,
        uploadedAt: d.uploadedAt || undefined,
        hasFile: documentHasFile(d),
        supersededAt: d.supersededAt || undefined,
        replacedBy: d.replacedBy || undefined,
        replaces: d.replaces || undefined
      });
    }
  }
  return rows;
}
