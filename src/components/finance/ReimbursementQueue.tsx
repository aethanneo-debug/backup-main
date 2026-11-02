import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, HandCoins, Wallet } from "lucide-react";
import { firstTimestamp, formatCurrency, formatDate } from "../../utils";
import { sumPesos } from "../../liquidationMoney";
import type { SortValue } from "../../tableView";
import SectionCard, { SectionCount } from "../ui/SectionCard";
import { DataTable, TableChips, TablePager, TableSearch, ViewButton, type TableColumn } from "../ui/DataTable";
import { useTableView } from "../ui/useTableView";
import { overspendOf, OverspendBadge } from "../liquidation/overspend";
import { ClaimTypeBadge, ClaimTypeFilter, ClaimTypeFilterEmpty, ClaimTypeFilterValue, matchesClaimType } from "../liquidation/ClaimType";
import {
  EmployeeCell,
  ReportNoCell,
  REPORT_SORTS,
  SeminarCell,
  peso,
  reportRowId,
  reportSearchText,
  reportText,
  type Report
} from "../liquidation/reportColumns";
import { isPayableClaim, mismatch } from "./claimChecks";

interface Props {
  /** Every liquidation submission Finance can see. Filtered here, not by the caller. */
  submissions: Report[];
  /** The signed-in officer's staff code: nobody records the payment of their own claim. */
  currentEmployeeId?: string;
  /** Opens the report's View, where a claim is paid. */
  onView: (id: string) => void;
  /** A report a notice opened: its row is brought to the screen. */
  reveal: { id: string; key: number } | null;
}

type Chip = "ready" | "paid";

const MONEY = "whitespace-nowrap font-mono tabular-nums";
const FLAG = "inline-block rounded border px-1.5 py-px text-[9px] font-bold";

const owedOf = (report: Report) => peso(report.reimbursementAmount);

/** What Finance must look at before paying a claim, in a word: the View has it in full. */
function ClaimFlags({ report, own }: { report: Report; own: boolean }) {
  const over = overspendOf(report);
  return (
    <span className="flex flex-col items-start gap-1">
      {report.withinAllowance ? (
        <span className={`${FLAG} border-purple-200 bg-purple-50 text-purple-700`}>Paid by the employee</span>
      ) : mismatch(report) && report.claimType === "Reimbursement" ? (
        <span className={`inline-flex items-center gap-1 ${FLAG} border-amber-200 bg-amber-50 text-amber-700`}>
          <AlertTriangle size={10} aria-hidden="true" /> No advance on record
        </span>
      ) : mismatch(report) ? (
        <span className={`inline-flex items-center gap-1 ${FLAG} border-rose-200 bg-rose-50 text-rose-700`}>
          <AlertTriangle size={10} aria-hidden="true" /> Confirm the advance
        </span>
      ) : null}
      {/* An out-of-pocket claim often IS an overspend; say so at payment time. */}
      {over && <OverspendBadge over={over} />}
      {own && <span className={`${FLAG} border-amber-200 bg-amber-50 text-amber-700`}>Your claim</span>}
    </span>
  );
}

const READY_SORTS: Record<string, (report: Report) => SortValue> = {
  no: REPORT_SORTS.no,
  employee: REPORT_SORTS.employee,
  seminar: REPORT_SORTS.seminar,
  claim: REPORT_SORTS.claim,
  share: report => (report.allocatedAtFiling === undefined ? null : Number(report.allocatedAtFiling)),
  spent: REPORT_SORTS.spent,
  owed: owedOf,
  validated: report => firstTimestamp(report.financeValidatedAt) || null
};

const PAID_SORTS: Record<string, (report: Report) => SortValue> = {
  no: REPORT_SORTS.no,
  employee: REPORT_SORTS.employee,
  claim: REPORT_SORTS.claim,
  amount: owedOf,
  dv: report => reportText(report.reimbursementDvNo),
  paid: report => firstTimestamp(report.reimbursementDate) || null
};

const numberCell: TableColumn<Report>["cell"] = report => <ReportNoCell report={report} />;
const employeeCell: TableColumn<Report>["cell"] = report => <EmployeeCell report={report} />;
const claimCell: TableColumn<Report>["cell"] = report => <ClaimTypeBadge claimType={report.claimType} />;

