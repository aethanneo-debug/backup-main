// Finance's dashboard by date range (the instructor's suggestion of 2026-11-11, known-issues 12ag Part C): every status of
// the liquidation reports, cash advances and reimbursement claims filed or requested between two days (the user's
// choice: by the date each record was filed or requested), from the two lists Finance already loads
// (GET /api/liquidation-submissions and GET /api/cash-advances). Pure, beside overviewFigures.ts; tested
// (tests/statusFigures.test.ts). Money is added up in whole centavos (src/liquidationMoney.ts).
//
// What is counted where:
//   - a liquidation report, or a reimbursement claim (a seminar paid out of the employee's pocket, `withinAllowance`, or
//     an older report filed as a reimbursement, `claimType`), by the Manila day it was filed. The claims are what the
//     Reimbursement Queue pays, so an older liquidation that spent more than its advance is one too, for the difference
//     (it stays under liquidations for its spending);
//   - a cash advance by the day it was requested (an older one released directly, by the day it was issued). A group's
//     advance is one record, its holder's, so it counts once; a report is one record, so it counts once.
//   - an advance released and still with no report filed is "not yet liquidated", beside the reports not yet validated.
// A record with no date that can be read counts only when the range has no bounds (All time).
import { isCalendarDate } from "../../inputText";
import { sumPesos } from "../../liquidationMoney";
import { requestExpired } from "../../reimbursement";
import { REPORT_STAGES } from "./overviewFigures";

/** The days a range covers, YYYY-MM-DD, both included; "" means no bound on that side. */
export interface DateRange {
  from: string;
  to: string;
}

export type RangePreset = "thisMonth" | "lastMonth" | "thisQuarter" | "fiscalYear" | "all";

export const PRESET_LABEL: Record<RangePreset, string> = {
  thisMonth: "This month",
  lastMonth: "Last month",
  thisQuarter: "This quarter",
  fiscalYear: "This fiscal year",
  all: "All time"
};

/** How many records, and how much money they hold, in pesos. */
export interface Tally {
  count: number;
  amount: number;
}

/** The fields of a report the breakdown reads (GET /api/liquidation-submissions; files are never sent). */
export interface StatusReport {
  id: string;
  status?: string;
  totalSpent?: number | string;
  createdAt?: string;
  dateSubmitted?: string;
  activityId?: string;
  cashAdvanceId?: string;
  withinAllowance?: boolean;
  claimType?: string;
  reimbursementStatus?: string;
  reimbursementAmount?: number | string;
}

/** The fields of a cash advance the breakdown reads (GET /api/cash-advances, as Finance and the Administrator get it). */
export interface StatusAdvance {
  id: string;
  status?: string;
  amount?: number | string;
  activityId?: string;
  requestedAt?: string;
  issuedAt?: string;
  /** When a request expired, Finance not having released or declined it by the seminar's first day (2026-11-14). */
  expiredAt?: string;
}

