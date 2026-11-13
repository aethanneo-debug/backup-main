import { CORRECTION_FIELDS, CorrectionField, CorrectionItem, CorrectionRequest, DocumentKind, LiquidationSubmission } from "../../../types";
import { employeeAskedKinds } from "../../../reportDocuments";

/**
 * Whether the claimant can correct and resubmit the report, by the server's rule: returned,
 * its claim unpaid, and never counted (a report validated or approved under the old rules
 * and then returned is refused, so its spending isn't counted twice).
 */
export function canResubmit(report: Partial<LiquidationSubmission> | null | undefined): boolean {
  return !!report && report.status === "Returned" && report.reimbursementStatus !== "Reimbursed"
    && !report.financeValidatedAt && !report.divisionChiefApprovedAt;
}

/** The correction the claimant is working on: the latest Return not yet answered. */
export function openCorrectionOf(report: Partial<LiquidationSubmission> | null | undefined): CorrectionRequest | null {
  const list = roundsOf(report);
  for (let i = list.length - 1; i >= 0; i--) {
    if (!list[i].resolvedAt) return list[i];
  }
  return null;
}

// Older or damaged records may hold anything where a list belongs, and a screen that read it as one would go blank
// (there is no error boundary): only lists are read, and only the entries in them that are there.
const listOf = <T>(value: unknown): T[] => (Array.isArray(value) ? value.filter(Boolean) : []);
const roundsOf = (report: Partial<LiquidationSubmission> | null | undefined) => listOf<CorrectionRequest>(report?.corrections);
const itemsOf = (correction: CorrectionRequest | null | undefined) => listOf<CorrectionItem>(correction?.items);

export interface CorrectionAccess {
  /** The open request, or null: a new report, or one returned before checklists existed. */
  open: CorrectionRequest | null;
  /** Whether that part of the form may change. Without an open request, everything may. */
  editable: (field: CorrectionField) => boolean;
  /** The reviewer's note for that part, if they left one. */
  noteFor: (field: CorrectionField) => string | undefined;
  /** Particulars ticked line by line; undefined means every line (and adding or removing). */
  lineIds?: string[];
  /** The files the reviewer asked to replace. */
  replaceIds: string[];
  /** The named documents the reviewer said are missing (R5). */
  addKinds: DocumentKind[];
}

/**
 * Which parts of a returned report reopen. The same rule as the server's /resubmit, which
 * ignores anything else the form sends: ticking the claim type reopens the cash advance and
 * its refund OR too (a new type can mean a new advance), and a report filed before Box B
 * existed must name a representative either way. On a seminar report kept within its advance
 * the refund OR never reopens: the Finance Officer records it when validating (12ai).
 */
export function correctionAccess(report: Partial<LiquidationSubmission> | null | undefined): CorrectionAccess {
  const open = openCorrectionOf(report);
  const items = itemsOf(open);
  const ticked = new Set(items.map(i => i.field));
  return {
    open,
    editable: (field) => !(field === "refundOr" && !!report?.withinAdvance) && (!open || ticked.has(field)
      || ((field === "cashAdvance" || field === "refundOr") && ticked.has("claimType"))
      || (field === "representative" && !report?.representativeId)),
    noteFor: (field) => items.find(i => i.field === field)?.remark,
    lineIds: items.find(i => i.field === "particulars")?.lineIds,
    replaceIds: items.find(i => i.field === "replaceDocuments")?.documentIds ?? [],
    // (Never the Finance Officer's OR, which a Return made before 12ai could ask for.)
    addKinds: employeeAskedKinds(items.find(i => i.field === "addDocument")?.documentKinds)
  };
}

export const correctionLabel = (field: CorrectionField): string =>
  CORRECTION_FIELDS.find(c => c.field === field)?.label ?? field;

// How each part reads in the reviewers' summary of a correction.
const PART_NAME: Record<CorrectionField, string> = {
  periodCovered: "the period covered",
  responsibilityCenterCode: "the responsibility center code",
  particulars: "the particulars",
  cashAdvance: "the cash advance",
  refundOr: "the refund OR",
  claimType: "the claim type",
  representative: "the Box B representative",
  replaceDocuments: "the files marked for replacing",
  addDocument: "the missing document",
  remarks: "the notes"
};

/** "a", "a and b", "a, b and c". */
const joinAnd = (parts: string[]) =>
  parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

/** What the claimant did with a Return: what they changed, and any part they were asked to correct but left as it was. */
export function correctionAnswer(correction: CorrectionRequest): string {
  const changed = listOf<CorrectionField>(correction.changedFields);
  const items = itemsOf(correction);
  const edited = changed.filter(f => f !== "replaceDocuments" && f !== "addDocument").map(f => PART_NAME[f]).filter(Boolean);
  const done = [
    edited.length ? `changed ${joinAnd(edited)}` : "",
    changed.includes("replaceDocuments") ? "replaced the files marked for replacing" : "",
    // (On a report under the named documents a change can require one nobody asked for, e.g. a new Accommodation line.)
    changed.includes("addDocument")
      ? (items.some(i => i.field === "addDocument") ? "added the missing document" : "added a document the correction made necessary")
      : ""
  ].filter(Boolean);
  const untouched = items.map(i => i.field).filter(f => !changed.includes(f)).map(f => PART_NAME[f]).filter(Boolean);
  return `${done.length ? joinAnd(done) : "resubmitted without changes"}${
    untouched.length && done.length ? `; left ${joinAnd(untouched)} as ${untouched.length === 1 ? "it was" : "they were"}` : ""}`;
}

/**
 * For reviewers: when the report came back from a correction, which round it answered and what
 * the claimant did with it. Null when the latest Return is still open or there was none.
 */
export function answeredCorrectionSummary(report: Partial<LiquidationSubmission> | null | undefined): string | null {
  const list = roundsOf(report);
  const last = list[list.length - 1];
  if (!last?.resolvedAt) return null;
  return `Corrected after Return ${last.round > 1 ? `round ${last.round} ` : ""}by ${last.requestedBy}: ${correctionAnswer(last)}.`;
}
