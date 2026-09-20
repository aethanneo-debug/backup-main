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
  verifiedBy?: string;
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
  dateNeeded: string;
  passengers: string;
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
  isRead: boolean;
  timestamp: string;
  targetRole?: string; // If undefined, visible to everyone. If specified, only visible to users with this role
  targetEmployeeId?: string; // If specified, only visible specifically to this individual employee
  // Stable key for system-generated notices (e.g. "liq-due:<participantId>:overdue")
  // so a reminder is never sent twice, even across server restarts.
  dedupeKey?: string;
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
  | "Meals"
  | "Transportation"
  | "Accommodation"
  | "Materials"
  | "Venue Rental"
  | "Speaker Fees"
  | "Miscellaneous";

export const TRAINING_EXPENSE_CATEGORIES: TrainingExpenseCategory[] = [
  "Meals",
  "Transportation",
  "Accommodation",
  "Materials",
  "Venue Rental",
  "Speaker Fees",
  "Miscellaneous"
];

// One line of the PARTICULARS block on the COA Liquidation Report.
export interface LiquidationParticular {
  id: string;
  description: string;
  amount: number; // PHP, rounded to 2 decimals at the boundary
  // Which bucket this line is charged to. Optional so reports filed before the picker
  // existed stay valid; the server falls back to "Miscellaneous".
  category?: TrainingExpenseCategory;
}

export interface LiquidationSubmission {
  id: string;
  submissionNo: string;
  activityId: string;
  employeeId: string; // EMP006, etc.
  employeeName: string;
  totalReleased: number;
  totalSpent: number;
  remainingBalance: number;
  remarks: string;
  supportingDocs: { id: string; name: string; type: string; filename: string; uploadedAt: string }[];
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
  cashAdvanceDvNo?: string;          // e.g. "2026-08-336"
  cashAdvanceDvDate?: string;        // YYYY-MM-DD
  refundOrNo?: string;               // e.g. "0247983" — only when there is a refund
  refundOrDate?: string;             // YYYY-MM-DD
  jevNo?: string;                    // filled by the Accountant

  // --- Reimbursement ---
  // When an employee is assigned a seminar but never receives the cash advance, they pay
  // out of pocket and the Liquidation Report doubles as the claim to get it back. That is
  // simply totalSpent > totalReleased, so the amount is derived, never typed.
  reimbursementStatus?: "Not Required" | "Awaiting Reimbursement" | "Reimbursed";
  reimbursementAmount?: number;      // = max(0, totalSpent - totalReleased)
  reimbursementDvNo?: string;        // the DV the reimbursement was paid on
  reimbursementDate?: string;        // YYYY-MM-DD
  reimbursedBy?: string;             // the Financial Officer who released it

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

  // "Certified by Authorized Representative" is the normal terminal state at RAB 1: the
  // Financial Officer signs box B of the COA Liquidation Report ("Head of Agency /
  // Authorized Representative") under delegated authority. This is a documented business
  // rule, not a skipped approval. "Bypassed (Auto-Approved by Finance)" is the legacy
  // wording for the same thing — migrated on load, but kept here because a restored
  // backup can still carry it.
  divisionChiefStatus: "Pending Chief Approval" | "Approved" | "Certified by Authorized Representative"
    | "Bypassed (Auto-Approved by Finance)" | "Returned by Chief" | "Rejected";
  divisionChiefRemarks?: string;
  divisionChiefApprovedBy?: string;
  divisionChiefApprovedAt?: string;

  status: "Pending HR Review" | "Verified & Forwarded" | "Validated & Endorsed" | "Approved" | "Completed" | "Returned" | "Rejected";
  createdAt: string;
  dateSubmitted?: string;
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
  category: string;
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
}

// One row of GET /api/training/recommendations — an employee scored for a seminar.
export interface TrainingCandidate {
  employeeId: string; // Employee.id — the form stored in participantIds
  fullName: string;
  position: string;
  division: string;
  dateHired: string;
  // 1 = new hire, 2 = never attended a TDP seminar, 3 = everyone else
  priority: 1 | 2 | 3;
  priorityLabel: string;
  monthsSinceHire: number | null;
  hasTdpHistory: boolean;
  matchesTarget: boolean;
  // This seminar covers something their Plan A actually lists — the strongest
  // reason to give them a seat, so it outranks the new-hire preference.
  needsThis: boolean;
  needMatches: string[];
  eligible: boolean;
  ineligibleReason?: string;
}

export interface TrainingBudgetSplit {
  Meals: number;
  Transportation: number;
  Accommodation: number;
  Materials: number;
}

export interface TrainingParticipant {
  id: string;
  trainingProgramId: string;
  employeeId: string;
  status: "Assigned" | "Completed" | "Cancelled" | "Liquidated" | "Liquidation Pending" | "Archived";
  allowanceAllocated: number;
}

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
  createdAt: string;
  createdBy: string;
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
}



