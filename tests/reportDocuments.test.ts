// Which documents a seminar's report needs (src/reportDocuments.ts, the instructor's review R5), and when a
// certificate of attendance can be uploaded (src/attendanceCertificate.ts, R4). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DocumentKind } from "../src/types";
import {
  DOCUMENT_SLOTS,
  EMPLOYEE_KINDS,
  employeeAskedKinds,
  FINANCE_KINDS,
  UPLOAD_KINDS,
  correctionSlots,
  documentPlate,
  filedUnderDocuments,
  missingDocuments,
  missingDocumentsText,
  noTravelProblem,
  readDeclarations,
  readDocumentKind,
  requiredDocuments,
  type ReportFacts
} from "../src/reportDocuments";
import {
  MAX_CERTIFICATE_UPLOADS,
  MAX_OFFICER_CERTIFICATE_UPLOADS,
  certificateDocumentName,
  certificateUploadProblem,
  clockText,
  manilaMoment,
  seminarFirstDay,
  seminarHasEnded,
  seminarLastDay,
  type CertificateSeat
} from "../src/attendanceCertificate";

const report = (over: Partial<ReportFacts> = {}): ReportFacts => ({ reimbursement: false, expenseTypes: [], declarations: [], ...over });
const kinds = (facts: ReportFacts) => requiredDocuments(facts).map(r => r.kind);

test("every report of a cash advance needs the certificate and the two travel documents", () => {
  assert.deepEqual(kinds(report()), ["certificate", "itinerary", "travelCompleted"]);
});

test("no travel takes the two travel documents off, and nothing else", () => {
  assert.deepEqual(kinds(report({ declarations: ["noTravel"] })), ["certificate"]);
  assert.deepEqual(kinds(report({ declarations: ["noTravel"], expenseTypes: ["Meals", "Registration Fee"] })), ["certificate"]);
});

test("a Transportation or Accommodation line brings the travel documents back, whatever was ticked", () => {
  // A correction can add the line, and ticks stay as filed.
  const fare = requiredDocuments(report({ declarations: ["noTravel"], expenseTypes: ["Meals", "Transportation"] }));
  assert.deepEqual(fare.map(r => r.kind), ["certificate", "itinerary", "travelCompleted", "tickets"]);
  assert.equal(fare.find(r => r.kind === "itinerary")!.why, "You claimed Transportation");
  assert.equal(fare.find(r => r.kind === "travelCompleted")!.why, "You claimed Transportation");
  const lodging = requiredDocuments(report({ declarations: ["noTravel"], expenseTypes: ["Meals", "Accommodation"] }));
  assert.deepEqual(lodging.map(r => r.kind), ["certificate", "itinerary", "travelCompleted", "hotelBills"]);
  assert.equal(lodging.find(r => r.kind === "itinerary")!.why, "You claimed Accommodation");
  assert.equal(requiredDocuments(report()).find(r => r.kind === "itinerary")!.why, "Required on every report");
});

test("\"No travel\" has to agree with the trip", () => {
  assert.equal(noTravelProblem({ vehicleRequest: false, expenseTypes: ["Meals", "Registration Fee", "Materials", "Miscellaneous"] }), "");
  assert.match(noTravelProblem({ vehicleRequest: true, expenseTypes: [] }), /vehicle request stands/);
  assert.equal(noTravelProblem({ vehicleRequest: false, expenseTypes: ["Meals", "Transportation"] }), "You claimed Transportation, so \"No travel\" can't be ticked.");
  assert.equal(noTravelProblem({ vehicleRequest: false, expenseTypes: ["Accommodation"] }), "You claimed Accommodation, so \"No travel\" can't be ticked.");
  assert.match(noTravelProblem({ vehicleRequest: false, expenseTypes: ["Accommodation", "Transportation"] }), /You claimed Transportation/, "one reason at a time");
  assert.match(noTravelProblem({ vehicleRequest: true, expenseTypes: ["Transportation"] }), /vehicle request/, "the vehicle is named first");
});

