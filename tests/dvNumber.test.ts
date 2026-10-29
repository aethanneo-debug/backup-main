// Disbursement voucher numbers, YYYY-MM-NNNN (src/dvNumber.ts). Pure functions, no data touched.
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dvKey, dvNumberFrom, dvPrefix, dvPrefixIn, dvSerialInput, readDvNumber } from "../src/dvNumber";

test("the year and month come from the voucher date; Finance types only the serial", () => {
  assert.equal(dvPrefix("2026-10-29"), "2026-10");
  assert.equal(dvPrefix("2026-02-30"), "", "not a real date");
  assert.equal(dvPrefix(""), "");
  assert.equal(dvSerialInput("asasa"), "", "letters can't be typed");
  assert.equal(dvSerialInput("12ab3"), "123", "digits only");
  assert.equal(dvSerialInput("123456"), "1234", "four at most");
  assert.equal(dvNumberFrom("2026-10-29", "101"), "2026-10-0101", "padded to four digits");
  assert.equal(dvNumberFrom("2026-10-29", "4821"), "2026-10-4821");
  assert.equal(dvNumberFrom("", "101"), "", "no number until the date is chosen");
  assert.equal(dvNumberFrom("2026-10-29", ""), "", "nor until a serial is typed");
});

test("the whole number typed or pasted out of habit still gives its serial, and its month is told apart", () => {
  // Typed key by key, each hyphen starts the serial again, so it ends at the right one.
  let box = "";
  for (const key of "2026-10-0101") box = dvSerialInput(box + key);
  assert.equal(box, "0101", "typed key by key");
  assert.equal(dvSerialInput("2026-10-0101"), "0101", "pasted");
  assert.equal(dvSerialInput("DV 2026-10-0101"), "0101", "pasted with its label");
  assert.equal(dvSerialInput(" 0101"), "0101", "a leading space from a copy");
  assert.equal(dvPrefixIn("2026-09-0101"), "2026-09", "a pasted number from September");
  assert.equal(dvPrefixIn("DV 2026-10-0101 "), "2026-10");
  assert.equal(dvPrefixIn("0101"), "", "a serial alone carries no month");
});

test("the server takes only YYYY-MM-NNNN, in the voucher date's month, never 0000", () => {
  assert.deepEqual(readDvNumber("2026-10-0101", "2026-10-29"), { value: "2026-10-0101" });
  assert.deepEqual(readDvNumber(" 2026-10-0101​ ", "2026-10-29"), { value: "2026-10-0101" }, "cleaned first");
  for (const bad of ["asasa", "", "2026-10-101", "2026-10-01010", "2026/10/0101", "DV-2026-10-0101", "26-10-0101", 20261001, null]) {
    assert.equal("problem" in readDvNumber(bad, "2026-10-29"), true, String(bad));
  }
  assert.deepEqual(readDvNumber("2026-10-0000", "2026-10-29"), { problem: "The voucher's serial can't be 0000." });
  assert.deepEqual(readDvNumber("2026-09-0101", "2026-10-29"), { problem: "The DV number has to start with the voucher date's year and month (2026-10)." });
  assert.deepEqual(readDvNumber("2019-03-0101", ""), { problem: "Choose the voucher's date first." }, "no month is taken without a real date");
});

test("one voucher however it was typed: an earlier free-text number still counts", () => {
  for (const same of ["2026-10-0101", "2026-10-101", "DV 2026-10-0101", " 2026-10-0101 ", "2026/10/101"]) {
    assert.equal(dvKey(same), "2026-10-0101", same);
  }
  assert.notEqual(dvKey("2026-10-0102"), dvKey("2026-10-0101"));
  assert.equal(dvKey("TRN-2026-1792135965246"), "trn-2026-1792135965246", "not a year, month and serial: compared as typed");
  assert.equal(dvKey(""), "");
});
