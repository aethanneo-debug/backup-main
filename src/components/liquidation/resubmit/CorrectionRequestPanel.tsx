import { ClipboardList } from "lucide-react";
import { CorrectionRequest, LiquidationSubmissionView, UserRole } from "../../../types";
import { expenseLineLabel } from "../../../expenseLines";
import { formatCurrency, formatDate } from "../../../utils";
import { correctionLabel } from "./correctionModel";

/**
 * What the reviewer asked the claimant to correct (requirement 5): who returned the report,
 * why, and the parts that reopened. Everything else on the form stays as filed.
 */
export default function CorrectionRequestPanel({
  request,
  report
}: {
  request: CorrectionRequest;
  report: Partial<LiquidationSubmissionView>;
}) {
  const by = request.requestedByRole === UserRole.FINANCE_OFFICER ? "Finance" : "HR";
  const lineName = (id: string) => (report.particulars ?? []).find(p => p.id === id);
  // On a group's report lines can read the same, so each says whom it was for.
  const forWhom = (participantId?: string) => {
    const name = report.covers?.find(c => c.participantId === participantId)?.employeeName;
    return name ? ` for ${name}` : "";
  };
  const fileName = (id: string) => (report.supportingDocs ?? []).find(d => d.id === id)?.name ?? "a file";

  return (
    <section
      aria-labelledby="correction-request-heading"
      className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
    >
      <h3 id="correction-request-heading" className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider">
        <ClipboardList size={12} aria-hidden="true" />
        Returned by {by} for correction{request.round > 1 ? ` (round ${request.round})` : ""}
      </h3>
      <p className="text-[11px] text-amber-800">
        {request.requestedBy}, {formatDate(request.requestedAt)}: &ldquo;{request.remarks}&rdquo;
      </p>
      <div>
        <p className="text-[11px] font-semibold">Only these parts can be changed:</p>
        <ul className="mt-1 space-y-1">
          {request.items.map(item => (
            <li key={item.field} className="rounded border border-amber-100 bg-white px-2 py-1.5 text-[11px] text-slate-700">
              <span className="font-semibold text-slate-800">{correctionLabel(item.field)}</span>
              {item.field === "particulars" && (
                <span className="text-slate-500">
                  {item.lineIds?.length
                    ? `: ${item.lineIds.map(id => {
                        const line = lineName(id);
                        return line ? `${expenseLineLabel(line)}${forWhom(line.participantId)} (${formatCurrency(Number(line.amount) || 0)})` : "a line";
                      }).join("; ")}`
                    : ": every line (you may add or remove lines)"}
                </span>
              )}
              {item.field === "replaceDocuments" && (
                <span className="text-slate-500">: {(item.documentIds ?? []).map(fileName).join(", ")}</span>
              )}
              {item.remark && <span className="block text-amber-800">&ldquo;{item.remark}&rdquo;</span>}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[11px] text-amber-800">
        Everything else stays as filed. Once resubmitted, the report goes back to {by}.
      </p>
    </section>
  );
}