test("the report's own lines bring their documents", () => {
  assert.ok(kinds(report({ expenseTypes: ["Meals", "Transportation"] })).includes("tickets"));
  assert.ok(kinds(report({ expenseTypes: ["Accommodation"] })).includes("hotelBills"));
  assert.deepEqual(kinds(report({ expenseTypes: ["Meals", "Registration Fee", "Materials", "Miscellaneous"] })), ["certificate", "itinerary", "travelCompleted"]);
});

test("the OR for cash handed back is the Finance Officer's: never the employee's to attach, nor to be asked for (12ai)", () => {
  // HSAC RAB 1 has no cashier: Finance issues the OR and attaches it when validating, and validation waits for it.
  assert.deepEqual(FINANCE_KINDS, ["refundOr"]);
  assert.ok(!kinds(report({ expenseTypes: ["Transportation", "Accommodation"], declarations: ["overRate", "scheduleChanged"] })).includes("refundOr"));
  assert.ok(!EMPLOYEE_KINDS.includes("refundOr") && !EMPLOYEE_KINDS.includes("certificate"));
  assert.deepEqual(EMPLOYEE_KINDS, UPLOAD_KINDS.filter(k => k !== "refundOr"));
  // A stored one keeps its slot and name plate, wherever the file is listed.
  assert.equal(readDocumentKind("refundOr"), "refundOr");
  assert.equal(documentPlate("refundOr"), "OR, Excess Cash Advance");
});

test("each tick brings its document", () => {
  assert.ok(kinds(report({ declarations: ["scheduleChanged"] })).includes("revisedOrder"));
  assert.ok(kinds(report({ declarations: ["itineraryNotFollowed"] })).includes("revisedItinerary"));
  assert.ok(kinds(report({ declarations: ["overRate"] })).includes("headCertification"));
  assert.ok(kinds(report({ declarations: ["noOfficialReceipt"] })).includes("rer"));
});

test("a Reimbursement needs only its certificate and official receipts", () => {
  assert.deepEqual(kinds(report({ reimbursement: true, expenseTypes: ["Accommodation", "Transportation"], declarations: ["overRate"] })), ["certificate", "receipts"]);
});

test("each required document says why, in the form's order", () => {
  const all = requiredDocuments(report({ expenseTypes: ["Transportation", "Accommodation"], declarations: ["overRate"] }));
  assert.deepEqual(all.map(r => r.kind), DOCUMENT_SLOTS.map(s => s.kind).filter(k => all.some(r => r.kind === k)));
  assert.ok(all.every(r => r.why));
  assert.match(all.find(r => r.kind === "headCertification")!.why, /prescribed rate/);
});

test("what is missing, and how it reads", () => {
  const required = requiredDocuments(report({ expenseTypes: ["Transportation"] }));
  assert.deepEqual(missingDocuments(required, ["certificate", "itinerary"]), ["travelCompleted", "tickets"]);
  assert.deepEqual(missingDocuments(required, ["certificate", "itinerary", "travelCompleted", "tickets", "tickets"]), []);
  assert.equal(missingDocumentsText([]), "");
  assert.equal(missingDocumentsText(["itinerary"]), "Still needed: Itinerary of Travel.");
  assert.equal(missingDocumentsText(["itinerary", "tickets", "rer"]), "Still needed: Itinerary of Travel, Tickets and RER.");
});

test("a correction opens what the reviewer named and what the report still lacks", () => {
  const filed = { travelDeclarations: [] };
  const required = requiredDocuments(report({ expenseTypes: ["Accommodation"] }));
  const onReport: DocumentKind[] = ["certificate", "itinerary", "travelCompleted"];
  assert.deepEqual(correctionSlots(filed, [], required, onReport), ["hotelBills"], "a new Accommodation line");
  assert.deepEqual(correctionSlots(filed, ["rer"], required, onReport), ["rer", "hotelBills"]);
  assert.deepEqual(correctionSlots(filed, ["hotelBills"], required, onReport), ["hotelBills"], "named once");
  assert.deepEqual(correctionSlots(filed, [], required, [...onReport, "hotelBills"]), [], "nothing open");
});

