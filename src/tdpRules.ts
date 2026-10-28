// Who the TDP identifies for a seminar, and what a justification for anyone else must hold (HSAC
// RAB 1's answer of 2026-10-28, known-issues 12z): the plan decides both the training and the person,
// but "case to case", someone else may be seated with a recorded reason. Shared by the server and the
// participant picker; tested in tests/tdpRules.test.ts.
import { cleanText, isCalendarDate } from "./inputText";
import { TDP_COMMITTEES, type TdpCommittee, type TdpJustificationInput, type TdpStanding } from "./types";

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

/** Where an enrolment stands: identified, justified, or outside the TDP from before the rule (no
 * `assignedAt`) or since (its seminar's needs or the plan changed after it was made). */
export function tdpStanding(e: { identified: boolean; tdpException?: unknown; assignedAt?: string }): TdpStanding {
  if (e.identified) return "identified";
  if (e.tdpException) return "justified";
  return e.assignedAt ? "missing" : "beforeRule";
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
  const reason = cleanText(r.reason);
  if (!reason || reason.length > TDP_REASON_MAX) return { problem: `Give the reason, up to ${TDP_REASON_MAX} characters.` };
  const by = (r.identifiedBy && typeof r.identifiedBy === "object" ? r.identifiedBy : {}) as Record<string, unknown>;
  const name = cleanText(by.name);
  const position = cleanText(by.position);
  if (!name || !position || name.length > TDP_NAME_MAX || position.length > TDP_NAME_MAX) {
    return { problem: `Name who identified them, and their position (up to ${TDP_NAME_MAX} characters each).` };
  }
  const value: TdpJustificationInput = { kind, reason, identifiedBy: { name, position } };
  if (committee) value.committee = committee;
  if (committeeOther) value.committeeOther = committeeOther;
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
  if (standing === "beforeRule") return "Outside the TDP (before this rule)";
  if (standing === "missing" || !j) return "Outside the TDP: no justification";
  if (j.kind === "Designated") return `Designated: ${j.committee === "Other" ? j.committeeOther || "other committee" : j.committee}`;
  if (j.kind === "Identified by the Chief") return "Identified by the Chief";
  return "Outside the TDP: other reason";
}
