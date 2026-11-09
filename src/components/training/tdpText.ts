// How Training Needs names the TDP in force (the instructor's review, R9): the file, the day (Manila) and who uploaded
// it, the way the server's own refusal names it ("file.xlsx" on Oct 30, 2026 by …); how it counts the needs; and what
// the marks on needs that aren't the TDP's say (12ad, 12ae).
import type { OutsideTdpNeed, TdpUpload, TrainingNeedAddition } from "../../types";
import { formatDate } from "../../utils";
import { needAdditionBasisLabel } from "../../tdpAdditions";

const MANILA_DAY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" });

/** "Nov 2, 2026" in Manila, or "" for a blank or unreadable date. */
export function manilaDay(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : MANILA_DAY.format(at);
}

/** "1 need" / "464 needs". */
export const count = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** Who uploaded it, as the record names them ("" when not known). */
export const uploadedBy = (tdp: TdpUpload) => String(tdp.uploadedByName || tdp.uploadedBy || "").trim();

/** "464 needs for 17 employees", and the needs carried in from an earlier year when there are any. The TDP's own needs
 * as uploaded: those HR added after it (12ad), aren't the TDP's, and are counted apart (`addedText`). */
export function tdpCountsText(tdp: TdpUpload, carried: number): string {
  const base = `${count(tdp.needs, "need")} for ${count(tdp.employees, "employee")}`;
  return carried > 0 ? `${base}, and ${carried} carried from an earlier year` : base;
}

/** "2 needs added after the TDP": through "Add Training Need" (12ad). */
export const addedText = (added: number) => `${count(added, "need")} added after the TDP`;

/** "1 need outside the TDP": a training the TDP doesn't list, planned through "Add Training Need" (12ae). */
export const outsideText = (outside: number) => `${count(outside, "need")} outside the TDP`;

/** A justification's kind as a marker words it: "New law or issuance", or "other reason" (12ae). */
export const outsideKindText = (kind: unknown) => (kind === "Other" ? "other reason" : typeof kind === "string" && kind ? kind : "no reason recorded");

/** "a, b or c". */
export const orList = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`);

/** "Hired after the TDP was approved · added by … (HR Officer) on Nov 8, 2026 · note: …": an added need's marker says why,
 * who and when, and HR's note when there is one (the tooltip only: the note stays out of the audit log and the notices,
 * since it may mention someone's leave). Moved here from TdpPlanWindow.tsx (12ae). */
export function additionText(a: TrainingNeedAddition): string {
  const name = typeof a?.addedBy?.name === "string" ? a.addedBy.name.trim() : "";
  const role = typeof a?.addedBy?.role === "string" ? a.addedBy.role : "";
  const when = typeof a?.addedAt === "string" && !Number.isNaN(Date.parse(a.addedAt)) ? ` on ${formatDate(a.addedAt)}` : "";
  // The note too (an SO or Office Order number, the reason for "Another reason"): only HR and the Administrator open
  // this window. It stays out of the audit log and the notices.
  const note = typeof a?.note === "string" && a.note.trim() ? ` · note: ${a.note.trim()}` : "";
  return `${needAdditionBasisLabel(a?.basis)} · added${name ? ` by ${name}${role ? ` (${role})` : ""}` : ""}${when}${note}`;
}

/** "New law or issuance · approved by … (…) · ref. … · added by … (HR Officer) on Nov 9, 2026 · reason: …": a need for a
 * training outside the TDP (12ae) says why it is held, who approved it, who added it and when, and the reason, as 12ad's
 * mark gives its note (only HR and the Administrator open the TDP's window; the reason stays out of the audit log). */
export function outsideNeedText(o: OutsideTdpNeed): string {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const approver = text(o?.approvedBy?.name);
  const approverPosition = text(o?.approvedBy?.position);
  const reference = text(o?.referenceNo);
  const by = text(o?.addedBy?.name);
  const role = text(o?.addedBy?.role);
  const when = typeof o?.addedAt === "string" && !Number.isNaN(Date.parse(o.addedAt)) ? ` on ${formatDate(o.addedAt)}` : "";
  const reason = text(o?.reason);
  return [
    outsideKindText(o?.kind),
    approver ? `approved by ${approver}${approverPosition ? ` (${approverPosition})` : ""}` : "",
    reference ? `ref. ${reference}${text(o?.referenceDate) ? ` of ${formatDate(text(o?.referenceDate))}` : ""}` : "",
    `added${by ? ` by ${by}${role ? ` (${role})` : ""}` : ""}${when}`,
    reason ? `reason: ${reason}` : ""
  ].filter(Boolean).join(" · ");
}

const whole = (v: unknown) => Math.max(0, Math.trunc(Number(v)) || 0);

/** HR's own additions in a replacement's lists, by kind: one of the TDP's trainings after it (12ad), or a training outside
 * it (12ae, marked `outside`). Shared by the Replace summary and the import panel's counts. */
export function hrKinds(list: { outside?: true }[] | null | undefined): { after: number; outside: number } {
  const all = list ?? [];
  const outside = all.filter(n => !!n?.outside).length;
  return { after: all.length - outside, outside };
}

/** "2 needs added after the TDP", "1 need outside the TDP", or "3 needs HR added (2 after the TDP, 1 outside it)". */
export function hrNeedsText(list: { outside?: true }[] | null | undefined): string {
  const { after, outside } = hrKinds(list);
  if (!outside) return `${count(after, "need")} added after the TDP`;
  if (!after) return `${count(outside, "need")} outside the TDP`;
  return `${count(after + outside, "need")} HR added (${after} after the TDP, ${outside} outside it)`;
}

/** One kind of HR's additions in a replacement: "Of the needs added after the TDP, 2 stay as added and 1 is now in the
 * amended TDP." `stay` is how one kept is said. */
function changeSentence(which: string, kept: number, adopted: number, stay: [string, string]): string {
  if (!kept && !adopted) return "";
  const parts = [
    kept ? `${kept} ${kept === 1 ? stay[0] : stay[1]}` : "",
    adopted ? `${adopted} ${adopted === 1 ? "is" : "are"} now in the amended TDP` : ""
  ].filter(Boolean);
  return `Of the needs ${which}, ${parts.join(" and ")}.`;
}

/** What a replacement did to the needs HR added after the TDP (12ad) and to those for trainings outside it (12ae), or ""
 * when the plan had none: those it doesn't list stay, as carried ones do; those it lists become its own. */
export function addedChangesText(changes?: { addedKept?: number; adopted?: number; outsideKept?: number; outsideAdopted?: number }): string {
  return [
    changeSentence("added after the TDP", whole(changes?.addedKept), whole(changes?.adopted), ["stays as added", "stay as added"]),
    changeSentence("outside the TDP", whole(changes?.outsideKept), whole(changes?.outsideAdopted), ["stays", "stay"])
  ].filter(Boolean).join(" ");
}

/** The file, the day and who, joined: what the read-only window's subtitle says about the TDP. */
export function tdpSourceText(tdp: TdpUpload): string {
  const day = manilaDay(tdp.uploadedAt);
  const who = uploadedBy(tdp);
  return [
    tdp.filename,
    day || (tdp.kind === "before-records" ? "uploaded before uploads were recorded" : ""),
    who ? `by ${who}` : ""
  ].filter(Boolean).join(" · ");
}
