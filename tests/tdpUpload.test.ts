// The TDP uploaded once a year (the instructor's review, R9). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { TdpUpload } from "../src/types";
import { currentTdp, planTdpReplace, recordsBeforeUploads, seatedFor, seminarsLeavingTdp, tdpCounts, tdpNeedKey, type TdpPlanNeed } from "../src/tdpUpload";

const need = (employeeId: string, title: string, extra: Partial<TdpPlanNeed> = {}): TdpPlanNeed & { id: string } =>
  ({ id: `${employeeId}-${title}`, employeeId, category: "Function", title, ...extra });

test("a need is compared by person, column and title, case and punctuation aside", () => {
  assert.equal(tdpNeedKey(need("e1", "RA 12009 (Procurement)")), tdpNeedKey(need("e1", "ra 12009 procurement")));
  assert.notEqual(tdpNeedKey(need("e1", "Records")), tdpNeedKey(need("e2", "Records")));
  assert.notEqual(tdpNeedKey(need("e1", "Records")), tdpNeedKey({ ...need("e1", "Records"), category: "Career Advancement" }));
});

test("a replacement keeps what both list, adds what is new, and removes what nothing uses", () => {
  const current = [need("e1", "Records"), need("e1", "Ethics"), need("e2", "Records")];
  const plan = planTdpReplace(current, [need("e1", "records"), need("e2", "Records"), need("e2", "Procurement")], () => null);
  assert.deepEqual(plan.unchanged.map(n => n.id), ["e1-Records", "e2-Records"]);
  assert.deepEqual(plan.added.map(n => `${n.employeeId} ${n.title}`), ["e2 Procurement"]);
  assert.deepEqual(plan.removed.map(n => n.id), ["e1-Ethics"]);
  assert.deepEqual(plan.kept, []);
});

test("a need the amended TDP leaves out stays while it is in use, with why", () => {
  const current = [need("e1", "Records"), need("e2", "Ethics"), need("e3", "Safety")];
  const plan = planTdpReplace(current, [], n =>
    n.title === "Records" ? { reason: "seminar", detail: "Records Seminar" } : n.title === "Ethics" ? { reason: "accomplished", detail: "Override" } : null);
  assert.deepEqual(plan.kept.map(k => [k.need.id, k.use.reason, k.use.detail]), [["e1-Records", "seminar", "Records Seminar"], ["e2-Ethics", "accomplished", "Override"]]);
  assert.deepEqual(plan.removed.map(n => n.id), ["e3-Safety"]);
});

test("needs carried from an earlier year are never part of a TDP: always kept, never added twice", () => {
  const current = [need("e1", "Records", { carriedFromFiscalYear: "2026" }), need("e1", "Ethics")];
  let asked = 0;
  const plan = planTdpReplace(current, [need("e1", "Records")], () => { asked++; return null; });
  assert.deepEqual(plan.carried.map(n => n.id), ["e1-Records"]);
  assert.deepEqual(plan.added, [], "the file's copy of a carried need isn't added again");
  assert.deepEqual(plan.removed.map(n => n.id), ["e1-Ethics"]);
  assert.equal(asked, 1, "only the year's own needs are checked for use");
});

test("a need listed twice in the file is added once", () => {
  const plan = planTdpReplace([], [need("e1", "Records"), need("e1", "RECORDS"), need("e2", "Records")], () => null);
  assert.equal(plan.added.length, 2);
});

test("a need the amended TDP lists for the same person under another column is moved there, in use or not", () => {
  const current = [need("e1", "RA 12009"), need("e2", "Records")];
  const plan = planTdpReplace(current,
    [need("e1", "ra 12009", { category: "Additional Function" }), need("e2", "Records", { category: "Career Advancement" })],
    n => (n.employeeId === "e1" ? { reason: "seminar", detail: "Procurement Seminar" } : null));
  assert.deepEqual(plan.moved.map(m => [m.need.id, m.category]), [["e1-RA 12009", "Additional Function"], ["e2-Records", "Career Advancement"]]);
  assert.deepEqual([plan.added, plan.removed, plan.kept, plan.unchanged], [[], [], [], []], "not added as a copy, nor kept beside it");
});

test("a move takes one need to one column: the rest is left out, or added, as usual", () => {
  const twoColumns = planTdpReplace([need("e1", "X"), need("e1", "X", { category: "Additional Function", id: "e1-X-2" } as never)],
    [need("e1", "X", { category: "Career Advancement" })], () => null);
  assert.deepEqual(twoColumns.moved.map(m => [m.need.id, m.category]), [["e1-X", "Career Advancement"]]);
  assert.deepEqual(twoColumns.removed.map(n => n.id), ["e1-X-2"]);
  const ownAndAnother = planTdpReplace([need("e1", "X")], [need("e1", "X"), need("e1", "X", { category: "Additional Function" })], () => null);
  assert.deepEqual([ownAndAnother.unchanged.map(n => n.id), ownAndAnother.added.map(n => n.category), ownAndAnother.moved], [["e1-X"], ["Additional Function"], []]);
  const carried = planTdpReplace([need("e1", "X", { carriedFromFiscalYear: "2026" })], [need("e1", "X", { category: "Additional Function" })], () => null);
  assert.deepEqual([carried.moved, carried.added.map(n => n.category), carried.carried.length], [[], ["Additional Function"], 1], "a carried need isn't the TDP's to move");
});

