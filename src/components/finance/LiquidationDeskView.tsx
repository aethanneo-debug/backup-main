import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  CornerUpLeft,
  Download,
  FileText,
  Inbox,
  ScrollText,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ActiveSignatory, User, UserRole } from "../../types";
import { apiCall, formatCurrency } from "../../utils";
import CashAdvanceDesk from "./CashAdvanceDesk";
import ReimbursementQueue from "./ReimbursementQueue";
import SectionCard, { SectionCount } from "../ui/SectionCard";
import { overspendOf, OverspendBadge, OverspendNotice } from "../liquidation/overspend";
import {
  ClaimTypeBadge,
  ClaimTypeFilter,
  ClaimTypeFilterEmpty,
  ClaimTypeFilterValue,
  matchesClaimType
} from "../liquidation/ClaimType";
import ReturnForCorrectionDialog from "../liquidation/ReturnForCorrectionDialog";
import { answeredCorrectionSummary } from "../liquidation/resubmit/correctionModel";

/** The mandated sequence a liquidation dossier must travel, in order. */
const PIPELINE_STEPS = ["Pending Submission", "Submitted", "Under Review", "Approved", "Completed"];

/** Index header cells. The background sits on the cell, not the row, so it keeps
 *  covering the body rows once the header sticks. */
const TH_CLASS = "border-b border-slate-200 bg-slate-50 px-4 py-3 font-bold";

interface LiquidationDeskViewProps {
  user: User;
  /** Every liquidation submission Finance can see — the queues filter this themselves. */
  submissions: any[];
  /** Submissions already narrowed to the active fiscal year (drives the index + export). */
  yearFilteredSubmissions: any[];
  activeFiscalYear: string;
  /** FinanceView's fiscal-year chooser, shown in the header beside the export. */
  yearControl?: ReactNode;
  selectedSub: any;
  subRemarks: string;
  setSelectedSub: (sub: any) => void;
  setSubRemarks: (remarks: string) => void;
  /** Validates a report. A Return goes through ReturnForCorrectionDialog instead. */
  onValidate: (subId: string, remarks: string) => void;
  /** exportMethods.liquidations from FinanceView, given the index rows on screen. */
  onExport: (rows?: any[]) => void;
  /** Re-runs the parent's fetches after money moves. */
  onQueueRefresh: () => void;
}

/** Status pill for the index — house badge pattern: -50 bg, -700 text, -200 border. */
function statusBadgeClass(status: string): string {
  if (status === "Completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Approved") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "Under Review") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

/**
 * The Liquidation Desk — Finance's half of the cash advance cycle, read top to bottom as
 * money out (Cash Advance Desk) then validation, then money back (Reimbursement Queue) and
 * finally the fiscal-year index. Extracted from FinanceView verbatim: every handler,
 * filter condition and role gate still belongs to the caller.
 */
