export enum UserRole {
  SUPER_ADMIN = "Administrator / Division Chief",
  HR_OFFICER = "HR Officer",
  FINANCE_OFFICER = "Financial Officer",
  BUDGET_OFFICER = "Budget Officer",
  EMPLOYEE = "Personnel",
}

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  employeeId?: string;
  plantillaNumber?: string;
  salary?: number;
  status?: "Active" | "Deactivated" | "Archived" | "Pending Password Change";
  passwordHash?: string;
  requirePasswordChange?: boolean;
  requirePdsUpload?: boolean;
  createdAt: string;
}

// The office's divisions, as the account form offers them. "Adjudication Division" was the Office of the Chief Regional
// Adjudicator under another name (the user, 2026-11-08); a load migration in server.ts moved stored names to this one.
export const OFFICE_OF_THE_CRA = "Office of the Chief Regional Adjudicator";
export const DIVISIONS = [OFFICE_OF_THE_CRA, "Legal Division", "Administrative and Finance Division"] as const;

export interface Employee {
  id: string;
  employeeId: string; // for compatibility with legacy endpoints
  plantillaNumber?: string;
  employeeType?: string;
  fullName: string;
  surname?: string;
  firstName?: string;
  middleName?: string;
  nameExtension?: string;
  position: string;
  division: string;
  fieldOfSpecialization?: string;
  employmentStatus: string;
  salary?: number;
  salaryGrade?: number;
  step?: number;
  email?: string;
  officialEmail?: string;
  address?: string;
  dateHired: string;
  contactNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  pdsFieldName?: string;
  pdsUploadedAt?: string;
  isActive?: boolean;
}

export interface EmploymentHistory {
  id: string;
  employeeId: string;
  action: "Promotion" | "Transfer" | "Designation" | "Service Record Update";
  previousDetails: string;
  newDetails: string;
  effectiveDate: string;
  updatedBy: string;
}

export interface Training {
  id: string;
  employeeId: string;
  title: string;
  organizer: string;
  dateConducted: string;
  certificateFilename?: string;
  trainingHours: number;
  status?: "Pending Verification" | "Verified" | "Returned" | "Rejected";
  remarks?: string;
  /** Who last reviewed it, and when: verified or returned (12r). */
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface Seminar {
  id: string;
  employeeId: string;
  title: string;
  organizer: string;
  dateConducted: string;
  certificateFilename?: string;
  hours: number;
}

export enum TransactionStatus {
  PENDING_VALIDATION = "Pending Validation",
  UNDER_REVIEW = "Under Review",
  VALIDATED = "Validated",
  LIQUIDATED = "Liquidated",
  ARCHIVED = "Archived",
}

export interface FinancialTransaction {
  id: string;
  transactionId: string;
  transactionDate: string;
  supplier: string;
  amount: number;
  description: string;
  receiptFilename?: string;
  status: TransactionStatus;
  supportingDocuments: SupportingDocument[];
  history: TransactionHistory[];
  employeeRef?: string;
  department?: string;
  category?: string;
  createdBy?: string;
  dateCreated?: string;
}

export interface SupportingDocument {
  id: string;
  name: string;
  type: "Purchase Request" | "Liquidation Report" | "Invoice" | "Disbursement Voucher" | "Other";
  filename: string;
  uploadedAt: string;
  uploadedBy?: string;
  validationStatus?: string;
  versions?: { version: number; filename: string; uploadedAt: string; uploadedBy: string }[];
}

export interface TransactionHistory {
  id: string;
  status: TransactionStatus;
  changedBy: string;
  changedAt: string;
  remarks: string;
  expenseCategory?: "PS" | "MOOE" | "CO";
}

export interface Liquidation {
  id: string;
  liquidationNo: string;
  requestRef: string;
  employee: string;
  department: string;
  amountReleased: number;
  amountLiquidated: number;
  remainingBalance: number;
  liquidationDate: string;
  status: "Pending Submission" | "Submitted" | "Under Review" | "Approved" | "Completed";
  notes?: string;
  approvedBy?: string;
  createdAt: string;
}

// Unified spending category tying an expense to a specific budget bucket.
export type SpendingCategory = "Personnel" | "Training" | "Seminar" | "Request";

export const SPENDING_CATEGORIES: SpendingCategory[] = ["Personnel", "Training", "Seminar", "Request"];

export interface BudgetAllocation {
  id: string;
  fiscalYearId: string;
  department: string;
  // Optional: buckets without a category are department-wide (legacy shape) and
  // still match as a fallback during auto-deduction and carry-over.
  category?: SpendingCategory;
  // Unified Accounts Code Structure code; read by the FAR export, not yet set server-side.
  uacsCode?: string;

  budgetAllocation: number;
  budgetUtilized: number;
  remainingBudget: number;
  budgetPercentageUsed: number;
  carryOver?: number;
  unliquidatedAdvances?: number;
  
  allocatedPS: number;
  utilizedPS: number;
  remainingPS: number;
  
  allocatedMOOE: number;
  utilizedMOOE: number;
  remainingMOOE: number;
  
  allocatedCO: number;
  utilizedCO: number;
  remainingCO: number;
}

export interface BudgetRequestItem {
  id: string;
  department: string;
  amountRequested: number;
  requestType: "Augmentation" | "Realignment" | "Emergency";
  purpose: string;
  status: "Pending" | "Approved" | "Returned";
  remarks?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface FinanceAuditLog {
  id: string;
  user: string;
  action: string;
  module: string;
  timestamp: string;
  previousValue: string;
  newValue: string;
}

export enum AssetStatus {
  AVAILABLE = "Available",
  ASSIGNED = "Assigned",
  RETURNED = "Returned",
  DAMAGED = "Damaged",
  LOST = "Lost",
  ARCHIVED = "Archived",
}

export interface Asset {
  id: string;
  assetNumber: string;
  serialNumber: string;
  category: "IT Equipment" | "Office Furniture" | "Vehicles" | "Office Supplies" | "Other";
  description: string;
  dateAcquired: string;
  cost: number;
  status: AssetStatus;
  assignedToId?: string; // Employee ID
  assignedToName?: string;
}

export interface AssetIssuance {
  id: string;
  assetId: string;
  assetNumber: string;
  assignedToId: string;
  assignedToName: string;
  dateIssued: string;
  quantity: number;
  conditionOnIssue: string;
  returnDate?: string;
  conditionOnReturn?: string;
  clearanceStatus?: "Cleared" | "Pending" | "Disapproved";
}

export interface SupplyItem {
  id: string;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
  unit: string;
}

export interface SupplyIssuance {
  id: string;
  supplyId: string;
  supplyName: string;
  issuedToId: string;
  issuedToName: string;
  quantity: number;
  dateIssued: string;
}

export enum RequestType {
  LEAVE = "Leave Request",
  SERVICE_RECORD = "Service Record Request",
  VEHICLE = "Vehicle Request",
  ZOOM = "Zoom Access Request",
  SUPPLY = "Supply Request",
}

export enum RequestStatus {
  PENDING = "Pending HR Review",
  PENDING_HR_REVIEW = "Pending HR Review",
  RETURNED_BY_HR = "Returned by HR",
  ENDORSED_TO_CHIEF = "Endorsed to Division Chief",
  PENDING_CHIEF_APPROVAL = "Pending Division Chief Approval",
  RETURNED_BY_CHIEF = "Returned by Division Chief",
  APPROVED = "Approved",
  REJECTED = "Rejected",
}

export interface BaseRequest {
  id: string;
  requestType: RequestType;
  employeeId: string;
  employeeName: string;
  dateRequested: string;
  status: RequestStatus;
  approvedBy?: string;
  remarks?: string;
}

export interface LeaveRequest extends BaseRequest {
  leaveType: "Sick Leave" | "Vacation Leave" | "Maternity/Paternity Leave" | "Emergency Leave" | "Special Privilege";
  startDate: string;
  endDate: string;
  reason: string;
}

export interface ServiceRecordRequest extends BaseRequest {
  purpose: string;
  copies: number;
}

export interface VehicleRequest extends BaseRequest {
  destination: string;
  purpose: string;
  dateNeeded: string; // the form's "Reservation date"
  passengers: string;

  // --- Vehicle Reservation Slip (form AS-GSD.VRS.012.02) ---
  // Optional so requests filed before the slip existed stay valid.
  // Both signature boxes on the printed slip — "Authorized by: Division Head" and
  // "Approved by: Chief Administrative Officer" — are signed by the same person:
  // whoever holds Administrator / Division Chief and approved it. That name comes
  // from BaseRequest.approvedBy, so it is never stored twice here.
  vrsNo?: string;           // e.g. "VRS-2026-09-014"
  departureDate?: string;   // YYYY-MM-DD
  departureTime?: string;   // HH:mm, rendered as AM/PM on the slip
  arrivalDate?: string;     // YYYY-MM-DD
  arrivalTime?: string;     // HH:mm

