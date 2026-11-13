// The Administrator's dashboard (12ag): what the calendar and the upcoming list say about a seminar
// (src/components/dashboard/schedule.ts), and the training budget's figures as the dashboard reads them
// (budgetRows.ts's budgetFigures). Pure functions, no data touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHIVED_TONE, dateRange, dayDiff, longDate, scheduleDetails, seatsText, seminarStanding, seminarTone, timeRange, whenText
} from "../src/components/dashboard/schedule";
import { allocatedLine, budgetFigures, percentOfTotal, returnedSplit, unallocatedLine } from "../src/components/dashboard/budgetRows";
import { compactPeso } from "../src/components/dashboard/chartFormat";
import type { CalendarSeminar } from "../src/trainingCalendar";
import { scheduleSeminars } from "../src/trainingSchedule";

const sem = (id: string, startDate: string, endDate: string, archived = false): CalendarSeminar => ({ id, title: id, startDate, endDate, fiscalYear: "2029", archived });

test("each seminar's time, venue and seats, from the schedule the server sends", () => {
  const schedule = scheduleSeminars(
    [
      { id: "a", startTime: "08:00", endTime: "17:00", venue: "  HSAC​  Hall ", maxParticipants: 4, startDate: "2026-11-11", endDate: "2026-11-11" },
      { id: "b", startTime: "8 AM", endTime: "25:00", venue: 42, maxParticipants: 0 },
      null, "not a seminar", { title: "no id" }
    ],
    [
      { trainingProgramId: "a", status: "Assigned" }, { trainingProgramId: "a", status: "Liquidated" },
      { trainingProgramId: "a", status: "Cancelled" }, { trainingProgramId: "a", status: "Archived" },
      { trainingProgramId: "b" }, null, { status: "Assigned" }
    ]
  );
  const details = scheduleDetails(schedule);
  assert.deepEqual(Object.keys(details).sort(), ["a", "b"]);
  assert.deepEqual({ ...details.a }, { startTime: "08:00", endTime: "17:00", venue: "HSAC Hall", seats: 4, filled: 2 }, "a cancelled or archived seat isn't filled");
  assert.deepEqual({ ...details.b }, { startTime: "", endTime: "", venue: "", seats: 1, filled: 1 }, "times that aren't times, a venue that isn't text, seats at least 1");
  assert.deepEqual(Object.keys(scheduleDetails([])), []);
  assert.equal(seatsText(details.a), "2 of 4 seats filled");
  assert.equal(seatsText({ seats: 1, filled: 0 }), "0 of 1 seat filled");
});

test("dates and times as the office writes them", () => {
  assert.equal(dateRange("2026-11-11", "2026-11-11"), "Nov 11, 2026");
  assert.equal(dateRange("2026-11-11", "2026-11-13"), "Nov 11–13, 2026");
  assert.equal(dateRange("2026-10-30", "2026-11-02"), "Oct 30 – Nov 2, 2026");
  assert.equal(dateRange("2026-12-30", "2027-01-02"), "Dec 30, 2026 – Jan 2, 2027");
  assert.equal(longDate("2026-11-25"), "Wednesday, November 25, 2026");
  assert.equal(timeRange("08:00", "17:00"), "8:00 AM – 5:00 PM");
  assert.equal(timeRange("12:30", "00:15"), "12:30 PM – 12:15 AM");
  assert.equal(timeRange("09:00", ""), "From 9:00 AM");
  assert.equal(timeRange("", ""), "");
  assert.equal(dayDiff("2026-12-31", "2027-01-01"), 1);
  assert.equal(dayDiff("2026-11-20", "2026-11-18"), -2);
});

test("where a seminar stands, and how far off it is", () => {
  const today = "2026-11-11";
  assert.equal(whenText(sem("x", "2026-11-18", "2026-11-20"), today), "Starts in 7 days");
  assert.equal(whenText(sem("x", "2026-11-12", "2026-11-12"), today), "Starts tomorrow");
  assert.equal(whenText(sem("x", "2026-11-11", "2026-11-11"), today), "Today only");
  assert.equal(whenText(sem("x", "2026-11-10", "2026-11-12"), today), "Day 2 of 3");
  assert.equal(whenText(sem("x", "2026-11-03", "2026-11-04"), today), "Ended Nov 4");
  assert.deepEqual(
    [sem("u", "2026-11-18", "2026-11-20"), sem("o", "2026-11-10", "2026-11-12"), sem("d", "2026-11-03", "2026-11-04"), sem("a", "2026-11-03", "2026-11-04", true)]
      .map((s) => seminarStanding(s, today)),
    ["upcoming", "ongoing", "done", "archived"]
  );
});

test("each seminar keeps its colour; an archived one is muted", () => {
  assert.deepEqual(seminarTone("prog-1"), seminarTone("prog-1"));
  assert.equal(seminarTone("prog-1", true), ARCHIVED_TONE);
  const tones = new Set(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((id) => seminarTone(id).bar));
  assert.ok(tones.size >= 3, "different seminars get different colours");
});

