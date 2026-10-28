// Who the TDP identifies for a seminar, and what a justification for anyone else must hold (HSAC
// RAB 1's answer of 2026-10-28; src/tdpRules.ts). Pure functions, no data touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { coveredNeeds, normalizeTitle, readTdpJustification, seatsNeedingJustification, tdpBadgeText, tdpKindText, tdpStanding } from "../src/tdpRules";

const needs = [
  { employeeId: "emp-4", fiscalYear: "2027", title: "Legal Ethics", category: "Function" },
  { employeeId: "EMP010", fiscalYear: "2027", title: "Seminar on  LEGAL ethics!", category: "Function" },
  { employeeId: "emp-4", fiscalYear: "2026", title: "Values Orientation Workshop", category: "Function" },
  { employeeId: "emp-9", fiscalYear: "2027", title: "Legal Ethics and Professional Responsibility", category: "Career Advancement" }
];
const legalEthics = { fiscalYear: "2027", fulfillsNeedTitles: ["legal ethics"] };
const today = "2026-10-28";
const valid = { kind: "Identified by the Chief", reason: "Representative while the accountant is on leave", identifiedBy: { name: "Test Officer", position: "Chief Administrative Officer" } };

test("titles are matched by letters and digits only, and a title that isn't text is none", () => {
  assert.equal(normalizeTitle("  Legal  ETHICS (RA 6713)! "), "legal ethics ra 6713");
  assert.equal(normalizeTitle(12345), "");
  assert.equal(normalizeTitle({}), "");
});

test("the TDP identifies someone whose own Plan A for the seminar's year lists a need it covers", () => {
  assert.deepEqual(coveredNeeds(needs, ["emp-4", "EMP004"], legalEthics).map(n => n.title), ["Legal Ethics"]);
  assert.deepEqual(coveredNeeds(needs, ["emp-10", "EMP010"], { fiscalYear: "2027", fulfillsNeedTitles: ["seminar on legal ethics"] }).length, 1,
    "an entry stored under the staff code counts");
  assert.deepEqual(coveredNeeds(needs, ["emp-4"], { fiscalYear: "2028", fulfillsNeedTitles: ["Legal Ethics"] }), [], "another year's plan doesn't count");
  assert.deepEqual(coveredNeeds(needs, ["emp-9"], legalEthics), [], "a longer title is another training: the match is exact");
  assert.deepEqual(coveredNeeds(needs, ["emp-4"], { fiscalYear: "2027" }), [], "a seminar that covers no need identifies nobody");
  assert.deepEqual(coveredNeeds(needs, ["emp-77"], legalEthics), [], "someone with no plan entries isn't identified");
});

test("an enrolment's standing: identified, justified, from before the rule, or missing a justification", () => {
  assert.equal(tdpStanding({ identified: true }), "identified");
  assert.equal(tdpStanding({ identified: true, tdpException: { kind: "Other" } }), "identified", "identified wins over a justification");
  assert.equal(tdpStanding({ identified: false, tdpException: { kind: "Other" } }), "justified");
  assert.equal(tdpStanding({ identified: false }), "beforeRule", "no assignedAt: made before the rule");
  assert.equal(tdpStanding({ identified: false, assignedAt: "2026-10-29T01:00:00Z" }), "missing");
});

test("a save is held only to what it adds: the seats it makes, and those it turns outside the TDP", () => {
  const seat = (o: object) => ({ id: "x", newSeat: false, identifiedBefore: false, identifiedAfter: false, justified: false, ...o });
  assert.deepEqual(seatsNeedingJustification([seat({ id: "a", newSeat: true })]), ["a"], "a new seat outside the TDP");
  assert.deepEqual(seatsNeedingJustification([seat({ id: "a", newSeat: true, justified: true })]), [], "…with a justification");
  assert.deepEqual(seatsNeedingJustification([seat({ id: "a", newSeat: true, identifiedAfter: true })]), [], "a new seat the plan identifies");
  assert.deepEqual(seatsNeedingJustification([seat({ id: "a", identifiedBefore: true })]), ["a"], "unticking the seminar's need turns them outside");
  assert.deepEqual(seatsNeedingJustification([seat({ id: "a", identifiedBefore: true, keptForHistory: true })]), [],
    "someone HR unticked but the save had to keep isn't held against it");
  assert.deepEqual(seatsNeedingJustification([seat({ id: "a" })]), [], "already outside before the save (e.g. before the rule): not refused");
  assert.deepEqual(seatsNeedingJustification([seat({ id: "a", identifiedBefore: true, identifiedAfter: true })]), []);
});

