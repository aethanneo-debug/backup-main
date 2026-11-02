import { Activity, ArrowRight, BadgeCheck, Download, Info, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActiveSignatory, LiquidationSubmission, User, UserRole } from "../../types";
import { apiCall } from "../../utils";
import CashAdvanceDesk from "./CashAdvanceDesk";
import AdvanceRequestsList from "./AdvanceRequestsList";
import ReimbursementQueue from "./ReimbursementQueue";
import ValidationQueue from "./ValidationQueue";
import LiquidationsIndex from "./LiquidationsIndex";
import DeskReportView from "./DeskReportView";
import { focusViewButton } from "../ui/DataTable";
import { useRecordHighlight } from "../ui/useRecordHighlight";
import { useTableView } from "../ui/useTableView";
import LiquidationReportModal from "../liquidation/LiquidationReportModal";
import { ClaimTypeFilterValue, matchesClaimType } from "../liquidation/ClaimType";
import { NEWEST_FILED, REPORT_SORTS, reportRowId, reportSearchText, type Report } from "../liquidation/reportColumns";

/** The mandated sequence a liquidation dossier must travel, in order. */
const PIPELINE_STEPS = ["Pending Submission", "Submitted", "Under Review", "Approved", "Completed"];

interface LiquidationDeskViewProps {
  user: User;
  /** Every liquidation submission Finance can see — the queues filter this themselves. */
  submissions: any[];
  /** Submissions already narrowed to the active fiscal year (drives the index + export). */
  yearFilteredSubmissions: any[];
  activeFiscalYear: string;
  /** FinanceView's fiscal-year chooser, shown in the header beside the export. */
  yearControl?: ReactNode;
  /** Validates a report; throws the server's reason. A Return goes through ReturnForCorrectionDialog instead. */
  onValidate: (subId: string, remarks: string) => Promise<void>;
  /** exportMethods.liquidations from FinanceView, given every row the index matches. */
  onExport: (rows?: any[]) => void;
  /** Re-runs the parent's fetches after money moves. */
  onQueueRefresh: () => void;
  /** A report to open, from a notice, the overview or the Documents Vault, once a fresh load has landed. */
  focusReport?: { id: string; key: number } | null;
  onFocusReportHandled?: () => void;
  /** From a notification: an employee's cash advance request to show. */
  focusAdvance?: { id: string; nonce: number } | null;
  onFocusAdvanceHandled?: () => void;
}

/**
 * The Liquidation Desk — Finance's half of the cash advance cycle, read top to bottom as
 * money out (Cash Advance Desk) then validation, then money back (Reimbursement Queue) and
 * finally the fiscal-year index. Each list is a table, and every report opens one View,
 * read from `submissions` by its id so a reload refreshes what is on screen.
 */
