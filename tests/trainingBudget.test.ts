// The training budget rule (src/trainingBudget.ts): what each seminar takes out of the year's
// training budget, step by step through requirement 6's example, its review rounds, and the
// per-person return of the seminar budget flow (the user's decision, 2026-10-19). Pure
// functions, no data touched. Run with `npm test`.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { seminarBudget, seminarCommitment, isSeminarSettled, allocationIncrease, commitmentAfterEdit } from "../src/trainingBudget";

type Budget = ReturnType<typeof seminarBudget>;
const pick = (b: Budget) => [b.stage, b.share, b.absent, b.released, b.committed, b.returned];
const pickH = (b: Budget) => [b.stage, b.released, b.held, b.heldCount, b.committed, b.returned];
const round2 = (n: number) => Math.round(n * 100) / 100;

// ₱10,000 for 4 seats (a ₱2,500 share each).
const prog = { id: "P", allocatedBudget: 10000, usedBudget: 0, maxParticipants: 4 };
const enrol = (id: string, extra: object = {}): any => ({ id, trainingProgramId: "P", status: "Assigned", ...extra });

describe("requirement 6: unspent money returns to Unallocated", () => {
  test("the walkthrough: A, B and C attend and spend ₱2,800, ₱3,000 and ₱2,500; D doesn't attend", () => {
    let parts: any[] = [enrol("A"), enrol("B"), enrol("C"), enrol("D")];
    assert.deepEqual(pick(seminarBudget(prog, parts)), ["open", 2500, 0, 0, 10000, 0], "enrolled, attendance not recorded: the whole allocation is held");
    parts = parts.map(p => ({ ...p, attendance: p.id === "D" ? "Did not attend" : "Attended" }));
    assert.deepEqual(pick(seminarBudget(prog, parts)), ["open", 2500, 1, 2500, 7500, 0], "D did not attend: their ₱2,500 share is released at once");
    const validate = (id: string, spent: number, used: number) => {
      parts = parts.map(p => p.id === id ? { ...p, status: "Liquidated", settledSpent: spent } : p);
      return { ...prog, usedBudget: used };
    };
    // A validated attendee counts what they spent instead of their share, so A's ₱300 over
    // their share shows at once (B's and C's shares stay held).
    assert.deepEqual(pick(seminarBudget(validate("A", 2800, 2800), parts)), ["open", 2500, 1, 2200, 7800, 0], "A validated at ₱2,800");
    assert.deepEqual(pick(seminarBudget(validate("B", 3000, 5800), parts)), ["open", 2500, 1, 1700, 8300, 0], "B validated at ₱3,000");
    const done = validate("C", 2500, 8300);
    assert.deepEqual(pick(seminarBudget(done, parts)), ["settled", 2500, 1, 0, 8300, 1700], "C validated: settled, counts ₱8,300, ₱1,700 returns");
    assert.equal(isSeminarSettled(done, parts), true, "the non-attendee doesn't keep the seminar open");
    assert.equal(seminarCommitment(done, parts), 8300, "the carry-over reads the same figure");
    // Enrolling someone new reopens it: one more share (₱2,500) on top of what was spent.
    assert.equal(commitmentAfterEdit(done, parts, 10000, true), 10800, "enrolling someone new reopens a settled seminar");
    assert.equal(allocationIncrease(done, parts, 10000, true), 2500, "…which needs one share of room");
    assert.equal(allocationIncrease(done, parts, 10000), 0, "re-saving a settled seminar adds nothing to the ceiling check");
  });

  test("nobody attended, versus a seminar still being planned", () => {
    const p2 = { id: "Q", allocatedBudget: 6000, usedBudget: 0, maxParticipants: 3 };
    const absent2 = [{ trainingProgramId: "Q", status: "Assigned", attendance: "Did not attend" }, { trainingProgramId: "Q", status: "Assigned", attendance: "Did not attend" }];
    assert.deepEqual(pick(seminarBudget(p2, absent2)), ["nobodyAttended", 2000, 2, 0, 0, 6000], "everyone marked absent: counts ₱0, all ₱6,000 returns");
    assert.deepEqual(pick(seminarBudget({ ...p2, usedBudget: 1500 }, absent2)), ["nobodyAttended", 2000, 2, 0, 1500, 4500], "a program-wide cost still counts");
    assert.deepEqual(pick(seminarBudget(p2, [])), ["planning", 2000, 0, 0, 6000, 0], "nobody enrolled yet: the whole ₱6,000 is held");
    assert.deepEqual(pick(seminarBudget(p2, [{ trainingProgramId: "Q", status: "Cancelled", attendance: "Did not attend" }])), ["planning", 2000, 0, 0, 6000, 0], "a cancelled enrolment doesn't count");
  });

  test("overspend, rounding and odd data", () => {
    const over = { id: "R", allocatedBudget: 5000, usedBudget: 6200, maxParticipants: 2 };
    const both = [{ trainingProgramId: "R", status: "Liquidated", attendance: "Attended" }, { trainingProgramId: "R", status: "Liquidated", attendance: "Attended" }];
    assert.deepEqual(pick(seminarBudget(over, both)), ["settled", 2500, 0, 0, 6200, 0], "an approved overspend: counts ₱6,200, nothing returns");
    const thirds = { id: "S", allocatedBudget: 10000, usedBudget: 0, maxParticipants: 3 };
    const one = [{ trainingProgramId: "S", status: "Assigned", attendance: "Did not attend" }, { trainingProgramId: "S", status: "Assigned", attendance: "Attended" }, { trainingProgramId: "S", status: "Assigned" }];
    assert.deepEqual(pick(seminarBudget(thirds, one)), ["open", 3333.33, 1, 3333.33, 6666.67, 0], "a share rounded to centavos");
    const cut = { id: "T", allocatedBudget: 4000, usedBudget: 0, maxParticipants: 2 };
    const three = [{ trainingProgramId: "T", status: "Assigned", attendance: "Did not attend" }, { trainingProgramId: "T", status: "Assigned", attendance: "Attended" }, { trainingProgramId: "T", status: "Assigned", attendance: "Attended" }];
    assert.deepEqual(pick(seminarBudget(cut, three)), ["open", 2000, 1, 0, 4000, 0], "seats cut below the enrolment: nothing is released");
    const parts = [enrol("A", { attendance: "Attended", status: "Liquidated" }), enrol("B", { attendance: "Attended" }), enrol("C", { attendance: "Attended" }), enrol("D", { attendance: "Did not attend" })];
    assert.deepEqual(pick(seminarBudget({ ...prog, usedBudget: 9000 }, parts)), ["open", 2500, 1, 1000, 9000, 0], "spending above the hold counts, and only what is left shows as released");
    assert.equal(seminarBudget({ id: "U", allocatedBudget: 1000 }, []).share, 1000, "no seats recorded: one seat");
  });

  test("the planner's edits and the allocation ceiling use the same rule", () => {
    const parts = [enrol("A", { attendance: "Attended" }), enrol("B", { attendance: "Attended" }), enrol("C", { attendance: "Attended" }), enrol("D", { attendance: "Did not attend" })];
    assert.equal(seminarCommitment(prog, parts, 8000), 6000, "an unsaved cut to ₱8,000 re-prices the share and the release");
    assert.deepEqual([commitmentAfterEdit(prog, parts, 10000, false, 8), allocationIncrease(prog, parts, 10000, false, 8)], [8750, 1250], "more seats shrink the released share");
    assert.equal(allocationIncrease(prog, parts, 10000, false, 2), 7500, "fewer seats with 3 attending: each allowance becomes ₱5,000");
    const q = { id: "Q2", allocatedBudget: 6000, usedBudget: 0, maxParticipants: 3 };
    const twoAbsent = [{ trainingProgramId: "Q2", status: "Assigned", attendance: "Did not attend" }, { trainingProgramId: "Q2", status: "Assigned", attendance: "Did not attend" }];
    assert.equal(allocationIncrease(q, twoAbsent, 6000, true), 2000, "enrolling one more where nobody attended holds one share");
    const overspent = [enrol("A", { attendance: "Attended", status: "Liquidated" }), enrol("B", { attendance: "Attended" }), enrol("C", { attendance: "Attended" }), enrol("D", { attendance: "Did not attend" })];
    assert.deepEqual(pick(seminarBudget({ ...prog, usedBudget: 8000 }, overspent)), ["open", 2500, 1, 2000, 8000, 0], "after an ₱8,000 program-wide cost, only ₱2,000 shows as released");
  });
});

