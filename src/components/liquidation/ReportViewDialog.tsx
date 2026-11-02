import { useRef, type ReactNode } from "react";
import { FileText } from "lucide-react";
import type { LiquidationDocument } from "../../types";
import ModalDialog from "../ui/ModalDialog";
import { reportStatusBadgeClass } from "../finance/overviewFigures";
import { BalanceStatusBadge } from "./BalanceCheck";
import { ClaimTypeBadge } from "./ClaimType";
import { OverspendBadge, overspendOf } from "./overspend";
import { ReportAdvance, ReportBalance, ReportBoxB, ReportFacts, ReportFiles, ReportGroupNote, ReportNotes, ReportParticulars } from "./ReportContents";
import ReportHistory from "./ReportHistory";
import { reportText, seminarOf, type Report } from "./reportColumns";

/** The window's buttons, as the other dialogs draw them. */
const VIEW_BUTTON = "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60";
export const VIEW_SECONDARY = `${VIEW_BUTTON} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const VIEW_PRIMARY = `${VIEW_BUTTON} bg-blue-600 text-white shadow-sm hover:bg-blue-700`;
export const VIEW_AMBER = `${VIEW_BUTTON} border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`;

interface ReportViewDialogProps {
  report: Report;
  onClose: () => void;
  /** Warnings, at the top of the window. */
  notes?: ReactNode;
  /** The input this stage asks for (the validation remarks, the payment's voucher). */
  form?: ReactNode;
  /** The stage's buttons, in the footer after Close, the main one last. */
  actions?: ReactNode;
  /** A save in flight: the window can't be closed. */
  busy?: boolean;
  /** Says no to a file this person may only see the name of. */
  canOpenFile?: (doc: LiquidationDocument) => boolean;
  /** The number the list shows, when it isn't the report number. */
  title?: string;
  /** The list's own colour for the status, when it isn't the desk's. */
  statusClass?: string;
  /** The notes already say the employee paid for the seminar. */
  claimNoted?: boolean;
}

/**
 * A liquidation report in a window of its own (the instructor's review, R8: "meron akong view dito tapos lalabas
 * yun sa separate na ano, hindi ako aakyat"). Everything needed to act on a report is here: the lines, the files
 * (in the viewer, over this window), the advance, the history and the stage's buttons, which stay on screen in the
 * footer however long the report is. The opening focus sits at the top rather than on a file halfway down.
 */
export default function ReportViewDialog({ report, onClose, notes, form, actions, busy = false, canOpenFile, title, statusClass, claimNoted }: ReportViewDialogProps) {
  const top = useRef<HTMLDivElement>(null);
  const over = overspendOf(report);
  const status = reportText(report.status);
  return (
    <ModalDialog
      title={title || reportText(report.submissionNo) || reportText(report.serialNo) || "Liquidation report"}
      subtitle={[reportText(report.employeeName), seminarOf(report)].filter(Boolean).join(" · ")}
      icon={<FileText size={16} aria-hidden="true" />}
      onClose={onClose}
      busy={busy}
      initialFocusRef={top}
      size="2xl"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={VIEW_SECONDARY}>Close</button>
          {actions}
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <div ref={top} tabIndex={-1} className="flex flex-wrap items-center gap-1.5 focus:outline-none">
          {status && (
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${statusClass ?? reportStatusBadgeClass(status)}`}>{status}</span>
          )}
          <ClaimTypeBadge claimType={report.claimType} />
          <BalanceStatusBadge report={report} />
          {over && <OverspendBadge over={over} />}
        </div>

        {notes && <div className="space-y-2 empty:hidden">{notes}</div>}

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="min-w-0 space-y-4">
            <ReportGroupNote report={report} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ReportFacts report={report} />
            </div>
            <ReportBalance report={report} claimNoted={claimNoted} />
            <ReportParticulars report={report} />
            <ReportFiles report={report} canOpenFile={canOpenFile} />
            <ReportNotes report={report} />
          </div>
          <div className="min-w-0 space-y-4">
            {form}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
              <ReportAdvance report={report} />
              <ReportBoxB report={report} />
            </div>
            <ReportHistory report={report} />
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}
