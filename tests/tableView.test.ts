// The long lists' search, sorting and pages (the instructor's review, R8). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PAGE_SIZE, SEARCH_FIELD_LIMIT, matchesTerms, pageContaining, pageOf, searchField, searchTerms, sortRows } from "../src/tableView";

const numbers = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

test("a search ignores case and accents, and every word must match in any order", () => {
  assert.deepEqual(searchTerms("  PEÑA   Legal "), ["pena", "legal"]);
  assert.equal(matchesTerms(searchTerms("pena"), "Ana Peña, Legal Division"), true);
  assert.equal(matchesTerms(searchTerms("legal ana"), "Ana Peña, Legal Division"), true);
  assert.equal(matchesTerms(searchTerms("legal bea"), "Ana Peña, Legal Division"), false);
  assert.equal(matchesTerms(searchTerms(""), "anything"), true);
  assert.equal(matchesTerms(searchTerms("x"), undefined), false);
});

test("an empty search reads nothing, and a field is read only as text, up to its limit", () => {
  // A text that can't be turned into a string would throw if it were read.
  const unreadable = { toString() { throw new Error("read"); } };
  assert.equal(matchesTerms([], unreadable), true);
  assert.equal(searchField("Sick leave"), "Sick leave");
  assert.equal(searchField("x".repeat(SEARCH_FIELD_LIMIT + 50)).length, SEARCH_FIELD_LIMIT);
  assert.deepEqual([searchField({ purpose: "x" }), searchField(42), searchField(null), searchField(undefined)], ["", "", "", ""]);
});

test("numbers sort as numbers, also inside text, however they are padded", () => {
  const rows = ["LIQSUB-2026-010", "LIQSUB-2026-09", "LIQSUB-2026-011"];
  assert.deepEqual(sortRows(rows, r => r, "asc"), ["LIQSUB-2026-09", "LIQSUB-2026-010", "LIQSUB-2026-011"]);
  assert.deepEqual(sortRows([20, 3, 100], r => r, "desc"), [100, 20, 3]);
});

test("text sorts without regard to case or accents", () => {
  assert.deepEqual(sortRows(["beta", "Álvarez", "Alpha"], r => r, "asc"), ["Alpha", "Álvarez", "beta"]);
});

test("rows with nothing to sort by stay last in both directions", () => {
  const rows = [{ v: 2 }, { v: null }, { v: 5 }, { v: undefined }, { v: NaN }, { v: "" }];
  assert.deepEqual(sortRows(rows, r => r.v as any, "asc").map(r => r.v), [2, 5, null, undefined, NaN, ""]);
  assert.deepEqual(sortRows(rows, r => r.v as any, "desc").map(r => r.v), [5, 2, null, undefined, NaN, ""]);
});

test("rows of the same value keep their order going up, and show the latest entry first going down", () => {
  const rows = [{ id: "first", day: 1 }, { id: "second", day: 1 }, { id: "third", day: 1 }];
  assert.deepEqual(sortRows(rows, r => r.day, "asc").map(r => r.id), ["first", "second", "third"]);
  assert.deepEqual(sortRows(rows, r => r.day, "desc").map(r => r.id), ["third", "second", "first"]);
});

test("sorting leaves the list it was given as it was", () => {
  const rows = [2, 1];
  sortRows(rows, r => r, "asc");
  assert.deepEqual(rows, [2, 1]);
});

test("a page shows 25 rows and says which ones", () => {
  assert.equal(PAGE_SIZE, 25);
  const second = pageOf(numbers(60), 1);
  assert.deepEqual(second.rows, numbers(50).slice(25));
  assert.deepEqual({ ...second, rows: [] }, { rows: [], page: 1, pageCount: 3, total: 60, from: 26, to: 50 });
  const last = pageOf(numbers(60), 2);
  assert.deepEqual([last.from, last.to, last.rows.length], [51, 60, 10]);
});

test("a page past the end shows the last one, and an empty list has one empty page", () => {
  assert.equal(pageOf(numbers(30), 9).page, 1);
  assert.equal(pageOf(numbers(30), -4).page, 0);
  assert.equal(pageOf(numbers(30), NaN).page, 0);
  assert.deepEqual(pageOf([], 3), { rows: [], page: 0, pageCount: 1, total: 0, from: 0, to: 0 });
  assert.equal(pageOf(numbers(25), 0).pageCount, 1);
  assert.equal(pageOf(numbers(26), 0).pageCount, 2);
});

test("a row is found on its page, whatever the size of a page", () => {
  const rows = numbers(100);
  assert.equal(pageContaining(rows, r => r === 1), 0);
  assert.equal(pageContaining(rows, r => r === 25), 0);
  assert.equal(pageContaining(rows, r => r === 26), 1);
  assert.equal(pageContaining(rows, r => r === 100), 3);
  assert.equal(pageContaining(rows, r => r === 11, 10), 1);
  assert.equal(pageContaining(rows, r => r === 101), -1);
});