  // Filed together with a seminar's cash advance (HSAC RAB 1, 2026-10-26: "Yes, pwede"): the
  // enrolment, the seminar and the cash advance it goes with (the latest: asking again after a
  // decline moves it to the new request). The two are decided separately: Finance releases the
  // advance, the Division Chief decides the vehicle. Absent otherwise.
  trainingParticipantId?: string;
  trainingProgramId?: string;
  cashAdvanceId?: string;
}

/** A vehicle request as GET /api/requests sends it: with what it was filed with, each part only to
 * whoever may see it (null otherwise), worked out on the way out and never stored. */
export interface VehicleRequestView extends VehicleRequest {
  /** The seminar (the employee, HR and the Administrator), and why the trip may be off, if it may. */
  linkedSeminar?: { title: string; startDate?: string; endDate?: string; tripProblem?: string | null } | null;
  /** The cash advance (the employee, Finance and the Administrator): its number once released. */
  linkedAdvance?: { advanceNo: string | null; status: CashAdvance["status"] } | null;
}

/** A vehicle request filed with a seminar's cash advance, as the cash-advance screens show it. */
export interface LinkedVehicleSummary {
  vrsNo?: string;
  status: RequestStatus;
}

export interface ZoomRequest extends BaseRequest {
  meetingTitle: string;
  reason?: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  alternativeHost?: string;
}

export interface SupplyRequest extends BaseRequest {
  supplyId: string;
  supplyName: string;
  quantity: number;
  purpose: string;
}

export type AnyRequest = LeaveRequest | ServiceRecordRequest | VehicleRequest | ZoomRequest | SupplyRequest;

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  role: string;
  action: string; // e.g., "Login", "Create Employee", "Approve Request", "Update Transaction"
  details: string; // Brief explanatory text
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "urgent";
  // The user ids who have read it: everyone a notice is for reads it on their own, so one HR
  // officer reading it no longer hides it from the others. Stored only.
  readBy?: string[];
  // Whether the caller has read it, worked out by GET /api/notifications. (Stored notices used
  // to carry it as one flag shared by everyone; converted to readBy on load, 2026-10-19.)
  isRead?: boolean;
  timestamp: string;
  targetRole?: string; // If undefined, visible to everyone. If specified, only visible to users with this role
  targetEmployeeId?: string; // If specified, only visible to this employee's login (either id form)
  // Stable key for system-generated notices (e.g. "liq-due:<participantId>:overdue")
  // so a reminder is never sent twice, even across server restarts.
  dedupeKey?: string;
  // Where clicking the notice takes the user, e.g. the liquidation form for a seminar.
  link?: NotificationLink;
}

// What a notice is about: a request, a liquidation report, a seminar (Training Plan & Budget),
// the employee's own assignment (an enrolment or a general activity, My Assigned Activities), or a
// seat on HR's attendance list (by enrolment id).
export type NotificationRecordKind = "request" | "liquidationReport" | "seminar" | "assignment" | "cashAdvance" | "attendance";

// The control a notice lands on, where the screen can't work it out from the record (the instructor's review,
// R7): a certificate reminder lands on the seminar card's Upload button. A returned report needs none: the
// portal lands on the first part the reviewer reopened (src/correctionTarget.ts).
export type NoticeFocus = "certificateUpload";

export interface NotificationLink {
  tab: string;                       // the app tab to open, e.g. "employee_portal"
  subTab?: string;                   // Finance's sub-tab ("liquidation") or Training Plan & Budget's step ("plan-a")
  record?: { kind: NotificationRecordKind; id: string }; // shown (opened or highlighted) on arrival
  liquidationActivityId?: string;    // open the Liquidation Report with this seminar chosen
  liquidationReportId?: string;      // open this returned report for correction
  focus?: NoticeFocus;               // the control on the record that takes the keyboard focus
}

// What a screen should show when a notice opens it. `nonce` lets the same record be shown
// again from a second notice.
export interface ScreenFocus {
  subTab?: string;
  record?: { kind: NotificationRecordKind; id: string };
  focus?: NoticeFocus;
  nonce: number;
}

export interface Activity {
  id: string;
  activityNo: string;
  title: string;
  description: string;
  dateScheduled: string;
  allottedBudget: number;
  budgetId: string; // linked to BudgetAllocation
  assignedEmployeeId: string; // Employee ID (EMP006, etc.) or Employee name
  status: "Active" | "Completed" | "Pending";
}

// The spending buckets HR's training ledger groups by. Shared with the PARTICULARS
// editor so a claimant's line item lands in a real bucket instead of "Miscellaneous".
export type TrainingExpenseCategory =
  | "Registration Fee"
  | "Meals"
  | "Transportation"
  | "Accommodation"
  | "Materials"
  | "Venue Rental"
  | "Speaker Fees"
  | "Miscellaneous";

// Which of these an attendee may choose, and when: src/expenseLines.ts.
export const TRAINING_EXPENSE_CATEGORIES: TrainingExpenseCategory[] = [
  "Registration Fee",
  "Meals",
  "Transportation",
  "Accommodation",
  "Materials",
  "Venue Rental",
  "Speaker Fees",
  "Miscellaneous"
];

// --- PLAN A WORKBOOK IMPORT ---
// The contract between the two import routes and the Plan A upload panel.

/** One employee block read from the workbook, with whatever we could match it to. */
export interface PlanAImportBlock {
  /** Stable identity across preview and commit, e.g. "Plan A - 2026!A82". */
  key: string;
  startRow: number;
  workbookName: string;        // "" when the sheet has a position but no name
  workbookPosition: string;
  workbookOffice: string;
  match: { employeeId: string; fullName: string; storedPosition: string; storedDivision: string } | null;
  suggestions: { employeeId: string; fullName: string; score: number }[];
  needCounts: Record<TrainingNeedCategory, number>;
  /** First few titles, so HR can sanity-check the row without opening the file. */
  sampleTitles: string[];
  /** Needs this employee already has for the target year; skipped on commit. */
  alreadyInPlan: number;
  /** The workbook files them under a different office/position than the system stores. */
  positionDiffers: boolean;
}

export interface PlanAImportPreview {
  /** sha256 of the uploaded bytes; the commit must present the same file. */
  fileDigest: string;
  filename: string;
  /** The year the needs will be written into - not necessarily the sheet's year. */
  fiscalYear: string;
  sheets: {
    name: string;
    isPlanA: boolean;
    reason?: string;
    detectedYear: string | null;
    employeeCount: number;
    needCount: number;
  }[];
  selectedSheet: string;
  detectedYear: string | null;
  yearMatchesFiscalYear: boolean;
  offices: string[];
  totals: {
    blocks: number;
    matched: number;
    unmatched: number;
    needs: number;
    duplicatesInFile: number;
    alreadyInPlan: number;
    netNewNeeds: number;
  };
  warnings: string[];
  blocks: PlanAImportBlock[];
}

/** One row's decision. A null employeeId means "skip this row". */
export interface PlanAImportAssignment {
  key: string;
  workbookName: string;
  employeeId: string | null;
}

export interface PlanAImportResult {
  fiscalYear: string;
  sheetName: string;
  imported: number;
  skippedRows: number;
  skippedDuplicateInFile: number;
  skippedAlreadyInPlan: number;
  perEmployee: { employeeId: string; fullName: string; imported: number; skipped: number }[];
  /** The upload as recorded (absent on a dry run). */
  tdp?: TdpUpload;
  /** A replacement: what it does, or did, to the plan. */
  replace?: TdpReplaceSummary;
}

// --- THE TDP, UPLOADED ONCE A YEAR (the instructor's review, R9) ---
// Plan A comes from the RAB-1 workbook HR uploads for a fiscal year; an amended one replaces it. Every upload and
// replacement is kept, in order: the latest for a year is the TDP in force.

export interface TdpUpload {
  id: string;
  fiscalYear: string;
  /** "upload": the year's first; "replace": an amended TDP; "before-records": imported before uploads were recorded,
   * worked out at load from the plan and, when the audit log has it, the import's entry. */
  kind: "upload" | "replace" | "before-records";
  filename: string;        // "" when not known
  sheetName: string;
  uploadedAt: string;      // ISO; "" when not known
  uploadedBy: string;      // the username; "" when not known
  uploadedByName: string;
  /** The year's TDP needs right after it, and how many employees they are for (needs carried from an earlier year, and
   * needs HR added after the TDP (12ad), aren't part of a TDP, so they aren't counted). */
  needs: number;
  employees: number;
  /** A replacement: what it changed. `addedKept` and `adopted` count needs HR added after the TDP (12ad): kept though
   * the amended TDP leaves them out, or now listed by it; `outsideKept` and `outsideAdopted` the same for needs added
   * for trainings outside the TDP (12ae). */
  changes?: { added: number; removed: number; kept: number; moved: number; addedKept?: number; adopted?: number; outsideKept?: number; outsideAdopted?: number };
  /** A replacement: the needs it kept though the amended TDP leaves them out (still in use), so Plan A can mark them. */
  keptNeedIds?: string[];
  /** The TDP's own trainings, per column, from every row of the sheet (rows assigned to nobody, and rows skipped as
   * already in the plan, included), in its spelling: what "Add Training Need" offers (12ad). Absent on a record from
   * before 2026-11-08; kept on the server (the screens get the choices instead). */
  trainings?: { title: string; category: TrainingNeedCategory }[];
}

/** One need named in a replacement's summary. */
export interface TdpReplaceNeed {
  employee: string;        // the employee's full name
  category: TrainingNeedCategory;
  title: string;
  /** A need for a training outside the TDP (12ae), among those added after it. */
  outside?: true;
}

/** What replacing the TDP does to the year's plan (a dry run says it before; the replacement says it after). */
export interface TdpReplaceSummary {
  fiscalYear: string;
  /** In the amended TDP and new to the plan: how many, and which (adding a need is what makes the TDP identify
   * someone for a seminar, 12z). */
  added: number;
  addedNeeds: TdpReplaceNeed[];
  /** In both, left as they were (with any Monitoring override and remarks). */
  unchanged: number;
  /** Listed for the same person under another column (`category`, from `from`): moved there, with any Monitoring
   * override and remarks. */
  moved: (TdpReplaceNeed & { from: TrainingNeedCategory })[];
  /** Not in the amended TDP, and nothing uses them. */
  removed: TdpReplaceNeed[];
  /** Not in the amended TDP, but still in use, so kept: its person is seated for it on a seminar of the year, or it
   * was already accomplished. `detail` names the seminar or the evidence. */
  kept: (TdpReplaceNeed & { reason: "seminar" | "accomplished"; detail: string })[];
  /** Seminars of the year in the TDP now that would cover nothing in the plan after it: they would read "Not in the
   * TDP", and need their own justification (12z Part C). */
  seminarsOutside: { id: string; title: string }[];
  /** Carried from an earlier year: not part of any TDP, always kept. */
  carried: number;
  /** Added by HR after the TDP (12ad) and not in the amended TDP: always kept, as carried ones are. */
  addedKept: TdpReplaceNeed[];
  /** Added by HR after the TDP and now listed by the amended TDP for the same person (in place, or moved to its
   * column): ordinary TDP needs from then on. */
  adopted: TdpReplaceNeed[];
}

// --- POST-TRAINING PERFORMANCE EVALUATION REPORT ---
// The printed HSAC instrument: five scored statements, then five narrative prompts.

export type TrainingEvaluationRating = 1 | 2 | 3 | 4;
export type TrainingQualitativeRating =
  | "Needs Improvement"
  | "Satisfactory"
  | "Very Satisfactory"
  | "Outstanding";

/** The 4-point scale printed above Part I. Index order is the point value. */
export const TRAINING_EVALUATION_SCALE: { value: TrainingEvaluationRating; label: TrainingQualitativeRating }[] = [
  { value: 1, label: "Needs Improvement" },
  { value: 2, label: "Satisfactory" },
  { value: 3, label: "Very Satisfactory" },
  { value: 4, label: "Outstanding" }
];

/** Part I, verbatim and in printed order. Five statements, each scored 1-4. */
export const TRAINING_EVALUATION_STATEMENTS: string[] = [
  "The employee can effectively express his/her acquired knowledge from the training's subject matter.",
  "The employee's knowledge and skills with regards to the training's subject matter has improved.",
  "The employee has shown evident improvements in terms of his/her performance.",
  "The employee has applied his newly acquired knowledge and skills in the performance of his/her duties and responsibilities.",
  "The employee has generated new ideas or recommendations for improvement in relation to the training's subject matter."
];

/** Part II, verbatim and in printed order. Five narrative answers. */
export const TRAINING_EVALUATION_PROMPTS: string[] = [
  "Have you found the skills/information that the trainee learned in training relevant to his/her day to day working practices? If yes, please cite example(s) of any changes in his/her working practices.",
  "Was the trainee given the opportunity to echo/cascade the information/skills learned with his/her colleagues? How was the sharing done?",
  "In view of the above (#2), what improvements on practices or policies were suggested by the trainee as a result of this training? Please give details.",
  "Please narrate in two or three sentences the marked improvement in the attitude/personality/interpersonal relationships/values (as the case maybe) of the employee as a result of the subject training attended.",
  "Comments/Suggestions on the conduct of the training/workshop"
];

/**
 * The band table printed under Part I. Note it starts at 0 even though five statements
 * scored 1-4 can never total below 5 - that is the paper form's own quirk, reproduced
 * faithfully rather than silently corrected.
 */
export const TRAINING_EVALUATION_BANDS: { label: TrainingQualitativeRating; min: number; max: number }[] = [
  { label: "Needs Improvement", min: 0, max: 5 },
  { label: "Satisfactory", min: 6, max: 10 },
  { label: "Very Satisfactory", min: 11, max: 15 },
  { label: "Outstanding", min: 16, max: 20 }
];

export interface TrainingEvaluation {
  id: string;
  // One evaluation per person per seminar - this is already that unique pairing.
  trainingParticipantId: string;
  trainingProgramId: string;
  employeeId: string; // Employee.id, the form TrainingParticipant uses

