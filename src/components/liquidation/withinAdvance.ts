import { CashAdvance } from "../../types";
import { formatCurrency } from "../../utils";
import { LiquidationBalance, centavos } from "../../liquidationMoney";

/**
 * Why a seminar's liquidation report can't be submitted yet (the seminar budget flow), in the
 * server's terms, or "" when it can: the advance has to be released, the items listed and
 * within it, and a leftover needs its OR. The server checks all of it again.
 */
export function withinAdvanceSubmitProblem(form: {
  /** The advance Finance released for the seminar, if it is on record. */
  advance: CashAdvance | null;
  /** The seminar's current cash-advance record, e.g. a request still waiting. */
  current: CashAdvance | null;
  /** The advances couldn't be loaded, so whether one was released isn't known. */
  advancesFailed: boolean;
  /** Whether any item is filled in, and whether the items can still change (a correction). */
  hasItems: boolean;
  itemsEditable: boolean;
  balance: LiquidationBalance;
  itemsTotal: number;
  /** Whether the refund OR can still change (a correction), and what is typed in it. */
  orEditable: boolean;
  orNo: string;
  orDate: string;
  /** A group's report: what it may spend, the shares of those who attended (HSAC RAB 1). */
  spendCap?: number | null;
}): string {
  if (!form.advance) {
    if (form.advancesFailed) return "Your cash advance record couldn't be loaded, so this report can't be checked. Reload the page and try again.";
    return form.current?.status === "Requested"
      ? "Your cash advance request is still with Finance. File the report once it is released. If you paid for the seminar yourself, ask Finance to decline the request; you can then claim it back as a reimbursement."
      : "Request your cash advance first, under My Assigned Activities. This report settles the advance Finance releases.";
  }
  if (!form.hasItems && form.itemsEditable) return "Add at least one particular describing what the cash advance was spent on.";
  if (form.balance.status === "Over") {
    return `Your items come to ${formatCurrency(form.itemsTotal)}, ${formatCurrency(form.balance.over)} more than your cash advance. A seminar report can't go past its advance: lower or remove an item.`;
  }
  if (form.spendCap !== undefined && form.spendCap !== null && centavos(form.itemsTotal) > centavos(form.spendCap)) {
    return `Your group's items come to ${formatCurrency(form.itemsTotal)}, but only the shares of those who attended (${formatCurrency(form.spendCap)}) can be spent: an absent member's share is handed back with the rest. Lower or remove an item.`;
  }
  if (form.balance.leftover > 0 && form.orEditable && (!form.orNo.trim() || !form.orDate)) {
    return `${formatCurrency(form.balance.leftover)} of your cash advance is left. Hand it back to the cashier and enter the OR number and date on the sheet.`;
  }
  return "";
}