describe("cash advances still out are held (the user's decision, 2026-10-10, and the security re-checks)", () => {
  const open4 = [enrol("A", { attendance: "Attended" }), enrol("B", { attendance: "Attended" }), enrol("C", { attendance: "Attended" }), enrol("D", { attendance: "Did not attend" })];
  const withAdvance = (amt: number) => open4.map(p => p.id === "D" ? { ...p, advanceOutstanding: amt } : p);
  const settledParts = [enrol("A", { attendance: "Attended", status: "Liquidated", settledSpent: 2800 }), enrol("B", { attendance: "Attended", status: "Liquidated", settledSpent: 3000 }), enrol("C", { attendance: "Attended", status: "Liquidated", settledSpent: 2500 }), enrol("D", { attendance: "Did not attend" })];
  const done = { ...prog, usedBudget: 8300 };

  test("a non-attendee's share stays held while their advance is out", () => {
    assert.deepEqual(pickH(seminarBudget(prog, withAdvance(2500))), ["open", 0, 2500, 1, 10000, 0], "advanced ₱2,500 and didn't come");
    assert.deepEqual(pickH(seminarBudget(prog, withAdvance(1000))), ["open", 1500, 1000, 1, 8500, 0], "an advance of ₱1,000");
    const heldD = settledParts.map(p => p.id === "D" ? { ...p, advanceOutstanding: 2500 } : p);
    assert.deepEqual(pickH(seminarBudget(done, heldD)), ["settled", 0, 2500, 1, 10800, 0], "settled with D's ₱2,500 still out");
    assert.deepEqual(pickH(seminarBudget(done, settledParts)), ["settled", 0, 0, 0, 8300, 1700], "once the refund is recorded");
    const nobodyHeld = [0, 1, 2, 3].map(i => ({ trainingProgramId: "P", status: "Assigned", attendance: "Did not attend", advanceOutstanding: i < 2 ? 2500 : 0 }));
    assert.deepEqual(pickH(seminarBudget(prog, nobodyHeld)), ["nobodyAttended", 0, 5000, 2, 5000, 5000], "nobody came and two had advances");
    const aHolds = open4.map(p => p.id === "A" ? { ...p, advanceOutstanding: 2500 } : p);
    assert.equal(seminarBudget(prog, aHolds).held, 0, "an attendee's own advance is never 'held'");
    assert.deepEqual(pickH(seminarBudget(prog, aHolds)), ["open", 2500, 0, 0, 7500, 0], "…and within the allocation it changes nothing");
  });

  test("a seminar never holds less than its spending plus every advance still out", () => {
    const allAdvanced = [enrol("A"), enrol("B"), enrol("C"), enrol("D")].map(p => ({ ...p, advanceOutstanding: 2500 }));
    assert.deepEqual(pickH(seminarBudget(prog, allAdvanced, 0)), ["open", 0, 0, 0, 10000, 0], "₱2,500 to each of 4, then cut to ₱0");
    assert.deepEqual([allocationIncrease(prog, allAdvanced, 0), seminarCommitment(prog, allAdvanced) - seminarCommitment(prog, allAdvanced, 0)], [0, 0], "the cut frees nothing");
    const mixed = [enrol("A", { attendance: "Attended", advanceOutstanding: 1500 }), enrol("B", { attendance: "Attended", advanceOutstanding: 1500 }), enrol("C", { attendance: "Attended" }), enrol("D", { attendance: "Did not attend", advanceOutstanding: 2500 })];
    assert.deepEqual(pickH(seminarBudget(prog, mixed, 4000)), ["open", 0, 2500, 1, 6500, 0], "₱5,500 out, cut to ₱4,000");
    assert.equal(seminarBudget(prog, mixed, 4000).outstanding, 5500, "every advance still out is reported");
  });

  test("the walkthrough with an advance to everyone counts nothing twice", () => {
    let adv: any[] = [enrol("A"), enrol("B"), enrol("C"), enrol("D")].map(p => ({ ...p, advanceOutstanding: 2500, attendance: p.id === "D" ? "Did not attend" : "Attended" }));
    assert.deepEqual(pickH(seminarBudget(prog, adv)), ["open", 0, 2500, 1, 10000, 0], "D's share stays held");
    const validate = (id: string, spent: number) => { adv = adv.map(p => p.id === id ? { ...p, status: "Liquidated", advanceOutstanding: undefined, settledSpent: spent } : p); };
    validate("A", 2800);
    assert.deepEqual(pickH(seminarBudget({ ...prog, usedBudget: 2800 }, adv)), ["open", 0, 2500, 1, 10300, 0], "A validated at ₱2,800 (₱300 over)");
    validate("B", 3000);
    assert.deepEqual(pickH(seminarBudget({ ...prog, usedBudget: 5800 }, adv)), ["open", 0, 2500, 1, 10800, 0], "B validated at ₱3,000");
    validate("C", 2500);
    assert.deepEqual(pickH(seminarBudget(done, adv)), ["settled", 0, 2500, 1, 10800, 0], "C validated: settled with D's ₱2,500 out");
    assert.deepEqual(pickH(seminarBudget(done, adv.map(p => p.id === "D" ? { ...p, advanceOutstanding: undefined } : p))), ["settled", 0, 0, 0, 8300, 1700], "D's refund recorded");
  });

  test("a non-attendee's cash can't stand in for an attendee's share", () => {
    const threeOut = [enrol("A", { attendance: "Attended" }), ...["B", "C", "D"].map(id => enrol(id, { attendance: "Did not attend", advanceOutstanding: 2500 }))];
    assert.deepEqual(pickH(seminarBudget(prog, threeOut)), ["open", 0, 7500, 3, 10000, 0], "₱7,500 out + A's ₱2,500 share");
    assert.deepEqual([commitmentAfterEdit(prog, threeOut, 10000, false, 2), allocationIncrease(prog, threeOut, 10000, false, 2)], [12500, 2500], "cutting seats to 2 makes A's share ₱5,000");
    const twoSeats = { ...prog, maxParticipants: 2 };
    assert.equal(seminarBudget({ ...twoSeats, usedBudget: 5000 }, threeOut.map(p => p.id === "A" ? { ...p, status: "Liquidated", settledSpent: 5000 } : p)).committed, 12500, "A liquidates their ₱5,000: no jump");
    assert.equal(seminarCommitment(prog, threeOut, 7500), 9375, "cutting the allocation to ₱7,500 instead");
    assert.equal(seminarBudget({ id: "P", allocatedBudget: 7500, usedBudget: 1875, maxParticipants: 4 }, threeOut.map(p => p.id === "A" ? { ...p, status: "Liquidated", settledSpent: 1875 } : p)).committed, 9375, "A's ₱1,875 liquidation keeps it at ₱9,375");
  });

  test("an attendee's own cash beyond their share sits on top, and cut seats keep each allowance", () => {
    const onlyA = [enrol("A", { attendance: "Attended", advanceOutstanding: 2500 }), enrol("B"), enrol("C"), enrol("D")];
    assert.equal(seminarCommitment(prog, onlyA, 4000), 5500, "only A advanced ₱2,500, then cut to ₱4,000");
    const p1 = [enrol("A", { advanceOutstanding: 2500 }), enrol("B"), enrol("C"), enrol("D")];
    const p1Absent = p1.map(p => p.id === "A" ? { ...p, attendance: "Did not attend" } : p);
    assert.deepEqual([seminarCommitment(prog, p1, 4000), seminarCommitment(prog, p1Absent, 4000)], [5500, 5500], "marking A absent frees nothing, holds nothing");
    const fourIn = [enrol("A", { attendance: "Attended" }), enrol("B", { attendance: "Attended" }), enrol("C", { attendance: "Attended" }), enrol("D", { attendance: "Attended" })];
    assert.deepEqual([commitmentAfterEdit(prog, fourIn, 10000, false, 1), allocationIncrease(prog, fourIn, 10000, false, 1)], [40000, 30000], "4 attending, seats cut 4 → 1");
    assert.equal(seminarCommitment({ id: "P", allocatedBudget: 12345.67, maxParticipants: 3 }, fourIn), 16460.89, "the floor uses the unrounded share");
  });
});

