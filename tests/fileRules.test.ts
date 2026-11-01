// What can be attached to a report (src/fileRules.ts) and how it is stored (src/server/fileStore.ts).
// The instructor's review, R6. Run with `npm test`; the store test works in a temporary folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  FILE_INPUT_ACCEPT,
  MAX_FILE_BYTES,
  MAX_REPORT_BYTES,
  fileBytes,
  fileProblem,
  pickedFileProblem,
  reportFilesProblem,
  viewableFile
} from "../src/fileRules";
import { readStoredFile, storeDataUrl } from "../src/server/fileStore";

const dataUrl = (type: string, bytes: number[]) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
const PDF = dataUrl("application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25]);
const PNG = dataUrl("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = dataUrl("image/jpeg", [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
const HTML = dataUrl("text/html", [...Buffer.from("<script>alert(1)</script>")]);

test("PDF, JPEG and PNG pass when their type, name and first bytes agree", () => {
  assert.equal(fileProblem("receipt.pdf", PDF), "");
  assert.equal(fileProblem("receipt.PDF", PDF, "application/pdf"), "");
  assert.equal(fileProblem("photo.png", PNG, "image/png"), "");
  assert.equal(fileProblem("scan.jpg", JPEG, "image/jpeg"), "");
  assert.equal(fileProblem("scan.jpeg", JPEG), "");
});

test("any other kind is refused, whatever its name or type says", () => {
  assert.match(fileProblem("page.html", HTML), /only PDF, JPEG and PNG/);
  assert.match(fileProblem("picture.svg", dataUrl("image/svg+xml", [60, 115, 118, 103])), /only PDF, JPEG and PNG/);
  assert.match(fileProblem("expenses.xlsx", dataUrl("application/vnd.ms-excel", [80, 75, 3, 4])), /only PDF, JPEG and PNG/);
  assert.match(fileProblem("receipt.pdf.hta", PDF), /only PDF, JPEG and PNG/, "the last extension counts");
  assert.match(fileProblem("receipt", PDF), /only PDF, JPEG and PNG/, "no extension");
  assert.match(fileProblem("receipt‮fdp.exe", PDF), /only PDF, JPEG and PNG/, "a right-to-left mark can't dress up a name");
});

test("a file that isn't what it says is refused", () => {
  assert.match(fileProblem("receipt.pdf", dataUrl("application/pdf", [...Buffer.from("<script>alert(1)</script>")])), /isn't really a PDF/, "HTML named and typed as a PDF");
  assert.match(fileProblem("receipt.pdf", HTML), /isn't really a PDF/, "the data URL's type");
  assert.match(fileProblem("photo.png", JPEG), /isn't really a PNG/, "the bytes of another kind");
  assert.match(fileProblem("receipt.pdf", PDF, "text/html"), /isn't really a PDF/, "the type the browser reported");
});

test("what isn't a real upload is refused", () => {
  assert.equal(fileProblem("receipt.pdf", undefined), "Each file must be uploaded from your device.", "a name with no file");
  assert.equal(fileProblem("receipt.pdf", "javascript:alert(1)"), "Each file must be uploaded from your device.");
  assert.equal(fileProblem("receipt.pdf", "data:application/pdf;base64,@@@@"), "Each file must be uploaded from your device.", "not base64");
  for (const length of [1, 5, 9, 13]) {
    assert.equal(fileProblem("receipt.pdf", `data:application/pdf;base64,${"A".repeat(length)}`), "Each file must be uploaded from your device.", `${length} characters of base64 aren't a file`);
  }
  assert.match(fileProblem("receipt.pdf", "data:application/pdf;base64,"), /is empty/);
});

test("size limits", () => {
  const big = `data:application/pdf;base64,JVBERi0x${"A".repeat(Math.ceil(((MAX_FILE_BYTES + 1) * 4) / 3))}`;
  assert.match(fileProblem("big.pdf", big), /larger than 5 MB/);
  assert.match(fileProblem("big.pdf", "x".repeat(8 * 1024 * 1024)), /larger than 5 MB/, "too long to be read at all");
  const exact = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(MAX_FILE_BYTES - 5)]);
  assert.equal(fileProblem("exact.pdf", `data:application/pdf;base64,${exact.toString("base64")}`), "", "exactly 5 MB passes");
  assert.equal(pickedFileProblem("ok.pdf", MAX_FILE_BYTES), "");
  assert.match(pickedFileProblem("big.pdf", MAX_FILE_BYTES + 1), /larger than 5 MB/);
  assert.match(pickedFileProblem("sheet.docx", 10), /only PDF, JPEG and PNG/);
  assert.match(pickedFileProblem("empty.pdf", 0), /is empty/);
  assert.equal(fileBytes(PDF), 10);
  assert.equal(fileBytes("not a file"), 0);
  assert.equal(reportFilesProblem(10, MAX_REPORT_BYTES), "");
  assert.match(reportFilesProblem(11, 1), /up to 10 files/);
  assert.match(reportFilesProblem(2, MAX_REPORT_BYTES + 1), /more than 35 MB/);
});

test("only a file that passes is ever shown, with a type from the list", () => {
  assert.deepEqual(viewableFile("r.pdf", PDF)?.type, "application/pdf");
  assert.deepEqual(viewableFile("r.pdf", PDF)?.view, "pdf");
  assert.deepEqual(viewableFile("p.png", PNG)?.view, "image");
  assert.equal(viewableFile("page.html", HTML), null);
  assert.equal(viewableFile("page.pdf", HTML), null, "renamed");
  assert.equal(viewableFile("picture.svg", dataUrl("image/svg+xml", [60, 115, 118, 103])), null);
  assert.equal(viewableFile("r.pdf", undefined), null);
});

test("the input's accept list names the three kinds", () => {
  for (const part of [".pdf", ".jpg", ".jpeg", ".png", "application/pdf", "image/jpeg", "image/png"]) assert.ok(FILE_INPUT_ACCEPT.split(",").includes(part), part);
});

test("the store keeps a file under a random name and gives it back unchanged", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "filestore-"));
  const before = process.cwd();
  process.chdir(dir);
  try {
    const stored = storeDataUrl(PDF);
    assert.ok(stored);
    assert.match(stored.file, /^[0-9a-f-]{36}\.bin$/);
    assert.equal(stored.type, "application/pdf");
    assert.equal(stored.bytes, 10);
    assert.equal(readStoredFile(stored), PDF);
    assert.equal(storeDataUrl("data:application/pdf;base64,"), null, "nothing to keep");
    assert.equal(storeDataUrl("javascript:alert(1)"), null);
    assert.equal(readStoredFile({ file: "00000000-0000-0000-0000-000000000000.bin", type: "application/pdf", bytes: 1 }), null, "missing from the folder");
    fs.writeFileSync(path.join(dir, "secret.txt"), "secret");
    assert.equal(readStoredFile({ file: "../secret.txt", type: "text/plain", bytes: 6 }), null, "a damaged record can't leave the folder");
    assert.equal(readStoredFile({ file: "..\\secret.txt", type: "text/plain", bytes: 6 }), null);
    assert.equal(readStoredFile(null), null);
  } finally {
    process.chdir(before);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
