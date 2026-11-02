import type { ReactNode } from "react";
import { firstDateString, firstTimestamp, formatCurrency, formatDate } from "../../utils";
import type { LiquidationSubmissionView } from "../../types";
import { liquidationBalance } from "../../liquidationMoney";
import type { SortState, SortValue } from "../../tableView";
import type { TableColumn } from "../ui/DataTable";
import { ClaimTypeBadge } from "./ClaimType";

// A liquidation report in a table (the instructor's review, R8): what the Liquidation Desk's lists and the portal's
// settlement log have in common. Older records may hold anything in these fields, so nothing is drawn unread, and
// there is no error boundary to catch it if it were.

export type Report = LiquidationSubmissionView;

/** A stored field as text, or "" when it isn't any. */
export const reportText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** A stored amount. Older reports may hold text such as "₱12,000": the digits are read as the server's migration does,
 * and a minus sign before them is kept ("-₱500" or "₱-500" is a balance to reimburse). */
export const peso = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "");
  const amount = Number(text.replace(/[^0-9.]/g, "")) || 0;
  return /^[^0-9]*-/.test(text) ? -amount : amount;
};

export const reportRowId = (report: Report) => report.id;

/** The people a group's report covers (one report on one cash advance). */
export const coversOf = (report: Partial<Report> | null | undefined) => (Array.isArray(report?.covers) ? report.covers : []).filter(Boolean);

export const seminarOf = (report: Report) => reportText(report.activityTitle) || reportText(report.activityId);

/** A group's report that covers this officer, who didn't file it (reports carry the claimant's staff code). */
export const coversOfficer = (report: Partial<Report> | null | undefined, employeeId?: string) =>
  !!employeeId && report?.employeeId !== employeeId && coversOf(report).some(c => c.employeeId === employeeId);

export const isOwnReport = (report: Partial<Report> | null | undefined, employeeId?: string) =>
  !!employeeId && (report?.employeeId === employeeId || coversOfficer(report, employeeId));

/** A correction changed the claim type or the cash advance, and the figures still differ from what was filed. */
export function changedOnCorrection(report: Partial<Report> | null | undefined): boolean {
  const before = report?.claimBeforeCorrection;
  return !!before && (before.claimType !== report?.claimType
    || Number(before.totalReleased) !== Number(report?.totalReleased)
    || (before.cashAdvanceDvNo || "") !== (report?.cashAdvanceDvNo || ""));
}

/** The text a report is found by. */
export const reportSearchText = (report: Report) => [
  report.submissionNo,
  report.serialNo,
  report.employeeName,
  seminarOf(report),
  ...coversOf(report).map(c => c.employeeName),
  report.claimType,
  report.status,
  report.cashAdvanceDvNo,
  report.reimbursementDvNo
].map(reportText).join(" ");

const filedAt = (report: Report) => firstTimestamp(report.createdAt, report.dateSubmitted) || null;

export const REPORT_SORTS: Record<string, (report: Report) => SortValue> = {
  no: report => reportText(report.submissionNo),
  employee: report => reportText(report.employeeName),
  seminar: seminarOf,
  claim: report => reportText(report.claimType),
  advance: report => peso(report.totalReleased),
  spent: report => peso(report.totalSpent),
  balance: report => peso(report.remainingBalance),
  filed: filedAt,
  stage: report => reportText(report.status)
};

/** The order a report list opens in: newest first, the instructor's rule. */
export const NEWEST_FILED: SortState = { key: "filed", dir: "desc" };

const MONEY = "whitespace-nowrap font-mono tabular-nums";

/** The report number, and the serial printed on the form under it. */
export function ReportNoCell({ report }: { report: Report }) {
  const serial = reportText(report.serialNo);
  return (
    <span className="block font-mono">
      <span className="block whitespace-nowrap text-[11px] font-bold text-slate-800">{reportText(report.submissionNo)}</span>
      {serial && <span className="block whitespace-nowrap text-[9px] text-slate-500">{serial}</span>}
    </span>
  );
}

export function EmployeeCell({ report }: { report: Report }) {
  const covers = coversOf(report);
  return (
    <span className="block">
      <span className="block font-semibold text-slate-800">{reportText(report.employeeName)}</span>
      {covers.length > 1 && <span className="block text-[10px] text-slate-500">Group of {covers.length}</span>}
    </span>
  );
}

export function SeminarCell({ report }: { report: Report }) {
  const title = seminarOf(report);
  return <span title={title} className="line-clamp-2 text-slate-600">{title}</span>;
}

export function AdvanceCell({ report }: { report: Report }) {
  const dv = reportText(report.cashAdvanceDvNo);
  return (
    <span className="block">
      <span className={`block text-slate-700 ${MONEY}`}>{formatCurrency(peso(report.totalReleased))}</span>
      {dv && <span className={`block text-[9px] text-slate-500 ${MONEY}`}>DV {dv}</span>}
    </span>
  );
}

export const SpentCell = ({ report }: { report: Report }) => (
  <span className={`font-semibold text-slate-800 ${MONEY}`}>{formatCurrency(peso(report.totalSpent))}</span>
);

// In a word, under the figure: the View has it in full.
function balanceWord(report: Report, amount: number): string {
  if (report.withinAdvance) {
    if (report.fundReturn) return "Returned to fund";
    const { status } = liquidationBalance(peso(report.totalReleased), peso(report.totalSpent));
    return status === "Balanced" ? "Balanced" : status === "Over" ? "Over the advance" : "To hand back";
  }
  return amount > 0 ? "Refund" : amount < 0 ? "To reimburse" : "";
}

export function BalanceCell({ report }: { report: Report }) {
  const amount = peso(report.remainingBalance);
  const word = balanceWord(report, amount);
  return (
    <span className="block">
      <span className={`block font-bold ${amount ? "text-amber-700" : "text-slate-600"} ${MONEY}`}>{formatCurrency(amount)}</span>
      {word && <span className="block text-[10px] text-slate-500">{word}</span>}
    </span>
  );
}

export function FiledCell({ report }: { report: Report }) {
  const filed = firstDateString(report.createdAt, report.dateSubmitted);
  return <span className="whitespace-nowrap font-mono text-[11px] text-slate-600">{filed ? formatDate(filed) : "—"}</span>;
}

/** The columns of the Validation Queue and the Liquidations Index (R8), in the instructor's order. */
export function reportColumns(stage: (report: Report) => ReactNode): TableColumn<Report>[] {
  return [
    { key: "no", header: "Report No.", sortable: true, cell: report => <ReportNoCell report={report} /> },
    { key: "employee", header: "Employee", sortable: true, className: "min-w-[110px]", cell: report => <EmployeeCell report={report} /> },
    { key: "seminar", header: "Seminar", sortable: true, className: "min-w-[130px]", cell: report => <SeminarCell report={report} /> },
    { key: "claim", header: "Claim Type", sortable: true, cell: report => <ClaimTypeBadge claimType={report.claimType} /> },
    { key: "advance", header: "Advance", sortable: true, align: "right", cell: report => <AdvanceCell report={report} /> },
    { key: "spent", header: "Spent", sortable: true, align: "right", cell: report => <SpentCell report={report} /> },
    { key: "balance", header: "Refund / Balance", sortable: true, align: "right", cell: report => <BalanceCell report={report} /> },
    { key: "filed", header: "Date Filed", sortable: true, cell: report => <FiledCell report={report} /> },
    { key: "stage", header: "Stage", sortable: true, cell: stage }
  ];
}
