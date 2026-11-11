// The Administrator's dashboard (12ag): what the calendar and the upcoming list say about a seminar
// (src/components/dashboard/schedule.ts), and the training budget's figures as the dashboard reads them
// (budgetRows.ts's budgetFigures). Pure functions, no data touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHIVED_TONE, dateRange, dayDiff, longDate, scheduleDetails, seatsText, seminarStanding, seminarTone, timeRange, whenText
} from "../src/components/dashboard/schedule";
import { budgetFigures } from "../src/components/dashboard/budgetRows";
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

test("an axis amount never reads as a thousand of the smaller unit", () => {
  assert.deepEqual(
    [0, 500, 999.995, 5000, 12_500, 999_949, 999_950, 1_200_000, -2500].map(compactPeso),
    ["₱0", "₱500", "₱1K", "₱5K", "₱12.5K", "₱999.9K", "₱1M", "₱1.2M", "-₱2.5K"]
  );
});
