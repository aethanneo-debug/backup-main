// The training calendar's days and lanes (src/trainingCalendar.ts, 12ag). Pure functions, no data touched. Run with
// `npm test`. November 2026 starts on a Sunday, February 2026 is exactly four weeks, and August 2026 starts on a
// Saturday (six rows).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths, calendarSeminars, layoutMonth, manilaDay, monthWeeks, seminarDays, seminarTiming, seminarsOn, upcomingSeminars,
  type CalendarSeminar
} from "../src/trainingCalendar";

const sem = (id: string, startDate: string, endDate: string, extra: Partial<CalendarSeminar> = {}): CalendarSeminar =>
  ({ id, title: id.toUpperCase(), startDate, endDate, fiscalYear: "2029", archived: false, ...extra });

test("a month's grid runs Sunday to Saturday, from the week of its 1st to the week of its last day", () => {
  const nov = monthWeeks(2026, 11);
  assert.equal(nov.length, 5);
  assert.deepEqual([nov[0][0].date, nov[0][0].weekday, nov[0][0].inMonth], ["2026-11-01", 0, true]);
  assert.deepEqual([nov[4][6].date, nov[4][6].inMonth], ["2026-12-05", false]);
  assert.equal(monthWeeks(2026, 2).length, 4, "February 2026 starts on a Sunday and has 28 days");
  const aug = monthWeeks(2026, 8);
  assert.equal(aug.length, 6, "August 2026 starts on a Saturday");
  assert.deepEqual([aug[0][0].date, aug[0][6].date, aug[5][6].date], ["2026-07-26", "2026-08-01", "2026-09-05"]);
});

test("a seminar fills every day from its first to its last, weekends included", () => {
  assert.deepEqual(seminarDays({ startDate: "2026-11-11", endDate: "2026-11-13" }), ["2026-11-11", "2026-11-12", "2026-11-13"]);
  assert.equal(seminarDays({ startDate: "2026-11-13", endDate: "2026-11-16" }).length, 4, "Friday to Monday is 4 days");
  assert.deepEqual(seminarDays({ startDate: "2026-11-13", endDate: "2026-11-12" }), [], "the end before the start");
  assert.deepEqual(seminarDays({ startDate: "2026-02-30", endDate: "2026-03-01" }), [], "not a real date");
  assert.deepEqual(seminarDays({ startDate: "2026-01-01", endDate: "2027-01-03" }), [], "more than a year");
});

test("a 3-day seminar is one segment of 3 boxes in its week", () => {
  const weeks = layoutMonth([sem("a", "2026-11-11", "2026-11-13")], 2026, 11);
  assert.deepEqual(weeks[1].segments, [{ seminarId: "a", startCol: 3, endCol: 5, lane: 0, continuesBefore: false, continuesAfter: false }]);
  assert.equal(weeks.filter((w) => w.segments.length > 0).length, 1);
});

test("one crossing a weekend carries on into the next row, and one crossing a month into the next month", () => {
  const weekend = layoutMonth([sem("b", "2026-11-13", "2026-11-16")], 2026, 11);
  assert.deepEqual(weekend[1].segments[0], { seminarId: "b", startCol: 5, endCol: 6, lane: 0, continuesBefore: false, continuesAfter: true });
  assert.deepEqual(weekend[2].segments[0], { seminarId: "b", startCol: 0, endCol: 1, lane: 0, continuesBefore: true, continuesAfter: false });
  const across = sem("c", "2026-10-30", "2026-11-02");
  assert.deepEqual(layoutMonth([across], 2026, 10)[4].segments[0], { seminarId: "c", startCol: 5, endCol: 6, lane: 0, continuesBefore: false, continuesAfter: true });
  assert.deepEqual(layoutMonth([across], 2026, 11)[0].segments[0], { seminarId: "c", startCol: 0, endCol: 1, lane: 0, continuesBefore: true, continuesAfter: false });
  const long = layoutMonth([sem("d", "2026-11-01", "2026-11-30")], 2026, 11);
  assert.deepEqual(long[2].segments[0], { seminarId: "d", startCol: 0, endCol: 6, lane: 0, continuesBefore: true, continuesAfter: true });
});

test("overlapping seminars stack in lanes, and those past three are counted as more on their days", () => {
  const weeks = layoutMonth([
    sem("long", "2026-11-09", "2026-11-13"), sem("w1", "2026-11-11", "2026-11-11"), sem("w2", "2026-11-11", "2026-11-12"),
    sem("w3", "2026-11-11", "2026-11-11"), sem("after", "2026-11-12", "2026-11-12")
  ], 2026, 11);
  const row = weeks[1];
  assert.deepEqual(row.segments.map((s) => [s.seminarId, s.lane]), [["long", 0], ["w2", 1], ["w1", 2], ["after", 2]]);
  // w3 takes lane 3 (hidden) on Wednesday; "after" fits in lane 2 on Thursday, where w1 has ended.
  assert.deepEqual(row.hidden, [0, 0, 0, 1, 0, 0, 0]);
  assert.equal(layoutMonth([sem("x", "2026-11-11", "2026-11-11"), sem("after", "2026-11-12", "2026-11-12")], 2026, 11)[1].segments.length, 2);
});

