// The Documents Vault (Financial Tracking → Documents Vault): the server's file list
// (src/server/liquidationDocuments.ts) and the screen's filters (src/components/finance/vaultRows.ts).
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFileName, liquidationDocumentRows } from "../src/server/liquidationDocuments";
import { fileKindLabel, vaultView, type VaultFilter } from "../src/components/finance/vaultRows";
import type { LiquidationDocumentRow } from "../src/types";

const PDF = "data:application/pdf;base64,JVBERi0xLjQK";

test("the list has one row per attached file, with its report, and never the file itself", () => {
  const rows = liquidationDocumentRows([
    {
      id: "liq-1", submissionNo: "LIQSUB-2026-011", employeeName: "Andres B. Bonifacio", status: "Completed",
      claimType: "Liquidation", activityTitle: "Records Management Seminar", fiscalYear: "2027",
      createdAt: "2026-10-16T03:00:00.000Z",
      supportingDocs: [
        { id: "doc-a", name: "receipt.pdf", type: "application/pdf", size: "12.0 KB", uploadedAt: "2026-10-16T02:59:00.000Z", content: PDF },
        { id: "doc-b", name: "certificate.jpg", type: "image/jpeg", content: "data:image/jpeg;base64,/9j/4AAQ" }
      ]
    }
  ] as any);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    { ...rows[0] },
    {
      reportId: "liq-1", submissionNo: "LIQSUB-2026-011", employeeName: "Andres B. Bonifacio", status: "Completed",
      claimType: "Liquidation", title: "Records Management Seminar", fiscalYear: "2027",
      createdAt: "2026-10-16T03:00:00.000Z", dateSubmitted: undefined,
      docId: "doc-a", name: "receipt.pdf", type: "application/pdf", size: "12.0 KB",
      uploadedAt: "2026-10-16T02:59:00.000Z", hasFile: true,
      supersededAt: undefined, replacedBy: undefined, replaces: undefined
    }
  );
  for (const row of rows) assert.equal("content" in row, false);
});

test("a file with nothing that can be downloaded is listed, but says so", () => {
  const rows = liquidationDocumentRows([
    {
      id: "liq-1",
      supportingDocs: [
        { id: "doc-none", name: "old.pdf" },
        { id: "doc-script", name: "x.pdf", content: "javascript:alert(1)" },
        { id: "doc-text", name: "y.pdf", content: "a plain note" }
      ]
    }
  ] as any);
  assert.deepEqual(rows.map(r => [r.docId, r.hasFile]), [["doc-none", false], ["doc-script", false], ["doc-text", false]]);
});

test("a file's name is listed cleaned: no invisible or right-to-left characters, one space at a time", () => {
  const names = liquidationDocumentRows([
    {
      id: "liq-1",
      supportingDocs: [
        { id: "rlo", name: "receipt‮fdp.exe", type: "application/pdf", uploadedAt: "" },   // reads "receiptexe.pdf" on screen
        { id: "zw", name: "re​ceipt.pdf", type: "application/pdf", uploadedAt: "" },
        { id: "ws", name: "  official\treceipt\n.pdf ", type: "application/pdf", uploadedAt: "" },
        { id: "blank", name: "‮​", type: "application/pdf", uploadedAt: "" }
      ]
    }
  ]).map(r => r.name);
  assert.deepEqual(names, ["receiptfdp.exe", "receipt.pdf", "official receipt .pdf", "File"]);
  assert.equal(cleanFileName(42), "");
});

test("malformed reports and files are skipped, and missing labels get a fallback", () => {
  // Shapes the type doesn't allow, as an older or hand-edited record might hold them.
  const rows = liquidationDocumentRows([
    null,
    { submissionNo: "no id", supportingDocs: [{ id: "d", name: "n" }] },
    { id: "liq-2", supportingDocs: "not a list" },
    { id: "liq-3", submissionNo: "LIQSUB-2026-012", supportingDocs: [null, { name: "no id" }, { id: "doc-c", filename: "scan.png" }] }
  ] as any);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "scan.png");
  assert.equal(rows[0].title, "LIQSUB-2026-012");
  assert.deepEqual(liquidationDocumentRows(undefined), []);
});