test("the budget's figures are the server's, and the sum shown adds up", () => {
  // Two seminars: one took ₱1,500 less than its ₱10,000 (returned), one ₱250.50 more than its ₱5,000 (over).
  const f = budgetFigures({
    totalBudget: 100000, carryOverBudget: 20000, newAnnualBudget: 80000, allocated: 15000, committed: 13750.5,
    remaining: 86249.5, returnedFromSettled: 1000, releasedForAbsent: 500, programCount: 2
  });
  assert.deepEqual(
    [f.total, f.carryOver, f.newAnnual, f.allocated, f.committed, f.unallocated, f.returned, f.over, f.seminars],
    [100000, 20000, 80000, 15000, 13750.5, 86249.5, 1500, 250.5, 2]
  );
  assert.equal(Math.round((f.total - f.allocated + f.returned - f.over) * 100) / 100, f.unallocated);
  // Seminars taking more than the budget: Unallocated is negative, and nothing is over unless a seminar is.
  const short = budgetFigures({ totalBudget: 1000, allocated: 3000, committed: 3000, remaining: -2000, returnedFromSettled: 0, releasedForAbsent: 0 });
  assert.deepEqual([short.unallocated, short.over, short.returned], [-2000, 0, 0]);
});

test("Allocated is what the seminars still hold: money they gave back leaves it, and the four screens say so alike", () => {
  // FY 2029 as the user saw it (2026-11-12): ₱102,400 in all, ₱14,200 allocated to 3 seminars, ₱1,800 back.
  const f = budgetFigures({
    totalBudget: 102400, allocated: 14200, committed: 12400, remaining: 90000,
    returnedFromSettled: 1300, releasedForAbsent: 500, programCount: 3
  });
  // Shown as Allocated: what they hold, which with Unallocated makes up the total.
  assert.equal(f.committed, 12400);
  assert.equal(f.committed + f.unallocated, f.total);
  assert.equal(allocatedLine(f, "2029"), "₱14,200.00 allocated to 3 seminars of FY 2029; ₱1,800.00 of it came back");
  assert.equal(percentOfTotal(f.committed, f.total), 12);
  // Nothing back and nothing over: the line just says where it went (the dashboard's wording before the change).
  assert.equal(allocatedLine({ allocated: 5000, returned: 0, over: 0, seminars: 1 }, "2029"), "To 1 seminar of FY 2029");
  assert.equal(allocatedLine({ allocated: 0, returned: 0, over: 0, seminars: 0 }), "To 0 seminars");
  // A seminar taking more than its allocation: named, beside what came back from another.
  assert.equal(
    allocatedLine({ allocated: 15000, returned: 1500, over: 250.5, seminars: 2 }, "2029"),
    "₱15,000.00 allocated to 2 seminars of FY 2029; ₱1,500.00 of it came back; ₱250.50 taken beyond allocations"
  );
  assert.equal(allocatedLine({ allocated: 3000, returned: 0, over: 200, seminars: 1 }), "₱3,000.00 allocated to 1 seminar; ₱200.00 taken beyond allocations");
  // A percent of no total is 0, never NaN or Infinity; rounded as the server rounds percentAllocated.
  assert.deepEqual([percentOfTotal(500, 0), percentOfTotal(0, 1000), percentOfTotal(125, 1000), percentOfTotal(3000, 1000)], [0, 0, 13, 300]);
});

test("an axis amount never reads as a thousand of the smaller unit", () => {
  assert.deepEqual(
    [0, 500, 999.995, 5000, 12_500, 999_949, 999_950, 1_200_000, -2500].map(compactPeso),
    ["₱0", "₱500", "₱1K", "₱5K", "₱12.5K", "₱999.9K", "₱1M", "₱1.2M", "-₱2.5K"]
  );
});

test("the line under Unallocated shows what came back added to it, adding up to the figure (2026-11-13)", () => {
  // The user's report: ₱65,000 total, ₱26,300 allocated, ₱1,000 back: Unallocated ₱39,700 already holds it.
  assert.equal(unallocatedLine({ unallocated: 39700, returned: 1000, over: 0 }), "₱38,700.00 left after HR's allocations + ₱1,000.00 returned");
  // Taken beyond allocations too: left + returned − over = Unallocated.
  assert.equal(unallocatedLine({ unallocated: 9000, returned: 500, over: 1500 }), "₱10,000.00 left after HR's allocations + ₱500.00 returned − ₱1,500.00 taken beyond allocations");
  assert.equal(unallocatedLine({ unallocated: 9000, returned: 0, over: 250 }), "₱9,250.00 left after HR's allocations − ₱250.00 taken beyond allocations");
  // Nothing back, nothing over: no line.
  assert.equal(unallocatedLine({ unallocated: 38700, returned: 0, over: 0 }), "");
  // Centavos: 0.1 + 0.2 style sums stay exact.
  assert.equal(unallocatedLine({ unallocated: 0.3, returned: 0.1, over: 0 }), "₱0.20 left after HR's allocations + ₱0.10 returned");
});

test("Finance's note on what came back: how much was handed back with an OR, and the rest (2026-11-13)", () => {
  assert.equal(returnedSplit(700, 1000), "₱700.00 of it handed back with an OR at validation; the rest from shares not claimed on reimbursements, not attended, or not spent");
  assert.equal(returnedSplit(700, 700), "Handed back with an OR at validation");
  assert.equal(returnedSplit(0, 300), "From shares not claimed on reimbursements, not attended, or not spent");
  assert.equal(returnedSplit(0, 0), "Nothing came back yet");
  // More handed back than came back: the budget's figure is net of the seminars' other costs, so no split (the code review).
  assert.equal(returnedSplit(700, 100), "Leftovers handed back and shares not claimed on reimbursements, not attended, or not spent, less the seminars' other costs");
  assert.equal(returnedSplit(0.1 + 0.2, 0.5), "₱0.30 of it handed back with an OR at validation; the rest from shares not claimed on reimbursements, not attended, or not spent");
});
