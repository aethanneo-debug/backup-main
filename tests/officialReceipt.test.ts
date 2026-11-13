// The official receipt (OR) the Finance Officer records for cash handed back (src/officialReceipt.ts, 12ai): for a full
// refund and for a liquidation report's leftover, one reading. Pure, no data touched. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OR_NUMBER_MAX, orKey, readRefundOr } from "../src/officialReceipt";

const facts = (over: Partial<Parameters<typeof readRefundOr>[1]> = {}) => ({
  today: "2026-11-12", releasedOn: "2026-11-02", usedOn: () => null, ...over
});
const problem = (raw: { orNo: unknown; orDate: unknown }, over: Partial<Parameters<typeof readRefundOr>[1]> = {}) => {
  const r = readRefundOr(raw, facts(over));
  return "problem" in r ? r.problem : "";
};

test("an OR is a number of at most 50 characters and a real date between the cash going out and today", () => {
  assert.deepEqual(readRefundOr({ orNo: " 0247983 ", orDate: "2026-11-12" }, facts()), { value: { orNo: "0247983", orDate: "2026-11-12" } });
  assert.deepEqual(readRefundOr({ orNo: "0247983", orDate: "2026-11-02" }, facts()), { value: { orNo: "0247983", orDate: "2026-11-02" } }, "on the DV's own day");
  assert.match(problem({ orNo: "", orDate: "2026-11-12" }), /^Enter the official receipt \(OR\) number of the refund, up to 50 characters\.$/);
  assert.match(problem({ orNo: "​‎", orDate: "2026-11-12" }), /OR\) number/, "invisible characters only");
  assert.match(problem({ orNo: "7".repeat(OR_NUMBER_MAX + 1), orDate: "2026-11-12" }), /up to 50 characters/);
  assert.equal(problem({ orNo: "7".repeat(OR_NUMBER_MAX), orDate: "2026-11-12" }), "");
  assert.match(problem({ orNo: 247983, orDate: "2026-11-12" }), /OR\) number/, "not text");
  assert.equal(problem({ orNo: "1", orDate: "2026-11-13" }), "Enter the OR date as YYYY-MM-DD, no later than today.");
  assert.equal(problem({ orNo: "1", orDate: "2026-02-30" }), "Enter the OR date as YYYY-MM-DD, no later than today.");
  assert.equal(problem({ orNo: "1", orDate: "11/12/2026" }), "Enter the OR date as YYYY-MM-DD, no later than today.");
  assert.equal(problem({ orNo: "1", orDate: "2026-11-01" }), "The OR date can't be before the advance was released (DV dated 2026-11-02).");
  assert.equal(problem({ orNo: "1", orDate: "2026-11-01" }, { releasedOn: undefined }), "", "with no DV date on record, only today bounds it");
});

test("each OR is used once, compared as cleaned", () => {
  const seen: string[] = [];
  const usedOn = (n: string) => { seen.push(n); return n === "0247983" ? "LIQSUB-2026-014" : null; };
  assert.equal(problem({ orNo: "0247983​", orDate: "2026-11-12" }, { usedOn }),
    "OR 0247983 is already recorded on LIQSUB-2026-014. Each official receipt is used once: check the number.");
  assert.deepEqual(seen, ["0247983"], "the duplicate check sees the cleaned number");
});

test("the checks run in the refund route's order: number, used, date, before the DV", () => {
  const usedOn = () => "CA-1";
  assert.match(problem({ orNo: "", orDate: "bad" }, { usedOn }), /OR\) number/);
  assert.match(problem({ orNo: "7", orDate: "bad" }, { usedOn }), /already recorded on CA-1/);
  assert.match(problem({ orNo: "7", orDate: "2020-01-01" }), /before the advance was released/);
});

test("an OR number is shaped as a receipt's serial (12ai's security review)", () => {
  for (const ok of ["0247983", "OR 0247983", "No. 0247983", "A-0247983", "2026/0247983", "#0247983"]) assert.equal(problem({ orNo: ok, orDate: "2026-11-12" }), "", ok);
  const shape = /^Enter the OR number as printed on the receipt/;
  assert.match(problem({ orNo: "Paid: see note", orDate: "2026-11-12" }), shape, "punctuation an OR doesn't have");
  assert.match(problem({ orNo: "0247983 \"recorded\"", orDate: "2026-11-12" }), shape, "quotes");
  assert.match(problem({ orNo: "О247983", orDate: "2026-11-12" }), shape, "a Cyrillic O");
  assert.match(problem({ orNo: "OR-PENDING", orDate: "2026-11-12" }), shape, "no digit");
  assert.match(problem({ orNo: "-0247983", orDate: "2026-11-12" }), shape, "starting with punctuation");
  assert.equal(problem({ orNo: "０２４７", orDate: "2026-11-12" }), "", "full-width digits are read as digits");
});

test("one receipt however it was typed: the key the used-once check compares (12ai's security review)", () => {
  for (const same of ["0247983", "247983", "0247 983", "0247-983", "OR 0247983", "O.R. No. 0247983", "No. 0247983", "or#0247983", "０２４７９８３"]) {
    assert.equal(orKey(same), "247983", same);
  }
  assert.notEqual(orKey("A-12"), orKey("B-12"), "another series is another receipt");
  assert.notEqual(orKey("0247983"), orKey("0247984"));
  assert.equal(orKey("0"), "0");
  assert.equal(orKey(247983), "", "not text");
  const seen: string[] = [];
  problem({ orNo: "OR 0247-983", orDate: "2026-11-12" }, { usedOn: (n: string) => { seen.push(n); return null; } });
  assert.deepEqual(seen, ["OR 0247-983"], "the check gets the number as cleaned; the route compares its key");
});
