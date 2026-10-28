// Who the TDP identifies for a seminar, and what a justification for anyone else must hold (HSAC
// RAB 1's answer of 2026-10-28; src/tdpRules.ts). Pure functions, no data touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coveredNeeds, normalizeTitle, readSeminarTdpJustification, readTdpJustification, seatsNeedingJustification, seminarCoversPlan,
  seminarNeedsJustification, seminarTdpBadgeText, seminarTdpStanding, tdpBadgeText, tdpKindText, tdpStanding
} from "../src/tdpRules";

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

test("Part C: a seminar is in the TDP when one of its titles is a need in its year's Plan A, anyone's", () => {
  assert.equal(seminarCoversPlan(needs, legalEthics), true);
  assert.equal(seminarCoversPlan(needs, { fiscalYear: "2027", fulfillsNeedTitles: ["values orientation workshop"] }), false, "that need is in another year's plan");
  assert.equal(seminarCoversPlan(needs, { fiscalYear: "2027", fulfillsNeedTitles: ["Something nobody listed"] }), false, "a title typed in doesn't count");
  assert.equal(seminarCoversPlan(needs, { fiscalYear: "2027", fulfillsNeedTitles: [] }), false);
  assert.equal(seminarCoversPlan(needs, { fiscalYear: "2027", fulfillsNeedTitles: ["typed in", "Legal Ethics"] }), true, "one real need is enough");
});

test("Part C: a save gives the seminar's justification only when it takes it outside the TDP", () => {
  const s = (o: object) => ({ isNew: false, inTdpBefore: false, inTdpAfter: false, justified: false, ...o });
  assert.equal(seminarNeedsJustification(s({ isNew: true })), true, "a new seminar outside the TDP");
  assert.equal(seminarNeedsJustification(s({ inTdpBefore: true })), true, "one that was in the TDP and isn't now");
  assert.equal(seminarNeedsJustification(s({ isNew: true, justified: true })), false, "…with its justification");
  assert.equal(seminarNeedsJustification(s({})), false, "an older seminar already outside it: re-saved without a question");
  assert.equal(seminarNeedsJustification(s({ isNew: true, inTdpAfter: true })), false, "in the TDP");
  // A justification is for the training it names (the security review): renamed, it is asked again.
  assert.equal(seminarNeedsJustification(s({ renamedFromJustified: true })), true, "renamed away from a justified title");
  assert.equal(seminarNeedsJustification(s({ renamedFromJustified: true, justified: true })), false, "…confirmed for the new title");
  assert.equal(seminarNeedsJustification(s({ renamedFromJustified: true, inTdpAfter: true })), false, "…or renamed into the TDP");
});

test("Part C: a seminar's standing, and an enrolment under its seminar's justification", () => {
  assert.equal(seminarTdpStanding({ inTdp: true, tdpException: { kind: "Other" } }), "inTdp");
  assert.equal(seminarTdpStanding({ inTdp: false, tdpException: { kind: "Other" } }), "justified");
  assert.equal(seminarTdpStanding({ inTdp: false, createdAt: "2026-10-23T02:00:00Z" }), "beforeRule");
  assert.equal(seminarTdpStanding({ inTdp: false, createdAt: "2026-10-29T02:00:00Z" }), "missing");
  // The rule's day is Manila's: 01:00 on 29 October in Manila is still the 28th in UTC.
  assert.equal(seminarTdpStanding({ inTdp: false, createdAt: "2026-10-28T17:00:00.000Z" }), "missing", "after midnight in Manila");
  assert.equal(seminarTdpStanding({ inTdp: false, createdAt: "2026-10-28T15:59:59.000Z" }), "beforeRule", "before midnight in Manila");
  assert.equal(seminarTdpStanding({ inTdp: false }), "beforeRule", "no date: from before the rule");
  assert.equal(tdpStanding({ identified: false, underSeminar: "2026-10-29T02:00:00Z" }), "seminar");
  assert.equal(tdpStanding({ identified: false, tdpException: { kind: "Other" }, underSeminar: "x" }), "justified", "their own justification first");
  assert.equal(tdpBadgeText("seminar"), "Under the seminar's justification");
  assert.equal(seminarTdpBadgeText("justified", { kind: "Central Office training" }), "Not in the TDP: Central Office training");
  assert.equal(seminarTdpBadgeText("justified", { kind: "Other" }), "Not in the TDP: other reason");
  assert.equal(seminarTdpBadgeText("beforeRule"), "Not in the TDP (before this rule)");
  assert.equal(seminarTdpBadgeText("inTdp"), null);
});

test("Part C: a seminar's justification needs its kind, the reason and who approved it", () => {
  const ok = { kind: "Central Office training", reason: "Paid by the Central Office; slots for each RAB", approvedBy: { name: "Test Chief", position: "Regional Adjudicator" } };
  const r = readSeminarTdpJustification({ ...ok, referenceNo: " Memo 12 ", referenceDate: "2026-10-01" }, today);
  assert.ok("value" in r);
  assert.deepEqual(r.value, { ...ok, referenceNo: "Memo 12", referenceDate: "2026-10-01" });
  assert.ok("problem" in readSeminarTdpJustification({ ...ok, kind: "Designated" }, today), "a seat's kind isn't a seminar's");
  assert.ok("problem" in readSeminarTdpJustification({ ...ok, approvedBy: { name: "Test Chief" } }, today), "no position for who approved it");
  assert.ok("problem" in readSeminarTdpJustification({ ...ok, reason: "" }, today));
  assert.ok("problem" in readSeminarTdpJustification({ ...ok, referenceDate: "2026-11-01" }, today), "a reference dated after today");
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
