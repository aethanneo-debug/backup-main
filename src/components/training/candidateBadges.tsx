// The participant picker's badges for a candidate: eligibility, trainings this fiscal year, the Plan A
// columns that list the seminar, new hires, target matches and other seminars on the same days. Moved out
// of ParticipantPickerModal.tsx when it grew (Part A of the TDP exceptions, 12z). The dropdown's option
// labels that were here went with the dropdown (2026-10-30); the picker's checklist is ParticipantChecklist.tsx.
import type { ReactNode } from "react";
import { Scale, Sparkles } from "lucide-react";
import { TRAINING_NEED_COLUMN_LABELS, TrainingCandidate, type TrainingNeedCategory } from "../../types";
import { datesText } from "../../divisionCoverage";

// No nowrap: a badge naming several Plan A columns or laws is wider than a row at phone width, and would
// push the dialog sideways. In the rows' wrapping flex line a badge that fits still sits on one line.
export const BADGE = "px-1.5 py-0.5 rounded border text-[10px] font-semibold";

// Each badge's colours (background, text, border). The list's "How this list is ordered" shows samples
// in the same colours, so a badge and its explanation always look alike.
export const TONE = {
  ineligible: "bg-rose-50 text-rose-700 border-rose-200",
  firstTraining: "bg-blue-50 text-blue-700 border-blue-200",
  neutral: "bg-slate-50 text-slate-700 border-slate-200",
  needsThis: "bg-emerald-50 text-emerald-800 border-emerald-300",
  mandated: "bg-blue-50 text-blue-700 border-blue-200",
  newHire: "bg-emerald-50 text-emerald-700 border-emerald-200",
  away: "bg-amber-50 text-amber-700 border-amber-200",
  // Someone outside the plan: ticking them asks why they are seated, unless the seminar's own
  // justification covers everyone on it (12z Part C).
  needsJustification: "bg-amber-50 text-amber-800 border-amber-300",
  underSeminar: "bg-slate-50 text-slate-700 border-slate-300",
  // A ticked row's standing against the TDP: on record without a justification (before the rule, or
  // missing) in amber; a justification kept here or on record in slate.
  unjustified: "bg-amber-50 text-amber-800 border-amber-200",
  justified: "bg-slate-50 text-slate-700 border-slate-300",
  // The top of the order, one for each free seat. Solid navy, unlike every other badge, so the rows to
  // start from stand out in a long list.
  recommended: "bg-blue-600 text-white border-blue-600"
} as const;

export function RecommendedBadge({ id, className = "" }: { id?: string; className?: string }) {
  return (
    <span id={id} className={`${BADGE} ${TONE.recommended} inline-flex items-center gap-1 ${className}`}>
      <Sparkles size={10} aria-hidden="true" />
      Recommended
    </span>
  );
}

// The Plan A column a need is listed under, as the badge names it (the form's own words, shortened).
// The same training can be needed for the function or for an additional designation (HSAC RAB 1's
// answer 6: RA 12009 for the Admin Officer IV, and for Budget staff on the BAC TWG).
const COLUMN_NAME: Record<TrainingNeedCategory, string> = {
  "Function": "Function",
  "Additional Function": "Additional Function/Designation",
  "Career Advancement": "Career Advancement"
};
const columnsText = (c: TrainingCandidate) => (c.needCategories ?? []).map(k => COLUMN_NAME[k]).join(", ");
// The official column names, for the badge's tooltip.
const columnLabels = (c: TrainingCandidate) => (c.needCategories ?? []).map(k => TRAINING_NEED_COLUMN_LABELS[k]).join("; ");

// `selected`: they are already on this seminar's list, and the server counts only their other
// trainings, so this seminar would be their first of the year, or one more. `children`: more badges,
// after these (the row's standing against the TDP).
export function CandidateBadges({ c, selected = false, children }: { c: TrainingCandidate; selected?: boolean; children?: ReactNode }) {
  // Their other trainings this fiscal year: at least one each year, so none yet is worth seeing.
  const thisYear = c.trainingsThisYear ?? [];
  return (
    <span className="flex flex-wrap gap-1">
      {!c.eligible && <span className={`${BADGE} ${TONE.ineligible}`}>{c.ineligibleReason}</span>}
      {c.eligible && thisYear.length === 0 && (
        <span className={`${BADGE} ${TONE.firstTraining}`}>{selected ? "First training this FY" : "No training yet this FY"}</span>
      )}
      {thisYear.length > 0 && (
        <span className={`${BADGE} ${TONE.neutral}`} title={`This fiscal year: ${thisYear.join("; ")}`}>
          {thisYear.length} {selected ? "other " : ""}training{thisYear.length === 1 ? "" : "s"} this FY
          {/* The titles, for keyboard and screen-reader users (the tooltip needs a mouse). */}
          <span className="sr-only">: {thisYear.join("; ")}</span>
        </span>
      )}
      {c.needsThis && (
        <span
          className={`${BADGE} ${TONE.needsThis}`}
          title={`Plan A${columnLabels(c) ? `, ${columnLabels(c)}` : ""}: ${c.needMatches.join("; ")}`}
        >
          Needs this{columnsText(c) ? `: ${columnsText(c)}` : ""}
          {/* The titles, for keyboard and screen-reader users (the tooltip needs a mouse). */}
          <span className="sr-only"> ({c.needMatches.join("; ")})</span>
        </span>
      )}
      {/* A need the law requires (HSAC RAB 1's step 5): such listers come first. The scale (the panel's
          icon) sets it apart from the blue "No training yet" badge beside it. */}
      {(c.mandatedNeeds ?? []).length > 0 && (
        <span className={`${BADGE} inline-flex items-center gap-1 ${TONE.mandated}`} title={c.mandatedNeeds!.map(m => `${m.title}: ${m.basis}`).join("; ")}>
          <Scale size={10} aria-hidden="true" />
          Mandated: {[...new Set(c.mandatedNeeds!.map(m => m.basis))].join(", ")}
          {/* The titles, for keyboard and screen-reader users (the tooltip needs a mouse). */}
          <span className="sr-only"> ({c.mandatedNeeds!.map(m => m.title).join("; ")})</span>
        </span>
      )}
      {c.priority === 1 && (
        <span className={`${BADGE} ${TONE.newHire}`}>
          New hire{c.monthsSinceHire !== null ? ` · ${c.monthsSinceHire < 1 ? "<1" : c.monthsSinceHire} mo` : ""}
        </span>
      )}
      {c.matchesTarget && <span className={`${BADGE} ${TONE.neutral}`}>Target match</span>}
      {(c.awayOn ?? []).length > 0 && (
        <span className={`${BADGE} ${TONE.away}`}>At another seminar on {datesText(c.awayOn!)}</span>
      )}
      {children}
    </span>
  );
}