test("a left-out copy isn't kept for a seat while its person keeps the training in another column", () => {
  const current = [need("e1", "X"), need("e1", "X", { category: "Additional Function", carriedFromFiscalYear: "2026", id: "e1-X-carried" } as never)];
  const amended = [need("e1", "X", { category: "Additional Function" })];
  const seated = planTdpReplace(current, amended, () => ({ reason: "seminar", detail: "S" }));
  assert.deepEqual([seated.removed.map(n => n.id), seated.kept, seated.added, seated.moved, seated.carried.map(n => n.id)], [["e1-X"], [], [], [], ["e1-X-carried"]],
    "the carried copy keeps them identified, so the left-out one goes rather than list the training twice");
  const accomplished = planTdpReplace(current, amended, () => ({ reason: "accomplished", detail: "Override" }));
  assert.deepEqual(accomplished.kept.map(k => k.need.id), ["e1-X"], "an accomplished one still stays");
});

test("a seminar keeps a need only for the person seated for it, on a seat still standing", () => {
  const seminars = [
    { id: "s1", title: "Procurement Seminar", fulfillsNeedTitles: ["RA 12009 (Procurement)", "BAC Basics"] },
    { id: "s2", title: "Ethics", fulfillsNeedTitles: ["Ethics"] }
  ];
  const seats = [
    { trainingProgramId: "s1", employeeId: "EMP001", status: "Assigned" },
    { trainingProgramId: "s1", employeeId: "e2", status: "Cancelled" },
    { trainingProgramId: "s2", employeeId: "e3", status: "Archived" },
    { trainingProgramId: "gone", employeeId: "e4", status: "Assigned" },
    null, "x"
  ];
  const seated = seatedFor(seats, seminars, id => (id === "EMP001" ? "e1" : id));
  assert.deepEqual([...seated.entries()].sort(), [["e1|bac basics", "Procurement Seminar"], ["e1|ra 12009 procurement", "Procurement Seminar"]],
    "read as the plan reads people; cancelled and archived seats, and seminars not in the year, don't count");
  // The user's decision of 2026-11-02: a colleague's seat doesn't keep a dropped need.
  const plan = planTdpReplace([need("e1", "RA 12009 (Procurement)"), need("e2", "RA 12009 (Procurement)")], [],
    n => (seated.has(`${n.employeeId}|${n.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`) ? { reason: "seminar", detail: "Procurement Seminar" } : null));
  assert.deepEqual([plan.kept.map(k => k.need.id), plan.removed.map(n => n.id)], [["e1-RA 12009 (Procurement)"], ["e2-RA 12009 (Procurement)"]]);
});

test("the seminars a replacement would leave covering nothing in the plan are named", () => {
  const seminars = [
    { id: "a", title: "Keeps one", fulfillsNeedTitles: ["X", "Y"] },
    { id: "b", title: "Loses all", fulfillsNeedTitles: ["Y"] },
    { id: "c", title: "Was outside already", fulfillsNeedTitles: ["Z"] },
    { id: "d", title: "Justified", fulfillsNeedTitles: ["Y"], tdpException: { kind: "Other" } },
    { id: "e", title: "Archived", fulfillsNeedTitles: ["Y"], archivedAt: "2026-10-30T00:00:00.000Z" }
  ];
  assert.deepEqual(seminarsLeavingTdp(seminars, new Set(["x", "y"]), new Set(["x"])), [{ id: "b", title: "Loses all" }]);
  assert.deepEqual(seminarsLeavingTdp(seminars, new Set(["x", "y"]), new Set(["x", "y"])), []);
});

const record = (fiscalYear: string, id: string): TdpUpload =>
  ({ id, fiscalYear, kind: "upload", filename: "", sheetName: "", uploadedAt: "", uploadedBy: "", uploadedByName: "", needs: 0, employees: 0 });

test("the TDP in force is the latest record for the year", () => {
  const records = [record("2027", "a"), record("2026", "b"), record("2027", "c")];
  assert.equal(currentTdp(records, "2027")?.id, "c");
  assert.equal(currentTdp(records, "2026")?.id, "b");
  assert.equal(currentTdp(records, "2028"), null);
  assert.equal(currentTdp(null, "2027"), null);
  assert.equal(currentTdp([null as never, record("2027", "d")], "2027")?.id, "d");
});

