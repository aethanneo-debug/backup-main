// Who the TDP identifies for a seminar, and what a justification for anyone else must hold (HSAC
// RAB 1's answer of 2026-10-28, known-issues 12z): the plan decides both the training and the person,
// but "case to case", someone else may be seated with a recorded reason. Shared by the server and the
// participant picker; tested in tests/tdpRules.test.ts.
import { cleanText, isCalendarDate } from "./inputText";
import {
  SEMINAR_TDP_KINDS, TDP_COMMITTEES, type SeminarTdpJustificationInput, type SeminarTdpKind, type SeminarTdpStanding,
  type TdpCommittee, type TdpJustificationInput, type TdpPerson, type TdpStanding
} from "./types";

/** A training title as titles are matched everywhere: lowercase, anything but letters and digits as
 * one space. A title that isn't text (stored before the checks on save) counts as none. */
export function normalizeTitle(title: unknown): string {
  return (typeof title === "string" ? title : "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface NeedRef { employeeId: string; fiscalYear: string; title: string }
export interface SeminarNeeds { fiscalYear?: string; fulfillsNeedTitles?: string[] }

/** The employee's own Plan A entries the seminar covers: its fiscal year, a title it covers. `forms`
 * are the ids a need may be stored under (the internal id and the staff code). */
export function coveredNeeds<N extends NeedRef>(needs: N[], forms: string[], seminar: SeminarNeeds): N[] {
  const covered = new Set((seminar.fulfillsNeedTitles ?? []).map(normalizeTitle).filter(Boolean));
  if (covered.size === 0) return [];
  return (needs ?? []).filter(n => !!n && forms.includes(n.employeeId) && n.fiscalYear === seminar.fiscalYear
    && covered.has(normalizeTitle(n.title)));
}

/** Where an enrolment stands: identified, justified (their own justification, or their seminar's), or
 * outside the TDP from before the rule (no `assignedAt`) or since (its seminar's needs or the plan
 * changed after it was made). */
export function tdpStanding(e: { identified: boolean; tdpException?: unknown; underSeminar?: unknown; assignedAt?: string }): TdpStanding {
  if (e.identified) return "identified";
  if (e.tdpException) return "justified";
  if (e.underSeminar) return "seminar";
  return e.assignedAt ? "missing" : "beforeRule";
}

/** Whether a seminar is in the TDP (Part C): one of the titles it covers is a need in its fiscal year's
 * Plan A, anyone's. A title typed in that no plan lists doesn't count. */
export function seminarCoversPlan(needs: { fiscalYear: string; title: string }[], seminar: SeminarNeeds): boolean {
  const covered = new Set((seminar.fulfillsNeedTitles ?? []).map(normalizeTitle).filter(Boolean));
  return covered.size > 0 && (needs ?? []).some(n => !!n && n.fiscalYear === seminar.fiscalYear && covered.has(normalizeTitle(n.title)));
}

/** The day the seminar rule took effect (Manila): a seminar created before it is "outside the TDP
 * (before this rule)", one created since and still outside it with no justification lost its need
 * afterwards. It is the day Part C was built; move it if it goes live later. */
export const SEMINAR_TDP_RULE_SINCE = "2026-10-29";

// The Manila date of a stored timestamp ("" when it isn't one): stored times are UTC, and Manila's day
// starts 8 hours earlier.
function manilaDate(iso: unknown): string {
  const t = Date.parse(String(iso ?? ""));
  return Number.isNaN(t) ? "" : new Date(t + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Where a seminar stands against the TDP. */
export function seminarTdpStanding(s: { inTdp: boolean; tdpException?: unknown; createdAt?: string }): SeminarTdpStanding {
  if (s.inTdp) return "inTdp";
  if (s.tdpException) return "justified";
  return manilaDate(s.createdAt) < SEMINAR_TDP_RULE_SINCE ? "beforeRule" : "missing";
}

/** Whether a save must give the seminar's own justification: it leaves the seminar outside the TDP with
 * none that applies (on record, or sent), and the seminar is new, was in the TDP, or was renamed away
 * from the training its justification names (`renamedFromJustified`). Only a change counts, so an older
 * seminar outside it isn't refused for being re-saved, or renamed. */
export function seminarNeedsJustification(s: { isNew: boolean; inTdpBefore: boolean; inTdpAfter: boolean; justified: boolean; renamedFromJustified?: boolean }): boolean {
  return !s.inTdpAfter && !s.justified && (s.isNew || s.inTdpBefore || !!s.renamedFromJustified);
}

export interface SeatCheck {
  id: string;                // the seat (the server uses the enrolment's id)
  newSeat: boolean;          // this save seats them
  identifiedBefore: boolean; // by the seminar as it was (false for a new seat)
  identifiedAfter: boolean;  // by the seminar as saved
  justified: boolean;        // a justification on record, or sent with this save
  keptForHistory?: boolean;  // unticked, but kept for their attendance, advance or evaluation
}

/** Who a save would leave outside the TDP with no justification: the people it seats, and those it
 * turns outside by changing the seminar's needs. Anyone already outside before the save, or kept
 * only for their history, isn't held against it: only what a change adds counts, as with the
 * division rule (12x). */
export function seatsNeedingJustification(seats: SeatCheck[]): string[] {
  return (seats ?? []).filter(s => !s.identifiedAfter && !s.justified
    && (s.newSeat || (s.identifiedBefore && !s.keptForHistory))).map(s => s.id);
}

export const TDP_REASON_MAX = 500;
export const TDP_NAME_MAX = 100;       // a name, a position, or a committee named by hand
export const TDP_REFERENCE_MAX = 50;

/** A justification as sent, checked and cleaned, or why it can't be saved. `today` is Manila's
 * date: a reference can't be dated later. */
export function readTdpJustification(raw: unknown, today: string): { value: TdpJustificationInput } | { problem: string } {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const kind = r.kind;
  if (kind !== "Designated" && kind !== "Identified by the Chief" && kind !== "Other") {
    return { problem: "Choose why they are seated: designated to do the tasks, identified by the Chief, or another reason." };
  }
  let committee: TdpCommittee | undefined;
  let committeeOther: string | undefined;
  if (kind === "Designated") {
    if (!(TDP_COMMITTEES as readonly unknown[]).includes(r.committee)) return { problem: "Choose the committee they are designated to." };
    committee = r.committee as TdpCommittee;
    if (committee === "Other") {
      committeeOther = cleanText(r.committeeOther);
      if (!committeeOther || committeeOther.length > TDP_NAME_MAX) return { problem: `Name the committee, up to ${TDP_NAME_MAX} characters.` };
    }
  }
  const reason = readReason(r.reason);
  if (!reason) return { problem: `Give the reason, up to ${TDP_REASON_MAX} characters.` };
  const identifiedBy = readPerson(r.identifiedBy);
  if (!identifiedBy) return { problem: `Name who identified them, and their position (up to ${TDP_NAME_MAX} characters each).` };
  const value: TdpJustificationInput = { kind, reason, identifiedBy };
  if (committee) value.committee = committee;
  if (committeeOther) value.committeeOther = committeeOther;
  const reference = readReference(r, today);
  if ("problem" in reference) return reference;
  return { value: { ...value, ...reference.value } };
}

/** A seminar's own justification as sent (Part C), checked and cleaned, or why it can't be saved: the
 * kind, the reason and who approved holding it; a reference (memo, invitation, issuance) optional. */
export function readSeminarTdpJustification(raw: unknown, today: string): { value: SeminarTdpJustificationInput } | { problem: string } {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  if (!(SEMINAR_TDP_KINDS as readonly unknown[]).includes(r.kind)) {
    return { problem: "Choose why it is held: a Central Office training, an invitation from another agency, a new law or issuance, or another reason." };
  }
  const reason = readReason(r.reason);
  if (!reason) return { problem: `Give the reason, up to ${TDP_REASON_MAX} characters.` };
  const approvedBy = readPerson(r.approvedBy);
  if (!approvedBy) return { problem: `Name who approved it, and their position (up to ${TDP_NAME_MAX} characters each).` };
  const reference = readReference(r, today);
  if ("problem" in reference) return reference;
  return { value: { kind: r.kind as SeminarTdpKind, reason, approvedBy, ...reference.value } };
}

function readReason(raw: unknown): string | null {
  const reason = cleanText(raw);
  return reason && reason.length <= TDP_REASON_MAX ? reason : null;
}

function readPerson(raw: unknown): TdpPerson | null {
  const by = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = cleanText(by.name);
  const position = cleanText(by.position);
  return name && position && name.length <= TDP_NAME_MAX && position.length <= TDP_NAME_MAX ? { name, position } : null;
}

// The optional reference number and date, shared by both kinds of justification.
function readReference(r: Record<string, unknown>, today: string): { value: { referenceNo?: string; referenceDate?: string } } | { problem: string } {
  const value: { referenceNo?: string; referenceDate?: string } = {};
  if (r.referenceNo != null && r.referenceNo !== "") {
    if (typeof r.referenceNo !== "string") return { problem: "Enter the reference number as text." };
    const referenceNo = cleanText(r.referenceNo);
    // Too long (cleanText gives "" for anything over its raw cap too); blank once cleaned is none.
    if (referenceNo.length > TDP_REFERENCE_MAX || (!referenceNo && r.referenceNo.length > TDP_REFERENCE_MAX)) {
      return { problem: `Keep the reference number to ${TDP_REFERENCE_MAX} characters.` };
    }
    if (referenceNo) value.referenceNo = referenceNo;
  }
  if (r.referenceDate != null && r.referenceDate !== "") {
    if (!isCalendarDate(r.referenceDate) || r.referenceDate > today) return { problem: "Enter the reference's date as YYYY-MM-DD, no later than today." };
    value.referenceDate = r.referenceDate;
  }
  return { value };
}

type KindOnly = Pick<TdpJustificationInput, "kind" | "committee" | "committeeOther">;

/** The kind as a label, for the audit entry and the Administrator's notice. */
export function tdpKindText(j: KindOnly): string {
  if (j.kind === "Designated") return `Designated (${j.committee === "Other" ? j.committeeOther || "another committee" : j.committee})`;
  if (j.kind === "Identified by the Chief") return "Identified by the Chief";
  return "Other reason";
}

/** The badge for an enrolment the TDP doesn't identify; null when it does. */
export function tdpBadgeText(standing: TdpStanding | undefined, j?: KindOnly): string | null {
  if (!standing || standing === "identified") return null;
  if (standing === "seminar") return "Under the seminar's justification";
  if (standing === "beforeRule") return "Outside the TDP (before this rule)";
  if (standing === "missing" || !j) return "Outside the TDP: no justification";
  if (j.kind === "Designated") return `Designated: ${j.committee === "Other" ? j.committeeOther || "other committee" : j.committee}`;
  if (j.kind === "Identified by the Chief") return "Identified by the Chief";
  return "Outside the TDP: other reason";
}

/** The label for a seminar the TDP doesn't cover; null when it does. */
export function seminarTdpBadgeText(standing: SeminarTdpStanding | undefined, j?: { kind: SeminarTdpKind }): string | null {
  if (!standing || standing === "inTdp") return null;
  if (standing === "beforeRule") return "Not in the TDP (before this rule)";
  if (standing === "missing" || !j) return "Not in the TDP: no justification";
  return `Not in the TDP: ${j.kind === "Other" ? "other reason" : j.kind}`;
}
