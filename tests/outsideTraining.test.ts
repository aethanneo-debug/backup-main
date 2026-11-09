// The screens of a training outside the TDP (12ae): the form's pure parts (where a refusal points, the typed title, the
// TDP training it may be, the column it takes in the TDP's list), the TDP bar's wording, and Plan D's mark. Run with
// `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { columnOnSwitch, outsideProblemPart, outsideTitle, tdpChoiceFor } from "../src/components/training/outsideTraining";
import { addedChangesText, outsideKindText, outsideNeedText, outsideText } from "../src/components/training/tdpText";
import { planDCsvRows, planDNeedTitle } from "../src/components/training/planD/planDRows";
import { readOutsideTdpAddition, tdpTrainingChoices } from "../src/tdpAdditions";
import { UserRole, type TrainingNeedRow } from "../src/types";

const choices = tdpTrainingChoices([
  { title: "Records Management", category: "Function" },
  { title: "Employee Relations", category: "Function" },
  { title: "RA 12009 (New Government Procurement Act)", category: "Function" },
  { title: "RA 12009 (New Government Procurement Act)", category: "Additional Function" }
], []);
const why = { kind: "New law or issuance", reason: "A law that came after the plan", approvedBy: { name: "The Chief", position: "Chief Regional Adjudicator" } };
const base = { employeeIds: ["emp-1"], title: "Orientation on a new law", category: "Function", justification: why };
// The reader's own refusal for a form, and where the form points for it.
const problemOf = (over: Record<string, unknown>) => {
  const read = readOutsideTdpAddition({ ...base, ...over }, { choices, today: "2026-11-09" });
  return "problem" in read ? read.problem : null;
};
const partOf = (over: Record<string, unknown>) => {
  const problem = problemOf(over);
  assert.ok(problem, `expected a refusal for ${JSON.stringify(over)}`);
  const approver = (over.justification as typeof why | undefined)?.approvedBy ?? why.approvedBy;
  return outsideProblemPart(problem, approver);
};

test("a refusal points to its part, read from the reader's own words, in the order it checks", () => {
  assert.equal(problemOf({}), null, "a whole form passes");
  assert.equal(partOf({ employeeIds: [] }), "employees");
  assert.equal(partOf({ employeeIds: ["emp-1", "emp-1"] }), "employees");
  assert.equal(partOf({ title: "   " }), "title");
  assert.equal(partOf({ title: "records management" }), "title", "a TDP training is the title's problem");
  // The TDP training's title is quoted first in its message: words in it can't send the pointer elsewhere.
  assert.equal(partOf({ title: "Employee Relations" }), "title");
  assert.equal(partOf({ category: null }), "column");
  assert.equal(partOf({ justification: { ...why, kind: "" } }), "kind");
  assert.equal(partOf({ justification: { ...why, reason: " " } }), "reason");
  assert.equal(partOf({ justification: { ...why, approvedBy: { name: "", position: "Chief" } } }), "name");
  assert.equal(partOf({ justification: { ...why, approvedBy: { name: "The Chief", position: "" } } }), "position");
  assert.equal(partOf({ justification: { ...why, referenceNo: "x".repeat(60) } }), "referenceNo");
  assert.equal(partOf({ justification: { ...why, referenceDate: "2026-12-31" } }), "referenceDate", "dated after today");
  assert.equal(outsideProblemPart("Something else went wrong.", why.approvedBy), null);
});

test("the typed title is read as the server reads it, and a TDP training it turns out to be is found as the reader finds it", () => {
  assert.deepEqual(outsideTitle("  Orientation​ on   a new law "), { title: "Orientation on a new law", key: "orientation on a new law" });
  assert.deepEqual(outsideTitle(7), { title: "", key: "" });
  assert.equal(outsideTitle("x".repeat(301)).key, "", "longer than a Plan A need's room");
  assert.equal(tdpChoiceFor("RECORDS management", choices)?.title, "Records Management");
  // Pasted from a PDF with a soft hyphen: its own key differs, its cleaned one doesn't. The reader refuses it the same way.
  assert.equal(tdpChoiceFor("Records Manage­ment", choices)?.title, "Records Management");
  assert.equal(partOf({ title: "Records Manage­ment" }), "title");
  assert.equal(tdpChoiceFor("Orientation on a new law", choices), null);
  assert.equal(tdpChoiceFor("", choices), null);
  assert.equal(tdpChoiceFor(7, choices), null);
  assert.equal(tdpChoiceFor("records management", null), null);
});

