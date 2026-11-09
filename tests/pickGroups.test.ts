// The participant picker's groups (the instructor's review, R10). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { onScreenToChoose, pickGroups, plannedOutside, plansThis, seatsWithoutJustification } from "../src/components/training/pickGroups";
import type { TrainingCandidate } from "../src/types";

const candidate = (id: string, over: Partial<TrainingCandidate> = {}) => ({
  employeeId: id, fullName: id, position: "Clerk", division: "Admin", eligible: true, needsThis: true, trainingsThisYear: [], ...over
} as unknown as TrainingCandidate);
const trained = { trainingsThisYear: ["Another course"] };
const mandated = { mandatedNeeds: [{ title: "The law", basis: "R.A. 1" }] };
const sent = { eligible: false, ineligibleReason: "Attended it" };

const view = (listed: TrainingCandidate[], over: Partial<Parameters<typeof pickGroups>[0]> = {}) => pickGroups({
  listed,
  stays: () => false,
  unlisted: [],
  toRow: (id, c) => ({ id, c, name: c?.fullName ?? id, ticked: false, disabled: false, recommended: false, standing: null, why: null }),
  showTrained: false,
  onToggleTrained: () => {},
  showSent: false,
  onToggleSent: () => {},
  sentOffPlan: 0,
  terms: [],
  formFor: null,
  fyText: "FY 2027",
  failed: false,
  ...over
});
const rows = (v: ReturnType<typeof pickGroups>, key: string) => v.groups.find(g => g.key === key)?.rows.map(r => r.id);
const fold = (v: ReturnType<typeof pickGroups>, key: string) => v.groups.find(g => g.key === key)?.fold;

const people = [
  candidate("none-1"), candidate("none-2", mandated),
  candidate("trained-1", trained), candidate("trained-law", { ...trained, ...mandated }),
  candidate("sent-1", sent), candidate("sent-2", sent)
];

test("at first: those with no training yet, and of those already trained only the mandated ones; each list's count is the whole group", () => {
  const v = view(people);
  assert.deepEqual(rows(v, "first"), ["none-1", "none-2"]);
  assert.deepEqual(rows(v, "trained"), ["trained-law"]);
  assert.deepEqual(rows(v, "sent"), []);
  assert.deepEqual([fold(v, "trained")?.label, fold(v, "trained")?.open], ["Already trained this FY (2)", false]);
  assert.deepEqual([fold(v, "sent")?.label, fold(v, "sent")?.open], ["Already sent to this training (2)", false]);
  assert.deepEqual([v.everyone, v.total, v.shown, v.trainedFolded], [6, 3, 3, 1]);
});

test("opening a list shows exactly its count, in the order given", () => {
  const v = view(people, { showTrained: true, showSent: true });
  assert.deepEqual(rows(v, "trained"), ["trained-1", "trained-law"]);
  assert.deepEqual(rows(v, "sent"), ["sent-1", "sent-2"]);
  assert.deepEqual([v.everyone, v.total, v.trainedFolded], [6, 6, 0]);
});

test("someone ticked, or just unticked, stays on screen whatever is closed", () => {
  const v = view(people, { stays: id => id === "trained-1" || id === "sent-2" });
  assert.deepEqual(rows(v, "trained"), ["trained-1", "trained-law"]);
  assert.deepEqual(rows(v, "sent"), ["sent-2"]);
  assert.equal(v.trainedFolded, 0);
});

test("a closed list stays drawn while anyone is in it, so it can be opened; with nobody in it, it goes", () => {
  assert.equal(fold(view([candidate("a")]), "trained"), undefined);
  assert.equal(fold(view([candidate("a")]), "sent"), undefined);
  assert.deepEqual(rows(view([candidate("a", trained)]), "trained"), [], "drawn with no row showing");
});

