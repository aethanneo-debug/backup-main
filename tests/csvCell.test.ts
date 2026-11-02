import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell } from "../src/utils";

test("text that starts like a formula stays text", () => {
  for (const cell of ["=HYPERLINK(\"x\")", "+1+1", "-1+1", "@SUM(A1)", "\tcmd", "\rcmd"]) {
    assert.ok(csvCell(cell).startsWith(`"'`), cell);
  }
});

test("a formula behind spaces, a line break, or written with full-width signs stays text too", () => {
  const lineFeed = String.fromCharCode(10);
  const wideSpace = String.fromCharCode(0x3000);
  for (const cell of [" =1", `${lineFeed}=1`, "＝1+1", "＋1", "＠SUM(A1)", `${wideSpace}-1+1`, "  @x"]) {
    assert.ok(csvCell(cell).startsWith(`"'`), JSON.stringify(cell));
  }
  // Text that only contains a sign further in is left as it is.
  assert.equal(csvCell("Seminar - Records = 2"), '"Seminar - Records = 2"');
});

test("a plain amount stays a number, negative or not", () => {
  assert.equal(csvCell("-500"), '"-500"');
  assert.equal(csvCell("-1234.5"), '"-1234.5"');
  assert.equal(csvCell("2000"), '"2000"');
  assert.equal(csvCell(0), '"0"');
});

test("quotes are doubled, and nothing becomes an empty cell", () => {
  assert.equal(csvCell('a "b" c'), '"a ""b"" c"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
});
