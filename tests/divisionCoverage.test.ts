// "Someone must stay to man the division" (HSAC RAB 1's answer 1, 2026-10-26): the rule the server
// enforces and the participant picker warns with (src/divisionCoverage.ts). Pure functions, no data
// touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addedGaps, datesText, divisionGaps, gapText, seminarWeekdays } from "../src/divisionCoverage";

// November 2026: the 6th is a Friday, the 7th and 8th a weekend, the 9th a Monday.
const nowhere = () => false;
const staff = [
  { id: "a", division: "Legal Division" }, { id: "b", division: "Legal Division" },
  { id: "c", division: "Office of the Chief" },
  { id: "d", division: "Adjudication Division" }, { id: "e", division: "Adjudication Division" }, { id: "f", division: "Adjudication Division" },
  { id: "g", division: "  " }
];

test("a seminar's days are its weekdays: weekends need nobody at the office", () => {
  assert.deepEqual(seminarWeekdays("2026-11-05", "2026-11-10"), ["2026-11-05", "2026-11-06", "2026-11-09", "2026-11-10"]);
  assert.deepEqual(seminarWeekdays("2026-11-07", "2026-11-08"), [], "a weekend seminar leaves every division staffed");
  assert.deepEqual(seminarWeekdays("2026-11-05", ""), ["2026-11-05"], "no end date: the one day");
  assert.deepEqual(seminarWeekdays("2026-11-10", "2026-11-05"), [], "an end before the start: no days");
  assert.deepEqual(seminarWeekdays("2026-02-30", "2026-03-02"), [], "not a real date: no days");
  assert.ok(seminarWeekdays("2026-01-01", "2036-01-01").length <= 262, "a mistyped end date is cut at a year");
});

test("a one-person division is empty whenever its one member goes", () => {
  assert.deepEqual(divisionGaps(staff, ["2026-11-05"], ["c"], nowhere), [{ division: "Office of the Chief", dates: ["2026-11-05"] }]);
});

test("a two-person division is empty only when both are away, here or at another seminar that day", () => {
  assert.deepEqual(divisionGaps(staff, ["2026-11-05", "2026-11-06"], ["a"], nowhere), [], "one stays");
  assert.deepEqual(divisionGaps(staff, ["2026-11-05", "2026-11-06"], ["a", "b"], nowhere),
    [{ division: "Legal Division", dates: ["2026-11-05", "2026-11-06"] }], "both go");
  const bElsewhereOnThe6th = (id: string, date: string) => id === "b" && date === "2026-11-06";
  assert.deepEqual(divisionGaps(staff, ["2026-11-05", "2026-11-06"], ["a"], bElsewhereOnThe6th),
    [{ division: "Legal Division", dates: ["2026-11-06"] }], "the other is at an overlapping seminar on one of the days");
});

test("only divisions this seminar takes someone from count", () => {
  const legalAllAway = (id: string) => id === "a" || id === "b";
  assert.deepEqual(divisionGaps(staff, ["2026-11-05"], ["d"], legalAllAway), [], "Legal is emptied by other seminars, not this one");
  assert.deepEqual(divisionGaps(staff, ["2026-11-05"], ["d", "e", "f", "a"], nowhere),
    [{ division: "Adjudication Division", dates: ["2026-11-05"] }], "people count once per division; staff with no division are left out");
  assert.deepEqual(divisionGaps(staff, ["2026-11-05"], ["g"], nowhere), [], "someone with no division empties nothing");
  // Legal is already empty on the 5th (both at another seminar); on the 6th only b is.
  const legalBooked = (id: string, date: string) => (id === "a" || id === "b") && date === "2026-11-05" || id === "b" && date === "2026-11-06";
  assert.deepEqual(divisionGaps(staff, ["2026-11-05", "2026-11-06"], ["a"], legalBooked), [{ division: "Legal Division", dates: ["2026-11-06"] }],
    "taking someone already booked elsewhere doesn't make an empty day this seminar's; the 6th is, since a would have stayed");
});

test("a change is judged by the gaps it adds", () => {
  const before = [{ division: "Legal Division", dates: ["2026-11-05"] }];
  assert.deepEqual(addedGaps(before, [{ division: "Legal Division", dates: ["2026-11-05", "2026-11-06"] }]), [{ division: "Legal Division", dates: ["2026-11-06"] }]);
  assert.deepEqual(addedGaps(before, before), [], "re-saving a seminar with a gap already confirmed adds nothing");
  assert.deepEqual(addedGaps([], [{ division: "Office of the Chief", dates: ["2026-11-09"] }]), [{ division: "Office of the Chief", dates: ["2026-11-09"] }]);
});

test("the days are named as runs", () => {
  assert.equal(datesText(["2026-11-06", "2026-11-05"]), "Nov 5–6, 2026");
  assert.equal(datesText(["2026-11-06", "2026-11-09"]), "Nov 6 and Nov 9, 2026", "a weekend breaks the run");
  assert.equal(datesText(["2026-11-03", "2026-11-05", "2026-11-06", "2026-11-09"]), "Nov 3, Nov 5–6 and Nov 9, 2026");
  assert.equal(datesText(["2026-09-30", "2026-10-01"]), "Sep 30 – Oct 1, 2026");
  assert.equal(datesText(["2026-12-31", "2027-01-01"]), "Dec 31, 2026 – Jan 1, 2027");
  assert.equal(datesText(["2026-12-30", "2027-01-04"]), "Dec 30, 2026 and Jan 4, 2027");
  assert.equal(gapText([{ division: "Legal Division", dates: ["2026-11-05", "2026-11-06"] }, { division: "Office of the Chief", dates: ["2026-11-09"] }]),
    "Legal Division on Nov 5–6, 2026; Office of the Chief on Nov 9, 2026");
});
