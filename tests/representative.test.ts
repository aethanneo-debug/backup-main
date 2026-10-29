// Sending a representative (12z Part B): what the swap does with the original's cash advance, row by
// row of the table the user approved (decision 4, 2026-10-28).
import { test } from "node:test";
import assert from "node:assert/strict";
import { swapAdvanceStep } from "../src/representative";

const own = (id: string, status: string, activityId = "e1") => ({ id, activityId, status, amount: 5000, employeeId: "EMP1" });
const group = (id: string, status: string, holder: string, members: string[]) => ({
  id, activityId: holder, status, amount: 5000 * (members.length + 1), employeeId: "EMP-H",
  covers: [holder, ...members].map((p) => ({ participantId: p, amount: 5000 }))
});

test("no advance, or one declined, refunded or settled: the swap goes ahead", () => {
  assert.deepEqual(swapAdvanceStep([], "e1"), { action: "proceed" });
  assert.deepEqual(swapAdvanceStep(null, "e1"), { action: "proceed" });
  for (const status of ["Declined", "Refunded", "Liquidated", "Cancelled"]) {
    assert.deepEqual(swapAdvanceStep([own("a1", status)], "e1"), { action: "proceed" }, status);
  }
  assert.deepEqual(swapAdvanceStep([own("a1", "Released", "e9")], "e1"), { action: "proceed" }, "someone else's advance");
});

test("their own request, not yet released, is closed", () => {
  assert.deepEqual(swapAdvanceStep([own("a1", "Declined"), own("a2", "Requested")], "e1"), { action: "closeRequest", advanceId: "a2" });
});

test("covered by someone else's unreleased group request: taken off it", () => {
  assert.deepEqual(swapAdvanceStep([group("g1", "Requested", "e0", ["e1", "e2"])], "e1"), { action: "leaveGroup", advanceId: "g1" });
});

test("the swap waits for a group request they hold, their own advance out, or a group's released", () => {
  assert.deepEqual(swapAdvanceStep([group("g1", "Requested", "e1", ["e2"])], "e1"), { action: "wait", why: "holdsGroupRequest", advanceId: "g1" });
  assert.deepEqual(swapAdvanceStep([own("a1", "Released")], "e1"), { action: "wait", why: "ownAdvanceOut", advanceId: "a1" });
  assert.deepEqual(swapAdvanceStep([group("g1", "Released", "e0", ["e1"])], "e1"), { action: "wait", why: "groupAdvanceOut", advanceId: "g1" });
  assert.deepEqual(swapAdvanceStep([group("g1", "Released", "e1", ["e2"])], "e1"), { action: "wait", why: "groupAdvanceOut", advanceId: "g1" }, "a released group they hold");
  // Cash out wins over a request (there is never both, but the money comes first).
  assert.deepEqual(swapAdvanceStep([own("a2", "Requested"), own("a1", "Released")], "e1"), { action: "wait", why: "ownAdvanceOut", advanceId: "a1" });
});
