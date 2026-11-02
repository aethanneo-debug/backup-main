import { useMemo } from "react";
import { Inbox, ScrollText } from "lucide-react";
import SectionCard, { SectionCount } from "../ui/SectionCard";
import { DataTable, TablePager, TableSearch, ViewButton } from "../ui/DataTable";
import type { TableView } from "../ui/useTableView";
import { ClaimTypeFilter, ClaimTypeFilterEmpty, type ClaimTypeFilterValue } from "../liquidation/ClaimType";
import { OverspendBadge, overspendOf } from "../liquidation/overspend";
import { reportColumns, reportRowId, reportText, type Report } from "../liquidation/reportColumns";
import { reportStatusBadgeClass } from "./overviewFigures";

interface Props {
  /** The year's reports, with the search and sort the desk's Report Excel exports. */
  table: TableView<Report>;
  fiscalYear: string;
  filter: ClaimTypeFilterValue;
  onFilter: (next: ClaimTypeFilterValue) => void;
  onView: (id: string) => void;
}

/** Every report of the fiscal year, newest first. Each opens the same View as the queue (R8). */
export default function LiquidationsIndex({ table, fiscalYear, filter, onFilter, onView }: Props) {
  // The stage, and an overspend, as the Index's rows always flagged it.
  const columns = useMemo(() => reportColumns(report => {
    const over = overspendOf(report);
    return (
      <span className="flex flex-col items-start gap-1">
        <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold ${reportStatusBadgeClass(report.status)}`}>
          {reportText(report.status)}
        </span>
        {over && <OverspendBadge over={over} />}
      </span>
    );
  }), []);
  const exported = table.matching.length !== table.all.length || table.query.trim() !== "";

  return (
    <SectionCard
      icon={<ScrollText size={12} className="text-blue-600" aria-hidden="true" />}
      title="Liquidations Index"
      action={<SectionCount>{table.all.length}</SectionCount>}
      caption={`Fiscal Year ${fiscalYear}`}
      bodyClassName=""
    >
      {table.all.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <TableSearch table={table} id="index-search" label="Search the liquidations index" placeholder="Report, employee, seminar, status or DV" />
          <div className="flex flex-wrap items-center gap-2">
            {/* Every matching row on all the pages, not only the page on screen. */}
            {exported && <span className="text-[10px] text-slate-600">Report Excel exports the {table.matching.length} matching.</span>}
            <ClaimTypeFilter value={filter} onChange={onFilter} items={table.all} label="Filter the liquidations index by claim type" />
          </div>
        </div>
      )}
      <DataTable
        table={table}
        columns={columns}
        caption={`Cash advance liquidations recorded for fiscal year ${fiscalYear}, newest first`}
        rowId={reportRowId}
        actions={report => <ViewButton label={reportText(report.submissionNo)} onClick={() => onView(report.id)} />}
        minWidth={1000}
        searchId="index-search"
        empty={
          <div className="px-4 py-12 text-center">
            <Inbox size={28} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-600">No liquidations for FY {fiscalYear}</p>
            <p className="mt-1 text-[11px] text-slate-500">No liquidation advances currently monitored.</p>
          </div>
        }
        filteredEmpty={<div className="m-4 mt-2"><ClaimTypeFilterEmpty filter={filter} onShowAll={() => onFilter("All")} /></div>}
      />
      <TablePager table={table} label="Pages of the liquidations index" />
    </SectionCard>
  );
}
