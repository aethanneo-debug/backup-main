// The date helpers the request lists sort and show by: only text counts as a stored date. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { firstDateString, firstTimestamp } from "../src/utils";

test("a date stored as a number or an object is passed over, not shown or sorted by", () => {
  const tampered = 100000000000000 as unknown as string;
  assert.equal(firstDateString(tampered, "2026-10-01"), "2026-10-01");
  assert.equal(firstDateString({ at: 1 } as unknown as string), "");
  assert.equal(firstTimestamp(tampered, "2026-10-01T00:00:00.000Z"), Date.parse("2026-10-01T00:00:00.000Z"));
  assert.equal(firstTimestamp(tampered), 0);
});

test("the first candidate that reads as a date is used", () => {
  assert.equal(firstDateString(undefined, "", "not a date", "2026-06-01"), "2026-06-01");
  assert.equal(firstTimestamp(null, "2026-06-01T00:00:00.000Z"), Date.parse("2026-06-01T00:00:00.000Z"));
  assert.equal(firstTimestamp(), 0);
});