export default function LiquidationDeskView({
  user,
  submissions,
  yearFilteredSubmissions,
  activeFiscalYear,
  yearControl,
  onValidate,
  onExport,
  onQueueRefresh,
  focusReport,
  onFocusReportHandled,
  focusAdvance,
  onFocusAdvanceHandled
}: LiquidationDeskViewProps) {
  // Bumped when a request is released or declined, so the Cash Advance Desk reloads too.
  const [deskVersion, setDeskVersion] = useState(0);

  // Box C prints the Accountant on duty when a report is validated (Utilities → Manage
  // Signatories). undefined = still loading, null = none appointed: validation waits.
  const [accountant, setAccountant] = useState<ActiveSignatory | null | undefined>(undefined);
  const [signatoryError, setSignatoryError] = useState("");
  async function loadAccountant() {
    setSignatoryError("");
    try {
      const res = await apiCall("/api/signatories");
      if (res?.status !== "success") throw new Error(res?.message || "Please try again.");
      setAccountant(((res.data ?? []) as ActiveSignatory[]).find(s => s.role === "Accountant") ?? null);
    } catch (err: any) {
      setSignatoryError(err?.message || "Please try again.");
    }
  }
  useEffect(() => {
    if (user.role === UserRole.FINANCE_OFFICER) loadAccountant();
  }, [user.role]);

  // The index's search is the desk's, since the masthead's Report Excel exports what it matches. A new
  // fiscal year starts from its first page.
  const [indexFilter, setIndexFilter] = useState<ClaimTypeFilterValue>("All");
  const indexTable = useTableView<Report>({
    rows: yearFilteredSubmissions,
    rowId: reportRowId,
    searchText: reportSearchText,
    filter: report => matchesClaimType(report, indexFilter),
    filterKey: `${activeFiscalYear}\u0000${indexFilter}`,
    sorts: REPORT_SORTS,
    defaultSort: NEWEST_FILED,
    clearFilter: () => setIndexFilter("All")
  });

  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewed: Report | null = (submissions ?? []).find(s => s.id === viewingId) ?? null;
  // Opened by a notice, the View has no row behind it to go back to: closing it lands on the report's row.
  const openedForNotice = useRef(false);
  const [closed, setClosed] = useState<{ id: string; key: number; landing: boolean } | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; key: number } | null>(null);
  // A report's official form in print preview (the instructor's review, R6).
  const [printing, setPrinting] = useState<LiquidationSubmission | null>(null);

  // What was just done. It stays in view however far down the desk it was done, and takes the focus: the row
  // the officer was on has gone.
  const [notice, setNotice] = useState<{ text: string; tone: "done" | "info"; key: number } | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const say = (text: string, tone: "done" | "info") => setNotice({ text, tone, key: Date.now() });
  useEffect(() => {
    if (notice) noticeRef.current?.focus({ preventScroll: true });
  }, [notice?.key]);

  function openReport(id: string) {
    setNotice(null);
    setViewingId(id);
  }

  function closeView() {
    if (viewingId) setClosed({ id: viewingId, key: Date.now(), landing: openedForNotice.current });
    openedForNotice.current = false;
    setViewingId(null);
  }

  // A notice's report: its View, over its row in each list that holds it.
  useEffect(() => {
    if (!focusReport) return;
    if ((submissions ?? []).some(s => s.id === focusReport.id)) {
      setRevealed({ id: focusReport.id, key: focusReport.key });
      indexTable.reveal(focusReport.id);
      openedForNotice.current = true;
      openReport(focusReport.id);
    } else {
      say("The report that notice is about couldn't be found here.", "info");
    }
    onFocusReportHandled?.();
  }, [focusReport?.key]);

  // A report that leaves the list closes its View rather than showing what is gone.
  useEffect(() => {
    if (viewingId && !viewed) {
      openedForNotice.current = false;
      setViewingId(null);
      say("That report is no longer on the desk.", "info");
    }
  }, [viewingId, viewed]);

  useRecordHighlight(closed?.landing ? closed.id : null, closed?.key, "[data-view-row]");
  // Closed from a row: the dialog gives the focus back to its View button, unless that row was redrawn meanwhile.
  // A report no list here shows (another fiscal year's, past Finance) has no row to land on.
  useEffect(() => {
    if (!closed) return;
    if (closed.landing && !document.querySelector(`[data-record-id="${CSS.escape(closed.id)}"]`)) headingRef.current?.focus({ preventScroll: true });
    else if (!closed.landing && (!document.activeElement || document.activeElement === document.body)) focusViewButton(closed.id);
  }, [closed]);

  const finance = user.role === UserRole.FINANCE_OFFICER;

  return (
    <div className="relative flex-1 overflow-y-auto custom-scrollbar">
      <div role="status" aria-live="polite" className="sticky top-0 z-20">
        {notice && (
          <div className="px-6 pt-3">
            <div
              ref={noticeRef}
              tabIndex={-1}
              className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-xs shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                notice.tone === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <p className="flex items-start gap-2">
                {notice.tone === "done"
                  ? <BadgeCheck size={14} className="mt-px shrink-0" aria-hidden="true" />
                  : <Info size={14} className="mt-px shrink-0" aria-hidden="true" />}
                <span>{notice.text}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  headingRef.current?.focus({ preventScroll: true });
                }}
                aria-label="Dismiss this message"
                className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6 p-6">
        {/* MASTHEAD */}
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 shrink-0 rounded-lg bg-blue-600 p-2 text-white" aria-hidden="true">
              <Wallet size={18} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-blue-600">
                HSAC RAB 1 &middot; Finance &middot; Liquidation Desk
              </p>
              <h1 ref={headingRef} tabIndex={-1} className="mt-0.5 text-base font-bold text-slate-900 focus:outline-none">
                Regional Cash Advances &amp; Liquidation Monitoring
              </h1>
              <p className="mt-1 max-w-3xl text-xs text-slate-500">
                Audit out-of-pocket cash advances. Enforce systematic workflow transitions from
                Submission to Review, of regional employees.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {yearControl}
            <button
              type="button"
              // Every row the index matches, on all its pages, so its search and filter carry into the spreadsheet.
              onClick={() => onExport(indexTable.matching)}
              className="flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
            >
              <Download size={13} className="mr-1.5 text-slate-500" aria-hidden="true" />
              <span>Report Excel</span>
            </button>
          </div>
        </header>

        {/* MANDATED PROGRESS LOOP — a legend, not an alert. Navy carries the numbering only,
            so it does not compete with the sections below it. */}
        <section
          aria-labelledby="liq-pipeline-heading"
          className="rounded-xl border border-slate-200 border-t-2 border-t-blue-600 bg-white px-4 py-3 shadow-sm"
        >
          <h2
            id="liq-pipeline-heading"
            className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400"
          >
            <Activity size={12} className="text-blue-600" aria-hidden="true" />
            Mandated Liquidation Progress Loop
          </h2>
          <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2 pt-1 font-mono text-xs">
            {PIPELINE_STEPS.map((st, i) => (
              <li key={st} className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700">
                  {i + 1}
                </span>
                <span className="font-semibold text-slate-600">{st}</span>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight size={11} className="mx-1.5 text-slate-300" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* MONEY OUT. Comes before validation because the advance has to exist before
            there is anything to liquidate against it. */}
        {(finance || user.role === UserRole.SUPER_ADMIN) && (
          <>
            {/* Employees' own requests for their seminar's advance (the seminar budget flow). */}
            <AdvanceRequestsList
              focus={focusAdvance}
              onFocusHandled={onFocusAdvanceHandled}
              onChanged={() => { setDeskVersion(v => v + 1); onQueueRefresh(); }}
            />
            <CashAdvanceDesk refreshKey={deskVersion} onReleased={onQueueRefresh} />
          </>
        )}

        {/* FINANCE LIQUIDATION VALIDATION QUEUE */}
        {finance && (
          <ValidationQueue
            submissions={submissions}
            currentEmployeeId={user.employeeId}
            accountant={accountant}
            signatoryError={signatoryError}
            onReloadAccountant={loadAccountant}
            onView={openReport}
            reveal={revealed}
          />
        )}

        {/* OUT-OF-POCKET CLAIMS. Validation does not release money, so these stay
            open until Finance records the disbursement voucher. */}
        {(finance || user.role === UserRole.SUPER_ADMIN) && (
          <ReimbursementQueue submissions={submissions} currentEmployeeId={user.employeeId} onView={openReport} reveal={revealed} />
        )}

        {/* LIQUIDATIONS INDEX TABLE */}
        <LiquidationsIndex table={indexTable} fiscalYear={activeFiscalYear} filter={indexFilter} onFilter={setIndexFilter} onView={openReport} />
      </div>

      {viewed && (
        <DeskReportView
          key={viewed.id}
          user={user}
          report={viewed}
          noAccountant={accountant === null}
          onValidate={onValidate}
          onQueueRefresh={onQueueRefresh}
          onPrint={setPrinting}
          onClose={closeView}
          onDone={message => {
            openedForNotice.current = false;
            setViewingId(null);
            // A validation settles an advance: the Cash Advance Desk's stages and its Unliquidated total follow.
            setDeskVersion(v => v + 1);
            say(message, "done");
          }}
        />
      )}
      <LiquidationReportModal submission={printing} activityLabel={printing?.activityTitle} onClose={() => setPrinting(null)} />
    </div>
  );
}
