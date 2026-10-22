// The figures on Finance's Overview Dashboard, worked out from the liquidation reports and cash
// advances Finance already loads. Kept apart from the screen so the rules are tested
// (tests/overviewFigures.test.ts) and shared: the Liquidations Index uses the same fiscal-year
// rule, so the two never disagree. Money is added up in whole centavos (src/liquidationMoney.ts).
import { sumPesos } from "../../liquidationMoney";
import { firstDateString, firstTimestamp } from "../../utils";

/** The fields of a liquidation report the overview reads. */
export interface OverviewReport {
  id: string;
  submissionNo?: string;
  employeeName?: string;
  status?: string;
  totalSpent?: number;
  fiscalYear?: string;
  createdAt?: string;
  dateSubmitted?: string;
  reimbursementStatus?: string;
  reimbursementAmount?: number;
  fundReturn?: { amount: number } | null;
  /** When Finance validated it (ISO timestamp); set on validated reports. */
  financeValidatedAt?: string;
}

/** The fields of a cash advance the overview reads. */
export interface OverviewAdvance {
  status?: string;
  amount?: number;
}

const MANILA_YEAR = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric" });

/** The calendar year of a stored date, in Manila: a timestamp from 00:00 to 07:59 on 1 January
 * is still the previous year in UTC. A plain YYYY-MM-DD date is already local. */
function manilaYear(when: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(when)) return when.slice(0, 4);
  const t = new Date(when);
  return Number.isNaN(t.getTime()) ? "" : MANILA_YEAR.format(t);
}

/**
 * The fiscal year a report counts in. The server adds a seminar report's `fiscalYear` (the year
 * HR planned the seminar under, which can start before its calendar year: FY 2027 opened in
 * October 2026). A general activity has none, and its report counts in the year it was filed.
 * "" when the report has no usable date either.
 */
export function reportFiscalYear(report: Pick<OverviewReport, "fiscalYear" | "createdAt" | "dateSubmitted"> | null | undefined): string {
  if (report?.fiscalYear) return String(report.fiscalYear);
  return manilaYear(firstDateString(report?.createdAt, report?.dateSubmitted));
}

/** The report statuses, in the order a report moves through them. */
export const REPORT_STAGES = {
  withHr: "Pending HR Review",
  withFinance: "Verified & Forwarded",
  validated: "Completed",
  returned: "Returned"
} as const;

/** A report's status badge, in the house pattern (-50 background, -700 text, -200 border). */
export function reportStatusBadgeClass(status?: string): string {
  if (status === REPORT_STAGES.validated) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === REPORT_STAGES.withFinance) return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === REPORT_STAGES.withHr) return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === REPORT_STAGES.returned) return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

const isPayableReimbursement = (r: OverviewReport) =>
  r.status === REPORT_STAGES.validated &&
  r.reimbursementStatus === "Awaiting Reimbursement" &&
  Number(r.reimbursementAmount || 0) > 0;

/** The `count` most recently filed reports, newest first. Reports filed at the same moment keep
 * the server's order, latest first. */
export function latestReports<T extends Pick<OverviewReport, "createdAt" | "dateSubmitted">>(reports: T[] | null | undefined, count: number): T[] {
  return (reports ?? [])
    .map((r, i) => ({ r, i, t: firstTimestamp(r.createdAt, r.dateSubmitted) }))
    .sort((a, b) => b.t - a.t || b.i - a.i)
    .slice(0, count)
    .map(x => x.r);
}

const MANILA_MONTH = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" });
const MONTH_NAME = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });
const MONTH_AND_YEAR = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });

export interface MonthTotal {
  /** "YYYY-MM", a Manila calendar month. */
  key: string;
  /** "Oct" for the axis; "October 2026" for the tooltip and the table. */
  label: string;
  fullLabel: string;
  amount: number;
  count: number;
  /** The month now under way, so its total is so far. */
  current: boolean;
}

