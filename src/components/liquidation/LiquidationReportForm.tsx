import React from "react";
import { LiquidationSubmission, LiquidationParticular } from "../../types";
import { SHEET_FONT, amountText, longDate, periodRange, sheetDate } from "./sheet/sheetFormat";
import { CertificationCell, Fill, SheetTotalRow } from "./sheet/SheetParts";

interface LiquidationReportFormProps {
  submission: LiquidationSubmission;
  /**
   * e.g. "ACT-2026-004 - Regional Orientation Seminar". The printed form has no line for
   * it (the particulars describe the activity), so the modal shows it on screen instead.
   */
  activityLabel?: string;
}

const Amount = ({ value }: { value: number }) => <span className="font-bold tabular-nums">{amountText(value)}</span>;

/**
 * The COA Liquidation Report, laid out exactly like HSAC RAB 1's Excel sheet. The filing
 * form (sheet/LiquidationSheetForm) is the same sheet with inputs, built from the same parts.
 *
 * Presentational only - it never calls the API. `remainingBalance` is a single stored
 * figure: positive means the claimant refunded the excess (per OR No.), negative means
 * the agency still owes them. The two form lines below are that one figure split for
 * display, which is why both print and only one is ever non-zero.
 */
export default function LiquidationReportForm({ submission }: LiquidationReportFormProps) {
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

  const period = periodRange(submission.periodCoveredFrom, submission.periodCoveredTo);
  // Keeps the sheet's proportions: the body is mostly empty ruled space below the lines.
  const bodySpace = Math.max(56, 320 - 44 * printableLines.length);

  return (
    <article
      id="lr-print-root"
      className="mx-auto w-full min-w-[680px] max-w-[800px] bg-white p-6 text-black print:min-w-0 print:max-w-none print:p-0"
      style={{ fontFamily: SHEET_FONT }}
      aria-label={`Liquidation Report ${submission.serialNo || submission.submissionNo}`}
    >
      <table className="w-full table-fixed border-collapse border border-black text-[13px] leading-snug">
        {/* A and B share the PARTICULARS width; C sits under the AMOUNT column. */}
        <colgroup>
          <col style={{ width: "33%" }} />
          <col style={{ width: "33%" }} />
          <col style={{ width: "34%" }} />
        </colgroup>
        <tbody>
          {/* --- Title block --- */}
          <tr>
            <td colSpan={2} className="border-r-2 border-b-2 border-black px-2 pt-3 pb-2 align-top">
              <h1 className="text-center text-[17px] font-bold">LIQUIDATION REPORT</h1>
              <p className="text-center">
                Period Covered: <Fill value={period} className="font-bold" minWidth="10rem" />
              </p>
              <div className="mt-6 font-bold">
                <p>Entity Name : {submission.entityName || "HSAC-RAB I"}</p>
                <p>Fund Cluster : {submission.fundCluster || "01 - Regular Fund"}</p>
              </div>
            </td>
            <td className="border-b-2 border-black p-0 align-top">
              <div className="px-1.5 pt-3 pb-3">
                <p>
                  Serial No.: <Fill value={submission.serialNo || submission.submissionNo} className="font-bold" />
                </p>
                <p>
                  Date: <Fill value={longDate(submission.dateSubmitted || submission.createdAt)} className="font-bold" />
                </p>
              </div>
              <div className="border-t border-black px-1.5 pt-1 pb-2.5">
                <p>Responsibility Center Code:</p>
                <p className="mx-3 mt-2 min-h-[1.4em] border-b border-black text-center font-bold">
                  {(submission.responsibilityCenterCode || "").trim() || " "}
                </p>
              </div>
            </td>
          </tr>

          {/* --- Column headings --- */}
          <tr>
            <th colSpan={2} scope="col" className="border-r-2 border-b border-black py-2 text-center font-normal">
              PARTICULARS
            </th>
            <th scope="col" className="border-b border-black py-2 text-center font-bold">
              AMOUNT
            </th>
          </tr>

          {/* --- Particulars: each amount sits on its description's last line --- */}
          {printableLines.map((line, idx) => (
            <tr key={line.id || idx}>
              <td colSpan={2} className="border-r-2 border-black px-2 pt-2 align-bottom font-bold">
                {line.description}
              </td>
              <td className="px-2 pt-2 text-right align-bottom font-bold tabular-nums">
                {amountText(Number(line.amount) || 0)}
              </td>
            </tr>
          ))}

          {/* COA closing rule - nothing may be added below this line. */}
          <tr>
            <td colSpan={2} className="border-r-2 border-black px-2 pb-1 text-center italic">
              -- NOTHING FOLLOWS ---
            </td>
            <td />
          </tr>
          <tr aria-hidden="true">
            <td colSpan={2} className="border-r-2 border-b-2 border-black" style={{ height: bodySpace }} />
            <td className="border-b-2 border-black" />
          </tr>

          {/* --- Totals --- */}
          <SheetTotalRow label="TOTAL AMOUNT SPENT" amount={<Amount value={totalSpent} />} />
          <SheetTotalRow
            label={
              <>
                AMOUNT OF CASH ADVANCE PER DV NO.{" "}
                <Fill value={submission.cashAdvanceDvNo} className="font-bold underline" /> DTD.{" "}
                <Fill value={sheetDate(submission.cashAdvanceDvDate)} className="font-bold underline" />
              </>
            }
            amount={<Amount value={totalReleased} />}
          />
          <SheetTotalRow
            label={
              <>
                AMOUNT REFUNDED PER OR NO. <Fill value={submission.refundOrNo} /> DTD.{" "}
                <Fill value={sheetDate(submission.refundOrDate)} />
              </>
            }
            amount={<Amount value={amountRefunded} />}
          />
          <SheetTotalRow label="AMOUNT TO BE REIMBURSED" amount={<Amount value={amountToReimburse} />} />

          {/* --- Certifications --- */}
          <tr>
            <CertificationCell
              letter="A"
              statement="Correctness of the above data"
              name={submission.employeeName}
              caption="Employee Name"
              signedAt={submission.dateSubmitted || submission.createdAt}
              className="border-r border-black"
            />
            {/* Box B is signed by the Financial Officer under delegated authority at RAB 1 -
                the form's "Representative". This is not a skipped approval. */}
            <CertificationCell
              letter="B"
              statement="Purpose of travel / cash advance duly accomplished"
              name={submission.divisionChiefApprovedBy}
              caption="Representative"
              signedAt={submission.divisionChiefApprovedAt}
              className="border-r-2 border-black"
            />
            <CertificationCell
              letter="C"
              statement="Supporting documents complete and proper"
              name={submission.financeValidatedBy}
              caption="Accountant III"
              signedAt={submission.financeValidatedAt}
              jevNo={submission.jevNo ?? ""}
            />
          </tr>
        </tbody>
      </table>
    </article>
  );
}