test("a report filed before the named documents keeps its one box on a correction", () => {
  // Null, not an empty list, which would read as "no slot open" and leave its new file with nowhere to go.
  assert.equal(correctionSlots({}, [], [], []), null);
  assert.equal(correctionSlots({ travelDeclarations: null }, [], [], []), null);
  assert.deepEqual(correctionSlots({ travelDeclarations: [] }, [], [], []), [], "one filed under them, with nothing open");
});

test("the name plates are the team's, and the Liquidation Report isn't one", () => {
  assert.equal(documentPlate("certificate"), "Certificate of Appearance/Attendance");
  assert.equal(documentPlate("refundOr"), "OR, Excess Cash Advance");
  assert.equal(documentPlate("hotelBills"), "Hotel Room/Lodging Bills with Official Receipts, Within 50-Kilometer");
  assert.equal(documentPlate(undefined), "");
  assert.ok(!DOCUMENT_SLOTS.some(s => /Liquidation Report/.test(s.plate)));
});

test("ticks are read strictly", () => {
  assert.deepEqual(readDeclarations(undefined), []);
  assert.deepEqual(readDeclarations(null), []);
  assert.deepEqual(readDeclarations(["overRate", "scheduleChanged", "overRate"]), ["scheduleChanged", "overRate"], "once each, in the list's order");
  assert.equal(readDeclarations("overRate"), null);
  assert.equal(readDeclarations(["overRate", "madeUp"]), null);
  assert.equal(readDeclarations([{}]), null);
  assert.deepEqual(readDeclarations(["noTravel", "itineraryNotFollowed"]), ["noTravel"], "no travel, no itinerary to depart from");
});

test("a file goes in a slot the form has, and can't claim to be a certificate", () => {
  assert.equal(readDocumentKind("tickets"), "tickets");
  assert.equal(readDocumentKind(undefined), "receipts", "a file that says nothing is a receipt");
  assert.equal(readDocumentKind(""), "receipts");
  assert.equal(readDocumentKind("certificate"), null, "only an attendee's own upload fills that slot");
  assert.equal(readDocumentKind("madeUp"), null);
  assert.equal(readDocumentKind({}), null);
  assert.ok(!UPLOAD_KINDS.includes("certificate"));
  assert.equal(UPLOAD_KINDS.length, DOCUMENT_SLOTS.length - 1);
});

test("only a report filed under the rules is held to them", () => {
  assert.equal(filedUnderDocuments({ travelDeclarations: [] }), true);
  assert.equal(filedUnderDocuments({ travelDeclarations: ["overRate"] }), true);
  assert.equal(filedUnderDocuments({}), false);
  assert.equal(filedUnderDocuments(null), false);
});

test("a seminar's last day is its end date, or its first when it has none", () => {
  assert.equal(seminarLastDay({ startDate: "2026-11-02", endDate: "2026-11-04" }), "2026-11-04");
  assert.equal(seminarLastDay({ startDate: "2026-11-02", endDate: "" }), "2026-11-02");
  assert.equal(seminarLastDay({ startDate: "2026-11-02T00:00:00Z" }), "2026-11-02");
  assert.equal(seminarLastDay({ startDate: "soon", endDate: 12 }), "");
  assert.equal(seminarLastDay(null), "");
});

test("a seminar's first day is its start date, or its end date when it has none (2026-11-14)", () => {
  assert.equal(seminarFirstDay({ startDate: "2026-11-14", endDate: "2026-11-15" }), "2026-11-14");
  assert.equal(seminarFirstDay({ startDate: "", endDate: "2026-11-15" }), "2026-11-15");
  assert.equal(seminarFirstDay({ startDate: "2026-11-14T00:00:00Z" }), "2026-11-14");
  assert.equal(seminarFirstDay({ startDate: "soon", endDate: 12 }), "");
  assert.equal(seminarFirstDay(null), "");
  assert.equal(seminarFirstDay({ startDate: "2026-11-20", endDate: "2026-11-18" }), "2026-11-18", "stored out of order: the earlier, never after the last day");
  // A damaged stored date can't throw (the security review): read only as text.
  const damaged = { startDate: { toString: 1 } as unknown, endDate: "2026-11-15" };
  assert.equal(seminarFirstDay(damaged), "2026-11-15");
  assert.equal(seminarLastDay({ startDate: "2026-11-14", endDate: { toString: 1 } as unknown }), "2026-11-14");
});

