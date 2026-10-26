// Finance's Overview Dashboard figures (src/components/finance/overviewFigures.ts): which fiscal
// year a report counts in, what each card counts, and money added up in centavos. Run with
// `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { latestReports, liquidatedByMonth, overviewFigures, reportFiscalYear, type OverviewReport } from "../src/components/finance/overviewFigures";

test("a seminar report counts in its seminar's fiscal year, even when filed in an earlier calendar year", () => {
  assert.equal(reportFiscalYear({ fiscalYear: "2027", createdAt: "2026-10-16T03:00:00.000Z" }), "2027");
});

test("a report with no seminar year counts in the year it was filed; older reports only have dateSubmitted", () => {
  assert.equal(reportFiscalYear({ createdAt: "2026-10-16T03:00:00.000Z" }), "2026");
  assert.equal(reportFiscalYear({ dateSubmitted: "2025-12-30" }), "2025");
  assert.equal(reportFiscalYear({ createdAt: "not a date", dateSubmitted: "2025-12-30" }), "2025");
  assert.equal(reportFiscalYear({}), "");
  assert.equal(reportFiscalYear(null), "");
});

test("the year filed is Manila's: 00:30 on 1 January is still 31 December in UTC", () => {
  assert.equal(reportFiscalYear({ createdAt: "2026-12-31T16:30:00.000Z" }), "2027"); // 1 Jan 2027, 00:30 in Manila
  assert.equal(reportFiscalYear({ createdAt: "2026-12-31T15:59:59.000Z" }), "2026"); // 31 Dec 2026, 23:59 in Manila
  assert.equal(reportFiscalYear({ dateSubmitted: "2027-01-01" }), "2027");           // a plain date is already local
});

const report = (over: Partial<OverviewReport>): OverviewReport => ({ id: Math.random().toString(36).slice(2), ...over });

test("open items count every year, as the Liquidation Desk's lists do", () => {
  const figures = overviewFigures([
    report({ status: "Verified & Forwarded", fiscalYear: "2026" }),
    report({ status: "Verified & Forwarded", fiscalYear: "2027" }),
    report({ status: "Returned", fiscalYear: "2027" }),
    report({ status: "Pending HR Review", fiscalYear: "2027" })
  ], [
    { status: "Requested", amount: 3000 },
    { status: "Released", amount: 2500.1 },
    { status: "Released", amount: 0.2 },
    { status: "Declined", amount: 3000 },
    { status: "Liquidated", amount: 5000 },
    { status: "Refunded", amount: 1000 }
  ], "2027");
  assert.equal(figures.toValidate, 2);
  assert.equal(figures.returned, 1);
  assert.equal(figures.advanceRequests, 1);
  assert.deepEqual(figures.advancesOut, { count: 2, amount: 2500.3 }); // in centavos: not 2500.2999999999997
});

test("a group cash advance counts once, for its whole amount (HSAC RAB 1: one advance for the group)", () => {
  const covers = [
    { participantId: "A", employeeId: "EMP008", employeeName: "A", amount: 2500 },
    { participantId: "B", employeeId: "EMP009", employeeName: "B", amount: 2500 },
    { participantId: "C", employeeId: "EMP010", employeeName: "C", amount: 2500 }
  ];
  const figures = overviewFigures([], [
    { status: "Requested", amount: 5000, covers: covers.slice(0, 2) },
    { status: "Released", amount: 7500, covers },
    { status: "Released", amount: 2500 }
  ] as any[], "2027");
  assert.equal(figures.advanceRequests, 1, "one request, though it covers two people");
  assert.deepEqual(figures.advancesOut, { count: 2, amount: 10000 }, "two advances out: the group's ₱7,500 and one person's ₱2,500");
});

test("reimbursements to pay are the Reimbursement Queue's: validated, awaiting, above zero", () => {
  const figures = overviewFigures([
    report({ status: "Completed", reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 0.1 }),
    report({ status: "Completed", reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 0.2 }),
    report({ status: "Verified & Forwarded", reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 900 }),
    report({ status: "Completed", reimbursementStatus: "Awaiting Reimbursement", reimbursementAmount: 0 }),
    report({ status: "Completed", reimbursementStatus: "Reimbursed", reimbursementAmount: 700 }),
    report({ status: "Completed", reimbursementStatus: "Not Required", reimbursementAmount: 0 })
  ], [], "2027");
  assert.deepEqual(figures.reimbursementsToPay, { count: 2, amount: 0.3 });
});

