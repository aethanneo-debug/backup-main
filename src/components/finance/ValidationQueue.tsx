import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import type { ActiveSignatory } from "../../types";
import SectionCard, { SectionCount } from "../ui/SectionCard";
import { DataTable, TablePager, TableSearch, ViewButton } from "../ui/DataTable";
import { useTableView } from "../ui/useTableView";
import { ClaimTypeFilter, ClaimTypeFilterEmpty, ClaimTypeFilterValue, matchesClaimType } from "../liquidation/ClaimType";
import { OverspendBadge, overspendOf } from "../liquidation/overspend";
import { answeredCorrectionSummary } from "../liquidation/resubmit/correctionModel";
import {
  NEWEST_FILED,
  REPORT_SORTS,
  changedOnCorrection,
  isOwnReport,
  reportColumns,
  reportRowId,
  reportSearchText,
  reportText,
  type Report
} from "../liquidation/reportColumns";
import { reportStatusBadgeClass } from "./overviewFigures";

interface Props {
  /** Every report Finance can see. */
  submissions: Report[];
  /** The signed-in officer's staff code: their own report is flagged. */
  currentEmployeeId?: string;
  /** undefined while loading, null when none is appointed. */
  accountant: ActiveSignatory | null | undefined;
  /** Why the Accountant couldn't be checked. */
  signatoryError: string;
  onReloadAccountant: () => void;
  onView: (id: string) => void;
  /** A report a notice opened: its row is brought to the screen. */
  reveal: { id: string; key: number } | null;
}

const FLAG = "inline-block rounded border px-1.5 py-px text-[9px] font-bold";

/** The status, and what Finance should see before opening the report. */
function StageCell({ report, currentEmployeeId }: { report: Report; currentEmployeeId?: string }) {
  const over = overspendOf(report);
  return (
    <span className="flex flex-col items-start gap-1">
      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${reportStatusBadgeClass(report.status)}`}>{reportText(report.status)}</span>
      {over && <OverspendBadge over={over} />}
      {isOwnReport(report, currentEmployeeId) && <span className={`${FLAG} border-amber-200 bg-amber-50 text-amber-700`}>Your report</span>}
      {answeredCorrectionSummary(report) && <span className={`${FLAG} border-blue-200 bg-blue-50 text-blue-700`}>Corrected</span>}
      {changedOnCorrection(report) && <span className={`${FLAG} border-amber-200 bg-amber-50 text-amber-700`}>Changed on correction</span>}
    </span>
  );
}

/**
 * Finance's turn on a report: what HR verified, newest first. Everything needed to validate or return one is in its
 * View, so a long queue stays a table (the instructor's review, R8).
 */
export default function ValidationQueue({ submissions, currentEmployeeId, accountant, signatoryError, onReloadAccountant, onView, reveal }: Props) {
  const queue = useMemo(() => (submissions ?? []).filter(s => s.status === "Verified & Forwarded"), [submissions]);
  // Narrowed to Liquidations or Reimbursements (instructor's note 10).
  const [filter, setFilter] = useState<ClaimTypeFilterValue>("All");
  const table = useTableView<Report>({
    rows: queue,
    rowId: reportRowId,
    searchText: reportSearchText,
    filter: report => matchesClaimType(report, filter),
    filterKey: filter,
    sorts: REPORT_SORTS,
    defaultSort: NEWEST_FILED,
    clearFilter: () => setFilter("All")
  });
  useEffect(() => {
    if (reveal) table.reveal(reveal.id);
  }, [reveal?.key]);
  const noAccountant = accountant === null;
  const columns = useMemo(() => reportColumns(report => <StageCell report={report} currentEmployeeId={currentEmployeeId} />), [currentEmployeeId]);

  return (
    <SectionCard
      icon={<ClipboardCheck size={12} className="text-blue-600" aria-hidden="true" />}
      title="Finance Liquidation Validation Queue"
      action={<SectionCount>{queue.length}</SectionCount>}
      caption="Validation"
      bodyClassName=""
    >
      <div className="space-y-3 p-4 pb-2">
        <p className="max-w-3xl text-[11px] text-slate-500">
          Validate receipts, invoices, and ledger documents approved by HR. Execute final
          validation to generate the Financial Transaction and update the budget.
        </p>

        {signatoryError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <span>Couldn&rsquo;t check who signs Box C. {signatoryError}</span>
            <button
              type="button"
              onClick={onReloadAccountant}
              className="cursor-pointer rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              Retry
            </button>
          </div>
        ) : noAccountant ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <p>
              <strong>No active Accountant, so validation is paused.</strong> Box C of every report must carry the
              Accountant on duty. Ask the Administrator to appoint one in Utilities &rarr; Manage Signatories.
            </p>
            {/* Once one is appointed, this re-checks without reloading the page. */}
            <button
              type="button"
              onClick={onReloadAccountant}
              className="cursor-pointer rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Check again
            </button>
          </div>
        ) : accountant ? (
          <p className="text-[11px] text-slate-600">
            Box C will print: <strong>{accountant.fullName}</strong>, {accountant.position}.
          </p>
        ) : null}
      </div>

      {queue.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <TableSearch table={table} id="validation-search" label="Search the validation queue" placeholder="Report, employee, seminar, status or DV" />
          <ClaimTypeFilter value={filter} onChange={setFilter} items={queue} label="Filter the validation queue by claim type" />
        </div>
      )}

      <DataTable
        table={table}
        columns={columns}
        caption="Liquidation reports verified by HR and waiting for Finance's validation, newest first"
        rowId={reportRowId}
        actions={report => <ViewButton label={reportText(report.submissionNo)} onClick={() => onView(report.id)} />}
        minWidth={1000}
        searchId="validation-search"
        empty={
          <div className="m-4 mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <ClipboardCheck size={28} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-600">Nothing awaiting validation</p>
            <p className="mt-1 text-[11px] text-slate-500">
              No liquidation reports verified by HR awaiting Financial validation.
            </p>
          </div>
        }
        filteredEmpty={<div className="m-4 mt-2"><ClaimTypeFilterEmpty filter={filter} onShowAll={() => setFilter("All")} /></div>}
      />
      <TablePager table={table} label="Pages of the validation queue" />
    </SectionCard>
  );
}
