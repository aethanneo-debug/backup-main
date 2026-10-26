// Enrolments as the training budget rule reads them (src/trainingBudget.ts), built from the stored
// records. server.ts's participantsForBudget passes the database in; kept apart so the whole chain,
// from cash advances and ledger rows to what a seminar holds, can be tested.
//
// Each enrolment carries the cash advance Finance released for it that is not yet liquidated or
// refunded (`advanceOutstanding`), because a seminar never holds less than the cash still out for
// it. A group advance is split by its covers' amounts (src/advanceCoverage.ts), so each person's
// share is held once: on the holder alone it would count on top of the others' shares. The advance
// pays for what HR has already entered for that participant by hand (that is in the seminar's
// spending), so only the rest counts as out. That holds whatever their attendance, so recording it
// never moves money (HR can't enter spending for someone marked "Did not attend"). A report or a
// refund settles the advance. HR's planner reads this list too, so it prices seminars exactly as
// the server does. `changed` prices an attendance change before it is saved.
//
// A validated ("Liquidated") enrolment carries what it spent (`settledSpent`), so its unspent share
// returns to Unallocated at once (the seminar budget flow, 2026-10-19): its rows in the training
// ledger (validation writes them from the report) or, when it has none, its validated report. One
// settled by its group's report carries the lines written for it, or ₱0: the group's spending sits
// on the rows of whoever each line was for (the holder's for the rest), so nothing counts twice and
// no share stays held. Older code liquidated some enrolments with neither (ledger rows without the
// enrolment's id before 2026-09-20, or the retired approve_liquidation); those keep their share held.

import { centavos, pesos } from "../liquidationMoney";
import { coveredEnrolmentIds, isGroupAdvance, releasedByEnrolment, type CoverableAdvance } from "../advanceCoverage";

export interface BudgetSources {
  participants: readonly any[];
  advances: readonly CoverableAdvance[];
  /** The training ledger (db.trainingLiquidations). */
  ledgerRows: readonly any[];
  /** Liquidation reports (db.liquidationSubmissions). */
  reports: readonly any[];
}

export function enrolmentsForBudget(src: BudgetSources, changed?: { id: string; attendance: string }): any[] {
  const out = releasedByEnrolment(src.advances);
  // Per enrolment: HR's hand entries (the rows a validated report replaces), and every row.
  const hand = new Map<string, number>();
  const spentBy = new Map<string, number>();
  for (const r of src.ledgerRows ?? []) {
    if (!r || !r.trainingParticipantId) continue;
    spentBy.set(r.trainingParticipantId, (spentBy.get(r.trainingParticipantId) || 0) + centavos(r.amount));
    if (r.source !== "report") hand.set(r.trainingParticipantId, (hand.get(r.trainingParticipantId) || 0) + centavos(r.amount));
  }
  // Enrolments settled by their group's report: Finance validated it, which liquidated the advance.
  const groupSettled = new Set<string>();
  for (const a of src.advances ?? []) {
    if (a && a.status === "Liquidated" && isGroupAdvance(a)) for (const id of coveredEnrolmentIds(a)) groupSettled.add(id);
  }
  return (src.participants ?? []).map((p: any) => {
    let q = p && changed && p.id === changed.id ? { ...p, attendance: changed.attendance } : p;
    if (!q) return q;
    if (q.status === "Liquidated") {
      if (spentBy.has(q.id)) q = { ...q, settledSpent: pesos(spentBy.get(q.id)!) };
      else if (groupSettled.has(q.id)) q = { ...q, settledSpent: 0 };
      else {
        const report = (src.reports ?? []).find((s: any) => s && s.activityId === q.id && s.financeValidatedAt);
        if (report) q = { ...q, settledSpent: pesos(centavos(report.totalSpent)) };
      }
    }
    if (!out.has(q.id)) return q;
    return { ...q, advanceOutstanding: pesos(Math.max(0, out.get(q.id)! - (hand.get(q.id) || 0))) };
  });
}
