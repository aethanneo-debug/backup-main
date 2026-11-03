import { useMemo, useRef, useState } from "react";
import type { CompletedTrainingProgram, CompletedTrainingPrograms } from "../../types";
import { formatCurrency, formatDate } from "../../utils";
import { Badge, dateRange } from "../training/TrainingHistoryCards";
import { Blank } from "./reportCells";
import ReportPanel, { ReportSelect } from "./ReportPanel";
import { completedCsvRows, completedFileName } from "./trainingReportRows";
import { useReportData, type FiscalYearOption, type ReportColumn, type ReportView } from "./reportView";

// Report 3 (R11): a fiscal year's seminars that have ended, as the route orders them (newest first), with the route's totals.

const MONEY = "font-mono tabular-nums";

const COLUMNS: ReportColumn<CompletedTrainingProgram>[] = [
  {
    key: "title",
    header: "Title",
    width: "27%",
    cell: row => (
      <>
        <span className="block font-semibold text-slate-800">{row.title || "Untitled seminar"}</span>
        {row.archived && <span className="mt-0.5 block"><Badge tone="none">Archived</Badge></span>}
      </>
    )
  },
  { key: "dates", header: "Dates", width: "19%", cell: row => dateRange(row.startDate, row.endDate) },
  { key: "venue", header: "Venue", width: "14%", cell: row => row.venue || <Blank /> },
  { key: "hours", header: "Hours", align: "right", width: "6%", cell: row => (row.hours > 0 ? row.hours : <Blank />) },
  { key: "enrolled", header: "Enrolled", align: "right", width: "7%", cell: row => row.enrolled },
  { key: "attended", header: "Attended", align: "right", width: "7%", cell: row => row.attended },
  { key: "allocated", header: "Allocated", align: "right", width: "10%", cell: row => <span className={MONEY}>{formatCurrency(row.allocated)}</span> },
  { key: "spent", header: "Spent", align: "right", width: "10%", cell: row => <span className={MONEY}>{formatCurrency(row.spent)}</span> }
];

export default function CompletedReport({ fiscalYears }: { fiscalYears: FiscalYearOption[] }) {
  const [fy, setFy] = useState("");
  const select = useRef<HTMLSelectElement>(null);
  const load = useReportData<CompletedTrainingPrograms>(fy ? `/api/training/reports/completed?fiscalYear=${encodeURIComponent(fy)}` : null);
  const data = load.data;

  const view = useMemo<ReportView<CompletedTrainingProgram> | null>(() => {
    if (!data) return null;
    const { rows, totals } = data;
    const asOf = formatDate(data.asOf);
    return {
      key: "completed",
      title: "Completed Training Programs",
      subtitle: `FY ${data.fiscalYear} · as of ${asOf}`,
      fileName: completedFileName(data),
      caption: `Completed training programs of FY ${data.fiscalYear}, newest first`,
      columns: COLUMNS,
      rows,
      rowKey: row => row.id,
      minWidth: 860,
      status: rows.length === 0
        ? `No seminars have ended in FY ${data.fiscalYear}, as of ${asOf}.`
        : `${totals.programs} completed seminar${totals.programs === 1 ? "" : "s"} in FY ${data.fiscalYear}, as of ${asOf}.`,
      canExport: rows.length > 0,
      csv: () => completedCsvRows(data),
      footer: [
        { key: "title", colSpan: 3, content: `Total: ${totals.programs} seminar${totals.programs === 1 ? "" : "s"}, as of ${asOf}` },
        { key: "hours", align: "right", content: totals.hours },
        { key: "enrolled", align: "right", content: totals.enrolled },
        { key: "attended", align: "right", content: totals.attended },
        { key: "allocated", align: "right", content: <span className={MONEY}>{formatCurrency(totals.allocated)}</span> },
        { key: "spent", align: "right", content: <span className={MONEY}>{formatCurrency(totals.spent)}</span> }
      ],
      empty: {
        title: `No seminars have ended in FY ${data.fiscalYear} yet.`,
        detail: "A seminar is listed from the day after its last day.",
        action: { label: "Choose another fiscal year", onClick: () => select.current?.focus() }
      }
    };
  }, [data]);

  return (
    <ReportPanel
      id="completed"
      title="Completed Training Programs"
      description="A fiscal year's seminars that have ended, newest first, with who attended and what was allocated and spent."
      prompt={fy ? null : "Choose a fiscal year to see its report."}
      load={load}
      errorName="list of completed seminars"
      view={view}
      pickers={
        <ReportSelect label="Fiscal year" hook="fy" value={fy} onChange={setFy} disabled={fiscalYears.length === 0} selectRef={select}>
          <option value="">Choose a fiscal year…</option>
          {fiscalYears.map(y => <option key={y.label} value={y.label}>FY {y.label}{y.active ? " (active)" : ""}</option>)}
        </ReportSelect>
      }
    />
  );
}
