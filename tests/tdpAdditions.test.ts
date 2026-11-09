// "Add Training Need": the uploaded TDP's own trainings, the column a ticked training takes, the checks on a save and
// what it adds or skips (the user's requests of 2026-11-08 and 2026-11-09, known-issues 12ad). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  additionPairs, choicesUnder, columnForTraining, existingNeedFor, existingNeedText, NEED_ADDITION_MAX_EMPLOYEES, NEED_ADDITION_MAX_NEEDS,
  readNeedAdditions, readOutsideTdpAddition, tdpChoiceForTitle, tdpTrainingChoices, titleKeys
} from "../src/tdpAdditions";

const trainings = [
  { title: "RA 12009 (New Government Procurement Act)", category: "Function" },
  { title: "RA 12009 (new government procurement act)", category: "Additional Function" },
  { title: "Records Management", category: "Function" },
  { title: "Leadership and Management", category: "Career Advancement" },
  { title: "Records  Management", category: "Function" },          // the same training again: counted once
  { title: "Gender and Development", category: "Additional Function" },
  { title: "Gender and Development", category: "Career Advancement" },
  { title: "Gender and Development", category: "Function" }
];
const choices = tdpTrainingChoices(trainings, []);
const byTitle = (t: string) => choices.find(c => c.title.toLowerCase().startsWith(t.toLowerCase()))!;
const ok = { category: "Function", title: "Records Management", basis: "Hired after the TDP" };

test("the choices are the TDP's own trainings, once each, with their columns in the form's order and each column's spelling", () => {
  assert.deepEqual(choices.map(c => c.title), ["Gender and Development", "Leadership and Management", "RA 12009 (New Government Procurement Act)", "Records Management"]);
  assert.deepEqual(byTitle("Gender").categories, ["Function", "Additional Function", "Career Advancement"]);
  assert.deepEqual(byTitle("RA 12009").spellings, {
    "Function": "RA 12009 (New Government Procurement Act)",
    "Additional Function": "RA 12009 (new government procurement act)"
  });
  assert.deepEqual(byTitle("Records").categories, ["Function"]);
});

test("a record from before the list was kept: the year's needs stand in, carried ones included, those HR added left out", () => {
  const needs = [
    { title: "Records Management", category: "Function" },
    { title: "Values Orientation", category: "Career Advancement", carriedFromFiscalYear: "2027" },
    { title: "Added By Hand", category: "Function", addedAfterTdp: { basis: "Other" } },
    { title: { bad: true }, category: "Function" },
    { title: "No Column", category: "Somewhere" }
  ];
  assert.deepEqual(tdpTrainingChoices(undefined, needs).map(c => c.title), ["Records Management", "Values Orientation"]);
  assert.deepEqual(tdpTrainingChoices([], needs).map(c => c.title), ["Records Management", "Values Orientation"], "an empty list stands in too");
  assert.deepEqual(tdpTrainingChoices([{ title: "Only This", category: "Function" }], needs).map(c => c.title), ["Only This"], "the record's list wins");
});

test("Scenario A: a column chosen first lists only the trainings under it", () => {
  assert.deepEqual(choicesUnder(choices, "Career Advancement").map(c => c.title), ["Gender and Development", "Leadership and Management"]);
  assert.equal(choicesUnder(choices, null).length, 4, "no column chosen lists them all");
});

test("Scenario B: a training chosen first fills in its one column; one under several keeps the current column or asks", () => {
  assert.equal(columnForTraining(byTitle("Records"), null), "Function");
  assert.equal(columnForTraining(byTitle("Records"), "Career Advancement"), "Function", "its one column, whatever was chosen");
  assert.equal(columnForTraining(byTitle("Gender"), null), null, "listed under three: HR chooses");
  assert.equal(columnForTraining(byTitle("Gender"), "Career Advancement"), "Career Advancement", "the current column is one of them");
  assert.equal(columnForTraining(byTitle("RA 12009"), "Career Advancement"), null, "the current column isn't one of them");
});

test("an addition is stored with the TDP's spelling under the chosen column, and the note cleaned", () => {
  assert.deepEqual(readNeedAdditions({ employeeId: "e1", ...ok, title: "records management", note: "  SO No. 12,\ts. 2026 " }, { choices }),
    { value: { employeeIds: ["e1"], trainings: [{ key: "records management", category: "Function", title: "Records Management" }], basis: "Hired after the TDP", note: "SO No. 12, s. 2026" } });
  const r = readNeedAdditions({ employeeId: "e1", ...ok, category: "Additional Function", title: "RA 12009 (New Government Procurement Act)" }, { choices });
  assert.equal("value" in r && r.value.trainings[0].title, "RA 12009 (new government procurement act)", "that column's own spelling");
});

