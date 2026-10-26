// Which cash advance pays for a seminar enrolment, and which report settles it. HSAC RAB 1
// (2026-10-26, .claude/context/hsac-answers.md): participants who attend together may have one
// cash advance processed for all of them, liquidated by one report and refunded once.
//
// An individual advance pays for the one enrolment it was released for (`activityId`). A group
// advance pays for several enrolments of the same seminar (`covers`, the holder's first), each with
// its own amount, fixed at release. Every lookup goes through here, so an enrolment a group covers
// is never taken for unfunded (and paid a second time) or unreported (and liquidated a second
// time). Pure functions over the stored records, used by server.ts and the screens.

import { centavos, pesos } from "./liquidationMoney";

/** The fields of a cash advance these rules read. */
export interface CoverableAdvance {
  id: string;
  activityId: string;
  status: string;
  amount: number | string;
  employeeId?: string;
  covers?: Array<{ participantId: string; employeeId?: string; employeeName?: string; amount: number | string }> | null;
}

/** The fields of a liquidation report these rules read. */
export interface CoverableReport {
  activityId: string;
  cashAdvanceId?: string;
}

/** An advance still open: a request waiting for Finance, or cash out. At most one covers an enrolment. */
export const OPEN_ADVANCE_STATUSES: readonly string[] = ["Requested", "Released"];

/** A group advance: it lists the enrolments it pays for. */
export function isGroupAdvance(a: CoverableAdvance | null | undefined): boolean {
  return !!a && Array.isArray(a.covers) && a.covers.length > 0;
}

/** The enrolments an advance pays for: its covers, or the one it was released for. */
export function coveredEnrolmentIds(a: CoverableAdvance | null | undefined): string[] {
  if (!a) return [];
  if (isGroupAdvance(a)) return a.covers!.map((c) => c?.participantId).filter((id): id is string => !!id);
  return a.activityId ? [a.activityId] : [];
}

/** Whether an advance pays for an enrolment. */
export function advanceCovers(a: CoverableAdvance | null | undefined, enrolmentId: string): boolean {
  return !!enrolmentId && coveredEnrolmentIds(a).includes(enrolmentId);
}

/** Every advance that pays for an enrolment, whatever its status, in stored order. */
export function advancesCovering<T extends CoverableAdvance>(advances: readonly T[] | null | undefined, enrolmentId: string): T[] {
  return (advances ?? []).filter((a) => !!a && advanceCovers(a, enrolmentId));
}

/** The advance in one of `statuses` that pays for an enrolment, the earlier statuses first. */
export function advanceCovering<T extends CoverableAdvance>(advances: readonly T[] | null | undefined, enrolmentId: string, statuses: readonly string[]): T | null {
  const list = advancesCovering(advances, enrolmentId);
  for (const status of statuses) {
    const found = list.find((a) => a.status === status);
    if (found) return found;
  }
  return null;
}

/** An enrolment's share of an advance, in centavos: its amount in a group, the whole advance when the
 * advance is its own, 0 when the advance doesn't pay for it. */
export function portionCentavos(a: CoverableAdvance, enrolmentId: string): number {
  if (isGroupAdvance(a)) {
    const cover = a.covers!.find((c) => c?.participantId === enrolmentId);
    return cover ? Math.max(0, centavos(cover.amount)) : 0;
  }
  return a.activityId === enrolmentId ? Math.max(0, centavos(a.amount)) : 0;
}

/** What a report on an advance may spend, in centavos. A group's: the shares of those who attended
 * (the holder's only if they did), since an absent member's share is handed back in the group's one
 * refund, as their own advance would be (HSAC RAB 1). Anyone else's: the whole advance. */
export function spendableCentavos(a: CoverableAdvance, attended: (participantId: string) => boolean): number {
  if (!isGroupAdvance(a)) return Math.max(0, centavos(a.amount));
  return a.covers!.reduce((s, c) => s + (c && attended(c.participantId) ? Math.max(0, centavos(c.amount)) : 0), 0);
}

/** What a group's covers add up to, in pesos: summed in centavos, so the total is exactly its parts. */
export function coversTotal(covers: ReadonlyArray<{ amount: number | string }> | null | undefined): number {
  return pesos((covers ?? []).reduce((s, c) => s + Math.max(0, centavos(c?.amount)), 0));
}

/** Cash still out per enrolment, in centavos: every Released advance, a group's split by its amounts,
 * so the training budget holds each person's share once (src/server/budgetEnrolments.ts). */
export function releasedByEnrolment(advances: readonly CoverableAdvance[] | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of advances ?? []) {
    if (!a || a.status !== "Released") continue;
    for (const id of coveredEnrolmentIds(a)) out.set(id, (out.get(id) || 0) + portionCentavos(a, id));
  }
  return out;
}

/** The report that settles an enrolment: its own, or the one filed on the group advance covering it. */
export function reportCovering<R extends CoverableReport>(reports: readonly R[] | null | undefined, advances: readonly CoverableAdvance[] | null | undefined, enrolmentId: string): R | null {
  const list = reports ?? [];
  const own = list.find((s) => !!s && s.activityId === enrolmentId);
  if (own) return own;
  const groups = new Set(advancesCovering(advances, enrolmentId).filter(isGroupAdvance).map((a) => a.id));
  if (groups.size === 0) return null;
  return list.find((s) => !!s && !!s.cashAdvanceId && groups.has(s.cashAdvanceId)) || null;
}
