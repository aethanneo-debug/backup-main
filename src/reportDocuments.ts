// What a seminar's liquidation report has to carry (the instructor's review, R5): the documentary requirements
// for a cash advance's liquidation (1.2.4.1 Local Travel, from the team's document), each a named slot with
// the team's name plate. Some are always required, some follow from the report itself, and some from what
// only the claimant can say about the trip. A Reimbursement needs its certificate and official receipts.
// The form and the server run the same rules. A report filed before them keeps its own: `travelDeclarations`
// marks one filed under these.
import type { DocumentKind, TravelDeclaration } from "./types";

export interface DocumentSlot {
  kind: DocumentKind;
  plate: string;
}

/** Every slot, in the order the form lists them. */
export const DOCUMENT_SLOTS: DocumentSlot[] = [
  { kind: "certificate", plate: "Certificate of Appearance/Attendance" },
  { kind: "itinerary", plate: "Itinerary of Travel" },
  { kind: "travelCompleted", plate: "Certificate of Travel Completed" },
  { kind: "tickets", plate: "Tickets" },
  { kind: "hotelBills", plate: "Hotel Room/Lodging Bills with Official Receipts, Within 50-Kilometer" },
  { kind: "refundOr", plate: "OR, Excess Cash Advance" },
  { kind: "revisedOrder", plate: "Revised or Supplemental Office Order or Any Proof Supporting the Change of Schedule" },
  { kind: "revisedItinerary", plate: "Revised Itinerary of Travel" },
  { kind: "headCertification", plate: "Certification by the Head of Agency" },
  { kind: "rer", plate: "RER" },
  { kind: "receipts", plate: "Official Receipts" }
];

/** What only a trip brings: a fare, or lodging away from the office. Either says there was travel, whatever was
 * ticked (the security review, 2026-11-01). */
const TRAVEL_EXPENSES = ["Transportation", "Accommodation"];

/** The certificate comes from the attendee's own upload (R4), so it is never a file on the report's form. */
export const UPLOAD_KINDS: DocumentKind[] = DOCUMENT_SLOTS.map(s => s.kind).filter(k => k !== "certificate");

/** What a file with no kind counts as: a receipt, as the one box on the older form asked for. */
const NO_KIND: DocumentKind = "receipts";

/** What the claimant can tick, in the order the form lists them, and the document each brings in. */
export const TRAVEL_DECLARATIONS: { value: TravelDeclaration; label: string; brings?: DocumentKind }[] = [
  { value: "noTravel", label: "No travel: held at my own office" },
  { value: "scheduleChanged", label: "The schedule changed", brings: "revisedOrder" },
  { value: "itineraryNotFollowed", label: "I did not follow the approved itinerary", brings: "revisedItinerary" },
  { value: "overRate", label: "My expenses went over the prescribed rate per day", brings: "headCertification" },
  { value: "noOfficialReceipt", label: "An expense has no official receipt", brings: "rer" }
];

export function documentPlate(kind: DocumentKind | null | undefined): string {
  return DOCUMENT_SLOTS.find(s => s.kind === kind)?.plate ?? "";
}

export interface ReportFacts {
  reimbursement: boolean;
  /** The expense types of the report's lines. */
  expenseTypes: Array<string | null | undefined>;
  /** Whether money is handed back. */
  handsBack: boolean;
  declarations: TravelDeclaration[];
}

export interface RequiredDocument {
  kind: DocumentKind;
  /** Why it is required on this report, for the form. */
  why: string;
}

