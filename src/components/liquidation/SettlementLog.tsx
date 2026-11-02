import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Printer } from "lucide-react";
import type { LiquidationDocument, LiquidationSubmission } from "../../types";
import { firstDateString, formatCurrency, formatDate } from "../../utils";
import { DataTable, TablePager, TableSearch, ViewButton, focusViewButton, type TableColumn } from "../ui/DataTable";
import { useRecordHighlight } from "../ui/useRecordHighlight";
import { useTableView } from "../ui/useTableView";
import { BalanceStatusBadge } from "./BalanceCheck";
import { ClaimTypeBadge, ClaimTypeFilter, ClaimTypeFilterEmpty, ClaimTypeFilterValue, matchesClaimType } from "./ClaimType";
import ReportViewDialog, { VIEW_AMBER, VIEW_SECONDARY } from "./ReportViewDialog";
import { canResubmit } from "./resubmit/correctionModel";
import { NEWEST_FILED, REPORT_SORTS, SeminarCell, peso, reportRowId, reportSearchText, reportText, type Report } from "./reportColumns";

interface Props {
  /** The employee's own reports. */
  reports: Report[] | null | undefined;
  loading: boolean;
  /** From a notice, once a fresh load has landed: the report to show. */
  open?: { id: string; key: number } | null;
  /** Called when it has been taken. `found` says whether the report was there. */
  onOpenHandled?: (found: boolean) => void;
  /** The official form in print preview, over the View. */
  onPrint: (report: LiquidationSubmission) => void;
  /** Puts a returned report on the form above. */
  onResubmit: (report: Report) => void;
}

/** The number on the employee's own form. */
const reportNo = (report: Report) => reportText(report.serialNo) || reportText(report.submissionNo);

// The column shows the form's number, so that is what it sorts by.
const LOG_SORTS = { ...REPORT_SORTS, no: reportNo };

/** The status in the log's own tones. */
function statusClass(status: unknown): string {
  if (status === "Approved" || status === "Completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Rejected") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "Returned") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

// A seminar report kept within its advance shows its balance; others their refund or reimbursement.
function BalanceCell({ report }: { report: Report }) {
  const amount = peso(report.remainingBalance);
  if (report.withinAdvance) return <BalanceStatusBadge report={report} />;
  if (amount === 0) return <span className="text-slate-400">None</span>;
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${
      amount > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
    }`}>
      {amount > 0 ? "Refunded" : "To Reimburse"}: {formatCurrency(Math.abs(amount))}
    </span>
  );
}

// The portal's column is narrow: a long number breaks at its middle hyphen, and nowhere else.
function NumberText({ value }: { value: string }) {
  const parts = value.split("-");
  const half = Math.floor(parts.length / 2);
  if (half < 1) return <>{value}</>;
  return <>{parts.slice(0, half).join("-")}-<wbr />{parts.slice(half).join("-")}</>;
}

const Money = ({ value, strong = false }: { value: unknown; strong?: boolean }) => (
  <span className={`whitespace-nowrap font-mono text-[11px] tabular-nums ${strong ? "font-semibold text-slate-800" : "text-slate-700"}`}>{formatCurrency(peso(value))}</span>
);

const COLUMNS: TableColumn<Report>[] = [
  { key: "no", header: "Report", sortable: true, cell: report => <span className="block font-mono text-[11px] font-bold text-slate-800"><NumberText value={reportNo(report)} /></span> },
  { key: "seminar", header: "Seminar", sortable: true, className: "min-w-[100px]", cell: report => <SeminarCell report={report} /> },
  { key: "claim", header: "Claim Type", sortable: true, cell: report => <ClaimTypeBadge claimType={report.claimType} small /> },
  { key: "advance", header: "Advance", sortable: true, align: "right", cell: report => <Money value={report.totalReleased} /> },
  { key: "spent", header: "Spent", sortable: true, align: "right", cell: report => <Money value={report.totalSpent} strong /> },
  { key: "balance", header: "Refund / Balance", sortable: true, className: "min-w-[84px]", cell: report => <BalanceCell report={report} /> },
  {
    key: "filed",
    header: "Filed",
    sortable: true,
    cell: report => {
      const filed = firstDateString(report.createdAt, report.dateSubmitted);
      return <span className="font-mono text-[11px] text-slate-600">{filed ? formatDate(filed) : "—"}</span>;
    }
  },
  {
    key: "stage",
    header: "Status",
    sortable: true,
    cell: report => <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${statusClass(report.status)}`}>{reportText(report.status)}</span>
  }
];