export interface StatusFigures {
  range: DateRange;
  liquidations: {
    /** Validated by Finance (Completed). */
    liquidated: Tally;
    withHr: Tally;
    withFinance: Tally;
    returned: Tally;
    /** Released advances requested in the range with no report filed yet. */
    noReport: Tally;
    /** Statuses nothing writes any more. */
    other: Tally;
    /** Every liquidation report filed in the range. */
    filed: Tally;
  };
  advances: {
    requested: Tally;
    released: Tally;
    /** Turned down by Finance (or closed by HR's attendance, 12ai, before 2026-11-14). */
    declined: Tally;
    /** Not released or declined by the seminar's first day (requestExpired): Finance's own record of it. */
    expired: Tally;
    liquidated: Tally;
    refunded: Tally;
    cancelled: Tally;
    other: Tally;
    total: Tally;
  };
  reimbursements: {
    withHr: Tally;
    withFinance: Tally;
    returned: Tally;
    /** Validated, the payment still to be recorded: what the Reimbursement Queue offers to pay. */
    awaitingPayment: Tally;
    paid: Tally;
    other: Tally;
    total: Tally;
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The Manila day of a stored date: a plain YYYY-MM-DD as it is; a timestamp in Manila (UTC+8); "" when unreadable.
 * Never throws: a timestamp at the edge of what JavaScript dates hold overflows when 8 hours are added, and reads as
 * none rather than throwing in toISOString (the security review of 12ag Part C). */
export function manilaDayOf(when: unknown): string {
  if (typeof when !== "string" || !when) return "";
  if (DAY.test(when)) return when;
  const d = new Date(Date.parse(when) + 8 * 3_600_000);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** A stored status as text; one of another kind (a damaged record) is none: String() of an object can throw. */
const statusOf = (v: unknown) => (typeof v === "string" ? v : "");

/** The first of the dates that can be read, as a Manila day. */
const firstDay = (...values: unknown[]) => values.map(manilaDayOf).find(Boolean) ?? "";

/**
 * A preset's days around `today` (Manila's, YYYY-MM-DD). The fiscal year's are its stored first and last days, else the
 * calendar year its label names; with neither, no bounds.
 */
export function presetRange(preset: RangePreset, today: string, fiscalYear?: { label?: string; start?: string; end?: string } | null): DateRange {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  if (!DAY.test(today) || preset === "all") return { from: "", to: "" };
  if (preset === "thisMonth") return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDayOf(y, m))}` };
  if (preset === "lastMonth") {
    const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
    return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDayOf(py, pm))}` };
  }
  if (preset === "thisQuarter") {
    const first = Math.floor((m - 1) / 3) * 3 + 1, last = first + 2;
    return { from: `${y}-${pad(first)}-01`, to: `${y}-${pad(last)}-${pad(lastDayOf(y, last))}` };
  }
  const start = manilaDayOf(fiscalYear?.start), end = manilaDayOf(fiscalYear?.end);
  if (isCalendarDate(start) && isCalendarDate(end) && start <= end) return { from: start, to: end };
  const label = String(fiscalYear?.label ?? "");
  return /^\d{4}$/.test(label) ? { from: `${label}-01-01`, to: `${label}-12-31` } : { from: "", to: "" };
}

/** A range typed in: real days in order. The reason it can't be used, or null when it can. */
export function rangeProblem(range: DateRange): string | null {
  const real = (d: string) => !d || isCalendarDate(d);
  if (!real(range.from) || !real(range.to)) return "Enter the dates as real days.";
  if (range.from && range.to && range.from > range.to) return "The first day comes after the last.";
  return null;
}

/** Whether a day falls in the range. One that couldn't be read is in only when the range has no bounds. */
export function inRange(day: string, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!day) return false;
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}

/** An amount as the money helpers read it: a number or numeric text; anything else counts as nothing. */
const money = (v: unknown) => (typeof v === "number" || typeof v === "string" ? v : 0);
const tally = (amounts: unknown[]): Tally => ({ count: amounts.length, amount: sumPesos(amounts.map(money)) });
const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** A reimbursement claim rather than a liquidation of cash advanced. */
export const isClaimReport = (r: Pick<StatusReport, "withinAllowance" | "claimType">) => r.withinAllowance === true || r.claimType === "Reimbursement";

/** The office owes the employee something on this report (read through `money`, so a stored value of another kind
 * can't throw). */
const owes = (r: StatusReport) => Number(money(r.reimbursementAmount)) > 0;

/**
 * What the Reimbursement Queue pays (the code review of Part C): a claim, or an older liquidation that spent more than its
 * advance (filed before 2026-10-20, when lines couldn't yet pass it), whose difference is owed or was paid. Such a
 * liquidation is counted under Liquidations too, for its spending; here only for the difference.
 */
const isQueueClaim = (r: StatusReport) =>
  isClaimReport(r) || ((r.reimbursementStatus === "Awaiting Reimbursement" || r.reimbursementStatus === "Reimbursed") && owes(r));

/** What a claim asks for: the amount owed when it is recorded, else what was spent. */
const claimAmount = (r: StatusReport) => (owes(r) ? money(r.reimbursementAmount) : r.totalSpent);