/** Every document this report needs, in the form's order. */
export function requiredDocuments(report: ReportFacts): RequiredDocument[] {
  const always = "Required on every report";
  const chosen = new Map<DocumentKind, string>([["certificate", always]]);
  if (report.reimbursement) {
    chosen.set("receipts", "For what you paid yourself");
  } else {
    // A Transportation or Accommodation line says there was travel, whatever was ticked: ticks stay as filed, but
    // a correction can add one, and that brings the two travel documents back.
    const noTravel = report.declarations.includes("noTravel");
    const travelled = TRAVEL_EXPENSES.find(t => report.expenseTypes.includes(t));
    if (!noTravel || travelled) {
      const why = noTravel ? `You claimed ${travelled}` : always;
      chosen.set("itinerary", why);
      chosen.set("travelCompleted", why);
    }
    if (report.expenseTypes.includes("Transportation")) chosen.set("tickets", "You claimed Transportation");
    if (report.expenseTypes.includes("Accommodation")) chosen.set("hotelBills", "You claimed Accommodation");
    if (report.handsBack) chosen.set("refundOr", "You are handing money back");
    for (const d of TRAVEL_DECLARATIONS) {
      if (d.brings && report.declarations.includes(d.value)) chosen.set(d.brings, `You ticked: ${d.label}`);
    }
  }
  return DOCUMENT_SLOTS.filter(s => chosen.has(s.kind)).map(s => ({ kind: s.kind, why: chosen.get(s.kind)! }));
}

/** The required documents with no file, in the form's order. */
export function missingDocuments(required: RequiredDocument[], attached: Array<DocumentKind | null | undefined>): DocumentKind[] {
  return required.map(r => r.kind).filter(kind => !attached.includes(kind));
}

/** The slots a correction opens: those the reviewer named, and those the report needs but its filed copies
 * don't fill (a new Accommodation line, money now handed back). A new file anywhere else stays off the report.
 * Null on a report filed before these rules, not an empty list: it keeps its one box, and this doesn't apply. */
export function correctionSlots(
  report: { travelDeclarations?: unknown },
  asked: DocumentKind[],
  required: RequiredDocument[],
  onReport: Array<DocumentKind | null | undefined>
): DocumentKind[] | null {
  if (!filedUnderDocuments(report)) return null;
  return [...new Set([...asked, ...missingDocuments(required, onReport)])];
}

/** "Still needed: a, b and c." */
export function missingDocumentsText(kinds: DocumentKind[]): string {
  const names = kinds.map(documentPlate);
  if (names.length === 0) return "";
  return `Still needed: ${names.length < 2 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`}.`;
}

/** What was ticked, as the report keeps it, or null when it isn't a list of known ticks. No travel means no
 * itinerary to depart from, so that tick goes with it. */
export function readDeclarations(value: unknown): TravelDeclaration[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  if (value.some(v => !TRAVEL_DECLARATIONS.some(d => d.value === v))) return null;
  const ticked = TRAVEL_DECLARATIONS.map(d => d.value).filter(v => value.includes(v));
  return ticked.includes("noTravel") ? ticked.filter(v => v !== "itineraryNotFollowed") : ticked;
}

/** The slot a file sent with a report goes in, or null when there is no such slot, or it isn't one a
 * report's form fills. A file that says nothing is a receipt. */
export function readDocumentKind(value: unknown): DocumentKind | null {
  if (value === undefined || value === null || value === "") return NO_KIND;
  return UPLOAD_KINDS.includes(value as DocumentKind) ? (value as DocumentKind) : null;
}

/** Why "No travel" can't stand on this report, or "": a vehicle request, or a Transportation or Accommodation
 * line, says there was travel (the security review, 2026-11-01). */
export function noTravelProblem(facts: { vehicleRequest: boolean; expenseTypes: Array<string | null | undefined> }): string {
  if (facts.vehicleRequest) return "A vehicle request stands for this seminar, so \"No travel\" can't be ticked.";
  const travelled = TRAVEL_EXPENSES.find(t => facts.expenseTypes.includes(t));
  return travelled ? `You claimed ${travelled}, so "No travel" can't be ticked.` : "";
}

/** What the claimant ticked, for the reviewers: "" when nothing was. */
export function declarationsText(declarations: readonly TravelDeclaration[] | null | undefined): string {
  return TRAVEL_DECLARATIONS.filter(d => (declarations ?? []).includes(d.value)).map(d => d.label).join("; ");
}

/** Whether a report was filed under these rules. */
export function filedUnderDocuments(report: { travelDeclarations?: unknown } | null | undefined): boolean {
  return Array.isArray(report?.travelDeclarations);
}