describe("per person (the seminar budget flow): a validated attendee's leftover returns at once", () => {
  test("the walkthrough: each of four is released their ₱2,500 allowance", () => {
    let roster: any[] = ["A", "B", "C", "D"].map(id => enrol(id, { attendance: "Attended", advanceOutstanding: 2500 }));
    let used = 0;
    const budget = () => seminarBudget({ ...prog, usedBudget: used }, roster);
    const at = () => { const b = budget(); return [b.stage, b.settled, b.released, b.committed, b.returned]; };
    const validate = (id: string, spent: number) => {
      roster = roster.map(p => p.id === id ? { ...p, status: "Liquidated", advanceOutstanding: undefined, settledSpent: spent } : p);
      used = round2(used + spent);
    };
    assert.deepEqual(at(), ["open", 0, 0, 10000, 0], "all four advanced: the whole allocation is out");
    validate("A", 2000);
    assert.deepEqual(at(), ["open", 1, 500, 9500, 0], "A spent ₱2,000 and handed back ₱500: ₱500 returns at once");
    validate("B", 2500);
    assert.deepEqual(at(), ["open", 2, 500, 9500, 0], "B balanced (₱2,500): nothing more returns");
    validate("C", 1750.25);
    assert.deepEqual(at(), ["open", 3, 1249.75, 8750.25, 0], "C handed back ₱749.75");
    validate("D", 2500);
    assert.deepEqual(at(), ["settled", 0, 0, 8750.25, 1249.75], "D was the last: settled at what was spent");
  });

  test("an enrolment liquidated by older code, with no record of its own spending, keeps its share held", () => {
    // Before 2026-09-20 the ledger rows had no enrolment id, and the retired approve_liquidation
    // wrote none: what A spent (₱2,800, in usedBudget) can't be told from a program-wide cost.
    const roster = [enrol("A", { attendance: "Attended", status: "Liquidated" }), enrol("B", { attendance: "Attended" }), enrol("C", { attendance: "Attended" }), enrol("D", { attendance: "Attended" })];
    const b = seminarBudget({ ...prog, usedBudget: 2800 }, roster);
    assert.deepEqual([b.stage, b.settled, b.committed, b.released], ["open", 0, 10000, 0], "A's share stays held: ₱10,000, as before");
    // With A's spending known (its validated report), it counts instead: 2,800 + three shares.
    const known = seminarBudget({ ...prog, usedBudget: 2800 }, roster.map(p => p.id === "A" ? { ...p, settledSpent: 2800 } : p));
    assert.deepEqual([known.settled, known.committed], [1, 10300], "with A's ₱2,800 known: ₱10,300");
  });

  test("with nobody validated (or nobody's spending known) it is exactly requirement 6's rule", () => {
    // The open-stage figure as requirement 6 left it (commit 25ff605, src/trainingBudget.ts).
    const oldOpen = (allocated: number, seats: number, spent: number, roster: any[]) => {
      const units = (p: number) => Math.round(p * 100) * seats;
      const S = Math.round(allocated * 100);
      const attending = roster.filter(p => p.attendance !== "Did not attend");
      const absent = roster.length - attending.length;
      const held = roster.filter(p => p.attendance === "Did not attend").reduce((s, p) => s + units(p.advanceOutstanding || 0), 0);
      const outstanding = roster.reduce((s, p) => s + units(p.advanceOutstanding || 0), 0);
      const absentShares = Math.max(0, Math.min(absent * S, units(allocated) - attending.length * S));
      const attendeesFloor = attending.length > seats ? attending.length * S : 0;
      const excess = attending.reduce((s, p) => s + Math.max(0, units(p.advanceOutstanding || 0) - S), 0);
      return Math.round((Math.max(Math.max(units(allocated) - absentShares, attendeesFloor) + excess, units(spent) + outstanding - held) + held) / seats) / 100;
    };
    // (A "Liquidated" enrolment whose spending isn't known counts as before too.)
    const states = [{ attendance: "Attended" }, {}, { attendance: "Did not attend" }, { attendance: "Attended", advanceOutstanding: 3000 }, { attendance: "Did not attend", advanceOutstanding: 1200 }, { attendance: "Attended", status: "Liquidated" }];
    let tried = 0;
    for (const allocated of [0, 999.99, 4000, 12345.67]) for (const seats of [1, 2, 3, 5]) for (const spent of [0, 1500]) {
      for (const a of states) for (const b of states) {
        const roster = [{ trainingProgramId: "G", status: "Assigned", ...a }, { trainingProgramId: "G", status: "Assigned", ...b }];
        const program = { id: "G", allocatedBudget: allocated, usedBudget: spent, maxParticipants: seats };
        const now = seminarBudget(program, roster);
        if (now.stage !== "open") continue;
        tried++;
        assert.equal(now.committed, oldOpen(allocated, seats, spent, roster), JSON.stringify({ allocated, seats, spent, roster }));
      }
    }
    assert.ok(tried > 300, `${tried} rosters compared`);
  });

  test("validating within the advance never holds more, frees at least what is handed back, and exactly that while others are still to report", () => {
    const others = [
      {}, { attendance: "Attended" }, { attendance: "Attended", advanceOutstanding: 1000 },
      { attendance: "Did not attend" }, { attendance: "Did not attend", advanceOutstanding: 1500 },
      { attendance: "Attended", status: "Liquidated", settledSpent: 900 }
    ];
    let tried = 0, exact = 0;
    for (const allocated of [1000, 4000, 10000, 12345.67]) for (const seats of [1, 2, 3, 4]) for (const programCost of [0, 700]) {
      const share = round2(allocated / seats);
      for (const cash of [share, round2(share / 2), round2(share + 500)]) for (const spent of [0, round2(cash / 3), cash]) {
        for (const o1 of others) for (const o2 of others) {
          const roster = [{ id: "o1", ...o1 }, { id: "o2", ...o2 }].map(p => ({ trainingProgramId: "G", status: "Assigned", ...p }));
          const used = round2(programCost + roster.reduce((s, p: any) => s + (p.settledSpent || 0), 0));
          const x = { id: "x", trainingProgramId: "G", status: "Liquidation Pending", attendance: "Attended", advanceOutstanding: cash };
          const program = { id: "G", allocatedBudget: allocated, usedBudget: used, maxParticipants: seats };
          const before = seminarBudget(program, [x, ...roster]);
          const after = seminarBudget({ ...program, usedBudget: round2(used + spent) },
            [{ ...x, status: "Liquidated", advanceOutstanding: undefined, settledSpent: spent }, ...roster]);
          const freed = round2(before.committed - after.committed);
          const leftover = round2(cash - spent);
          const where = JSON.stringify({ allocated, seats, programCost, cash, spent, roster, before: before.committed, after: after.committed });
          tried++;
          // Within a centavo: a share that doesn't divide evenly (₱10,000 ÷ 3) is held exactly,
          // while the allowance paid out is rounded to centavos (₱3,333.33).
          assert.ok(round2(freed - leftover) >= -0.01, `freed ₱${freed}, less than the ₱${leftover} handed back: ${where}`);
          // The flow's case: the whole allowance was advanced, and someone is still to report.
          if (cash >= share && after.stage === "open") {
            exact++;
            assert.ok(Math.abs(round2(freed - leftover)) <= 0.01, `freed ₱${freed}, not the ₱${leftover} handed back: ${where}`);
          }
        }
      }
    }
    assert.ok(tried > 5000 && exact > 1000, `${tried} validations tried, ${exact} checked to the centavo`);
  });

  test("marking an attendee absent never raises the hold", () => {
    const states = [
      { attendance: "Attended" }, { attendance: "Attended", status: "Liquidated" }, {}, { attendance: "Did not attend" },
      ...[0, 1000, 2500, 3000].map(s => ({ attendance: "Attended", status: "Liquidated", settledSpent: s })),
      ...[500, 2500, 6000].flatMap(a => [{ attendance: "Attended", advanceOutstanding: a }, { advanceOutstanding: a }, { attendance: "Did not attend", advanceOutstanding: a }])
    ];
    let tried = 0;
    for (const allocated of [0, 100, 999.99, 1000, 4000, 10000, 12345.67]) for (const seats of [1, 2, 3, 4, 6, 7]) for (const used of [0, 1500, 8000]) {
      const program = { id: "G", allocatedBudget: allocated, usedBudget: used, maxParticipants: seats };
      const rosters: any[][] = [[]];
      for (let n = 0; n < 3; n++) for (const r of [...rosters]) if (r.length === n) for (const s of states) rosters.push([...r, { id: `g${n}`, trainingProgramId: "G", status: "Assigned", ...s }]);
      for (const roster of rosters) roster.forEach((x, i) => {
        if (x.attendance === "Did not attend" || x.status === "Liquidated") return;
        tried++;
        const before = seminarCommitment(program, roster);
        const after = seminarCommitment(program, roster.map((y, j) => j === i ? { ...y, attendance: "Did not attend" } : y));
        assert.ok(after <= before + 0.005, JSON.stringify({ allocated, seats, used, roster, i, before, after }));
      });
    }
    assert.ok(tried > 500000, `${tried} changes tried`);
  });
});