test("sent to the TDP's list, a training takes its only column, else the one chosen here, else the list's filter, else none", () => {
  const one = tdpChoiceFor("records management", choices)!;
  const two = tdpChoiceFor("RA 12009 (New Government Procurement Act)", choices)!;
  assert.equal(columnOnSwitch(one, "Career Advancement", null), "Function");
  assert.equal(columnOnSwitch(two, "Additional Function", "Function"), "Additional Function");
  assert.equal(columnOnSwitch(two, "Career Advancement", "Function"), "Function", "the column chosen here isn't one of its own");
  assert.equal(columnOnSwitch(two, null, "Career Advancement"), null, "HR chooses in the ticked list");
});

test("the TDP bar: needs outside the TDP counted apart, and what an amended TDP did to each kind of HR's additions", () => {
  assert.equal(outsideText(1), "1 need outside the TDP");
  assert.equal(outsideText(3), "3 needs outside the TDP");
  assert.equal(addedChangesText({ addedKept: 2, adopted: 1 }), "Of the needs added after the TDP, 2 stay as added and 1 is now in the amended TDP.");
  assert.equal(addedChangesText({ outsideKept: 2, outsideAdopted: 1 }), "Of the needs outside the TDP, 2 stay and 1 is now in the amended TDP.");
  assert.equal(addedChangesText({ addedKept: 1, outsideAdopted: 2 }),
    "Of the needs added after the TDP, 1 stays as added. Of the needs outside the TDP, 2 are now in the amended TDP.");
  assert.equal(addedChangesText({}), "");
  assert.equal(addedChangesText(undefined), "");
  assert.equal(addedChangesText({ outsideKept: -1, outsideAdopted: Number.NaN }), "", "a damaged count is none");
});

test("a need outside the TDP's mark says why, who approved it, who added it and when, and the reason", () => {
  assert.equal(outsideKindText("New law or issuance"), "New law or issuance");
  assert.equal(outsideKindText("Other"), "other reason");
  assert.equal(outsideKindText(undefined), "no reason recorded");
  const text = outsideNeedText({
    kind: "Central Office training", reason: "The Central Office pays for it", approvedBy: { name: "The Chief", position: "CRA" },
    referenceNo: "Memo 12", addedBy: { id: "u1", name: "An HR Officer", role: UserRole.HR_OFFICER }, addedAt: "2026-11-09T03:00:00.000Z"
  });
  assert.match(text, /^Central Office training · approved by The Chief \(CRA\) · ref\. Memo 12 · added by An HR Officer \(HR Officer\) on .+ · reason: The Central Office pays for it$/);
  // A damaged record still reads, with what it has.
  assert.equal(outsideNeedText({} as never), "no reason recorded · added");
});

test("Plan D's printed sheet and CSV say which needs are outside the TDP; the NOT ACCOMPLISHED pair repeats the title alone", () => {
  const need = (title: string, extra: Partial<TrainingNeedRow> = {}) => ({
    id: title, employeeId: "e1", fiscalYear: "2028", category: "Function", title, createdAt: "", createdBy: "",
    status: { accomplished: false, source: null }, ...extra
  }) as TrainingNeedRow;
  const outside = need("Orientation on a new law", { outsideTdp: { ...why, kind: "New law or issuance", addedBy: { id: "u1", name: "HR", role: UserRole.HR_OFFICER }, addedAt: "" } });
  assert.equal(planDNeedTitle(outside), "Orientation on a new law (outside the TDP)");
  assert.equal(planDNeedTitle(need("Records Management")), "Records Management");
  assert.equal(planDNeedTitle(null), "");
  const rows = planDCsvRows({
    fiscalYear: "2028", asOf: "2026-11-09",
    offices: [{ office: "LEGAL DIVISION", employees: [{ employeeId: "e1", fullName: "An Employee", position: "Clerk", division: "Legal", needs: { "Function": [outside], "Additional Function": [], "Career Advancement": [] } }] }]
  });
  const line = rows.find(r => r[0] === "An Employee")!;
  assert.deepEqual(line.slice(2, 4), ["Orientation on a new law (outside the TDP)", "Orientation on a new law"]);
});