test("HR records attendance only once a seminar has ended: its last day's end time, on Manila's clock (2026-11-14)", () => {
  const seminar = { startDate: "2026-11-14", endDate: "2026-11-15", endTime: "17:00" };
  assert.equal(seminarHasEnded(seminar, { day: "2026-11-14", time: "18:00" }), false, "the first day, after hours: not over");
  assert.equal(seminarHasEnded(seminar, { day: "2026-11-15", time: "16:59" }), false, "the last day, before its end");
  assert.equal(seminarHasEnded(seminar, { day: "2026-11-15", time: "17:00" }), true, "at its end time");
  assert.equal(seminarHasEnded(seminar, { day: "2026-11-16", time: "00:00" }), true, "the day after");
  // A seminar from 10:00 AM to 3:00 PM (the user's own example) ends at 3:00 PM.
  assert.equal(seminarHasEnded({ startDate: "2026-11-20", endTime: "15:00" }, { day: "2026-11-20", time: "15:30" }), true);
  assert.equal(seminarHasEnded({ startDate: "2026-11-20", endTime: "15:00" }, { day: "2026-11-20", time: "14:59" }), false);
  // No end time on record: over once its last day has passed.
  assert.equal(seminarHasEnded({ startDate: "2026-11-20", endDate: "2026-11-20" }, { day: "2026-11-20", time: "23:59" }), false);
  assert.equal(seminarHasEnded({ startDate: "2026-11-20", endTime: "5pm" }, { day: "2026-11-21", time: "00:00" }), true);
  assert.equal(seminarHasEnded({ startDate: "", endDate: "" }, { day: "2030-01-01", time: "12:00" }), false, "no dates: never");
  assert.equal(seminarHasEnded(null, { day: "2030-01-01", time: "12:00" }), false);
  assert.equal(seminarHasEnded(seminar, { day: "later", time: "12:00" }), false, "a day that isn't one");
});

test("Manila's clock is UTC+8, and a time reads on a 12-hour clock", () => {
  // 2026-11-14 23:30 UTC is 07:30 on the 15th in Manila.
  assert.deepEqual(manilaMoment(Date.UTC(2026, 10, 14, 23, 30)), { day: "2026-11-15", time: "07:30" });
  assert.deepEqual(manilaMoment(Date.UTC(2026, 10, 14, 15, 59)), { day: "2026-11-14", time: "23:59" });
  assert.equal(clockText("17:00"), "5:00 PM");
  assert.equal(clockText("10:05"), "10:05 AM");
  assert.equal(clockText("00:15"), "12:15 AM");
  assert.equal(clockText("12:00"), "12:00 PM");
  assert.equal(clockText("25:00"), "");
  assert.equal(clockText(undefined), "");
});

const seat = (over: Partial<CertificateSeat> = {}): CertificateSeat => ({
  status: "Assigned", attendance: null, seminarArchived: false, lastDay: "2026-11-04", today: "2026-11-04", onFile: false, uploads: 0, ...over
});

test("a certificate can be uploaded from the seminar's last day", () => {
  assert.equal(certificateUploadProblem(seat()), "", "on the last day");
  assert.equal(certificateUploadProblem(seat({ today: "2026-12-01" })), "");
  assert.match(certificateUploadProblem(seat({ today: "2026-11-03" })), /from 2026-11-04/);
  assert.match(certificateUploadProblem(seat({ lastDay: "" })), /no dates/);
});

