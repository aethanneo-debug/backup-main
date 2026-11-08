// "Add Training Need": the uploaded TDP's own trainings, the column and training kept in step, and the checks on an
// addition (the user's request of 2026-11-08, known-issues 12ad). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  choicesUnder, columnForTraining, existingNeedFor, readNeedAddition, tdpTrainingChoices, trainingForColumn
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

test("changing the column clears a training not listed under it, and keeps one that is", () => {
  assert.equal(trainingForColumn(byTitle("Records"), "Career Advancement"), null);
  assert.equal(trainingForColumn(byTitle("Gender"), "Career Advancement")?.title, "Gender and Development");
  assert.equal(trainingForColumn(byTitle("Records"), null)?.title, "Records Management", "\"Any column\" keeps it");
  assert.equal(trainingForColumn(null, "Function"), null);
});

test("an addition is stored with the TDP's spelling under the chosen column, and the note cleaned", () => {
  assert.deepEqual(readNeedAddition({ ...ok, title: "records management", note: "  SO No. 12,\ts. 2026 " }, { choices, personNeeds: [] }),
    { value: { category: "Function", title: "Records Management", basis: "Hired after the TDP", note: "SO No. 12, s. 2026" } });
  const r = readNeedAddition({ ...ok, category: "Additional Function", title: "RA 12009 (New Government Procurement Act)" }, { choices, personNeeds: [] });
  assert.equal("value" in r && r.value.title, "RA 12009 (new government procurement act)", "that column's own spelling");
});

test("refused: no column, no training, one the TDP doesn't list, the wrong column, no basis, Other without a note, a long note", () => {
  const problem = (over: Record<string, unknown>) => {
    const r = readNeedAddition({ ...ok, ...over }, { choices, personNeeds: [] });
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

test("a duplicate in any column is refused, carried ones and those added before included", () => {
  const dup = (personNeeds: object[], over: Record<string, unknown> = {}) => readNeedAddition({ ...ok, ...over }, { choices, personNeeds });
  const same = dup([{ title: "Records Management", category: "Function" }]);
  assert.ok("problem" in same && same.duplicate && /already have "Records Management".*Needed Training for the Function/.test(same.problem));
  const otherColumn = dup([{ title: "Gender and Development", category: "Career Advancement" }], { title: "Gender and Development", category: "Function" });
  assert.ok("problem" in otherColumn && otherColumn.duplicate, "the same training under another column");
  const carried = dup([{ title: "RECORDS management", category: "Function", carriedFromFiscalYear: "2027" }]);
  assert.ok("problem" in carried && /carried from 2027/.test(carried.problem));
  assert.deepEqual(existingNeedFor([{ title: "Records Management", category: "Function", addedAfterTdp: {} }], "records management"),
    { category: "Function", added: true });
  assert.equal(existingNeedFor([{ title: "Records Management", category: "Function" }], "leadership and management"), null);
});
