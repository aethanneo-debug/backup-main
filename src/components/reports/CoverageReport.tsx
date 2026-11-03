import { useMemo, useRef, useState } from "react";
import type { TrainingCoverage, TrainingCoverageEntry } from "../../types";
import { formatDate, getLocalTodayString } from "../../utils";
import { Blank } from "./reportCells";
import ReportPanel, { ReportSelect } from "./ReportPanel";
import { coverageCsvRows, coverageFileName, coverageSentence } from "./trainingReportRows";
import { useReportData, type FiscalYearOption, type ReportColumn, type ReportView } from "./reportView";

// Report 4 (R11): who has no training yet in a fiscal year, from the route Programs & Budget's coverage panel reads.

const COLUMNS: ReportColumn<TrainingCoverageEntry>[] = [
  { key: "name", header: "Name", width: "38%", cell: row => <span className="font-semibold text-slate-800">{row.fullName}</span> },
  { key: "position", header: "Position", width: "34%", cell: row => row.position || <Blank /> },
  { key: "division", header: "Division", width: "28%", cell: row => row.division || <Blank /> }
];

export default function CoverageReport({ fiscalYears }: { fiscalYears: FiscalYearOption[] }) {
  const [fy, setFy] = useState("");
  const select = useRef<HTMLSelectElement>(null);
  const load = useReportData<TrainingCoverage>(fy ? `/api/training/coverage?fiscalYear=${encodeURIComponent(fy)}` : null);
  const data = load.data;

  const view = useMemo<ReportView<TrainingCoverageEntry> | null>(() => {
    if (!data) return null;
    const rows = data.withoutTraining ?? [];
    const sentence = coverageSentence(data);
    return {
      key: "coverage",
      title: "Employees with No Training Yet",
      subtitle: `FY ${data.fiscalYear} · as of ${formatDate(data.asOf || getLocalTodayString())}`,
      fileName: coverageFileName(data),
      caption: `Employees with no training yet in FY ${data.fiscalYear}`,
      columns: COLUMNS,
      rows,
      rowKey: row => row.id,
      minWidth: 560,
      status: `${rows.length} with no training yet in FY ${data.fiscalYear}. ${sentence}.`,
      canExport: rows.length > 0,
      csv: () => coverageCsvRows(data),
      totals: <p className="text-[11px] font-semibold text-slate-700">{sentence}.</p>,
      empty: data.total > 0
        ? { title: `Everyone has at least one training in FY ${data.fiscalYear}.`, good: true }
        : {
            title: "No active employees are on file.",
            action: { label: "Choose another fiscal year", onClick: () => select.current?.focus() }
          }
    };
  }, [data]);

  return (
    <ReportPanel
      id="coverage"
      title="Employees with No Training Yet"
      description="Active employees with no training yet in a fiscal year: no seminar seat that counts, and no training HR recorded."
      prompt={fy ? null : "Choose a fiscal year to see its report."}
      load={load}
      errorName="list of employees"
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