  dateOfEvaluation: string; // YYYY-MM-DD
  // The form is signed by the Immediate Supervisor, who is not modelled anywhere in the
  // system, so HR types both. The report prints them above a blank signature line.
  supervisorName: string;
  supervisorPosition: string;

  /** Exactly 5 entries, in printed order. null = not yet rated. */
  ratings: (TrainingEvaluationRating | null)[];
  /** Exactly 5 entries, in printed order. */
  comments: string[];

  // Derived server-side from `ratings` and never accepted from the client, so the
  // printed total can never disagree with the ticks above it.
  overallRating: number;
  qualitativeRating: TrainingQualitativeRating;

  status: "Draft" | "Finalized";
  evaluatedBy: string;  // the HR user who keyed it - distinct from the signatory
  evaluatedAt: string;
}

// One seminar enrolment a group cash advance pays for (HSAC RAB 1, 2026-10-26: participants who
// attend together may have one cash advance processed for all of them, settled by one report and
// one refund). `amount` is that person's allowance, fixed when Finance releases the advance:
// HR re-prices allowances whenever a seminar is edited, and the training budget has to know
// whose share the cash stands for (src/advanceCoverage.ts).
export interface CashAdvanceCover {
  participantId: string;          // TrainingParticipant.id (never the staff code, which can change)
  employeeId: string;             // business form, e.g. "EMP007", as CashAdvance.employeeId
  employeeName: string;
  amount: number;                 // PHP, two decimals; a group's amounts add up to its `amount`
}

// Money going OUT: the disbursement voucher Finance releases to an employee before an
// activity. The COA Liquidation Report's "AMOUNT OF CASH ADVANCE PER DV NO. __ DTD __"
// refers to one of these. Without the record, that DV number is only the claimant's word,
// and there is no way to tell a genuinely unfunded assignment from an unreported advance.
export interface CashAdvance {
  id: string;
  advanceNo: string;              // e.g. "CA-2026-09-001"
  employeeId: string;             // business form, e.g. "EMP007"
  employeeName: string;
  // The assignment this funds: a TDP enrolment id or an Activity id — the same
  // polymorphic reference LiquidationSubmission.activityId uses.
  activityId: string;
  activityTitle?: string;
  amount: number;                 // PHP actually released, which may be less than HR allocated
  dvNo: string;
  dvDate: string;                 // YYYY-MM-DD
  purpose?: string;
  issuedBy: string;               // the Financial Officer who released it
  issuedAt: string;               // ISO timestamp
  // "Refunded": the employee did not attend and gave the whole advance back (requirement 6).
  // "Requested": an employee asked for it from their seminar and Finance hasn't acted yet; no
  // money is out, so dvNo, dvDate, issuedBy and issuedAt stay blank until it is released.
  // "Declined": Finance turned the request down (declineReason), or HR's attendance closed it while it waited
  // ("Did not attend"; and since 2026-11-12 "Attended", which makes the seminar a reimbursement, 12ai). The employee
  // may ask again while asking is still open (before the seminar's last day, src/reimbursement.ts).
  status: "Requested" | "Released" | "Declined" | "Liquidated" | "Cancelled" | "Refunded";
  requestedAt?: string;           // ISO timestamp of the employee's request
  requestedBy?: string;           // the employee's name, as signed in
  decidedBy?: string;             // who released or declined the request (the Financial Officer, or HR when attendance closed it)
  decidedAt?: string;             // ISO timestamp
  declineReason?: string;
  liquidationId?: string;         // the report that settled it
  liquidatedAt?: string;
  refundOrNo?: string;            // the official receipt for the refund
  refundOrDate?: string;          // YYYY-MM-DD
  refundedBy?: string;            // the Financial Officer who recorded it
  refundedAt?: string;            // ISO timestamp
  // Handed back before its seminar started, with no attendance recorded (12z Part B), rather than by
  // someone who did not attend. Kept as recorded: attendance can change later.
  refundedBeforeSeminar?: boolean;
  // A group advance: every enrolment it pays for, all in one seminar, the holder's first (the one
  // `activityId` names; the holder is `employeeId`, who receives the cash and files the one report).
  // Absent on an individual advance, which pays for `activityId` alone.
  covers?: CashAdvanceCover[];
  // The vehicle request filed with it (HSAC RAB 1: "Yes, pwede"), or still standing for the seminar
  // when it was asked for again after a decline, if any.
  vehicleRequestId?: string;
  // DERIVED, never stored: that request's number and status, added by GET /api/cash-advances.
  vehicle?: LinkedVehicleSummary;
  // Released after HR's "Attended" had closed the request (12ai, the user's decision of 2026-11-13): its cash went out
  // on a voucher dated on or before HR's record and was recorded only afterwards. When the request was closed, and by whom.
  releasedAfterClosure?: { closedAt: string; closedBy: string };
  // DERIVED, never stored: for a request HR's attendance closed while nothing has settled its seats another way, sent to
  // Finance and the Administrator by GET /api/cash-advances: the Manila day it was closed (the latest voucher date its
  // release can carry), the last day its release can be recorded (30 days after, LATE_RELEASE_DAYS), and what would still
  // refuse its release now (e.g. COA's one advance), or null when nothing would.
  lateRelease?: { closedOn: string; until: string; problem: string | null };
}

// The instructor's note 11: a reviewer returns a liquidation report with a checklist of what
// is wrong, and only those parts reopen for the claimant. The activity and the employee's
// name are never correctable.
export type CorrectionField =
  | "periodCovered"
  | "responsibilityCenterCode"
  | "particulars"
  | "cashAdvance"          // DV number, date and amount; only when Finance has no record of it
  | "refundOr"
  | "claimType"
  | "representative"
  | "replaceDocuments"
  | "addDocument"
  | "remarks";             // the employee's own notes on the report

export const CORRECTION_FIELDS: { field: CorrectionField; label: string }[] = [
  { field: "periodCovered", label: "Period covered" },
  { field: "responsibilityCenterCode", label: "Responsibility center code" },
  { field: "particulars", label: "Particulars" },
  { field: "cashAdvance", label: "Cash advance (DV number, date and amount)" },
  { field: "refundOr", label: "Refund OR number and date" },
  { field: "claimType", label: "Claim type" },
  { field: "representative", label: "Box B representative" },
  { field: "replaceDocuments", label: "Supporting documents to replace" },
  { field: "addDocument", label: "A missing document to add" },
  { field: "remarks", label: "The employee's notes" }
];

export interface CorrectionItem {
  field: CorrectionField;
  remark?: string;          // the reviewer's note, shown beside that part of the form
  lineIds?: string[];       // particulars: only these lines (none listed means every line)
  documentIds?: string[];   // replaceDocuments: the files to replace
  documentKinds?: DocumentKind[]; // addDocument: which named documents are missing (R5)
}

// One Return, kept for good: every round stays on the report.
export interface CorrectionRequest {
  id: string;
  round: number;            // 1 for the first Return, 2 for the next, and so on
  items: CorrectionItem[];
  remarks: string;          // the reviewer's overall remarks
  requestedBy: string;      // the reviewer's full name
  requestedByRole: string;  // UserRole value of the reviewer
  requestedAt: string;
  // Where the corrected report goes: back to whoever returned it (open question 5).
  returnTo: "Pending HR Review" | "Verified & Forwarded";
  resolvedAt?: string;      // when the claimant resubmitted
  changedFields?: CorrectionField[]; // what that resubmission actually changed
}

// A file attached to a liquidation report. A file replaced during a correction is kept,
// marked superseded, so the history of what was submitted stays on the report.
/** Where the server keeps an uploaded file (src/server/fileStore.ts). Never sent to a browser. */
export interface StoredFile {
  file: string;   // its name in uploads/, made by the store
  type: string;   // the data URL's type
  bytes: number;
}

// The named documents of a seminar's report (the instructor's review, R5; the rules are in
// src/reportDocuments.ts). "certificate" comes from the attendee's certificate of attendance (R4): it is
// never uploaded on the report's form.
export type DocumentKind =
  | "certificate"
  | "itinerary"
  | "travelCompleted"
  | "tickets"
  | "hotelBills"
  | "refundOr"
  | "revisedOrder"
  | "revisedItinerary"
  | "headCertification"
  | "rer"
  | "receipts";

// What the claimant says applies to the trip. Only they can know these; each brings a document in, or
// (no travel) takes the travel documents off.
export type TravelDeclaration = "noTravel" | "scheduleChanged" | "itineraryNotFollowed" | "overRate" | "noOfficialReceipt";

export interface LiquidationDocument {
  id: string;
  name: string;
  type: string;
  filename?: string;
  uploadedAt: string;
  size?: string;
  content?: string;         // base64 data URL: only on its way to the server, never in a list
  stored?: StoredFile;      // the server's own record of where the file is
  hasFile?: boolean;        // on its way to a browser: whether there is a file to open
  replaces?: string;        // the id of the file this one replaced
  supersededAt?: string;    // set when a correction replaced this file
  replacedBy?: string;      // the id of the file that replaced it
  kind?: DocumentKind;      // which named document it is; none on a file from before R5
  participantId?: string;   // a certificate: whose it is (a group's report has one per attendee)
  uploadedBy?: string;      // set when someone other than the claimant attached it: the Finance Officer, for the
                            // OR for cash handed back, attached when validating (12ai)
}

// An attendee's certificate of attendance (R4): HR's basis for "Attended", and the proof on the report.
// Kept in its own collection, not on the enrolment, so no route that sends enrolments can carry it. A
// replaced one stays, marked, as a report's replaced file does. The report's document points at the same
// stored file: there is one copy.
export interface AttendanceCertificate {
  id: string;
  participantId: string;    // TrainingParticipant.id (never the staff code, which can change)
  name: string;             // as uploaded, cleaned
  type: string;             // the checked file type
  size: string;
  uploadedAt: string;
  uploadedBy: string;       // the full name of whoever uploaded it
  uploadedById?: string;    // their account's id
  stored: StoredFile;
  sha256?: string;          // the file's fingerprint, to tell HR when one file stands for two seats
  supersededAt?: string;
  replacedBy?: string;
}

/** A certificate as a list sends it: never the file, or where it is kept. */
export type AttendanceCertificateView = Pick<AttendanceCertificate, "id" | "name" | "size" | "uploadedAt" | "uploadedBy">;

/** Another seat whose certificate on file is the very same file (HR's list only). */
export interface CertificateTwin {
  name: string;
  seminar: string;
}

// The instructor's note 10: one form, but the claimant says which kind of claim it is.
// A Liquidation settles a cash advance Finance released. A Reimbursement claims back
// money the employee paid out of their own pocket, so it has no advance at all.
export type ClaimType = "Liquidation" | "Reimbursement";
export const CLAIM_TYPES: ClaimType[] = ["Liquidation", "Reimbursement"];

// One line of the PARTICULARS block on the COA Liquidation Report.
export interface LiquidationParticular {
  id: string;
  description: string;
  amount: number; // PHP, rounded to 2 decimals at the boundary
  // Which bucket this line is charged to. Optional so reports filed before the picker
  // existed stay valid; the server falls back to "Miscellaneous".
  category?: TrainingExpenseCategory;
  // A group's report (HSAC RAB 1, 2026-10-26): the attendee this line was for, one of those its
  // cash advance covers (TrainingParticipant.id). Optional; a line naming nobody is the holder's.
  participantId?: string;
}

export interface LiquidationSubmission {
  id: string;
  submissionNo: string;
  activityId: string;
  employeeId: string; // EMP006, etc.
  employeeName: string;
  // Chosen by the claimant at filing; the server checks it against the cash advance.
  // Reports filed before it existed get one from the load migration (an advance above
  // zero means Liquidation, none Reimbursement), so it is only missing on a stale copy.
  claimType?: ClaimType;
  // The claim type and cash advance as first stated, kept the first time a correction
  // changes them (with who and when it last changed), for Finance to check at validation.
  claimBeforeCorrection?: {
    claimType?: ClaimType;
    totalReleased: number;
    cashAdvanceDvNo: string;
    changedAt: string;
    changedBy: string;
  };
  totalReleased: number;
  totalSpent: number;
  remainingBalance: number;
  remarks: string;
  supportingDocs: LiquidationDocument[];
  // What the claimant said applies to the trip when filing (src/reportDocuments.ts). Its presence, even
  // empty, marks a report filed under the named documents (R5); older reports keep their rules.
  travelDeclarations?: TravelDeclaration[];
  // Every Return with its checklist, oldest first (requirement 5). The last one without
  // resolvedAt is the correction the claimant is working on.
  corrections?: CorrectionRequest[];
  // Which budget bucket this spending belongs to. Inferred at deduction time
  // when not set explicitly by the submitter.
  spendingCategory?: SpendingCategory;

