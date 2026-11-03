import { useMemo, useState } from "react";
import type { TrainingProgram, TrainingProgramReport, TrainingProgramReportRow } from "../../types";
import { formatCurrency, formatDate, getLocalTodayString } from "../../utils";
import { dateRange } from "../training/TrainingHistoryCards";
import { AdvanceCell, AttendanceCell, Blank, CertificateCell, LiquidationCell, ReportFacts, SeatNote } from "./reportCells";
import ReportPanel, { ReportSelect } from "./ReportPanel";
import { clockTime, programCsvRows, programFileName, seatWord, TOTALS_NOTE, whenWord } from "./trainingReportRows";
import { useReportData, type FiscalYearOption, type ReportColumn, type ReportView } from "./reportView";

// Report 2 (R11): one seminar. Its money comes from the route's budget and totals, each cash advance and report counted
// once; the rows are never added up, since a group's advance and report sit on every seat they cover.

const COLUMNS: ReportColumn<TrainingProgramReportRow>[] = [
  { key: "name", header: "Name", width: "13%", cell: row => <span className="font-semibold text-slate-800">{row.fullName}</span> },
  {
    key: "where",
    header: "Position and division",
    width: "14%",
    cell: row => (row.position || row.division
      ? <>{row.position && <span className="block">{row.position}</span>}{row.division && <span className="block text-slate-500">{row.division}</span>}</>
      : <Blank />)
  },
  {
    key: "seat",
    header: "Seat",
    width: "10%",
    cell: row => (
      <>
        {row.seat === "enrolled" && <span className="block">{seatWord(row.seat)}</span>}
        <SeatNote seat={row.seat} replacedBy={row.replacedBy} inLieuOf={row.inLieuOf} />
      </>
    )
  },
  { key: "attendance", header: "Attendance", width: "8%", cell: row => <AttendanceCell attendance={row.attendance} seat={row.seat} /> },
  { key: "certificate", header: "Certificate", width: "11%", cell: row => <CertificateCell certificate={row.certificate} /> },
  { key: "advance", header: "Cash advance", width: "22%", cell: row => <AdvanceCell advance={row.advance} /> },
  { key: "report", header: "Liquidation", width: "22%", cell: row => <LiquidationCell report={row.report} advance={row.advance} figuresOnHolder /> }
];

const money = (amount: number) => <span className="font-mono font-semibold tabular-nums">{formatCurrency(amount)}</span>;