/**
 * What validated reports spent in each of the last `months` months, the current one included,
 * by the Manila month Finance validated them (`financeValidatedAt`). Added up in centavos.
 */
export function liquidatedByMonth(reports: OverviewReport[] | null | undefined, months = 6, now: Date = new Date()): MonthTotal[] {
  const [year, month] = MANILA_MONTH.format(now).split("-").map(Number);
  const firsts = Array.from({ length: months }, (_, i) => new Date(Date.UTC(year, month - months + i, 1)));
  const keyOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const spentIn = new Map<string, number[]>(firsts.map(d => [keyOf(d), []]));
  for (const r of reports ?? []) {
    if (r.status !== REPORT_STAGES.validated || !r.financeValidatedAt) continue;
    const at = new Date(r.financeValidatedAt);
    if (Number.isNaN(at.getTime())) continue;
    spentIn.get(MANILA_MONTH.format(at))?.push(Number(r.totalSpent) || 0);
  }
  return firsts.map((d, i) => {
    const spent = spentIn.get(keyOf(d)) ?? [];
    return {
      key: keyOf(d),
      label: MONTH_NAME.format(d),
      fullLabel: MONTH_AND_YEAR.format(d),
      amount: sumPesos(spent),
      count: spent.length,
      current: i === months - 1
    };
  });
}

export interface OverviewFigures {
  // Open now, whatever the fiscal year (as the Liquidation Desk's own lists are).
  toValidate: number;
  advanceRequests: number;
  reimbursementsToPay: { count: number; amount: number };
  advancesOut: { count: number; amount: number };
  returned: number;
  // The fiscal year in view.
  year: {
    filed: number;
    validated: number;
    liquidated: number;
    leftoverReturned: number;
    reimbursed: number;
    stages: { withHr: number; withFinance: number; validated: number; returned: number; other: number };
    /** Up to five of the year's reports, newest first. */
    latest: OverviewReport[];
  };
}

export function overviewFigures(
  reports: OverviewReport[] | null | undefined,
  advances: OverviewAdvance[] | null | undefined,
  fiscalYear: string
): OverviewFigures {
  const all = reports ?? [];
  const cash = advances ?? [];
  const payable = all.filter(isPayableReimbursement);
  // Every released advance: the money actually out. The Cash Advance Desk can list fewer, since
  // it shows only advances it can match to a current assignment (/api/cash-advances/fundable).
  const out = cash.filter(a => a?.status === "Released");

  // Nothing belongs to a year until the year is known.
  const inYear = fiscalYear ? all.filter(r => reportFiscalYear(r) === fiscalYear) : [];
  const validated = inYear.filter(r => r.status === REPORT_STAGES.validated);
  const count = (status: string) => inYear.filter(r => r.status === status).length;
  const stages = {
    withHr: count(REPORT_STAGES.withHr),
    withFinance: count(REPORT_STAGES.withFinance),
    validated: validated.length,
    returned: count(REPORT_STAGES.returned),
    other: 0
  };
  stages.other = inYear.length - stages.withHr - stages.withFinance - stages.validated - stages.returned;

  const latest = latestReports(inYear, 5);

  return {
    toValidate: all.filter(r => r.status === REPORT_STAGES.withFinance).length,
    advanceRequests: cash.filter(a => a?.status === "Requested").length,
    reimbursementsToPay: { count: payable.length, amount: sumPesos(payable.map(r => r.reimbursementAmount)) },
    advancesOut: { count: out.length, amount: sumPesos(out.map(a => a.amount)) },
    returned: all.filter(r => r.status === REPORT_STAGES.returned).length,
    year: {
      filed: inYear.length,
      validated: validated.length,
      liquidated: sumPesos(validated.map(r => r.totalSpent)),
      leftoverReturned: sumPesos(inYear.map(r => r.fundReturn?.amount)),
      reimbursed: sumPesos(inYear.filter(r => r.reimbursementStatus === "Reimbursed").map(r => r.reimbursementAmount)),
      stages,
      latest
    }
  };
}