const row = (over: Partial<LiquidationDocumentRow>): LiquidationDocumentRow => ({
  reportId: "liq", submissionNo: "LIQSUB", employeeName: "", status: "Completed", title: "Seminar",
  docId: Math.random().toString(36).slice(2), name: "file.pdf", type: "application/pdf", hasFile: true,
  fiscalYear: "2027", ...over
});
const filter = (over: Partial<VaultFilter> = {}): VaultFilter =>
  ({ fiscalYear: "2027", stage: "all", query: "", includeReplaced: false, ...over });

test("a file counts in its report's fiscal year: the seminar's, else the year the report was filed", () => {
  const rows = [
    row({ docId: "seminar-2027", fiscalYear: "2027", createdAt: "2026-10-16T03:00:00.000Z" }),
    row({ docId: "filed-2026", fiscalYear: undefined, createdAt: "2026-10-16T03:00:00.000Z" }),
    row({ docId: "old-2025", fiscalYear: undefined, dateSubmitted: "2025-12-30" })
  ];
  assert.deepEqual(vaultView(rows, filter()).rows.map(r => r.docId), ["seminar-2027"]);
  assert.deepEqual(vaultView(rows, filter({ fiscalYear: "2026" })).rows.map(r => r.docId), ["filed-2026"]);
  assert.deepEqual(vaultView(rows, filter({ fiscalYear: "2025" })).rows.map(r => r.docId), ["old-2025"]);
  // Until the year is known nothing is listed, as on the rest of Financial Tracking.
  assert.equal(vaultView(rows, filter({ fiscalYear: "" })).rows.length, 0);
});

test("newest upload first; files uploaded together keep the server's order, latest first; a dateless one goes last", () => {
  const rows = [
    row({ docId: "dateless" }),
    row({ docId: "older", uploadedAt: "2026-10-10T01:00:00.000Z" }),
    row({ docId: "newest", uploadedAt: "2026-10-20T01:00:00.000Z" }),
    row({ docId: "same-1", uploadedAt: "2026-10-15T01:00:00.000Z" }),
    row({ docId: "same-2", uploadedAt: "2026-10-15T01:00:00.000Z" }),
    // No upload time: the report's own date stands in.
    row({ docId: "report-date", createdAt: "2026-10-12T01:00:00.000Z" })
  ];
  assert.deepEqual(vaultView(rows, filter()).rows.map(r => r.docId), ["newest", "same-2", "same-1", "report-date", "older", "dateless"]);
});

test("the search looks at the file name, report number, employee and seminar, ignoring case", () => {
  const rows = [
    row({ docId: "by-name", name: "Official RECEIPT.pdf" }),
    row({ docId: "by-number", submissionNo: "LIQSUB-2026-011" }),
    row({ docId: "by-employee", employeeName: "Andres B. Bonifacio" }),
    row({ docId: "by-seminar", title: "Records Management Seminar" })
  ];
  const ids = (query: string) => vaultView(rows, filter({ query })).rows.map(r => r.docId).sort();
  assert.deepEqual(ids("receipt"), ["by-name"]);
  assert.deepEqual(ids("  liqsub-2026-011 "), ["by-number"]);
  assert.deepEqual(ids("bonifacio"), ["by-employee"]);
  assert.deepEqual(ids("records"), ["by-seminar"]);
  assert.equal(ids("").length, 4);
});