/** A list's seminars, newest first. Two with the same title and date read apart by a number. */
function programOptions(programs: TrainingProgram[]) {
  const sorted = [...programs].sort((a, b) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")) || String(a.title ?? "").localeCompare(String(b.title ?? "")));
  const seen = new Map<string, number>();
  const total = new Map<string, number>();
  const base = (p: TrainingProgram) => `${p.title || "Untitled seminar"} · ${p.startDate ? formatDate(p.startDate) : "no date"}`;
  for (const p of sorted) total.set(base(p), (total.get(base(p)) ?? 0) + 1);
  return sorted.map(p => {
    const label = base(p);
    const nth = (seen.get(label) ?? 0) + 1;
    seen.set(label, nth);
    return { id: p.id, label: `${label}${(total.get(label) ?? 0) > 1 ? ` (${nth} of ${total.get(label)})` : ""}${p.archivedAt ? " (archived)" : ""}` };
  });
}

export default function ProgramReport({ active, fiscalYears }: { active: boolean; fiscalYears: FiscalYearOption[] }) {
  // The list of seminars loads when this report is first opened, and stays.
  const [opened, setOpened] = useState(active);
  if (active && !opened) setOpened(true);
  const programs = useReportData<TrainingProgram[]>(opened ? "/api/training/programs" : null);
  // Null until HR picks one: the active year, once it is known.
  const [fyChoice, setFyChoice] = useState<string | null>(null);
  const fy = fyChoice ?? fiscalYears.find(y => y.active)?.label ?? "";
  const [programId, setProgramId] = useState("");
  const report = useReportData<TrainingProgramReport>(programId ? `/api/training/reports/program/${encodeURIComponent(programId)}` : null);
  const data = report.data;

  // One archived before use was never held, so it has no report.
  const held = useMemo(() => (Array.isArray(programs.data) ? programs.data : []).filter(p => p && !p.archivedBeforeUse), [programs.data]);
  const inYear = (year: string) => held.filter(p => !year || String(p.fiscalYear ?? "") === year);
  const options = useMemo(() => programOptions(inYear(fy)), [held, fy]);
  const years = [...new Set([...fiscalYears.map(y => y.label), ...held.map(p => String(p.fiscalYear ?? "")).filter(Boolean)])]
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  // Another year that doesn't hold the seminar chosen lets it go, so the list and the report never disagree.
  function chooseYear(year: string) {
    setFyChoice(year);
    if (programId && !inYear(year).some(p => p.id === programId)) setProgramId("");
  }

  const view = useMemo<ReportView<TrainingProgramReportRow> | null>(() => {
    if (!data) return null;
    const { program, budget, totals, rows } = data;
    const standing = `${whenWord(program.when)}${program.archived ? ", archived" : ""}`;
    return {
      key: "program",
      title: "Training Program Report",
      subtitle: [program.title, program.fiscalYear ? `FY ${program.fiscalYear}` : "", `as of ${formatDate(data.asOf || getLocalTodayString())}`].filter(Boolean).join(" · "),
      fileName: programFileName(data),
      caption: `Participants of ${program.title}`,
      columns: COLUMNS,
      rows,
      rowKey: row => row.participantId,
      minWidth: 960,
      status: `${program.title}: ${standing}. ${totals.enrolled} enrolled, ${totals.attended} attended.`,
      // Its details and budget are worth printing even with nobody on it.
      canExport: true,
      csv: () => programCsvRows(data),
      details: (
        <div className="space-y-3">
          <ReportFacts
            hook="details"
            title="Seminar details"
            items={[
              ["Dates", dateRange(program.startDate, program.endDate)],
              ["Times", program.startTime && program.endTime ? `${clockTime(program.startTime)} to ${clockTime(program.endTime)}` : <Blank />],
              ["Venue", program.venue || <Blank />],
              ["Facilitator", program.facilitator || <Blank />],
              ["Hours", program.hours > 0 ? program.hours : <Blank />],
              ["Seats", program.seats],
              ["Status", whenWord(program.when)],
              ["Archived", program.archived ? "Yes, once finished" : "No"]
            ]}
          />
          <ReportFacts
            hook="budget"
            title="Training budget"
            items={[
              ["Allocated", money(budget.allocated)],
              ["Spent", money(budget.spent)],
              ["Cash still out", money(budget.outstanding)],
              ["Back in Unallocated", money(budget.back)]
            ]}
          />
        </div>
      ),
      totals: (
        <div className="space-y-1.5">
          <ReportFacts
            title="Totals"
            items={[
              ["Enrolled", totals.enrolled],
              ["Attended", totals.attended],
              ["Did not attend", totals.didNotAttend],
              ["Attendance not recorded", totals.notRecorded],
              ["Certificates on file", totals.certificates],
              ["Replaced by a representative", totals.replaced],
              ["Taken off the seminar", totals.cancelled],
              ["Cash advanced", money(totals.advanced)],
              ["Handed back", money(totals.handedBack)],
              ["Reports filed", totals.reports],
              ["Reports validated", totals.validated]
            ]}
          />
          <p className="text-[10px] text-slate-500">{TOTALS_NOTE.replace(" The seat columns above are each seat's own records as they stand.", "")}</p>
        </div>
      ),
      empty: { title: "Nobody is on this seminar.", detail: "Its details and budget are above." }
    };
  }, [data]);

  const listFailed = !programId && programs.error !== null;
  const listLoading = !programId && programs.loading;
  const noneInYear = opened && !programs.loading && programs.error === null && options.length === 0;
  const prompt = programId || listFailed || listLoading ? null
    : noneInYear ? `No seminars ${fy ? `in FY ${fy}` : "on file"}. Choose another fiscal year.`
    : "Choose a seminar to see its report.";

  return (
    <ReportPanel
      id="program"
      title="Training Program Report"
      description="One seminar: its details and budget, what each participant's records hold, and the totals."
      prompt={prompt}
      load={programId ? report : programs}
      errorName={programId ? "seminar's report" : "list of seminars"}
      view={view}
      pickers={
        <>
          <ReportSelect label="Fiscal year" hook="fy" value={fy} onChange={chooseYear}>
            <option value="">All years</option>
            {years.map(y => <option key={y} value={y}>FY {y}</option>)}
          </ReportSelect>
          <ReportSelect
            label="Seminar"
            hook="program"
            value={programId}
            // The year it was chosen under stays, even if the years load or reload after (the active year would replace it).
            onChange={id => { setProgramId(id); if (id) setFyChoice(fy); }}
            disabled={programs.loading || options.length === 0}
          >
            <option value="">{programs.loading ? "Loading seminars…" : options.length === 0 ? "No seminars" : "Choose a seminar…"}</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </ReportSelect>
        </>
      }
    />
  );
}