const PAID_COLUMNS: TableColumn<Report>[] = [
  { key: "no", header: "Report No.", sortable: true, cell: numberCell },
  { key: "employee", header: "Employee", sortable: true, cell: employeeCell },
  { key: "claim", header: "Claim Type", sortable: true, cell: claimCell },
  { key: "amount", header: "Amount", sortable: true, align: "right", cell: report => <span className={`text-slate-800 ${MONEY}`}>{formatCurrency(owedOf(report))}</span> },
  { key: "dv", header: "DV No.", sortable: true, cell: report => <span className="whitespace-nowrap font-mono text-[11px] text-slate-600">{reportText(report.reimbursementDvNo) || "—"}</span> },
  { key: "paid", header: "Date Paid", sortable: true, cell: report => <span className="whitespace-nowrap font-mono text-[11px] text-slate-600">{reportText(report.reimbursementDate) ? formatDate(reportText(report.reimbursementDate)) : "—"}</span> }
];

/**
 * Claims where the employee spent more than they received.
 *
 * An employee assigned to a seminar who never got the cash advance pays out of pocket,
 * and their Liquidation Report doubles as the claim to get it back. Finance validating
 * that report does NOT hand over any money — until the disbursement voucher is recorded
 * in the report's View, the claimant is still out of pocket, which is why these stay visible.
 */
