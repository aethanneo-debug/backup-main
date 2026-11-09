// Planning a seminar from the plan, in Programs & Budget: who a row added from the plan seats, and the justification a
// training planned outside the TDP gives a seminar for it to start from (12ae). Both read the server (the participant
// picker's ranking and the year's catalog). Moved out of PlanNeedPicker.tsx, which kept its picker and the row's note.
import type { SeminarTdpJustificationInput, TrainingCandidate, TrainingNeedCatalogItem } from "../../types";
import { apiCall } from "../../utils";
import { normalizeTitle } from "../../tdpRules";
import { onScreenToChoose, seatsWithoutJustification } from "./pickGroups";

/**
 * The employees to seat in a seminar named `title` that covers these plan needs: those whose
 * Plan A lists any of them, whom the server would enrol, and who are on the participant picker's
 * screen at first: no training yet this fiscal year, or a mandated need for it (the instructor's
 * review, R10). Same endpoint and ranking as the picker (GET /api/training/recommendations). Ids
 * are Employee.id, the form participantIds stores. Those who planned it outside the TDP (12ae) are
 * seated too when the seminar's own justification will cover everyone on it (the server's
 * `seminarCovers`), as for a training only planned outside the TDP; otherwise nobody would be.
 */
export async function eligibleListers(title: string, fiscalYear: string, needTitles: string[] = [title]): Promise<string[]> {
  const params = new URLSearchParams({ title, fiscalYear, maxParticipants: "999" });
  for (const need of needTitles) params.append("needTitle", need);
  const res = await apiCall(`/api/training/recommendations?${params.toString()}`);
  if (res?.status !== "success") throw new Error(res?.message || "Unable to load recommendations.");
  const candidates: TrainingCandidate[] = res.data?.candidates ?? [];
  const covers = res.data?.seminarCovers === true;
  return candidates.filter(c => seatsWithoutJustification(c, covers) && onScreenToChoose(c, false)).map(c => c.employeeId);
}

/** The titles a year's catalog lists only outside the TDP (12ae: no TDP need has the title), normalised as titles are
 * matched. A seminar covering only these is held outside the TDP. */
export function outsideCatalogTitles(items: TrainingNeedCatalogItem[] | null | undefined): Set<string> {
  return new Set((items ?? []).filter(n => n?.outside).map(n => normalizeTitle(n.title)).filter(Boolean));
}

/**
 * The justification of a training planned outside the TDP (12ae) that a seminar covering `needTitles`
 * answers: the first such training in the year's catalog (GET /api/training/needs/catalog), for the
 * seminar's own to start from. null when none is, or the catalog couldn't be read: the form then
 * opens empty, as it always has.
 */
export async function outsideNeedJustification(fiscalYear: string | undefined, needTitles: string[]): Promise<SeminarTdpJustificationInput | null> {
  const wanted = new Set((needTitles ?? []).map(normalizeTitle).filter(Boolean));
  if (wanted.size === 0) return null;
  try {
    const res = await apiCall(`/api/training/needs/catalog${fiscalYear ? `?fiscalYear=${encodeURIComponent(fiscalYear)}` : ""}`);
    const items: TrainingNeedCatalogItem[] = Array.isArray(res?.data?.needs) ? res.data.needs : [];
    return items.find(n => n?.outside && wanted.has(normalizeTitle(n.title)))?.outside ?? null;
  } catch {
    return null;
  }
}
