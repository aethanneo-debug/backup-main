import { useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import type { LiquidationDocument, LiquidationSubmissionView } from "../../types";
import { declarationsText, documentPlate } from "../../reportDocuments";
import { formatCurrency, formatDate } from "../../utils";
import FileViewer, { type ReportFile } from "../ui/FileViewer";
import { BalanceStatusBadge, FundReturnNote } from "./BalanceCheck";
import ReportHistory from "./ReportHistory";
import { coversOf, peso, reportText } from "./reportColumns";
import { olderDv } from "../../dvNumber";

/** A liquidation report as GET /api/liquidation-submissions returns it. */
type ReportProps = { report: LiquidationSubmissionView };

const LABEL = "mb-1 font-mono text-[10px] font-bold uppercase text-slate-500";

// Old records may hold anything here, so only real lists are read, and only the entries in them that are records.
const recordsOf = <T,>(value: unknown): T[] => (Array.isArray(value) ? value.filter(x => !!x && typeof x === "object") : []);
const linesOf = (report: LiquidationSubmissionView) => recordsOf<LiquidationSubmissionView["particulars"][number]>(report?.particulars);
const filesOf = (report: LiquidationSubmissionView) => recordsOf<LiquidationDocument>(report?.supportingDocs);
const linesTotal = (report: LiquidationSubmissionView) =>
  Math.round(linesOf(report).reduce((s, p) => s + (Number(p?.amount) || 0), 0) * 100) / 100;
const spentOf = (report: LiquidationSubmissionView) =>
  report?.totalSpent !== undefined && report?.totalSpent !== null ? peso(report.totalSpent) : linesTotal(report);

/** One report for a group (HSAC RAB 1): everyone its cash advance covers. */
export function ReportGroupNote({ report }: ReportProps) {
  const covers = coversOf(report);
  if (covers.length < 2) return null;
  return (
    <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
      <strong>One report for a group of {covers.length}</strong> on one cash advance, filed by its holder:{" "}
      {covers.map(c => reportText(c.employeeName)).join(", ")}.
    </p>
  );
}

/** The claim type, the period and what was spent, as cells of the caller's grid. */
export function ReportFacts({ report }: ReportProps) {
  const from = reportText(report?.periodCoveredFrom);
  const to = reportText(report?.periodCoveredTo);
  return (
    <>
      <div>
        <p className={LABEL}>Claim Type</p>
        <p className="text-slate-700">{reportText(report?.claimType) || "Not stated"}</p>
      </div>
      <div>
        <p className={LABEL}>Period Covered</p>
        <p className="text-slate-700">{from || to ? `${from ? formatDate(from) : "?"} to ${to ? formatDate(to) : "?"}` : "Not stated"}</p>
      </div>
      <div>
        <p className={LABEL}>Amount Spent</p>
        <p className="font-medium text-slate-700">{formatCurrency(spentOf(report))}</p>
      </div>
    </>
  );
}

/** The cash advance, and the voucher it went out on, to check against the books. */
export function ReportAdvance({ report }: ReportProps) {
  const advance = peso(report?.totalReleased);
  const dvNo = reportText(report?.cashAdvanceDvNo);
  const dvDate = reportText(report?.cashAdvanceDvDate);
  return (
    <div>
      <p className={LABEL}>Cash Advance Received</p>
      <p className="text-slate-700">{advance > 0 ? formatCurrency(advance) : "None"}</p>
      {dvNo && (
        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
          DV No. {dvNo}{dvDate ? ` · dated ${formatDate(dvDate)}` : ""}
          {/* Typed as free text before the voucher format (2026-10-29), and kept as typed. */}
          {olderDv(dvNo) && <span data-dv-older className="block font-sans">Entered before the voucher number format</span>}
        </p>
      )}
    </div>
  );
}

/** Who certifies the report in Box B of the form. */
export function ReportBoxB({ report }: ReportProps) {
  const name = reportText(report?.representativeName);
  if (!name) return null;
  const position = reportText(report?.representativePosition);
  return (
    <div>
      <p className={LABEL}>Box B Representative</p>
      <p className="text-slate-700">{name}{position ? `, ${position}` : ""}</p>
    </div>
  );
}

/** How the report stands against its advance, or what is owed back when the employee paid. `claimNoted`: a note
 * above already says so. */
export function ReportBalance({ report, claimNoted = false }: ReportProps & { claimNoted?: boolean }) {
  const refundOr = reportText(report?.refundOrNo);
  const refundDate = reportText(report?.refundOrDate);
  const share = peso(report?.allocatedAtFiling) > 0 ? `, within their ${formatCurrency(peso(report.allocatedAtFiling))} share` : "";
  const paidDv = reportText(report?.reimbursementDvNo);
  const paidOn = reportText(report?.reimbursementDate);
  // A report filed under the older rules, outside an advance's limit: what it came to, as the old desk showed it.
  const balance = peso(report?.remainingBalance);
  return (
    <>
      {/* A seminar paid out of the employee's own pocket (HSAC RAB 1 allows it, 2026-10-30): no cash
          advance, and what is owed back, within their share as it stood when it was filed. Said as it stands: owed,
          ready to pay, or paid. */}
      {report?.withinAllowance && !claimNoted && (
        <p className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900">
          <strong>Paid by the employee:</strong> no cash advance was released for this seminar,{" "}
          {report.reimbursementStatus === "Reimbursed" ? (
            <>and the {formatCurrency(spentOf(report))} spent was paid back to them{paidDv ? ` on DV ${paidDv}` : ""}{paidOn ? `, dated ${formatDate(paidOn)}` : ""}.</>
          ) : (
            <>
              so the {formatCurrency(spentOf(report))} spent is owed back to them{share}.{" "}
              {report.status === "Completed" ? "Finance pays it from the Reimbursement Queue." : "Finance pays it from the Reimbursement Queue once it is validated."}
            </>
          )}
        </p>
      )}

      {!report?.withinAdvance && !report?.withinAllowance && (
        <div>
          <p className={LABEL}>Refund / Balance</p>
          <p className="text-slate-700">
            <span className="font-mono">{formatCurrency(balance)}</span>
            <span className="ml-1.5 text-[10px] text-slate-500">{balance > 0 ? "Refund" : balance < 0 ? "To reimburse" : "None"}</span>
          </p>
        </div>
      )}

      {/* A seminar report kept within its advance (the seminar budget flow): balanced, or what
          was handed back with its OR, and once validated, what went back to the fund. */}
      {report?.withinAdvance && (
        <div className="space-y-1.5">
          <p className={LABEL}>Balance</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <BalanceStatusBadge report={report} />
            {refundOr && <span>OR {refundOr}{refundDate ? `, ${formatDate(refundDate)}` : ""}</span>}
          </div>
          <FundReturnNote report={report} />
        </div>
      )}
    </>
  );
}

/** The employee's own notes on the report. */
export function ReportNotes({ report }: ReportProps) {
  const notes = reportText(report?.remarks);
  if (!notes) return null;
  return (
    <div>
      <p className={LABEL}>Employee&rsquo;s Notes</p>
      <p className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs italic text-slate-600">
        &ldquo;{notes}&rdquo;
      </p>
    </div>
  );
}

/** The report's line items. */
export function ReportParticulars({ report }: ReportProps) {
  const items = linesOf(report);
  // A group's report: a line may name whom it was for.
  const nameOf = (participantId?: string) => reportText(coversOf(report).find(c => c.participantId === participantId)?.employeeName);
  return (
    <div>
      <p className={LABEL}>Particulars ({items.length})</p>
      {items.length === 0 ? (
        <p className="text-xs italic text-slate-500">No line items were entered.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-semibold">Expense</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p, i) => (
                <tr key={reportText(p?.id) || i}>
                  <td className="px-2 py-1.5 text-slate-700">
                    {reportText(p?.category) || "Miscellaneous"}
                    {/* An older report keeps the description it was filed with. */}
                    {reportText(p?.description) && <span className="block text-[10px] text-slate-500">{reportText(p.description)}</span>}
                    {nameOf(p?.participantId) && <span className="block text-[10px] text-slate-500">For {nameOf(p.participantId)}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-700">{formatCurrency(Number(p?.amount) || 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td className="px-2 py-1.5 font-semibold text-slate-600">Total</td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-800">{formatCurrency(linesTotal(report))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/** The files attached as requirements, in the viewer on a click. A file a correction replaced stays listed, struck
 * through, for the record. `canOpenFile` says no to a file this person may only see the name of. */
export function ReportFiles({ report, canOpenFile }: ReportProps & { canOpenFile?: (doc: LiquidationDocument) => boolean }) {
  const [noContent, setNoContent] = useState("");
  const [viewing, setViewing] = useState<ReportFile | null>(null);
  const docs = filesOf(report);
  const ticked = declarationsText(report?.travelDeclarations);
  return (
    <div>
      <p className={LABEL}>Attached Files ({docs.length})</p>
      {/* What only the employee can say about the trip, and why some documents are or aren't here (R5). */}
      {ticked && (
        <p className="mb-1.5 text-[11px] text-slate-600">
          <span className="font-semibold">The employee ticked:</span> {ticked}.
        </p>
      )}
      {docs.length === 0 ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          <AlertTriangle size={12} className="shrink-0" aria-hidden="true" /> No files were attached to this report.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {docs.map((doc, i) => {
            const name = reportText(doc?.name) || reportText(doc?.filename) || `File ${i + 1}`;
            const plate = documentPlate(doc?.kind);
            const openable = !canOpenFile || canOpenFile(doc);
            return (
              <li key={reportText(doc?.id) || i}>
                <button
                  type="button"
                  disabled={!openable}
                  onClick={() => {
                    setNoContent(doc?.hasFile ? "" : name);
                    if (doc?.hasFile) setViewing({ reportId: report.id, docId: doc.id, name });
                  }}
                  title={doc?.supersededAt ? (doc.kind === "refundOr" ? "Replaced by a newer scan of the OR; the old copy is kept for the record" : "Replaced on correction; the old copy is kept for the record") : openable ? "View this file" : "Only its owner can open this file"}
                  className={`flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-mono text-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    openable ? "cursor-pointer hover:border-blue-300 hover:bg-blue-50" : "cursor-default bg-slate-50"
                  } ${doc?.supersededAt ? "text-slate-400" : openable ? "text-slate-600" : "text-slate-500"}`}
                >
                  <FileText size={10} className="text-slate-400" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col text-left">
                    {plate && <span className="font-sans text-[9px] font-semibold text-slate-500">{plate}</span>}
                    <span className={`break-all ${doc?.supersededAt ? "line-through" : ""}`}>{name}</span>
                    {reportText(doc?.size) && <span className="font-sans text-[9px] text-slate-400">{reportText(doc.size)}</span>}
                  </span>
                  {doc?.supersededAt && <span className="text-[9px] font-bold uppercase">(replaced)</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {noContent && (
        <p role="alert" className="mt-1.5 text-[11px] text-rose-700">&ldquo;{noContent}&rdquo; has no uploaded file that can be opened.</p>
      )}
      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

/**
 * What the employee filed in a liquidation report, in one column: the claim, the advance and its voucher, Box B,
 * their notes, the line items, the files attached as requirements, and what has happened to it. HR reviews these
 * before endorsing the report to Finance; the View window (ReportViewDialog.tsx) lays the same parts out on a wider
 * page.
 */
export default function ReportContents({ report, canOpenFile }: ReportProps & { canOpenFile?: (doc: LiquidationDocument) => boolean }) {
  return (
    <div className="space-y-4 border-t border-slate-100 pt-4">
      <ReportGroupNote report={report} />
      <div className="grid grid-cols-2 gap-4">
        <ReportFacts report={report} />
        <ReportAdvance report={report} />
        <ReportBoxB report={report} />
      </div>
      <ReportBalance report={report} />
      <ReportNotes report={report} />
      <ReportParticulars report={report} />
      <ReportFiles report={report} canOpenFile={canOpenFile} />
      <ReportHistory report={report} />
    </div>
  );
}
