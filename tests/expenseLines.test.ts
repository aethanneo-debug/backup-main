// What a liquidation report's lines may be (src/expenseLines.ts): the instructor's review, R2 and R3.
// Pure functions, no data touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATTENDEE_EXPENSE_TYPES,
  expenseLineLabel,
  expenseLinesProblem,
  expenseTypeChoices,
  expenseTypeProblem,
  isBlankExpenseLine,
  isProgramOnlyExpense,
  keptExpenseType,
  vehicleOverlapsSeminar,
  vehicleNoForLine
} from "../src/expenseLines";
import { TRAINING_EXPENSE_CATEGORIES } from "../src/types";

const noVehicle = () => null;

test("every type an attendee can choose is a real expense type, Venue Rental and Speaker Fees aren't offered", () => {
  for (const t of ATTENDEE_EXPENSE_TYPES) assert.ok(TRAINING_EXPENSE_CATEGORIES.includes(t), t);
  assert.deepEqual(ATTENDEE_EXPENSE_TYPES, ["Registration Fee", "Meals", "Accommodation", "Transportation", "Materials", "Miscellaneous"]);
  assert.ok(isProgramOnlyExpense("Venue Rental"));
  assert.ok(isProgramOnlyExpense("Speaker Fees"));
  assert.ok(!isProgramOnlyExpense("Meals"));
});

test("a line goes by its stored description, else its type", () => {
  assert.equal(expenseLineLabel({ description: "Lunch, day 1", category: "Meals" }), "Lunch, day 1", "an older report");
  assert.equal(expenseLineLabel({ description: "", category: "Registration Fee" }), "Registration Fee");
  assert.equal(expenseLineLabel({ description: "   ", category: "Meals" }), "Meals");
  assert.equal(expenseLineLabel({}), "Miscellaneous", "the server's type for a line without one");
  assert.equal(expenseLineLabel(null), "Miscellaneous");
});

test("a row is blank only with no type, no amount and no description", () => {
  assert.ok(isBlankExpenseLine({ description: "", amount: 0 }));
  assert.ok(isBlankExpenseLine({}));
  assert.ok(!isBlankExpenseLine({ description: "", amount: 0, category: "Meals" }), "someone who spent nothing can still file a line");
  assert.ok(!isBlankExpenseLine({ description: "", amount: 100 }));
  assert.ok(!isBlankExpenseLine({ description: "Older line", amount: 0 }));
});

test("Transportation is refused while a vehicle request stands, and named when it is theirs to see", () => {
  assert.equal(expenseTypeProblem("Transportation", null), "");
  assert.equal(expenseTypeProblem("Transportation", undefined), "");
  assert.match(expenseTypeProblem("Transportation", "VRS-2026-10-001"), /vehicle request VRS-2026-10-001 stands.*Miscellaneous/);
  assert.match(expenseTypeProblem("Transportation", ""), /vehicle request stands/, "someone else's: that it stands, not its number");
  assert.equal(expenseTypeProblem("Meals", "VRS-2026-10-001"), "");
  assert.equal(expenseTypeProblem("Miscellaneous", "VRS-2026-10-001"), "", "small fares go here");
});

test("Venue Rental and Speaker Fees are HR's, on a report's new lines", () => {
  assert.match(expenseTypeProblem("Venue Rental", null), /whole seminar/);
  assert.match(expenseTypeProblem("Speaker Fees", null), /whole seminar/);
});