  // --- COA Liquidation Report fields ---
  // All optional: records created before this existed stay valid, and the server still
  // accepts a bare totalSpent when no particulars are sent.
  // The itemised PARTICULARS block. When present, totalSpent is derived from its sum.
  particulars?: LiquidationParticular[];
  serialNo?: string;                 // e.g. "LR-101-2026-09-024"
  periodCoveredFrom?: string;        // YYYY-MM-DD
  periodCoveredTo?: string;          // YYYY-MM-DD
  entityName?: string;               // defaults to HSAC-RAB I
  fundCluster?: string;              // e.g. "01 - Regular Fund"
  responsibilityCenterCode?: string;
  // The CashAdvance this report accounts for, when one was recorded. Its amount and DV
  // reference override anything the claimant typed.
  cashAdvanceId?: string;
  cashAdvanceDvNo?: string;          // e.g. "2026-08-336"
  cashAdvanceDvDate?: string;        // YYYY-MM-DD
  refundOrNo?: string;               // e.g. "0247983" — only when there is a refund
  refundOrDate?: string;             // YYYY-MM-DD
  jevNo?: string;                    // filled by the Accountant

  // --- Signatories printed in Boxes B and C (Utilities → Manage Signatories) ---
  // Copies taken by the server, never typed by the claimant, so a later edit, resignation
  // or replacement never changes a report already made. Reports filed before these
  // existed have none and print as they always did (the validating officer's name).
  representativeId?: string;         // Box B: the Authorized Representative chosen at filing
  representativeName?: string;
  representativePosition?: string;
  accountantSignatoryId?: string;    // Box C: the Accountant on duty at Finance validation
  accountantName?: string;
  accountantPosition?: string;

