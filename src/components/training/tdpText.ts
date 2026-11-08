// How Training Needs names the TDP in force (the instructor's review, R9): the file, the day (Manila) and who uploaded
// it, the way the server's own refusal names it ("file.xlsx" on Oct 30, 2026 by …); and how it counts the needs.
import type { TdpUpload } from "../../types";

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
 * as uploaded: those HR added after it, one at a time (12ad), aren't the TDP's, and are counted apart (`addedText`). */
export function tdpCountsText(tdp: TdpUpload, carried: number): string {
  const base = `${count(tdp.needs, "need")} for ${count(tdp.employees, "employee")}`;
  return carried > 0 ? `${base}, and ${carried} carried from an earlier year` : base;
}

/** "2 needs added after the TDP": through "Add Training Need" (12ad). */
export const addedText = (added: number) => `${count(added, "need")} added after the TDP`;

/** What a replacement did to the needs HR added after the TDP (12ad), or "" when the plan had none: those it doesn't
 * list stay, as carried ones do; those it lists become its own. */
export function addedChangesText(changes?: { addedKept?: number; adopted?: number }): string {
  const kept = Math.max(0, Math.trunc(Number(changes?.addedKept)) || 0);
  const adopted = Math.max(0, Math.trunc(Number(changes?.adopted)) || 0);
  if (!kept && !adopted) return "";
  const parts = [
    kept ? `${kept} ${kept === 1 ? "stays" : "stay"} as added` : "",
    adopted ? `${adopted} ${adopted === 1 ? "is" : "are"} now in the amended TDP` : ""
  ].filter(Boolean);
  return `Of the needs added after the TDP, ${parts.join(" and ")}.`;
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