describe("archived seminars (the user, 2026-10-23: archive instead of delete)", () => {
  test("an unused seminar archived holds nothing: its whole allocation returns, as deleting it did", () => {
    const planned = { ...prog, archivedAt: "2026-10-23T01:00:00.000Z" };
    assert.deepEqual(pick(seminarBudget(prog, [])), ["planning", 2500, 0, 0, 10000, 0], "before: still being planned, the whole allocation is held");
    assert.deepEqual(pick(seminarBudget(planned, [])), ["planning", 2500, 0, 0, 0, 10000], "archived: ₱0 held, ₱10,000 back");
    // Its participants are archived with it, so they drop out of the roster too.
    const taken = [enrol("A", { status: "Archived" }), enrol("B", { status: "Archived" })];
    assert.equal(seminarCommitment(planned, taken), 0, "with its participants archived with it");
    assert.equal(isSeminarSettled(planned, taken), true, "an archived seminar is closed");
  });

  test("a finished seminar archived moves no figure", () => {
    const parts = [enrol("A", { attendance: "Attended", status: "Liquidated", settledSpent: 2800 }), enrol("B", { attendance: "Did not attend" })];
    const finished = { ...prog, usedBudget: 2800 };
    const before = seminarBudget(finished, parts);
    const after = seminarBudget({ ...finished, archivedAt: "2026-10-23T01:00:00.000Z" }, parts);
    assert.deepEqual([before.stage, before.committed, before.returned], ["settled", 2800, 7200], "settled: counts its spending");
    assert.deepEqual([after.committed, after.returned, after.released], [2800, 7200, 0], "archived: the same");
  });

  test("an archived seminar still counts cash that is out, and restoring it holds the allocation again", () => {
    const parts = [enrol("A", { attendance: "Did not attend", advanceOutstanding: 2500 })];
    const archived = { ...prog, archivedAt: "2026-10-23T01:00:00.000Z" };
    assert.equal(seminarCommitment(archived, parts), 2500, "the cash still out stays held (the server refuses to archive it anyway)");
    const restored = { ...prog };
    const planned = [enrol("A"), enrol("B")];
    assert.equal(round2(seminarCommitment(restored, planned) - seminarCommitment({ ...prog, archivedAt: "x" }, [])), 10000,
      "restoring an unused seminar (its participants back) needs its whole allocation of room");
  });
});