  // --- Reimbursement ---
  // When an employee is assigned a seminar but never receives the cash advance, they pay
  // out of pocket and the Liquidation Report doubles as the claim to get it back. That is
  // simply totalSpent > totalReleased, so the amount is derived, never typed.
  reimbursementStatus?: "Not Required" | "Awaiting Reimbursement" | "Reimbursed";
  reimbursementAmount?: number;      // = max(0, totalSpent - totalReleased)
  reimbursementDvNo?: string;        // the DV the reimbursement was paid on
  reimbursementDate?: string;        // YYYY-MM-DD
  reimbursedBy?: string;             // the Financial Officer who released it

  // --- Seminar budget flow (user spec 2026-10-18) ---
  // Set on seminar reports filed from 2026-10-19: the report settles a cash advance the
  // employee requested and Finance released. Its items may not come to more than the advance
  // (form and server), the claim type is always Liquidation, and a leftover is handed back with
  // an OR. Reports filed before keep the rules they were filed under.
  withinAdvance?: boolean;
  // A seminar report filed with no cash advance waiting or released for its seat (HSAC RAB 1 allows
  // it, 2026-10-30): a Reimbursement of what the attendee paid themselves, its items within their
  // share less what the office paid for them, with the receipts attached (src/reimbursement.ts).
  // Finance pays it from the Reimbursement Queue. Reports filed before keep their rules.
  withinAllowance?: boolean;
  // The leftover of the advance, recorded once when Finance validates: what went back to the
  // training budget, with its OR (since 12ai the Finance Officer's; an older report's, the employee's).
  fundReturn?: {
    amount: number;
    orNo: string;
    orDate: string;                  // YYYY-MM-DD
    recordedAt: string;              // ISO timestamp (the validation)
    recordedBy: string;              // the Financial Officer who validated
  };

  // Stamped by the server at filing time from HR's own assignment record — never taken
  // from the request body. `totalReleased` is what the claimant says they received, and
  // Finance cannot read the HR training tables (isTrainingRecordsRole excludes them), so
  // without this there is no way to notice a claim for money already advanced.
  // Left undefined when the activity cannot be resolved, so the UI can say "not on
  // record" rather than assert a false zero.
  allocatedAtFiling?: number;
  activityTitle?: string;            // human label for the activity, for Finance's queue

  // Three-tier statuses
  hrStatus: "Pending Review" | "Verified & Forwarded" | "Returned by HR";
  hrRemarks?: string;
  hrVerifiedBy?: string;
  hrVerifiedAt?: string;

  financeStatus: "Pending Validation" | "Validated & Endorsed" | "Validated & Approved" | "Returned by Finance";
  financeRemarks?: string;
  financeValidatedBy?: string;
  financeValidatedAt?: string;

  // "Certified by Authorized Representative" is the normal terminal state at RAB 1, set
  // when Finance validates. Box B of the COA Liquidation Report ("Head of Agency /
  // Authorized Representative") prints the representative the claimant chose
  // (representativeName above). Reports filed before that existed print the Financial
  // Officer, who certified them under delegated authority. Either way it is a documented
  // business rule, not a skipped approval. divisionChiefApprovedBy records who clicked
  // Validate. "Bypassed (Auto-Approved by Finance)" is the legacy wording for the same
  // thing — migrated on load, but kept here because a restored backup can still carry it.
  divisionChiefStatus: "Pending Chief Approval" | "Approved" | "Certified by Authorized Representative"
    | "Bypassed (Auto-Approved by Finance)" | "Returned by Chief" | "Rejected";
  divisionChiefRemarks?: string;
  divisionChiefApprovedBy?: string;
  divisionChiefApprovedAt?: string;