export default function ReimbursementQueue({ submissions, currentEmployeeId, onView, reveal }: Props) {
  const [chip, setChip] = useState<Chip>("ready");
  // Liquidations that spent more than the advance and Reimbursements (paid out of pocket)
  // both end up here; the filter tells them apart (instructor's note 10).
  const [filter, setFilter] = useState<ClaimTypeFilterValue>("All");

  const claims = useMemo(
    () => (submissions ?? []).filter(s => s?.reimbursementStatus === "Awaiting Reimbursement" && Number(s?.reimbursementAmount || 0) > 0),
    [submissions]
  );
  // The server refuses to release money on a report that is not yet validated. Those claims are
  // counted below instead, so Finance can still see money is coming.
  const payable = useMemo(() => claims.filter(isPayableClaim), [claims]);
  const notYetValidated = useMemo(() => claims.filter(s => !isPayableClaim(s)), [claims]);
  const settled = useMemo(() => (submissions ?? []).filter(s => s?.reimbursementStatus === "Reimbursed"), [submissions]);

  const common = {
    rowId: reportRowId,
    searchText: reportSearchText,
    filter: (report: Report) => matchesClaimType(report, filter),
    filterKey: filter,
    clearFilter: () => setFilter("All")
  };
  const ready = useTableView<Report>({ ...common, rows: payable, sorts: READY_SORTS, defaultSort: { key: "validated", dir: "desc" } });
  const paid = useTableView<Report>({ ...common, rows: settled, sorts: PAID_SORTS, defaultSort: { key: "paid", dir: "desc" } });

  useEffect(() => {
    if (!reveal) return;
    if (payable.some(s => s.id === reveal.id)) {
      setChip("ready");
      ready.reveal(reveal.id);
    } else if (settled.some(s => s.id === reveal.id)) {
      setChip("paid");
      paid.reveal(reveal.id);
    }
  }, [reveal?.key]);

  const isOwnClaim = (report: Report) => !!currentEmployeeId && report.employeeId === currentEmployeeId;
  const readyColumns = useMemo<TableColumn<Report>[]>(() => [
    { key: "no", header: "Report No.", sortable: true, cell: numberCell },
    { key: "employee", header: "Employee", sortable: true, className: "min-w-[110px]", cell: employeeCell },
    { key: "seminar", header: "Seminar", sortable: true, className: "min-w-[130px]", cell: report => <SeminarCell report={report} /> },
    { key: "claim", header: "Claim Type", sortable: true, cell: claimCell },
    {
      key: "share",
      header: "Share / Allocated",
      sortable: true,
      align: "right",
      cell: report => (
        <span className={`text-slate-700 ${MONEY}`}>
          {report.allocatedAtFiling === undefined ? "Not on record" : formatCurrency(Number(report.allocatedAtFiling))}
        </span>
      )
    },
    { key: "spent", header: "Spent", sortable: true, align: "right", cell: report => <span className={`text-slate-700 ${MONEY}`}>{formatCurrency(peso(report.totalSpent))}</span> },
    { key: "owed", header: "Owed", sortable: true, align: "right", cell: report => <span className={`font-bold text-amber-700 ${MONEY}`}>{formatCurrency(owedOf(report))}</span> },
    { key: "flag", header: "Check", cell: report => <ClaimFlags report={report} own={isOwnClaim(report)} /> },
    { key: "validated", header: "Validated", sortable: true, cell: report => <span className="whitespace-nowrap font-mono text-[11px] text-slate-600">{report.financeValidatedAt ? formatDate(report.financeValidatedAt) : "—"}</span> }
  ], [currentEmployeeId]);

  const table = chip === "ready" ? ready : paid;
  const listed = chip === "ready" ? payable : settled;
  // What the total is of, when it isn't everything ready to pay.
  const owedScope = [filter !== "All" ? filter : "", ready.query.trim() ? "matching" : ""].filter(Boolean).join(", ");
  const owedTotal = sumPesos(ready.matching.map(s => s.reimbursementAmount));
  const view = (report: Report) => <ViewButton label={reportText(report.submissionNo)} onClick={() => onView(report.id)} />;
  const filterEmpty = <div className="m-4 mt-2"><ClaimTypeFilterEmpty filter={filter} onShowAll={() => setFilter("All")} what={chip === "ready" ? "claims ready to pay" : "claims paid"} /></div>;

  return (
    <SectionCard
      icon={<HandCoins size={12} className="text-blue-600" aria-hidden="true" />}
      title="Reimbursement Queue"
      action={<SectionCount>{payable.length}</SectionCount>}
      caption="Money Back"
      bodyClassName=""
    >
      <div className="space-y-3 p-4 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-[11px] text-slate-500">
            Money owed to employees: Reimbursements, paid out of their own pocket, and Liquidations
            that spent more than the cash advance. Validating the report does not release any
            money &mdash; record the disbursement voucher in the report&rsquo;s View to close the claim.
          </p>
          {chip === "ready" && ready.matching.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-right">
              <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700">
                Total Owed{owedScope ? ` (${owedScope})` : ""}
              </span>
              <strong className="font-mono text-sm text-amber-800">{formatCurrency(owedTotal)}</strong>
            </div>
          )}
        </div>

        {notYetValidated.length > 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            {notYetValidated.length} further claim{notYetValidated.length === 1 ? "" : "s"} worth{" "}
            <strong>{formatCurrency(sumPesos(notYetValidated.map(s => s.reimbursementAmount)))}</strong>{" "}
            {notYetValidated.length === 1 ? "is" : "are"} still moving through HR verification and validation.
            {notYetValidated.length === 1 ? " It becomes" : " They become"} payable once validated.
          </p>
        )}

        <TableChips<Chip>
          chips={[
            { id: "ready", label: "Ready to pay", count: payable.length },
            { id: "paid", label: "Paid", count: settled.length }
          ]}
          value={chip}
          onChange={setChip}
          label="Claims ready to pay or paid"
        />
      </div>

      {listed.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <TableSearch
            key={chip}
            table={table}
            id="reimbursement-search"
            label={chip === "ready" ? "Search the claims ready to pay" : "Search the claims paid"}
            placeholder="Report, employee, seminar, status or DV"
          />
          <ClaimTypeFilter
            value={filter}
            onChange={setFilter}
            items={listed}
            label={chip === "ready" ? "Filter the claims ready to pay by claim type" : "Filter the claims paid by claim type"}
          />
        </div>
      )}

      {chip === "ready" ? (
        <DataTable
          table={ready}
          columns={readyColumns}
          caption="Claims validated and ready to pay, latest validated first"
          rowId={reportRowId}
          actions={view}
          minWidth={1000}
          searchId="reimbursement-search"
          empty={
            <div className="m-4 mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <Wallet size={28} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
              <p className="text-xs font-semibold text-slate-600">No reimbursements ready to pay</p>
              <p className="mt-1 text-[11px] text-slate-500">
                A claim becomes payable here once a <strong>validated</strong> liquidation shows more spent than was advanced.
              </p>
            </div>
          }
          filteredEmpty={filterEmpty}
        />
      ) : (
        <DataTable
          table={paid}
          columns={PAID_COLUMNS}
          caption="Claims paid, latest payment first"
          rowId={reportRowId}
          actions={view}
          minWidth={760}
          searchId="reimbursement-search"
          empty={
            <div className="m-4 mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <Wallet size={28} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
              <p className="text-xs font-semibold text-slate-600">No reimbursements paid yet</p>
              <p className="mt-1 text-[11px] text-slate-500">A claim is listed here once its disbursement voucher is recorded.</p>
            </div>
          }
          filteredEmpty={filterEmpty}
        />
      )}
      <TablePager table={table} label={chip === "ready" ? "Pages of the claims ready to pay" : "Pages of the claims paid"} />
    </SectionCard>
  );
}