export function statusFigures(
  reports: readonly StatusReport[] | null | undefined,
  advances: readonly StatusAdvance[] | null | undefined,
  range: DateRange
): StatusFigures {
  const allReports = (reports ?? []).filter((r): r is StatusReport => isRecord(r) && typeof r.id === "string");
  const allAdvances = (advances ?? []).filter((a): a is StatusAdvance => isRecord(a) && typeof a.id === "string");
  const filedIn = allReports.filter(r => inRange(firstDay(r.createdAt, r.dateSubmitted), range));
  const requestedIn = allAdvances.filter(a => inRange(firstDay(a.requestedAt, a.issuedAt), range));

  const liquidations = filedIn.filter(r => !isClaimReport(r));
  const claims = filedIn.filter(isQueueClaim);
  const spent = (list: StatusReport[]) => tally(list.map(r => r.totalSpent));
  const byStatus = (list: StatusReport[], ...statuses: string[]) => list.filter(r => statuses.includes(statusOf(r.status)));
  // "Approved" (the Division Chief's, under the old rules) is an older status here, as on the overview's own Reports
  // panel (the code review of Part C): nothing writes it any more, and the route that pays claims refuses it.
  const known: string[] = [REPORT_STAGES.validated, REPORT_STAGES.withHr, REPORT_STAGES.withFinance, REPORT_STAGES.returned];

  // A released advance's report: the one that names it, or (older reports, before reports named their advance) the
  // one filed for the same assignment. Any report, whenever filed: the money is then on a report, not "no report".
  // Looked up once each, not a scan of every report per advance (the security review of Part C).
  const byAdvance = new Set(allReports.map(r => r.cashAdvanceId).filter((id): id is string => typeof id === "string" && !!id));
  const bySeat = new Set(allReports.filter(r => !r.cashAdvanceId && typeof r.activityId === "string" && r.activityId).map(r => r.activityId as string));
  const reported = (a: StatusAdvance) => byAdvance.has(a.id) || (typeof a.activityId === "string" && bySeat.has(a.activityId));
  const noReport = requestedIn.filter(a => a.status === "Released" && !reported(a));

  const advanceStatus = (...statuses: string[]) => tally(requestedIn.filter(a => statuses.includes(statusOf(a.status))).map(a => a.amount));
  // An expired request is stored "Declined" with `expiredAt`, and counted apart from Finance's own declines.
  const expiredIn = new Set(requestedIn.filter(a => statusOf(a.status) === "Declined" && requestExpired({ status: "Declined", expiredAt: a.expiredAt })));
  const knownAdvance = ["Requested", "Released", "Declined", "Liquidated", "Refunded", "Cancelled"];

  const claimTally = (list: StatusReport[]) => tally(list.map(claimAmount));
  const paid = claims.filter(r => r.reimbursementStatus === "Reimbursed");
  // Finance's own rule for what can be paid (isPayableClaim, src/reimbursement.ts), on values read safely: validated,
  // awaiting reimbursement, something owed. A validated claim with nothing owed is an older status, never "pending".
  const payable = claims.filter(r => statusOf(r.status) === REPORT_STAGES.validated && r.reimbursementStatus === "Awaiting Reimbursement" && owes(r));
  const inReview = (status: string) => byStatus(claims, status).filter(r => r.reimbursementStatus !== "Reimbursed");
  const placed = new Set([...paid, ...payable, ...inReview(REPORT_STAGES.withHr), ...inReview(REPORT_STAGES.withFinance), ...inReview(REPORT_STAGES.returned)]);

  return {
    range,
    liquidations: {
      liquidated: spent(byStatus(liquidations, REPORT_STAGES.validated)),
      withHr: spent(byStatus(liquidations, REPORT_STAGES.withHr)),
      withFinance: spent(byStatus(liquidations, REPORT_STAGES.withFinance)),
      returned: spent(byStatus(liquidations, REPORT_STAGES.returned)),
      noReport: tally(noReport.map(a => a.amount)),
      other: spent(liquidations.filter(r => !known.includes(statusOf(r.status)))),
      filed: spent(liquidations)
    },
    advances: {
      requested: advanceStatus("Requested"),
      released: advanceStatus("Released"),
      declined: tally(requestedIn.filter(a => statusOf(a.status) === "Declined" && !expiredIn.has(a)).map(a => a.amount)),
      expired: tally([...expiredIn].map(a => a.amount)),
      liquidated: advanceStatus("Liquidated"),
      refunded: advanceStatus("Refunded"),
      cancelled: advanceStatus("Cancelled"),
      other: tally(requestedIn.filter(a => !knownAdvance.includes(statusOf(a.status))).map(a => a.amount)),
      total: tally(requestedIn.map(a => a.amount))
    },
    reimbursements: {
      withHr: claimTally(inReview(REPORT_STAGES.withHr)),
      withFinance: claimTally(inReview(REPORT_STAGES.withFinance)),
      returned: claimTally(inReview(REPORT_STAGES.returned)),
      awaitingPayment: claimTally(payable),
      paid: claimTally(paid),
      other: claimTally(claims.filter(r => !placed.has(r))),
      total: claimTally(claims)
    }
  };
}
