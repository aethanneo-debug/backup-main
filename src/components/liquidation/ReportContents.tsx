import { useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import { downloadBase64File, formatCurrency, formatDate } from "../../utils";
import { BalanceStatusBadge, FundReturnNote } from "./BalanceCheck";

interface Props {
  /** A liquidation report as GET /api/liquidation-submissions returns it. */
  report: any;
}

const LABEL = "text-[10px] font-bold text-slate-400 uppercase font-mono mb-1";

/**
 * What the employee filed in a liquidation report: the claim, its line items, and the files
 * attached as requirements (receipts and the like). HR reviews these before endorsing the
 * report to Finance, whose desk shows the same files. A file a correction replaced stays
 * listed, struck through, for the record.
 */
export default function ReportContents({ report }: Props) {
  const [noContent, setNoContent] = useState("");
  // Old records may hold anything here, so only real lists are read.
  const items: any[] = Array.isArray(report?.particulars) ? report.particulars : [];
  const docs: any[] = Array.isArray(report?.supportingDocs) ? report.supportingDocs : [];
  const itemsTotal = Math.round(items.reduce((s, p) => s + (Number(p?.amount) || 0), 0) * 100) / 100;
  // Older reports may store amounts as text such as "₱12,000"; read the digits as the
  // server's migration does.
  const peso = (v: any) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0);
  const spent = report?.totalSpent !== undefined && report?.totalSpent !== null ? peso(report.totalSpent) : itemsTotal;
  const advance = peso(report?.totalReleased);
  const from = report?.periodCoveredFrom ? formatDate(report.periodCoveredFrom) : "";
  const to = report?.periodCoveredTo ? formatDate(report.periodCoveredTo) : "";

  return (
    <div className="space-y-4 border-t border-slate-100 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className={LABEL}>Claim Type</p>
          <p className="text-slate-700">{report?.claimType || "Not stated"}</p>
        </div>
        <div>
          <p className={LABEL}>Period Covered</p>
          <p className="text-slate-700">{from || to ? `${from || "?"} to ${to || "?"}` : "Not stated"}</p>
        </div>
        <div>
          <p className={LABEL}>Amount Spent</p>
          <p className="font-medium text-slate-700">{formatCurrency(spent)}</p>
        </div>
        <div>
          <p className={LABEL}>Cash Advance Received</p>
          <p className="text-slate-700">{advance > 0 ? formatCurrency(advance) : "None"}</p>
        </div>
      </div>

      {/* A seminar report kept within its advance (the seminar budget flow): balanced, or what
          was handed back with its OR, and once validated, what went back to the fund. */}
      {report?.withinAdvance && (
        <div className="space-y-1.5">
          <p className={LABEL}>Balance</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <BalanceStatusBadge report={report} />
            {report.refundOrNo && <span>OR {report.refundOrNo}{report.refundOrDate ? `, ${formatDate(report.refundOrDate)}` : ""}</span>}
          </div>
          <FundReturnNote report={report} />
        </div>
      )}

      <div>
        <p className={LABEL}>Particulars ({items.length})</p>
        {items.length === 0 ? (
          <p className="text-xs italic text-slate-500">No line items were entered.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-2 py-1.5 font-semibold">Description</th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">Category</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p, i) => (
                  <tr key={p?.id || i}>
                    <td className="px-2 py-1.5 text-slate-700">{p?.description || "—"}</td>
                    <td className="px-2 py-1.5 text-slate-500">{p?.category || "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-700">{formatCurrency(Number(p?.amount) || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={2} className="px-2 py-1.5 font-semibold text-slate-600">Total</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-800">{formatCurrency(itemsTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div>
        <p className={LABEL}>Attached Files ({docs.length})</p>
        {docs.length === 0 ? (
          <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
            <AlertTriangle size={12} className="shrink-0" aria-hidden="true" /> No files were attached to this report.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {docs.map((doc, i) => {
              const name = doc?.name || doc?.filename || `File ${i + 1}`;
              return (
                <li key={doc?.id || i}>
                  <button
                    type="button"
                    onClick={() => setNoContent(downloadBase64File(name, doc?.content) ? "" : name)}
                    title={doc?.supersededAt ? "Replaced on correction; the old copy is kept for the record" : "Open or save this file"}
                    className={`flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-mono text-[10px] hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      doc?.supersededAt ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    <FileText size={10} className="text-slate-400" aria-hidden="true" />
                    <span className={doc?.supersededAt ? "line-through" : undefined}>{name}</span>
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
      </div>
    </div>
  );
}
