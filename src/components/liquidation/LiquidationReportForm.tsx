import React from "react";
import { LiquidationSubmission, LiquidationParticular } from "../../types";
import { formatCurrency, formatDate } from "../../utils";
import HsacLogo from "../HsacLogo";

interface LiquidationReportFormProps {
  submission: LiquidationSubmission;
  /** e.g. "ACT-2026-004 - Regional Orientation Seminar". Printed in the header grid. */
  activityLabel?: string;
}

// A fill-in rule on the printed form. COA forms leave these to be hand-completed, so an
// empty value must still print as a visible rule, never collapse to nothing.
function FormValue({ value, className = "" }: { value?: string | null; className?: string }) {
  const text = (value ?? "").toString().trim();
  return (
    <span className={`inline-block min-w-[60px] border-b border-slate-400 px-1 text-slate-900 ${className}`}>
      {text || " "}
    </span>
  );
}

// One line of the totals block. `note` renders the inline "PER DV NO. __ DTD __" rules.
function TotalRow({
  label,
  note,
  amount,
  strong = false,
}: {
  label: string;
  note?: React.ReactNode;
  amount: number;
  strong?: boolean;
}) {
  return (
    <tr className={strong ? "bg-slate-100" : ""}>
      <td className="border border-slate-900 px-2 py-1.5 align-middle">
        <span
          className={`text-[10px] uppercase tracking-wide ${
            strong ? "font-bold text-slate-900" : "font-semibold text-slate-700"
          }`}
        >
          {label}
        </span>
        {note ? <span className="ml-1 text-[10px] text-slate-700">{note}</span> : null}
      </td>
      <td
        className={`border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap ${
          strong ? "text-xs font-bold text-slate-900" : "text-xs text-slate-800"
        }`}
      >
        {formatCurrency(amount)}
      </td>
    </tr>
  );
}

// One of the three certification boxes at the foot of the form.
function CertificationBox({
  letter,
  statement,
  name,
  role,
  signedAt,
  footer,
}: {
  letter: string;
  statement: string;
  name?: string;
  role: string;
  signedAt?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col border border-slate-900 p-2.5 min-h-[132px]">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-900">
        <span className="mr-1">{letter}</span>Certified:
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-slate-700">{statement}</p>

      <div className="mt-auto pt-5 text-center">
        <p className="border-b border-slate-900 pb-0.5 text-[11px] font-bold uppercase text-slate-900">
          {name?.trim() || " "}
        </p>
        <p className="mt-1 text-[9px] uppercase tracking-wide text-slate-600">{role}</p>
        <p className="mt-0.5 font-mono text-[9px] text-slate-500">
          {signedAt ? formatDate(signedAt) : "Date: ______________"}
        </p>
      </div>

      {footer ? <div className="mt-2 border-t border-slate-300 pt-1.5">{footer}</div> : null}
    </div>
  );
}

/**
 * The official COA Liquidation Report as HSAC RAB 1 files it.
 *
 * Presentational only - it never calls the API. `remainingBalance` is a single stored
 * figure: positive means the claimant refunded the excess (per OR No.), negative means
 * the agency still owes them. The two form lines below are that one figure split for
 * display, which is why both print and only one is ever non-zero.
 */
