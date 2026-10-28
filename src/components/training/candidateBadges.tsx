// The participant picker's badges and dropdown labels for a candidate: eligibility, trainings this fiscal
// year, the Plan A columns that list the seminar, new hires, target matches and other seminars on the
// same days. Moved out of ParticipantPickerModal.tsx when it grew (Part A of the TDP exceptions, 12z).
import { TRAINING_NEED_COLUMN_LABELS, TrainingCandidate, type TrainingNeedCategory } from "../../types";
import { datesText } from "../../divisionCoverage";

export const BADGE = "px-1.5 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap";

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
// trainings, so this seminar would be their first of the year, or one more.
export function CandidateBadges({ c, selected = false }: { c: TrainingCandidate; selected?: boolean }) {
  // Their other trainings this fiscal year: at least one each year, so none yet is worth seeing.
  const thisYear = c.trainingsThisYear ?? [];
  return (
    <span className="flex flex-wrap gap-1">
      {!c.eligible && <span className={`${BADGE} bg-rose-50 text-rose-700 border-rose-200`}>{c.ineligibleReason}</span>}
      {c.eligible && thisYear.length === 0 && (
        <span className={`${BADGE} bg-blue-50 text-blue-700 border-blue-200`}>{selected ? "First training this FY" : "No training yet this FY"}</span>
      )}
      {thisYear.length > 0 && (
        <span className={`${BADGE} bg-slate-50 text-slate-700 border-slate-200`} title={`This fiscal year: ${thisYear.join("; ")}`}>
          {thisYear.length} {selected ? "other " : ""}training{thisYear.length === 1 ? "" : "s"} this FY
          {/* The titles, for keyboard and screen-reader users (the tooltip needs a mouse). */}
          <span className="sr-only">: {thisYear.join("; ")}</span>
        </span>
      )}
      {c.needsThis && (
        <span
          className={`${BADGE} bg-emerald-50 text-emerald-800 border-emerald-300`}
          title={`Plan A${columnLabels(c) ? `, ${columnLabels(c)}` : ""}: ${c.needMatches.join("; ")}`}
        >
          Needs this{columnsText(c) ? `: ${columnsText(c)}` : ""}
          {/* The titles, for keyboard and screen-reader users (the tooltip needs a mouse). */}
          <span className="sr-only"> ({c.needMatches.join("; ")})</span>
        </span>
      )}
      {c.priority === 1 && (
        <span className={`${BADGE} bg-emerald-50 text-emerald-700 border-emerald-200`}>
          New hire{c.monthsSinceHire !== null ? ` · ${c.monthsSinceHire < 1 ? "<1" : c.monthsSinceHire} mo` : ""}
        </span>
      )}
      {c.matchesTarget && <span className={`${BADGE} bg-slate-50 text-slate-700 border-slate-200`}>Target match</span>}
      {(c.awayOn ?? []).length > 0 && (
        <span className={`${BADGE} bg-amber-50 text-amber-700 border-amber-200`}>At another seminar on {datesText(c.awayOn!)}</span>
      )}
    </span>
  );
}

// `seminarCovers`: the seminar's own justification covers everyone on it (12z Part C).
export function optionLabel(c: TrainingCandidate, seminarCovers = false) {
  const extras = [c.division || "No division"];
  if (c.needsThis) extras.push(columnsText(c) ? `listed in their plan (${columnsText(c)})` : "listed in their plan");
  else if (!seminarCovers) extras.push("not in their plan: needs a justification");
  if (c.priority === 1 && c.monthsSinceHire !== null) extras.push(`hired ${c.monthsSinceHire < 1 ? "this month" : `${c.monthsSinceHire} mo ago`}`);
  const trained = (c.trainingsThisYear ?? []).length;
  extras.push(trained === 0 ? "no training yet this FY" : `${trained} training${trained === 1 ? "" : "s"} this FY`);
  if (c.matchesTarget) extras.push("target match");
  if ((c.awayOn ?? []).length > 0) extras.push(`at another seminar on ${datesText(c.awayOn!)}`);
  return `${c.fullName} — ${extras.join(" · ")}`;
}