/**
 * The employee's own reports, newest first, as a table (the instructor's review, R8). Each opens the same View as
 * Finance's desk, with the form to print and, on a returned report, the way to fix it.
 */
export default function SettlementLog({ reports, loading, open, onOpenHandled, onPrint, onResubmit }: Props) {
  const rows = reports ?? [];
  const [filter, setFilter] = useState<ClaimTypeFilterValue>("All");
  const table = useTableView<Report>({
    rows: reports,
    rowId: reportRowId,
    searchText: reportSearchText,
    filter: report => matchesClaimType(report, filter),
    filterKey: filter,
    sorts: LOG_SORTS,
    defaultSort: NEWEST_FILED,
    clearFilter: () => setFilter("All")
  });

  // Read from the list by id, so a reload refreshes it.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewed = useMemo(() => rows.find(r => r.id === viewingId) ?? null, [rows, viewingId]);
  // Opened by a notice, the View has no row behind it to go back to: closing it lands on the report's row.
  const openedForNotice = useRef(false);
  const [closed, setClosed] = useState<{ id: string; key: number; landing: boolean } | null>(null);
  useRecordHighlight(closed?.landing ? closed.id : null, closed?.key, "[data-view-row]");
  // Closed from a row: the dialog gives the focus back to its View button, unless a reload redrew the row meanwhile.
  useEffect(() => {
    if (closed && !closed.landing && (!document.activeElement || document.activeElement === document.body)) focusViewButton(closed.id);
  }, [closed]);

  useEffect(() => {
    if (!open) return;
    const found = rows.some(r => r.id === open.id);
    if (found) {
      table.reveal(open.id);
      openedForNotice.current = true;
      setViewingId(open.id);
    }
    onOpenHandled?.(found);
  }, [open?.key]);

  function closeView() {
    if (viewingId) setClosed({ id: viewingId, key: Date.now(), landing: openedForNotice.current });
    openedForNotice.current = false;
    setViewingId(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700">My Settlement Log Entries</h2>
        {!loading && rows.length > 0 && <ClaimTypeFilter value={filter} onChange={setFilter} items={rows} />}
      </div>
      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1].map(i => (
            <div key={i} className="animate-pulse space-y-2.5 rounded-xl border border-slate-100 bg-white p-4">
              <div className="h-3 w-40 rounded bg-slate-100" />
              <div className="h-2.5 w-64 rounded bg-slate-100" />
              <div className="h-12 rounded bg-slate-50" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {rows.length > 0 && (
            <div className="px-3 py-2">
              <TableSearch table={table} id="settlement-search" label="Search my settlement log" placeholder="Report, seminar, status or DV" />
            </div>
          )}
          <DataTable
            table={table}
            columns={COLUMNS}
            caption="Your liquidation reports, newest first"
            rowId={reportRowId}
            actions={report => <ViewButton label={reportNo(report)} onClick={() => setViewingId(report.id)} />}
            minWidth={720}
            searchId="settlement-search"
            empty={
              <div className="flex flex-col items-center justify-center gap-2 bg-slate-50/50 py-10 text-center">
                <FileText size={22} className="text-slate-300" aria-hidden="true" />
                <p className="text-xs font-semibold text-slate-600">No settlement reports logged yet</p>
                <p className="max-w-sm text-[10px] text-slate-500">
                  File your first Liquidation Report using the form above. It will appear here once HR receives it.
                </p>
              </div>
            }
            filteredEmpty={<div className="m-3"><ClaimTypeFilterEmpty filter={filter} onShowAll={() => setFilter("All")} /></div>}
          />
          <TablePager table={table} label="Pages of my settlement log" />
        </div>
      )}

      {viewed && (
        <ReportViewDialog
          report={viewed}
          title={reportNo(viewed)}
          statusClass={statusClass(viewed.status)}
          onClose={closeView}
          // On a group's report, a colleague's certificate is theirs alone to open (R4).
          canOpenFile={(doc: LiquidationDocument) => !(doc?.kind === "certificate" && doc?.participantId !== viewed.activityId)}
          actions={
            <>
              <button type="button" onClick={() => onPrint(viewed)} className={VIEW_SECONDARY}>
                <Printer size={12} aria-hidden="true" />
                Print
              </button>
              {canResubmit(viewed) && (
                <button
                  type="button"
                  onClick={() => {
                    openedForNotice.current = false;
                    setViewingId(null);
                    onResubmit(viewed);
                  }}
                  className={VIEW_AMBER}
                >
                  Fix &amp; Resubmit
                </button>
              )}
            </>
          }
        />
      )}
    </div>
  );
}