export default function LiquidationReportForm({ submission, activityLabel }: LiquidationReportFormProps) {
  const lines: LiquidationParticular[] = (submission.particulars ?? []).filter(
    (p) => p && ((p.description || "").trim() !== "" || Number(p.amount) > 0)
  );

  const totalSpent = Number(submission.totalSpent) || 0;
  const totalReleased = Number(submission.totalReleased) || 0;
  // Older records predate `remainingBalance`; derive it rather than printing NaN.
  const balance =
    typeof submission.remainingBalance === "number"
      ? submission.remainingBalance
      : Math.round((totalReleased - totalSpent) * 100) / 100;

  const amountRefunded = balance > 0 ? balance : 0;
  const amountToReimburse = balance < 0 ? Math.abs(balance) : 0;

  // Records filed before the PARTICULARS block existed still have to print a body.
  const printableLines: LiquidationParticular[] =
    lines.length > 0
      ? lines
      : [
          {
            id: "legacy-line",
            description: (submission.remarks || "").trim() || "Liquidated expenses",
            amount: totalSpent,
          },
        ];

  const periodFrom = submission.periodCoveredFrom ? formatDate(submission.periodCoveredFrom) : "";
  const periodTo = submission.periodCoveredTo ? formatDate(submission.periodCoveredTo) : "";
  const periodCovered =
    periodFrom && periodTo ? `${periodFrom} to ${periodTo}` : periodFrom || periodTo || "";

  // Box B is signed by the Financial Officer under delegated authority at RAB 1 - the
  // form's own "Authorized Representative" line. This is not a skipped approval.
  const delegatedBoxB =
    submission.divisionChiefStatus === "Certified by Authorized Representative" ||
    submission.divisionChiefStatus === "Bypassed (Auto-Approved by Finance)";

  return (
    <article
      id="lr-print-root"
      className="mx-auto w-full max-w-[820px] bg-white p-6 text-slate-900 print:max-w-none print:p-0"
      aria-label={`Liquidation Report ${submission.serialNo || submission.submissionNo}`}
    >
      {/* --- Agency header --- */}
      <header className="mb-3 flex items-center justify-center gap-3 text-center">
        <HsacLogo size={40} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-900">
            Human Settlements Adjudication Commission
          </p>
          <p className="text-[10px] text-slate-600">Regional Adjudication Branch No. 1</p>
          <p className="text-[9px] text-slate-500">
            Dona Pepita Building, Quezon Avenue, Barangay II, San Fernando City, La Union
          </p>
        </div>
      </header>

      <h1 className="mb-3 text-center text-base font-extrabold uppercase tracking-[0.2em] text-blue-600 print:text-black">
        Liquidation Report
      </h1>

      {/* --- Header grid --- */}
      <table className="w-full table-fixed border-collapse text-[10px]">
        <tbody>
          <tr>
            <td className="w-1/2 border border-slate-900 px-2 py-1.5">
              <span className="font-semibold uppercase tracking-wide text-slate-600">Entity Name:</span>{" "}
              <FormValue value={submission.entityName || "HSAC-RAB I"} className="font-mono font-bold" />
            </td>
            <td className="w-1/2 border border-slate-900 px-2 py-1.5">
              <span className="font-semibold uppercase tracking-wide text-slate-600">Serial No.:</span>{" "}
              <FormValue
                value={submission.serialNo || submission.submissionNo}
                className="font-mono font-bold"
              />
            </td>
          </tr>
          <tr>
            <td className="border border-slate-900 px-2 py-1.5">
              <span className="font-semibold uppercase tracking-wide text-slate-600">Fund Cluster:</span>{" "}
              <FormValue value={submission.fundCluster || "01 - Regular Fund"} className="font-mono" />
            </td>
            <td className="border border-slate-900 px-2 py-1.5">
              <span className="font-semibold uppercase tracking-wide text-slate-600">Date:</span>{" "}
              <FormValue
                value={formatDate(submission.dateSubmitted || submission.createdAt)}
                className="font-mono"
              />
            </td>
          </tr>
          <tr>
            <td className="border border-slate-900 px-2 py-1.5">
              <span className="font-semibold uppercase tracking-wide text-slate-600">Period Covered:</span>{" "}
              <FormValue value={periodCovered} className="font-mono" />
            </td>
            <td className="border border-slate-900 px-2 py-1.5">
              <span className="font-semibold uppercase tracking-wide text-slate-600">
                Responsibility Center Code:
              </span>{" "}
              <FormValue value={submission.responsibilityCenterCode} className="font-mono" />
            </td>
          </tr>
          {activityLabel ? (
            <tr>
              <td colSpan={2} className="border border-slate-900 px-2 py-1.5">
                <span className="font-semibold uppercase tracking-wide text-slate-600">
                  Activity / Purpose:
                </span>{" "}
                <FormValue value={activityLabel} className="font-mono" />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* --- PARTICULARS --- */}
      <table className="mt-3 w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th
              scope="col"
              className="border border-slate-900 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-slate-900"
            >
              Particulars
            </th>
            <th
              scope="col"
              className="w-[180px] border border-slate-900 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-slate-900"
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {printableLines.map((line, idx) => (
            <tr key={line.id || idx}>
              <td className="border-x border-slate-900 px-2 py-1 align-top text-[11px] text-slate-800">
                <span className="mr-2 font-mono text-[10px] text-slate-500">{idx + 1}.</span>
                {line.description}
              </td>
              <td className="border-x border-slate-900 px-2 py-1 text-right font-mono text-[11px] tabular-nums text-slate-900">
                {formatCurrency(Number(line.amount) || 0)}
              </td>
            </tr>
          ))}

          {/* COA closing rule - nothing may be added below this line. */}
          <tr>
            <td className="border-x border-slate-900 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">
              -- Nothing Follows ---
            </td>
            <td className="border-x border-slate-900 px-2 py-2" />
          </tr>

          {/* Blank body space so the sheet keeps the official proportions. */}
          <tr>
            <td className="h-16 border-x border-b border-slate-900" />
            <td className="h-16 border-x border-b border-slate-900" />
          </tr>

          <TotalRow label="Total Amount Spent" amount={totalSpent} strong />
          <TotalRow
            label="Amount of Cash Advance per DV No."
            note={
              <>
                <FormValue value={submission.cashAdvanceDvNo} className="font-mono text-[10px]" />
                <span className="mx-1 uppercase">dtd</span>
                <FormValue
                  value={submission.cashAdvanceDvDate ? formatDate(submission.cashAdvanceDvDate) : ""}
                  className="font-mono text-[10px]"
                />
              </>
            }
            amount={totalReleased}
          />
          <TotalRow
            label="Amount Refunded per OR No."
            note={
              <>
                <FormValue value={submission.refundOrNo} className="font-mono text-[10px]" />
                <span className="mx-1 uppercase">dtd</span>
                <FormValue
                  value={submission.refundOrDate ? formatDate(submission.refundOrDate) : ""}
                  className="font-mono text-[10px]"
                />
              </>
            }
            amount={amountRefunded}
          />
          <TotalRow label="Amount to be Reimbursed" amount={amountToReimburse} strong />
        </tbody>
      </table>

      {/* --- Certification boxes --- */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3">
        <CertificationBox
          letter="A"
          statement="Correctness of the above data."
          name={submission.employeeName}
          role="Claimant / Accountable Officer"
          signedAt={submission.dateSubmitted || submission.createdAt}
        />
        <CertificationBox
          letter="B"
          statement="Purpose of travel / cash advance duly accomplished."
          name={submission.divisionChiefApprovedBy}
          role="Head of Agency / Authorized Representative"
          signedAt={submission.divisionChiefApprovedAt}
          footer={
            delegatedBoxB ? (
              <p className="text-[8px] leading-snug text-slate-500">
                Signed by the Financial Officer as Authorized Representative under delegated authority.
              </p>
            ) : undefined
          }
        />
        <CertificationBox
          letter="C"
          statement="Supporting documents complete and proper."
          name={submission.financeValidatedBy}
          role="Accountant III"
          signedAt={submission.financeValidatedAt}
          footer={
            <p className="text-[9px] uppercase tracking-wide text-slate-600">
              JEV No.: <FormValue value={submission.jevNo} className="font-mono normal-case" />
            </p>
          }
        />
      </div>

      <p className="mt-2 text-[8px] uppercase tracking-wide text-slate-400">
        System reference: {submission.submissionNo}
      </p>
    </article>
  );
}