test("a line already on the report keeps its type, even one that couldn't be chosen today", () => {
  const stored = [
    { id: "a", description: "Bus fare", amount: 500, category: "Transportation" },
    { id: "b", description: "Hall", amount: 900, category: "Venue Rental" },
    { id: "c", description: "Filed before types existed", amount: 100 }
  ];
  const vehicle = () => "VRS-1";
  assert.ok(keptExpenseType({ id: "a", category: "Transportation", amount: 450 }, stored), "its amount may change");
  assert.ok(keptExpenseType({ id: "c" }, stored), "no type then, none now");
  assert.ok(keptExpenseType({ id: "c", category: "Miscellaneous" }, stored), "the server's own fallback");
  assert.ok(!keptExpenseType({ id: "a", category: "Meals" }, stored), "a changed type is a new choice");
  assert.ok(!keptExpenseType({ id: "new", category: "Transportation" }, stored), "a new line");
  assert.equal(expenseLinesProblem([{ id: "a", category: "Transportation" }, { id: "b", category: "Venue Rental" }], stored, vehicle), "");
  assert.match(expenseLinesProblem([{ id: "a", category: "Transportation" }, { id: "new", category: "Transportation" }], stored, vehicle), /Transportation can't/);
  assert.match(expenseLinesProblem([{ id: "c", category: "Speaker Fees" }], stored, noVehicle), /whole seminar/, "changed to a type HR records");
});

test("on a group's report, each line is checked against whom it is for", () => {
  const lines = [{ id: "1", category: "Transportation", participantId: "seat-b" }, { id: "2", category: "Transportation" }];
  const asked: Array<string | undefined> = [];
  const bOnly = (who?: string) => { asked.push(who); return who === "seat-b" ? "" : null; };
  assert.match(expenseLinesProblem(lines, [], bOnly), /vehicle request stands/);
  assert.deepEqual(asked, ["seat-b"]);
  assert.equal(expenseLinesProblem([lines[1]], [], bOnly), "", "a line naming nobody is the holder's, who has no vehicle");
});

test("the dropdown leaves out Transportation while a vehicle request stands, but always shows the line's own type", () => {
  assert.deepEqual(expenseTypeChoices(undefined, null), ATTENDEE_EXPENSE_TYPES);
  assert.ok(!expenseTypeChoices(undefined, "VRS-1").includes("Transportation"));
  assert.ok(!expenseTypeChoices("Meals", "").includes("Transportation"), "a vehicle whose number isn't shown still counts");
  assert.ok(expenseTypeChoices("Transportation", "VRS-1").includes("Transportation"), "an older line keeps showing it");
  assert.ok(expenseTypeChoices("Venue Rental", null).includes("Venue Rental"), "an older line keeps showing it");
  assert.equal(expenseTypeChoices("Meals", null).filter(t => t === "Meals").length, 1);
});

test("a kept line moved to someone else is a new claim, so it is checked again", () => {
  const stored = [{ id: "a", amount: 500, category: "Transportation" }, { id: "b", amount: 200, category: "Transportation", participantId: "seat-m" }];
  assert.ok(keptExpenseType({ id: "a", category: "Transportation" }, stored), "the group's line stays the group's");
  assert.ok(keptExpenseType({ id: "b", category: "Transportation", participantId: "seat-m" }, stored), "the same person");
  assert.ok(!keptExpenseType({ id: "a", category: "Transportation", participantId: "seat-m" }, stored), "moved to a member");
  assert.ok(!keptExpenseType({ id: "b", category: "Transportation" }, stored), "moved back to the group");
  const memberOnVehicle = (who?: string) => (who === "seat-m" ? "" : null);
  assert.match(expenseLinesProblem([{ id: "a", category: "Transportation", participantId: "seat-m" }], stored, memberOnVehicle), /vehicle request stands/);
});

test("a type the system doesn't know isn't a type: the row is blank, as the server treats it", () => {
  assert.ok(isBlankExpenseLine({ description: "", amount: 0, category: "Foo" }));
  assert.ok(isBlankExpenseLine({ amount: 0, category: "meals" }), "the list is matched exactly");
  assert.ok(!isBlankExpenseLine({ amount: 0, category: "Registration Fee" }));
  assert.ok(!isBlankExpenseLine({ amount: 5, category: "Foo" }), "an amount is still a line");
});

test("only Transportation asks which vehicle stands: the lookup reads every vehicle request", () => {
  let asked = 0;
  const count = () => { asked++; return null; };
  expenseLinesProblem([{ id: "1", category: "Meals" }, { id: "2", category: "Miscellaneous" }, { id: "3" }], [], count);
  assert.equal(asked, 0);
  expenseLinesProblem([{ id: "1", category: "Transportation" }], [], count);
  assert.equal(asked, 1);
});

test("on the form, a line goes by the vehicle of whom it names, else the claimant's", () => {
  const attendees = [{ participantId: "seat-a", onVehicle: false }, { participantId: "seat-b", onVehicle: true }];
  assert.equal(vehicleNoForLine({}, "VRS-1", attendees), "VRS-1", "a line for the group is the claimant's");
  assert.equal(vehicleNoForLine({ participantId: "seat-a" }, "VRS-1", attendees), null, "a named attendee with none");
  assert.equal(vehicleNoForLine({ participantId: "seat-b" }, null, attendees), "", "their number isn't known here");
  assert.equal(vehicleNoForLine({}, null, undefined), null);
  assert.equal(vehicleNoForLine({ participantId: "gone" }, "VRS-1", attendees), "VRS-1", "someone no longer listed");
});

test("an ordinary vehicle request counts for a seminar when its trip overlaps the seminar's dates", () => {
  const seminar = { startDate: "2026-11-20", endDate: "2026-11-21" };
  assert.ok(vehicleOverlapsSeminar({ departureDate: "2026-11-20", arrivalDate: "2026-11-20" }, seminar));
  assert.ok(vehicleOverlapsSeminar({ departureDate: "2026-11-19", arrivalDate: "2026-11-22" }, seminar), "a trip around it");
  assert.ok(vehicleOverlapsSeminar({ departureDate: "2026-11-21", arrivalDate: "2026-11-23" }, seminar), "its last day");
  assert.ok(vehicleOverlapsSeminar({ dateNeeded: "2026-11-20" }, seminar), "an older request with one date");
  assert.ok(vehicleOverlapsSeminar({ departureDate: "2026-11-20" }, { startDate: "2026-11-20" }), "a one-day seminar with no end date");
  assert.ok(!vehicleOverlapsSeminar({ departureDate: "2026-11-18", arrivalDate: "2026-11-19" }, seminar), "back before it starts");
  assert.ok(!vehicleOverlapsSeminar({ departureDate: "2026-11-22", arrivalDate: "2026-11-22" }, seminar), "leaving after it ends");
  assert.ok(!vehicleOverlapsSeminar({}, seminar), "no dates");
  assert.ok(!vehicleOverlapsSeminar({ dateNeeded: "next week" }, seminar), "not a date");
  assert.ok(!vehicleOverlapsSeminar({ dateNeeded: "2026-11-20" }, {}), "a seminar with no dates");
});