  status: "Pending HR Review" | "Verified & Forwarded" | "Validated & Endorsed" | "Approved" | "Completed" | "Returned" | "Rejected";
  createdAt: string;
  dateSubmitted?: string;
}

/** A report as GET /api/liquidation-submissions sends it. `fiscalYear` is the seminar's, worked
 * out on the way out and never stored, so Finance counts the report in the year HR planned it
 * (finance/overviewFigures.ts). A general activity's report has none and counts in the year it
 * was filed. `covers`: on a group's report, everyone its cash advance covers (the holder first). */
export type LiquidationSubmissionView = LiquidationSubmission & {
  fiscalYear?: string;
  covers?: Array<Pick<CashAdvanceCover, "participantId" | "employeeId" | "employeeName">>;
  /** For Finance and the Administrator: what the one asking may do at Finance's stage (12ai, the user's decision of
   * 2026-11-13). `act`: validate or return it; `validate`: validate it; `reason`: why not. Nobody records the OR for
   * cash they hand back themselves, and the Administrator acts here only on a Financial Officer's handed-back cash. */
  financeAction?: { act: boolean; validate: boolean; reason?: string; own?: boolean; fallback?: boolean };
};

/** One file in the Documents Vault (GET /api/liquidation-documents): a file attached to a
 * liquidation report, with the report it belongs to, but without the file itself. Its content is
 * sent only when someone downloads it (src/server/liquidationDocuments.ts). */
export interface LiquidationDocumentRow {
  reportId: string;
  submissionNo: string;
  employeeName: string;
  status: string;
  claimType?: ClaimType;
  /** What the report settles: the seminar title on the report. */
  title: string;
  /** The seminar's fiscal year when the server knows it; otherwise the year the report was filed. */
  fiscalYear?: string;
  createdAt?: string;
  dateSubmitted?: string;
  docId: string;
  name: string;
  /** Which named document it is (R5); none on a file from before. */
  kind?: DocumentKind;
  /** The file's MIME type, e.g. "application/pdf" or "image/jpeg". */
  type: string;
  size?: string;
  uploadedAt?: string;
  /** False when nothing that can be downloaded is stored (an older record, or other text). */
  hasFile: boolean;
  /** Set when a correction replaced this file; the old copy is kept for the record. */
  supersededAt?: string;
  replacedBy?: string;
  replaces?: string;
}

export interface Child {
  id: string;
  fullName: string;
  dateOfBirth: string;
}

export interface Education {
  id: string;
  level: "Elementary" | "Secondary" | "Vocational" | "College" | "Graduate Studies" | "Post-Graduate";
  schoolName: string;
  degreeCourse: string;
  attendanceFrom: string;
  attendanceTo: string;
  highestLevelUnitsEarned: string;
  yearGraduated: string;
  scholarshipsHonorsReceived: string;
}

export interface PDS {
  id: string;
  employeeId: string;
  // Personal Info
  surname: string;
  firstName: string;
  middleName: string;
  nameExtension?: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: "Male" | "Female";
  civilStatus: "Single" | "Married" | "Widowed" | "Separated" | "Other";
  heightM: number;
  weightKg: number;
  bloodType: string;
  gsisId?: string;
  pagibigId?: string;
  philhealthId?: string;
  philSysNo?: string;
  sssId?: string;
  tinNo?: string;
  agencyEmployeeNo?: string;
  citizenshipType: "Filipino" | "Dual";
  dualCitizenshipBy?: "Birth" | "Naturalization";
  dualCountry?: string;
  // Residential Address
  rPurok?: string;
  rHouseNo?: string;
  rStreet?: string;
  rSubdivision?: string;
  rBarangay: string;
  rCityMunicipality: string;
  rProvince: string;
  rZipCode: string;
  // Permanent Address
  pPurok?: string;
  pHouseNo?: string;
  pStreet?: string;
  pSubdivision?: string;
  pBarangay: string;
  pCityMunicipality: string;
  pProvince: string;
  pZipCode: string;
  // Contact
  telephoneNo?: string;
  mobileNo: string;
  emailAddress: string;
  // Family
  spouseSurname?: string;
  spouseFirstName?: string;
  spouseMiddleName?: string;
  spouseExtension?: string;
  spouseOccupation?: string;
  spouseEmployer?: string;
  spouseBusinessAddress?: string;
  spouseTelephone?: string;
  fatherSurname: string;
  fatherFirstName: string;
  fatherMiddleName: string;
  fatherExtension?: string;
  motherMaidenSurname: string;
  motherFirstName: string;
  motherMiddleName: string;
  children: Child[];
  education: Education[];
}

export interface TrainingProgram {
  id: string;
  title: string;
  description: string;
  // No longer asked for (the planner's Category column was dropped on 2026-10-14); seminars
  // saved before keep theirs.
  category?: string;
  allocatedBudget: number;
  usedBudget: number;
  fiscalYear: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  durationDays: number;
  totalHours: number;
  venue: string;
  facilitator: string;
  maxParticipants: number;
  targetSpecialization?: string;
  targetDivision?: string;
  // Percentage split of each participant's allowance across preset expense
  // categories. Percentages, expected to sum to 100. Optional so existing
  // programs keep working; falls back to DEFAULT_TRAINING_BUDGET_SPLIT.
  budgetSplit?: TrainingBudgetSplit;
  // Shared by a seminar and its copies in later fiscal years, so "attended this
  // seminar before" survives rollover. Older programs lack it; matching falls
  // back to the normalised title.
  seriesId?: string;
  // Needed-training titles from Plan A that this seminar covers, ticked by HR from
  // the plan's own list. Resolved by normalised title, so an employee who adds the
  // same need later is still recognised.
  fulfillsNeedTitles?: string[];
  createdAt: string;
  // Archived instead of deleted (the user, 2026-10-23: only an unsaved draft can be deleted).
  // It leaves Programs & Budget for its Archived Seminars list and counts only what it spent
  // (src/trainingBudget.ts). Restoring clears all three.
  archivedAt?: string;
  archivedBy?: string;
  // Archived with nothing on record: its allocation went back to Unallocated in full, its
  // participants were taken off it, and the year's figures leave it out, as a deleted one.
  archivedBeforeUse?: boolean;
  // Why it is held although the TDP doesn't cover it (none of its needs is in its fiscal year's Plan A;
  // 12z Part C). It covers everyone seated on it. Only HR and the Administrator ever receive it.
  tdpException?: SeminarTdpJustification;
}

// One row of GET /api/training/recommendations — an employee scored for a seminar.
export interface TrainingCandidate {
  employeeId: string; // Employee.id — the form stored in participantIds
  fullName: string;
  position: string;
  division: string;
  dateHired: string;
  // 1 = new hire, 2 = no training yet in the seminar's fiscal year, 3 = already has one
  // (at least one training per year per employee, src/trainingCoverage.ts)
  priority: 1 | 2 | 3;
  priorityLabel: string;
  monthsSinceHire: number | null;
  matchesTarget: boolean;
  // This seminar covers something their Plan A actually lists — the strongest
  // reason to give them a seat after having no training yet this year.
  needsThis: boolean;
  needMatches: string[];
  /** The Plan A columns those entries are under, in the form's order: the same training may be
   * needed for the function, for an additional designation, or for career advancement (HSAC RAB 1's
   * answer 6). Empty when the plan doesn't list it. */
  needCategories?: TrainingNeedCategory[];
  /** Those of their matched needs whose title HR marked as mandated, with the law or rule: among the
   * plan's listers, they come first (HSAC RAB 1's step 5). */
  mandatedNeeds?: { title: string; basis: string }[];
  /** Titles of the seminar their own plan lists outside the TDP (12ae): shown, never counted as the TDP's. */
  outsideNeeds?: string[];
  /** Their other trainings that count toward the seminar's fiscal year (seminars and
   * HR-recorded trainings), by title. Empty: none yet, so they are offered first. */
  trainingsThisYear: string[];
  eligible: boolean;
  ineligibleReason?: string;
  /** Not eligible because they were already sent to this training: the seminar (its year, dates and attendance) or
   * the training HR recorded. The picker lists them under "Already sent to this training" (the instructor's review, R10). */
  alreadySent?: AlreadySent;
  /** The seminar's weekdays on which they are already at another seminar (YYYY-MM-DD). Someone
   * must stay to man each division (HSAC RAB 1), so the picker warns when a division would be empty. */
  awayOn?: string[];
}

/** Which seminar or HR record says someone already went to a training (R10). Dates are YYYY-MM-DD, or "". */
export type AlreadySent =
  | { source: "seminar"; title: string; fiscalYear: string; startDate: string; endDate: string; attendance: "Attended" | "Not recorded" }
  | { source: "record"; title: string; recordedOn: string };

// --- EMPLOYEE TRAINING HISTORY (the instructor's review, R11) ---
// Every seminar seat and every training HR recorded, one row each, newest first. HR and the Administrator see
// everyone's in full; an employee sees their own, without what others' records hold (12v decision 8, 12z Part B).

/** A seat on a seminar. Amounts are pesos, rounded to centavos. */
export interface TrainingHistorySeminar {
  kind: "seminar";
  participantId: string;
  programId: string;
  fiscalYear: string;
  title: string;
  startDate: string;
  endDate: string;
  venue: string;
  hours: number;
  facilitator: string;
  /** "Attended", "Did not attend", or "" while not recorded. */
  attendance: string;
  /** On the roster, taken off it, or replaced by a representative (who went is shown to HR and the Administrator only). */
  seat: "enrolled" | "cancelled" | "replaced";
  replacedBy?: string;
  /** Sent in lieu of someone (12z Part B): HR and the Administrator only. */
  inLieuOf?: string;
  /** The certificate of attendance on file (it opens through the seat's certificate route). */
  certificate?: { name: string; uploadedAt: string };
  /** The cash advance that funds this seat: its own, or a group's. `amount` is the advance's (a group's total), `share`
   * this seat's part of a group's. A covered member's own copy has their share as `amount`, with no `members` or
   * `refundOrNo` (12v decision 8). */
  advance?: {
    advanceNo: string;
    status: string;
    amount: number;
    share?: number;
    dvNo?: string;
    dvDate?: string;
    group?: { holder: string; members?: number; isHolder: boolean };
    refundOrNo?: string;
    refundedAt?: string;
  };
  /** The liquidation report that settles it: its own, or a group's. A covered member sees only its number and status. */
  report?: {
    submissionNo: string;
    status: string;
    claimType?: string;
    totalSpent?: number;
    refund?: { amount: number; orNo: string };
    group: boolean;
  };
}

/** A training HR recorded (Trainings and Seminar). */
export interface TrainingHistoryRecord {
  kind: "record";
  id: string;
  /** The fiscal year its date falls in, or "" (undated, or in no year on file). */
  fiscalYear: string;
  title: string;
  organizer: string;
  dateConducted: string;
  hours: number;
  status: string;
  certificateFilename: string;
  /** HR's remarks on it, such as why it was returned. */
  remarks?: string;
}

export type TrainingHistoryRow = TrainingHistorySeminar | TrainingHistoryRecord;

/** GET /api/employees/:employeeId/training-history */
export interface EmployeeTrainingHistory {
  employee: { id: string; employeeId: string; fullName: string; position: string; division: string };
  /** The year asked for, or null for all years. */
  fiscalYear: string | null;
  /** The years that have anything in them, newest first (the filter's choices). */
  fiscalYears: string[];
  rows: TrainingHistoryRow[];
  /** The Manila day it was drawn up (the route adds it). */
  asOf?: string;
}

/** One seat on a seminar's report: who, and their seat's records as the history shows them to HR. */
export type TrainingProgramReportRow = {
  participantId: string;
  employeeId: string;
  fullName: string;
  position: string;
  division: string;
} & Pick<TrainingHistorySeminar, "attendance" | "seat" | "replacedBy" | "inLieuOf" | "certificate" | "advance" | "report">;

/** GET /api/training/reports/program/:id (the instructor's review, R11; HR and the Administrator): one seminar, who
 * was on it and what each seat's records hold, with totals (src/trainingReports.ts). */
export interface TrainingProgramReport {
  program: {
    id: string;
    fiscalYear: string;
    title: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    venue: string;
    facilitator: string;
    hours: number;
    seats: number;
    /** By its dates, on Manila's calendar: still to come, under way (its last day included), or ended. */
    when: "upcoming" | "ongoing" | "ended";
    /** Archived once finished (12t): kept with every record. One archived before use has no report. */
    archived: boolean;
  };
  /** The training budget's own figures (`seminarBudget`), as Programs & Budget counts them. `back`: what it has
   * returned to the year's Unallocated. */
  budget: { allocated: number; spent: number; outstanding: number; back: number };
  /** The Manila day it was drawn up. */
  asOf: string;
  rows: TrainingProgramReportRow[];
  totals: {
    enrolled: number;
    attended: number;
    didNotAttend: number;
    notRecorded: number;
    /** Enrolled seats with a certificate of attendance on file. */
    certificates: number;
    replaced: number;
    cancelled: number;
    /** Every cash advance released for the seminar, each counted once (a group's too). */
    advanced: number;
    /** What came back: validated reports' leftovers and advances refunded in full. */
    handedBack: number;
    reports: number;
    validated: number;
  };
}

/** One finished seminar on GET /api/training/reports/completed. */
export interface CompletedTrainingProgram {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  venue: string;
  hours: number;
  enrolled: number;
  attended: number;
  allocated: number;
  spent: number;
  archived: boolean;
}

/** GET /api/training/reports/completed (R11; HR and the Administrator): a fiscal year's seminars that have ended
 * (their last day before today, Manila), newest first, leaving out any archived before use. */
export interface CompletedTrainingPrograms {
  fiscalYear: string;
  /** The Manila day the list was drawn up. */
  asOf: string;
  rows: CompletedTrainingProgram[];
  totals: { programs: number; enrolled: number; attended: number; hours: number; allocated: number; spent: number };
}

/** One active employee with no training yet in the fiscal year (Programs & Budget's coverage). */
export interface TrainingCoverageEntry {
  id: string;
  employeeId: string;
  fullName: string;
  position: string;
  division: string;
}

/** GET /api/training/coverage: how many active employees have at least one training in the
 * fiscal year, and who doesn't yet (src/trainingCoverage.ts). */
export interface TrainingCoverage {
  fiscalYear: string;
  total: number;
  covered: number;
  withoutTraining: TrainingCoverageEntry[];
  /** The Manila day it was drawn up (the route adds it). */
  asOf?: string;
}

/** HR's dashboard (12ag Part B, `GET /api/dashboard/hr`, src/hrDashboard.ts). "Staff" means still with the office
 * (src/staffStatus.ts); "attended" means HR recorded "Attended" on a seat of the year's seminars, or recorded a
 * training dated in the year that still counts (12r). */
export interface HrDashboard {
  fiscalYear: string;
  /** The Manila day it was drawn up. */
  asOf: string;
  headcount: {
    total: number;
    byDivision: HrCount[];
    byStatus: HrCount[];
  };
  /** How many staff attended 0, 1, 2, or 3 or more trainings in the year. */
  trainingsPerEmployee: { trainings: "0" | "1" | "2" | "3+"; employees: number }[];
  /** By the month a training's first day fell in (YYYY-MM): how many staff attended one, and how many trainings. */
  attendeesByMonth: { month: string; employees: number; trainings: number }[];
  attendance: {
    /** Staff who attended at least one training in the year, of all staff. */
    attended: number;
    total: number;
    /** Trainings HR recorded that count toward the year (beside the seminars below). */
    recordsCounted: number;
    /** The year's seminars that have started, earliest first, with everyone seated on them. */
    seminars: HrSeminarAttendance[];
  };
  followUp: {
    /** Seats whose money isn't settled yet, from every fiscal year (cash doesn't wait for the year: the code review of
     * 12ag Part B), the most pressing first. */
    rows: HrFollowUpRow[];
    /** The chosen year's attendees, still with the office, with no cash advance and no claim at all: they may still
     * file a reimbursement, or never claim. */
    noClaim: HrNoClaimRow[];
  };
}

export interface HrCount {
  name: string;
  count: number;
}

export interface HrSeminarAttendance {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  attended: number;
  didNotAttend: number;
  /** Seated, with no attendance recorded yet. */
  toRecord: number;
  /** Who attended, by name (for the chart's tooltip). */
  attendees: string[];
}

/** Where a seat's money stands when it isn't settled. An attendee's: their cash advance still with Finance, released
 * with no report filed, the report (a liquidation, or a reimbursement claim: `claim`) with HR, with Finance, or
 * returned for correction, or a claim validated and not yet paid. Also cash out with no report possible yet: a seat
 * whose attendance HR hasn't recorded after the seminar, or one HR recorded "Did not attend" whose own advance hasn't
 * been refunded (the code review of 12ag Part B). */
export type HrFollowUpStage =
  | "requested" | "noReport" | "withHr" | "withFinance" | "returned" | "reimbursementUnpaid"
  | "attendanceUnrecorded" | "refundDue";

export interface HrFollowUpRow {
  participantId: string;
  employee: string;
  /** false: no longer with the office (12ab), though their seat and its money are still open. */
  withOffice: boolean;
  seminarId: string;
  seminarTitle: string;
  /** The fiscal year the seminar was filed under ("2029"): the list holds every year's open money. */
  fiscalYear: string;
  endDate: string;
  stage: HrFollowUpStage;
  /** The report is a reimbursement claim (the office owes the employee; no cash is out), not a liquidation. */
  claim: boolean;
  /** The liquidation report's due date (30 days after the seminar), and whether it has passed with the report still
   * to be filed or corrected, or with attendance still to be recorded. A claim is never overdue. */
  dueDate: string | null;
  overdue: boolean;
  /** The report covering the seat, when one is filed (its own, or the group's). */
  reportId?: string;
  reportNo?: string;
  /** Covered by a co-participant's group cash advance or report: the holder files the report. */
  group: boolean;
}

export interface HrNoClaimRow {
  participantId: string;
  employee: string;
  withOffice: boolean;
  seminarId: string;
  seminarTitle: string;
  endDate: string;
  /** HR entered expenses the office paid for them directly (so there may be nothing left to claim). */
  officePaid: boolean;
}

export interface TrainingBudgetSplit {
  Meals: number;
  Transportation: number;
  Accommodation: number;
  Materials: number;
}

export type AttendanceStatus = "Attended" | "Did not attend";

export interface TrainingParticipant {
  id: string;
  trainingProgramId: string;
  employeeId: string;
  status: "Assigned" | "Completed" | "Cancelled" | "Liquidated" | "Liquidation Pending" | "Archived";
  allowanceAllocated: number;
  // Recorded by HR once the seminar has started, separately from `status` (which tracks
  // the liquidation). Only an "Attended" enrolment gets a liquidation form. Unset means
  // not recorded yet.
  attendance?: AttendanceStatus;
  attendanceBy?: string;   // full name of the HR officer who recorded it
  attendanceAt?: string;   // ISO timestamp
  attendanceCertificateId?: string; // the certificate of attendance "Attended" was recorded on (R4)
  // Set when the enrolment was archived with its seminar (status "Archived"); restoring the
  // seminar puts it back to "Assigned".
  archivedWithSeminarAt?: string;
  // When the enrolment was made. Set on every enrolment since the TDP rule (2026-10-28), so one
  // without it was made before the rule.
  assignedAt?: string;
  // Why someone the TDP doesn't identify for this seminar was seated (HSAC RAB 1, 2026-10-28,
  // known-issues 12z). Only HR and the Administrator ever receive it.
  tdpException?: TdpJustification;
  // When the seat came under its seminar's own justification (a seminar outside the TDP covers its
  // roster, 12z Part C). It stays justified if the seminar later covers a need.
  tdpUnderSeminar?: string;
  // A representative sent in lieu of someone (HSAC RAB 1, 2026-10-28, 12z Part B): the original's
  // enrolment is "Cancelled" with `replacedBy`, and the representative's new one `replaces` it (its id).
  replacedBy?: { participantId: string; employeeId: string; fullName: string; at: string; by: string };
  replaces?: string;
}

// Seating someone the TDP doesn't identify (HSAC RAB 1's answer of 2026-10-28): "if hindi identified
// sa TDP … hindi pwede. Pero di naman tayo strict doon. Case to case basis", with a justification.
// The committees are HSAC's own list of designations that call for training.
export const TDP_COMMITTEES = [
  "BAC", "BAC Secretariat", "BAC TWG", "IQA/QMS Team", "GAD Focal Point System", "OSH Committee",
  "Discipline, Grievance or Fact-Finding Committee", "Other"
] as const;
export type TdpCommittee = (typeof TDP_COMMITTEES)[number];
// "In lieu of" is set only when HR sends a representative (Part B), never chosen on its own. "Hired after the TDP":
// someone the approved TDP couldn't list because they joined after it (the user's report, 2026-11-03).
export type TdpExceptionKind = "Designated" | "Identified by the Chief" | "Hired after the TDP" | "Other" | "In lieu of";
export interface TdpPerson { name: string; position: string }
// What HR fills in; the server adds who recorded it and when.
export interface TdpJustificationInput {
  kind: TdpExceptionKind;
  committee?: TdpCommittee;    // Designated
  committeeOther?: string;     // Designated, committee "Other"
  reason: string;
  identifiedBy: TdpPerson;     // who identified them (HSAC: the Chief or head of agency may)
  referenceNo?: string;        // the SO or Office Order number
  referenceDate?: string;      // YYYY-MM-DD
}
export interface TdpJustification extends TdpJustificationInput {
  // "In lieu of" (Part B): whose seat they took, set by the server.
  inLieuOf?: { participantId: string; employeeId: string; fullName: string };
  recordedBy: { id: string; name: string; role: UserRole };
  recordedAt: string;
}
// Where an enrolment stands against the TDP, worked out on each request for HR and the
// Administrator (never stored): identified by the person's Plan A, outside it with a justification of
// their own or under their seminar's, outside it from before the rule, or outside it with none (the
// plan changed since).
export type TdpStanding = "identified" | "justified" | "seminar" | "beforeRule" | "missing";
// GET /api/training/participants: each enrolment with its standing.
export interface TrainingParticipantRow extends TrainingParticipant {
  tdp?: TdpStanding;
  /** Their certificate of attendance (R4), if one is on file; HR and the Administrator only. `sameFileAs`:
   * other seats whose certificate on file is the very same file. */
  certificate?: (AttendanceCertificateView & { sameFileAs?: CertificateTwin[] }) | null;
  /** With no Personnel login, HR or the Administrator uploads it for them. */
  hasPersonnelLogin?: boolean;
  /** Their own uploads reached the limit, so HR or the Administrator may upload it for them. */
  certificateCapped?: boolean;
  /** Why HR or the Administrator can't upload it now, if they can't. */
  certificateBlockedReason?: string | null;
}

// A seminar the TDP doesn't cover is held only with its own justification (HSAC RAB 1, 2026-10-28;
// 12z Part C): e.g. a training paid by the Central Office, an invitation from another agency, or a new
// law or issuance.
export const SEMINAR_TDP_KINDS = ["Central Office training", "Invitation from another agency", "New law or issuance", "Other"] as const;
export type SeminarTdpKind = (typeof SEMINAR_TDP_KINDS)[number];
export interface SeminarTdpJustificationInput {
  kind: SeminarTdpKind;
  reason: string;
  approvedBy: TdpPerson;       // who approved holding it
  referenceNo?: string;        // a memo, invitation or issuance number
  referenceDate?: string;      // YYYY-MM-DD
}
export interface SeminarTdpJustification extends SeminarTdpJustificationInput {
  recordedBy: { id: string; name: string; role: UserRole };
  recordedAt: string;
}
// Where a seminar stands against the TDP, worked out on each request for HR and the Administrator:
// it covers a need in its year's Plan A, it is held with a justification, or it is outside the TDP
// from before the rule (2026-10-29) or since (its needs or the plan changed).
export type SeminarTdpStanding = "inTdp" | "justified" | "beforeRule" | "missing";
// GET /api/training/programs: each seminar with its standing.
export interface TrainingProgramRow extends TrainingProgram { tdp?: SeminarTdpStanding }

// --- OFFICIAL TRAINING & DEVELOPMENT PLAN (Plan A / Plan D) ---
// The RAB-1 form lists, per employee, the trainings they still need in three
// columns. Plan D is the same list checked off mid-year.
export type TrainingNeedCategory = "Function" | "Additional Function" | "Career Advancement";

export const TRAINING_NEED_CATEGORIES: TrainingNeedCategory[] = ["Function", "Additional Function", "Career Advancement"];

// Column headings exactly as the official workbook prints them.
export const TRAINING_NEED_COLUMN_LABELS: Record<TrainingNeedCategory, string> = {
  "Function": "Needed Training for the Function",
  "Additional Function": "Needed Training for Additional Function/Designation",
  "Career Advancement": "Needed Training for Career Advancement"
};

export interface TrainingNeed {
  id: string;
  employeeId: string; // Employee.id, the same form TrainingParticipant uses
  fiscalYear: string; // label, e.g. "2026"
  category: TrainingNeedCategory;
  title: string;
  // Plan D: HR's decision overrides whatever the evidence says.
  accomplishedOverride?: boolean;
  remarks?: string;
  // Set when the fiscal-year rollover brought this need forward because it was still
  // unmet. It holds the year the need was FIRST raised, not merely the previous one, so
  // a need that has rolled twice still reads "carried from 2025" and its true age stays
  // visible in Plan A.
  carriedFromFiscalYear?: string;
  // Set when HR added this need after the TDP was uploaded ("Add Training Need", 12ad): one of the TDP's own
  // trainings, under a column where the TDP lists it, for someone it couldn't list. Absent: from the TDP, or carried.
  addedAfterTdp?: TrainingNeedAddition;
  // Set on a need for a training the uploaded TDP doesn't list (12ae): its justification and who added it. It never
  // counts as a TDP need (who the TDP identifies, whether a seminar is in it), and is kept when the need is carried.
  outsideTdp?: OutsideTdpNeed;
  createdAt: string;
  createdBy: string;
}

// Why a training the uploaded TDP doesn't list is in someone's plan (12ae, the user's request of 2026-11-09): the same
// justification a seminar outside the TDP gives (12z Part C), and who added it and when.
export interface OutsideTdpNeed extends SeminarTdpJustificationInput {
  addedBy: { id: string; name: string; role: UserRole };
  addedAt: string;         // ISO
}

// Why HR added a need after the TDP (the user's request of 2026-11-08, known-issues 12ad).
export type NeedAdditionBasis = "Hired after the TDP" | "Designated after the TDP" | "Other";
export interface TrainingNeedAddition {
  basis: NeedAdditionBasis;
  note?: string;           // required for "Other"; an SO or Office Order number can go here
  addedBy: { id: string; name: string; role: UserRole };
  addedAt: string;         // ISO
}

// One of the uploaded TDP's own trainings, as "Add Training Need" offers it (12ad): the columns the TDP lists it
// under, and its spelling in each (the one stored, since titles are matched as written).
export interface TdpTrainingChoice {
  key: string;             // normalizeTitle
  title: string;           // the first spelling
  categories: TrainingNeedCategory[];
  spellings: Partial<Record<TrainingNeedCategory, string>>;
  mandate?: { basis: string };
}

// How a need was judged accomplished for Plan D.
export interface TrainingNeedStatus {
  accomplished: boolean;
  source: "seminar" | "recorded-training" | "pds" | "override" | null;
  evidence?: string; // e.g. the seminar title that satisfied it
  date?: string;
}

export interface TrainingNeedRow extends TrainingNeed {
  status: TrainingNeedStatus;
  /** DERIVED: the law or rule that makes this training mandatory, when HR marked its title. */
  mandate?: { basis: string };
}

// A training the law requires (HSAC RAB 1's step 5, "Prioritization – statutory/legal mandates"),
// marked per title by HR or the Administrator, for every year. Its unmet needs come first in Plan D,
// in planning and in the participant picker. The plan words one law several ways ("Orientation on RA
// 6713 …", "RA 6713 (Code of Conduct …)"), so several titles may share one basis.
export interface TrainingMandate {
  id: string;
  title: string;          // the plan title HR chose, cleaned (cleanText): what is shown and logged
  // normalizeTitle of the title as sent, which is the plan's own key. Never recompute it from `title`:
  // cleaning first would miss plan titles with a soft hyphen, a ligature or an invisible character.
  key: string;
  basis: string;          // the law or rule, e.g. "R.A. 6713 (Code of Conduct)"
  markedBy: { id: string; name: string; role: UserRole };
  markedAt: string;
}

// One employee's block in the plan, with their needs split by column.
export interface TrainingPlanEmployee {
  employeeId: string;
  fullName: string;
  position: string;
  division: string;
  needs: Record<TrainingNeedCategory, TrainingNeedRow[]>;
}

// One row of the "which plan needs does this seminar cover?" picker.
export interface TrainingNeedCatalogItem {
  title: string;
  employeeCount: number;
  categories: TrainingNeedCategory[];
  /** The law or rule that makes it mandatory, when HR marked its title (listed first). */
  mandate?: { basis: string };
  /** A training outside the TDP (12ae): the justification of its first need, to start a seminar's from. */
  outside?: SeminarTdpJustificationInput;
}

export interface TrainingPlanOffice {
  office: string; // uppercase heading, as the form prints it
  employees: TrainingPlanEmployee[];
}

export interface TrainingLiquidationExpense {
  id: string;
  trainingProgramId: string;
  // Which enrolled participant this expense is charged to. Optional — program-wide
  // costs (venue rental, speaker fees) legitimately have no single owner.
  trainingParticipantId?: string;
  employeeId?: string; // denormalised from the participant, for display/filtering
  expenseCategory: TrainingExpenseCategory;
  description: string;
  amount: number;
  receiptFileName?: string;
  dateIncurred: string;
  submittedBy: string; // user id
  status: "Pending" | "Approved" | "Rejected";
  // Where the row came from: typed by HR, or copied from a validated liquidation report.
  // Rows saved before this existed have none; a report's rows carry the employee's id in
  // submittedBy, HR's carry a user id.
  source?: "hr" | "report";
}

// --- SIGNATORIES (Utilities → Manage Signatories) ---
// The people whose names print on official forms. They are entered through the UI, never
// in code, so replacing someone (e.g. an accountant who resigned) is data entry.
// To add a role (e.g. "Immediate Supervisor"), extend both lists below; stored records are
// unaffected, so no migration is needed.
export type SignatoryRole = "Accountant" | "Authorized Representative";
export const SIGNATORY_ROLES: SignatoryRole[] = ["Accountant", "Authorized Representative"];
// Roles held by one person at a time: appointing a new one ends the previous term.
export const SINGLE_HOLDER_SIGNATORY_ROLES: SignatoryRole[] = ["Accountant"];

export interface Signatory {
  id: string;
  employeeId?: string;       // Employee.id, when picked from the staff list
  fullName: string;
  position: string;          // the title printed under the name
  role: SignatoryRole;
  status: "Active" | "Inactive";
  effectiveFrom: string;     // YYYY-MM-DD
  effectiveTo?: string;      // YYYY-MM-DD; set when deactivated or replaced
  createdBy: string;         // full name of the Admin who added the entry
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

// What non-admins receive from GET /api/signatories: who can sign right now, nothing more.
export type ActiveSignatory = Pick<Signatory, "id" | "fullName" | "position" | "role">;



