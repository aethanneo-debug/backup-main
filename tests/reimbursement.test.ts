// A seminar paid out of the employee's own pocket, claimed back as a Reimbursement (src/reimbursement.ts).
// Pure functions, no data touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { reimbursementLimit, reimbursementProblem, seminarClaimMode } from "../src/reimbursement";

const money = (n: number) => `PHP ${n.toFixed(2)}`;

test("a seat's report is a Liquidation of a released advance, waits for a request, and is a Reimbursement otherwise", () => {
  assert.equal(seminarClaimMode("Released"), "liquidation");
  assert.equal(seminarClaimMode("Liquidated"), "liquidation", "settled by its report already");
  assert.equal(seminarClaimMode("Requested"), "waiting", "Finance releases or declines it first: never funded twice");
  assert.equal(seminarClaimMode(null), "reimbursement", "no advance at all");
  assert.equal(seminarClaimMode(undefined), "reimbursement");
  assert.equal(seminarClaimMode("Declined"), "reimbursement", "a declined request leaves them to pay themselves");
  assert.equal(seminarClaimMode("Refunded"), "reimbursement", "handed back before the seminar (Part B)");
});

test("the limit is the allowance less what the office paid for them, in whole centavos, never below zero", () => {
  assert.equal(reimbursementLimit(2000, 0), 2000);
  assert.equal(reimbursementLimit(2000, 750.5), 1249.5);
  assert.equal(reimbursementLimit(3333.33, 0.1), 3333.23, "no float drift");
  assert.equal(reimbursementLimit(1000, 1200), 0, "the office paid more than the share");
  assert.equal(reimbursementLimit(null, null), 0);
  assert.equal(reimbursementLimit("1500", "0"), 1500, "stored figures may be text");
  assert.equal(reimbursementLimit(2000, -500), 2000, "a stray negative figure can't raise it past the allowance");
  assert.equal(reimbursementLimit(-100, 0), 0, "nor a negative allowance make one");
});

test("a claim is refused with nothing left, nothing spent, more than the limit, or no receipt", () => {
  assert.match(reimbursementProblem({ spent: 100, limit: 0, files: 1 }, money), /Nothing is left of your share/);
  assert.match(reimbursementProblem({ spent: 0, limit: 2000, files: 1 }, money), /at least one amount above zero/);
  assert.equal(
    reimbursementProblem({ spent: 2000.01, limit: 2000, files: 1 }, money),
    "Your items come to PHP 2000.01, PHP 0.01 more than you can claim back (PHP 2000.00: your share of the seminar's budget, less anything the office paid for you). Lower or remove an item."
  );
  assert.match(reimbursementProblem({ spent: 500, limit: 2000, files: 0 }, money), /Attach your official receipts/);
  assert.equal(reimbursementProblem({ spent: 2000, limit: 2000, files: 1 }, money), "", "exactly the limit");
  assert.equal(reimbursementProblem({ spent: 0.1 + 0.2, limit: 0.3, files: 2 }, money), "", "0.1 + 0.2 is 0.30 in centavos");
  assert.equal(reimbursementProblem({ spent: 500, limit: 2000 }, money), "", "files not counted where none can be added");
});