test("it can be replaced until HR records attendance on it", () => {
  assert.equal(certificateUploadProblem(seat({ onFile: true, uploads: 1 })), "");
  assert.match(certificateUploadProblem(seat({ onFile: true, uploads: 1, attendance: "Attended" })), /can't be replaced here/);
});

test("it can follow a \"Did not attend\", and fill a seat recorded before the rule", () => {
  assert.equal(certificateUploadProblem(seat({ attendance: "Did not attend" })), "", "HR corrects it on the certificate");
  assert.equal(certificateUploadProblem(seat({ attendance: "Did not attend", onFile: true, uploads: 1 })), "");
  assert.equal(certificateUploadProblem(seat({ attendance: "Attended" })), "", "none on file yet");
  assert.equal(certificateUploadProblem(seat({ attendance: "Attended", status: "Liquidated" })), "", "an older finished seat's records");
});

test("a closed seat or an archived seminar takes none, and one seat can't fill the disk", () => {
  assert.match(certificateUploadProblem(seat({ status: "Cancelled" })), /no longer on the seminar/);
  assert.match(certificateUploadProblem(seat({ status: "Archived" })), /no longer on the seminar/);
  assert.match(certificateUploadProblem(seat({ seminarArchived: true })), /archived/);
  assert.equal(certificateUploadProblem(seat({ onFile: true, uploads: MAX_CERTIFICATE_UPLOADS - 1 })), "");
  assert.equal(certificateUploadProblem(seat({ onFile: true, uploads: MAX_CERTIFICATE_UPLOADS })),
    `You can upload the certificate up to ${MAX_CERTIFICATE_UPLOADS} times, and it has been uploaded ${MAX_CERTIFICATE_UPLOADS} times. Send it to HR, who can upload it for you.`);
});

test("the employee's limit says how many there have been, and sends them to HR only while HR can help", () => {
  // HR's or the Administrator's uploads count too.
  assert.match(certificateUploadProblem(seat({ onFile: true, uploads: 7 })), /up to 5 times, and it has been uploaded 7 times\. Send it to HR/);
  assert.equal(certificateUploadProblem(seat({ onFile: true, uploads: MAX_OFFICER_CERTIFICATE_UPLOADS })),
    `The certificate has been uploaded ${MAX_OFFICER_CERTIFICATE_UPLOADS} times, the most allowed. If the one on file isn't right, tell HR.`);
});

test("HR or the Administrator can go past the employee's limit, but not without end", () => {
  const officer = (uploads: number) => certificateUploadProblem(seat({ onFile: true, uploads, byOfficer: true }));
  assert.equal(officer(MAX_CERTIFICATE_UPLOADS), "", "a seat at the employee's limit isn't stuck");
  assert.equal(officer(MAX_OFFICER_CERTIFICATE_UPLOADS - 1), "");
  assert.equal(officer(MAX_OFFICER_CERTIFICATE_UPLOADS), `The certificate has been uploaded ${MAX_OFFICER_CERTIFICATE_UPLOADS} times, the most allowed.`);
  assert.match(certificateUploadProblem(seat({ onFile: true, uploads: 1, attendance: "Attended", byOfficer: true })), /can't be replaced here/);
});

test("on a report a certificate goes by the server's words, with its real extension", () => {
  assert.equal(certificateDocumentName("Ana Reyes", "application/pdf"), "Certificate of Attendance - Ana Reyes.pdf");
  assert.equal(certificateDocumentName("Ana Reyes", "image/jpeg"), "Certificate of Attendance - Ana Reyes.jpg");
  assert.equal(certificateDocumentName(" ", "image/png"), "Certificate of Attendance.png");
  assert.equal(certificateDocumentName("Ana‮Reyes", "image/png"), "Certificate of Attendance - AnaReyes.png", "no direction marks");
});

test("a Return made before 12ai that asked for the OR's scan asks the employee for nothing there (the code review of 12ai)", () => {
  assert.deepEqual(employeeAskedKinds(["refundOr"]), [], "only the Finance Officer's OR: nothing for the employee");
  assert.deepEqual(employeeAskedKinds(["rer", "refundOr", "tickets"]), ["rer", "tickets"], "the rest stays asked, in its order");
  assert.deepEqual(employeeAskedKinds(["certificate", "madeUp"]), [], "never the certificate, nor anything unknown");
  assert.deepEqual(employeeAskedKinds(undefined), []);
  assert.deepEqual(employeeAskedKinds({ some: 1 }), [], "a list or nothing");
});