test("Plan A view: who was sent outside the plan is named, even with nobody on the plan sent; never during a search", () => {
  const some = view(people, { sentOffPlan: 3 });
  assert.match(some.groups.find(g => g.key === "sent")!.reason, /3 more outside the plan/);
  const none = view([candidate("a")], { sentOffPlan: 2 });
  assert.deepEqual([fold(none, "sent"), rows(none, "sent")], [undefined, []]);
  assert.match(none.groups.find(g => g.key === "sent")!.reason, /None of those whose Plan A lists this training\. 2 more outside the plan/);
  assert.equal(none.groups.some(g => g.key === "sent" && g.rows.length === 0 && !g.fold), true);
  assert.equal(view([candidate("a")], { sentOffPlan: 2, terms: ["a"] }).groups.some(g => g.key === "sent"), false);
  assert.equal(view([candidate("a")]).groups.some(g => g.key === "sent"), false, "nobody off the plan either");
});

test("the search filters what is on screen, says how many closed rows match, and never hides the open form", () => {
  const v = view([candidate("Ana"), candidate("Ben"), candidate("Ana Trained", trained), candidate("Ana Sent", sent)], { terms: ["ana"] });
  assert.deepEqual(rows(v, "first"), ["Ana"]);
  assert.deepEqual([v.total, v.shown, v.hiddenMatches], [2, 1, 2]);
  assert.match(v.groups.find(g => g.key === "trained")!.reason, /1 folded away matches the search/);
  assert.deepEqual(rows(view([candidate("Ana"), candidate("Ben")], { terms: ["ana"], formFor: "Ben" }), "first"), ["Ana", "Ben"]);
  // By position and division too, and every word must match.
  assert.deepEqual(rows(view([candidate("Ana"), candidate("Ben", { division: "Legal" })], { terms: ["legal"] }), "first"), ["Ben"]);
  assert.deepEqual(rows(view([candidate("Ana"), candidate("Ben", { division: "Legal" })], { terms: ["legal", "ana"] }), "first") ?? [], []);
});

test("someone selected who isn't among the candidates has a group of their own; its words say why the list is short", () => {
  const listedOnly = view([candidate("a")], { unlisted: ["emp-x"] });
  assert.deepEqual(rows(listedOnly, "unlisted"), ["emp-x"]);
  assert.equal(listedOnly.groups.find(g => g.key === "unlisted")!.label, "Selected, no longer with the office");
  assert.match(listedOnly.groups.find(g => g.key === "unlisted")!.reason, /no longer with the office \(every account archived\)/);
  assert.equal(listedOnly.everyone, 2);
  const failed = view([], { unlisted: ["emp-x"], failed: true });
  assert.equal(failed.groups.find(g => g.key === "unlisted")!.label, "Selected");
});

test("a training planned outside the TDP (12ae): its planners are Plan A listers on screen, never identified by the TDP", () => {
  const outside = candidate("o", { needsThis: false, outsideNeeds: ["A new law"] });
  const tdp = candidate("t");
  const nobody = candidate("n", { needsThis: false });
  assert.deepEqual([plannedOutside(outside), plannedOutside(tdp), plannedOutside(candidate("e", { outsideNeeds: [] }))], [true, false, false]);
  assert.deepEqual([plansThis(outside), plansThis(tdp), plansThis(nobody)], [true, true, false]);
  // Seated with no justification of their own: the TDP's listers always; outside planners only under the seminar's own.
  assert.deepEqual([seatsWithoutJustification(tdp, false), seatsWithoutJustification(outside, false), seatsWithoutJustification(outside, true)], [true, false, true]);
  assert.equal(seatsWithoutJustification(nobody, true), false, "the seminar's justification covers them, but they planned nothing");
});

test("who can be chosen from the screen: no training yet, or a mandated need, or anyone eligible with the list open; never someone already sent", () => {
  assert.equal(onScreenToChoose(candidate("a"), false), true);
  assert.equal(onScreenToChoose(candidate("a", trained), false), false);
  assert.equal(onScreenToChoose(candidate("a", { ...trained, ...mandated }), false), true);
  assert.equal(onScreenToChoose(candidate("a", trained), true), true);
  assert.equal(onScreenToChoose(candidate("a", sent), false), false);
  assert.equal(onScreenToChoose(candidate("a", { ...sent, ...mandated }), true), false);
});
