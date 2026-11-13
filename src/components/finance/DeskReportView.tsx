import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CornerUpLeft, Loader2, Printer } from "lucide-react";
import { LiquidationSubmission, User, UserRole } from "../../types";
import { apiCall, formatCurrency, formatDate, getLocalTodayString } from "../../utils";
import { dvNumberFrom, dvPrefix, readDvNumber } from "../../dvNumber";
import { liquidationBalance } from "../../liquidationMoney";
import { OverspendNotice, overspendOf } from "../liquidation/overspend";
import ReportViewDialog, { VIEW_AMBER, VIEW_PRIMARY, VIEW_SECONDARY } from "../liquidation/ReportViewDialog";
import ReturnForCorrectionDialog from "../liquidation/ReturnForCorrectionDialog";
import { answeredCorrectionSummary } from "../liquidation/resubmit/correctionModel";
import { changedOnCorrection, coversOfficer, isOwnReport, reportText, type Report } from "../liquidation/reportColumns";
import { flagged, isPayableClaim, manilaDay, mismatch } from "./claimChecks";
import DvNumberFields from "./DvNumberFields";
import DeskFigure, { WhoValidatesNote } from "./DeskFigure";
import { HandBackReceipt, type ValidateReceipt } from "./OrNumberFields";
import { useHandBackReceipt } from "./useHandBackReceipt";

interface Props {
  user: User;
  report: Report;
  /** No active Accountant to print in Box C, so validation waits. */
  noAccountant: boolean;
  /** Throws with the server's reason. `receipt`: the OR for what the report hands back (12ai). */
  onValidate: (id: string, remarks: string, receipt?: ValidateReceipt) => Promise<void>;
  /** Re-runs the parent's fetches after money moves. */
  onQueueRefresh: () => void;
  onPrint: (report: LiquidationSubmission) => void;
  onClose: () => void;
  /** The report was acted on: the window closes, and the desk says what happened. */
  onDone: (message: string) => void;
}

const NOTE = "rounded-lg border p-2.5 text-[11px]";

/**
 * A report's View on the Liquidation Desk: what Finance has to look at first, then what the report's stage allows.
 * Validate and Return wait for Finance's turn; a validated claim is paid from here. Every list on the desk opens
 * this one window, and it reads the report as it is now, so its buttons follow the report's status.
 */
