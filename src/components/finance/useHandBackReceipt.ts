import { useState } from "react";
import type { LiquidationDocument, LiquidationSubmission } from "../../types";
import { orKey, readRefundOr } from "../../officialReceipt";
import { manilaDay } from "../../trainingCalendar";
import { formatCurrency } from "../../utils";
import type { HandBack, HandBackField, ValidateReceipt } from "./OrNumberFields";

const isOrScan = (d: LiquidationDocument | null | undefined) => !!d && d.kind === "refundOr" && !d.supersededAt && !!d.hasFile;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * The OR a report's View records when Finance validates it (12ai), and the server's checks on it before sending: its
 * number and date (src/officialReceipt.ts), and its scan, which is required under the named documents (R5) and for any
 * receipt Finance records in place of the one on the report, as the server requires (a scan already there is of another
 * receipt). A report filed before the named documents keeps its rule: its employee's OR stands without a scan.
 */
export function useHandBackReceipt(report: Partial<LiquidationSubmission>, leftover: number, canValidate: boolean) {
  const handsBack = canValidate && !!report.withinAdvance && leftover > 0;
  const scanOnFile = (report.supportingDocs ?? []).find(isOrScan) ?? null;
  const stored = { orNo: text(report.refundOrNo), orDate: text(report.refundOrDate) };
  const [handBack, setHandBack] = useState<HandBack>(() => ({ orNo: stored.orNo, orDate: stored.orDate || manilaDay(), scan: null }));
  const [invalid, setInvalid] = useState<HandBackField | null>(null);

  /** Why Validate can't go yet, and which box to fix, or null. */
  function check(): { problem: string; field: HandBackField } | null {
    if (!handsBack) return null;
    const read = readRefundOr({ orNo: handBack.orNo, orDate: handBack.orDate }, {
      today: manilaDay(), releasedOn: text(report.cashAdvanceDvDate), usedOn: () => null
    });
    if ("problem" in read) {
      return {
        problem: `Record the official receipt for the ${formatCurrency(leftover)} handed back. ${read.problem}`,
        field: /OR date/.test(read.problem) ? "date" : "no"
      };
    }
    const keptStored = !!stored.orNo && orKey(stored.orNo) === orKey(read.value.orNo) && stored.orDate === read.value.orDate;
    const named = Array.isArray(report.travelDeclarations);
    if (!handBack.scan && (!keptStored || (named && !scanOnFile))) {
      return {
        problem: !keptStored && stored.orNo && scanOnFile
          ? `Attach the scan of OR ${read.value.orNo}: the scan on the report is of the employee's OR ${stored.orNo}.`
          : "Attach the OR's scan (PDF, JPEG or PNG): it is one of the report's required documents.",
        field: "scan"
      };
    }
    return null;
  }

  /** What Validate sends. */
  const receipt = (): ValidateReceipt | undefined => handsBack
    ? { refundOrNo: handBack.orNo.trim(), refundOrDate: handBack.orDate, ...(handBack.scan ? { refundOrFile: handBack.scan } : {}) }
    : undefined;

  return { handsBack, scanOnFile, handBack, setHandBack, invalid, setInvalid, check, receipt };
}
