// What has happened to a liquidation report, newest first (the instructor's review, R8). It is worked out from
// what the report already stores, so nothing new is recorded for it and it works on every report filed so far:
// the screen is the View window (liquidation/ReportHistory.tsx).
import type { CorrectionRequest, LiquidationSubmission } from "./types";
import { correctionSummary } from "./correctionTarget";
import { correctionAnswer } from "./components/liquidation/resubmit/correctionModel";
import { formatCurrency, formatDate } from "./utils";

export type ReportEventKind = "filed" | "returned" | "corrected" | "verified" | "validated" | "fundReturned" | "paid";

export interface ReportEvent {
  kind: ReportEventKind;
  /** When: a timestamp or a voucher's date. "" for a Return from before they were dated. */
  at: string;
  title: string;
  /** Who did it. */
  by?: string;
  /** What it came to, in the system's words. */
  detail?: string;
  /** What that person wrote: the screen shows it as their words. */
  note?: string;
}

// The steps in the order a report moves through them, for those recorded at the same moment.
const STEP: ReportEventKind[] = ["filed", "returned", "corrected", "verified", "validated", "fundReturned", "paid"];

// Older records may hold anything in these fields, and a screen can't draw an object.
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const peso = (value: unknown) => formatCurrency(Number(value) || 0);

// A voucher's date has no time, and it is never before the validation it follows: it counts as the end of that day.
function moment(at: string): number {
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(at) ? `${at}T23:59:59+08:00` : at);
  return Number.isFinite(time) ? time : 0;
}

const reviewerOf = (correction: CorrectionRequest) => (correction.returnTo === "Verified & Forwarded" ? "Finance" : "HR");
const capitalised = (phrase: string) => phrase.charAt(0).toUpperCase() + phrase.slice(1);

/** The report's events, newest first. A report returned before checklists existed has no date for it, and since that
 * is where it stands now, it comes first. */
export function reportHistory(report: Partial<LiquidationSubmission> | null | undefined): ReportEvent[] {
  if (!report) return [];
  const events: ReportEvent[] = [];
  const filer = text(report.employeeName);

  const filedAt = text(report.createdAt) || text(report.dateSubmitted);
  if (filedAt) {
    const claim = text(report.claimBeforeCorrection?.claimType) || text(report.claimType);
    events.push({ kind: "filed", at: filedAt, title: claim ? `Filed as a ${claim}` : "Filed", by: filer });
  }

  const corrections = (Array.isArray(report.corrections) ? report.corrections : []).filter(c => c && Array.isArray(c.items));
  for (const correction of corrections) {
    const round = correction.round > 1 ? ` (round ${correction.round})` : "";
    const asked = correctionSummary(correction, report as Parameters<typeof correctionSummary>[1], Infinity, true);
    events.push({
      kind: "returned",
      at: text(correction.requestedAt),
      title: `Returned by ${reviewerOf(correction)} for correction${round}`,
      by: text(correction.requestedBy),
      detail: asked ? `To fix: ${asked}.` : undefined,
      note: text(correction.remarks)
    });
    if (text(correction.resolvedAt)) {
      events.push({
        kind: "corrected",
        at: text(correction.resolvedAt),
        title: `Corrected and sent back to ${reviewerOf(correction)}`,
        by: filer,
        detail: `${capitalised(correctionAnswer(correction))}.`
      });
    }
  }

  // Returned before checklists existed: only who returned it and their remarks were kept.
  if (report.status === "Returned" && !corrections.some(c => !text(c.resolvedAt))) {
    const byFinance = report.financeStatus === "Returned by Finance";
    events.push({
      kind: "returned",
      at: "",
      title: `Returned by ${byFinance ? "Finance" : "HR"} for correction`,
      note: text(byFinance ? report.financeRemarks : report.hrRemarks)
    });
  }

  if (text(report.hrVerifiedAt)) {
    events.push({
      kind: "verified",
      at: text(report.hrVerifiedAt),
      title: "Verified by HR and forwarded to Finance",
      by: text(report.hrVerifiedBy),
      note: text(report.hrRemarks)
    });
  }

  if (text(report.financeValidatedAt)) {
    events.push({
      kind: "validated",
      at: text(report.financeValidatedAt),
      title: "Validated by Finance",
      by: text(report.financeValidatedBy),
      detail: text(report.divisionChiefRemarks),
      note: text(report.financeRemarks)
    });
  } else if (text(report.divisionChiefApprovedAt)) {
    events.push({
      kind: "validated",
      at: text(report.divisionChiefApprovedAt),
      title: "Approved",
      by: text(report.divisionChiefApprovedBy),
      note: text(report.divisionChiefRemarks)
    });
  }

  const fund = report.fundReturn;
  if (fund && text(fund.recordedAt)) {
    events.push({
      kind: "fundReturned",
      at: text(fund.recordedAt),
      title: `${peso(fund.amount)} went back to the training budget`,
      by: text(fund.recordedBy),
      detail: `OR ${text(fund.orNo)}${text(fund.orDate) ? `, ${formatDate(text(fund.orDate))}` : ""}.`
    });
  }

  if (report.reimbursementStatus === "Reimbursed" && text(report.reimbursementDate)) {
    const dv = text(report.reimbursementDvNo);
    events.push({
      kind: "paid",
      at: text(report.reimbursementDate),
      title: `${peso(report.reimbursementAmount)} paid back to ${filer || "the employee"}`,
      by: text(report.reimbursedBy),
      detail: dv ? `DV No. ${dv}.` : undefined
    });
  }

  return events
    .map((event, at) => ({ event, at, time: event.at ? moment(event.at) : Infinity }))
    .sort((a, b) => {
      if (a.time !== b.time) return a.time < b.time ? 1 : -1;
      return STEP.indexOf(b.event.kind) - STEP.indexOf(a.event.kind) || b.at - a.at;
    })
    .map(item => item.event);
}
