// "Also request a vehicle" on a seminar's cash advance request (HSAC RAB 1, 2026-10-26): what the
// vehicle request needs, as the seminar card and the server both check it (src/vehicleWithAdvance.ts),
// and the text cleaning it shares with names, OR and DV numbers and file names (src/inputText.ts).
// Pure functions, no data touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TRAVEL_DAYS, vehicleDraftFor, vehicleWithAdvanceFields } from "../src/vehicleWithAdvance";
import { cleanText, isCalendarDate, RAW_TEXT_MAX } from "../src/inputText";

const today = "2026-11-02";
const trip = {
  destination: "Baguio Convention Center", purpose: "To attend the seminar", passengers: "Ana Cruz, Ben Reyes",
  departureDate: "2026-11-05", departureTime: "06:00", arrivalDate: "2026-11-06", arrivalTime: "19:30"
};
const seminar = { startDate: "2026-11-05", endDate: "2026-11-06" };
const error = (raw: unknown, withSeminar?: typeof seminar) => {
  const r = vehicleWithAdvanceFields(raw, today, withSeminar);
  return "error" in r ? r.error : null;
};

test("a complete trip is accepted, cleaned, with the reservation date on the day of departure", () => {
  const r = vehicleWithAdvanceFields({ ...trip, destination: "  Baguio​   Convention\tCenter " }, today, seminar);
  assert.ok("fields" in r);
  assert.equal(r.fields.destination, "Baguio Convention Center", "spaces collapsed, an invisible character dropped");
  assert.equal(r.fields.dateNeeded, "2026-11-05");
  assert.deepEqual(Object.keys(r.fields).sort(), ["arrivalDate", "arrivalTime", "dateNeeded", "departureDate", "departureTime", "destination", "passengers", "purpose"]);
});

test("each text is required and has a limit", () => {
  assert.equal(error({ ...trip, destination: " " }), "Enter where the vehicle goes, up to 200 characters.");
  assert.equal(error({ ...trip, purpose: "x".repeat(301) }), "Enter the purpose of the trip, up to 300 characters.");
  assert.equal(error({ ...trip, passengers: "" }), "Enter the passengers, up to 500 characters.");
  assert.equal(error(null), "Fill in the vehicle request, or untick it.");
  assert.equal(error([trip]), "Fill in the vehicle request, or untick it.");
});

test("dates must be real, times HH:mm, departure not in the past, arrival after departure", () => {
  assert.equal(error({ ...trip, departureDate: "2026-02-30" }), "Enter the departure and arrival dates.");
  assert.equal(error({ ...trip, arrivalTime: "7:30 PM" }), "Enter the departure and arrival times.");
  assert.equal(error({ ...trip, departureTime: "" }), "Enter the departure and arrival times.", "the form leaves the times for the employee");
  assert.equal(error({ ...trip, departureDate: "2026-11-01" }), "The departure can't be in the past.");
  assert.equal(error({ ...trip, departureDate: today }), null, "leaving today is fine");
  assert.equal(error({ ...trip, arrivalDate: "2026-11-05", arrivalTime: "05:59" }), "The arrival has to be after the departure.");
  assert.equal(error({ ...trip, arrivalDate: "2026-11-05", arrivalTime: "06:00" }), "The arrival has to be after the departure.");
  assert.equal(error({ ...trip, arrivalDate: "2026-11-05", arrivalTime: "06:01" }), null, "a minute later is fine");
});

test(`the trip has to be for the seminar: leaving at most ${TRAVEL_DAYS} days before it, back at most ${TRAVEL_DAYS} days after`, () => {
  const window = "The trip has to be for the seminar (Nov 5, 2026 to Nov 6, 2026): leave no more than 2 days before it starts, and be back no more than 2 days after it ends.";
  assert.equal(error({ ...trip, departureDate: "2026-11-03" }, seminar), null, "two days before is fine");
  assert.equal(error({ ...trip, departureDate: "2026-11-02" }, seminar), window, "three days before isn't");
  assert.equal(error({ ...trip, arrivalDate: "2026-11-08" }, seminar), null, "back two days after is fine");
  assert.equal(error({ ...trip, arrivalDate: "2026-11-09" }, seminar), window, "three days after isn't");
  assert.equal(error({ ...trip, departureDate: "2026-11-07", arrivalDate: "2026-11-08" }, seminar), window, "leaving after it ended isn't");
  assert.equal(error({ ...trip, departureDate: "2026-11-03", arrivalDate: "2026-11-04" }, seminar), window, "back before it started isn't");
  assert.equal(error({ ...trip, departureDate: "2026-11-06", departureTime: "05:00", arrivalDate: "2026-11-06" }, seminar), null, "joining on its last day is fine");
  assert.match(String(error({ ...trip, departureDate: "2026-11-09", arrivalDate: "2026-11-10" }, { startDate: "2026-11-05", endDate: "" })),
    /^The trip has to be for the seminar \(Nov 5, 2026\):/, "a one-day seminar names its one day");
  assert.equal(error({ ...trip, departureDate: "2026-12-01", arrivalDate: "2026-12-02" }, { startDate: "", endDate: "" }), null, "without the seminar's dates the window isn't checked");
});

test("the form starts from the seminar: its venue, its days and who travels; the times are left blank", () => {
  const d = vehicleDraftFor({ title: " Records Management ", venue: "Baguio Convention Center", startDate: "2026-11-05", endDate: "2026-11-06" },
    ["Ana Cruz", " ", "Ben Reyes"]);
  assert.deepEqual(d, {
    destination: "Baguio Convention Center", purpose: 'To attend the seminar "Records Management"', passengers: "Ana Cruz, Ben Reyes",
    departureDate: "2026-11-05", departureTime: "", arrivalDate: "2026-11-06", arrivalTime: ""
  });
  assert.equal(vehicleDraftFor({ startDate: "2026-11-05" }, []).arrivalDate, "2026-11-05", "a one-day seminar returns the same day");
});

test("text is cleaned once, and huge input is refused before any work is done on it", () => {
  assert.equal(cleanText(42), "");
  assert.equal(cleanText("A ​ B"), "A B", "no double space where an invisible character was");
  assert.equal(cleanText("Juan\tDela\nCruz"), "Juan Dela Cruz");
  assert.equal(cleanText("x".repeat(RAW_TEXT_MAX)).length, RAW_TEXT_MAX, "up to the raw limit it is cleaned as usual");
  // U+FDFA becomes 18 characters when normalised: 3M of them took 8.6 s and ~1 GB before the limit.
  const huge = "ﷺ".repeat(3_000_000);
  const t0 = Date.now();
  assert.equal(cleanText(huge), "");
  assert.ok(Date.now() - t0 < 50, "refused at once");
  assert.equal(error({ ...trip, destination: huge }), "Enter where the vehicle goes, up to 200 characters.");
});

test("isCalendarDate takes only real dates", () => {
  assert.equal(isCalendarDate("2026-11-05"), true);
  assert.equal(isCalendarDate("2026-02-30"), false);
  assert.equal(isCalendarDate("2026-11-5"), false);
  assert.equal(isCalendarDate(20261105), false);
});
