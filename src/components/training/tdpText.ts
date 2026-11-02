// How Training Needs names the TDP in force (the instructor's review, R9): the file, the day (Manila) and who uploaded
// it, the way the server's own refusal names it ("file.xlsx" on Oct 30, 2026 by …).
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

/** "464 needs for 17 employees", and the needs carried in from an earlier year when there are any. */
export function tdpCountsText(tdp: TdpUpload, carried: number): string {
  const base = `${count(tdp.needs, "need")} for ${count(tdp.employees, "employee")}`;
  return carried > 0 ? `${base}, and ${carried} carried from an earlier year` : base;
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