test("the year's totals: validated reports, their spending, leftovers handed back and reimbursements paid", () => {
  const figures = overviewFigures([
    report({ status: "Completed", fiscalYear: "2027", totalSpent: 4500.35, fundReturn: { amount: 499.65 } }),
    report({ status: "Completed", fiscalYear: "2027", totalSpent: 5300, reimbursementStatus: "Reimbursed", reimbursementAmount: 300 }),
    report({ status: "Returned", fiscalYear: "2027", totalSpent: 9999 }),
    report({ status: "Pending HR Review", fiscalYear: "2027" }),
    report({ status: "Verified & Forwarded", fiscalYear: "2027" }),
    report({ status: "Approved", fiscalYear: "2027" }),
    report({ status: "Completed", fiscalYear: "2026", totalSpent: 15000, fundReturn: { amount: 1 } }),
    report({ status: "Completed", createdAt: "2027-02-01T00:00:00.000Z", totalSpent: 100 })
  ], [], "2027");
  assert.equal(figures.year.filed, 7);
  assert.equal(figures.year.validated, 3);
  assert.equal(figures.year.liquidated, 9900.35);
  assert.equal(figures.year.leftoverReturned, 499.65);
  assert.equal(figures.year.reimbursed, 300);
  assert.deepEqual(figures.year.stages, { withHr: 1, withFinance: 1, validated: 3, returned: 1, other: 1 });
});

test("the latest reports are the year's five newest, newest first", () => {
  const reports = [1, 2, 3, 4, 5, 6, 7].map(d => report({ id: `r${d}`, fiscalYear: "2027", createdAt: `2026-10-0${d}T00:00:00.000Z` }));
  reports.push(report({ id: "other-year", fiscalYear: "2026", createdAt: "2026-10-09T00:00:00.000Z" }));
  reports.push(report({ id: "old", fiscalYear: "2027", dateSubmitted: "2026-10-08" }));
  const latest = overviewFigures(reports, [], "2027").year.latest.map(r => r.id);
  assert.deepEqual(latest, ["old", "r7", "r6", "r5", "r4"]);
});

test("liquidated per month: the last six Manila months, by when Finance validated, in centavos", () => {
  const now = new Date("2026-10-22T08:00:00.000Z"); // 22 Oct 2026, 4 PM in Manila
  const months = liquidatedByMonth([
    report({ status: "Completed", financeValidatedAt: "2026-09-25T06:30:00.000Z", totalSpent: 15000 }),
    report({ status: "Completed", financeValidatedAt: "2026-09-30T16:30:00.000Z", totalSpent: 0.1 }),   // 1 Oct, 00:30 in Manila
    report({ status: "Completed", financeValidatedAt: "2026-10-21T03:00:00.000Z", totalSpent: 0.2 }),
    report({ status: "Completed", financeValidatedAt: "2026-05-01T00:00:00.000Z", totalSpent: 50 }),
    report({ status: "Completed", financeValidatedAt: "2026-04-30T15:59:00.000Z", totalSpent: 999 }), // still April in Manila: out of range
    report({ status: "Completed", totalSpent: 777 }),                                               // no validation date
    report({ status: "Returned", financeValidatedAt: "2026-10-01T00:00:00.000Z", totalSpent: 888 })  // not validated
  ], 6, now);
  assert.deepEqual(months.map(m => m.key), ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(months.map(m => m.label), ["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
  assert.deepEqual(months.map(m => m.amount), [50, 0, 0, 0, 15000, 0.3]); // ₱0.10 + ₱0.20 is ₱0.30
  assert.deepEqual(months.map(m => m.count), [1, 0, 0, 0, 1, 2]);
  assert.deepEqual(months.map(m => m.current), [false, false, false, false, false, true]);
  assert.equal(months[5].fullLabel, "October 2026");
});

test("liquidated per month runs across the new year", () => {
  const months = liquidatedByMonth([], 6, new Date("2027-02-10T00:00:00.000Z"));
  assert.deepEqual(months.map(m => m.key), ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(months.map(m => m.fullLabel), ["September 2026", "October 2026", "November 2026", "December 2026", "January 2027", "February 2027"]);
});

test("latest reports: the newest few, newest first, ties in the server's order latest first", () => {
  const list = [
    report({ id: "a", createdAt: "2026-10-01T00:00:00.000Z" }),
    report({ id: "b", dateSubmitted: "2026-10-03" }),
    report({ id: "c", createdAt: "2026-10-02T00:00:00.000Z" }),
    report({ id: "d", createdAt: "2026-10-02T00:00:00.000Z" }),
    report({ id: "e" })
  ];
  assert.deepEqual(latestReports(list, 3).map(r => r.id), ["b", "d", "c"]);
  assert.deepEqual(latestReports(null, 3), []);
});

test("nothing belongs to a year until the year is known, and missing lists count as empty", () => {
  const figures = overviewFigures([report({ status: "Completed", fiscalYear: "2027", totalSpent: 10 })], null, "");
  assert.equal(figures.year.filed, 0);
  assert.equal(figures.year.liquidated, 0);
  assert.equal(overviewFigures(null, null, "2027").toValidate, 0);
});