test("the layout is the same whatever order the seminars come in", () => {
  const list = [sem("b", "2026-11-11", "2026-11-12"), sem("a", "2026-11-11", "2026-11-12"), sem("c", "2026-11-10", "2026-11-11")];
  assert.deepEqual(layoutMonth(list, 2026, 11), layoutMonth([...list].reverse(), 2026, 11));
});

test("the seminars a calendar shows: real dates, none archived before use, those archived after marked", () => {
  const got = calendarSeminars([
    { id: "p1", title: "  Records   Management ", startDate: "2026-11-11", endDate: "2026-11-13", fiscalYear: "2029" },
    { id: "p2", title: "Never held", startDate: "2026-11-11", endDate: "2026-11-11", archivedAt: "2026-11-01T00:00:00Z", archivedBeforeUse: true },
    { id: "p3", title: "Held, then archived", startDate: "2026-10-01", endDate: "2026-10-02", archivedAt: "2026-10-05T00:00:00Z", fiscalYear: 2028 },
    { id: "p4", title: "Bad dates", startDate: "2026-13-01", endDate: "2026-13-02" },
    null, "not a seminar", { title: "no id", startDate: "2026-11-11", endDate: "2026-11-11" }
  ]);
  assert.deepEqual(got, [
    { id: "p1", title: "Records Management", startDate: "2026-11-11", endDate: "2026-11-13", fiscalYear: "2029", archived: false },
    { id: "p3", title: "Held, then archived", startDate: "2026-10-01", endDate: "2026-10-02", fiscalYear: "2028", archived: true }
  ]);
  assert.deepEqual(calendarSeminars(undefined), []);
});

test("a title is shown cleaned and bounded, so an old one can't turn the text after it around or fill the screen", () => {
  // A title saved before titles were cleaned (12z Part C) may hold a direction override; one saved before 12x may be
  // any length. Each is cleaned like typed text and cut to the 300 characters a title has had room for since.
  const [bidi, long, none] = calendarSeminars([
    { id: "b", title: "Ethics ‮esruoc‬ Seminar", startDate: "2026-11-11", endDate: "2026-11-11" },
    { id: "l", title: "A".repeat(20_000), startDate: "2026-11-11", endDate: "2026-11-11" },
    { id: "n", title: { toString: 1 }, startDate: "2026-11-11", endDate: "2026-11-11", fiscalYear: { x: 1 } }
  ]);
  assert.equal(bidi.title, "Ethics esruoc Seminar");
  assert.equal(long.title, "A".repeat(300), "a long title is cut, not dropped as untitled");
  assert.deepEqual([none.title, none.fiscalYear], ["Untitled seminar", ""], "a title or year that isn't text is none");
});

test("upcoming and ongoing seminars, soonest first; a day's seminars; and the timing words", () => {
  const list = [sem("done", "2026-11-02", "2026-11-03"), sem("later", "2026-12-01", "2026-12-02"), sem("now", "2026-11-09", "2026-11-11"),
    sem("soon", "2026-11-20", "2026-11-20"), sem("old-archived", "2026-11-20", "2026-11-21", { archived: true })];
  assert.deepEqual(upcomingSeminars(list, "2026-11-10").map((s) => s.id), ["now", "soon", "later"]);
  assert.deepEqual(upcomingSeminars(list, "2026-11-10", 2).map((s) => s.id), ["now", "soon"]);
  // A day lists every seminar on it, archived ones too (the calendar shows them muted): same start, so by title.
  assert.deepEqual(seminarsOn(list, "2026-11-20").map((s) => s.id), ["old-archived", "soon"]);
  assert.deepEqual([seminarTiming(list[0], "2026-11-10"), seminarTiming(list[2], "2026-11-10"), seminarTiming(list[1], "2026-11-10")], ["done", "ongoing", "upcoming"]);
  assert.deepEqual([seminarTiming(list[2], "2026-11-09"), seminarTiming(list[2], "2026-11-11"), seminarTiming(list[2], "2026-11-12")], ["ongoing", "ongoing", "done"]);
});

test("month arithmetic and Manila's day", () => {
  assert.deepEqual(addMonths(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(addMonths(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(addMonths(2026, 11, -23), { year: 2024, month: 12 });
  // 16:30 UTC is already the next day in Manila (UTC+8).
  assert.equal(manilaDay(Date.UTC(2026, 10, 10, 16, 30)), "2026-11-11");
  assert.equal(manilaDay(Date.UTC(2026, 10, 10, 15, 59)), "2026-11-10");
});
