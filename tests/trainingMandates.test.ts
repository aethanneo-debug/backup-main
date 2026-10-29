// Trainings the law requires come first (HSAC RAB 1's step 5; src/trainingMandates.ts). Pure functions,
// no data touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogOrder, isMandate, mandateFor, mandateIndex, readMandateBasis, readMandateTitle, unmetMandatedFirst } from "../src/trainingMandates";
import { normalizeTitle } from "../src/tdpRules";

// As stored: two wordings of one law in the plan, each marked.
const index = mandateIndex([
  { id: "m1", title: "Orientation on RA 6713 (Code of Conduct and Ethical Standards)", key: "orientation on ra 6713 code of conduct and ethical standards", basis: "R.A. 6713" },
  { id: "m2", title: "RA 6713 (Code of Conduct and Ethical Standards for Public Officials and Employees)", key: "ra 6713 code of conduct and ethical standards for public officials and employees", basis: "R.A. 6713" }
]);

test("a title is mandated when its normalised form is marked; two wordings of one law share the basis", () => {
  assert.deepEqual(mandateFor("Orientation on RA 6713 (Code of Conduct and Ethical Standards)", index), { basis: "R.A. 6713" });
  assert.deepEqual(mandateFor("RA 6713 (Code of Conduct and Ethical Standards for Public Officials and Employees)", index), { basis: "R.A. 6713" });
  assert.equal(mandateFor("Legal Ethics", index), null, "not marked");
  assert.equal(mandateFor({ x: 1 }, index), null, "a title that isn't text is none");
});

test("a basis is required, cleaned and at most 100 characters", () => {
  assert.deepEqual(readMandateBasis("  R.A.​ 6713  "), { value: "R.A. 6713" });
  assert.equal("problem" in readMandateBasis("   "), true, "blank");
  assert.equal("problem" in readMandateBasis("x".repeat(101)), true, "too long");
  assert.equal("problem" in readMandateBasis(6713), true, "not text");
});

test("Plan D: unmet mandated needs move up, everything else keeps its order", () => {
  const rows = [
    { t: "a", m: false, done: false },
    { t: "b", m: true, done: true },
    { t: "c", m: false, done: false },
    { t: "d", m: true, done: false },
    { t: "e", m: true, done: false }
  ];
  assert.deepEqual(unmetMandatedFirst(rows, r => r.m, r => r.done).map(r => r.t), ["d", "e", "a", "b", "c"]);
});

test("planning: mandated titles first, then by how many people list them, then by title", () => {
  const items = [
    { title: "Legal Ethics", employeeCount: 4 },
    { title: "RA 12009", employeeCount: 11, mandate: { basis: "R.A. 12009" } },
    { title: "ISO Awareness", employeeCount: 14 },
    { title: "Anti Sexual Harassment", employeeCount: 17, mandate: { basis: "Safe Spaces Act" } }
  ];
  assert.deepEqual(catalogOrder(items).map(i => i.title), ["Anti Sexual Harassment", "RA 12009", "ISO Awareness", "Legal Ethics"]);
});

test("a mark lands on the title as the plan has it, even with a soft hyphen, a ligature or an invisible character", () => {
  // Plan titles are matched as stored (normalizeTitle on their own text), so the mark's key must be too.
  for (const raw of ["Pro­curement under R.A. 12009", "Certiﬁcate Course on Procurement", "RA​6713 Orientation", "  Legal Ethics	"]) {
    const read = readMandateTitle(raw);
    assert.ok("key" in read, raw);
    if (!("key" in read)) continue;
    assert.equal(read.key, normalizeTitle(raw), `${raw}: the plan's own key`);
    assert.deepEqual(mandateFor(raw, mandateIndex([{ id: "m1", title: read.title, key: read.key, basis: "R.A. 12009" }])), { basis: "R.A. 12009" }, `${raw}: the plan row is marked`);
  }
  // What is shown and logged is the cleaned text.
  assert.deepEqual(readMandateTitle("Pro­curement under R.A. 12009"), { title: "Procurement under R.A. 12009", key: "pro curement under r a 12009" });
});

test("a title is text of at most 300 characters, after cleaning too", () => {
  for (const bad of [undefined, 42, { title: "x" }, ["Legal Ethics"], "", "   ", "!!!", "​‌", "x".repeat(301)]) {
    assert.equal("problem" in readMandateTitle(bad), true, JSON.stringify(bad)?.slice(0, 40));
  }
  assert.equal("key" in readMandateTitle("x".repeat(300)), true, "300 is the limit");
  // 300 characters as typed that NFKC turns into 5,000-odd are refused, not stored.
  assert.equal("problem" in readMandateTitle("a" + "ﷺ".repeat(299)), true, "lengthened by normalising");
});

test("a damaged list is read past, not failed on", () => {
  const good = { id: "m1", title: "Legal Ethics", key: "legal ethics", basis: "R.A. 6713" };
  const list: unknown[] = [null, 42, "x", { id: "m2" }, { ...good, id: 7 }, { ...good, id: "m3", basis: "" }, { ...good, id: "m4", key: "" }, { ...good, id: "m5", basis: { x: 1 } }, good];
  assert.deepEqual(list.filter(isMandate).map(m => m.id), ["m1"]);
  assert.deepEqual([...mandateIndex(list).entries()], [["legal ethics", "R.A. 6713"]]);
  assert.equal(mandateIndex({ junk: 1 } as unknown as unknown[]).size, 0, "not a list at all");
});
