import { inflateRawSync } from "node:zlib";

/**
 * A dependency-free .xlsx reader.
 *
 * An .xlsx is a zip of XML parts. Node can decompress (zlib) but has no built-in way to
 * read a zip's file list, so this walks the central directory itself. That is ~80 lines
 * and avoids adding a dependency to a repo that has very few.
 *
 * On parsing XML with regular expressions: normally a smell, and here a deliberate
 * trade-off. The alternatives are a dependency (ruled out) or a hand-written XML parser
 * (far more code and more places to be wrong). SpreadsheetML written by Excel or Google
 * Sheets is machine-generated, flat and attribute-only, with no CDATA or comments inside
 * a cell. The worst case for a bad match is a dropped cell, and every caller shows the
 * user a cell count before anything is saved, so a reader bug surfaces as a visibly wrong
 * number rather than as bad data.
 *
 * NODE ONLY. Lives under src/server/ so Vite never tries to bundle node:zlib for the
 * browser.
 */

/** row number -> { column letter -> trimmed text }. Empty cells are absent. */
export type SheetGrid = Map<number, Record<string, string>>;

export interface XlsxSheetRef {
  /** The tab name as shown in Excel, e.g. "Plan A - 2026". */
  name: string;
  /** The zip entry holding it, e.g. "xl/worksheets/sheet2.xml". */
  part: string;
}

export interface XlsxWorkbook {
  /** Sheets in tab order. */
  sheets: XlsxSheetRef[];
  grid(part: string): SheetGrid;
}

/** Thrown for anything the caller should show the user verbatim. */
export class XlsxReadError extends Error {}

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

// A single decompressed part above this is refused, so a zip bomb cannot exhaust memory.
const MAX_PART_BYTES = 40 * 1024 * 1024;

interface ZipEntry {
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/** Walks the central directory into a name -> entry map. */
function readCentralDirectory(buf: Buffer): Map<string, ZipEntry> {
  if (buf.length < 22 || buf.readUInt32LE(0) !== SIG_LOCAL) {
    throw new XlsxReadError("That is not an .xlsx workbook — please upload the Excel file, not a PDF or an older .xls.");
  }

  // The End of Central Directory record sits at the end, after an optional comment of
  // up to 64KB, so scan backwards rather than assuming it is the last 22 bytes.
  let eocd = -1;
  const floor = Math.max(0, buf.length - (22 + 0xffff));
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) {
    throw new XlsxReadError("This workbook appears to be corrupt or incomplete — the file may not have uploaded fully.");
  }

  const totalEntries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (totalEntries === 0xffff || cdOffset === 0xffffffff) {
    throw new XlsxReadError("This workbook uses the ZIP64 format, which is not supported. Please re-save it from Excel.");
  }