test("stage chips filter by the report's status, and each count is what that chip would list", () => {
  const rows = [
    row({ docId: "hr", status: "Pending HR Review", name: "a receipt.pdf" }),
    row({ docId: "fin", status: "Verified & Forwarded", name: "b receipt.pdf" }),
    row({ docId: "done-1", status: "Completed", name: "c receipt.pdf" }),
    row({ docId: "done-2", status: "Completed", name: "certificate.jpg" }),
    row({ docId: "ret", status: "Returned", name: "d receipt.pdf" }),
    row({ docId: "old", status: "Approved", name: "e receipt.pdf" }),
    row({ docId: "other-year", status: "Completed", fiscalYear: "2026" })
  ];
  const view = vaultView(rows, filter());
  assert.deepEqual(view.stageCounts, {
    all: 6, "Pending HR Review": 1, "Verified & Forwarded": 1, Completed: 2, Returned: 1
  });
  // A status no chip names (an older "Approved") is still under All files.
  assert.ok(view.rows.some(r => r.docId === "old"));
  assert.deepEqual(vaultView(rows, filter({ stage: "Completed" })).rows.map(r => r.docId).sort(), ["done-1", "done-2"]);
  // Counts follow the search.
  assert.deepEqual(vaultView(rows, filter({ query: "receipt" })).stageCounts, {
    all: 5, "Pending HR Review": 1, "Verified & Forwarded": 1, Completed: 1, Returned: 1
  });
  assert.equal(view.yearTotal, 6);
});

test("copies a correction replaced are left out unless asked for, and the count says how many", () => {
  const rows = [
    row({ docId: "current", status: "Returned" }),
    row({ docId: "replaced", status: "Returned", supersededAt: "2026-10-18T01:00:00.000Z", replacedBy: "current" }),
    row({ docId: "replaced-other-stage", status: "Completed", supersededAt: "2026-10-18T01:00:00.000Z" })
  ];
  const hidden = vaultView(rows, filter());
  assert.deepEqual(hidden.rows.map(r => r.docId), ["current"]);
  assert.equal(hidden.hiddenReplaced, 2);
  assert.equal(hidden.stageCounts.all, 1);
  assert.equal(hidden.yearTotal, 3);
  // Within one stage, only that stage's replaced copies are counted.
  assert.equal(vaultView(rows, filter({ stage: "Returned" })).hiddenReplaced, 1);

  const shown = vaultView(rows, filter({ includeReplaced: true }));
  assert.equal(shown.rows.length, 3);
  assert.equal(shown.hiddenReplaced, 0);
  assert.equal(shown.stageCounts.all, 3);
  assert.equal(shown.stageCounts.Returned, 2);
});

test("an empty or missing list gives an empty view", () => {
  for (const rows of [[], null, undefined]) {
    const view = vaultView(rows, filter());
    assert.deepEqual(view.rows, []);
    assert.equal(view.yearTotal, 0);
    assert.equal(view.hiddenReplaced, 0);
    assert.equal(view.stageCounts.all, 0);
  }
});

test("a file's kind comes from its name's extension, which is what Windows opens it with", () => {
  assert.equal(fileKindLabel("application/pdf", "receipt.pdf"), "PDF");
  assert.equal(fileKindLabel("application/pdf", "Official Receipt - Hotel.pdf.hta"), "HTA file"); // declared a PDF
  assert.equal(fileKindLabel("image/png", "scan.HTML"), "HTML file");
  assert.equal(fileKindLabel("", "certificate.JPEG"), "Image");
  assert.equal(fileKindLabel("application/octet-stream", "expenses.xlsx"), "Spreadsheet");
  assert.equal(fileKindLabel("application/octet-stream", "letter.docx"), "Word");
  assert.equal(fileKindLabel("application/pdf", "  receipt.pdf  "), "PDF");
  // No extension: the declared type is all there is.
  assert.equal(fileKindLabel("application/pdf", "receipt"), "PDF");
  assert.equal(fileKindLabel("image/jpeg", "photo."), "Image");
});

test("file kinds from the declared type alone", () => {
  assert.equal(fileKindLabel("application/pdf"), "PDF");
  assert.equal(fileKindLabel("IMAGE/PNG"), "Image");
  assert.equal(fileKindLabel("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "Word");
  assert.equal(fileKindLabel("application/msword"), "Word");
  assert.equal(fileKindLabel("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "Spreadsheet");
  assert.equal(fileKindLabel("application/vnd.ms-excel"), "Spreadsheet");
  assert.equal(fileKindLabel("application/octet-stream"), "File");
  assert.equal(fileKindLabel(""), "File");
  assert.equal(fileKindLabel(undefined), "File");
});
