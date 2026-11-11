// HR's dashboard on screen (12ag Part B): what its charts and follow-up list call things, and their colours
// (src/components/dashboard/hr/hrFormat.ts). Pure functions, no data touched. Run with `npm test`. Names are placeholders.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ABSENT_ROSE, ATTENDED_GREEN, BUCKET_LABEL, PENDING_AMBER, STAGE_LABEL, STAGE_TONE, TONE_BADGE, bucketPhrase, dayText,
  dueNote, monthLong, monthShort, monthTick, namesPreview, nextStep, percentText, plural, recordsPhrase, seatedOn,
  seminarsAttended, shortText, stageLabel
} from "../src/components/dashboard/hr/hrFormat";
import type { HrFollowUpStage, HrSeminarAttendance } from "../src/types";

const STAGES: HrFollowUpStage[] = ["requested", "noReport", "withHr", "withFinance", "returned", "reimbursementUnpaid", "attendanceUnrecorded", "refundDue"];

test("each stage in the office's words, coloured in the house system and never purple", () => {
  assert.deepEqual(STAGES.map(s => STAGE_LABEL[s]), [
    "Cash advance with Finance",
    "Cash advance released, no report yet",
    "Report with HR",
    "Report with Finance",
    "Returned for correction",
    "Reimbursement validated, payment pending",
    "Attendance not recorded yet",
    "Did not attend: cash advance to refund"
  ]);
  assert.deepEqual(STAGES.map(s => STAGE_TONE[s]), ["blue", "amber", "amber", "blue", "rose", "amber", "amber", "amber"]);
  // A reimbursement claim says so at each step of its review.
  assert.deepEqual((["withHr", "withFinance", "returned", "noReport"] as HrFollowUpStage[]).map(stage => stageLabel({ stage, claim: true })),
    ["Reimbursement with HR", "Reimbursement with Finance", "Reimbursement returned for correction", "Cash advance released, no report yet"]);
  assert.equal(stageLabel({ stage: "withHr", claim: false }), "Report with HR");
  for (const [tone, classes] of Object.entries(TONE_BADGE)) {
    assert.match(classes, new RegExp(`^border-${tone}-200 bg-${tone}-50 text-${tone}-(700|600)$`), `${tone}: -50 background, -700 text, -200 border`);
    assert.doesNotMatch(classes, /purple|violet|fuchsia/);
  }
  assert.deepEqual([ATTENDED_GREEN, PENDING_AMBER, ABSENT_ROSE], ["#059669", "#d97706", "#e11d48"]);
});

test("who acts next: a covered member of a group's advance waits on its holder", () => {
  assert.equal(nextStep({ stage: "noReport", group: false }), "The employee files the report");
  assert.equal(nextStep({ stage: "noReport", group: true }), "The group's holder files the report");
  assert.equal(nextStep({ stage: "returned", group: true }), "The group's holder corrects the report");
  assert.equal(nextStep({ stage: "withHr", group: true }), "HR verifies the report");
  assert.equal(nextStep({ stage: "reimbursementUnpaid", group: false }), "Finance records the payment");
  for (const stage of STAGES) assert.notEqual(nextStep({ stage, group: false }), "", stage);
  // Someone who has left can't sign in to file or correct, and is paid nothing; a group's holder still acts for them.
  assert.equal(nextStep({ stage: "noReport", group: false, withOffice: false }), "Their logins are closed: the Administrator restores one so they can file the report");
  assert.equal(nextStep({ stage: "returned", group: false, withOffice: false }), "Their logins are closed: the Administrator restores one so they can correct the report");
  assert.equal(nextStep({ stage: "requested", group: false, withOffice: false }), "Finance declines the cash advance: they have left the office");
  assert.equal(nextStep({ stage: "noReport", group: true, withOffice: false }), "The group's holder files the report");
  assert.equal(nextStep({ stage: "withFinance", group: false, withOffice: false }), "Finance validates the report");
  // A claim's steps, and the two kinds of cash out with no report possible yet.
  assert.equal(nextStep({ stage: "withHr", group: false, claim: true }), "HR verifies the claim");
  assert.equal(nextStep({ stage: "withFinance", group: false, claim: true }), "Finance validates the claim");
  assert.equal(nextStep({ stage: "returned", group: false, claim: true }), "The employee corrects the claim");
  assert.equal(nextStep({ stage: "attendanceUnrecorded", group: true }), "The certificate of attendance, then HR records the attendance, so the report can be filed");
  assert.equal(nextStep({ stage: "refundDue", group: false }), "The employee hands the cash advance back; Finance records the refund");
});

test("months as the office writes them, and anything else as it came", () => {
  assert.equal(monthShort("2026-10"), "Oct 2026");
  assert.equal(monthLong("2026-10"), "October 2026");
  assert.deepEqual(monthTick("2027-01"), ["Jan", "2027"]);
  assert.equal(monthShort("2026-13"), "2026-13");
  assert.equal(monthLong("Oct"), "Oct");
  assert.deepEqual(monthTick(""), ["", ""]);
});