  const entries = new Map<string, ZipEntry>();
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== SIG_CENTRAL) {
      throw new XlsxReadError("This workbook appears to be corrupt — its internal file table could not be read.");
    }
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    entries.set(name, { method, compressedSize, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Inflates one entry to text. */
function readPart(buf: Buffer, entries: Map<string, ZipEntry>, name: string): string {
  const e = entries.get(name);
  if (!e) return "";

  // The local header carries its own name/extra lengths, which can differ from the
  // central directory's copy, so the data offset must be computed from the local one.
  const lh = e.localHeaderOffset;
  if (lh + 30 > buf.length || buf.readUInt32LE(lh) !== SIG_LOCAL) {
    throw new XlsxReadError("This workbook appears to be corrupt — one of its parts could not be located.");
  }
  const start = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
  const raw = buf.subarray(start, start + e.compressedSize);

  let out: Buffer;
  try {
    // Stored (0) or deflated (8). Zip deflate has no zlib header, hence inflateRaw.
    out = e.method === 0 ? Buffer.from(raw) : inflateRawSync(raw, { maxOutputLength: MAX_PART_BYTES });
  } catch {
    throw new XlsxReadError("This workbook could not be opened. It may be corrupt or password-protected.");
  }
  return out.toString("utf8");
}

/**
 * Unescapes XML entities. `&amp;` must come LAST, otherwise `&amp;lt;` decodes twice and
 * a literal "&lt;" in a cell turns into "<".
 */
function unescapeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Concatenates every <t> inside a fragment, so rich-text runs come out whole. */
function textOf(fragment: string): string {
  let out = "";
  // <rPh> holds furigana; its text is not part of the value.
  const body = fragment.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  for (const m of body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += m[1];
  return unescapeXml(out);
}

/** Collapses whitespace and trims. Cells that become empty are dropped by the caller. */
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function readXlsxWorkbook(buf: Buffer): XlsxWorkbook {
  const entries = readCentralDirectory(buf);

  if (!entries.has("xl/workbook.xml")) {
    throw new XlsxReadError("That file is a zip but not an Excel workbook. Please upload the .xlsx file.");
  }

  // rId -> target part. Targets are relative to xl/ and may use ../ or a leading slash.
  const relsXml = readPart(buf, entries, "xl/_rels/workbook.xml.rels");
  const rels = new Map<string, { target: string; type: string }>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const tag = m[0];
    const id = /\bId="([^"]+)"/.exec(tag)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(tag)?.[1];
    const type = /\bType="([^"]+)"/.exec(tag)?.[1] || "";
    if (!id || !target) continue;
    const resolved = target.startsWith("/")
      ? target.slice(1)
      : "xl/" + target.replace(/^\.\//, "").replace(/^\.\.\//, "");
    rels.set(id, { target: resolved, type });
  }

  // Sheets in tab order. sheetId is NOT the file number - "Plan A - 2026" is sheetId 5
  // but lives in sheet2.xml - so the r:id relationship is the only reliable link.
  const sheets: XlsxSheetRef[] = [];
  const workbookXml = readPart(buf, entries, "xl/workbook.xml");
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*?\/?>/g)) {
    const tag = m[0];
    const name = /\bname="([^"]*)"/.exec(tag)?.[1];
    const rid = /\br:id="([^"]+)"/.exec(tag)?.[1];
    if (!name || !rid) continue;
    const rel = rels.get(rid);
    // Only worksheets; this drops chartsheets and the extension-less "metadata" part
    // that Google Sheets adds.
    if (!rel || (rel.type && !/\/worksheet$/.test(rel.type))) continue;
    sheets.push({ name: unescapeXml(name), part: rel.target });
  }

  // Shared strings: most cell text lives here and is referenced by index.
  const ssPart = [...rels.values()].find(r => /\/sharedStrings$/.test(r.type))?.target || "xl/sharedStrings.xml";
  const shared: string[] = [];
  const ssXml = readPart(buf, entries, ssPart);
  for (const m of ssXml.matchAll(/<si\b(?:[^>]*\/>|[^>]*>([\s\S]*?)<\/si>)/g)) {
    shared.push(m[1] === undefined ? "" : textOf(m[1]));
  }

  function grid(part: string): SheetGrid {
    const xml = readPart(buf, entries, part);
    const rows: SheetGrid = new Map();

    for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = m[1] || "";
      const body = m[2] || "";
      const ref = /\br="([A-Z]+)(\d+)"/.exec(attrs);
      if (!ref) continue;
      const col = ref[1];
      const rowNum = Number(ref[2]);
      const t = /\bt="([^"]+)"/.exec(attrs)?.[1] || "n";

      let raw = "";
      if (t === "s") {
        const idx = Number(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1]);
        raw = Number.isFinite(idx) ? (shared[idx] ?? "") : "";
      } else if (t === "inlineStr") {
        raw = textOf(body);
      } else if (t === "e") {
        raw = ""; // #REF!, #N/A and friends are not data
      } else {
        raw = unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      }

      const value = clean(raw);
      if (!value) continue; // dropping empties is what makes blank rows disappear
      const row = rows.get(rowNum) || {};
      row[col] = value;
      rows.set(rowNum, row);
    }

    return rows;
  }

  return { sheets, grid };
}
