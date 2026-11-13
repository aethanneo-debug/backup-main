// Where a returned report's correction starts, and what its notice says is to be fixed (the instructor's
// review, R7). A notice lands on the first part the reviewer reopened, in the checklist's order: the order a
// correction request keeps, which the form's "Only these parts can be changed" panel shows. It is made exact:
// which slot, which file, which line. The server words the Return's notice with the same module.
import { CORRECTION_FIELDS, type CorrectionField, type CorrectionItem, type CorrectionRequest, type DocumentKind } from "./types";
import { DOCUMENT_SLOTS, documentPlate, employeeAskedKinds } from "./reportDocuments";

export type CorrectionTarget =
  /** A missing document: its slot, or an older report's one box (no kind). */
  | { field: "addDocument"; documentKind?: DocumentKind }
  | { field: "replaceDocuments"; documentId: string }
  /** No line: every line reopened, so the first one. */
  | { field: "particulars"; lineId?: string }
  | { field: Exclude<CorrectionField, "addDocument" | "replaceDocuments" | "particulars"> };

/** What a target needs from the report: its lines, and its files with their slots. */
export interface CorrectionReport {
  particulars?: Array<{ id: string }>;
  supportingDocs?: Array<{ id: string; name?: string; kind?: DocumentKind; supersededAt?: string }>;
}

type Reopened = Pick<CorrectionRequest, "items"> | null | undefined;

// Older or damaged records may hold anything where a list belongs: only lists are read, and only what is in them.
// (The screens that read these have no error boundary, and the history reads every round, not only the open one.)
const listOf = <T>(value: unknown): T[] => (Array.isArray(value) ? value.filter(Boolean) : []);

/** The files a Return asks to replace that are still current (or, for the record of a past round, all of them), in
 * the form's order: by slot, then as filed. A file with no slot is a receipt, so a report from before the named
 * documents keeps its own order. */
function filesToReplace(item: CorrectionItem, report: CorrectionReport, replacedToo = false) {
  const place = (d: { kind?: DocumentKind }) => DOCUMENT_SLOTS.findIndex(s => s.kind === (d.kind ?? "receipts"));
  const asked = listOf<string>(item.documentIds);
  return listOf<NonNullable<CorrectionReport["supportingDocs"]>[number]>(report.supportingDocs)
    .filter(d => asked.includes(d.id) && (replacedToo || !d.supersededAt))
    .sort((a, b) => place(a) - place(b));
}

/** The first part the reviewer reopened, made exact, or null when nothing is reopened. A file to replace that is
 * no longer current on the report is passed over. */
export function correctionTarget(request: Reopened, report: CorrectionReport): CorrectionTarget | null {
  for (const item of listOf<CorrectionItem>(request?.items)) {
    const field = item.field;
    if (field === "addDocument") {
      const asked = employeeAskedKinds(item.documentKinds);
      const kind = DOCUMENT_SLOTS.find(s => asked.includes(s.kind))?.kind;
      if (kind) return { field, documentKind: kind };
      // Only the Finance Officer's OR was asked for (a Return made before 12ai): nothing there for the employee.
      if (listOf<DocumentKind>(item.documentKinds).length > 0) continue;
      return { field };
    }
    if (field === "replaceDocuments") {
      const [file] = filesToReplace(item, report);
      if (file) return { field, documentId: file.id };
      continue;
    }
    if (field === "particulars") {
      const lineIds = listOf<string>(item.lineIds);
      const line = lineIds.length > 0 ? listOf<{ id: string }>(report.particulars).find(p => lineIds.includes(p.id)) : undefined;
      return line ? { field, lineId: line.id } : { field };
    }
    return { field };
  }
  return null;
}

/** How a target is marked on the form (`data-correction-target`). */
export function correctionTargetKey(target: CorrectionTarget): string {
  switch (target.field) {
    case "addDocument": return target.documentKind ? `addDocument:${target.documentKind}` : "addDocument";
    case "replaceDocuments": return `replaceDocuments:${target.documentId}`;
    case "particulars": return target.lineId ? `particulars:${target.lineId}` : "particulars";
    default: return target.field;
  }
}

/** The selectors that find a target on the form, best first: with no line named, the first line there is. A line's
 * id comes from the browser that filed it, so it may hold anything: a raw line break can't sit in a CSS string, and
 * a selector that doesn't parse would take the whole app down (there is no error boundary). */
export function correctionTargetSelectors(target: CorrectionTarget): string[] {
  const quoted = (value: string) => `"${value.replace(/["\\]/g, "\\$&").replace(/[\n\r\f]/g, c => `\\${c.charCodeAt(0).toString(16)} `)}"`;
  const exact = `[data-correction-target=${quoted(correctionTargetKey(target))}]`;
  return target.field === "particulars" ? [exact, `[data-correction-target^=${quoted("particulars:")}]`] : [exact];
}

/** What a Return's notice names as to be fixed, in the checklist's order: each missing document by its name
 * plate, each file to replace by its name, the other parts by their labels. At most `max`, then "and N more".
 * "" when nothing is reopened. A report's history tells a past round (`asked`): its files have been replaced since. */
export function correctionSummary(request: Reopened, report: CorrectionReport, max = 3, asked = false): string {
  const parts: string[] = [];
  for (const item of listOf<CorrectionItem>(request?.items)) {
    if (item.field === "addDocument") {
      const kinds = DOCUMENT_SLOTS.map(s => s.kind).filter(k => listOf<DocumentKind>(item.documentKinds).includes(k));
      parts.push(...(kinds.length > 0 ? kinds.map(k => `${documentPlate(k)} (missing)`) : ["a missing document"]));
    } else if (item.field === "replaceDocuments") {
      const names = filesToReplace(item, report, asked).map(d => `a new copy of ${JSON.stringify(String(d.name || "a file"))}`);
      parts.push(...(names.length > 0 ? names : ["a new copy of a file"]));
    } else {
      parts.push(CORRECTION_FIELDS.find(c => c.field === item.field)?.label ?? item.field);
    }
  }
  if (parts.length === 0) return "";
  const named = parts.length > max ? [...parts.slice(0, max), `${parts.length - max} more`] : parts;
  return named.length < 2 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
}