export default function DeskReportView({ user, report, noAccountant, onValidate, onQueueRefresh, onPrint, onClose, onDone }: Props) {
  const atFinance = report.status === "Verified & Forwarded";
  // What the server allows the one viewing at Finance's stage (financeAction, 12ai): nobody records the OR for cash they
  // hand back themselves, and the Administrator acts here only on a Financial Officer's handed-back cash.
  const may = report.financeAction ?? { act: user.role === UserRole.FINANCE_OFFICER, validate: user.role === UserRole.FINANCE_OFFICER };
  const canValidate = atFinance && may.validate;
  const canReturn = atFinance && may.act;
  const payable = isPayableClaim(report);
  const canRecordPayment = payable && (user.role === UserRole.FINANCE_OFFICER || user.role === UserRole.SUPER_ADMIN);
  // Nobody records the payment of their own claim: the server refuses it (403).
  const ownClaim = !!user.employeeId && report.employeeId === user.employeeId;
  const owed = Number(report.reimbursementAmount || 0);
  // The claimant's own report, or a group's that covers them: validating either is flagged as self-approved.
  const covers = coversOfficer(report, user.employeeId);
  const own = isOwnReport(report, user.employeeId);
  const { leftover } = liquidationBalance(report.totalReleased ?? 0, report.totalSpent ?? 0);
  // What a seminar report hands back comes with the OR the Finance Officer issues for it, recorded here with its scan
  // when validating (12ai: HSAC RAB 1 has no cashier). A report filed under the older rule carries the employee's.
  const orReceipt = useHandBackReceipt(report, leftover, canValidate);
  const { handsBack, scanOnFile } = orReceipt;
  const errorId = `desk-error-${report.id}`;

  const [remarks, setRemarks] = useState("");
  const [returning, setReturning] = useState(false);
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // The voucher's serial; its year and month are the voucher date's (YYYY-MM-NNNN, as on a release).
  const [dvSerial, setDvSerial] = useState("");
  const [payDate, setPayDate] = useState("");
  // Bumped after a refusal, so the voucher fields suggest a fresh serial.
  const [dvRefresh, setDvRefresh] = useState(0);
  // Answers a second click before the button has re-rendered disabled.
  const inFlight = useRef(false);
  const validateRef = useRef<HTMLButtonElement>(null);
  const payRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // A report acted on elsewhere leaves the form it had open.
  const showForm = paying && canRecordPayment && !ownClaim;

  // Disabling a button while it saves drops the keyboard focus: after a refusal it goes back to the button.
  useEffect(() => {
    if (!error || saving) return;
    const active = document.activeElement;
    if (!active || active === document.body) (confirmRef.current ?? validateRef.current ?? payRef.current)?.focus();
  }, [error, saving]);

  // The form takes the focus when it opens, and gives it back to Record Payment on Cancel.
  const wasPaying = useRef(false);
  useEffect(() => {
    if (paying) document.getElementById(`rb-dvd-${report.id}`)?.focus();
    else if (wasPaying.current) payRef.current?.focus();
    wasPaying.current = paying;
  }, [paying, report.id]);

  async function validate() {
    if (inFlight.current) return;
    setError("");
    // The OR for what is handed back: its number, date and scan, as the server reads them. The box at fault is marked,
    // tied to the message and focused.
    const wrong = orReceipt.check();
    orReceipt.setInvalid(wrong?.field ?? null);
    if (wrong) {
      setError(wrong.problem);
      document.getElementById(`or-${report.id}-${wrong.field === "scan" ? "scan-attach" : wrong.field}`)?.focus();
      return;
    }
    if ((own || may.fallback) && !window.confirm(`${report.submissionNo} ${covers || (may.fallback && !own) ? "is a group's report that covers you" : "is your own report"}. Validating it will be marked as self-approved in the audit log${may.fallback ? ", and Finance and HR are told" : ""}. Validate it anyway?`)) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await onValidate(report.id, remarks, orReceipt.receipt());
      onDone(`${report.submissionNo} was validated${handsBack ? `, with OR ${orReceipt.handBack.orNo.trim()} for the ${formatCurrency(leftover)} handed back` : ""}.`);
    } catch (err: any) {
      // The server's reason. The lists reload either way, so the buttons follow what it found.
      setError(err?.message || "The report could not be validated.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function openPayment() {
    setPaying(true);
    setDvSerial("");
    // Default to today (Manila); Finance can back-date to the DV's actual date.
    setPayDate(getLocalTodayString());
    setError("");
  }

  async function recordPayment() {
    if (inFlight.current) return;
    setError("");
    // The same voucher rules as a release (src/dvNumber.ts); the server checks them and refuses a number
    // already on an advance or another reimbursement.
    if (!dvPrefix(payDate)) {
      setError("Choose the voucher's date first.");
      return;
    }
    const dvNo = dvNumberFrom(payDate, dvSerial);
    const read = readDvNumber(dvNo, payDate);
    if ("problem" in read) {
      setError(dvSerial ? read.problem : "Type the voucher's serial number, the digits after its year and month.");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    try {
      const res = await apiCall(`/api/liquidation-submissions/${encodeURIComponent(report.id)}/record-reimbursement`, {
        method: "PUT",
        body: JSON.stringify({ dvNo, date: payDate })
      });
      if (res?.status !== "success") throw new Error(res?.message || "Could not record the reimbursement.");
      onDone(`${formatCurrency(owed)} for ${report.submissionNo} was recorded as paid on DV ${dvNo}.`);
      onQueueRefresh();
    } catch (err: any) {
      // apiCall throws on a non-2xx, so the server's message only surfaces here.
      setError(err?.message || "Could not record the reimbursement.");
      setDvRefresh(n => n + 1);
      onQueueRefresh();
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  const before = report.claimBeforeCorrection;
  const answered = answeredCorrectionSummary(report);
  const over = overspendOf(report);

  const notes = (
    <>
      {/* Officers may act on their own report, but it is flagged (the user's decision, 2026-10-20):
          they're told here, and asked again on Validate. */}
      {canValidate && own && !may.fallback && (
        <p className={`${NOTE} border-amber-200 bg-amber-50 text-amber-900`}>
          <strong>{covers ? "This group's report covers you." : "This is your own report."}</strong> You can validate it, but it will be marked as
          self-approved in the audit log.
        </p>
      )}

      {atFinance && <WhoValidatesNote may={may} administrator={user.role === UserRole.SUPER_ADMIN} />}

      {canValidate && noAccountant && (
        <p className={`${NOTE} border-amber-200 bg-amber-50 text-amber-800`}>
          <strong>No active Accountant, so validation is paused.</strong> Box C of every report must carry the
          Accountant on duty. Ask the Administrator to appoint one in Utilities &rarr; Manage Signatories.
        </p>
      )}

      {/* A correction changed the claim type or the cash advance. Finance pays, and can check a voucher
          against its books, so it sees what the report said before. Shown only while the figures still differ. */}
      {before && changedOnCorrection(report) && (
        <p className={`${NOTE} border-amber-200 bg-amber-50 text-amber-900`}>
          <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700">
            Changed on correction
          </span>
          It was filed as a {reportText(before.claimType) || "report"} with a cash advance of{" "}
          <strong>{formatCurrency(Number(before.totalReleased || 0))}</strong>
          {reportText(before.cashAdvanceDvNo) ? ` (DV ${reportText(before.cashAdvanceDvNo)})` : ""}; it is now a{" "}
          {reportText(report.claimType)} with <strong>{formatCurrency(Number(report.totalReleased || 0))}</strong>
          {reportText(report.cashAdvanceDvNo) ? ` (DV ${reportText(report.cashAdvanceDvNo)})` : ""}. Changed by {reportText(before.changedBy)}.
          {atFinance ? " Check the voucher before validating." : ""}
        </p>
      )}

      {answered && <p className={`${NOTE} border-blue-200 bg-blue-50 text-blue-800`}>{answered}</p>}

      {/* Finance is the second approver of an excess, so it is shown before the Validate button, not after. */}
      {atFinance && over && <OverspendNotice over={over} />}

      {/* A seminar report kept within its advance (the seminar budget flow): what validating returns to the
          training budget. What it hands back comes to the Finance Officer, who issues the OR and records it here with
          its scan (12ai); a report filed under the older rule shows the employee's. */}
      {atFinance && report.withinAdvance && (
        <p className={`${NOTE} ${leftover > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {leftover > 0 ? (
            <>
              <strong>{formatCurrency(leftover)}</strong> of the advance is handed back
              {reportText(report.refundOrNo) ? ` (OR ${reportText(report.refundOrNo)}${reportText(report.refundOrDate) ? `, ${formatDate(reportText(report.refundOrDate))}` : ""})` : ""}.{" "}
              {canValidate
                ? "Receive it, issue the official receipt, and record it below with its scan: validating returns it to the training budget."
                : may.own
                  ? "Someone else receives it and records the official receipt when validating; it then returns to the training budget."
                  : "The Finance Officer receives it and records the official receipt when validating; it then returns to the training budget."}
            </>
          ) : (
            <>Balanced: the items use up the cash advance exactly, so nothing is handed back.</>
          )}
        </p>
      )}

      {/* A seminar paid out of the employee's own pocket (2026-10-30): every cash advance now goes through
          the system, so none was released for the seat; it is owed within their share. An older
          Reimbursement shows HR's allocation without an advance, and the server already refuses to pay one
          with an advance on record, so it gets a reminder rather than an alarm. */}
      {payable && (report.withinAllowance ? (
        <p className={`${NOTE} border-purple-200 bg-purple-50 text-purple-900`}>
          <strong>Paid by the employee:</strong> no cash advance was released for this seminar, so the{" "}
          <strong>{formatCurrency(owed)}</strong> claimed is owed back to them
          {Number(report.allocatedAtFiling) > 0 ? <>, within their {formatCurrency(Number(report.allocatedAtFiling))} share</> : null}.
        </p>
      ) : mismatch(report) && report.claimType === "Reimbursement" ? (
        <p className={`${NOTE} flex items-start gap-2 border-amber-200 bg-amber-50 text-amber-800`}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            HR set aside <strong>{formatCurrency(Number(report.allocatedAtFiling))}</strong> for this
            assignment and no cash advance is on record. Pay only if none was released outside the system.
          </span>
        </p>
      ) : mismatch(report) && (
        <p className={`${NOTE} flex items-start gap-2 border-rose-200 bg-rose-50 text-rose-800`}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            HR set aside <strong>{formatCurrency(Number(report.allocatedAtFiling))}</strong> for this
            assignment, but the claimant reports receiving{" "}
            <strong>{formatCurrency(Number(report.totalReleased || 0))}</strong>. Confirm the advance was
            never released before paying &mdash; otherwise this would pay the same money twice.
          </span>
        </p>
      ))}

      {payable && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <DeskFigure label={report.withinAllowance ? "Their Share" : "HR Allocated"}>
            {report.allocatedAtFiling === undefined ? "Not on record" : formatCurrency(Number(report.allocatedAtFiling))}
          </DeskFigure>
          <DeskFigure label="Claimant States Received" tone={flagged(report) ? "rose" : "plain"}>{formatCurrency(Number(report.totalReleased || 0))}</DeskFigure>
          <DeskFigure label="Total Spent">{formatCurrency(Number(report.totalSpent || 0))}</DeskFigure>
          <DeskFigure label="Owed to Employee" tone="amber">{formatCurrency(owed)}</DeskFigure>
        </div>
      )}

      {canRecordPayment && ownClaim && (
        <p className={`${NOTE} border-amber-200 bg-amber-50 text-amber-900`}>
          <strong>This is your own claim.</strong> Another Financial Officer or the Administrator records its payment.
        </p>
      )}
    </>
  );

  const form = canValidate ? (
    <div className="space-y-1">
      {handsBack && (
        <div className="mb-2">
          <HandBackReceipt
            id={`or-${report.id}`}
            amount={formatCurrency(leftover)}
            minDate={reportText(report.cashAdvanceDvDate) || undefined}
            value={orReceipt.handBack}
            onChange={orReceipt.setHandBack}
            onFile={scanOnFile ? { name: reportText(scanOnFile.name) } : null}
            onProblem={message => { setError(message); if (!message) orReceipt.setInvalid(null); }}
            invalid={error ? orReceipt.invalid : null}
            describedBy={errorId}
            disabled={saving}
          />
        </div>
      )}
      <label htmlFor={`liq-remarks-${report.id}`} className="block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Validation Remarks (the employee sees these)
      </label>
      <textarea
        id={`liq-remarks-${report.id}`}
        placeholder="Optional: how the ledger and vouchers were checked"
        value={remarks}
        disabled={saving}
        onChange={e => setRemarks(e.target.value)}
        className="h-16 w-full resize-none rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-slate-100"
      />
      <p className="font-mono text-[9px] text-slate-500">Go with Validate. A Return has its own checklist.</p>
    </div>
  ) : showForm ? (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/30 p-3">
      <p className="text-[11px] font-semibold text-slate-700">The voucher {formatCurrency(owed)} is paid on</p>
      {/* Its date, then only the serial (DvNumberFields.tsx). It can't be dated before the report was validated. */}
      <DvNumberFields prefix="rb" recordId={report.id} dvDate={payDate} onDvDate={setPayDate} serial={dvSerial} onSerial={setDvSerial}
        onWarning={setError} disabled={saving} minDate={manilaDay(report.financeValidatedAt)} refresh={dvRefresh} />
    </div>
  ) : null;

  const actions = (
    <>
      {/* The server's reason beside the buttons, which never scroll away. They stack in reverse on a
          narrow screen, so order-last puts it above them there. */}
      {error && (
        <p id={errorId} role="alert" className="order-last flex items-start gap-1.5 text-[11px] leading-snug text-rose-700 sm:order-first sm:mr-auto sm:max-w-md sm:self-center">
          <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      <button type="button" onClick={() => onPrint(report)} disabled={saving} className={VIEW_SECONDARY}>
        <Printer size={12} aria-hidden="true" />
        Print<span className="sr-only"> {report.submissionNo}</span>
      </button>
      {canReturn && (
        <button
          type="button"
          // A Return names what to correct; only those parts reopen for the employee.
          onClick={() => { setError(""); setReturning(true); }}
          disabled={saving}
          className={VIEW_AMBER}
        >
          <CornerUpLeft size={12} aria-hidden="true" />
          Return<span className="sr-only"> {report.submissionNo} for correction</span>
        </button>
      )}
      {canValidate && (
        <>
          <button
            ref={validateRef}
            type="button"
            onClick={validate}
            disabled={noAccountant || saving}
            title={noAccountant ? "Appoint an Accountant in Utilities → Manage Signatories first" : undefined}
            className={VIEW_PRIMARY}
          >
            {saving ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
            {saving ? "Validating…" : "Validate & Finalize"}
          </button>
        </>
      )}
      {canRecordPayment && !ownClaim && !showForm && (
        <button ref={payRef} type="button" onClick={openPayment} className={VIEW_PRIMARY}>Record Payment</button>
      )}
      {showForm && (
        <>
          <button type="button" onClick={() => { setPaying(false); setError(""); }} disabled={saving} className={VIEW_SECONDARY}>Cancel</button>
          <button ref={confirmRef} type="button" onClick={recordPayment} disabled={saving} className={VIEW_PRIMARY}>
            {saving && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
            {saving ? "Recording…" : `Confirm ${formatCurrency(owed)} Released`}
          </button>
        </>
      )}
    </>
  );

  return (
    <>
      <ReportViewDialog report={report} onClose={onClose} notes={notes} form={form} actions={actions} busy={saving} claimNoted={payable} />

      {/* Returning a report: a checklist of what to correct, over the View, and Cancel comes back to it. The
          corrected report comes straight back to Finance, since HR's verification still stands. */}
      {returning && (
        <ReturnForCorrectionDialog
          key={report.id}
          report={report}
          reviewer="Finance"
          onCancel={() => setReturning(false)}
          onSubmit={async payload => {
            // apiCall throws with the server's reason; the dialog shows it and stays open. A
            // refusal also reloads the queue, in case the report was acted on elsewhere.
            try {
              const res = await apiCall(`/api/liquidation-submissions/${encodeURIComponent(report.id)}/finance-action`, {
                method: "PUT",
                body: JSON.stringify({ action: "Return", ...payload })
              });
              if (res?.status !== "success") throw new Error(res?.message || "The report could not be returned.");
            } catch (err) {
              onQueueRefresh();
              throw err;
            }
            setReturning(false);
            onDone(`${report.submissionNo} was returned for correction. It comes back to this queue once corrected.`);
            onQueueRefresh();
          }}
        />
      )}
    </>
  );
}