export default function LiquidationDeskView({
  user,
  submissions,
  yearFilteredSubmissions,
  activeFiscalYear,
  yearControl,
  selectedSub,
  subRemarks,
  setSelectedSub,
  setSubRemarks,
  onValidate,
  onExport,
  onQueueRefresh
}: LiquidationDeskViewProps) {
  const validationQueue = (submissions ?? []).filter(s => s.status === "Verified & Forwarded");
  // Each list can be narrowed to Liquidations or Reimbursements (instructor's note 10).
  const [queueFilter, setQueueFilter] = useState<ClaimTypeFilterValue>("All");
  const [indexFilter, setIndexFilter] = useState<ClaimTypeFilterValue>("All");
  const visibleQueue = validationQueue.filter(s => matchesClaimType(s, queueFilter));
  const visibleIndex = (yearFilteredSubmissions ?? []).filter(s => matchesClaimType(s, indexFilter));
  // A report being returned for correction, with its checklist (requirement 5).
  const [returning, setReturning] = useState<any | null>(null);
  const [returnNotice, setReturnNotice] = useState("");

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
  const noAccountant = accountant === null;

  const downloadBase64File = (name: string, content: string) => {
    if (!content) {
      alert("No printable file attachments scanned for this mock metadata row.");
      return;
    }
    const link = document.createElement("a");
    link.href = content;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
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
            <h1 className="mt-0.5 text-base font-bold text-slate-900">
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
            // What the index shows, so a claim-type filter carries into the spreadsheet.
            onClick={() => onExport(visibleIndex)}
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
      {(user.role === UserRole.FINANCE_OFFICER || user.role === UserRole.SUPER_ADMIN) && (
        <CashAdvanceDesk onReleased={onQueueRefresh} />
      )}

      {/* FINANCE LIQUIDATION VALIDATION QUEUE */}
      {user.role === UserRole.FINANCE_OFFICER && (
        <SectionCard
          icon={<ClipboardCheck size={12} className="text-blue-600" aria-hidden="true" />}
          title="Finance Liquidation Validation Queue"
          action={<SectionCount>{validationQueue.length}</SectionCount>}
          caption="Validation"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-3xl text-[11px] text-slate-500">
              Validate receipts, invoices, and ledger documents approved by HR. Execute final
              validation to generate the Financial Transaction and update the budget.
            </p>
            {validationQueue.length > 0 && (
              <ClaimTypeFilter
                value={queueFilter}
                onChange={setQueueFilter}
                items={validationQueue}
                label="Filter the validation queue by claim type"
              />
            )}
          </div>

          {signatoryError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <span>Couldn&rsquo;t check who signs Box C. {signatoryError}</span>
              <button
                type="button"
                onClick={loadAccountant}
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
                onClick={loadAccountant}
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

          <div role="status" aria-live="polite">
            {returnNotice && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{returnNotice}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {validationQueue.length > 0 && visibleQueue.length === 0 ? (
              <ClaimTypeFilterEmpty filter={queueFilter} onShowAll={() => setQueueFilter("All")} />
            ) : visibleQueue.length > 0 ? (
              visibleQueue.map((sub) => (
                <article
                  key={sub.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4 transition-colors hover:border-blue-200 md:flex-row"
                >
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-700">
                        {sub.submissionNo}
                      </span>
                      <ClaimTypeBadge claimType={sub.claimType} />
                      <span className="font-mono text-[10px] text-slate-400">{sub.createdAt?.split("T")[0]}</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-blue-700">
                        <ShieldCheck size={10} aria-hidden="true" />
                        Verified by HR
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-slate-800">{sub.employeeName}</h3>
                      <p className="mt-1 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-600">For:</span>{" "}
                        {sub.activityTitle || sub.activityId}
                      </p>
                      {sub.representativeName && (
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-600">Box B:</span>{" "}
                          {sub.representativeName}
                          {sub.representativePosition ? `, ${sub.representativePosition}` : ""}
                        </p>
                      )}
                    </div>

                    {/* A correction changed the claim type or the cash advance. Finance pays,
                        and can check a voucher against its books, so it sees what the report
                        said before. Shown only while the figures still differ. */}
                    {sub.claimBeforeCorrection && (
                      sub.claimBeforeCorrection.claimType !== sub.claimType ||
                      Number(sub.claimBeforeCorrection.totalReleased) !== Number(sub.totalReleased) ||
                      (sub.claimBeforeCorrection.cashAdvanceDvNo || "") !== (sub.cashAdvanceDvNo || "")
                    ) && (
                      <p className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
                        <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700">
                          Changed on correction
                        </span>
                        It was filed as a {sub.claimBeforeCorrection.claimType || "report"} with a cash advance of{" "}
                        <strong>{formatCurrency(Number(sub.claimBeforeCorrection.totalReleased || 0))}</strong>
                        {sub.claimBeforeCorrection.cashAdvanceDvNo ? ` (DV ${sub.claimBeforeCorrection.cashAdvanceDvNo})` : ""}; it is now a{" "}
                        {sub.claimType} with <strong>{formatCurrency(Number(sub.totalReleased || 0))}</strong>
                        {sub.cashAdvanceDvNo ? ` (DV ${sub.cashAdvanceDvNo})` : ""}. Changed by {sub.claimBeforeCorrection.changedBy}.
                        Check the voucher before validating.
                      </p>
                    )}

                    {answeredCorrectionSummary(sub) && (
                      <p className="max-w-md rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[11px] text-blue-800">
                        {answeredCorrectionSummary(sub)}
                      </p>
                    )}

                    {/* Finance is the second approver of an excess, so it is shown
                        before the Validate button, not after. */}
                    {overspendOf(sub) && <OverspendNotice over={overspendOf(sub)!} />}

                    <div className="grid max-w-md grid-cols-2 gap-2 md:grid-cols-3">
                      <div className="rounded border border-slate-200 bg-white p-2">
                        <span className="block font-mono text-[9px] font-semibold text-slate-400">Released Advance</span>
                        <strong className="font-mono text-xs text-slate-700">
                          {formatCurrency(Number(sub.totalReleased || 0))}
                        </strong>
                      </div>
                      <div className="rounded border border-slate-200 bg-white p-2">
                        <span className="block font-mono text-[9px] font-semibold text-slate-400">Liquidated Spent</span>
                        <strong className="font-mono text-xs text-slate-700">
                          {formatCurrency(Number(sub.totalSpent || 0))}
                        </strong>
                      </div>
                      <div className="rounded border border-amber-200 bg-amber-50 p-2">
                        <span className="block font-mono text-[9px] font-semibold text-amber-700">Net Balance / Refund</span>
                        <strong className="font-mono text-xs font-bold text-amber-800">
                          {formatCurrency(Number(sub.remainingBalance || 0))}
                        </strong>
                      </div>
                    </div>

                    {sub.remarks && (
                      <p className="max-w-md rounded-lg border border-slate-200 bg-white p-2 text-[11px] italic text-slate-500">
                        &ldquo;{sub.remarks}&rdquo;
                      </p>
                    )}

                    {/* HR Verification remarks summary */}
                    <div className="max-w-md rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                      <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-blue-700">
                        HR Verification Remarks
                      </span>
                      <p className="mt-0.5 text-[11px] text-slate-700">
                        &ldquo;{sub.hrRemarks || "Verified expenditures relative to assigned activity."}&rdquo;
                      </p>
                    </div>

                    {/* Render Supporting Docs / Receipts */}
                    {sub.supportingDocs && sub.supportingDocs.length > 0 && (
                      <div className="max-w-md space-y-1.5">
                        <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Receipts &amp; Slips File Vouchers
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {sub.supportingDocs.map((doc: any, i: number) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => downloadBase64File(doc.name || doc.filename, doc.content)}
                              className={`flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-mono text-[10px] transition-colors hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 ${
                                doc.supersededAt ? "text-slate-400" : "text-slate-600"
                              }`}
                              title={doc.supersededAt ? "Replaced on correction; the old copy is kept for the record" : "Click to view/download attachment"}
                            >
                              <FileText size={10} className="text-slate-400" aria-hidden="true" />
                              <span className={doc.supersededAt ? "line-through" : undefined}>{doc.name}</span>
                              {/* A correction replaced it; the new copy is listed beside it. */}
                              {doc.supersededAt && <>{" "}<span className="text-[9px] font-bold uppercase">(replaced)</span></>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FINANCE ACTION BAR */}
                  <div className="flex w-full flex-col justify-between border-t border-slate-200 pt-3 md:w-64 md:border-t-0 md:border-l md:pt-0 md:pl-4">
                    <div className="space-y-1">
                      <label
                        htmlFor={`liq-remarks-${sub.id}`}
                        className="block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500"
                      >
                        Ledger Validation Remarks
                      </label>
                      <textarea
                        id={`liq-remarks-${sub.id}`}
                        placeholder="Add ledger match audit logs..."
                        value={selectedSub?.id === sub.id ? subRemarks : ""}
                        onChange={(e) => {
                          setSelectedSub(sub);
                          setSubRemarks(e.target.value);
                        }}
                        className="h-16 w-full resize-none rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
                      />
                      <p className="font-mono text-[9px] text-slate-400">Go with Validate. A Return has its own checklist.</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-3">
                      <button
                        type="button"
                        // A Return names what to correct; only those parts reopen for the employee.
                        onClick={() => { setReturnNotice(""); setReturning(sub); }}
                        className="flex cursor-pointer items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        <CornerUpLeft size={12} aria-hidden="true" />
                        Return<span className="sr-only"> {sub.submissionNo} for correction</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onValidate(sub.id, selectedSub?.id === sub.id ? subRemarks : "")}
                        disabled={noAccountant}
                        title={noAccountant ? "Appoint an Accountant in Utilities → Manage Signatories first" : undefined}
                        className="flex cursor-pointer items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 size={12} aria-hidden="true" />
                        Validate &amp; Finalize
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <ClipboardCheck size={28} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
                <p className="text-xs font-semibold text-slate-600">Nothing awaiting validation</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  No liquidation reports verified by HR awaiting Financial validation.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* OUT-OF-POCKET CLAIMS. Validation does not release money, so these stay
          open until Finance records the disbursement voucher. */}
      {(user.role === UserRole.FINANCE_OFFICER || user.role === UserRole.SUPER_ADMIN) && (
        <ReimbursementQueue submissions={submissions} onRecorded={onQueueRefresh} />
      )}

      {/* LIQUIDATIONS INDEX TABLE */}
      <SectionCard
        icon={<ScrollText size={12} className="text-blue-600" aria-hidden="true" />}
        title="Liquidations Index"
        action={<SectionCount>{yearFilteredSubmissions.length}</SectionCount>}
        caption={`Fiscal Year ${activeFiscalYear}`}
        bodyClassName=""
      >
        {yearFilteredSubmissions.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-b border-slate-100 px-4 py-2">
            {indexFilter !== "All" && (
              <span className="text-[10px] text-slate-500">Report Excel exports the rows shown.</span>
            )}
            <ClaimTypeFilter
              value={indexFilter}
              onChange={setIndexFilter}
              items={yearFilteredSubmissions}
              label="Filter the liquidations index by claim type"
            />
          </div>
        )}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <caption className="sr-only">
              Cash advance liquidations recorded for fiscal year {activeFiscalYear}
            </caption>
            <thead className="sticky top-0 z-10">
              <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <th scope="col" className={TH_CLASS}>Liquidation Code</th>
                <th scope="col" className={TH_CLASS}>Reference Request</th>
                <th scope="col" className={TH_CLASS}>Employee Recipient</th>
                <th scope="col" className={TH_CLASS}>Department / Division</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Advance Released</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Liquidated Spends</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Refund / Balance</th>
                <th scope="col" className={`${TH_CLASS} text-center`}>Status Loop</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleIndex.map((liq) => (
                <tr key={liq.id} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {liq.submissionNo}
                      <ClaimTypeBadge claimType={liq.claimType} />
                      {overspendOf(liq) && <OverspendBadge over={overspendOf(liq)!} />}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">{liq.activityId}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{liq.employeeName}</td>
                  <td className="max-w-[140px] truncate px-4 py-3 text-slate-400" title="N/A">N/A</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">{formatCurrency(liq.totalReleased)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{formatCurrency(liq.totalSpent)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">
                    {formatCurrency(liq.remainingBalance)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${statusBadgeClass(liq.status)}`}
                    >
                      {liq.status}
                    </span>
                  </td>
                </tr>
              ))}
              {yearFilteredSubmissions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Inbox size={28} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
                    <p className="text-xs font-semibold text-slate-600">No liquidations for FY {activeFiscalYear}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      No liquidation advances currently monitored.
                    </p>
                  </td>
                </tr>
              )}
              {yearFilteredSubmissions.length > 0 && visibleIndex.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4">
                    <ClaimTypeFilterEmpty filter={indexFilter} onShowAll={() => setIndexFilter("All")} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Returning a report: a checklist of what to correct. The corrected report comes
          straight back to Finance, since HR's verification still stands. */}
      {returning && (
        <ReturnForCorrectionDialog
          key={returning.id}
          report={returning}
          reviewer="Finance"
          onCancel={() => setReturning(null)}
          onSubmit={async payload => {
            // apiCall throws with the server's reason; the dialog shows it and stays open. A
            // refusal also reloads the queue, in case the report was acted on elsewhere.
            try {
              const res = await apiCall(`/api/liquidation-submissions/${encodeURIComponent(returning.id)}/finance-action`, {
                method: "PUT",
                body: JSON.stringify({ action: "Return", ...payload })
              });
              if (res?.status !== "success") throw new Error(res?.message || "The report could not be returned.");
            } catch (err) {
              onQueueRefresh();
              throw err;
            }
            setReturnNotice(`${returning.submissionNo} was returned for correction. It comes back to this queue once corrected.`);
            setReturning(null);
            onQueueRefresh();
          }}
        />
      )}
    </div>
  );
}
