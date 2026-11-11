// The training schedule the dashboards read (src/trainingSchedule.ts, GET /api/training/schedule, 12ag) and the budget
// chart's rows taken from it (src/components/dashboard/budgetRows.ts). Pure functions, no data touched. Run with
// `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readSchedule, scheduleSeminars } from "../src/trainingSchedule";
import { seminarBudget } from "../src/trainingBudget";
import { seminarBudgetRows } from "../src/components/dashboard/budgetRows";

const programs = [
  { id: "b", title: "Ethics  Seminar", fiscalYear: "2029", allocatedBudget: 6000, maxParticipants: 3, usedBudget: 0, startDate: "2026-11-20", endDate: "2026-11-21",
    startTime: "08:00", endTime: "17:00", venue: "  HSAC​  Hall ", tdpException: { reason: "never sent" } },
  { id: "a", title: "Records Management", fiscalYear: 2029, allocatedBudget: 8000, maxParticipants: 4, usedBudget: 0, startDate: "2026-11-11", endDate: "2026-11-13", startTime: "8 AM" },
  { id: "old", title: "Last year's", fiscalYear: "2028", allocatedBudget: 5000, maxParticipants: 1, startDate: "2026-01-10", endDate: "2026-01-10", archivedAt: "2026-01-20T00:00:00Z" },
  { id: "never", title: "Never held", fiscalYear: "2029", allocatedBudget: 9000, maxParticipants: 1, archivedAt: "2026-11-01T00:00:00Z", archivedBeforeUse: true },
  { id: "nodates", title: { toString: 1 }, fiscalYear: { x: 1 }, allocatedBudget: 1000, maxParticipants: 0, startDate: "2026-13-01", endDate: "2026-13-02" },
  null, "not a seminar", { title: "no id" }
];
const seat = (id: string, trainingProgramId: string, attendance?: string, status = "Assigned") =>
  ({ id, trainingProgramId, status, attendance, tdpException: { reason: "private" } });
const enrolments = [
  seat("a1", "a", "Attended"), seat("a2", "a", "Attended"), seat("a3", "a", "Attended"), seat("a4", "a", "Attended"),
  seat("b1", "b", "Attended"), seat("b2", "b", "Did not attend"), seat("b3", "b", undefined, "Cancelled"),
  null, { status: "Assigned" }
];

test("each seminar but one archived before use, priced as the training budget prices it, and nothing more", () => {
  const rows = scheduleSeminars(programs, enrolments);
  assert.deepEqual(rows.map((r) => r.id), ["b", "a", "old", "nodates"]);
  const [b, a, old, nodates] = rows;
  assert.deepEqual(b, {
    id: "b", title: "Ethics Seminar", fiscalYear: "2029", startDate: "2026-11-20", endDate: "2026-11-21", startTime: "08:00", endTime: "17:00",
    venue: "HSAC Hall", seats: 3, filled: 2, archived: false, allocated: 6000, committed: 4000, spent: 0, returned: 2000
  }, "a cancelled seat isn't filled; a non-attendee's share (₱2,000 of ₱6,000 for 3 seats) went back; no justification travels");
  assert.deepEqual([a.fiscalYear, a.startTime, a.filled, a.committed, a.returned], ["2029", "", 4, 8000, 0], "a numeric year reads as text; a time that isn't HH:MM is none");
  assert.deepEqual([old.archived, old.fiscalYear], [true, "2028"]);
  assert.deepEqual([nodates.title, nodates.fiscalYear, nodates.startDate, nodates.endDate, nodates.seats], ["Untitled seminar", "", "", "", 1],
    "a title or year that isn't text, dates that aren't real, and no seats read as none (at least one seat)");
  // Each figure is seminarBudget's own, so the chart agrees with Programs & Budget and Budget Monitoring.
  for (const r of rows) {
    const p = programs.find((x: any) => x && x.id === r.id) as any;
    const sb = seminarBudget(p, enrolments.filter(Boolean) as any);
    assert.deepEqual([r.allocated, r.committed, r.spent, r.returned], [sb.allocated, sb.committed, sb.spent, Math.round((sb.returned + sb.released) * 100) / 100]);
  }
  assert.deepEqual(scheduleSeminars(undefined, enrolments), []);
  assert.deepEqual(scheduleSeminars(programs, undefined).map((r) => r.filled), [0, 0, 0, 0]);
});

test("the browser reads the schedule again, so a damaged answer can't break a calendar", () => {
  const good = scheduleSeminars(programs, enrolments);
  assert.deepEqual(readSchedule(good), good, "the server's rows read back unchanged");
  const [r] = readSchedule([
    { id: "x", title: 42, fiscalYear: null, startDate: "2026-11-20", endDate: "2026-11-19", startTime: "25:00", venue: { a: 1 },
      seats: "3", filled: -2, archived: "yes", allocated: "100", committed: Infinity, spent: null, returned: 5.555 },
    { title: "no id" }, null, "row"
  ]);
  assert.deepEqual(r, {
    id: "x", title: "Untitled seminar", fiscalYear: "", startDate: "", endDate: "", startTime: "", endTime: "", venue: "",
    seats: 1, filled: 0, archived: false, allocated: 0, committed: 0, spent: 0, returned: 5.56
  });
  assert.deepEqual(readSchedule({ not: "a list" }), []);
});

test("the budget chart takes the year's seminars from the schedule, earliest first, those without dates last", () => {
  const rows = scheduleSeminars(programs, enrolments);
  assert.deepEqual(seminarBudgetRows(rows, "2029").map((r) => r.id), ["a", "b"]);
  assert.deepEqual(seminarBudgetRows(rows, "2028").map((r) => r.id), ["old"]);
  assert.deepEqual(seminarBudgetRows(rows, ""), []);
  const undated = [{ ...rows[0], id: "z", startDate: "", endDate: "" }, ...rows];
  assert.deepEqual(seminarBudgetRows(undated, "2029").map((r) => r.id), ["a", "b", "z"]);
});