test("the TDP in force comes back clean, so a damaged entry can't put an object where the screens expect text", () => {
  const damaged = { id: "z", fiscalYear: "2027", kind: "odd", filename: { a: 1 }, needs: "many", employees: -3, changes: { added: "2", kept: 1.5 }, keptNeedIds: [1, "n1", null] };
  assert.deepEqual(currentTdp([damaged], "2027"), {
    id: "z", fiscalYear: "2027", kind: "upload", filename: "", sheetName: "", uploadedAt: "", uploadedBy: "", uploadedByName: "",
    needs: 0, employees: 0, changes: { added: 0, removed: 0, kept: 1, moved: 0 }, keptNeedIds: ["n1"]
  }, "it still counts as uploaded");
  assert.equal(currentTdp([{ fiscalYear: "2027", kind: "replace" }, "x", 7], "2027")?.kind, "replace");
});

test("a year's counts leave carried needs out of the TDP", () => {
  const needs = [
    { ...need("e1", "A"), fiscalYear: "2027" }, { ...need("e1", "B"), fiscalYear: "2027" }, { ...need("e2", "A"), fiscalYear: "2027" },
    { ...need("e3", "C", { carriedFromFiscalYear: "2026" }), fiscalYear: "2027" }, { ...need("e4", "D"), fiscalYear: "2026" }
  ];
  assert.deepEqual(tdpCounts(needs, "2027"), { needs: 3, employees: 2, carried: 1 });
  assert.deepEqual(tdpCounts(undefined, "2027"), { needs: 0, employees: 0, carried: 0 });
});

const importEntry = (timestamp: string, fiscalYear: string, file: string, username = "hr") => ({
  action: "Import Plan A Workbook", timestamp, username,
  details: `Imported 456 training need(s) from "${file}" sheet "Plan A - ${fiscalYear}" into the ${fiscalYear} plan for 17 employee(s); 0 row(s) skipped.`
});

test("a year imported before uploads were recorded gets its record from the latest import in the audit log", () => {
  const records = recordsBeforeUploads({
    needs: [{ ...need("e1", "A"), fiscalYear: "2027" }, { ...need("e2", "B"), fiscalYear: "2027" }],
    records: [],
    auditLogs: [importEntry("2026-10-16T01:00:00.000Z", "2027", "old.xlsx"), importEntry("2026-10-30T01:00:00.000Z", "2027", "RAB-1 TDP 2027.xlsx", "admin"), importEntry("2026-10-31T01:00:00.000Z", "2026", "other.xlsx")],
    fullNameOf: u => (u === "admin" ? "An Administrator" : "")
  });
  assert.deepEqual(records, [{
    id: "tdp-2027-before-records", fiscalYear: "2027", kind: "before-records", filename: "RAB-1 TDP 2027.xlsx", sheetName: "Plan A - 2027",
    uploadedAt: "2026-10-30T01:00:00.000Z", uploadedBy: "admin", uploadedByName: "An Administrator", needs: 2, employees: 2
  }]);
});

test("only a year with needs of its own, and no record yet, gets one; with no import in the log it is left blank", () => {
  const records = recordsBeforeUploads({
    needs: [
      { ...need("e1", "A"), fiscalYear: "2027" },
      { ...need("e1", "B", { carriedFromFiscalYear: "2026" }), fiscalYear: "2028" },
      { ...need("e1", "C"), fiscalYear: "2029" }
    ],
    records: [record("2029", "x")],
    auditLogs: [{ action: "Import Plan A Workbook", details: 7, timestamp: "2026-10-30T01:00:00.000Z" }, null, "junk"],
    fullNameOf: () => "never"
  });
  assert.deepEqual(records.map(r => [r.fiscalYear, r.filename, r.uploadedAt, r.uploadedBy, r.uploadedByName]), [["2027", "", "", "", ""]]);
});

test("an old entry's names are cleaned, and one too long to be the import's own is passed over", () => {
  const records = recordsBeforeUploads({
    needs: [{ ...need("e1", "A"), fiscalYear: "2027" }],
    records: [],
    auditLogs: [
      importEntry("2026-10-16T01:00:00.000Z", "2027", "plan‮.xlsx"),
      { ...importEntry("2026-10-30T01:00:00.000Z", "2027", "later.xlsx"), details: importEntry("", "2027", "x".repeat(2500)).details },
      { ...importEntry("not a date", "2027", "undated.xlsx") }
    ],
    fullNameOf: () => "An⁦ Officer"
  });
  assert.deepEqual(records.map(r => [r.filename, r.uploadedAt, r.uploadedByName]), [["plan.xlsx", "2026-10-16T01:00:00.000Z", "An Officer"]]);
});

test("damaged data can't stop the server loading", () => {
  assert.deepEqual(recordsBeforeUploads({ needs: "x", records: { a: 1 }, auditLogs: 5, fullNameOf: () => "" }), []);
  assert.deepEqual(recordsBeforeUploads({ needs: [null, 3, { fiscalYear: 2027 }], records: null, auditLogs: [], fullNameOf: () => "" }), []);
});
