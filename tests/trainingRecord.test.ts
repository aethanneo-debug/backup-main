// A training HR records, and HR's review of one (the instructor's review, R11; known-issues 12r). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readTrainingRecord, readTrainingReview, recordCounts, TRAINING_TITLE_MAX } from "../src/trainingRecord";

const TODAY = "2026-11-03";
const good = { title: "  Records   Management ", organizer: "CSC", dateConducted: "2026-05-10", trainingHours: "16.5", certificateFilename: "cert.pdf" };
const problem = (over: Record<string, unknown>) => {
  const r = readTrainingRecord({ ...good, ...over }, TODAY);
  return "problem" in r ? r.problem : null;
};

test("a record as it will be stored: text cleaned, hours a number", () => {
  assert.deepEqual(readTrainingRecord(good, TODAY), { title: "Records Management", organizer: "CSC", dateConducted: "2026-05-10", trainingHours: 16.5, certificateFilename: "cert.pdf" });
  assert.deepEqual(readTrainingRecord({ ...good, trainingHours: 8 }, TODAY), { title: "Records Management", organizer: "CSC", dateConducted: "2026-05-10", trainingHours: 8, certificateFilename: "cert.pdf" });
});

test("whether a record counts: not once HR returned it, nor if it was rejected", () => {
  assert.equal(recordCounts({ status: "Verified" }), true);
  assert.equal(recordCounts({ status: "Pending Verification" }), true);
  assert.equal(recordCounts({}), true, "older records have no status, and count");
  assert.equal(recordCounts({ status: "Returned" }), false);
  assert.equal(recordCounts({ status: "Rejected" }), false);
  assert.equal(recordCounts(null), false);
});

test("no certificate is invented when none is named", () => {
  const r = readTrainingRecord({ ...good, certificateFilename: undefined }, TODAY);
  assert.equal("problem" in r ? null : r.certificateFilename, "");
});

test("the title and organizer are required text, within their limits", () => {
  assert.match(problem({ title: "   " })!, /title/);
  assert.match(problem({ title: { x: 1 } })!, /title/);
  assert.match(problem({ title: "x".repeat(TRAINING_TITLE_MAX + 1) })!, /at most 300/);
  assert.equal(problem({ title: "x".repeat(TRAINING_TITLE_MAX) }), null);
  assert.match(problem({ organizer: "" })!, /agency/);
  assert.match(problem({ organizer: "x".repeat(201) })!, /at most 200/);
  assert.match(problem({ certificateFilename: "x".repeat(201) })!, /at most 200/);
  assert.match(problem({ certificateFilename: "x".repeat(5000) })!, /at most 200/, "too long to read isn't dropped without a word");
});

test("the date is a real one, no later than today and not before 1950", () => {
  assert.match(problem({ dateConducted: "" })!, /date/);
  assert.match(problem({ dateConducted: "2026-02-30" })!, /date/);
  assert.match(problem({ dateConducted: "05/10/2026" })!, /date/);
  assert.match(problem({ dateConducted: 20260510 })!, /date/);
  assert.match(problem({ dateConducted: "0001-01-01" })!, /date/);
  assert.match(problem({ dateConducted: "1949-12-31" })!, /date/);
  assert.equal(problem({ dateConducted: "1950-01-01" }), null);
  assert.match(problem({ dateConducted: "2026-11-04" })!, /future/);
  assert.equal(problem({ dateConducted: TODAY }), null);
});

test("the hours are digits with up to 2 decimals, above 0: no default of 8, and nothing that merely converts to a number", () => {
  for (const trainingHours of [undefined, "", "  ", 0, -1, "abc", NaN, Infinity, 1001, true, [8], { h: 8 }, "0x10", "1e3", "0.004", "8.125", "0.00", " 8 h"]) {
    assert.match(problem({ trainingHours })!, /credit hours/, JSON.stringify(trainingHours));
  }
  assert.equal(problem({ trainingHours: 1000 }), null);
  assert.equal(problem({ trainingHours: "0.5" }), null);
  assert.equal(problem({ trainingHours: "0.01" }), null);
  assert.equal(problem({ trainingHours: " 12 " }), null);
});

test("not an object at all", () => {
  for (const raw of [null, undefined, "x", 5]) assert.match((readTrainingRecord(raw, TODAY) as { problem: string }).problem, /title/);
});

test("a review verifies, with remarks optional, or returns, with the reason required", () => {
  assert.deepEqual(readTrainingReview({ status: "Verified" }), { status: "Verified", remarks: "" });
  assert.deepEqual(readTrainingReview({ status: "Verified", remarks: " fine " }), { status: "Verified", remarks: "fine" });
  assert.deepEqual(readTrainingReview({ status: "Returned", remarks: "Wrong date" }), { status: "Returned", remarks: "Wrong date" });
  assert.match((readTrainingReview({ status: "Returned", remarks: " ​ " }) as { problem: string }).problem, /why/, "invisible characters aren't a reason");
  assert.match((readTrainingReview({ status: "Returned" }) as { problem: string }).problem, /why/);
  assert.match((readTrainingReview({ status: "Verified", remarks: "x".repeat(501) }) as { problem: string }).problem, /at most 500/);
  for (const status of ["Rejected", "Pending Verification", undefined, 1]) {
    assert.match((readTrainingReview({ status, remarks: "x" }) as { problem: string }).problem, /verifies/);
  }
  assert.match((readTrainingReview(null) as { problem: string }).problem, /verifies/);
});