test("refused: no column, no training, one the TDP doesn't list, the wrong column, no basis, Other without a note, a long note", () => {
  const problem = (over: Record<string, unknown>) => {
    const r = readNeedAdditions({ employeeId: "e1", ...ok, ...over }, { choices });
    return "problem" in r ? r.problem : null;
  };
  assert.match(problem({ category: "Somewhere" })!, /Choose the column/);
  assert.match(problem({ title: "   " })!, /Choose a training/);
  assert.match(problem({ title: { x: 1 } })!, /Choose a training/);
  assert.match(problem({ title: "x".repeat(301) })!, /Choose a training/);
  assert.match(problem({ title: "Underwater Basket Weaving" })!, /isn't one of the uploaded TDP's trainings/);
  assert.match(problem({ category: "Career Advancement" })!, /isn't listed under "Needed Training for Career Advancement".*listed under "Needed Training for the Function"/);
  assert.match(problem({ basis: "Because" })!, /Choose why/);
  assert.match(problem({ basis: "Other" })!, /Write the reason/);
  assert.match(problem({ basis: "Other", note: "​​" })!, /Write the reason/, "invisible characters are no note");
  assert.match(problem({ note: "y".repeat(301) })!, /Keep the note/);
  assert.equal(problem({ basis: "Other", note: "Transferred from the Central Office" }), null);
});

test("a training someone already has, in any column, carried ones and those added before included, is skipped", () => {
  const skips = (personNeeds: object[], over: Record<string, unknown> = {}) => {
    const r = readNeedAdditions({ employeeId: "e1", ...ok, ...over }, { choices });
    assert.ok("value" in r);
    return additionPairs(r.value.employeeIds, r.value.trainings, () => personNeeds as never);
  };
  const same = skips([{ title: "Records Management", category: "Function" }]);
  assert.deepEqual([same.add.length, same.skip[0]?.existing], [0, { category: "Function", added: false }]);
  const otherColumn = skips([{ title: "Gender and Development", category: "Career Advancement" }], { title: "Gender and Development", category: "Function" });
  assert.deepEqual([otherColumn.add.length, otherColumn.skip[0]?.existing.category], [0, "Career Advancement"], "the same training under another column");
  const carried = skips([{ title: "RECORDS management", category: "Function", carriedFromFiscalYear: "2027" }]);
  assert.equal(carried.skip[0]?.existing.carriedFrom, "2027");
  assert.deepEqual(existingNeedFor([{ title: "Records Management", category: "Function", addedAfterTdp: {} }], "records management"),
    { category: "Function", added: true });
  assert.equal(existingNeedFor([{ title: "Records Management", category: "Function" }], "leadership and management"), null);
});

// Several employees and several trainings in one save (the user's request of 2026-11-09).
const batch = (over: Record<string, unknown> = {}) => readNeedAdditions({
  employeeIds: ["e1", "e2"],
  trainings: [
    { category: "Additional Function", title: "ra 12009 (new government procurement act)" },
    { category: "Career Advancement", title: "Gender and Development" }
  ],
  basis: "Designated after the TDP",
  ...over
}, { choices });
const batchProblem = (over: Record<string, unknown>) => { const r = batch(over); return "problem" in r ? r.problem : null; };

test("a save: every ticked training for every ticked employee, each under its own column in that column's spelling, one basis", () => {
  assert.deepEqual(batch({ note: "  SO No. 7 " }), { value: {
    employeeIds: ["e1", "e2"],
    trainings: [
      { key: "ra 12009 new government procurement act", category: "Additional Function", title: "RA 12009 (new government procurement act)" },
      { key: "gender and development", category: "Career Advancement", title: "Gender and Development" }
    ],
    basis: "Designated after the TDP",
    note: "SO No. 7"
  } });
});

test("the first version's single shape reads as one employee and one training", () => {
  assert.deepEqual(readNeedAdditions({ employeeId: "e1", ...ok, title: "records management" }, { choices }), { value: {
    employeeIds: ["e1"],
    trainings: [{ key: "records management", category: "Function", title: "Records Management" }],
    basis: "Hired after the TDP"
  } });
});

test("refused: no employee, one twice or not text, too many; a training twice, one without its column, too many needs", () => {
  assert.match(batchProblem({ employeeIds: [] })!, /Choose the employees/);
  assert.match(batchProblem({ employeeIds: ["e1", "e1"] })!, /chosen twice/);
  assert.match(batchProblem({ employeeIds: ["e1", 5] })!, /isn't a staff record/);
  assert.match(batchProblem({ employeeIds: ["e1", " "] })!, /isn't a staff record/);
  assert.match(batchProblem({ employeeIds: ["x".repeat(101)] })!, /isn't a staff record/);
  assert.match(batchProblem({ employeeIds: Array.from({ length: NEED_ADDITION_MAX_EMPLOYEES + 1 }, (_, i) => `e${i}`) })!, /at most 50 employees/);
  assert.match(batchProblem({ trainings: [] })!, /Choose a training/);
  assert.match(batchProblem({ trainings: [{ category: "Function", title: "Gender and Development" }, { category: "Career Advancement", title: "gender  and development" }] })!,
    /"Gender and Development" is chosen twice/, "the same training under two columns");
  assert.match(batchProblem({ trainings: [{ title: "Records Management" }, { category: "Function", title: "Gender and Development" }] })!,
    /Choose the column for "Records Management"/, "with several, the one without a column is named");
  assert.match(batchProblem({ trainings: [{ category: "Career Advancement", title: "Records Management" }] })!, /isn't listed under "Needed Training for Career Advancement"/);
  assert.match(batchProblem({ trainings: [null] })!, /Choose the column/);
  const fiftyOne = tdpTrainingChoices(Array.from({ length: 51 }, (_, i) => ({ title: `Course ${i}`, category: "Function" })), []);
  const tooManyTrainings = readNeedAdditions({ employeeIds: ["e1"], trainings: fiftyOne.map(c => ({ category: "Function", title: c.title })), basis: "Hired after the TDP" }, { choices: fiftyOne });
  assert.match("problem" in tooManyTrainings ? tooManyTrainings.problem : "", /Choose at most 50 trainings in one save/);
  // 21 employees and 10 trainings: 210 needs, over the cap of one save.
  const tenChoices = tdpTrainingChoices(Array.from({ length: 10 }, (_, i) => ({ title: `Training ${i}`, category: "Function" })), []);
  const tooMany = readNeedAdditions({
    employeeIds: Array.from({ length: 21 }, (_, i) => `e${i}`),
    trainings: tenChoices.map(c => ({ category: "Function", title: c.title })),
    basis: "Hired after the TDP"
  }, { choices: tenChoices });
  assert.match("problem" in tooMany ? tooMany.problem : "", new RegExp(`That is 210 needs in one save; the most is ${NEED_ADDITION_MAX_NEEDS}`));
  const atTheCap = readNeedAdditions({
    employeeIds: Array.from({ length: 20 }, (_, i) => `e${i}`),
    trainings: tenChoices.map(c => ({ category: "Function", title: c.title })),
    basis: "Hired after the TDP"
  }, { choices: tenChoices });
  assert.ok("value" in atTheCap, "200 needs is the cap itself: allowed");
  assert.match(batchProblem({ basis: "Other" })!, /Write the reason/, "one basis and note for the save, checked as before");
});

test("each pair: what a person already has is skipped and said (any column, carried, added before), the rest added in order", () => {
  const value = (batch() as { value: { trainings: Parameters<typeof additionPairs>[1] } }).value;
  const needsOf = (id: string) => id === "e2"
    ? [{ title: "RA 12009 (New Government Procurement Act)", category: "Function", carriedFromFiscalYear: "2027" }]
    : [{ title: "Unrelated", category: "Function" }];
  const { add, skip } = additionPairs(["e1", "e2"], value.trainings, needsOf);
  assert.deepEqual(add.map(p => [p.employeeId, p.category, p.title]), [
    ["e1", "Additional Function", "RA 12009 (new government procurement act)"],
    ["e1", "Career Advancement", "Gender and Development"],
    ["e2", "Career Advancement", "Gender and Development"]
  ]);
  assert.deepEqual(skip, [{ employeeId: "e2", key: "ra 12009 new government procurement act", title: "RA 12009 (new government procurement act)",
    existing: { category: "Function", carriedFrom: "2027", added: false } }], "carried under another column: skipped, with where it is");
  assert.deepEqual(additionPairs(["e1"], value.trainings, () => null).add.length, 2, "no needs on file: everything is added");
});

test("a training ticked under a column filter takes that column; under \"Any column\", its only one, or none when it has several", () => {
  assert.equal(columnForTraining(byTitle("Gender"), "Additional Function"), "Additional Function");
  assert.equal(columnForTraining(byTitle("Records"), null), "Function");
  assert.equal(columnForTraining(byTitle("RA 12009"), null), null, "listed under two: asked in the ticked list");
});

// A training outside the TDP (12ae, the user's request of 2026-11-09).
const why = { kind: "New law or issuance", reason: "A circular issued this year", approvedBy: { name: "Sban Chief", position: "Chief" } };
const outside = (over: Record<string, unknown> = {}) =>
  readOutsideTdpAddition({ employeeIds: ["e1", "e2"], title: "  Data  Privacy​ Basics ", category: "Career Advancement", justification: why, ...over },
    { choices, today: "2026-11-09" });
const outsideProblem = (over: Record<string, unknown>) => { const r = outside(over); return "problem" in r ? r.problem : null; };

test("a training outside the TDP: the typed title cleaned, its column, the justification a seminar outside it gives", () => {
  assert.deepEqual(outside(), { value: {
    employeeIds: ["e1", "e2"],
    training: { key: "data privacy basics", category: "Career Advancement", title: "Data Privacy Basics" },
    justification: { kind: "New law or issuance", reason: "A circular issued this year", approvedBy: { name: "Sban Chief", position: "Chief" } }
  } });
});

test("refused: one the TDP lists (pointed back to its list), no title, no column, no justification, the employees", () => {
  assert.match(outsideProblem({ title: "records  MANAGEMENT" })!, /"Records Management" is in the uploaded TDP: tick it in the list/);
  assert.match(outsideProblem({ title: "  ...  " })!, /Type the training's title/);
  assert.match(outsideProblem({ title: "x".repeat(301) })!, /Type the training's title/);
  assert.match(outsideProblem({ title: { x: 1 } })!, /Type the training's title/);
  assert.match(outsideProblem({ category: "Somewhere" })!, /Choose the column/);
  assert.match(outsideProblem({ justification: undefined })!, /Choose why it is held/);
  assert.match(outsideProblem({ justification: { ...why, reason: " " } })!, /Give the reason/);
  assert.match(outsideProblem({ justification: { ...why, approvedBy: { name: "Sban Chief" } } })!, /Name who approved it/);
  assert.match(outsideProblem({ employeeIds: [] })!, /Choose the employees/);
  assert.match(outsideProblem({ employeeIds: ["e1", "e1"] })!, /chosen twice/);
});

test("someone who already has it outside the TDP is skipped, and the place says so", () => {
  const v = (outside() as { value: { training: Parameters<typeof additionPairs>[1][number] } }).value;
  const { add, skip } = additionPairs(["e1", "e2"], [v.training], id => id === "e2"
    ? [{ title: "data privacy basics", category: "Function", outsideTdp: { kind: "Other" } }] : []);
  assert.deepEqual([add.map(p => p.employeeId), skip.map(s => s.existing)], [["e1"], [{ category: "Function", added: false, outside: true }]]);
  assert.equal(existingNeedText(skip[0].existing), "Needed Training for the Function, outside the TDP");
  assert.deepEqual(tdpTrainingChoices(undefined, [{ title: "Data Privacy Basics", category: "Function", outsideTdp: {} }, { title: "Records", category: "Function" }]).map(c => c.title),
    ["Records"], "a need outside the TDP is never offered as one of the TDP's trainings");
});

test("a TDP training pasted in another spelling (a soft hyphen, a ligature) is still the TDP's, both ways (the security review)", () => {
  // The TDP's spelling holds a soft hyphen (from a PDF): its own key differs from the cleaned text's.
  const pasted = tdpTrainingChoices([{ title: "Pro­curement Basics", category: "Function" }, { title: "ﬁling Systems", category: "Function" }], []);
  assert.equal(tdpChoiceForTitle("Procurement Basics", pasted)?.title, "Pro­curement Basics", "typed plainly, the TDP's soft-hyphen spelling is found");
  assert.equal(tdpChoiceForTitle("filing systems", pasted)?.title, "ﬁling Systems", "…and a ligature in the TDP's spelling");
  const r = readOutsideTdpAddition({ employeeIds: ["e1"], title: "Procurement Basics", category: "Function", justification: why }, { choices: pasted, today: "2026-11-09" });
  assert.ok("problem" in r && /is in the uploaded TDP: tick it in the list/.test(r.problem), "the server refuses it as a training outside the TDP");
  assert.equal(tdpChoiceForTitle("Procurement Basics Refresher", pasted), null, "a longer title is another training");
  assert.deepEqual(titleKeys("Pro­curement"), ["pro curement", "procurement"]);
  // Someone with the TDP's pasted spelling already has the training typed plainly, and the other way round.
  const typed = (readOutsideTdpAddition({ employeeIds: ["e1"], title: "Data Privacy", category: "Function", justification: why }, { choices: [], today: "2026-11-09" }) as { value: { training: Parameters<typeof additionPairs>[1][number] } }).value.training;
  assert.equal(additionPairs(["e1"], [typed], () => [{ title: "Data Pri­vacy", category: "Function" }]).skip.length, 1);
  const fromTdp = { key: "pro curement basics", category: "Function" as const, title: "Pro­curement Basics" };
  assert.equal(additionPairs(["e1"], [fromTdp], () => [{ title: "Procurement Basics", category: "Career Advancement", outsideTdp: {} }]).skip.length, 1);
});