test("a calendar day read as one, never through the time zone", () => {
  assert.equal(dayText("2026-11-01"), "Nov 1, 2026");
  assert.equal(dayText("2026-12-31"), "Dec 31, 2026");
  assert.equal(dayText(null), "Not set");
  assert.equal(dayText("2026-02-30"), "Not set", "not a real day");
  assert.equal(dayText("Nov 1"), "Not set");
});

test("what a due date means today: late, or how soon, only for a report still to be filed or corrected, or cash to hand back", () => {
  const asOf = "2026-11-11";
  assert.equal(dueNote({ dueDate: "2026-11-01", overdue: true, stage: "noReport" }, asOf), "10 days late");
  assert.equal(dueNote({ dueDate: "2026-11-10", overdue: true, stage: "returned" }, asOf), "1 day late");
  assert.equal(dueNote({ dueDate: "2026-11-11", overdue: false, stage: "noReport" }, asOf), "Due today");
  assert.equal(dueNote({ dueDate: "2026-11-12", overdue: false, stage: "returned" }, asOf), "Due tomorrow");
  assert.equal(dueNote({ dueDate: "2026-12-01", overdue: false, stage: "noReport" }, asOf), "Due in 20 days");
  assert.equal(dueNote({ dueDate: "2026-11-15", overdue: false, stage: "refundDue" }, asOf), "Due in 4 days", "cash to hand back (12ag's cleanups)");
  assert.equal(dueNote({ dueDate: "2026-11-01", overdue: true, stage: "refundDue" }, asOf), "10 days late");
  assert.equal(dueNote({ dueDate: "2026-11-13", overdue: false, stage: "attendanceUnrecorded" }, asOf), "Due in 2 days", "attendance to record: the employee is reminded on the same days");
  assert.equal(dueNote({ dueDate: "2026-11-01", overdue: false, stage: "withFinance" }, asOf), null, "filed: the reviewers' pace");
  assert.equal(dueNote({ dueDate: "2026-12-01", overdue: false, stage: "requested" }, asOf), null);
  assert.equal(dueNote({ dueDate: null, overdue: false, stage: "noReport" }, asOf), null);
  assert.equal(dueNote({ dueDate: "2026-12-01", overdue: false, stage: "noReport" }, "not a day"), null);
});

test("the trainings-per-employee buckets in words", () => {
  assert.deepEqual(Object.values(BUCKET_LABEL), ["0", "1", "2", "3 or more"]);
  assert.equal(bucketPhrase("0", 5), "5 employees haven't attended a training yet");
  assert.equal(bucketPhrase("0", 1), "1 employee hasn't attended a training yet");
  assert.equal(bucketPhrase("1", 1), "1 employee attended 1 training");
  assert.equal(bucketPhrase("2", 3), "3 employees attended 2 trainings");
  assert.equal(bucketPhrase("3+", 2), "2 employees attended 3 or more trainings");
  assert.equal(recordsPhrase(0), "No trainings recorded by HR");
  assert.equal(recordsPhrase(1), "1 training recorded by HR");
  assert.equal(recordsPhrase(4), "4 trainings recorded by HR");
});

test("counts, shares and short labels", () => {
  assert.equal(plural(1, "day"), "1 day");
  assert.equal(plural(0, "day"), "0 days");
  assert.equal(plural(2, "person", "people"), "2 people");
  assert.equal(percentText(14, 22), "64%");
  assert.equal(percentText(0, 0), "—", "no staff: no share to give");
  assert.equal(shortText("Office of the Chief Regional Adjudicator", 20), "Office of the Chief…");
  assert.equal(shortText("Legal Division", 20), "Legal Division");
  assert.equal(shortText(42, 5), "42");
});

test("about a dozen names, then how many more", () => {
  const names = Array.from({ length: 15 }, (_, i) => `Staff ${i + 1}`);
  assert.deepEqual(namesPreview(names, 12), { shown: names.slice(0, 12), more: 3 });
  assert.deepEqual(namesPreview(["Staff One", "", null, 7, "Staff Two"]), { shown: ["Staff One", "Staff Two"], more: 0 }, "only names");
  assert.deepEqual(namesPreview(undefined), { shown: [], more: 0 });
});

test("the trainings attended, for the ring's tooltip: the most attended first, then the earliest", () => {
  const sem = (id: string, startDate: string, attended: number, didNotAttend = 0, toRecord = 0): HrSeminarAttendance =>
    ({ id, title: `Seminar ${id}`, startDate, endDate: startDate, attended, didNotAttend, toRecord, attendees: [] });
  const list = [sem("a", "2026-10-01", 2), sem("b", "2026-09-01", 5), sem("c", "2026-08-01", 2), sem("d", "2026-07-01", 0, 3, 1)];
  const { shown, more } = seminarsAttended(list, 10);
  assert.deepEqual(shown.map(s => s.id), ["b", "c", "a"], "nobody attended d (yet), so it isn't listed");
  assert.equal(more, 0);
  assert.deepEqual(seminarsAttended(list, 2).shown.map(s => s.id), ["b", "c"]);
  assert.equal(seminarsAttended(list, 2).more, 1);
  assert.deepEqual(seminarsAttended(null), { shown: [], more: 0 });
  assert.equal(seatedOn(list[3]), 4);
});
