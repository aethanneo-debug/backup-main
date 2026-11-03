import { useMemo, useRef, useState } from "react";
import type { Employee, EmployeeTrainingHistory, TrainingHistoryRow } from "../../types";
import { formatDate, getLocalTodayString } from "../../utils";
import { Badge, dateRange, recordTone } from "../training/TrainingHistoryCards";
import { AdvanceCell, AttendanceCell, Blank, CertificateCell, LiquidationCell, SeatNote } from "./reportCells";
import ReportPanel, { ReportSelect } from "./ReportPanel";
import { historyCountText, historyCsvRows, historyFileName } from "./trainingReportRows";
import { useReportData, type FiscalYearOption, type ReportColumn, type ReportView } from "./reportView";

// Report 1 (R11): one employee's trainings, for one fiscal year or all years, from the same route as the history window.
// One row per seat or HR record, newest first as the route sends them.

const COLUMNS: ReportColumn<TrainingHistoryRow>[] = [
  { key: "fy", header: "FY", width: "5%", cell: row => row.fiscalYear || <Blank /> },
  { key: "kind", header: "Kind", width: "7.5%", cell: row => (row.kind === "seminar" ? "Seminar" : "HR record") },
  {
    key: "title",
    header: "Training",
    width: "15%",
    cell: row => (
      <>
        <span className="block font-semibold text-slate-800">{row.title || "Untitled training"}</span>
        {row.kind === "seminar"
          ? <SeatNote seat={row.seat} replacedBy={row.replacedBy} inLieuOf={row.inLieuOf} />
          : row.remarks && <span className="block text-rose-700">Remarks: {row.remarks}</span>}
      </>
    )
  },
  { key: "dates", header: "Dates", width: "9%", cell: row => (row.kind === "seminar" ? dateRange(row.startDate, row.endDate) : row.dateConducted ? formatDate(row.dateConducted) : "Not recorded") },
  { key: "venue", header: "Venue", width: "8%", cell: row => (row.kind === "seminar" && row.venue ? row.venue : <Blank />) },
  { key: "hours", header: "Hours", align: "right", width: "5%", cell: row => (row.hours > 0 ? row.hours : <Blank />) },
  { key: "by", header: "Facilitator or organizer", width: "8.5%", cell: row => (row.kind === "seminar" ? row.facilitator : row.organizer) || <Blank /> },
  {
    key: "attendance",
    header: "Attendance or status",
    width: "8%",
    cell: row => (row.kind === "seminar"
      ? <AttendanceCell attendance={row.attendance} seat={row.seat} />
      : <Badge tone={recordTone(row.status)}>{row.status || "Pending verification"}</Badge>)
  },
  {
    key: "certificate",
    header: "Certificate",
    width: "9%",
    cell: row => (row.kind === "seminar"
      ? <CertificateCell certificate={row.certificate} />
      // An HR record keeps a file name only, no file.
      : row.certificateFilename ? <span className="break-all">{row.certificateFilename}</span> : <span className="text-slate-500">Not on file</span>)
  },
  { key: "advance", header: "Cash advance", width: "13%", cell: row => (row.kind === "seminar" ? <AdvanceCell advance={row.advance} /> : <Blank />) },
  { key: "report", header: "Liquidation", width: "12%", cell: row => (row.kind === "seminar" ? <LiquidationCell report={row.report} advance={row.advance} /> : <Blank />) }
];

export default function EmployeeHistoryReport({ employees, fiscalYears }: { employees: Employee[]; fiscalYears: FiscalYearOption[] }) {
  const [employeeId, setEmployeeId] = useState("");
  const [fy, setFy] = useState("");
  const fySelect = useRef<HTMLSelectElement>(null);
  const load = useReportData<EmployeeTrainingHistory>(
    employeeId ? `/api/employees/${encodeURIComponent(employeeId)}/training-history${fy ? `?fiscalYear=${encodeURIComponent(fy)}` : ""}` : null
  );
  const data = load.data;

  const people = useMemo(
    () => [...(employees ?? [])].sort((a, b) => String(a.fullName ?? "").localeCompare(String(b.fullName ?? ""))),
    [employees]
  );
  // The years on file, any other year this person has a row in, and the one chosen.
  const years = [...new Set([...fiscalYears.map(y => y.label), ...(data?.fiscalYears ?? []), ...(fy ? [fy] : [])])]
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  const view = useMemo<ReportView<TrainingHistoryRow> | null>(() => {
    if (!data) return null;
    const { employee, rows } = data;
    const where = data.fiscalYear ? `in FY ${data.fiscalYear}` : "across all years";
    const seminars = rows.filter(r => r.kind === "seminar");
    const attended = seminars.filter(r => r.kind === "seminar" && r.attendance === "Attended").length;
    const subtitle = [
      employee.fullName, employee.position, employee.division,
      data.fiscalYear ? `FY ${data.fiscalYear}` : "All fiscal years",
      `as of ${formatDate(data.asOf || getLocalTodayString())}`
    ].filter(Boolean).join(" · ");
    return {
      key: "history",
      title: "Employee Training History",
      subtitle,
      fileName: historyFileName(data),
      caption: `Training history of ${employee.fullName}, ${where}, newest first`,
      columns: COLUMNS,
      rows,
      rowKey: row => (row.kind === "seminar" ? row.participantId : row.id),
      minWidth: 960,
      status: rows.length === 0 ? `Nothing on record for ${employee.fullName} ${where}.` : `${historyCountText(data)} for ${employee.fullName} ${where}.`,
      canExport: rows.length > 0,
      csv: () => historyCsvRows(data, subtitle),
      totals: rows.length > 0 && (
        <p className="text-[11px] font-semibold text-slate-700">
          {historyCountText(data)}.{seminars.length > 0 ? ` Attended ${attended} of ${seminars.length} seminar${seminars.length === 1 ? "" : "s"}.` : ""}
        </p>
      ),
      empty: {
        title: `No trainings on record for ${employee.fullName} ${where}.`,
        detail: "Each seminar HR seats them in, and each training HR records, is listed here.",
        // The button goes as it is pressed: the focus goes to the filter it changed.
        action: data.fiscalYear ? { label: "Show all years", onClick: () => { setFy(""); fySelect.current?.focus(); } } : undefined
      }
    };
  }, [data]);

  return (
    <ReportPanel
      id="history"
      title="Employee Training History"
      description="One employee's seminars and the trainings HR recorded, with attendance, the certificate, the cash advance and the liquidation."
      prompt={employeeId ? null : "Choose an employee to see their report."}
      load={load}
      errorName="training history"
      view={view}
      pickers={
        <>
          <ReportSelect label="Employee" hook="employee" value={employeeId} onChange={setEmployeeId} disabled={people.length === 0}>
            <option value="">{people.length === 0 ? "No employees loaded" : "Choose an employee…"}</option>
            {people.map(e => <option key={e.id} value={e.id}>{e.fullName}{e.employeeId ? ` (${e.employeeId})` : ""}</option>)}
          </ReportSelect>
          <ReportSelect label="Fiscal year" hook="fy" value={fy} onChange={setFy} selectRef={fySelect}>
            <option value="">All years</option>
            {years.map(y => <option key={y} value={y}>FY {y}</option>)}
          </ReportSelect>
        </>
      }
    />
  );
}
