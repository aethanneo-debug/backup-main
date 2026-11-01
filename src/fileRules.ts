// What can be attached to a liquidation report (the instructor's review, R6; the team's answer to Q5;
// known-issues 7k): PDF, JPEG and PNG, and only a file whose declared type, name and first bytes agree.
// Checked in the browser when a file is picked, on the server when it arrives, and again before it is
// shown, so a page can never be made to render something else in the app's own origin (where the
// sign-in token sits). The same rules everywhere.
import { cleanText } from "./inputText";
import { SAFE_FILE_URL } from "./utils";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** The smallest file that counts as a document (a receipt, a certificate): anything less holds next to nothing.
 * The server counts a file only from this size, so the form refuses smaller ones on pick. */
export const MIN_FILE_BYTES = 75;
/** Raised from 10 with the named documents (R5): one trip can bring tickets, passes, bills and receipts. */
export const MAX_REPORT_FILES = 20;
/** Everything one request sends has to fit the server's 50 MB request limit, and base64 adds a third. */
export const MAX_REPORT_BYTES = 35 * 1024 * 1024;
/** The longest data URL a file within the limit can be, with room for its header. */
const MAX_DATA_URL_LENGTH = Math.ceil(MAX_FILE_BYTES / 3) * 4 + 256;

interface FileKind {
  label: string;
  type: string;
  extensions: string[];
  /** The bytes every file of this kind starts with. */
  signature: number[];
  /** How the file viewer shows it. */
  view: "pdf" | "image";
}

const KINDS: FileKind[] = [
  { label: "PDF", type: "application/pdf", extensions: ["pdf"], signature: [0x25, 0x50, 0x44, 0x46, 0x2d], view: "pdf" },
  { label: "JPEG", type: "image/jpeg", extensions: ["jpg", "jpeg"], signature: [0xff, 0xd8, 0xff], view: "image" },
  { label: "PNG", type: "image/png", extensions: ["png"], signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], view: "image" }
];

/** For a file input's `accept`. */
export const FILE_INPUT_ACCEPT = KINDS.flatMap(k => [...k.extensions.map(e => `.${e}`), k.type]).join(",");

/** The extension for a checked type, or "" for any other. */
export function fileExtension(type: unknown): string {
  return KINDS.find(k => k.type === type)?.extensions[0] ?? "";
}

const ALLOWED_TEXT = "only PDF, JPEG and PNG files can be attached";

function kindOfName(name: unknown): FileKind | undefined {
  const clean = cleanText(name).toLowerCase();
  const dot = clean.lastIndexOf(".");
  const extension = dot < 0 ? "" : clean.slice(dot + 1);
  return KINDS.find(k => k.extensions.includes(extension));
}

/** The parts of a base64 data URL, or null when it isn't one: SAFE_FILE_URL's header (the check every file
 * must pass, 7f), then whole groups of base64, as a browser writes it. */
function readDataUrl(content: unknown): { type: string; base64: string } | null {
  if (typeof content !== "string") return null;
  const header = SAFE_FILE_URL.exec(content)?.[0];
  if (!header) return null;
  const base64 = content.slice(header.length);
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return null;
  return { type: header.slice("data:".length).split(/[;,]/)[0].toLowerCase(), base64 };
}

function byteLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function startsWith(base64: string, signature: number[]): boolean {
  // Enough base64 for the longest signature, in a whole number of 4-character groups.
  const head = atob(base64.slice(0, 16));
  return signature.every((byte, i) => head.charCodeAt(i) === byte);
}

/** Why a file picked in the browser can't be attached, before it is read, or "". */
export function pickedFileProblem(name: string, size: number): string {
  if (!kindOfName(name)) return `"${name}" can't be attached: ${ALLOWED_TEXT}.`;
  if (size > MAX_FILE_BYTES) return `"${name}" is larger than 5 MB.`;
  if (size <= 0) return `"${name}" is empty.`;
  if (size < MIN_FILE_BYTES) return `"${name}" has almost nothing in it. Choose the document itself.`;
  return "";
}

/** Why a file can't be attached, or "". `declaredType` is the type the browser reported, when there is one. */
export function fileProblem(name: unknown, content: unknown, declaredType?: unknown): string {
  const shown = cleanText(name) || "This file";
  // Before it is read: the whole of a huge string would otherwise be scanned just to refuse it.
  if (typeof content === "string" && content.length > MAX_DATA_URL_LENGTH) return `"${shown}" is larger than 5 MB.`;
  const data = readDataUrl(content);
  if (!data) return "Each file must be uploaded from your device.";
  const kind = kindOfName(name);
  if (!kind) return `"${shown}" can't be attached: ${ALLOWED_TEXT}.`;
  const bytes = byteLength(data.base64);
  if (bytes === 0) return `"${shown}" is empty.`;
  if (bytes > MAX_FILE_BYTES) return `"${shown}" is larger than 5 MB.`;
  const declared = typeof declaredType === "string" ? declaredType.toLowerCase() : "";
  if (data.type !== kind.type || (declared && declared !== kind.type) || !startsWith(data.base64, kind.signature)) {
    return `"${shown}" isn't really a ${kind.label} file. Save it again as a PDF, JPEG or PNG.`;
  }
  return "";
}

/** A file's size in bytes, from its data URL; 0 when it isn't one. */
export function fileBytes(content: unknown): number {
  const data = readDataUrl(content);
  return data ? byteLength(data.base64) : 0;
}

/** Why one request can't bring this many files, or "". On filing that is the whole report. A correction
 * counts only what it brings: the files on the report can't be taken off, so a full report could
 * otherwise never answer a reviewer who asks for one more. */
export function reportFilesProblem(files: number, bytes: number): string {
  if (files > MAX_REPORT_FILES) return `A report can have up to ${MAX_REPORT_FILES} files.`;
  if (bytes > MAX_REPORT_BYTES) return "These files come to more than 35 MB together. Attach smaller copies.";
  return "";
}

export interface ViewableFile {
  /** The only type a preview is ever created with: from the list above, never from the stored record. */
  type: string;
  view: "pdf" | "image";
  base64: string;
}

/** How to show a file, or null when it can only be downloaded: anything that doesn't pass the same check
 * as an upload, such as an older record of another kind. */
export function viewableFile(name: unknown, content: unknown): ViewableFile | null {
  if (fileProblem(name, content)) return null;
  const kind = kindOfName(name)!;
  return { type: kind.type, view: kind.view, base64: readDataUrl(content)!.base64 };
}