test("a justification needs its kind, the reason and who identified them; the reference is optional", () => {
  const ok = readTdpJustification(valid, today);
  assert.ok("value" in ok);
  assert.deepEqual(ok.value, valid);
  for (const [raw, why] of [
    [{ ...valid, kind: "Because" }, "an unknown kind"],
    [{ ...valid, kind: "In lieu of" }, "a kind only Send a representative records"],
    [{ ...valid, reason: "   " }, "a blank reason"],
    [{ ...valid, reason: "x".repeat(501) }, "a reason over 500 characters"],
    [{ ...valid, identifiedBy: { name: "Test Officer" } }, "no position for who identified them"],
    [{ ...valid, identifiedBy: "the Chief" }, "who identified them, not as name and position"],
    [{ ...valid, referenceDate: "2026-10-29" }, "a reference dated after today"],
    [{ ...valid, referenceDate: "2026-02-30" }, "a date that doesn't exist"],
    [{ ...valid, referenceNo: "x".repeat(51) }, "a reference number over 50 characters"],
    [null, "nothing at all"],
    [["Other"], "an array"]
  ] as [unknown, string][]) {
    assert.ok("problem" in readTdpJustification(raw, today), why);
  }
});

test("a designation names the committee from HSAC's list, or names it by hand", () => {
  const d = readTdpJustification({ ...valid, kind: "Designated", committee: "BAC TWG", referenceNo: " SO No. 12, s. 2026 ", referenceDate: "2026-01-15" }, today);
  assert.ok("value" in d);
  assert.deepEqual([d.value.committee, d.value.referenceNo, d.value.referenceDate], ["BAC TWG", "SO No. 12, s. 2026", "2026-01-15"]);
  assert.ok("problem" in readTdpJustification({ ...valid, kind: "Designated" }, today), "no committee");
  assert.ok("problem" in readTdpJustification({ ...valid, kind: "Designated", committee: "Book Club" }, today), "not on the list");
  assert.ok("problem" in readTdpJustification({ ...valid, kind: "Designated", committee: "Other" }, today), "Other, unnamed");
  const named = readTdpJustification({ ...valid, kind: "Designated", committee: "Other", committeeOther: "Records Disposal Committee" }, today);
  assert.ok("value" in named && named.value.committeeOther === "Records Disposal Committee");
  const notDesignated = readTdpJustification({ ...valid, committee: "BAC" }, today);
  assert.ok("value" in notDesignated && notDesignated.value.committee === undefined, "a committee is kept only for a designation");
});

test("an optional reference left blank is none; one that isn't text is refused", () => {
  const blank = readTdpJustification({ ...valid, referenceNo: "   ​ " }, today);
  assert.ok("value" in blank && blank.value.referenceNo === undefined);
  assert.ok("problem" in readTdpJustification({ ...valid, referenceNo: 12 }, today));
  assert.ok("problem" in readTdpJustification({ ...valid, referenceNo: "x".repeat(5000) }, today), "far too long is refused, not dropped");
});

test("text is cleaned as everywhere else: invisible characters out, spaces collapsed", () => {
  const r = readTdpJustification({ ...valid, reason: "On​ leave\n\n until  Nov 30", identifiedBy: { name: " Test\tOfficer ", position: "CAO" } }, today);
  assert.ok("value" in r);
  assert.deepEqual([r.value.reason, r.value.identifiedBy.name], ["On leave until Nov 30", "Test Officer"]);
});

test("badges and words for each kind", () => {
  assert.equal(tdpBadgeText("identified"), null);
  assert.equal(tdpBadgeText(undefined), null);
  assert.equal(tdpBadgeText("beforeRule"), "Outside the TDP (before this rule)");
  assert.equal(tdpBadgeText("missing"), "Outside the TDP: no justification");
  assert.equal(tdpBadgeText("justified", { kind: "Designated", committee: "BAC TWG" }), "Designated: BAC TWG");
  assert.equal(tdpBadgeText("justified", { kind: "Designated", committee: "Other", committeeOther: "Records Committee" }), "Designated: Records Committee");
  assert.equal(tdpBadgeText("justified", { kind: "Identified by the Chief" }), "Identified by the Chief");
  assert.equal(tdpBadgeText("justified", { kind: "Other" }), "Outside the TDP: other reason");
  assert.equal(tdpKindText({ kind: "Designated", committee: "GAD Focal Point System" }), "Designated (GAD Focal Point System)");
  assert.equal(tdpKindText({ kind: "Identified by the Chief" }), "Identified by the Chief");
  assert.equal(tdpKindText({ kind: "Other" }), "Other reason");
});
