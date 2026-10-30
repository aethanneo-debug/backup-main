import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI, Type } from "@google/genai";
import crypto from "crypto";
import { readXlsxWorkbook, XlsxReadError } from "./src/server/xlsx/readXlsx";
import { parsePlanASheet, PlanABlock } from "./src/server/xlsx/parsePlanA";
import { matchWorkbookName } from "./src/server/xlsx/matchEmployeeName";
import { seminarBudget, allocationIncrease, isSeminarSettled } from "./src/trainingBudget";
import { centavos, pesos, sumPesos, liquidationBalance } from "./src/liquidationMoney";
import { createTransactions } from "./src/server/jsonTransaction";
import { firstTimestamp, SAFE_FILE_URL } from "./src/utils";
import { cleanFileName, liquidationDocumentRows } from "./src/server/liquidationDocuments";
import { trainingCoverage, yearTrainingCounter } from "./src/trainingCoverage";
import {
  advanceCovering, advanceCovers, advancesCovering, coveredEnrolmentIds, coversTotal, isGroupAdvance, portionCentavos, releasedByEnrolment,
  reportCovering, spendableCentavos
} from "./src/advanceCoverage";
import { enrolmentsForBudget } from "./src/server/budgetEnrolments";
import { vehicleWithAdvanceFields as checkVehicleWithAdvance, type VehicleWithAdvanceFields } from "./src/vehicleWithAdvance";
import { cleanText, isCalendarDate } from "./src/inputText";
import { addedGaps, divisionGaps, gapText, MAX_DAYS as MAX_SEMINAR_DAYS, seminarWeekdays, type CoverageStaff, type DivisionGap } from "./src/divisionCoverage";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "integra-sync-secure-capstone-key";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

import { createServer as createViteServer } from "vite";
import { 
  UserRole, 
  User, 
  Employee, 
  EmploymentHistory, 
  Training, 
  TransactionStatus, 
  FinancialTransaction, 
  AssetStatus, 
  Asset, 
  AssetIssuance, 
  SupplyItem, 
  SupplyIssuance, 
  RequestType, 
  RequestStatus, 
  AnyRequest, 
  AuditLog,
  Liquidation,
  BudgetAllocation,
  FinanceAuditLog,
  Notification,
  NotificationLink,
  BudgetRequestItem,
  PDS,
  TrainingProgram,
  TrainingParticipant,
  TrainingLiquidationExpense,
  TrainingBudgetSplit,
  TrainingCandidate,
  TrainingNeed,
  TrainingNeedCategory,
  TrainingNeedStatus,
  TrainingNeedRow,
  TrainingNeedCatalogItem,
  TrainingMandate,
  TrainingPlanEmployee,
  TrainingPlanOffice,
  TRAINING_NEED_CATEGORIES,
  SpendingCategory,
  SPENDING_CATEGORIES,
  TrainingExpenseCategory,
  TRAINING_EXPENSE_CATEGORIES,
  TrainingEvaluationRating,
  TrainingQualitativeRating,
  TRAINING_EVALUATION_BANDS,
  Signatory,
  SignatoryRole,
  ActiveSignatory,
  SIGNATORY_ROLES,
  SINGLE_HOLDER_SIGNATORY_ROLES,
  ClaimType,
  CLAIM_TYPES,
  CashAdvance,
  CashAdvanceCover,
  CORRECTION_FIELDS,
  CorrectionField,
  CorrectionItem,
  CorrectionRequest,
  LiquidationDocument,
  LiquidationSubmission,
  LiquidationSubmissionView,
  TdpJustification,
  TdpJustificationInput,
  TrainingParticipantRow,
  SeminarTdpJustificationInput,
  TrainingProgramRow
} from "./src/types";
import {
  coveredNeeds, normalizeTitle, readSeminarTdpJustification, readTdpJustification, seatsNeedingJustification, seminarCoversPlan,
  seminarNeedsJustification, seminarTdpStanding, tdpKindText, tdpStanding, type SeatCheck
} from "./src/tdpRules";
import { swapAdvanceStep } from "./src/representative";
import { catalogOrder, isMandate, mandateFor, mandateIndex, readMandateBasis, readMandateTitle } from "./src/trainingMandates";
import { dvKey, readDvNumber } from "./src/dvNumber";
import { reimbursementLimit, reimbursementProblem, seminarClaimMode } from "./src/reimbursement";

const app = express();
const PORT = 3000;
const DATA_FILE_PATH = path.join(process.cwd(), "data_store.json");

app.use(express.json({ limit: "50mb" }));

// Mock database type definitions
interface DBStructure {
  users: User[];
  employees: Employee[];
  employmentHistory: EmploymentHistory[];
  trainings: Training[];
  financialTransactions: FinancialTransaction[];
  assets: Asset[];
  assetIssuances: AssetIssuance[];
  supplyItems: SupplyItem[];
  supplyIssuances: SupplyIssuance[];
  requests: AnyRequest[];
  auditLogs: AuditLog[];
  backups?: any[];
  liquidations: Liquidation[];
  budgetAllocations: BudgetAllocation[];
  financeAuditLogs: FinanceAuditLog[];
  notifications: Notification[];
  budgetRequests: BudgetRequestItem[];
  activities: any[];
  liquidationSubmissions: any[];
  cashAdvances: any[];
  trainingEvaluations: any[];
  activityBudgetLinks: any[];
  pds: PDS[];
  fiscalYears: any[];
  hsacBudgets: any[];
  trainingBudgets: any[];
  trainingPrograms: TrainingProgram[];
  trainingParticipants: TrainingParticipant[];
  trainingLiquidations: TrainingLiquidationExpense[];
  trainingNeeds: TrainingNeed[];
  // Training titles the law requires (HSAC RAB 1's step 5): their needs come first (12z Part D).
  trainingMandates: TrainingMandate[];
  signatories: Signatory[];
}

// Check and seed DB on server launch
function getInitialData(): DBStructure {
  if (fs.existsSync(DATA_FILE_PATH)) {
    try {
      const content = fs.readFileSync(DATA_FILE_PATH, "utf8");
      const loaded = JSON.parse(content);
      
      let changed = false;

      // Migrate existing "Admin" role string to new "Administrator / Division Chief" value
      if (loaded.users && Array.isArray(loaded.users)) {
        loaded.users.forEach((u: any) => {
          if (u.role === "Admin") {
            u.role = UserRole.SUPER_ADMIN;
            changed = true;
          }
        });
      }
      if (loaded.notifications && Array.isArray(loaded.notifications)) {
        loaded.notifications.forEach((n: any) => {
          if (n.targetRole === "Admin") {
            n.targetRole = UserRole.SUPER_ADMIN;
            changed = true;
          }
        });
      }
      if (!loaded.liquidations) {
        loaded.liquidations = [
          {
            id: "liqp-1",
            liquidationNo: "LIQ-2026-001",
            requestRef: "REQ-VHL-091",
            employee: "Andres B. Bonifacio",
            department: "Adjudication Division",
            amountReleased: 5000.00,
            amountLiquidated: 4800.00,
            remainingBalance: 200.00,
            liquidationDate: "2026-06-03",
            status: "Completed",
            notes: "Completed Petron fuel trip liquidation. Refund has been submitted.",
            approvedBy: "Juan dela Cruz",
            createdAt: "2026-06-03T17:00:00Z"
          },
          {
            id: "liqp-2",
            liquidationNo: "LIQ-2026-002",
            requestRef: "REQ-SPL-044",
            employee: "Jolly Joy A. Almoite",
            department: "Administrative and Finance Division",
            amountReleased: 15000.00,
            amountLiquidated: 14500.00,
            remainingBalance: 500.00,
            liquidationDate: "2026-05-15",
            status: "Completed",
            notes: "La Union Office Supplies purchase liquidation.",
            approvedBy: "Juan dela Cruz",
            createdAt: "2026-05-15T16:45:00Z"
          },
          {
            id: "liqp-3",
            liquidationNo: "LIQ-2026-003",
            requestRef: "REQ-TRV-112",
            employee: "Juan dela Cruz",
            department: "Administrative and Finance Division",
            amountReleased: 12000.00,
            amountLiquidated: 0.00,
            remainingBalance: 12000.00,
            liquidationDate: "2026-06-08",
            status: "Under Review",
            notes: "Awaiting review of food receipts and accommodation invoice details for mediation trip.",
            createdAt: "2026-06-08T09:00:00Z"
          },
          {
            id: "liqp-4",
            liquidationNo: "LIQ-2026-004",
            requestRef: "REQ-PRV-312",
            employee: "Maria Clara V. Santos",
            department: "Administrative and Finance Division",
            amountReleased: 8500.00,
            amountLiquidated: 0.00,
            remainingBalance: 8500.00,
            liquidationDate: "2026-06-09",
            status: "Pending Submission",
            notes: "Equipment repairs cash advance for regional branch laptops.",
            createdAt: "2026-06-09T08:30:00Z"
          }
        ];
        changed = true;
      }
      if (!loaded.budgetAllocations) {
        loaded.budgetAllocations = [
          { id: "b-1", fiscalYearId: "fy-1", department: "Adjudication Division", budgetAllocation: 1200000.00, carryOver: 300000.00, budgetUtilized: 0, remainingBudget: 1500000.00, budgetPercentageUsed: 0 , allocatedPS: 600000, utilizedPS: 0, remainingPS: 600000, allocatedMOOE: 360000, utilizedMOOE: 0, remainingMOOE: 360000, allocatedCO: 240000, utilizedCO: 0, remainingCO: 240000 },
          { id: "b-1-old", fiscalYearId: "fy-2", department: "Adjudication Division", budgetAllocation: 2400000.00, carryOver: 0, budgetUtilized: 1500000.00, remainingBudget: 900000.00, budgetPercentageUsed: 0 , allocatedPS: 1200000, utilizedPS: 750000, remainingPS: 450000, allocatedMOOE: 720000, utilizedMOOE: 450000, remainingMOOE: 270000, allocatedCO: 480000, utilizedCO: 300000, remainingCO: 180000 },
          { id: "b-2", fiscalYearId: "fy-1", department: "Administrative and Finance Division", budgetAllocation: 2400000.00, carryOver: 100000.00, budgetUtilized: 0, remainingBudget: 2500000.00, budgetPercentageUsed: 0 , allocatedPS: 1200000, utilizedPS: 0, remainingPS: 1200000, allocatedMOOE: 720000, utilizedMOOE: 0, remainingMOOE: 720000, allocatedCO: 480000, utilizedCO: 0, remainingCO: 480000 },
          { id: "b-2-old", fiscalYearId: "fy-2", department: "Administrative and Finance Division", budgetAllocation: 800000.00, carryOver: 0, budgetUtilized: 700000.00, remainingBudget: 100000.00, budgetPercentageUsed: 0 , allocatedPS: 400000, utilizedPS: 350000, remainingPS: 50000, allocatedMOOE: 240000, utilizedMOOE: 210000, remainingMOOE: 30000, allocatedCO: 160000, utilizedCO: 140000, remainingCO: 20000 },
          { id: "b-3", fiscalYearId: "fy-1", department: "Legal Division", budgetAllocation: 800000.00, carryOver: 200000.00, budgetUtilized: 0, remainingBudget: 1000000.00, budgetPercentageUsed: 0 , allocatedPS: 400000, utilizedPS: 0, remainingPS: 400000, allocatedMOOE: 240000, utilizedMOOE: 0, remainingMOOE: 240000, allocatedCO: 160000, utilizedCO: 0, remainingCO: 160000 },
          { id: "b-3-old", fiscalYearId: "fy-2", department: "Legal Division", budgetAllocation: 1800000.00, carryOver: 0, budgetUtilized: 1600000.00, remainingBudget: 200000.00, budgetPercentageUsed: 0 , allocatedPS: 900000, utilizedPS: 800000, remainingPS: 100000, allocatedMOOE: 540000, utilizedMOOE: 480000, remainingMOOE: 60000, allocatedCO: 360000, utilizedCO: 320000, remainingCO: 40000 }
        ];
        changed = true;
      }
      if (!loaded.financeAuditLogs) {
        loaded.financeAuditLogs = [
          { id: "fl-1", user: "Juan dela Cruz", action: "Validate Transaction", module: "Financial Transactions", timestamp: "2026-05-13T09:30:00Z", previousValue: "Under Review", newValue: "Validated" },
          { id: "fl-2", user: "Juan dela Cruz", action: "Complete Liquidation", module: "Liquidation Monitoring", timestamp: "2026-06-03T17:00:00Z", previousValue: "Under Review", newValue: "Completed" }
        ];
        changed = true;
      }
      if (!loaded.budgetRequests) {
        loaded.budgetRequests = [
          { id: "br-1", department: "Adjudication Division", amountRequested: 150000.00, requestType: "Augmentation", purpose: "Additional travel allocations for provincial hearings", status: "Pending", createdAt: "2026-06-15T09:00:00Z" },
          { id: "br-2", department: "Legal Division", amountRequested: 50000.00, requestType: "Emergency", purpose: "Urgent purchase of legal research library subscriptions", status: "Approved", remarks: "Approved for FY2026 Q3", createdAt: "2026-06-12T14:30:00Z" }
        ];
        changed = true;
      }
      if (!loaded.notifications) {
        loaded.notifications = [
          {
            id: "notif-1",
            title: "Leave Request Submitted",
            message: "Atty. Korrine Madeleine Flores - Fontanilla has submitted an urgent Vacation Leave Request for your review.",
            type: "urgent",
            readBy: [],
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
            targetRole: UserRole.HR_OFFICER
          },
          {
            id: "notif-2",
            title: "Low Supply Inventory Range Alert",
            message: "Supply stock for 'A4 Multi-purpose Bond Paper (80gsm)' is currently low (5 units left). Please arrange purchase acquisition.",
            type: "warning",
            readBy: [],
            timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
            targetRole: UserRole.SUPER_ADMIN
          },
          {
            id: "notif-3",
            title: "Financial Liquidation Verification",
            message: "Juan dela Cruz submitted a travel liquidation of ₱12,000 for travel request REQ-TRV-112. Support vouchers need verification.",
            type: "info",
            readBy: [],
            timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
            targetRole: UserRole.FINANCE_OFFICER
          },
          {
            id: "notif-4",
            title: "Comprehensive Security Compliance Log Audit",
            message: "All HR and Finance tables comply with RA 10173 Data Privacy protection directives. Periodic validation complete.",
            type: "success",
            readBy: [],
            timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
            targetRole: UserRole.SUPER_ADMIN
          },
          {
            id: "notif-5",
            title: "En Banc Board Case Reconciliation Scheduled",
            message: "A general assembly has been scheduled for case adjustments on Room B at 09:00 AM.",
            type: "info",
            readBy: [],
            timestamp: new Date(Date.now() - 3600000 * 28).toISOString(),
            targetRole: UserRole.EMPLOYEE
          },
          {
            id: "notif-6",
            title: "Meeting Room Assignment Active",
            message: "Zoom meeting 'RAB 1 En Banc Case Reconciliation Adjudication' setup is ready for launch.",
            type: "success",
            readBy: [],
            timestamp: new Date(Date.now() - 3600000 * 30).toISOString(),
            targetRole: UserRole.EMPLOYEE
          }
        ];
        changed = true;
      }
      
      // Backfill missing fields in financial transactions
      loaded.financialTransactions.forEach((tx: any) => {
        if (!tx.department) {
          tx.department = tx.id === "tx-1" ? "Legal Division" : "Administrative and Finance Division";
          changed = true;
        }
        if (!tx.category) {
          tx.category = tx.id === "tx-1" ? "Office Supplies" : tx.id === "tx-3" ? "Fuel/Tolls" : "Maintenance";
          changed = true;
        }
        if (!tx.employeeRef) {
          tx.employeeRef = tx.id === "tx-1" ? "EMP006" : tx.id === "tx-3" ? "EMP006" : "EMP004";
          changed = true;
        }
        if (!tx.createdBy) {
          tx.createdBy = tx.id === "tx-1" ? "Samantha C. Bernardo" : tx.id === "tx-3" ? "Samantha C. Bernardo" : "Jolly Joy A. Almoite";
          changed = true;
        }
        if (!tx.dateCreated) {
          tx.dateCreated = tx.transactionDate;
          changed = true;
        }
      });

      if (!loaded.activities) {
        loaded.activities = [
          {
            id: "act-1",
            activityNo: "ACT-2026-001",
            title: "Regional Case Mediation Caravan",
            description: "En banc travel and lodging expenses for case mediations in Region 1.",
            dateScheduled: "2026-06-10",
            allottedBudget: 25000,
            budgetId: "b-2",
            assignedEmployeeId: "EMP006",
            status: "Active"
          },
          {
            id: "act-2",
            activityNo: "ACT-2026-002",
            title: "Legal Research Library Subscriptions",
            description: "Establishment of digital research accounts for legal officers.",
            dateScheduled: "2026-06-14",
            allottedBudget: 5000,
            budgetId: "b-3",
            assignedEmployeeId: "EMP006",
            status: "Active"
          },
          {
            id: "act-3",
            activityNo: "ACT-2026-003",
            title: "Administrative Technical Audit Workshop",
            description: "Capacity building and audits for regional support departments.",
            dateScheduled: "2026-06-25",
            allottedBudget: 15000,
            budgetId: "b-2",
            assignedEmployeeId: "EMP006",
            status: "Pending"
          }
        ];
        changed = true;
      }

      if (!loaded.liquidationSubmissions) {
        loaded.liquidationSubmissions = [
          {
            id: "liqsub-1",
            submissionNo: "LIQSUB-2026-001",
            activityId: "act-1",
            employeeId: "EMP006",
            employeeName: "Andres B. Bonifacio",
            totalReleased: 12000,
            totalSpent: 11500,
            remainingBalance: 500,
            remarks: "Hotel invoices and transportation receipts attached for review.",
            supportingDocs: [
              { id: "doc-1", name: "Official Vigan Lodging Receipt", type: "Invoice", filename: "vigan_lodging_receipt.pdf", uploadedAt: new Date().toISOString() }
            ],
            hrStatus: "Verified & Forwarded",
            hrRemarks: "Verified matching employee and activity relationship.",
            hrVerifiedBy: "Maria Clara V. Santos",
            hrVerifiedAt: "2026-06-16T10:00:00Z",
            financeStatus: "Pending Validation",
            financeRemarks: "",
            divisionChiefStatus: "Pending Chief Approval",
            divisionChiefRemarks: "",
            status: "Verified & Forwarded",
            createdAt: "2026-06-15T09:30:00Z"
          },
          {
            id: "liqsub-2",
            submissionNo: "LIQSUB-2026-002",
            activityId: "act-2",
            employeeId: "EMP006",
            employeeName: "Andres B. Bonifacio",
            totalReleased: 5000,
            totalSpent: 5000,
            remainingBalance: 0,
            remarks: "All items compiled.",
            supportingDocs: [],
            hrStatus: "Pending Review",
            hrRemarks: "",
            financeStatus: "Pending Validation",
            financeRemarks: "",
            divisionChiefStatus: "Pending Chief Approval",
            divisionChiefRemarks: "",
            status: "Pending HR Review",
            createdAt: "2026-06-19T14:22:00Z"
          }
        ];
        changed = true;
      }

      if (!loaded.activityBudgetLinks) {
        loaded.activityBudgetLinks = [
          { id: "bl-1", liquidationNo: "LIQ-2026-001", employee: "Andres B. Bonifacio", department: "Adjudication Division", amount: 12000.00, budgetId: "b-1", timestamp: "2026-06-14T10:00:00Z" },
          { id: "bl-2", liquidationNo: "LIQ-2026-002", employee: "Apolinario M. Mabini", department: "Legal Division", amount: 25000.00, budgetId: "b-3", timestamp: "2026-06-15T11:30:00Z" }
        ];
        changed = true;
      }
      if (!loaded.fiscalYears) {
        loaded.fiscalYears = [
          { id: "fy-1", label: "2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "Active", rollover_policy: "Standard" },
          { id: "fy-2", label: "2025", start_date: "2025-01-01", end_date: "2025-12-31", status: "Closed", rollover_policy: "Standard" }
        ];
        changed = true;
      }
      if (!loaded.hsacBudgets) {
        loaded.hsacBudgets = [
          { id: "hb-1", fiscalYearId: "fy-1", approvedBudget: 10000000.00, carryOverBudget: 600000.00, totalUtilized: 0 },
          { id: "hb-2", fiscalYearId: "fy-2", approvedBudget: 5000000.00, carryOverBudget: 300000.00, totalUtilized: 3800000.00 }
        ];
        changed = true;
      }

      if (!loaded.trainingBudgets) {
        loaded.trainingBudgets = [
          { id: "tb-1", fiscalYearId: "fy-1", totalBudget: 0.00 }
        ];
        changed = true;
      }
      if (!loaded.trainingPrograms) {
        loaded.trainingPrograms = [];
        changed = true;
      }
      if (!loaded.trainingParticipants) {
        loaded.trainingParticipants = [];
        changed = true;
      }
      if (!loaded.trainingLiquidations) {
        loaded.trainingLiquidations = [];
        changed = true;
      }
      if (!loaded.trainingNeeds) {
        loaded.trainingNeeds = [];
        changed = true;
      }
      // Mandated training titles (12z Part D). Starts empty: HR marks them, nothing is presumed.
      if (!Array.isArray(loaded.trainingMandates)) {
        loaded.trainingMandates = [];
        changed = true;
      }
      if (!loaded.cashAdvances) {
        loaded.cashAdvances = [];
        changed = true;
      }
      // Utilities → Manage Signatories. Starts empty: real names are entered in the UI.
      if (!Array.isArray(loaded.signatories)) {
        loaded.signatories = [];
        changed = true;
      }

      // Seminar attendance (only attendees get a liquidation form). An enrolment that already
      // has a report or is Liquidated was evidently attended; open ones stay unmarked for HR.
      // (A malformed entry is skipped: an exception here would fall back to the seed data.)
      const reportedIds = new Set((loaded.liquidationSubmissions || []).map((s: any) => s?.activityId));
      for (const p of (loaded.trainingParticipants || [])) {
        if (!p || typeof p !== "object" || p.attendance) continue;
        if (reportedIds.has(p.id) || p.status === "Liquidated") {
          p.attendance = "Attended";
          p.attendanceBy = "System (from the existing liquidation record)";
          p.attendanceAt = new Date().toISOString();
          changed = true;
        }
      }
      // "Liquidation Pending" with no report was left by the retired "Upload Liquidation
      // Documents" button, which filed nothing. Back to Assigned, so the enrolment goes
      // through attendance and a real report like any other. An enrolment a group's cash advance
      // covers is pending on the report its holder filed (HSAC RAB 1, 2026-10-26), so it stays.
      const groupReported = new Set<string>();
      for (const s of (loaded.liquidationSubmissions || [])) {
        const a = s && s.cashAdvanceId ? (loaded.cashAdvances || []).find((x: any) => x && x.id === s.cashAdvanceId) : null;
        if (a && isGroupAdvance(a)) for (const id of coveredEnrolmentIds(a)) groupReported.add(id);
      }
      for (const p of (loaded.trainingParticipants || [])) {
        if (!p || typeof p !== "object" || p.status !== "Liquidation Pending" || reportedIds.has(p.id) || groupReported.has(p.id)) continue;
        p.status = "Assigned";
        if (!Array.isArray(loaded.auditLogs)) loaded.auditLogs = [];
        loaded.auditLogs.unshift({
          id: `log-${Date.now()}-reset-${p.id}`,
          timestamp: new Date().toISOString(),
          userId: "system",
          username: "system",
          role: "System",
          action: "Reset Enrolment Status",
          details: `Enrolment ${p.id} reset from "Liquidation Pending" to "Assigned": it was marked by the retired upload button and no liquidation report exists.`
        });
        changed = true;
      }
      if (!loaded.trainingEvaluations) {
        loaded.trainingEvaluations = [];
        changed = true;
      }

      // Records finalised before the wording change recorded the Financial Officer's
      // delegated certification of box B as "Bypassed (Auto-Approved by Finance)" signed
      // by "System" — which reads as a skipped approval rather than the documented RAB 1
      // business rule it is. Re-attribute them to the officer who actually validated.
      for (const sub of (loaded.liquidationSubmissions || [])) {
        if (!sub || typeof sub !== "object") continue;
        if (sub.divisionChiefStatus === "Bypassed (Auto-Approved by Finance)") {
          sub.divisionChiefStatus = "Certified by Authorized Representative";
          if (!sub.divisionChiefApprovedBy || sub.divisionChiefApprovedBy === "System") {
            sub.divisionChiefApprovedBy = sub.financeValidatedBy || "Financial Officer";
          }
          if (sub.divisionChiefRemarks === "Validation finalized at Finance level.") {
            sub.divisionChiefRemarks = "Certified by the Financial Officer under delegated authority.";
          }
          changed = true;
        }
      }

      // Claim type (instructor's note 10). Reports filed before the claimant chose one
      // get it from their figures: a linked advance or one above zero was being
      // liquidated, none means the employee paid out of pocket.
      for (const sub of (loaded.liquidationSubmissions || [])) {
        if (!sub || typeof sub !== "object") continue;
        if (sub.claimType === "Liquidation" || sub.claimType === "Reimbursement") continue;
        const released = typeof sub.totalReleased === "number"
          ? sub.totalReleased
          : Number(String(sub.totalReleased ?? "").replace(/[^0-9.]/g, ""));
        sub.claimType = sub.cashAdvanceId || released > 0 ? "Liquidation" : "Reimbursement";
        changed = true;
      }

      // Backfill HR's allocated figure and a readable activity label onto reports filed
      // before they were stamped, so Finance's queue can flag a stated advance that
      // disagrees with HR's record on existing data too, not only on new submissions.
      for (const sub of (loaded.liquidationSubmissions || [])) {
        if (!sub || typeof sub !== "object") continue;
        if (sub.allocatedAtFiling !== undefined && sub.activityTitle) continue;
        const participant = (loaded.trainingParticipants || []).find((p: any) => p.id === sub.activityId);
        const activity = (loaded.activities || []).find((a: any) => a.id === sub.activityId);
        let allocated: number | undefined;
        let title = "";
        if (participant) {
          const prog = (loaded.trainingPrograms || []).find((tp: any) => tp.id === participant.trainingProgramId);
          const name = String(prog?.title || "").trim();
          allocated = Math.round((Number(participant.allowanceAllocated || 0)) * 100) / 100;
          title = name ? `Seminar - ${name}` : "Seminar";
        } else if (activity) {
          allocated = Math.round((Number(activity.allottedBudget || 0)) * 100) / 100;
          title = [activity.activityNo, activity.title].filter(Boolean).join(" - ") || "Activity";
        }
        if (allocated === undefined) continue; // unresolvable id — leave it unset
        if (sub.allocatedAtFiling === undefined) sub.allocatedAtFiling = allocated;
        if (!sub.activityTitle) sub.activityTitle = title;
        changed = true;
      }

      // Per-user read state (2026-10-19). A notice carried one isRead flag shared by everyone
      // it was for, so one HR officer reading it hid it from the others. One already read
      // counts as read by everyone it is for today; the rest start unread for all.
      for (const n of loaded.notifications || []) {
        if (!n || typeof n !== "object" || Array.isArray(n.readBy)) continue;
        n.readBy = n.isRead
          ? (loaded.users || []).filter((u: any) => noticeIsFor(n, u, loaded.employees || [])).map((u: any) => u.id)
          : [];
        delete n.isRead;
        changed = true;
      }

      // Group cash advances (HSAC RAB 1, 2026-10-26), checked, never changed: each group's amounts
      // add up to its total, its holder comes first, and everyone it covers is in one seminar. The
      // server builds them that way; a stored one that doesn't is reported, not repaired.
      for (const a of (loaded.cashAdvances || [])) {
        if (!a || !isGroupAdvance(a)) continue;
        const seminars = new Set(coveredEnrolmentIds(a).map((id: string) =>
          (loaded.trainingParticipants || []).find((p: any) => p && p.id === id)?.trainingProgramId));
        if (centavos(coversTotal(a.covers)) !== centavos(a.amount) || a.covers[0]?.participantId !== a.activityId
            || seminars.size !== 1 || seminars.has(undefined)) {
          console.warn(`[load] Group cash advance ${a.advanceNo || a.id} doesn't add up (its amounts, holder or seminar). Check it before Finance acts on it.`);
        }
      }

      if (changed) {
        writeDataFile(loaded);
      }
      return loaded;
    } catch (e) {
      // A database that can't be read or migrated is never replaced with the seed data below:
      // that erased every record. Stop instead, so it can be restored (it is in git).
      console.error("data_store.json could not be read or migrated. The server will not start, so the file is left untouched. If data_store.json.tmp exists, it may hold the latest complete save: check it first, then data_store.backup.json. Otherwise restore the file (e.g. `git restore data_store.json`, which loses everything since the last commit) or fix the migration, then start again.", e);
      throw e;
    }
  }

  // Set seed data
  const seedDB: DBStructure = {
    users: [
      { id: "u-1", username: "admin", email: "admin@hsac.gov.ph", fullName: "Hon. Romeo M. Alcantara", role: UserRole.SUPER_ADMIN, employeeId: "EMP001", status: "Active", createdAt: "2026-01-15T08:00:00Z" },
      { id: "u-2", username: "hr", email: "clara.santos@hsac.gov.ph", fullName: "Maria Clara V. Santos", role: UserRole.HR_OFFICER, employeeId: "EMP002", status: "Active", createdAt: "2026-01-15T08:30:00Z" },
      { id: "u-3", username: "finance", email: "juan.delacruz@hsac.gov.ph", fullName: "Juan dela Cruz", role: UserRole.FINANCE_OFFICER, employeeId: "EMP003", status: "Active", createdAt: "2026-01-15T09:00:00Z" },
      { id: "u-6", username: "employee", email: "andres.bonifacio@hsac.gov.ph", fullName: "Andres B. Bonifacio", role: UserRole.EMPLOYEE, employeeId: "EMP006", status: "Active", createdAt: "2026-01-15T10:00:00Z" },
      { id: "u-7", username: "budget", email: "budget@hsac.gov.ph", fullName: "Francisco F. Balagtas", role: UserRole.BUDGET_OFFICER, employeeId: "EMP007", status: "Active", createdAt: "2026-01-15T10:15:00Z" },
    ],
    employees: [
      {
        id: "emp-1",
        employeeId: "EMP001",
        fullName: "Hon. Romeo M. Alcantara",
        position: "Regional Executive Adjudicator",
        division: "Adjudication Division",
        employmentStatus: "Permanent",
        email: "admin@hsac.gov.ph",
        address: "La Union, Philippines",
        dateHired: "2020-03-01",
        contactNumber: "09171234567",
        emergencyContactName: "Leonor Rivera",
        emergencyContactPhone: "09177654321",
        pdsFieldName: "EMP001_PDS_Signed.pdf",
        pdsUploadedAt: "2026-02-01T09:00:00Z"
      },
      {
        id: "emp-2",
        employeeId: "EMP002",
        fullName: "Maria Clara V. Santos",
        position: "Administrative Officer IV (HR)",
        division: "Administrative and Finance Division",
        employmentStatus: "Permanent",
        email: "clara.santos@hsac.gov.ph",
        address: "San Fernando City, La Union",
        dateHired: "2021-06-15",
        contactNumber: "09182345678",
        emergencyContactName: "Crisostomo Ibarra",
        emergencyContactPhone: "091887654321",
        pdsFieldName: "EMP002_PDS.pdf",
        pdsUploadedAt: "2026-02-10T10:30:00Z"
      },
      {
        id: "emp-3",
        employeeId: "EMP003",
        fullName: "Juan dela Cruz",
        position: "Financial Analyst II",
        division: "Administrative and Finance Division",
        employmentStatus: "Permanent",
        email: "juan.delacruz@hsac.gov.ph",
        address: "Bauang, La Union",
        dateHired: "2022-01-10",
        contactNumber: "09193456789",
        emergencyContactName: "Juana dela Cruz",
        emergencyContactPhone: "09199876543",
        pdsFieldName: "EMP003_PDS.pdf",
        pdsUploadedAt: "2026-02-11T14:22:00Z"
      },
      {
        id: "emp-4",
        employeeId: "EMP004",
        fullName: "Eulogio IV Esturas",
        position: "Property Custodian / AO II",
        division: "Administrative and Finance Division",
        employmentStatus: "Permanent",
        email: "eulogio.esturas@hsac.gov.ph",
        address: "San Juan, La Union",
        dateHired: "2021-09-01",
        contactNumber: "09204567890",
        emergencyContactName: "Maria Makiling",
        emergencyContactPhone: "09201234567",
        pdsFieldName: "EMP004_PDS.pdf",
        pdsUploadedAt: "2026-02-12T11:15:00Z"
      },
      {
        id: "emp-5",
        employeeId: "EMP005",
        fullName: "Froilan J. Estepa",
        position: "Legal Officer IV",
        division: "Legal Division",
        employmentStatus: "Permanent",
        email: "froilan.estepa@hsac.gov.ph",
        address: "San Fernando City, La Union",
        dateHired: "2019-11-20",
        contactNumber: "09159998888",
        emergencyContactName: "Teresita Estepa",
        emergencyContactPhone: "09151112222",
        pdsFieldName: "EMP005_PDS_Official.pdf",
        pdsUploadedAt: "2026-02-05T08:45:00Z"
      },
      {
        id: "emp-6",
        employeeId: "EMP006",
        fullName: "Jolly Joy A. Almoite",
        position: "Adjudication Assistant",
        division: "Adjudication Division",
        employmentStatus: "Contractual",
        email: "jolly.almoite@hsac.gov.ph",
        address: "Agoo, La Union",
        dateHired: "2023-01-16",
        contactNumber: "09162223333",
        emergencyContactName: "Juan Almoite",
        emergencyContactPhone: "09164445555",
        pdsFieldName: "EMP006_PDS.pdf",
        pdsUploadedAt: "2026-03-01T15:00:00Z"
      },
      {
        id: "emp-7",
        employeeId: "EMP007",
        fullName: "Francisco F. Balagtas",
        position: "Administrative Officer IV (Budget)",
        division: "Administrative and Finance Division",
        employmentStatus: "Permanent",
        email: "budget@hsac.gov.ph",
        address: "San Fernando City, La Union",
        dateHired: "2022-04-18",
        contactNumber: "09175551234",
        emergencyContactName: "Juana Tiambeng",
        emergencyContactPhone: "09175554321",
        pdsFieldName: "EMP007_PDS.pdf",
        pdsUploadedAt: "2026-04-01T10:00:00Z"
      }
    ],
    employmentHistory: [
      { id: "h-1", employeeId: "EMP001", action: "Designation", previousDetails: "Attorney V", newDetails: "Regional Executive Adjudicator", effectiveDate: "2020-03-01", updatedBy: "System Setup" },
      { id: "h-2", employeeId: "EMP006", action: "Service Record Update", previousDetails: "Contract Started", newDetails: "Contract Renewed for FY 2026", effectiveDate: "2026-01-01", updatedBy: "Maria Clara V. Santos" },
      { id: "h-3", employeeId: "EMP002", action: "Promotion", previousDetails: "Administrative Officer III", newDetails: "Administrative Officer IV (HR)", effectiveDate: "2023-08-15", updatedBy: "System Administrator" }
    ],
    trainings: [
      { id: "t-1", employeeId: "EMP001", title: "Advanced Legal Writing & Case Adjudication", organizer: "Supreme Court / PhilJA", dateConducted: "2025-05-12", certificateFilename: "EMP001_PhilJA_Cert.pdf", trainingHours: 40 },
      { id: "t-2", employeeId: "EMP005", title: "Housing and Land Use Adjudication Rules", organizer: "HSAC Central Office", dateConducted: "2025-07-20", certificateFilename: "EMP005_AdjudicationRules.pdf", trainingHours: 24 },
      { id: "t-3", employeeId: "EMP002", title: "Strategic HR Management in the Public Sector", organizer: "Civil Service Commission", dateConducted: "2025-09-18", certificateFilename: "EMP002_StrategicHR_Cert.pdf", trainingHours: 32 },
      { id: "t-4", employeeId: "EMP003", title: "Government Procurement Reform Act (RA 9184)", organizer: "Department of Budget and Management", dateConducted: "2025-11-10", certificateFilename: "EMP003_RA9184_Cert.pdf", trainingHours: 16 }
    ],
    financialTransactions: [
      {
        id: "tx-1",
        transactionId: "TXN-2026-001",
        transactionDate: "2026-05-10",
        supplier: "La Union Office Supplies Trading",
        amount: 14500.00,
        description: "Purchase of high-speed heavy-duty staplers and binding materials for the Legal Records Section",
        receiptFilename: "receipt_001_legal.png",
        status: TransactionStatus.LIQUIDATED,
        supportingDocuments: [
          { id: "doc-1", name: "Approved Purchase Request", type: "Purchase Request", filename: "PR_2026_001.pdf", uploadedAt: "2026-05-09T08:00:00Z" },
          { id: "doc-2", name: "Official Vendor Invoice", type: "Invoice", filename: "INV_92318.pdf", uploadedAt: "2026-05-10T11:00:00Z" },
          { id: "doc-3", name: "Disbursement Voucher DV-26-882", type: "Disbursement Voucher", filename: "DV_26_882.pdf", uploadedAt: "2026-05-11T14:00:00Z" },
          { id: "doc-4", name: "Liquidation Report Signed", type: "Liquidation Report", filename: "LR_2026_01.pdf", uploadedAt: "2026-05-15T16:30:00Z" }
        ],
        history: [
          { id: "th-1", status: TransactionStatus.PENDING_VALIDATION, changedBy: "Andres B. Bonifacio", changedAt: "2026-05-10T11:05:00Z", remarks: "Initial upload of vendor official receipt." },
          { id: "th-2", status: TransactionStatus.UNDER_REVIEW, changedBy: "Juan dela Cruz", changedAt: "2026-05-12T10:00:00Z", remarks: "Under audit review of supporting receipts and disbursement voucher compatibility." },
          { id: "th-3", status: TransactionStatus.VALIDATED, changedBy: "Juan dela Cruz", changedAt: "2026-05-13T09:30:00Z", remarks: "All invoices and purchase orders confirmed correct." },
          { id: "th-4", status: TransactionStatus.LIQUIDATED, changedBy: "Juan dela Cruz", changedAt: "2026-05-15T17:00:00Z", remarks: "Liquidation approved. Records match general ledger entry." }
        ]
      },
      {
        id: "tx-2",
        transactionId: "TXN-2026-002",
        transactionDate: "2026-06-01",
        supplier: "A3 Tech Solutions and Services",
        amount: 32000.00,
        description: "IT Maintenance services and network diagnostic tests for the server room of RAB 1",
        receiptFilename: "receipt_02_server.png",
        status: TransactionStatus.PENDING_VALIDATION,
        supportingDocuments: [
          { id: "doc-5", name: "Scope of Work Approval", type: "Other", filename: "SOW_A3Tech.pdf", uploadedAt: "2026-06-01T09:00:00Z" }
        ],
        history: [
          { id: "th-5", status: TransactionStatus.PENDING_VALIDATION, changedBy: "Jolly Joy A. Almoite", changedAt: "2026-06-02T09:30:00Z", remarks: "Awaiting submission of structural invoice and job completion certification from service heads." }
        ]
      },
      {
        id: "tx-3",
        transactionId: "TXN-2026-003",
        transactionDate: "2026-06-03",
        supplier: "Petron Fuel Station SF",
        amount: 4800.00,
        description: "Official travel fuel refuel package for the Service Isuzu D-MAX - RAB 1 field mission",
        receiptFilename: "fuel_receipt_03.jpg",
        status: TransactionStatus.VALIDATED,
        supportingDocuments: [
          { id: "doc-6", name: "Approved Trip Ticket No 119", type: "Other", filename: "TripTicket_119.pdf", uploadedAt: "2026-06-03T07:45:00Z" },
          { id: "doc-7", name: "Official Fuel Invoice", type: "Invoice", filename: "PetronInv_9921.pdf", uploadedAt: "2026-06-03T16:00:00Z" }
        ],
        history: [
          { id: "th-6", status: TransactionStatus.PENDING_VALIDATION, changedBy: "Andres B. Bonifacio", changedAt: "2026-06-03T17:15:00Z", remarks: "Fuel slip submitted." },
          { id: "th-7", status: TransactionStatus.UNDER_REVIEW, changedBy: "Juan dela Cruz", changedAt: "2026-06-04T11:00:00Z", remarks: "Checking itinerary of Trip Ticket." },
          { id: "th-8", status: TransactionStatus.VALIDATED, changedBy: "Juan dela Cruz", changedAt: "2026-06-05T09:12:00Z", remarks: "Validated. Cleared for budget allocation." }
        ]
      },
      {
        id: "tx-4",
        transactionId: "TXN-2025-099",
        transactionDate: "2025-08-15",
        supplier: "Demo Supplier 2025",
        amount: 5000.00,
        description: "Demo transaction for previous FY 2025",
        receiptFilename: "demo_receipt_2025.png",
        status: TransactionStatus.LIQUIDATED,
        supportingDocuments: [],
        history: []
      },
      {
        id: "tx-5",
        transactionId: "TXN-2024-001",
        transactionDate: "2024-03-10",
        supplier: "Demo Supplier 2024",
        amount: 8000.00,
        description: "Demo transaction for previous FY 2024",
        receiptFilename: "demo_receipt_2024.png",
        status: TransactionStatus.LIQUIDATED,
        supportingDocuments: [],
        history: []
      }
    ],
    assets: [
      { id: "ast-1", assetNumber: "HSAC-RAB1-AST-001", serialNumber: "5CD1923JXP", category: "IT Equipment", description: "HP ProBook Laptop Core i5, 16GB RAM, 512GB SSD", dateAcquired: "2024-03-10", cost: 48500.00, status: AssetStatus.ASSIGNED, assignedToId: "EMP002", assignedToName: "Maria Clara V. Santos" },
      { id: "ast-2", assetNumber: "HSAC-RAB1-AST-002", serialNumber: "5CD1923K9D", category: "IT Equipment", description: "HP ProBook Laptop Core i5, 16GB RAM, 512GB SSD", dateAcquired: "2024-03-10", cost: 48500.00, status: AssetStatus.AVAILABLE },
      { id: "ast-3", assetNumber: "HSAC-RAB1-AST-003", serialNumber: "SN-VHL-ISZ8810", category: "Vehicles", description: "Executive Service Vehicle - Isuzu D-MAX 3.0 BluePower 4x4", dateAcquired: "2023-01-20", cost: 1450000.00, status: AssetStatus.ASSIGNED, assignedToId: "EMP001", assignedToName: "Hon. Romeo M. Alcantara" },
      { id: "ast-4", assetNumber: "HSAC-RAB1-AST-004", serialNumber: "OFC-DSK-2024-09", category: "Office Furniture", description: "Executive Mahogany Wooden Desk with drawers", dateAcquired: "2024-06-15", cost: 18000.00, status: AssetStatus.ASSIGNED, assignedToId: "EMP-FROILAN", assignedToName: "Froilan J. Estepa" },
      { id: "ast-5", assetNumber: "HSAC-RAB1-AST-005", serialNumber: "PRJ-EPS-7712", category: "IT Equipment", description: "Epson Multimedia Projector for Adjudication Hearing Room 1", dateAcquired: "2025-02-05", cost: 26000.00, status: AssetStatus.AVAILABLE },
      { id: "ast-6", assetNumber: "HSAC-RAB1-AST-006", serialNumber: "OFC-CHR-4422", category: "Office Furniture", description: "Ergonomic High-Back Executive Mesh Office Chair", dateAcquired: "2024-06-15", cost: 8500.00, status: AssetStatus.DAMAGED },
      { id: "ast-7", assetNumber: "HSAC-RAB1-AST-007", serialNumber: "TAB-APL-IPD09", category: "IT Equipment", description: "Apple iPad Pro 11-inch (M2, 128GB, Wi-Fi)", dateAcquired: "2024-08-22", cost: 52000.00, status: AssetStatus.LOST }
    ],
    assetIssuances: [
      { id: "iss-1", assetId: "ast-1", assetNumber: "HSAC-RAB1-AST-001", assignedToId: "EMP002", assignedToName: "Maria Clara V. Santos", dateIssued: "2024-03-12", quantity: 1, conditionOnIssue: "Brand New in box" },
      { id: "iss-2", assetId: "ast-3", assetNumber: "HSAC-RAB1-AST-003", assignedToId: "EMP001", assignedToName: "Hon. Romeo M. Alcantara", dateIssued: "2023-01-22", quantity: 1, conditionOnIssue: "Brand New" },
      { id: "iss-3", assetId: "ast-4", assetNumber: "HSAC-RAB1-AST-004", assignedToId: "EMP-FROILAN", assignedToName: "Froilan J. Estepa", dateIssued: "2024-06-16", quantity: 1, conditionOnIssue: "Good - Minor scratches" }
    ],
    supplyItems: [
      { id: "sup-1", name: "A4 Multi-purpose Bond Paper (80gsm)", totalQuantity: 150, availableQuantity: 112, unit: "reams" },
      { id: "sup-2", name: "Black Gel Ink Pen 0.5mm", totalQuantity: 300, availableQuantity: 245, unit: "pieces" },
      { id: "sup-3", name: "Sign Pen Blue 0.7mm", totalQuantity: 200, availableQuantity: 160, unit: "pieces" },
      { id: "sup-4", name: "Yellow Post-It notes 3x3", totalQuantity: 100, availableQuantity: 82, unit: "pads" },
      { id: "sup-5", name: "Heavy Duty Expanding Folders (Legal)", totalQuantity: 500, availableQuantity: 410, unit: "pieces" }
    ],
    supplyIssuances: [
      { id: "si-1", supplyId: "sup-1", supplyName: "A4 Multi-purpose Bond Paper (80gsm)", issuedToId: "EMP-FROILAN", issuedToName: "Froilan J. Estepa", quantity: 10, dateIssued: "2026-05-18" },
      { id: "si-2", supplyId: "sup-2", supplyName: "Black Gel Ink Pen 0.5mm", issuedToId: "EMP-JOLLY", issuedToName: "Jolly Joy A. Almoite", quantity: 12, dateIssued: "2026-05-20" },
      { id: "si-3", supplyId: "sup-5", supplyName: "Heavy Duty Expanding Folders (Legal)", issuedToId: "EMP-JOLLY", issuedToName: "Jolly Joy A. Almoite", quantity: 50, dateIssued: "2026-05-22" }
    ],
    requests: [
      {
        id: "req-1",
        requestType: RequestType.LEAVE,
        employeeId: "EMP-JOLLY",
        employeeName: "Jolly Joy A. Almoite",
        dateRequested: "2026-06-01",
        status: RequestStatus.PENDING,
        leaveType: "Vacation Leave",
        startDate: "2026-06-12",
        endDate: "2026-06-15",
        reason: "Family event / out of town celebration in Baguio City."
      } as any,
      {
        id: "req-2",
        requestType: RequestType.SERVICE_RECORD,
        employeeId: "EMP003",
        employeeName: "Juan dela Cruz",
        dateRequested: "2026-06-03",
        status: RequestStatus.APPROVED,
        purpose: "Loan application requirement with GSIS",
        copies: 2,
        approvedBy: "Maria Clara V. Santos (HR)",
        remarks: "Official physical copy prepared in sealed envelope."
      } as any,
      {
        id: "req-3",
        requestType: RequestType.VEHICLE,
        employeeId: "emp-samantha",
        employeeName: "Samantha C. Bernardo",
        dateRequested: "2026-06-04",
        status: RequestStatus.PENDING,
        destination: "Bangui, Ilocos Norte - Dispute Mediation Site Visit",
        purpose: "Conduct compulsory ocular inspection of disputable housing settlements.",
        dateNeeded: "2026-06-18",
        passengers: "Eulogio IV Esturas, Jolly Joy A. Almoite, Froilan J. Estepa"
      } as any,
      {
        id: "req-4",
        requestType: RequestType.ZOOM,
        employeeId: "EMP001",
        employeeName: "Hon. Romeo M. Alcantara",
        dateRequested: "2026-06-05",
        status: RequestStatus.APPROVED,
        meetingTitle: "RAB 1 En Banc Case Reconciliation Adjudication",
        meetingDate: "2026-06-10",
        startTime: "09:00 AM",
        endTime: "12:00 PM",
        alternativeHost: "jose.rizal@hsac.gov.ph",
        approvedBy: "Super Administrator",
        remarks: "Assigned Executive Account Room B"
      } as any,
      {
        id: "req-5",
        requestType: RequestType.SUPPLY,
        employeeId: "EMP002",
        employeeName: "Maria Clara V. Santos",
        dateRequested: "2026-06-06",
        status: RequestStatus.PENDING,
        supplyId: "sup-1",
        supplyName: "A4 Multi-purpose Bond Paper (80gsm)",
        quantity: 5,
        purpose: "Urgent recruitment materials printing and exam templates compilation."
      } as any
    ],
    auditLogs: [
      { id: "log-1", timestamp: "2026-06-01T08:30:00Z", userId: "u-2", username: "hr", role: "HR Officer", action: "Login", details: "Successful login via secure web portal" },
      { id: "log-2", timestamp: "2026-06-01T09:12:00Z", userId: "u-2", username: "hr", role: "HR Officer", action: "Create Request Approval", details: "Approved Service Record Request for Juan dela Cruz - Copies: 2" },
      { id: "log-3", timestamp: "2026-06-03T10:15:00Z", userId: "u-3", username: "finance", role: "Finance Officer", action: "Login", details: "Financial Officer logged into ledger analytics portal." },
      { id: "log-4", timestamp: "2026-06-03T11:45:00Z", userId: "u-3", username: "finance", role: "Finance Officer", action: "Review Journal Receipts", details: "Reviewed fuel transaction documentation with ID TXN-2026-003." }
    ],
    liquidations: [
      {
        id: "liqp-1",
        liquidationNo: "LIQ-2026-001",
        requestRef: "REQ-VHL-091",
        employee: "Andres B. Bonifacio",
        department: "Adjudication Division",
        amountReleased: 5000.00,
        amountLiquidated: 4800.00,
        remainingBalance: 200.00,
        liquidationDate: "2026-06-03",
        status: "Completed",
        notes: "Completed Petron fuel trip liquidation. Refund has been submitted.",
        approvedBy: "Juan dela Cruz",
        createdAt: "2026-06-03T17:00:00Z"
      },
      {
        id: "liqp-2",
        liquidationNo: "LIQ-2026-002",
        requestRef: "REQ-SPL-044",
        employee: "Jolly Joy A. Almoite",
        department: "Administrative and Finance Division",
        amountReleased: 15000.00,
        amountLiquidated: 14500.00,
        remainingBalance: 500.00,
        liquidationDate: "2026-05-15",
        status: "Completed",
        notes: "La Union Office Supplies purchase liquidation.",
        approvedBy: "Juan dela Cruz",
        createdAt: "2026-05-15T16:45:00Z"
      },
      {
        id: "liqp-3",
        liquidationNo: "LIQ-2026-003",
        requestRef: "REQ-TRV-112",
        employee: "Juan dela Cruz",
        department: "Administrative and Finance Division",
        amountReleased: 12000.00,
        amountLiquidated: 0.00,
        remainingBalance: 12000.00,
        liquidationDate: "2026-06-08",
        status: "Under Review",
        notes: "Awaiting review of food receipts and accommodation invoice details for mediation trip.",
        createdAt: "2026-06-08T09:00:00Z"
      },
      {
        id: "liqp-4",
        liquidationNo: "LIQ-2026-004",
        requestRef: "REQ-PRV-312",
        employee: "Maria Clara V. Santos",
        department: "Administrative and Finance Division",
        amountReleased: 8500.00,
        amountLiquidated: 0.00,
        remainingBalance: 8500.00,
        liquidationDate: "2026-06-09",
        status: "Pending Submission",
        notes: "Equipment repairs cash advance for regional branch laptops.",
        createdAt: "2026-06-09T08:30:00Z"
      }
    ],
        budgetAllocations: [
      { id: "b-1", fiscalYearId: "fy-1", department: "Adjudication Division", budgetAllocation: 1200000.00, carryOver: 300000.00, budgetUtilized: 0, remainingBudget: 1500000.00, budgetPercentageUsed: 0 , allocatedPS: 600000, utilizedPS: 0, remainingPS: 600000, allocatedMOOE: 360000, utilizedMOOE: 0, remainingMOOE: 360000, allocatedCO: 240000, utilizedCO: 0, remainingCO: 240000 },
      { id: "b-1-old", fiscalYearId: "fy-2", department: "Adjudication Division", budgetAllocation: 2400000.00, carryOver: 100000.00, budgetUtilized: 1500000.00, remainingBudget: 1000000.00, budgetPercentageUsed: 0 , allocatedPS: 1200000, utilizedPS: 750000, remainingPS: 450000, allocatedMOOE: 720000, utilizedMOOE: 450000, remainingMOOE: 270000, allocatedCO: 480000, utilizedCO: 300000, remainingCO: 180000 },
      { id: "b-2", fiscalYearId: "fy-1", department: "Administrative and Finance Division", budgetAllocation: 2400000.00, carryOver: 100000.00, budgetUtilized: 0, remainingBudget: 2500000.00, budgetPercentageUsed: 0 , allocatedPS: 1200000, utilizedPS: 0, remainingPS: 1200000, allocatedMOOE: 720000, utilizedMOOE: 0, remainingMOOE: 720000, allocatedCO: 480000, utilizedCO: 0, remainingCO: 480000 },
      { id: "b-2-old", fiscalYearId: "fy-2", department: "Administrative and Finance Division", budgetAllocation: 800000.00, carryOver: 200000.00, budgetUtilized: 700000.00, remainingBudget: 300000.00, budgetPercentageUsed: 0 , allocatedPS: 400000, utilizedPS: 350000, remainingPS: 50000, allocatedMOOE: 240000, utilizedMOOE: 210000, remainingMOOE: 30000, allocatedCO: 160000, utilizedCO: 140000, remainingCO: 20000 },
      { id: "b-3", fiscalYearId: "fy-1", department: "Legal Division", budgetAllocation: 800000.00, carryOver: 200000.00, budgetUtilized: 0, remainingBudget: 1000000.00, budgetPercentageUsed: 0 , allocatedPS: 400000, utilizedPS: 0, remainingPS: 400000, allocatedMOOE: 240000, utilizedMOOE: 0, remainingMOOE: 240000, allocatedCO: 160000, utilizedCO: 0, remainingCO: 160000 },
      { id: "b-3-old", fiscalYearId: "fy-2", department: "Legal Division", budgetAllocation: 1800000.00, carryOver: 0, budgetUtilized: 1600000.00, remainingBudget: 200000.00, budgetPercentageUsed: 0 , allocatedPS: 900000, utilizedPS: 800000, remainingPS: 100000, allocatedMOOE: 540000, utilizedMOOE: 480000, remainingMOOE: 60000, allocatedCO: 360000, utilizedCO: 320000, remainingCO: 40000 }
    ],
    financeAuditLogs: [
      { id: "fl-1", user: "Juan dela Cruz", action: "Validate Transaction", module: "Financial Transactions", timestamp: "2026-05-13T09:30:00Z", previousValue: "Under Review", newValue: "Validated" },
      { id: "fl-2", user: "Juan dela Cruz", action: "Complete Liquidation", module: "Liquidation Monitoring", timestamp: "2026-06-03T17:00:00Z", previousValue: "Under Review", newValue: "Completed" }
    ],
    budgetRequests: [
      { id: "br-1", department: "Adjudication Division", amountRequested: 150000.00, requestType: "Augmentation", purpose: "Additional travel allocations for provincial hearings", status: "Pending", createdAt: "2026-06-15T09:00:00Z" },
      { id: "br-2", department: "Legal Division", amountRequested: 50000.00, requestType: "Emergency", purpose: "Urgent purchase of legal research library subscriptions", status: "Approved", remarks: "Approved for FY2026 Q3", createdAt: "2026-06-12T14:30:00Z" }
    ],
    notifications: [
      {
        id: "notif-1",
        title: "Leave Request Submitted",
        message: "Atty. Korrine Madeleine Flores - Fontanilla has submitted an urgent Vacation Leave Request for your review.",
        type: "urgent",
        readBy: [],
        timestamp: "2026-06-16T02:00:00Z",
        targetRole: UserRole.HR_OFFICER
      },
      {
        id: "notif-2",
        title: "Low Supply Inventory Range Alert",
        message: "Supply stock for 'A4 Multi-purpose Bond Paper (80gsm)' is currently low (5 units left). Please arrange purchase acquisition.",
        type: "warning",
        readBy: [],
        timestamp: "2026-06-16T01:30:00Z",
        targetRole: UserRole.SUPER_ADMIN
      },
      {
        id: "notif-3",
        title: "Financial Liquidation Verification",
        message: "Juan dela Cruz submitted a travel liquidation of ₱12,000 for travel request REQ-TRV-112. Support vouchers need verification.",
        type: "info",
        readBy: [],
        timestamp: "2026-06-15T18:00:00Z",
        targetRole: UserRole.FINANCE_OFFICER
      },
      {
        id: "notif-4",
        title: "Comprehensive Security Compliance Log Audit",
        message: "All HR and Finance tables comply with RA 10173 Data Privacy protection directives. Periodic validation complete.",
        type: "success",
        readBy: [],
        timestamp: "2026-06-15T10:00:00Z",
        targetRole: UserRole.SUPER_ADMIN
      },
      {
        id: "notif-5",
        title: "En Banc Board Case Reconciliation Scheduled",
        message: "A general assembly has been scheduled for case adjustments on Room B at 09:00 AM.",
        type: "info",
        readBy: [],
        timestamp: "2026-06-15T09:00:00Z",
        targetRole: UserRole.EMPLOYEE
      },
      {
        id: "notif-6",
        title: "Meeting Room Assignment Active",
        message: "Zoom meeting 'RAB 1 En Banc Case Reconciliation Adjudication' setup is ready for launch.",
        type: "success",
        readBy: [],
        timestamp: "2026-06-15T08:00:00Z",
        targetRole: UserRole.EMPLOYEE
      }
    ],
    activities: [],
    liquidationSubmissions: [],
    cashAdvances: [],
    trainingEvaluations: [],
    activityBudgetLinks: [
      { id: "bl-1", liquidationNo: "LIQ-2026-001", employee: "Andres B. Bonifacio", department: "Adjudication Division", amount: 12000.00, budgetId: "b-1", timestamp: "2026-06-14T10:00:00Z" },
      { id: "bl-2", liquidationNo: "LIQ-2026-002", employee: "Apolinario M. Mabini", department: "Legal Division", amount: 25000.00, budgetId: "b-3", timestamp: "2026-06-15T11:30:00Z" }
    ],
    pds: [],
    fiscalYears: [
      { id: "fy-1", label: "2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "Active", rollover_policy: "Standard" },
      { id: "fy-2", label: "2025", start_date: "2025-01-01", end_date: "2025-12-31", status: "Closed", rollover_policy: "Standard" }
    ],
    hsacBudgets: [
      { id: "hb-1", fiscalYearId: "fy-1", approvedBudget: 4400000.00, carryOverBudget: 600000.00, totalUtilized: 0 },
      { id: "hb-2", fiscalYearId: "fy-2", approvedBudget: 5000000.00, carryOverBudget: 300000.00, totalUtilized: 3800000.00 }
    ],
    trainingBudgets: [
      { id: "tb-1", fiscalYearId: "fy-1", carryOverBudget: 0, newAnnualBudget: 5000000.00, totalBudget: 5000000.00 }
    ],
    trainingPrograms: [],
    trainingParticipants: [],
    trainingLiquidations: [],
    trainingNeeds: [],
    trainingMandates: [],
    // Entered through Utilities → Manage Signatories; no names in code.
    signatories: []
  };

  // Write initial setup. "wx" fails if the file exists after all (existsSync also answers false
  // when it can't check), so the seed data can never replace a real database.
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(seedDB, null, 2), { encoding: "utf8", flag: "wx" });
  return seedDB;
}

// Writes the database so a crash can never leave it half-written: the new content goes to a
// temporary file, which then replaces the old one in one step (a rename). OneDrive or an
// antivirus can hold the file for a moment on Windows, so a refused rename is retried briefly;
// as a last resort the file is written directly rather than losing the save.
function writeDataFile(data: unknown) {
  const json = JSON.stringify(data, null, 2);
  const tmp = `${DATA_FILE_PATH}.tmp`;
  fs.writeFileSync(tmp, json, "utf8");
  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(tmp, DATA_FILE_PATH);
      return;
    } catch (err: any) {
      if (attempt >= 5 || !["EPERM", "EBUSY", "EACCES"].includes(err?.code)) {
        console.error("data_store.json could not be replaced in one step; writing it directly.", err);
        fs.writeFileSync(DATA_FILE_PATH, json, "utf8");
        try { fs.unlinkSync(tmp); } catch { /* already gone */ }
        return;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * attempt);
    }
  }
}

const db = getInitialData();

// Routes that move money run as one transaction (src/server/jsonTransaction.ts): all or
// nothing, saved once before the reply. While one runs, saves wait for its end.
const { deferSave, transactional, afterCommit } = createTransactions(db, () => writeDataFile(db));

function saveDB() {
  if (deferSave()) return;
  writeDataFile(db);
}

// RESTful API Routes

// Helper to log audit actions
function logEvent(userId: string, username: string, role: string, action: string, details: string) {
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    userId,
    username,
    role,
    action,
    details
  };
  db.auditLogs.unshift(newLog);
  saveDB();
}

app.get("/api/fiscal-years", authenticateToken, (req: any, res: any) => {
  res.json(db.fiscalYears || []);
});

app.get("/api/fiscal-years/active", authenticateToken, (req: any, res: any) => {
  const active = (db.fiscalYears || []).find((f: any) => f.status === "Active");
  res.json(active || { id: "fy-1", label: "2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "Active", rollover_policy: "Standard" });
});

app.post("/api/fiscal-years", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.BUDGET_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }
  
  // Bug Fix: Calculate next fiscal year strictly based on the latest existing year.
  let maxYear = 2025; // Default if none exist
  if (db.fiscalYears && db.fiscalYears.length > 0) {
    const years = db.fiscalYears.map((fy: any) => parseInt(fy.label)).filter((y: number) => !isNaN(y));
    if (years.length > 0) {
      maxYear = Math.max(...years);
    }
  }
  
  const nextYearLabel = String(maxYear + 1);
  
  // Prevent duplicate creation
  if (db.fiscalYears.find((fy: any) => fy.label === nextYearLabel)) {
    return res.status(400).json({ status: "error", message: `Fiscal year ${nextYearLabel} already exists.` });
  }

  const newFy = {
    id: `fy-${Date.now()}`,
    label: nextYearLabel,
    start_date: `${nextYearLabel}-01-01`,
    end_date: `${nextYearLabel}-12-31`,
    status: "Active",
    rollover_policy: "Standard"
  };

  // Close other fiscal years and calculate carryover
  let carryOver = 0;
  let totalApproved = 0;
  // Leftover is carried per department AND per spending category rather than as a
  // single lump sum, so next year's Training money stays Training money.
  const carryOverByCategory: Record<string, number> = {};
  const activeFy = db.fiscalYears.find((f: any) => f.status === "Active");
  if (activeFy) {
    activeFy.status = "Closed";
    const activeHb = db.hsacBudgets.find((hb: any) => hb.fiscalYearId === activeFy.id);
    if (activeHb) {
      // Calculate division budgets based on actual spending and carryovers
      const oldAllocations = (db.budgetAllocations || []).filter((b: any) => b.fiscalYearId === activeFy.id);
      const newAllocations = oldAllocations.map((b: any) => {
        const spentLastYear = b.budgetUtilized || 0;
        const leftover = Math.max(0, (b.budgetAllocation || 0) + (b.carryOver || 0) - (b.budgetUtilized || 0));

        totalApproved += spentLastYear;
        carryOver += leftover;

        const categoryKey = b.category || "Uncategorized";
        carryOverByCategory[categoryKey] = (carryOverByCategory[categoryKey] || 0) + leftover;

        return {
          ...b,
          id: `b-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          fiscalYearId: newFy.id,
          // Department + category identity is preserved across the rollover so the
          // leftover lands in the same bucket kind next year.
          department: b.department,
          category: b.category,
          budgetAllocation: 0,
          carryOver: leftover,
          budgetUtilized: 0,
          remainingBudget: leftover,
          budgetPercentageUsed: 0,
          allocatedPS: 0,
          allocatedMOOE: 0,
          allocatedCO: 0,
          utilizedPS: 0,
          utilizedMOOE: 0,
          utilizedCO: 0,
          remainingPS: 0,
          remainingMOOE: 0,
          remainingCO: 0,
          unliquidatedAdvances: 0
        };
      });
      db.budgetAllocations = [...(db.budgetAllocations || []), ...newAllocations];
    }
  }


    // The new year's training budget starts at zero plus what last year did not use.
    // Last year's seminars are NOT copied in: each copy brought its allocation with it, so
    // the new year opened with last year's "Total Allocated" already committed. HR plans
    // the new year's seminars itself; one with the same title still counts as the same
    // seminar for the "attended before" rule, because sameSeminar() also matches by title.
    if (activeFy) {
      const activeTrainingBudget = (db.trainingBudgets || []).find(b => b.fiscalYearId === activeFy.id);
      if (activeTrainingBudget) {
        // The carry-over is the year's Unallocated figure itself, as Budget Monitoring shows
        // it (computeTrainingUsage, src/trainingBudget.ts): closed seminars count what they
        // actually spent, open ones their allocation less any non-attendee's share.
        const carryOver = Math.max(0, computeTrainingUsage(activeFy.id).remaining);

        db.trainingBudgets = [...(db.trainingBudgets || []), {
          id: `atb-${Date.now()}`,
          fiscalYearId: newFy.id,
          carryOverBudget: carryOver,
          newAnnualBudget: 0,
          totalBudget: carryOver
        }];
      }

      // Carry Plan A forward. A new plan year inherits the PREVIOUS year's unmet needs —
      // HR does not re-interview from a blank sheet. Needs that were accomplished stay
      // with the closed year as its record and are deliberately not repeated.
      const asOf = manilaToday();
      const oldNeeds = (db.trainingNeeds || []).filter((n: TrainingNeed) => n.fiscalYear === activeFy.label);
      const carriedNeeds: TrainingNeed[] = [];

      for (const need of oldNeeds) {
        if (needAccomplishment(need, asOf).accomplished) continue;

        // Someone who has left should not reappear in next year's plan.
        const emp = (db.employees || []).find((e: any) => e.id === need.employeeId || e.employeeId === need.employeeId);
        if (!emp || emp.isActive === false) continue;

        // Never raise the same need twice for the same person in one year.
        const needKey = normalizeTitle(need.title);
        const alreadyThere = (db.trainingNeeds || []).some((n: TrainingNeed) =>
          n.fiscalYear === newFy.label && n.employeeId === need.employeeId && normalizeTitle(n.title) === needKey);
        if (alreadyThere) continue;

        carriedNeeds.push({
          ...need,
          id: `tn-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          fiscalYear: newFy.label,
          // Keep the ORIGINAL year, so a need rolled twice still shows its true age.
          carriedFromFiscalYear: need.carriedFromFiscalYear || activeFy.label,
          // The evidence is re-evaluated against the new year; a stale manual override
          // would otherwise mark it accomplished before anything has happened.
          accomplishedOverride: undefined,
          createdAt: new Date().toISOString()
        });
      }

      if (carriedNeeds.length > 0) {
        db.trainingNeeds = [...(db.trainingNeeds || []), ...carriedNeeds];

        // Creating plan entries silently is how HR ends up confused about where they
        // came from, so say it plainly.
        notify({ role: UserRole.HR_OFFICER }, {
          title: `${carriedNeeds.length} unmet training need${carriedNeeds.length === 1 ? "" : "s"} carried to ${newFy.label}`,
          message: `Plan A for ${newFy.label} starts with ${carriedNeeds.length} need${carriedNeeds.length === 1 ? "" : "s"} still unmet from ${activeFy.label}. Accomplished needs were left with ${activeFy.label}.`,
          type: "info",
          link: { tab: "training_development", subTab: "plan-a" }
        });
      }

      logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Carry Training Needs",
        `Carried ${carriedNeeds.length} unmet need(s) from ${activeFy.label} to ${newFy.label}; ${oldNeeds.length - carriedNeeds.length} not carried (accomplished, inactive employee, or duplicate)`);
    }

  db.fiscalYears.unshift(newFy);


  const newHb = {
    id: `hb-${Date.now()}`,
    fiscalYearId: newFy.id,
    // If it's a new year and we calculated from previous, the total approved is the sum of all division's spent last year.
    // If there is no previous year, we set to 0.
    approvedBudget: totalApproved,
    carryOverBudget: carryOver,
    carryOverByCategory,
    totalUtilized: 0
  };
  db.hsacBudgets.unshift(newHb);

  saveDB();
  res.json({ status: "success", data: newFy, hsacBudget: newHb });
});

app.get("/api/hsac-budgets", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.hsacBudgets || [] });
});

app.put("/api/hsac-budgets/:id", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.BUDGET_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }
  const hb = db.hsacBudgets.find((b: any) => b.id === req.params.id);
  if (hb) {
    if (req.body.approvedBudget !== undefined) hb.approvedBudget = Number(req.body.approvedBudget);
    saveDB();
    res.json({ status: "success", data: hb });
  } else {
    res.status(404).json({ status: "error", message: "Budget not found" });
  }
});


app.get("/api/budgets", authenticateToken, (req: any, res: any) => {
  let allocations = db.budgetAllocations || [];
  if (req.query.fiscalYearLabel) {
    const fy = (db.fiscalYears || []).find((f: any) => f.label === req.query.fiscalYearLabel);
    if (fy) {
      allocations = allocations.filter((b: any) => b.fiscalYearId === fy.id);
    }
  }
  res.json({ status: "success", data: allocations });
});

app.put("/api/budgets/:id", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.BUDGET_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }
  const budget = db.budgetAllocations.find((b: any) => b.id === req.params.id);
  if (budget) {
    const fy = db.fiscalYears.find((f: any) => f.id === budget.fiscalYearId);
    if (fy && fy.status !== "Active") {
      return res.status(400).json({ status: "error", message: "Cannot modify budget for a closed fiscal year." });
    }
    if (req.body.budgetAllocation !== undefined) {
      budget.budgetAllocation = Number(req.body.budgetAllocation);
      budget.remainingBudget = budget.budgetAllocation + (budget.carryOver || 0) - budget.budgetUtilized - (budget.unliquidatedAdvances || 0);
      budget.budgetPercentageUsed = Math.round((budget.budgetUtilized / (budget.budgetAllocation + (budget.carryOver || 0))) * 100);
    }
    if (req.body.allocatedPS !== undefined) budget.allocatedPS = Number(req.body.allocatedPS);
    if (req.body.allocatedMOOE !== undefined) budget.allocatedMOOE = Number(req.body.allocatedMOOE);
    if (req.body.allocatedCO !== undefined) budget.allocatedCO = Number(req.body.allocatedCO);
    
    // Recalculate remaining amounts based on updated allocations
    budget.remainingPS = (budget.allocatedPS || 0) - (budget.utilizedPS || 0);
    budget.remainingMOOE = (budget.allocatedMOOE || 0) - (budget.utilizedMOOE || 0);
    budget.remainingCO = (budget.allocatedCO || 0) - (budget.utilizedCO || 0);

    saveDB();
    res.json({ status: "success", data: budget });
  } else {
    res.status(404).json({ status: "error", message: "Budget not found" });
  }
});


function logFinanceAudit(user: string, action: string, module: string, previousValue: string, newValue: string) {
  const newLog: FinanceAuditLog = {
    id: `fl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user,
    action,
    module,
    timestamp: new Date().toISOString(),
    previousValue: previousValue || "None",
    newValue: newValue || "None"
  };
  if (!db.financeAuditLogs) {
    db.financeAuditLogs = [];
  }
  db.financeAuditLogs.unshift(newLog);
  saveDB();
}

// 1. Authentication Routes
app.post("/api/auth/login", (req: any, res: any) => {
  const { username, email, password } = req.body;
  const inputIdentifier = (username || email || "").trim().toLowerCase();
  
  // Resolve standard or sandbox-specific aliases to correct database usernames
  let targetUsername = inputIdentifier;
  if (inputIdentifier === "super-admin@hsac.gov.ph" || inputIdentifier === "admin@hsac.gov.ph" || inputIdentifier === "admin") {
    targetUsername = "admin";
  } else if (inputIdentifier === "hr@hsac.gov.ph" || inputIdentifier === "clara.santos@hsac.gov.ph" || inputIdentifier === "hr") {
    targetUsername = "hr";
  } else if (inputIdentifier === "finance@hsac.gov.ph" || inputIdentifier === "juan.delacruz@hsac.gov.ph" || inputIdentifier === "finance") {
    targetUsername = "finance";
  } else if (inputIdentifier === "employee@hsac.gov.ph" || inputIdentifier === "andres.bonifacio@hsac.gov.ph" || inputIdentifier === "employee") {
    targetUsername = "employee";
  } else if (inputIdentifier === "budget@hsac.gov.ph" || inputIdentifier === "budget" || inputIdentifier === "francisco.balagtas@hsac.gov.ph") {
    targetUsername = "budget";
  }

  // Locate the user record in database
  const user = db.users.find(u => 
    u.username.toLowerCase() === targetUsername || 
    u.email.toLowerCase() === inputIdentifier ||
    u.username.toLowerCase() === inputIdentifier
  );
  
  // Verification: PBKDF2 for hashed passwords, simple match for dev accounts
  let isValidPassword = false;
  if (user) {
    if (user.passwordHash) {
      try {
        const [salt, hash] = user.passwordHash.split(':');
        const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        isValidPassword = hash === checkHash;
      } catch (err) {
        isValidPassword = false;
      }
    } else {
      isValidPassword = password === "password123" || password === "sandbox-master-pass";
    }
  }

  if (user && isValidPassword) {
    if (user.status === "Archived") {
      logEvent(user.id, user.username, user.role, "Blocked Login Attempt", "A blocked login attempt was recorded for an archived account.");
      return res.status(403).json({ status: "error", message: "Your account has been archived. Please contact an administrator for assistance." });
    }
    if (user.status === "Deactivated") {
      logEvent(user.id, user.username, user.role, "Blocked Login Attempt", "A blocked login attempt was recorded for deactivated account credentials.");
      return res.status(403).json({ status: "error", message: "This user credentials account is Deactivated. Please consult the Division Chief / Administrator." });
    }

    const requirePasswordChange = user.status === "Pending Password Change" || user.requirePasswordChange === true;

    let requirePdsUpload = false;
    if (!requirePasswordChange && user.employeeId) {
      const emp = db.employees.find(e => e.employeeId === user.employeeId);
      if (emp && !emp.pdsFieldName) {
        requirePdsUpload = true;
      }
    }

    // Generate a cryptographically secure JWT
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      employeeId: user.employeeId,
      requirePasswordChange: requirePasswordChange,
      requirePdsUpload: requirePdsUpload
    };
    const tokenPayload = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });

    logEvent(user.id, user.username, user.role, "Login", "Successful authenticated session login via credentials.");

    const formattedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      employeeId: user.employeeId,
      requirePasswordChange: requirePasswordChange,
      requirePdsUpload: requirePdsUpload
    };

    res.json({
      status: "success",
      token: `Bearer ${tokenPayload}`,
      user: formattedUser,
      data: {
        token: `Bearer ${tokenPayload}`,
        user: formattedUser
      }
    });
  } else {
    res.status(401).json({ status: "error", message: "Invalid regional credential pair" });
  }
});

app.post("/api/auth/logout", (req: any, res: any) => {
  res.json({ status: "success", message: "Session signed out successfully" });
});

app.post("/api/auth/change-password", authenticateToken, (req: any, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ status: "error", message: "New password is required" });
  }

  // Validate password policy
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumbers = /\d/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  
  if (newPassword.length < 8 || !hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecial) {
    return res.status(400).json({ status: "error", message: "Password does not meet complexity requirements." });
  }

  const user = db.users.find(u => u.id === (req as any).user.id);
  if (!user) {
    return res.status(404).json({ status: "error", message: "User account not found." });
  }

  // Verify current password
  let isValid = false;
  if (user.passwordHash) {
    try {
      const [salt, hash] = user.passwordHash.split(':');
      const checkHash = crypto.pbkdf2Sync(currentPassword, salt, 1000, 64, 'sha512').toString('hex');
      isValid = hash === checkHash;
    } catch (e) {
      isValid = false;
    }
  } else {
    isValid = currentPassword === "password123" || currentPassword === "sandbox-master-pass";
  }

  if (!isValid) {
    return res.status(400).json({ status: "error", message: "Current password does not match records." });
  }

  // Hash new password
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(newPassword, salt, 1000, 64, 'sha512').toString('hex');
  user.passwordHash = `${salt}:${hash}`;
  user.requirePasswordChange = false;
  if (user.status === "Pending Password Change") {
    user.status = "Active";
  }

  logEvent(user.id, user.username, user.role, "Change Password", "User successfully modified/updated login credentials.");
  saveDB();

  res.json({ status: "success", message: "Password updated successfully." });
});

// Middleware to verify Auth/RBAC Roles
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "Authorization credential header required" });
  }

  try {
    const rawPayload = authHeader.split(" ")[1];
    // Verify cryptographic signature of JWT
    const userJson = jwt.verify(rawPayload, JWT_SECRET) as any;
    
    // Check against DB for latest status
    const dbUser = db.users.find(u => u.id === userJson.id);
    if (!dbUser) {
      return res.status(401).json({ status: "error", message: "User account no longer exists." });
    }
    
    // Check pending password change
    if (dbUser.status === "Pending Password Change") {
      const allowedPaths = ["/api/auth/change-password", "/api/auth/logout", "/api/sessions/current"];
      // If path is not allowed, reject
      if (!allowedPaths.includes(req.path)) {
        return res.status(403).json({ 
          status: "error", 
          message: "Temporary password active. You must change your password to continue.",
          requirePasswordChange: true
        });
      }
    } else if (dbUser.employeeId) {
      // Check PDS requirement
      const emp = db.employees.find(e => e.employeeId === dbUser.employeeId);
      if (emp && !emp.pdsFieldName) {
        // Allow PDS upload paths
        const allowedPaths = [
          "/api/auth/logout", 
          "/api/sessions/current",
          "/api/employees/me",
          `/api/employees/${dbUser.employeeId}/pds-profile`,
          `/api/employees/${dbUser.employeeId}/pds`,
          "/api/pds/parse"
        ];
        
        const pathIsAllowed = allowedPaths.includes(req.path);
        if (!pathIsAllowed) {
           return res.status(403).json({ 
             status: "error", 
             message: "Personal Data Sheet (PDS) upload is required before accessing the system.",
             requirePdsUpload: true
           });
        }
      }
    }
    
    req.user = dbUser;
    next();
  } catch (err) {
    return res.status(403).json({ status: "error", message: "Malformed session verification token" });
  }
}

app.get("/api/sessions/current", authenticateToken, (req: any, res) => {
  const user = req.user;
  let requirePdsUpload = false;
  if (user.status !== "Pending Password Change" && user.employeeId) {
    const emp = db.employees.find(e => e.employeeId === user.employeeId);
    if (emp && !emp.pdsFieldName) {
      requirePdsUpload = true;
    }
  }
  const responseUser = { 
    ...user, 
    requirePasswordChange: user.status === "Pending Password Change",
    requirePdsUpload
  };
  res.json({ status: "success", data: responseUser });
});

// 2. Employee CRUD & Personnel Details
app.get("/api/employees/me", authenticateToken, (req: any, res) => {
  const employeeId = req.user.employeeId;
  const employee = db.employees.find(e => e.id === employeeId || e.employeeId === employeeId);
  if (!employee) {
    return res.status(404).json({ status: "error", message: "Personnel profile not found for this user account" });
  }
  res.json({ status: "success", data: employee });
});

app.get("/api/employees", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized: Full employee list is confidential and restricted." });
  }
  res.json({ status: "success", data: db.employees });
});

app.post("/api/employees", authenticateToken, (req: any, res) => {
  const data = req.body;

  if (!data.position || !data.position.trim()) {
    return res.status(400).json({ status: "error", message: "Validation Error: Official Designation (Position) is mandatory." });
  }

  // Enforce Roles: Admin or HR only
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized: Requires HR or Admin access" });
  }

  const existing = db.employees.find(e => e.employeeId === data.employeeId);
  if (existing) {
    return res.status(400).json({ status: "error", message: "An employee with this Employee ID already exists." });
  }

  const newEmployee: Employee = {
    id: `emp-${Date.now()}`,
    employeeId: data.employeeId,
    fullName: data.fullName,
    surname: data.surname,
    firstName: data.firstName,
    middleName: data.middleName,
    nameExtension: data.nameExtension,
    position: data.position,
    salary: data.salary ? Number(data.salary) : undefined,
    division: data.division,
    employmentStatus: data.employmentStatus,
    email: data.email,
    address: data.address,
    dateHired: data.dateHired || new Date().toISOString().split("T")[0],
    contactNumber: data.contactNumber,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    fieldOfSpecialization: data.fieldOfSpecialization,
    pdsFieldName: data.pdsFieldName || undefined,
    pdsUploadedAt: data.pdsFieldName ? new Date().toISOString() : undefined
  };

  db.employees.push(newEmployee);

  // Add employment history entry
  const newHist: EmploymentHistory = {
    id: `h-${Date.now()}`,
    employeeId: newEmployee.employeeId,
    action: "Service Record Update",
    previousDetails: "N/A",
    newDetails: `Initial employment records set as ${newEmployee.position} (${newEmployee.employmentStatus}) in ${newEmployee.division}.`,
    effectiveDate: newEmployee.dateHired,
    updatedBy: (req as any).user.fullName
  };
  db.employmentHistory.push(newHist);

  // Removed auto-generation based on requirements: Employee accounts should not be automatically created; they require administrator onboarding.

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Create Employee", `Registered new personnel ${newEmployee.fullName} (${newEmployee.employeeId})`);
  
  autoAssignEmployeeToTraining(newEmployee);
  
  saveDB();
  res.json({ status: "success", data: newEmployee });
});

app.put("/api/employees/:id", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const data = req.body;

  if (data.position !== undefined && (!data.position || !data.position.trim())) {
    return res.status(400).json({ status: "error", message: "Validation Error: Official Designation (Position) is mandatory." });
  }

  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized: Requires HR or Admin access" });
  }

  const index = db.employees.findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ status: "error", message: "Employee record not found" });
  }

  const oldRecord = db.employees[index];

  // Track changes for history
  let changes: string[] = [];
  if (oldRecord.position !== data.position) {
    changes.push(`Position changed from ${oldRecord.position} to ${data.position}`);
    // Register high history promotable item
    const newHist: EmploymentHistory = {
      id: `h-${Date.now()}`,
      employeeId: oldRecord.employeeId,
      action: "Promotion",
      previousDetails: oldRecord.position,
      newDetails: data.position,
      effectiveDate: new Date().toISOString().split("T")[0],
      updatedBy: (req as any).user.fullName
    };
    db.employmentHistory.push(newHist);
  }
  if (oldRecord.division !== data.division) {
    changes.push(`Division changed from ${oldRecord.division} to ${data.division}`);
    const newHist: EmploymentHistory = {
      id: `h-${Date.now()}`,
      employeeId: oldRecord.employeeId,
      action: "Transfer",
      previousDetails: oldRecord.division,
      newDetails: data.division,
      effectiveDate: new Date().toISOString().split("T")[0],
      updatedBy: (req as any).user.fullName
    };
    db.employmentHistory.push(newHist);
  }

  const updatedEmployee = {
    ...oldRecord,
    ...data,
    pdsFieldName: data.pdsFieldName || oldRecord.pdsFieldName,
    pdsUploadedAt: data.pdsFieldName ? new Date().toISOString() : oldRecord.pdsUploadedAt
  };

  db.employees[index] = updatedEmployee;

  autoAssignEmployeeToTraining(updatedEmployee);

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Update Employee", `Updated professional profile of ${updatedEmployee.fullName} (${updatedEmployee.employeeId}). Changes: ${changes.join(", ") || "Contact info"}`);
  saveDB();
  res.json({ status: "success", data: updatedEmployee });
});

app.delete("/api/employees/:id", authenticateToken, (req: any, res) => {
  const { id } = req.params;

  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Unauthorized: Requires Super Admin authority" });
  }

  const employee = db.employees.find(e => e.id === id);
  if (!employee) {
    return res.status(404).json({ status: "error", message: "Employee record not found" });
  }

  db.employees = db.employees.filter(e => e.id !== id);

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Delete Employee", `Declassified/Removed Employee record profile ${employee.fullName} (${employee.employeeId})`);
  saveDB();
  res.json({ status: "success", message: "Employee record off-boarded" });
});

// PDS Upload and View Endpoints (base64 simulation)
app.get("/api/employees/:employeeId/pds-profile", authenticateToken, (req: any, res) => {
  const { employeeId } = req.params;

  // A PDS holds an employee's ID numbers, addresses and family: HR and the Administrator may
  // read anyone's, anyone else only their own (only Personnel were limited before).
  const isHrOrAdmin = req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.HR_OFFICER;
  if (!isHrOrAdmin && req.user.employeeId !== employeeId) {
    return res.status(403).json({ status: "error", message: "Unauthorized: Employees can only access their own PDS" });
  }

  const employee = db.employees.find(e => e.employeeId === employeeId);
  if (!employee) {
    return res.status(404).json({ status: "error", message: "Target employee record not found" });
  }

  const pdsRecord = (db.pds || []).find((p: any) => p.employeeId === employeeId);
  res.json({
    status: "success",
    data: {
      employee: {
        employeeId: employee.employeeId,
        surname: employee.surname,
        firstName: employee.firstName,
        middleName: employee.middleName,
        nameExtension: employee.nameExtension,
        fullName: employee.fullName,
        email: employee.email,
        contactNumber: employee.contactNumber,
        address: employee.address,
        salary: employee.salary,
        position: employee.position
      },
      pds: pdsRecord ? pdsRecord : null
    }
  });
});

app.post("/api/employees/:employeeId/pds", authenticateToken, (req: any, res) => {
  const { employeeId } = req.params;
  const { filename, data } = req.body;

  // HR and the Administrator may save anyone's PDS; anyone else only their own. (It had no
  // check at all: any signed-in user could overwrite anyone's PDS and official position.)
  const isHrOrAdmin = req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.HR_OFFICER;
  if (!isHrOrAdmin && req.user.employeeId !== employeeId) {
    return res.status(403).json({ status: "error", message: "You can only save your own Personal Data Sheet." });
  }
  if (data !== undefined && (data === null || typeof data !== "object" || Array.isArray(data))) {
    return res.status(400).json({ status: "error", message: "The PDS details must be sent as a form." });
  }

  const emp = db.employees.find(e => e.employeeId === employeeId);
  if (!emp) {
    return res.status(404).json({ status: "error", message: "Target employee record not found" });
  }

  if (filename && typeof filename === "string") {
    emp.pdsFieldName = filename;
    emp.pdsUploadedAt = new Date().toISOString();
  }


  if (data) {
    if (!db.pds) db.pds = [];
    // The record's own keys stay the server's: an "employeeId" in the data would move this
    // PDS to another employee. The official position is HR's and the Administrator's to set,
    // and the salary the Administrator's alone, so they stay as stored when anyone else saves.
    const { id: _id, employeeId: _employeeId, ...fields } = data;
    if (!isHrOrAdmin) delete fields.position;
    if (req.user.role !== UserRole.SUPER_ADMIN) delete fields.salary;

    // Update salary across the system if Admin modifies it
    if (data.salary !== undefined && req.user.role === UserRole.SUPER_ADMIN) {
      emp.salary = Number(data.salary);
    }
    if (data.position !== undefined && isHrOrAdmin) {
      emp.position = data.position;
    }

    const existingIndex = db.pds.findIndex((p: any) => p.employeeId === employeeId);

    if (existingIndex >= 0) {
      db.pds[existingIndex] = { ...db.pds[existingIndex], ...fields };
    } else {
      db.pds.push({ id: `pds-${Date.now()}`, employeeId, ...fields });
    }
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Upload PDS", `Updated Personal Data Sheet (PDS) for ${emp.fullName} (${employeeId})`);
  saveDB();
  res.json({ status: "success", data: emp });
});

// Employee specific details (Training & History)
app.get("/api/employees/:employeeId/trainings", authenticateToken, (req: any, res: any) => {
  const { employeeId } = req.params;
  // The PDS and Trainings & Seminars ask with the business id ("EMP001"), while seminar
  // enrolments store Employee.id ("emp-..."), so match either form, as assigned_activities
  // does. Matching only the first form meant a liquidated seminar never reached the
  // employee's training history.
  const forms = employeeIdForms(employeeId);
  if (!canAccessEmployeeTrainingRecords(req.user, forms)) {
    return res.status(403).json({ status: "error", message: "You can only view your own training history." });
  }
  const manualRecords = db.trainings.filter(t => forms.includes(t.employeeId));

  // A seminar counts as completed once Finance has validated its liquidation report.
  const assignedRecords = db.trainingParticipants
    .filter(p => forms.includes(p.employeeId) && p.status === "Liquidated")
    .map(p => {
      const prog = db.trainingPrograms.find(tp => tp.id === p.trainingProgramId);
      if (prog) {
        return {
          id: `assigned-${p.id}`,
          employeeId,
          title: prog.title,
          organizer: prog.facilitator || "HSAC Internal",
          dateConducted: prog.startDate,
          trainingHours: prog.totalHours || (prog.durationDays * 8),
          certificateFilename: "",
          status: "Verified",
          remarks: `Assigned via Training Plan${prog.category ? ` (${prog.category})` : ""}`
        };
      }
      return null;
    })
    .filter(Boolean);
    
  res.json({ status: "success", data: [...manualRecords, ...assignedRecords] });
});

// What an attendee who paid for a seminar themselves can claim back (src/reimbursement.ts): their
// allowance less what HR entered as spent for them by hand, money the office paid itself. A report's own
// ledger rows are written only at validation, so before then every row on the enrolment is HR's.
function seatReimbursementLimit(participantId: string): number {
  const p = (db.trainingParticipants || []).find((x: any) => x && x.id === participantId);
  if (!p) return 0;
  const hand = sumPesos((db.trainingLiquidations || [])
    .filter((r: any) => r && r.trainingParticipantId === participantId && r.source !== "report")
    .map((r: any) => r.amount));
  return reimbursementLimit(p.allowanceAllocated, hand);
}

// Whether a seminar enrolment's liquidation form is open to its employee, and why not.
// Only attendees get the form (HR records attendance once the seminar has started), and
// each enrolment takes one report. POST /api/liquidation-submissions enforces the same.
function seminarFormEligibility(p: any): { canLiquidate: boolean; reason?: string; reportNo?: string } {
  const report = reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], p.id);
  // (Only their own report's number: the portal lists those, and a group's report is the holder's.)
  if (report) return { canLiquidate: false, reason: `Report ${report.submissionNo} has been filed (${report.status}).`, reportNo: report.activityId === p.id ? report.submissionNo : undefined };
  // One cash advance, one report (HSAC RAB 1): the holder of a group's advance files it for everyone.
  const group = groupCoveringOthers(p.id);
  if (group) {
    return {
      canLiquidate: false,
      reason: group.status === "Requested"
        ? `${group.employeeName} asked for your group's cash advance; once Finance releases it, ${group.employeeName} files the group's liquidation report.`
        : `${group.employeeName} holds your group's cash advance and files the group's liquidation report.`
    };
  }
  if (p.status === "Liquidated") return { canLiquidate: false, reason: "This seminar is already liquidated." };
  if (p.status === "Cancelled" || p.status === "Archived") return { canLiquidate: false, reason: "This enrolment was cancelled." };
  // The holder of a group's advance files the group's one report once HR has recorded everyone's
  // attendance and at least one of them attended, even if the holder didn't: the cash was released
  // to them (the user's decisions 5 and 6, 2026-10-26).
  const held = advanceCovering(db.cashAdvances || [], p.id, ["Released"]);
  if (held && isGroupAdvance(held) && held.activityId === p.id) {
    const people = held.covers!.map(c => ({ name: c.employeeName, e: (db.trainingParticipants || []).find((x: any) => x && x.id === c.participantId) }));
    const unrecorded = people.filter(({ e }) => !e || !e.attendance).map(({ name }) => name);
    if (unrecorded.length > 0) {
      return { canLiquidate: false, reason: `The form opens once HR records the attendance of everyone your group's cash advance covers (still to record: ${namesText(unrecorded)}).` };
    }
    if (!people.some(({ e }) => e && e.attendance === "Attended")) {
      return { canLiquidate: false, reason: "Nobody your group's cash advance covers attended, so there is nothing to liquidate: hand the whole advance back to the cashier, and Finance records the refund." };
    }
    return { canLiquidate: true };
  }
  if (p.attendance === "Did not attend") return { canLiquidate: false, reason: "HR recorded that you did not attend, so there is no liquidation form for this seminar." };
  if (p.attendance !== "Attended") return { canLiquidate: false, reason: "The form opens once HR records your attendance." };
  return { canLiquidate: true };
}

app.get("/api/employees/:employeeId/assigned_activities", authenticateToken, (req: any, res: any) => {
  const { employeeId } = req.params;
  // TDP enrolments store Employee.id ("emp-...") while this route is called with the
  // business id ("EMP001"), so match either form.
  const forms = employeeIdForms(employeeId);
  if (!canAccessEmployeeTrainingRecords(req.user, forms)) {
    return res.status(403).json({ status: "error", message: "You can only view your own assigned seminars." });
  }
  const assignedRecords = db.trainingParticipants
    // "Liquidated" deliberately stays in the list. Dropping it made a seminar the
    // employee had fully settled disappear from their own records with no trace that it
    // completed, which reads as the liquidation having gone missing. Callers that need
    // only open items — the liquidation picker — filter it out themselves.
    .filter(p => forms.includes(p.employeeId) && p.status !== "Archived" && p.status !== "Cancelled")
    .map(p => {
      const prog = db.trainingPrograms.find(tp => tp.id === p.trainingProgramId);
      if (prog) {
        return {
          id: p.id,
          trainingProgramId: prog.id,
          title: prog.title,
          category: prog.category,
          dateConducted: prog.startDate,
          endDate: prog.endDate,
          liquidationDueDate: liquidationDueDateFor(prog),
          startTime: prog.startTime,
          endTime: prog.endTime,
          allocatedBudget: p.allowanceAllocated,
          // What they could claim back had they paid for it themselves (a Reimbursement, 2026-10-30).
          reimbursementLimit: seatReimbursementLimit(p.id),
          status: p.status || "Scheduled",
          assignedBy: "HR",
          // Attendance and whether the liquidation form is open (see seminarFormEligibility).
          attendance: p.attendance || null,
          ...(() => {
            const e = seminarFormEligibility(p);
            return { canLiquidate: e.canLiquidate, liquidationBlockedReason: e.reason || null, reportNo: e.reportNo || null };
          })()
        };
      }
      return null;
    })
    .filter(Boolean);
    
  // Each seat's allowance and what could be claimed back: not kept in a shared PC's cache (7m).
  res.set("Cache-Control", "no-store");
  res.json({ status: "success", data: assignedRecords });
});

// POST /api/employees/:employeeId/liquidate_activity/:participantId was retired: it marked an
// enrolment "Liquidation Pending" with no report (and HR/Admin could do it for anyone). An
// enrolment's status now changes only through a real liquidation report.

app.post("/api/employees/:employeeId/trainings", authenticateToken, (req: any, res) => {
  const { employeeId } = req.params;
  const data = req.body;

  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }

  const newTraining: Training = {
    id: `t-${Date.now()}`,
    employeeId,
    title: data.title,
    organizer: data.organizer,
    dateConducted: data.dateConducted,
    trainingHours: Number(data.trainingHours || data.hours || 8),
    certificateFilename: data.certificateFilename || "certificate.pdf"
  };

  db.trainings.push(newTraining);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Add Training", `Added training attendance for ${employeeId}: "${newTraining.title}" (${newTraining.trainingHours} hrs)`);
  saveDB();
  res.json({ status: "success", data: newTraining });
});

app.get("/api/employees/:employeeId/history", authenticateToken, (req: any, res: any) => {
  const { employeeId } = req.params;
  // Employment history is personal: HR and the Administrator may read anyone's, anyone else
  // only their own (it had no check at all). Either id form, as the trainings route does.
  const forms = employeeIdForms(employeeId);
  if (!canAccessEmployeeTrainingRecords(req.user, forms)) {
    return res.status(403).json({ status: "error", message: "You can only view your own employment history." });
  }
  const history = db.employmentHistory.filter(h => forms.includes(h.employeeId));
  res.json({ status: "success", data: history });
});


// 3. Financial Document & Receipt Tracking Module
// The ledger's write routes went with the Transactions Journal page on 2026-10-22. Liquidation
// validation still books its TX-LIQ entry here, and Budget Monitoring's "Export Database" reads it,
// so only Finance, the Budget Officer and the Administrator may read it (it was open to anyone).
app.get("/api/financial-transactions", authenticateToken, (req: any, res: any) => {
  if (![UserRole.SUPER_ADMIN, UserRole.FINANCE_OFFICER, UserRole.BUDGET_OFFICER].includes(req.user.role)) {
    return res.status(403).json({ status: "error", message: "The financial ledger is for Finance, the Budget Officer and the Administrator." });
  }
  res.json({ status: "success", data: db.financialTransactions });
});

// --- NEW LIQUIDATION WORKFLOW ENDPOINTS (READ-ONLY MONITORING FOR LEGACY CONTEXT) ---
app.get("/api/finance/liquidations", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.liquidations || [] });
});

app.post("/api/finance/liquidations", authenticateToken, (req: any, res) => {
  return res.status(403).json({
    status: "error",
    message: "Direct budget liquidation additions have been deprecated for compliance safety. All liquidation processing must begin in the Employee Portal via /api/liquidation-submissions, passing through HR verification, Finance validation, and the Division Chief final approved seal."
  });
});

app.put("/api/finance/liquidations/:id/status", authenticateToken, (req: any, res) => {
  return res.status(403).json({
    status: "error",
    message: "Direct adjustment of liquidation statuses is disabled. Status updates must proceed natively through the multi-stage HR-verification to Chief-approval workflow via /api/liquidation-submissions."
  });
});

// --- PDS MANAGEMENT ENDPOINTS ---
app.get("/api/pds", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized access." });
  }
  res.json({ status: "success", data: db.pds || [] });
});

app.post("/api/pds", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized access." });
  }
  const newPds = { ...req.body, id: `pds-${Date.now()}` };
  if (!db.pds) db.pds = [];
  db.pds.push(newPds);
  saveDB();
  res.json({ status: "success", data: newPds });
});

// --- SHARED BUDGET DEDUCTION ---
// How a spend is applied to a budget bucket, by the automatic deduction when Finance validates
// a liquidation.
function applyBudgetDeduction(budget: any, spentAmount: number) {
  budget.budgetUtilized = Number(budget.budgetUtilized || 0) + Number(spentAmount || 0);
  const base = Number(budget.budgetAllocation || 0) + Number(budget.carryOver || 0);
  budget.remainingBudget = base - budget.budgetUtilized - Number(budget.unliquidatedAdvances || 0);
  budget.budgetPercentageUsed = base > 0 ? Math.round((budget.budgetUtilized / base) * 100) : 0;
}

// A liquidation is deducted exactly once. Each deduction records an activityBudgetLink, so a
// link marks it as done; older links include the manual ones made before 2026-10-22.
function isAlreadyDeducted(liquidationNo: string): boolean {
  return (db.activityBudgetLinks || []).some((l: any) => l.liquidationNo === liquidationNo);
}

function resolveSpendingCategory(sub: any): SpendingCategory {
  if (sub.spendingCategory) return sub.spendingCategory;
  // Same participant lookup already used when finalising training liquidations.
  const isTraining = (db.trainingParticipants || []).some(p => p.id === sub.activityId);
  return isTraining ? "Training" : "Request";
}

function resolveSubmissionDepartment(sub: any): string {
  const emp = (db.employees || []).find(e => e.id === sub.employeeId || e.employeeId === sub.employeeId);
  return (emp && emp.division) || "Administrative and Finance Division";
}

// Preferred match is department + category within the active fiscal year; falls
// back to the department's uncategorised bucket so existing data keeps working.
function findBudgetBucket(department: string, category: SpendingCategory, fiscalYearId: string) {
  const inYear = (db.budgetAllocations || []).filter((b: any) => b.fiscalYearId === fiscalYearId);
  return inYear.find((b: any) => b.department === department && b.category === category)
      || inYear.find((b: any) => b.department === department && !b.category)
      || null;
}

// Automatically deducts a completed liquidation from its matching bucket.
// Callers wrap this in try/catch — it must never block the primary response.
function autoDeductLiquidation(sub: any, actor: { id: string; username: string; role: string }) {
  if (isAlreadyDeducted(sub.submissionNo)) return null;

  const activeFy = (db.fiscalYears || []).find((f: any) => f.status === "Active");
  if (!activeFy) return null;

  const category = resolveSpendingCategory(sub);
  const department = resolveSubmissionDepartment(sub);
  const bucket = findBudgetBucket(department, category, activeFy.id);
  const spent = Number(sub.totalSpent || 0);

  if (!bucket) {
    notify({ role: UserRole.BUDGET_OFFICER }, {
      title: "Budget Auto-Deduction Skipped",
      message: `Liquidation ${sub.submissionNo} (${category}, ₱${spent.toLocaleString()}) has no matching ${department} budget bucket for ${activeFy.label}, so its spending was not deducted from a division budget.`,
      type: "warning",
      link: { tab: "budget" }
    });
    return null;
  }

  applyBudgetDeduction(bucket, spent);

  if (!db.activityBudgetLinks) db.activityBudgetLinks = [];
  db.activityBudgetLinks.unshift({
    id: `bl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    liquidationNo: sub.submissionNo,
    employee: sub.employeeName,
    department,
    amount: spent,
    budgetId: bucket.id,
    category,
    source: "auto",
    timestamp: new Date().toISOString()
  });

  logEvent(actor.id, actor.username, actor.role, "Auto-Deduct Budget",
    `Liquidation ${sub.submissionNo} (${category}) auto-deducted ₱${spent.toLocaleString()} from ${bucket.department} bucket ${bucket.id} for FY ${activeFy.label}.`);

  return bucket;
}

// --- NEW BUDGET MANAGEMENT ENDPOINTS ---
app.get("/api/finance/budgets", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.budgetAllocations || [] });
});

app.post("/api/finance/budgets", authenticateToken, (req: any, res) => {
  const { department, category, budgetAllocation, allocatedPS, allocatedMOOE, allocatedCO, approvedRequestId, fiscalYearId } = req.body;
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.BUDGET_OFFICER && (req as any).user.role !== UserRole.FINANCE_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized. Requires Budget Officer or Admin." });
  }

  // Find target FY or default to active
  const targetFy = fiscalYearId ? db.fiscalYears.find((f: any) => f.id === fiscalYearId) : (db.fiscalYears || []).find((f: any) => f.status === "Active");
  if (!targetFy || targetFy.status !== "Active") {
    return res.status(400).json({ status: "error", message: "Cannot create budget for a closed fiscal year." });
  }

  // Allow Budget Officer to create the initial budget allocation based on the GAA/WFP offline documents.
  // A department may hold one uncategorised (general) bucket plus one bucket per
  // spending category, so uniqueness is department + category — not department alone.

  const normalizedCategory: SpendingCategory | undefined =
    category && SPENDING_CATEGORIES.includes(category) ? category : undefined;

  const existing = db.budgetAllocations.find(b =>
    b.department.toLowerCase() === department.toLowerCase() &&
    b.fiscalYearId === targetFy.id &&
    (b.category || undefined) === normalizedCategory
  );
  if (existing) {
    const label = normalizedCategory ? `${department} / ${normalizedCategory}` : `${department} (General)`;
    return res.status(400).json({ status: "error", message: `Allocation for ${label} already exists in this fiscal year. Please edit instead.` });
  }

  const ps = Number(allocatedPS) || 0;
  const mooe = Number(allocatedMOOE) || 0;
  const co = Number(allocatedCO) || 0;
  const total = ps + mooe + co;
  const finalBudgetAllocation = budgetAllocation ? Number(budgetAllocation) : total;

  const newBudget: BudgetAllocation = {
    id: `b-${Date.now()}`,
    fiscalYearId: targetFy.id,
    department,
    category: normalizedCategory,
    budgetAllocation: finalBudgetAllocation,
    budgetUtilized: 0,
    remainingBudget: finalBudgetAllocation,
    budgetPercentageUsed: 0,
    allocatedPS: ps,
    utilizedPS: 0,
    remainingPS: ps,
    allocatedMOOE: mooe,
    utilizedMOOE: 0,
    remainingMOOE: mooe,
    allocatedCO: co,
    utilizedCO: 0,
    remainingCO: co
  };
  db.budgetAllocations.push(newBudget);
  const bucketLabel = normalizedCategory ? `${department} / ${normalizedCategory}` : `${department} (General)`;
  logFinanceAudit((req as any).user.fullName, "Create Budget Allocation", "Budget Monitoring", "None", `${finalBudgetAllocation} for ${bucketLabel}`);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Create Budget", `Created new budget allocation for ${bucketLabel}: PHP ${finalBudgetAllocation}`);
  saveDB();
  res.json({ status: "success", data: newBudget });
});

app.put("/api/finance/budgets/:id", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { budgetAllocation, allocatedPS, allocatedMOOE, allocatedCO, approvedRequestId } = req.body;

  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.BUDGET_OFFICER && (req as any).user.role !== UserRole.FINANCE_OFFICER) {
    return res.status(403).json({ status: "error", message: "Only Budget or Finance Officers can adjust budget allocations." });
  }

  const budget = db.budgetAllocations.find(b => b.id === id);
  if (!budget) {
    return res.status(404).json({ status: "error", message: "Budget allocation record not found" });
  }

  const fy = db.fiscalYears.find((f: any) => f.id === budget.fiscalYearId);
  if (fy && fy.status !== "Active") {
    return res.status(400).json({ status: "error", message: "Cannot modify budget for a closed fiscal year." });
  }

  const targetAmount = Number(budgetAllocation);
  const oldAllocation = budget.budgetAllocation;

  // If the total allocation is being changed and NOT Super Admin, require valid approved budgetRequestId
  if (targetAmount !== oldAllocation && (req as any).user.role !== UserRole.SUPER_ADMIN) {
    if (!approvedRequestId) {
      return res.status(403).json({ 
        status: "error", 
        message: "Any change to the approved allocation amount requires Division Chief concurrence. Please submit a formal Budget Request first, or provide an Approved Request ID." 
      });
    }
    const reqItem = db.budgetRequests?.find(r => r.id === approvedRequestId && r.status === "Approved");
    if (!reqItem) {
      return res.status(403).json({ 
        status: "error", 
        message: "The provided Request ID is either invalid or not yet approved by the Division Chief." 
      });
    }
  }

  budget.budgetAllocation = targetAmount;
  if (allocatedPS !== undefined) {
    budget.allocatedPS = Number(allocatedPS);
    budget.remainingPS = budget.allocatedPS - (budget.utilizedPS || 0);
  }
  if (allocatedMOOE !== undefined) {
    budget.allocatedMOOE = Number(allocatedMOOE);
    budget.remainingMOOE = budget.allocatedMOOE - (budget.utilizedMOOE || 0);
  }
  if (allocatedCO !== undefined) {
    budget.allocatedCO = Number(allocatedCO);
    budget.remainingCO = budget.allocatedCO - (budget.utilizedCO || 0);
  }
  // Recompute total if breakdowns were passed
  if (allocatedPS !== undefined || allocatedMOOE !== undefined || allocatedCO !== undefined) {
    budget.budgetAllocation = (budget.allocatedPS || 0) + (budget.allocatedMOOE || 0) + (budget.allocatedCO || 0);
  }
  budget.remainingBudget = budget.budgetAllocation + (budget.carryOver || 0) - budget.budgetUtilized;
  budget.budgetPercentageUsed = Math.round((budget.budgetUtilized / (budget.budgetAllocation + (budget.carryOver || 0))) * 100);

  logFinanceAudit((req as any).user.fullName, "Adjust Budget Allocation", "Budget Monitoring", `${oldAllocation}`, `${budgetAllocation}`);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Adjust Budget", `Adjusted budget allocation for ${budget.department} to PHP ${budgetAllocation}`);
  saveDB();
  res.json({ status: "success", data: budget });
});


// 4. Property Accountability, Assets & Supply Monitoring Module
app.get("/api/assets", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.assets });
});

app.post("/api/assets", authenticateToken, (req: any, res) => {
  const data = req.body;

  // Access check: Admin
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Access denied: Requires Admin" });
  }

  const existing = db.assets.find(a => a.assetNumber === data.assetNumber);
  if (existing) {
    return res.status(400).json({ status: "error", message: "Asset Number already registered" });
  }

  const newAsset: Asset = {
    id: `ast-${Date.now()}`,
    assetNumber: data.assetNumber || `HSAC-RAB1-AST-${Math.floor(100 + Math.random() * 900)}`,
    serialNumber: data.serialNumber || "N/A",
    category: data.category,
    description: data.description,
    dateAcquired: data.dateAcquired || new Date().toISOString().split("T")[0],
    cost: Number(data.cost),
    status: AssetStatus.AVAILABLE
  };

  db.assets.push(newAsset);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Register Asset", `Registered inventory item ${newAsset.assetNumber} - ${newAsset.description}`);
  saveDB();
  res.json({ status: "success", data: newAsset });
});

// Update asset status
app.put("/api/assets/:id/status", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }

  const asset = db.assets.find(a => a.id === id);
  if (!asset) {
    return res.status(404).json({ status: "error", message: "Asset not found" });
  }

  const oldStatus = asset.status;
  asset.status = status as AssetStatus;
  
  if (status === AssetStatus.AVAILABLE) {
    asset.assignedToId = undefined;
    asset.assignedToName = undefined;
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Update Asset Status", `Altered inventory status of ${asset.assetNumber} from ${oldStatus} to ${status}`);
  saveDB();
  res.json({ status: "success", data: asset });
});

// Allocate/Issue property accountability
app.post("/api/assets/:id/issue", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { employeeId } = req.body;

  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Access restricted to Admin" });
  }

  const asset = db.assets.find(a => a.id === id);
  if (!asset) {
    return res.status(404).json({ status: "error", message: "Asset index entry not found" });
  }

  const employee = db.employees.find(e => e.employeeId === employeeId);
  if (!employee) {
    return res.status(404).json({ status: "error", message: "Target Employee record not found to claim receipt" });
  }

  asset.status = AssetStatus.ASSIGNED;
  asset.assignedToId = employee.employeeId;
  asset.assignedToName = employee.fullName;

  const issuance: AssetIssuance = {
    id: `iss-${Date.now()}`,
    assetId: asset.id,
    assetNumber: asset.assetNumber,
    assignedToId: employee.employeeId,
    assignedToName: employee.fullName,
    dateIssued: new Date().toISOString().split("T")[0],
    quantity: 1,
    conditionOnIssue: "Good working condition - Active accountability hand-off and signature"
  };

  db.assetIssuances.push(issuance);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Assign Accountability", `Issued property item ${asset.assetNumber} to ${employee.fullName} under PAR`);
  saveDB();
  res.json({ status: "success", data: asset });
});

// Process asset returns
app.post("/api/assets/:id/return", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { conditionOnReturn, clearanceStatus } = req.body;

  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Access restricted to Admin" });
  }

  const asset = db.assets.find(a => a.id === id);
  if (!asset) {
    return res.status(404).json({ status: "error", message: "Asset not found" });
  }

  const borrowerName = asset.assignedToName || "Personnel";
  
  asset.status = AssetStatus.RETURNED;
  asset.assignedToId = undefined;
  asset.assignedToName = undefined;

  // Find active issuance and update return records
  const issuance = db.assetIssuances.find(i => i.assetId === id && !i.returnDate);
  if (issuance) {
    issuance.returnDate = new Date().toISOString().split("T")[0];
    issuance.conditionOnReturn = conditionOnReturn || "Returned in good physical status - general wear and tear";
    issuance.clearanceStatus = clearanceStatus || "Cleared";
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Return Asset Accountability", `Received returned property item ${asset.assetNumber} from ${borrowerName} with status [${clearanceStatus || "Cleared"}]`);
  saveDB();
  res.json({ status: "success", data: asset });
});

// Supply Inventory list
app.get("/api/supplies", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.supplyItems });
});

app.post("/api/supplies", authenticateToken, (req: any, res) => {
  const data = req.body;

  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Authorized to Admin only" });
  }

  const newSupply: SupplyItem = {
    id: `sup-${Date.now()}`,
    name: data.name,
    totalQuantity: Number(data.totalQuantity),
    availableQuantity: Number(data.totalQuantity),
    unit: data.unit || "pieces"
  };

  db.supplyItems.push(newSupply);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Create Supply Item", `Added new common supply item to shelf: "${newSupply.name}"`);
  saveDB();
  res.json({ status: "success", data: newSupply });
});

// Direct issue of supplies to administrative offices
app.get("/api/supplies/issuances", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.supplyIssuances });
});

app.post("/api/supplies/issue", authenticateToken, (req: any, res) => {
  const { supplyId, issuedToId, quantity } = req.body;

  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }

  const supply = db.supplyItems.find(s => s.id === supplyId);
  if (!supply) {
    return res.status(404).json({ status: "error", message: "Supply inventory item not found" });
  }

  if (supply.availableQuantity < Number(quantity)) {
    return res.status(400).json({ status: "error", message: `Insufficient quantities on stock. Max available: ${supply.availableQuantity}` });
  }

  const employee = db.employees.find(e => e.employeeId === issuedToId);
  const employeeName = employee ? employee.fullName : issuedToId;

  supply.availableQuantity -= Number(quantity);

  const issuance: SupplyIssuance = {
    id: `si-${Date.now()}`,
    supplyId,
    supplyName: supply.name,
    issuedToId,
    issuedToName: employeeName,
    quantity: Number(quantity),
    dateIssued: new Date().toISOString().split("T")[0]
  };

  db.supplyIssuances.push(issuance);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Issue Supplies", `Handed out ${quantity} ${supply.unit} of "${supply.name}" to ${employeeName}`);
  saveDB();
  res.json({ status: "success", data: supply });
});


// 5. Digital Request & Approvals Workflow
// Why a vehicle request filed with a seminar's advance may no longer be needed, or null: the seminar
// was archived, the person is off it, or HR marked "Did not attend" (for a group's trip, everyone it
// covers). The Division Chief decides the vehicle on its own, so the request screens say so.
function vehicleTripProblem(r: any, p: any): string | null {
  // (One archived once finished keeps its history: its trip took place.)
  if (p.archivedAt && p.archivedBeforeUse) return "The seminar was archived before it was held.";
  const e: any = (db.trainingParticipants || []).find((x: any) => x && x.id === r.trainingParticipantId);
  if (!e || e.status === "Cancelled" || e.status === "Archived") return "They are no longer on this seminar.";
  const a: any = (db.cashAdvances || []).find((x: any) => x && x.id === r.cashAdvanceId);
  const people = (a ? coveredEnrolmentIds(a) : [e.id])
    .map(id => (db.trainingParticipants || []).find((x: any) => x && x.id === id)).filter(Boolean);
  if (people.length > 0 && people.every((x: any) => x.attendance === "Did not attend")) {
    return people.length === 1 ? 'HR marked them "Did not attend".' : 'HR marked everyone it covers "Did not attend".';
  }
  return null;
}

// A vehicle request filed with a seminar's cash advance, as the request screens show it, worked out on
// the way out and never stored. Each part goes only to whoever may see it: the employee their own; the
// advance (number and status) to Finance and the Administrator, as /api/cash-advances; the seminar, and
// whether the trip may be off, to HR and the Administrator, as the training records.
function withAdvanceLinks(r: any, user: any) {
  if (!r || r.requestType !== RequestType.VEHICLE || !r.cashAdvanceId) return r;
  const own = isOwnRecord(user, r.employeeId);
  const a: any = own || isCashAdvanceRole(user?.role) ? (db.cashAdvances || []).find((x: any) => x && x.id === r.cashAdvanceId) : null;
  const p: any = own || isTrainingRecordsRole(user?.role) ? (db.trainingPrograms || []).find((x: any) => x && x.id === r.trainingProgramId) : null;
  return {
    ...r,
    linkedSeminar: p ? { title: String(p.title || "").trim(), startDate: p.startDate, endDate: p.endDate, tripProblem: vehicleTripProblem(r, p) } : null,
    linkedAdvance: a ? { advanceNo: a.advanceNo || null, status: a.status } : null
  };
}

app.get("/api/requests", authenticateToken, (req: any, res) => {
  // Employees can only view their own requests unless they are Admin, HR, Department Head, Custodian
  const { role, employeeId } = req.user;

  if (role === UserRole.EMPLOYEE) {
    const records = db.requests.filter(r => r.employeeId === employeeId);
    return res.json({ status: "success", data: records.map(r => withAdvanceLinks(r, req.user)) });
  }

  res.json({ status: "success", data: db.requests.map(r => withAdvanceLinks(r, req.user)) });
});

// A vehicle request's Vehicle Reservation Slip fields, as the request form and a seminar's cash
// advance request ("Also request a vehicle") both file them. The serial is issued here rather than
// typed, so the printed slip carries a number the office can file against.
function vehicleRequestFields(data: any) {
  return {
    destination: data.destination,
    purpose: data.purpose,
    dateNeeded: data.dateNeeded,
    passengers: data.passengers,
    vrsNo: nextVrsNo(new Date()),
    departureDate: data.departureDate || "",
    departureTime: data.departureTime || "",
    arrivalDate: data.arrivalDate || "",
    arrivalTime: data.arrivalTime || ""
  };
}

app.post("/api/requests", authenticateToken, (req: any, res) => {
  const data = req.body;
  const { employeeId, fullName } = req.user;

  if (!employeeId) {
    return res.status(400).json({ status: "error", message: "User is not linked to a regional employee profile code" });
  }

  const baseReq = {
    id: `req-${Date.now()}`,
    requestType: data.requestType,
    employeeId,
    employeeName: fullName,
    dateRequested: new Date().toISOString().split("T")[0],
    status: data.requestType === RequestType.VEHICLE ? RequestStatus.ENDORSED_TO_CHIEF : RequestStatus.PENDING
  };

  let fullReq: AnyRequest;

  switch (data.requestType) {
    case RequestType.LEAVE:
      fullReq = {
        ...baseReq,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason
      } as any;
      break;
    case RequestType.SERVICE_RECORD:
      fullReq = {
        ...baseReq,
        purpose: data.purpose,
        copies: Number(data.copies || 1)
      } as any;
      break;
    case RequestType.VEHICLE:
      fullReq = { ...baseReq, ...vehicleRequestFields(data) } as any;
      break;
    case RequestType.ZOOM:
      fullReq = {
        ...baseReq,
        meetingTitle: data.meetingTitle,
        meetingDate: data.meetingDate,
        startTime: data.startTime,
        endTime: data.endTime,
        alternativeHost: data.alternativeHost,
        reason: data.reason
      } as any;
      break;
    case RequestType.SUPPLY:
      fullReq = {
        ...baseReq,
        supplyId: data.supplyId,
        supplyName: data.supplyName,
        quantity: Number(data.quantity),
        purpose: data.purpose
      } as any;
      break;
    default:
      return res.status(400).json({ status: "error", message: "Invalid regional service request classification type" });
  }

  db.requests.push(fullReq);
  
  // Tell whoever acts on it first: a Vehicle request skips HR and goes straight to the Division
  // Chief (the Administrator); every other request starts with HR. (Before, HR was told about a
  // Vehicle request too, and the Chief never was.)
  notify({ role: fullReq.status === RequestStatus.ENDORSED_TO_CHIEF ? UserRole.SUPER_ADMIN : UserRole.HR_OFFICER }, {
    title: `New ${fullReq.requestType}`,
    message: `${fullReq.employeeName} submitted a ${fullReq.requestType} for verification and approval.`,
    type: "info",
    link: { tab: "requests", record: { kind: "request", id: fullReq.id } }
  });

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Create Request", `Submitted digital request: ${fullReq.requestType} for processing.`);
  saveDB();
  res.json({ status: "success", data: fullReq });
});

// Old Appraise and adjudicate Requests index status has been deprecated for security compliance.
app.put("/api/requests/:id/approve", authenticateToken, (req: any, res) => {
  return res.status(400).json({ 
    status: "error", 
    message: "This shortcut approval endpoint has been disabled for workflow safety. Please use /api/requests/:id/hr-endorse and /api/requests/:id/chief-decide to follow the mandated two-stage approval governance." 
  });
});
// 6. Role-Based Dashboards & Analytics
app.get("/api/dashboard/summary", authenticateToken, (req: any, res) => {
  const role = (req as any).user.role;
  
  // Total stats values (general overview). Staff are active unless marked inactive, as everywhere
  // else: the five with logins carry no isActive flag, and `filter(e => e.isActive)` left them out.
  const activeStaff = db.employees.filter(e => e.isActive !== false);
  const activeEmployees = activeStaff.length;
  const totalEmployees = activeEmployees;
  // Permanent (or regular plantilla) appointments, by the employment status on each record.
  const permanentEmployees = activeStaff.filter(e => /^(permanent|regular)$/i.test(String(e.employmentStatus || "").trim())).length;
  const listTrainings = db.trainings;
  const totalAssetsVal = db.assets.reduce((sum, a) => sum + a.cost, 0);

  const pendingValidations = db.financialTransactions.filter(t => t.status === TransactionStatus.PENDING_VALIDATION).length;
  const validatedTransactions = db.financialTransactions.filter(t => t.status === TransactionStatus.VALIDATED).length;
  const liquidatedTransactions = db.financialTransactions.filter(t => t.status === TransactionStatus.LIQUIDATED).length;
  const totalExpenditure = db.financialTransactions.reduce((acc, t) => acc + t.amount, 0);

  const totalAssets = db.assets.length;
  const assignedAssets = db.assets.filter(a => a.status === AssetStatus.ASSIGNED).length;
  const returnedAssets = db.assets.filter(a => a.status === AssetStatus.RETURNED).length;
  const damagedAssets = db.assets.filter(a => a.status === AssetStatus.DAMAGED).length;

  const totalRequests = db.requests.length;
  const pendingRequests = db.requests.filter(r => r.status === RequestStatus.PENDING).length;

  res.json({
    status: "success",
    data: {
      role,
      userFullName: (req as any).user.fullName,
      stats: {
        totalEmployees,
        activeEmployees,
        permanentEmployees,
        trainingCount: listTrainings.length,
        totalAssets,
        assignedAssets,
        returnedAssets,
        damagedAssets,
        totalAssetsVal,
        totalTransactions: db.financialTransactions.length,
        pendingValidations,
        validatedTransactions,
        liquidatedTransactions,
        totalExpenditure,
        totalRequests,
        pendingRequests,
      },
      // Only the Administrator's dashboard shows these lists (App.tsx renders DashboardView
      // for SUPER_ADMIN only). Other roles get empty lists: the audit trail carries details
      // such as why a signatory was deactivated, and the others are colleagues' records.
      auditLogs: role === UserRole.SUPER_ADMIN ? db.auditLogs.slice(0, 8) : [],
      // The five newest requests still open (not yet approved or rejected), newest first (LIFO).
      // Requests are stored oldest first, so slice(0, 5) used to show the five oldest of any status.
      recentRequests: role === UserRole.SUPER_ADMIN
        ? db.requests
            .map((r: any, i: number) => ({ r, i, t: firstTimestamp(r.dateRequested, r.createdAt) }))
            .filter(x => x.r.status !== RequestStatus.APPROVED && x.r.status !== RequestStatus.REJECTED)
            .sort((a, b) => b.t - a.t || b.i - a.i)
            .slice(0, 5)
            .map(x => x.r)
        : [],
      recentTransactions: role === UserRole.SUPER_ADMIN ? db.financialTransactions.slice(0, 5) : [],
    }
  });
});

// 7. Audit System Log index route

// BACKUP & RESTORE UTILITIES
app.get("/api/backups", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only administrators can access utilities" });
  }
  if (!db.backups) {
    db.backups = [
      { id: "bkp-1", filename: "hsac_rab1_backup_2026-07-01.sql", date: "2026-07-01T00:00:00Z", size: "4.2 MB", status: "Completed" },
      { id: "bkp-2", filename: "hsac_rab1_backup_2026-07-05.sql", date: "2026-07-05T00:00:00Z", size: "4.5 MB", status: "Completed" }
    ];
  }
  res.json({ status: "success", data: db.backups });
});

app.post("/api/backups", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only administrators can access utilities" });
  }
  if (!db.backups) db.backups = [];
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const newBackup = {
    id: "bkp-" + Date.now(),
    filename: "hsac_rab1_backup_" + dateStr + "_" + Date.now() + ".sql",
    date: now.toISOString(),
    size: "4." + Math.floor(Math.random() * 9 + 1) + " MB",
    status: "Completed"
  };
  db.backups.unshift(newBackup);
  
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Create Backup", "Generated manual system backup " + newBackup.id);
  
  res.json({ status: "success", data: newBackup, message: "Backup successfully created." });
});


app.get("/api/backups/:id/download", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only administrators can access utilities" });
  }
  const backup = db.backups?.find(b => b.id === req.params.id);
  if (!backup) {
    return res.status(404).json({ status: "error", message: "Backup not found" });
  }
  
  const sqlContent = "-- System Backup: " + backup.filename + "\n-- Date: " + backup.date + "\n\n-- Mock SQL dump data\nCREATE TABLE mock_table (id INT);\nINSERT INTO mock_table VALUES (1);\n";
  
  res.setHeader('Content-disposition', 'attachment; filename=' + backup.filename);
  res.setHeader('Content-type', 'application/sql');
  res.send(sqlContent);
});

app.post("/api/backups/:id/restore", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only administrators can access utilities" });
  }
  
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Restore Backup", "Restored system database from backup archive " + req.params.id);
  
  res.json({ status: "success", message: "System database successfully restored." });
});

app.delete("/api/backups/:id", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only administrators can access utilities" });
  }
  if (db.backups) {
    db.backups = db.backups.filter((b: any) => b.id !== req.params.id);
  }
  
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Delete Backup", "Deleted system backup archive " + req.params.id);
  
  res.json({ status: "success", message: "Backup successfully deleted." });
});

app.get("/api/audit-logs", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only administrators can review operational security audits" });
  }
  res.json({ status: "success", data: db.auditLogs });
});

// --- SIGNATORIES (Utilities → Manage Signatories) ---
// Who prints on official forms. Every signed-in user may read the active list, because
// the liquidation form needs today's representatives and accountant; only the
// Administrator changes it. Nothing is ever deleted: a printed report may carry a
// signatory's name, so someone who leaves is deactivated instead.

const SIGNATORY_TEXT_MAX = 150;

// Names print on official forms, so invisible characters (zero-width, direction
// overrides) are removed: they would let a lookalike pass the duplicate check, or print
// a name that reads differently from the stored one. OR and DV numbers and reasons are
// cleaned the same way (src/inputText.ts, which also bounds the work on huge input).
function signatoryText(value: any): string {
  return cleanText(value);
}

// Same person: by staff record when both have one, otherwise by name.
function sameSignatoryPerson(a: { employeeId?: string; fullName: string }, b: { employeeId?: string; fullName: string }): boolean {
  if (a.employeeId && b.employeeId) return a.employeeId === b.employeeId;
  return a.fullName.toLowerCase() === b.fullName.toLowerCase();
}

function requireSignatoryAdmin(req: any, res: any): boolean {
  if (req.user.role === UserRole.SUPER_ADMIN) return true;
  res.status(403).json({ status: "error", message: "Only the Administrator can manage signatories." });
  return false;
}

// Active entries first, then by role and name, so the table and dropdowns read the same.
function signatoryOrder(a: Signatory, b: Signatory): number {
  if (a.status !== b.status) return a.status === "Active" ? -1 : 1;
  // String(): one malformed entry must not make the list fail for everyone.
  return String(a.role).localeCompare(String(b.role)) || String(a.fullName).localeCompare(String(b.fullName));
}

// For a one-person role, another entry whose term overlaps [from, to] (an active term runs
// to today). Strict comparison, so a handover day shared by the old end and the new start
// is allowed. Keeps every day with exactly one Accountant.
function overlappingSingleHolderTerm(role: SignatoryRole, from: string, to: string, exceptId: string | null): Signatory | null {
  if (!SINGLE_HOLDER_SIGNATORY_ROLES.includes(role)) return null;
  const today = manilaToday();
  return (db.signatories || []).find(s => {
    if (s.id === exceptId || s.role !== role) return false;
    const sTo = s.status === "Active" || !s.effectiveTo ? today : s.effectiveTo;
    return from < sTo && s.effectiveFrom < to;
  }) || null;
}

// Ends the term of whoever holds a one-person role (the Accountant), so appointing or
// reactivating someone never leaves two holders. Returns who was replaced.
function endSingleHolderTerms(role: SignatoryRole, exceptId: string | null, actorName: string): Signatory[] {
  if (!SINGLE_HOLDER_SIGNATORY_ROLES.includes(role)) return [];
  const today = manilaToday();
  const now = new Date().toISOString();
  const replaced = (db.signatories || []).filter(s => s.status === "Active" && s.role === role && s.id !== exceptId);
  for (const s of replaced) {
    s.status = "Inactive";
    s.effectiveTo = today;
    s.updatedBy = actorName;
    s.updatedAt = now;
  }
  return replaced;
}

// The active signatory with this id in this role, or null. Reports copy the name and
// position from here at the moment of filing/validation; nothing typed by a client is used.
function activeSignatoryById(id: any, role: SignatoryRole): Signatory | null {
  if (typeof id !== "string" || !id) return null;
  return (db.signatories || []).find(s => s.id === id && s.role === role && s.status === "Active") || null;
}

function hasActiveSignatory(role: SignatoryRole): boolean {
  return (db.signatories || []).some(s => s.role === role && s.status === "Active");
}

const NO_REPRESENTATIVE_MESSAGE =
  "No Authorized Representative is set up yet, so Box B can't be filled. Ask the Administrator to add one in Utilities → Manage Signatories.";

// Box B certifies the claimant's own travel, so the claimant can't be the one who signs it.
// Matched by staff record when the signatory has one, otherwise by name.
function isClaimantSignatory(rep: Signatory, claimant: { employeeId?: string; fullName?: string }): boolean {
  const forms = claimant.employeeId ? employeeIdForms(claimant.employeeId) : [];
  if (rep.employeeId) return forms.includes(rep.employeeId);
  const emp = (db.employees || []).find((e: any) => forms.includes(e.id));
  const names = [claimant.fullName, emp?.fullName].filter(Boolean).map((n: any) => String(n).trim().toLowerCase());
  return names.includes(rep.fullName.trim().toLowerCase());
}

// Supporting documents must be a list of file objects. Anything else used to crash a
// handler part-way through its changes, leaving a half-updated report behind.
function invalidSupportingDocs(docs: any): boolean {
  return docs !== undefined && docs !== null
    && (!Array.isArray(docs) || docs.some((d: any) => !d || typeof d !== "object" || Array.isArray(d)));
}
const INVALID_DOCS_MESSAGE = "Supporting documents must be a list of files.";

// A receipt with something in it, as the upload screens send one: a current (not replaced) file whose
// content is a base64 data URL of at least 100 characters. A name alone, or an empty data URL, is not
// a receipt (the security review of seminar reimbursements, 2026-10-30).
function isRealFile(d: any): boolean {
  if (!d || d.supersededAt || typeof d.content !== "string" || !SAFE_FILE_URL.test(d.content)) return false;
  return d.content.length - d.content.indexOf(",") - 1 >= 100;
}

// Files as the claimant sends them. A file's history (replaces, supersededAt, replacedBy) and
// when it reached the report are recorded by the server alone, and each file gets an id no
// other file on the report has, so a reviewer's "replace this file" points at exactly one.
function claimantDocuments(docs: any[], existing: any[] = []): LiquidationDocument[] {
  const ids = new Set((existing || []).map((d: any) => d?.id).filter(Boolean));
  const now = new Date().toISOString();
  return docs.map((d: any) => {
    const { replaces, supersededAt, replacedBy, ...file } = d;
    if (typeof file.id !== "string" || !file.id || ids.has(file.id)) file.id = `doc-${crypto.randomUUID()}`;
    ids.add(file.id);
    file.uploadedAt = now;
    return file;
  });
}

// A new file's details are shown on every reviewer's screen, so they must be plain text (an
// object there would crash the page), and the file needs a name.
function documentProblem(d: any): string | null {
  if (typeof d?.name !== "string" || !d.name.trim() || d.name.length > 255) {
    return "Each file needs a name of up to 255 characters.";
  }
  for (const k of ["type", "filename", "size", "content"]) {
    if (d[k] !== undefined && d[k] !== null && typeof d[k] !== "string") return "A file's details must be text.";
  }
  // The file itself, as the upload screen sends it: a base64 data URL. Reviewers open it with a
  // click, so anything else (a "javascript:" URL sent straight to the API) would run as a script
  // in their session. SAFE_FILE_URL is the same check the screens and the Documents Vault use.
  if (typeof d.content === "string" && d.content !== "" && !SAFE_FILE_URL.test(d.content)) {
    return "Each file must be uploaded from your device.";
  }
  return null;
}

// The report's own text, as the claimant enters it at filing or in a correction. Only what
// the request carries is checked; `stored` fills in the other end of the period.
function reportHeaderProblem(body: any, stored: any = {}): string | null {
  for (const k of ["periodCoveredFrom", "periodCoveredTo"]) {
    if (body?.[k] !== undefined && body[k] !== null && body[k] !== "" && !isCalendarDate(body[k])) {
      return "Enter the period covered as dates (YYYY-MM-DD).";
    }
  }
  if (body?.periodCoveredFrom !== undefined || body?.periodCoveredTo !== undefined) {
    const from = body.periodCoveredFrom ?? stored.periodCoveredFrom;
    const to = body.periodCoveredTo ?? stored.periodCoveredTo;
    if (from && to && from > to) return "The period covered ends before it starts.";
  }
  const rc = body?.responsibilityCenterCode;
  if (rc !== undefined && rc !== null && (typeof rc !== "string" || rc.length > 100)) {
    return "Enter the responsibility center code as text of up to 100 characters.";
  }
  const notes = body?.remarks;
  if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 2000)) {
    return "Keep your notes to text of up to 2,000 characters.";
  }
  return null;
}

app.get("/api/signatories", authenticateToken, (req: any, res: any) => {
  const all = [...(db.signatories || [])].sort(signatoryOrder);
  if (req.user.role === UserRole.SUPER_ADMIN) {
    return res.json({ status: "success", data: all });
  }
  const active: ActiveSignatory[] = all
    .filter(s => s.status === "Active")
    .map(({ id, fullName, position, role }) => ({ id, fullName, position, role }));
  res.json({ status: "success", data: active });
});

app.post("/api/signatories", authenticateToken, (req: any, res: any) => {
  if (!requireSignatoryAdmin(req, res)) return;
  const body = req.body || {};
  const fullName = signatoryText(body.fullName);
  const position = signatoryText(body.position);
  const role = body.role as SignatoryRole;
  const today = manilaToday();
  const effectiveFrom = body.effectiveFrom === undefined || body.effectiveFrom === "" ? today : body.effectiveFrom;

  if (!fullName || !position) {
    return res.status(400).json({ status: "error", message: "Enter the signatory's full name and position." });
  }
  if (fullName.length > SIGNATORY_TEXT_MAX || position.length > SIGNATORY_TEXT_MAX) {
    return res.status(400).json({ status: "error", message: `Name and position must be ${SIGNATORY_TEXT_MAX} characters or fewer.` });
  }
  if (!SIGNATORY_ROLES.includes(role)) {
    return res.status(400).json({ status: "error", message: `Role must be one of: ${SIGNATORY_ROLES.join(", ")}.` });
  }
  if (!isCalendarDate(effectiveFrom) || effectiveFrom > today) {
    return res.status(400).json({ status: "error", message: "Effective from must be a valid date, today or earlier." });
  }
  let employeeId: string | undefined;
  if (body.employeeId !== undefined && body.employeeId !== null && body.employeeId !== "") {
    const emp = (db.employees || []).find(e => e.id === body.employeeId || e.employeeId === body.employeeId);
    if (!emp) {
      return res.status(400).json({ status: "error", message: "That staff record was not found. Pick the person from the list again." });
    }
    employeeId = emp.id;
  }

  if (!db.signatories) db.signatories = [];
  const duplicate = db.signatories.find(s => s.status === "Active" && s.role === role && sameSignatoryPerson(s, { employeeId, fullName }));
  if (duplicate) {
    return res.status(409).json({ status: "error", message: `${duplicate.fullName} is already an active ${role}.` });
  }
  // The person being replaced serves until today, so their successor starts today; a
  // backdated start would give two holders for the same days. Backdating is fine for a
  // first entry, which records someone already serving.
  const replacesSomeone = SINGLE_HOLDER_SIGNATORY_ROLES.includes(role)
    && db.signatories.some(s => s.status === "Active" && s.role === role);
  if (replacesSomeone && effectiveFrom !== today) {
    return res.status(400).json({ status: "error", message: `A new ${role} who replaces the current one starts today, the day the current term ends.` });
  }
  // A backdated first entry must not overlap a former holder's term.
  const overlap = replacesSomeone ? null : overlappingSingleHolderTerm(role, effectiveFrom, today, null);
  if (overlap) {
    return res.status(409).json({ status: "error", message: `That start date overlaps ${overlap.fullName}'s term as ${role} (${overlap.effectiveFrom} to ${overlap.effectiveTo || "today"}).` });
  }

  const actor = (req as any).user;
  const replaced = endSingleHolderTerms(role, null, actor.fullName);
  const signatory: Signatory = {
    id: `sig-${crypto.randomUUID()}`,
    ...(employeeId ? { employeeId } : {}),
    fullName,
    position,
    role,
    status: "Active",
    effectiveFrom,
    createdBy: actor.fullName,
    createdAt: new Date().toISOString()
  };
  db.signatories.push(signatory);

  const replacedNote = replaced.length > 0 ? `, replacing ${replaced.map(s => s.fullName).join(", ")}` : "";
  logEvent(actor.id, actor.username, actor.role, replaced.length > 0 ? "Appoint Signatory" : "Add Signatory",
    `${fullName} (${position}) added as ${role}${replacedNote}`);
  saveDB();
  res.json({
    status: "success",
    message: replaced.length > 0
      ? `${fullName} is now the ${role}. ${replaced.map(s => s.fullName).join(", ")}'s term ended today.`
      : `${fullName} added as ${role}.`,
    data: signatory
  });
});

// Edits the name, position, staff link or dates. The role is fixed: moving someone to
// another role is a new entry, so each role's history stays readable.
app.put("/api/signatories/:id", authenticateToken, (req: any, res: any) => {
  if (!requireSignatoryAdmin(req, res)) return;
  const signatory = (db.signatories || []).find(s => s.id === req.params.id);
  if (!signatory) return res.status(404).json({ status: "error", message: "Signatory not found." });
  const body = req.body || {};

  if (body.role !== undefined && body.role !== signatory.role) {
    return res.status(400).json({ status: "error", message: "A signatory's role can't be changed. Deactivate this entry and add the person under the new role." });
  }
  const fullName = body.fullName !== undefined ? signatoryText(body.fullName) : signatory.fullName;
  const position = body.position !== undefined ? signatoryText(body.position) : signatory.position;
  if (!fullName || !position) {
    return res.status(400).json({ status: "error", message: "Enter the signatory's full name and position." });
  }
  if (fullName.length > SIGNATORY_TEXT_MAX || position.length > SIGNATORY_TEXT_MAX) {
    return res.status(400).json({ status: "error", message: `Name and position must be ${SIGNATORY_TEXT_MAX} characters or fewer.` });
  }
  const today = manilaToday();
  const effectiveFrom = body.effectiveFrom !== undefined ? body.effectiveFrom : signatory.effectiveFrom;
  if (!isCalendarDate(effectiveFrom) || effectiveFrom > today) {
    return res.status(400).json({ status: "error", message: "Effective from must be a valid date, today or earlier." });
  }
  // An active term has no end date yet; an ended one keeps a valid end date.
  let effectiveTo = signatory.effectiveTo;
  if (body.effectiveTo !== undefined) {
    if (signatory.status === "Active" && body.effectiveTo !== "" && body.effectiveTo !== null) {
      return res.status(400).json({ status: "error", message: "An active signatory has no end date. Deactivate them to end the term." });
    }
    if (signatory.status === "Inactive") {
      if (!isCalendarDate(body.effectiveTo) || body.effectiveTo > today) {
        return res.status(400).json({ status: "error", message: "Effective to must be a valid date, today or earlier." });
      }
      effectiveTo = body.effectiveTo;
    }
  }
  if (effectiveTo && effectiveTo < effectiveFrom) {
    return res.status(400).json({ status: "error", message: "The end date can't be earlier than the start date." });
  }
  let employeeId = signatory.employeeId;
  if (body.employeeId !== undefined) {
    if (body.employeeId === null || body.employeeId === "") {
      employeeId = undefined;
    } else {
      const emp = (db.employees || []).find(e => e.id === body.employeeId || e.employeeId === body.employeeId);
      if (!emp) {
        return res.status(400).json({ status: "error", message: "That staff record was not found. Pick the person from the list again." });
      }
      employeeId = emp.id;
    }
  }
  if (signatory.status === "Active") {
    const duplicate = (db.signatories || []).find(s =>
      s.id !== signatory.id && s.status === "Active" && s.role === signatory.role && sameSignatoryPerson(s, { employeeId, fullName }));
    if (duplicate) {
      return res.status(409).json({ status: "error", message: `${duplicate.fullName} is already an active ${signatory.role}.` });
    }
  }
  // Moving a term's dates must not give two Accountants the same days.
  const overlap = overlappingSingleHolderTerm(signatory.role, effectiveFrom,
    signatory.status === "Active" ? today : (effectiveTo || today), signatory.id);
  if (overlap) {
    return res.status(409).json({ status: "error", message: `Those dates overlap ${overlap.fullName}'s term as ${signatory.role} (${overlap.effectiveFrom} to ${overlap.effectiveTo || "today"}).` });
  }

  const before = `${signatory.fullName} (${signatory.position})`;
  signatory.fullName = fullName;
  signatory.position = position;
  signatory.effectiveFrom = effectiveFrom;
  if (effectiveTo) signatory.effectiveTo = effectiveTo; else delete signatory.effectiveTo;
  if (employeeId) signatory.employeeId = employeeId; else delete signatory.employeeId;
  signatory.updatedBy = (req as any).user.fullName;
  signatory.updatedAt = new Date().toISOString();

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Edit Signatory",
    `${signatory.role} ${before} updated to ${fullName} (${position})`);
  saveDB();
  res.json({ status: "success", data: signatory });
});

// "Resigned / Replaced": ends the term today. The entry stays, so reports that print
// this name keep it.
app.put("/api/signatories/:id/deactivate", authenticateToken, (req: any, res: any) => {
  if (!requireSignatoryAdmin(req, res)) return;
  const signatory = (db.signatories || []).find(s => s.id === req.params.id);
  if (!signatory) return res.status(404).json({ status: "error", message: "Signatory not found." });
  if (signatory.status === "Inactive") {
    return res.status(409).json({ status: "error", message: `${signatory.fullName} is already inactive.` });
  }
  const reason = signatoryText(req.body?.reason).slice(0, SIGNATORY_TEXT_MAX);
  signatory.status = "Inactive";
  signatory.effectiveTo = manilaToday();
  signatory.updatedBy = (req as any).user.fullName;
  signatory.updatedAt = new Date().toISOString();

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Deactivate Signatory",
    `${signatory.fullName} (${signatory.role}) deactivated${reason ? `: ${reason}` : ""}`);
  saveDB();
  res.json({ status: "success", data: signatory });
});

// Starts a new term today. Reactivating an Accountant ends the current one's term, as
// appointing a new one does.
app.put("/api/signatories/:id/reactivate", authenticateToken, (req: any, res: any) => {
  if (!requireSignatoryAdmin(req, res)) return;
  const signatory = (db.signatories || []).find(s => s.id === req.params.id);
  if (!signatory) return res.status(404).json({ status: "error", message: "Signatory not found." });
  if (signatory.status === "Active") {
    return res.status(409).json({ status: "error", message: `${signatory.fullName} is already active.` });
  }
  const duplicate = (db.signatories || []).find(s =>
    s.id !== signatory.id && s.status === "Active" && s.role === signatory.role && sameSignatoryPerson(s, signatory));
  if (duplicate) {
    return res.status(409).json({ status: "error", message: `${duplicate.fullName} is already an active ${signatory.role}.` });
  }

  const actor = (req as any).user;
  const replaced = endSingleHolderTerms(signatory.role, signatory.id, actor.fullName);
  const previousTerm = `${signatory.effectiveFrom} to ${signatory.effectiveTo || "?"}`;
  signatory.status = "Active";
  signatory.effectiveFrom = manilaToday();
  delete signatory.effectiveTo;
  signatory.updatedBy = actor.fullName;
  signatory.updatedAt = new Date().toISOString();

  const replacedNote = replaced.length > 0 ? `, replacing ${replaced.map(s => s.fullName).join(", ")}` : "";
  logEvent(actor.id, actor.username, actor.role, "Reactivate Signatory",
    `${signatory.fullName} (${signatory.role}) reactivated (previous term ${previousTerm})${replacedNote}`);
  saveDB();
  res.json({
    status: "success",
    message: replaced.length > 0
      ? `${signatory.fullName} is the ${signatory.role} again. ${replaced.map(s => s.fullName).join(", ")}'s term ended today.`
      : `${signatory.fullName} is active again.`,
    data: signatory
  });
});

// 8. Dynamic Notifications APIs

// Whether a notice is for this login: its role (if it names one) and, for one employee's
// notice, that employee's own login. A notice naming neither is an old broadcast.
// Both sides are resolved to the staff record, and the records compared: new notices name it
// by its internal id, so if an employee code is ever reused, the new holder can't read the
// earlier person's notices. (Older notices name the code; they resolve to whoever holds it.)
// A notice whose employee no longer exists is for nobody.
// Takes the employee list as an argument because the load migration runs before `db` exists.
function noticeIsFor(n: Notification, user: { role: string; employeeId?: string }, employees: Employee[]): boolean {
  if (n.targetRole && n.targetRole !== user.role) return false;
  if (n.targetEmployeeId) {
    if (!user.employeeId) return false;
    const target = employees.find(e => e.id === n.targetEmployeeId) ?? employees.find(e => e.employeeId === n.targetEmployeeId);
    const mine = employees.find(e => e.employeeId === user.employeeId) ?? employees.find(e => e.id === user.employeeId);
    return !!target && !!mine && target.id === mine.id;
  }
  return true;
}

// Adds one bell notice: for a role (everyone signed in with it) or for one employee's
// Personnel login. Everyone it is for marks it read on their own (readBy). The id is random,
// so nobody can guess it. Returns false when one with the same dedupeKey exists. Callers save.
function notify(
  to: { role: UserRole } | { employee: string },
  notice: { title: string; message: string; type: Notification["type"]; link?: NotificationLink; dedupeKey?: string }
): boolean {
  if (!db.notifications) db.notifications = [];
  if (notice.dedupeKey && db.notifications.some(n => n.dedupeKey === notice.dedupeKey)) return false;
  let audience: Pick<Notification, "targetRole" | "targetEmployeeId">;
  if ("role" in to) {
    audience = { targetRole: to.role };
  } else {
    // Named by the staff record's internal id (see noticeIsFor).
    const emp = (db.employees || []).find(e => e.id === to.employee || e.employeeId === to.employee);
    if (!emp) return false;
    audience = { targetRole: UserRole.EMPLOYEE, targetEmployeeId: emp.id };
  }
  db.notifications.push({
    id: `notif-${crypto.randomUUID()}`,
    title: notice.title,
    message: notice.message,
    type: notice.type,
    readBy: [],
    timestamp: new Date().toISOString(),
    ...audience,
    ...(notice.link ? { link: notice.link } : {}),
    ...(notice.dedupeKey ? { dedupeKey: notice.dedupeKey } : {})
  });
  return true;
}

const noticesFor = (user: Pick<User, "role" | "employeeId">) => (db.notifications || []).filter(n => noticeIsFor(n, user, db.employees || []));
const noticeTime = (t: string | undefined) => { const ms = new Date(t || "").getTime(); return isNaN(ms) ? 0 : ms; };

// The caller's own notices, newest first, each with whether they have read it. Who else a
// notice is for, or who has read it, is not sent. A notice for a whole role that is older than
// the account counts as read: a new HR officer doesn't start with the office's history as
// unread. One addressed to the employee themself stays unread (e.g. an earlier assignment).
app.get("/api/notifications", authenticateToken, (req: any, res) => {
  const joined = noticeTime(req.user.createdAt);
  const data = noticesFor(req.user)
    .sort((a, b) => noticeTime(b.timestamp) - noticeTime(a.timestamp))
    .map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      timestamp: n.timestamp,
      isRead: (n.readBy || []).includes(req.user.id) || (!n.targetEmployeeId && joined > 0 && noticeTime(n.timestamp) < joined),
      ...(n.link ? { link: n.link } : {})
    }));
  res.json({ status: "success", data });
});

// Marks one of the caller's notices read for them. Anyone else's answers 404 (as if it
// didn't exist), and nothing about the notice is sent back.
app.post("/api/notifications/:id/read", authenticateToken, (req: any, res) => {
  const notice = noticesFor(req.user).find(n => n.id === req.params.id);
  if (!notice) return res.status(404).json({ status: "error", message: "Notification not found." });
  if (!(notice.readBy || []).includes(req.user.id)) {
    notice.readBy = [...(notice.readBy || []), req.user.id];
    saveDB();
  }
  res.json({ status: "success" });
});

// Marks the caller's notices read, for them only. The bell sends the ids it is showing, so a
// notice that arrived since its last refresh isn't marked read unseen; without ids, all of them.
app.post("/api/notifications/read-all", authenticateToken, (req: any, res) => {
  const ids = req.body?.ids;
  if (ids !== undefined && (!Array.isArray(ids) || !ids.every((id: unknown) => typeof id === "string"))) {
    return res.status(400).json({ status: "error", message: "ids must be a list of notification ids." });
  }
  // A set, capped: the bell never shows anywhere near this many, and a huge list would tie up
  // the server.
  const wanted = ids ? new Set<string>(ids.slice(0, 500)) : null;
  let marked = 0;
  for (const notice of noticesFor(req.user)) {
    if (wanted && !wanted.has(notice.id)) continue;
    if ((notice.readBy || []).includes(req.user.id)) continue;
    notice.readBy = [...(notice.readBy || []), req.user.id];
    marked++;
  }
  if (marked > 0) saveDB();
  res.json({ status: "success", message: `${marked} notification(s) marked as read.` });
});


// ============================================
// PARTNERSHIP & ALIGNMENT API SUITE
// ============================================

// A. USER ACCOUNT & ROLE MANAGEMENT (Administrator/Chief)
app.get("/api/admin/users", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator / Division Chief privileges" });
  }
  res.json({ status: "success", data: db.users });
});

app.post("/api/admin/users", authenticateToken, async (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator / Division Chief privileges" });
  }
  const { username, email, fullName, role, status, employeeId, position, division, employmentStatus } = req.body;
  if (!username || !email || !fullName || !role || !employeeId || !position || !division) {
    return res.status(400).json({ status: "error", message: "Please supply all required properties including Employee ID, Position, and Division" });
  }
  
  const existingUser = db.users.find(u => u.username === username || u.email === email);
  if (existingUser) {
    return res.status(400).json({ status: "error", message: "Username or Email already registered" });
  }

  const existingEmp = db.employees.find((e: any) => e.employeeId === employeeId);
  if (existingEmp) {
    return res.status(400).json({ status: "error", message: "An employee with this Employee ID already exists." });
  }

  // Create Employee
  const newEmployee = {
    id: `emp-${Date.now()}`,
    employeeId,
    fullName,
    position,
    division,
    employmentStatus: employmentStatus || "Regular",
    email,
    dateHired: new Date().toISOString().split('T')[0],
    isActive: true
  };
  
  db.employees.push(newEmployee);

  // Create User
  
  const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 char temp password
  const salt = crypto.randomBytes(16).toString('hex');
  const tempPasswordHash = crypto.pbkdf2Sync(tempPassword, salt, 1000, 64, 'sha512').toString('hex');

  const newUser = {
    id: `u-${Date.now()}`,
    username,
    email,
    fullName,
    role,
    status: "Pending Password Change" as "Pending Password Change",
    employeeId,
    createdAt: new Date().toISOString(),
    passwordHash: `${salt}:${tempPasswordHash}`
  };

  db.users.push(newUser);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Create User Account", `Created digital user: ${username} and employee ${employeeId}`);
  saveDB();
  
  // Dispatch Temporary Password via Email
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const info = await transporter.sendMail({
        from: '"IntegraSync Security" <' + process.env.SMTP_USER + '>',
        to: email,
        subject: 'IntegraSync - Your Temporary Password',
        text: `Hello ${fullName},\n\nAn account has been created for you on the IntegraSync System.\n\nUsername/Email: ${email}\nTemporary Password: ${tempPassword}\n\nFor security purposes, you will be required to change this password immediately upon your first login.\n\nThank you,\nIntegraSync Administrator`
      });
      console.log(`[Email Dispatch] Sent temporary password to ${email}. Response: ${info.response}`);
    } catch (error) {
      console.error(`[Email Dispatch] Failed to send email to ${email}:`, error);
    }
  } else {
    console.warn(`[Email Dispatch] SMTP credentials not configured in environment. Skipped sending email to ${email}`);
  }

  res.json({ status: "success", data: newUser });

});

app.put("/api/admin/users/:id", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator / Division Chief privileges" });
  }
  const { id } = req.params;
  const { fullName, email, role, username, status, employeeId } = req.body;
  
  const targetUser = db.users.find(u => u.id === id);
  if (!targetUser) {
    return res.status(404).json({ status: "error", message: "User account not found" });
  }

  if (fullName) targetUser.fullName = fullName;
  if (email) targetUser.email = email;
  if (role) targetUser.role = role;
  if (username) targetUser.username = username;
  if (employeeId) targetUser.employeeId = employeeId;
  if (status) {
    targetUser.status = (status === "Deactivated") ? "Archived" : status;
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Modify User Account", `Modified user details for: ${targetUser.username} (${status || targetUser.status})`);
  saveDB();
  res.json({ status: "success", data: targetUser });
});

app.post("/api/admin/employees/:id/reset-password", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator privileges" });
  }
  const { id } = req.params;
  const targetEmployee = db.employees.find((e: any) => e.id === id);
  if (!targetEmployee) {
    return res.status(404).json({ status: "error", message: "Employee not found" });
  }

  // Find the associated user account
  const targetUser = db.users.find((u: any) => u.employeeId === targetEmployee.id || u.employeeId === targetEmployee.employeeId);
  if (!targetUser) {
    return res.status(404).json({ status: "error", message: "No user account linked to this employee" });
  }

  // Hash "password123"
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync("password123", salt, 1000, 64, 'sha512').toString('hex');
  targetUser.passwordHash = `${salt}:${hash}`;
  targetUser.requirePasswordChange = true;

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Reset User Password", `Reset password for employee: ${targetEmployee.fullName} (${targetUser.username}) to temporary default`);
  saveDB();
  res.json({ status: "success", message: "Password reset successfully for employee's account" });
});

app.post("/api/admin/users/:id/reset-password", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator privileges" });
  }
  const { id } = req.params;
  const targetUser = db.users.find((u: any) => u.id === id);
  if (!targetUser) {
    return res.status(404).json({ status: "error", message: "User not found" });
  }

  // Hash "password123"
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync("password123", salt, 1000, 64, 'sha512').toString('hex');
  targetUser.passwordHash = `${salt}:${hash}`;
  targetUser.requirePasswordChange = true;

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Reset User Password", `Reset password for user: ${targetUser.username} to temporary default`);
  saveDB();
  res.json({ status: "success", message: "Password reset successfully" });
});


app.post("/api/admin/users/:id/archive", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator privileges" });
  }
  const { id } = req.params;
  const targetUser = db.users.find(u => u.id === id);
  if (!targetUser) return res.status(404).json({ status: "error", message: "User not found" });
  if (targetUser.username === "admin" || targetUser.id === (req as any).user.id) {
    return res.status(400).json({ status: "error", message: "Cannot archive the seed superuser or your own account" });
  }


  targetUser.status = "Archived";
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Archived", `Archived user account: ${targetUser.username}`);
  saveDB();
  res.json({ status: "success", message: "User account archived" });
});

app.post("/api/admin/users/:id/restore", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator privileges" });
  }
  const { id } = req.params;
  const targetUser = db.users.find(u => u.id === id);
  if (!targetUser) return res.status(404).json({ status: "error", message: "User not found" });

  targetUser.status = "Active";
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Restored", `Restored user account: ${targetUser.username}`);
  saveDB();
  res.json({ status: "success", message: "User account restored" });
});

app.delete("/api/admin/users/:id", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator / Division Chief privileges" });
  }
  const { id } = req.params;
  const index = db.users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ status: "error", message: "User not found" });
  }
  if (db.users[index].username === "admin" || db.users[index].id === (req as any).user.id) {
    return res.status(400).json({ status: "error", message: "Cannot remove seed superuser or your own active credential" });
  }
  const removed = db.users.splice(index, 1);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Delete User Account", `Removed user: ${removed[0].username}`);
  saveDB();
  res.json({ status: "success", message: "User account deleted successfully" });
});


// B. PERSONNEL TWO-STAGE ENDORSEMENT FLOW
app.put("/api/requests/:id/hr-endorse", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Requires HR Officer review authorities" });
  }
  const { id } = req.params;
  const { endorse, remarks } = req.body; // endorse: boolean

  const request = db.requests.find(r => r.id === id);
  if (!request) return res.status(404).json({ status: "error", message: "Personnel Request not found" });
  // Only a request waiting for HR, as HR's screen offers it: endorsing a decided one would reopen it.
  if (String(request.status) !== RequestStatus.PENDING_HR_REVIEW && String(request.status) !== "Pending") {
    return res.status(409).json({ status: "error", message: `This request is ${request.status}, so HR can't act on it now.` });
  }

  if (endorse) {
    request.status = RequestStatus.ENDORSED_TO_CHIEF;
    request.remarks = remarks || "Endorsed under HR review benchmarks.";
  } else {
    request.status = RequestStatus.RETURNED_BY_HR;
    request.remarks = remarks || "Returned with HR verification queries.";
  }
  
  const requestNotice = {
    title: endorse ? "Request Endorsed" : "Request Returned to Employee",
    message: endorse
      ? `HR Officer ${(req as any).user.fullName} endorsed ${request.requestType} for ${request.employeeName} to Division Chief.`
      : `HR Officer ${(req as any).user.fullName} returned ${request.requestType} with remarks: "${remarks}".`,
    type: (endorse ? "success" : "warning") as Notification["type"]
  };
  if (endorse) {
    notify({ role: UserRole.SUPER_ADMIN }, { ...requestNotice, link: { tab: "requests", record: { kind: "request", id: request.id } } });
  } else {
    notify({ employee: request.employeeId }, { ...requestNotice, link: { tab: "employee_portal", record: { kind: "request", id: request.id } } });
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Endorse Personnel Request", `HR acted on request ${request.id}, status: ${request.status}`);
  // Acting on their own request is allowed, and flagged, as with reports (12q).
  if (isOwnRecord(req.user, request.employeeId)) flagSelfApproval(req.user, `${endorse ? "endorsed" : "returned"} their own ${request.requestType}`);
  saveDB();
  res.json({ status: "success", data: request });
});

app.put("/api/requests/:id/chief-decide", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator / Division Chief final authority" });
  }
  const { id } = req.params;
  const { decision, remarks } = req.body; // decision: "Approved" | "Rejected" | "Returned"

  const request = db.requests.find(r => r.id === id);
  if (!request) return res.status(404).json({ status: "error", message: "Personnel Request not found" });
  // Only a request waiting for a decision, as Request Management offers it. Deciding a decided one
  // again re-ran a supply's stock deduction, and could revive a rejected vehicle request next to the
  // one filed after it. Anything but the three decisions used to count as a rejection.
  if (!/Pending|Endorsed/.test(String(request.status))) {
    return res.status(409).json({ status: "error", message: `This request is ${request.status}, so it can't be decided now.` });
  }
  if (decision !== "Approved" && decision !== "Rejected" && decision !== "Returned") {
    return res.status(400).json({ status: "error", message: 'Choose a decision: "Approved", "Rejected" or "Returned".' });
  }

  if (decision === "Approved") {
    request.status = RequestStatus.APPROVED;
    request.approvedBy = (req as any).user.fullName;
    request.remarks = remarks || "Approved and finalized by Division Chief.";

    // If Supply request, deduct inventory
    if (request.requestType === RequestType.SUPPLY) {
      const supplyReq = request as any;
      const supply = db.supplyItems.find(s => s.id === supplyReq.supplyId || s.name === supplyReq.supplyName);
      if (supply) {
        if (supply.availableQuantity >= supplyReq.quantity) {
          supply.availableQuantity -= supplyReq.quantity;
          db.supplyIssuances.push({
            id: `si-${Date.now()}`,
            supplyId: supply.id,
            supplyName: supply.name,
            issuedToId: supplyReq.employeeId,
            issuedToName: supplyReq.employeeName,
            quantity: supplyReq.quantity,
            dateIssued: new Date().toISOString().split("T")[0]
          });
        } else {
          request.status = RequestStatus.REJECTED;
          request.remarks = "Disapproved: Supply requested quantity exceeds currently available warehouse balance.";
        }
      }
    }
  } else if (decision === "Returned") {
    request.status = RequestStatus.RETURNED_BY_CHIEF;
    request.remarks = remarks || "Returned for corrections by Division Chief.";
  } else {
    request.status = RequestStatus.REJECTED;
    request.remarks = remarks || "Rejected by Division Chief.";
  }

  notify({ employee: request.employeeId }, {
    title: `Request ${request.status}`,
    // Whoever holds the role and decided it, not a fixed name.
    message: `The Division Chief, ${(req as any).user.fullName}, acted on your ${request.requestType}: ${request.status}`,
    type: request.status === RequestStatus.APPROVED ? "success" : "warning",
    link: { tab: "employee_portal", record: { kind: "request", id: request.id } }
  });

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Final Chief Decision", `Chief decided ${request.id}, status: ${request.status}`);
  // Deciding their own request is allowed, and flagged, as with reports (12q).
  if (isOwnRecord(req.user, request.employeeId)) flagSelfApproval(req.user, `decided their own ${request.requestType}: ${request.status}`);
  saveDB();
  res.json({ status: "success", data: request });
});


// C. ASSIGNED ACTIVITIES APIs
// Officers no longer create general activities: the Activities & Assignments page and
// POST /api/activities were removed on 2026-10-22 (outside the thesis scope; none had ever been
// made). This route stays because it is what lists an employee's seminars, with their cash
// advance and DV, under My Assigned Activities. Activities stored before (none live) still list.
app.get("/api/activities", authenticateToken, (req: any, res) => {
  const { role, employeeId } = req.user;
  
  if (role === UserRole.EMPLOYEE) {
    const empRecord = db.employees.find((e) => e.employeeId === employeeId);
    const altId = empRecord ? empRecord.id : null;
    const list = db.activities.filter((a) => a.assignedEmployeeId === employeeId || a.assignedEmployeeId === altId);
    
    // Inject assigned training programs. An enrolment archived with an unused seminar (or left off
    // when it was restored) is gone from the employee's list, as a deleted seminar's was; a
    // finished seminar stays as history.
    const trainings = db.trainingParticipants.filter((p) =>
      (p.employeeId === altId || p.employeeId === employeeId) && p.status !== "Archived" && p.status !== "Cancelled");
    for (const t of trainings) {
      const prog = db.trainingPrograms.find((p) => p.id === t.trainingProgramId);
      if (prog) {
        list.push({
          id: t.id,
          activityNo: `TRN-2026-${prog.id.replace('tp-','')}`,
          title: `Seminar/Training: ${prog.title}`,
          // The plan the seminar belongs to. HR no longer writes seminar descriptions (the
          // Description column was removed on 2026-10-23), so the card names the plan instead of
          // "Assigned training program".
          description: `FY ${prog.fiscalYear} Training and Development Plan`,
          dateScheduled: prog.startDate,
          endDate: prog.endDate,
          // For "Also request a vehicle" on the cash advance: the trip is prefilled from these (and
          // the seminar's dates), and has to fit those dates.
          seminarTitle: String(prog.title || "").trim(),
          venue: prog.venue || "",
          // The vehicle request standing for this seminar (not rejected), theirs or their group's: no
          // second one is offered.
          vehicleOnFile: (() => {
            const v = vehicleRequestFor(t.id);
            return v ? { vrsNo: v.vrsNo, status: v.status } : null;
          })(),
          liquidationDueDate: liquidationDueDateFor(prog),
          participantStatus: t.status,
          // Attendance and whether the liquidation form is open (see seminarFormEligibility).
          attendance: t.attendance || null,
          ...(() => {
            const e = seminarFormEligibility(t);
            return { canLiquidate: e.canLiquidate, liquidationBlockedReason: e.reason || null };
          })(),
          // Whether they may ask Finance for their cash advance (advanceRequestEligibility).
          ...(() => {
            const r = advanceRequestEligibility(t);
            return { canRequestAdvance: r.canRequest, advanceBlockedReason: r.reason || null };
          })(),
          // For the holder of a group's released advance: everyone it covers and their attendance,
          // for the group's one report (whose lines may name the attendee they were for).
          groupMembers: (() => {
            const held = advanceCovering(db.cashAdvances || [], t.id, ["Released"]);
            if (!held || !isGroupAdvance(held) || held.activityId !== t.id) return null;
            return held.covers!.map(c => ({
              participantId: c.participantId,
              employeeName: c.employeeName,
              attendance: (db.trainingParticipants || []).find((x: any) => x && x.id === c.participantId)?.attendance || null
            }));
          })(),
          // The report a co-participant filed on the group advance covering them: its number and
          // status only (the holder's report, its items and files are the holder's).
          groupReport: (() => {
            const s = reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], t.id);
            return s && s.activityId !== t.id ? { submissionNo: s.submissionNo, status: s.status, filedBy: s.employeeName } : null;
          })(),
          allottedBudget: t.allowanceAllocated || 0,
          budgetId: "training-budget",
          assignedEmployeeId: employeeId,
          type: "training"
        });
      }
    }
    
    return res.json({ status: "success", data: list });
  }
  
  res.json({ status: "success", data: db.activities });
});


// D. THREE-STAGED EXHAUSTIVE LIQUIDATION SUBMISSIONS APIs
// Each seminar report goes out with its seminar's fiscal year, so Finance counts it in the year HR
// planned it: a year can open before its calendar year does (FY 2027 opened in October 2026).
// Added to the copy sent, never stored. A general activity has none; its report counts in the
// year it was filed (src/components/finance/overviewFigures.ts).
function withSeminarFiscalYear(list: LiquidationSubmission[]): LiquidationSubmissionView[] {
  const programYear = new Map((db.trainingPrograms || []).map((p: any) => [p.id, p.fiscalYear]));
  const enrolmentYear = new Map((db.trainingParticipants || []).map((p: any) => [p.id, programYear.get(p.trainingProgramId)]));
  return list.map(s => {
    const year = enrolmentYear.get(s.activityId);
    // A group's report (HSAC RAB 1): everyone its cash advance covers, for HR's and Finance's screens.
    const group = reportGroupAdvance(s);
    const covers = group ? group.covers!.map(c => ({ participantId: c.participantId, employeeId: c.employeeId, employeeName: c.employeeName })) : null;
    return { ...s, ...(year ? { fiscalYear: String(year) } : {}), ...(covers ? { covers } : {}) };
  });
}

app.get("/api/liquidation-submissions", authenticateToken, (req: any, res) => {
  const { role, employeeId } = req.user;
  if (role === UserRole.EMPLOYEE) {
    const list = db.liquidationSubmissions.filter(l => l.employeeId === employeeId);
    return res.json({ status: "success", data: withSeminarFiscalYear(list) });
  }
  res.json({ status: "success", data: withSeminarFiscalYear(db.liquidationSubmissions) });
});

// The Documents Vault (Financial Tracking → Documents Vault): every file attached to a liquidation
// report, in one place, for Finance and the Administrator (the roles that see Financial Tracking).
// The list carries no file contents; a file is sent only when someone downloads it, and each
// download is recorded in the audit log, since these are employees' receipts and certificates.
// (The same files also reach every officer through GET /api/liquidation-submissions, unlogged: 12e.)
// Neither answer may be kept in the browser's cache.
function canUseDocumentsVault(user: any): boolean {
  return user?.role === UserRole.FINANCE_OFFICER || user?.role === UserRole.SUPER_ADMIN;
}

app.get("/api/liquidation-documents", authenticateToken, (req: any, res: any) => {
  if (!canUseDocumentsVault(req.user)) {
    return res.status(403).json({ status: "error", message: "The Documents Vault is for Finance and the Administrator." });
  }
  res.set("Cache-Control", "no-store");
  res.json({ status: "success", data: liquidationDocumentRows(withSeminarFiscalYear(db.liquidationSubmissions || [])) });
});

app.get("/api/liquidation-submissions/:id/documents/:docId", authenticateToken, (req: any, res: any) => {
  if (!canUseDocumentsVault(req.user)) {
    return res.status(403).json({ status: "error", message: "The Documents Vault is for Finance and the Administrator." });
  }
  // Express answers HEAD with this handler too, which would log a download that sent nothing
  // (and rewrite the whole database for it).
  if (req.method !== "GET") return res.status(405).set("Allow", "GET").json({ status: "error", message: "Use GET." });
  res.set("Cache-Control", "no-store");
  // Ids are compared as text, as the list sends them (liquidationDocumentRows).
  const sub = (db.liquidationSubmissions || []).find((s: any) => s && String(s.id) === req.params.id);
  const doc = sub ? (Array.isArray(sub.supportingDocs) ? sub.supportingDocs : []).find((d: any) => d && String(d.id) === req.params.docId) : null;
  if (!sub || !doc) return res.status(404).json({ status: "error", message: "That file was not found." });
  // The name the list shows (cleaned of invisible and right-to-left characters), so the file saves
  // under it too.
  const name = cleanFileName(String(doc.name || doc.filename || "")) || "file";
  // Only a real uploaded file (a base64 data URL) is ever sent, never other stored text (7f).
  const content = String(doc.content || "");
  if (!SAFE_FILE_URL.test(content)) {
    return res.status(404).json({ status: "error", message: `"${name}" has no uploaded file that can be opened.` });
  }
  // The employee chose the file's name, so the log quotes it cleaned (above), shortened and
  // escaped, with the file's id: a crafted name can't pass for a second file or another report
  // in the same entry.
  logEvent(req.user.id, req.user.username, req.user.role, "Open Liquidation Document",
    `Opened ${JSON.stringify(name.slice(0, 120))} (file ${doc.id}) from ${sub.submissionNo} (${sub.employeeName || sub.employeeId}).`);
  res.json({ status: "success", data: { name, type: doc.type || "", content } });
});

// A liquidation's `activityId` may reference either a TDP enrolment or a general
// activity. Whichever it resolves to must belong to the caller: without this an employee
// could file against someone else's assignment, and Finance validation (see
// /finance-action) would then flip that person's record to "Liquidated" and charge their
// programme's budget. Returns null when the id matches neither collection, so an
// unrecognised reference keeps its previous behaviour rather than breaking a flow.
function liquidationActivityOwnedByUser(activityId: string, user: any): boolean | null {
  const participant = (db.trainingParticipants || []).find((p: any) => p.id === activityId);
  if (participant) {
    return employeeIdForms(participant.employeeId).includes(user.employeeId);
  }

  const activity = (db.activities || []).find((a: any) => a.id === activityId);
  if (activity) {
    // Activity.assignedEmployeeId holds an employee id OR a full name (src/types.ts),
    // so accept either form rather than rejecting a legitimately assigned employee.
    const assigned = String(activity.assignedEmployeeId || "").trim();
    if (!assigned) return null;
    return employeeIdForms(assigned).includes(user.employeeId)
      || assigned.toLowerCase() === String(user.fullName || "").trim().toLowerCase();
  }

  return null;
}

// --- COA Liquidation Report support ---

// Constant header values for RAB 1. Kept here rather than typed per submission.
const LR_ENTITY_NAME = "HSAC-RAB I";
const LR_FUND_CLUSTER = "01 - Regular Fund";
// TODO(HSAC): confirm what "101" denotes on the printed serial — office code or
// responsibility centre. Isolated here so it is one edit when we find out.
const LR_SERIAL_PREFIX = "LR-101";

// PHP: round at the boundary so ledger totals never drift.
function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// A line's amount, read strictly: pesos with at most two decimals, from 0 up to a billion (so
// no total can overflow into Infinity). Blank is 0. Text, a third decimal or a negative is
// not an amount, rather than being rounded or read as 0.
function lineAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "number" ? value
    : typeof value === "string" && /^\s*\d+(\.\d+)?\s*$/.test(value) ? Number(value)
    : NaN;
  if (!isFinite(n) || n < 0 || n > 1e9) return null;
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? round2(n) : null;
}

// Normalises the PARTICULARS block. Returns null when the payload carries no usable
// lines, so an older client sending only `totalSpent` keeps working unchanged.
function normalizeParticulars(raw: any): { particulars: any[]; total: number; error?: string } | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const particulars: any[] = [];
  // Each line keeps its id, so a reviewer can reopen it alone, unless that id is missing or
  // already taken; then it gets a new one, and a tick never reaches two lines.
  const usedIds = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i] || {};
    const description = String(p.description || "").trim();
    const amount = lineAmount(p.amount);
    if (!description && amount === 0) continue; // blank row the user never filled in
    if (!description) {
      return { particulars: [], total: 0, error: `Particular ${i + 1} needs a description.` };
    }
    if (amount === null) {
      return { particulars: [], total: 0, error: `"${description}" needs an amount in pesos of zero or more, with at most two decimals.` };
    }
    // An unrecognised or missing bucket falls back rather than failing the whole
    // report — the claimant's money is not held up by a bad dropdown value.
    const category: TrainingExpenseCategory =
      TRAINING_EXPENSE_CATEGORIES.includes(p.category) ? p.category : "Miscellaneous";
    const sentId = typeof p.id === "string" || typeof p.id === "number" ? String(p.id) : "";
    const id = sentId && !usedIds.has(sentId) ? sentId : `lp-${crypto.randomUUID()}`;
    usedIds.add(id);
    // On a group's report, the attendee the line was for (optional; checked by groupLinesProblem).
    const participantId = typeof p.participantId === "string" && p.participantId.trim() ? p.participantId.trim() : "";
    particulars.push({ id, description, amount, category, ...(participantId ? { participantId } : {}) });
  }
  if (particulars.length === 0) return null;
  // Added up in whole centavos (src/liquidationMoney.ts), so the total never drifts.
  return { particulars, total: sumPesos(particulars.map(p => p.amount)) };
}

// A group's report may say whom each line was for (the user's decision, 2026-10-26: optional): one
// of the attendees its cash advance covers. Lines of any other report name nobody, so a name sent
// for one is dropped. The problem, or null.
function groupLinesProblem(lines: any[] | null | undefined, advance: CashAdvance | null): string | null {
  const group = advance && isGroupAdvance(advance) ? advance : null;
  for (const line of lines ?? []) {
    if (!line || !line.participantId) continue;
    if (!group) { delete line.participantId; continue; }
    const cover = group.covers!.find(c => c.participantId === line.participantId);
    const enrolment = cover ? (db.trainingParticipants || []).find((p: any) => p && p.id === cover.participantId) : null;
    if (!cover || !enrolment) return `"${line.description}" is marked for someone your group's cash advance doesn't cover.`;
    if (enrolment.attendance !== "Attended") return `"${line.description}" is marked for ${cover.employeeName}, who didn't attend: only attendees' spending is liquidated.`;
  }
  return null;
}

// The group advance a report settles, when it is a group's (its holder files it), else null.
function reportGroupAdvance(sub: any): CashAdvance | null {
  const a = sub ? advanceOnFileFor(sub) : null;
  return a && isGroupAdvance(a) && a.activityId === sub.activityId ? a : null;
}

// What a group's one report may spend, in pesos: the shares of those who attended (the holder's only
// if they did), or null for an individual advance (its whole amount; src/advanceCoverage.ts).
function groupSpendCap(a: CashAdvance | null): number | null {
  if (!a || !isGroupAdvance(a)) return null;
  return pesos(spendableCentavos(a, id => (db.trainingParticipants || []).find((p: any) => p && p.id === id)?.attendance === "Attended"));
}

// Whether a report's group advance covers the signed-in user (not as its holder, the claimant).
function reportCoversUser(sub: any, user: any): boolean {
  const group = reportGroupAdvance(sub);
  return !!group && !isOwnRecord(user, sub.employeeId) && group.covers!.some(c => coverIsUser(user, c));
}

// What HR actually set aside for this assignment, plus a human label. Read from the
// office's own records at filing time, never from the request body, so Finance can
// compare it against what the claimant says they received — without being handed access
// to the HR training tables. Returns null when the id resolves to nothing, so the caller
// can leave the figure unset rather than assert a false zero.
function liquidationActivityFacts(activityId: string): { allocated: number; title: string } | null {
  const participant = (db.trainingParticipants || []).find((p: any) => p.id === activityId);
  if (participant) {
    const prog = (db.trainingPrograms || []).find((tp: any) => tp.id === participant.trainingProgramId);
    const name = String(prog?.title || "").trim();
    return {
      allocated: round2(Number(participant.allowanceAllocated || 0)),
      title: name ? `Seminar - ${name}` : "Seminar"
    };
  }

  const activity = (db.activities || []).find((a: any) => a.id === activityId);
  if (activity) {
    return {
      allocated: round2(Number(activity.allottedBudget || 0)),
      title: [activity.activityNo, activity.title].filter(Boolean).join(" - ") || "Activity"
    };
  }

  return null;
}

// Serial number for the printed report, e.g. "LR-101-2026-09-024". Numbering restarts
// each month, following the sample form.
function nextLiquidationSerialNo(when: Date): string {
  const scope = `${LR_SERIAL_PREFIX}-${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-`;
  const used = (db.liquidationSubmissions || [])
    .map((s: any) => String(s.serialNo || ""))
    .filter((s: string) => s.startsWith(scope))
    .map((s: string) => Number(s.slice(scope.length)) || 0);
  return `${scope}${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, "0")}`;
}

// Report number, e.g. "LIQSUB-2026-03": one past the highest number in use, not the count
// of reports — once a report is deleted, a count hands out a number that is still taken.
// The format is exactly the one the count produced.
function nextLiquidationSubmissionNo(): string {
  const prefix = "LIQSUB-2026-";
  const used = (db.liquidationSubmissions || [])
    .map((s: any) => String(s.submissionNo || ""))
    .filter((s: string) => s.startsWith(prefix))
    .map((s: string) => Number(s.slice(prefix.length)) || 0);
  return `${prefix}0${(used.length ? Math.max(...used) : 0) + 1}`;
}

// Claim type (instructor's note 10): one form, but the claimant says which kind of claim
// it is, and filing and correcting both hold them to it.
// - A Liquidation settles a cash advance, so it needs one: Finance's record or, for an
//   advance released before Finance recorded them, a typed DV number and an amount.
// - A Reimbursement claims back money paid out of pocket, so there is no advance at all.
const CHOOSE_CLAIM_TYPE_MESSAGE =
  'Choose the claim type: "Liquidation" if you are settling a cash advance, or "Reimbursement" if you paid out of your own pocket.';
const ADVANCE_AMOUNT_MESSAGE = "Enter the amount of the cash advance you received, in pesos.";
const NOTHING_TO_REIMBURSE_MESSAGE = "A Reimbursement claims back what you spent, so enter at least one amount above zero.";

function isClaimType(value: unknown): value is ClaimType {
  return CLAIM_TYPES.includes(value as ClaimType);
}

// A peso amount from a request: a finite number, or a plain numeric string, from 0 up to
// a billion, rounded to centavos. Anything else (true, [5], "0x10", "") is not an amount.
function parsePeso(value: unknown): number | null {
  if (typeof value === "number") return isFinite(value) && value >= 0 && value <= 1e9 ? round2(value) : null;
  if (typeof value === "string" && /^\d{1,10}(\.\d{1,2})?$/.test(value.trim())) {
    const n = Number(value.trim());
    return n <= 1e9 ? round2(n) : null;
  }
  return null;
}

// The DV and OR references typed on the form: text, and dates as YYYY-MM-DD or blank.
function coaReferenceProblem(body: any): string | null {
  for (const k of ["cashAdvanceDvNo", "refundOrNo"]) {
    if (body?.[k] !== undefined && body?.[k] !== null && typeof body[k] !== "string") return "Enter the DV and OR numbers as text.";
  }
  for (const k of ["cashAdvanceDvDate", "refundOrDate"]) {
    if (body?.[k] !== undefined && body?.[k] !== null && body[k] !== "" && !isCalendarDate(body[k])) return "Enter the DV and OR dates as YYYY-MM-DD.";
  }
  return null;
}

// The 400 message, naming the type to choose, or null when the choice fits the advance.
function claimTypeProblem(
  claimType: ClaimType,
  advance: CashAdvance | null,
  typed: { released: number; dvNo: string }
): string | null {
  if (claimType === "Reimbursement") {
    if (advance) {
      return `Finance released a cash advance of PHP ${round2(Number(advance.amount)).toFixed(2)} for this assignment (${advance.advanceNo}, DV ${advance.dvNo}), so this report settles it. Choose "Liquidation".`;
    }
    if (typed.released > 0) {
      return `A Reimbursement has no cash advance, but PHP ${typed.released.toFixed(2)} was entered as received. If you received an advance, choose "Liquidation" and enter its DV number.`;
    }
    return null;
  }
  if (advance || (typed.released > 0 && typed.dvNo)) return null;
  // An amount without its voucher is a Liquidation missing a detail, not a Reimbursement.
  if (typed.released > 0) return "Enter the DV number of the cash advance you received.";
  return 'No cash advance is on record for this assignment. If you paid out of your own pocket, choose "Reimbursement". If you did receive an advance, enter its DV number and amount.';
}

// A Released advance that pays for an assignment: its own, or a group advance covering the
// enrolment (src/advanceCoverage.ts). An assignment belongs to one person (one report each), so
// it is matched by assignment alone; that also finds the assignee's advance when the
// Administrator files on their behalf.
function releasedAdvanceForAssignment(activityId: string): CashAdvance | null {
  return advanceCovering(db.cashAdvances || [], activityId, ["Released"]);
}

// No new cash advance while the employee still has another one out (COA Circular No. 97-002,
// sec. 4.1.2; the user's decision, 2026-10-23). An advance is out while it is "Released": it
// settles when Finance validates its report ("Liquidated") or records its refund ("Refunded").
// It matters since an employee may join several seminars a year (12s); before, one seminar a
// year made two advances at once rare. Advances store the staff code, so both id forms match.
function openAdvanceElsewhere(employeeId: string, activityId: string): CashAdvance | null {
  const forms = employeeIdForms(employeeId);
  return (db.cashAdvances || []).find((a: any) =>
    a && a.status === "Released" && a.activityId !== activityId && forms.includes(a.employeeId)) || null;
}

function openAdvanceText(a: CashAdvance): string {
  return `${a.advanceNo} (DV ${a.dvNo}) for "${a.activityTitle || "another assignment"}"`;
}

// The cash advance Finance has on file for a report: the one it is linked to, whatever its
// status (a settled advance is still the record), the one it settled, or one released for
// the same assignment since. Only money actually paid out counts: a cancelled advance was
// never money in hand, a refunded one was given back in full, and a request (pending or
// declined) is not money at all.
function advanceOnFileFor(sub: any): CashAdvance | null {
  const advances = (db.cashAdvances || []).filter((a: any) => a && (a.status === "Released" || a.status === "Liquidated"));
  return advances.find((a: any) => sub.cashAdvanceId && a.id === sub.cashAdvanceId)
    || advances.find((a: any) => a.liquidationId === sub.id)
    || releasedAdvanceForAssignment(sub.activityId)
    || null;
}

// Returning a report (requirement 5, the instructor's note 11): the reviewer sends remarks
// and a checklist of what is wrong, and only those parts reopen for the claimant. This
// checks the checklist against the report and builds the request to keep, or says why not.
const CORRECTABLE_FIELDS: CorrectionField[] = CORRECTION_FIELDS.map(c => c.field);

function correctionRequestFrom(
  body: any,
  sub: any,
  reviewer: any,
  returnTo: CorrectionRequest["returnTo"]
): { request: CorrectionRequest } | { error: string } {
  const remarks = typeof body?.remarks === "string" ? body.remarks.trim() : "";
  if (!remarks) return { error: "Explain why the report is returned: remarks are required." };
  if (remarks.length > 1000) return { error: "Keep the remarks under 1,000 characters." };
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return { error: "Tick at least one part of the report for the employee to correct." };
  }
  const lineIds = new Set((sub.particulars || []).map((p: any) => p.id));
  const fileIds = new Set((Array.isArray(sub.supportingDocs) ? sub.supportingDocs : [])
    .filter((d: any) => d && !d.supersededAt).map((d: any) => d.id));
  const storedType: ClaimType = isClaimType(sub.claimType) ? sub.claimType
    : (Number(sub.totalReleased) > 0 ? "Liquidation" : "Reimbursement");
  const advance = advanceOnFileFor(sub);
  const seen = new Set<CorrectionField>();
  const items: CorrectionItem[] = [];
  for (const raw of body.items) {
    const field = raw?.field;
    if (!CORRECTABLE_FIELDS.includes(field)) {
      return { error: "Only the parts on the checklist can be returned; the activity and the employee's name can't be changed." };
    }
    if (seen.has(field)) return { error: "Tick each part of the report only once." };
    seen.add(field);
    const remark = typeof raw.remark === "string" ? raw.remark.trim() : "";
    if (remark.length > 500) return { error: "Keep each note under 500 characters." };
    const item: CorrectionItem = { field };
    if (remark) item.remark = remark;
    if (field === "particulars" && raw.lineIds !== undefined) {
      if (!Array.isArray(raw.lineIds) || raw.lineIds.some((id: any) => !lineIds.has(id))) {
        return { error: "Choose particulars that are on the report." };
      }
      if (raw.lineIds.length > 0) item.lineIds = [...new Set<string>(raw.lineIds)];
    }
    if (field === "replaceDocuments") {
      if (!Array.isArray(raw.documentIds) || raw.documentIds.length === 0 || raw.documentIds.some((id: any) => !fileIds.has(id))) {
        return { error: "Choose which attached files the employee must replace." };
      }
      item.documentIds = [...new Set<string>(raw.documentIds)];
    }
    if (field === "cashAdvance" && advance) {
      return { error: "The cash advance is taken from Finance's record, so it can't be returned for correction." };
    }
    if (field === "cashAdvance" && storedType === "Reimbursement") {
      return { error: 'A Reimbursement has no cash advance to correct. If the employee did receive one, tick "Claim type" instead.' };
    }
    if (field === "refundOr" && storedType === "Reimbursement") {
      return { error: "A Reimbursement has no refund to correct." };
    }
    if (field === "claimType" && sub.withinAdvance) {
      return { error: "A seminar report always settles its cash advance, so its claim type can't be returned for correction." };
    }
    if (field === "claimType" && sub.withinAllowance) {
      return { error: "A seminar the employee paid for themselves is always a Reimbursement, so its claim type can't be returned for correction." };
    }
    items.push(item);
  }
  // A Return the employee couldn't answer would leave the report stuck as "Returned" (no one
  // can act on it then), so what resubmitting checks on the parts left as filed must hold.
  const claimCanChange = seen.has("claimType") || (seen.has("cashAdvance") && !advance);
  if (!claimCanChange && claimTypeProblem(storedType, advance, {
    released: storedType === "Reimbursement" ? 0 : round2(Number(sub.totalReleased || 0)),
    dvNo: String(sub.cashAdvanceDvNo || "").trim()
  })) {
    return { error: 'The claim type and the cash advance on this report don\'t agree, and the employee can only fix that if they reopen. Tick "Claim type" as well.' };
  }
  // (The claim type alone doesn't reopen what was spent, so the particulars must reopen.)
  if (storedType === "Reimbursement" && !(Number(sub.totalSpent) > 0) && !seen.has("particulars")) {
    return { error: 'This Reimbursement claims nothing spent, and the employee can only fix that if the particulars reopen. Tick "Particulars" as well.' };
  }
  items.sort((a, b) => CORRECTABLE_FIELDS.indexOf(a.field) - CORRECTABLE_FIELDS.indexOf(b.field));
  return {
    request: {
      id: `corr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      round: (sub.corrections?.length ?? 0) + 1,
      items,
      remarks,
      requestedBy: reviewer.fullName,
      requestedByRole: reviewer.role,
      requestedAt: new Date().toISOString(),
      returnTo
    }
  };
}

// Tells the claimant their report came back, linking straight to it in correction mode.
// Addressed to their staff record's code, as the login carries it; never untargeted, which
// every employee would see. The id is random: the reviewer's remarks are in the notice.
function notifyReportReturned(sub: any, by: "HR" | "Finance", request: CorrectionRequest) {
  if (!sub.employeeId) return;
  notify({ employee: sub.employeeId }, {
    title: `Liquidation report returned by ${by}`,
    message: `${sub.submissionNo} was returned for correction: ${request.remarks} Only the parts ticked (${request.items.length}) can be changed.`,
    type: "warning",
    link: { tab: "employee_portal", liquidationReportId: sub.id }
  });
}

// Why a report no longer agrees with the advance on file (validating or paying it would
// pay twice), or null when it does.
function advanceMismatch(sub: any): string | null {
  const advance = advanceOnFileFor(sub);
  if (!advance) return null;
  if (sub.claimType === "Reimbursement") {
    return `${sub.submissionNo} is a Reimbursement, but cash advance ${advance.advanceNo} (DV ${advance.dvNo}) was released for the same assignment, so it is a Liquidation.`;
  }
  // Linked either way round: older reports were settled with only the advance's liquidationId.
  const linked = advance.id === sub.cashAdvanceId || advance.liquidationId === sub.id;
  if (!linked || round2(Number(advance.amount)) !== round2(Number(sub.totalReleased))) {
    return `${sub.submissionNo} does not match cash advance ${advance.advanceNo} (DV ${advance.dvNo}, PHP ${round2(Number(advance.amount)).toFixed(2)}).`;
  }
  return null;
}

// --- The seminar budget flow (the user's spec, 2026-10-18; decisions of 2026-10-19) ---
// An attendee asks for their seminar's cash advance (their allowance), Finance releases it,
// and their liquidation report settles it: its items may never come to more than the advance,
// and what is left is handed back with an OR. When Finance validates the report, that leftover
// returns to the training budget (fundReturn), once.

// What the employee's report has to show about its money, at filing and on correction: the
// advance Finance released, items within it, and an OR for a leftover (dated from the advance's
// DV up to today, and not already on another report or refund). The refusal, or null when the
// report may go on. `reportId`: the report being corrected, whose own OR doesn't count as used.
function withinAdvanceProblem(
  activityId: string,
  advance: CashAdvance | null,
  spent: number,
  refund: { orNo: string; orDate: unknown },
  reportId?: string
): { code: number; message: string } | null {
  if (!advance) {
    const asked = currentAdvanceFor(activityId);
    return {
      code: 409,
      message: asked?.status === "Requested"
        ? "Your cash advance request is still with Finance. File the report once it is released. If you paid for the seminar yourself, ask Finance to decline the request; you can then claim it back as a reimbursement."
        : asked?.status === "Declined"
          ? `Finance declined your cash advance request${asked.declineReason ? ` (${asked.declineReason})` : ""}. Ask for it again under My Assigned Activities.`
          : "Request your cash advance first, under My Assigned Activities. A seminar report settles the advance Finance releases, and its items can't go past it."
    };
  }
  const balance = liquidationBalance(advance.amount, spent);
  if (balance.status === "Over") {
    return {
      code: 400,
      message: `Your items come to ${pesoText(spent)}, ${pesoText(balance.over)} more than your ${pesoText(advance.amount)} cash advance (${advance.advanceNo}). A seminar report can't go past its advance: lower or remove an item.`
    };
  }
  // A group's: only the shares of those who attended can be spent; an absent member's comes back.
  const cap = groupSpendCap(advance);
  if (cap !== null && centavos(spent) > centavos(cap)) {
    return {
      code: 400,
      message: `Your group's items come to ${pesoText(spent)}, but only the shares of those who attended (${pesoText(cap)}) can be spent: an absent member's share is handed back with the rest. Lower or remove an item.`
    };
  }
  if (balance.leftover > 0) {
    if (!refund.orNo || refund.orNo.length > 50) {
      return { code: 400, message: `${pesoText(balance.leftover)} of your cash advance is left. Hand it back to the cashier and enter the official receipt (OR) number, up to 50 characters.` };
    }
    const usedOn = orNumberInUse(refund.orNo, reportId);
    if (usedOn) {
      return { code: 400, message: `OR ${refund.orNo} is already recorded on ${usedOn}. Each official receipt is used once: check the number on yours.` };
    }
    if (!isCalendarDate(refund.orDate) || refund.orDate > manilaToday()) {
      return { code: 400, message: "Enter the date on the OR as YYYY-MM-DD, no later than today." };
    }
    // Money can't come back before it went out.
    if (isCalendarDate(advance.dvDate) && refund.orDate < advance.dvDate) {
      return { code: 400, message: `The OR date can't be before the advance was released (DV dated ${advance.dvDate}).` };
    }
  }
  return null;
}

// "balanced" or "PHP 500.00 to hand back (OR 123)", for audit entries and notices.
function balanceText(released: number, spent: number, orNo?: string): string {
  const { leftover } = liquidationBalance(released, spent);
  return leftover > 0 ? `${pesoText(leftover)} of the advance handed back${orNo ? ` (OR ${orNo})` : ""}` : "balanced, the advance fully used";
}

app.post("/api/liquidation-submissions", authenticateToken, transactional((req: any, res: any) => {
  const { employeeId, fullName } = req.user;
  const {
    activityId, totalReleased, totalSpent, remarks, supportingDocs, particulars,
    periodCoveredFrom, periodCoveredTo, responsibilityCenterCode,
    cashAdvanceDvNo, cashAdvanceDvDate, refundOrNo, refundOrDate, claimType
  } = req.body;
  if (!activityId) {
    return res.status(400).json({ status: "error", message: "Please choose the activity this report settles." });
  }
  if (invalidSupportingDocs(supportingDocs)) {
    return res.status(400).json({ status: "error", message: INVALID_DOCS_MESSAGE });
  }
  const fileOrHeaderProblem = (supportingDocs || []).map(documentProblem).find(Boolean) || reportHeaderProblem(req.body);
  if (fileOrHeaderProblem) {
    return res.status(400).json({ status: "error", message: fileOrHeaderProblem });
  }
  // What the report settles: a seminar enrolment or a general activity.
  const seminarEnrolment = (db.trainingParticipants || []).find((p: any) => p.id === activityId);
  if (!seminarEnrolment && !(db.activities || []).some((a: any) => a.id === activityId)) {
    return res.status(404).json({ status: "error", message: "That activity or seminar was not found." });
  }
  // One report per assignment per employee. A returned report is corrected through
  // /resubmit, and the employee's dropdown already hides an assignment that has a report;
  // this makes the server agree, so a stale or pre-filled form cannot file a second one
  // that Finance validation would then charge to the programme a second time.
  if (employeeId) {
    const forms = employeeIdForms(employeeId);
    const existing = (db.liquidationSubmissions || []).find(
      (l: any) => l.activityId === activityId && forms.includes(l.employeeId)
    );
    if (existing) {
      return res.status(400).json({
        status: "error",
        message: `You already filed ${existing.submissionNo} for this assignment. Open it under My Settlement Log Entries to check its status or correct it.`
      });
    }
  }
  // A seminar report settles the cash advance its attendee asked for and Finance released
  // (the seminar budget flow, 2026-10-19), so its claim type is Liquidation and nothing typed
  // for an advance counts. With no advance waiting or released for the seat, it claims back what
  // the attendee paid themselves instead: a Reimbursement within their share (HSAC RAB 1 allows
  // it, 2026-10-30; src/reimbursement.ts). Either way the seat decides, not the form. A general
  // activity's claimant still chooses.
  const seatAdvance = seminarEnrolment ? currentAdvanceFor(activityId) : null;
  const withinAllowance = !!seminarEnrolment && seminarClaimMode(seatAdvance?.status) === "reimbursement";
  const withinAdvance = !!seminarEnrolment && !withinAllowance;
  if (!seminarEnrolment && !isClaimType(claimType)) {
    return res.status(400).json({ status: "error", message: CHOOSE_CLAIM_TYPE_MESSAGE });
  }
  // The cash advance as typed. It may be left out (a Reimbursement has none, and Finance's
  // record supplies a recorded one); anything sent must still be an amount of zero or
  // more. Whether it fits the claim type is checked below, once the record is looked up.
  const releasedGiven = !seminarEnrolment && !(totalReleased === undefined || totalReleased === null || totalReleased === "");
  const typedReleased = releasedGiven ? parsePeso(totalReleased) : 0;
  if (typedReleased === null) {
    return res.status(400).json({ status: "error", message: ADVANCE_AMOUNT_MESSAGE });
  }
  const referenceProblem = coaReferenceProblem(req.body);
  if (referenceProblem) {
    return res.status(400).json({ status: "error", message: referenceProblem });
  }

  const lines = normalizeParticulars(particulars);
  if (lines && lines.error) {
    return res.status(400).json({ status: "error", message: lines.error });
  }
  // Without particulars a single typed total is accepted, read strictly, except on a seminar
  // report, which lists its items.
  const typedSpent = lines || seminarEnrolment ? null : parsePeso(totalSpent);
  if (!lines && !(typedSpent !== null && typedSpent > 0)) {
    return res.status(400).json({ status: "error", message: "Add at least one particular describing what was spent." });
  }

  // A seminar enrolment is liquidated only by its own employee (no Administrator exception)
  // and only once HR has recorded that they attended. General activities keep their rule.
  if (seminarEnrolment) {
    if (!employeeId || !employeeIdForms(seminarEnrolment.employeeId).includes(employeeId)) {
      return res.status(403).json({ status: "error", message: "You can only liquidate a seminar you were enrolled in." });
    }
    // The same rule that opens the form: attended, and not cancelled or already
    // liquidated (an enrolment settled without a report must not be charged again).
    const eligibility = seminarFormEligibility(seminarEnrolment);
    if (!eligibility.canLiquidate) {
      return res.status(409).json({ status: "error", message: eligibility.reason });
    }
    // Money isn't paid out to someone who has left, as with a cash advance: a reimbursement is
    // claimed with an active staff record and login (a stale token can't file one, 7a).
    if (withinAllowance && !payeeIsActive(seminarEnrolment.employeeId)) {
      return res.status(409).json({ status: "error", message: "Your staff record is no longer active, so no reimbursement can be claimed here. Ask HR." });
    }
  } else if ((req as any).user.role !== UserRole.SUPER_ADMIN
      && liquidationActivityOwnedByUser(activityId, req.user) === false) {
    // Mirrors the ownership check in /resubmit.
    return res.status(403).json({ status: "error", message: "You can only liquidate your own assigned activity." });
  }
  // One report per assignment, whoever filed it (the claimant's own was caught above): a
  // cash advance is matched to its assignment, so a second report would draw on it too.
  const filedByOther = reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], activityId);
  if (filedByOther) {
    return res.status(400).json({ status: "error", message: `${filedByOther.submissionNo} has already been filed for this assignment.` });
  }

  // Box B: the claimant picks an active Authorized Representative; the server copies that
  // person's name and position, so nothing typed by the client prints in the box.
  const representative = activeSignatoryById(req.body.representativeId, "Authorized Representative");
  if (!representative) {
    return res.status(400).json({
      status: "error",
      message: hasActiveSignatory("Authorized Representative")
        ? "Choose the Authorized Representative for Box B from the list."
        : NO_REPRESENTATIVE_MESSAGE
    });
  }
  if (isClaimantSignatory(representative, req.user)) {
    return res.status(400).json({ status: "error", message: "Choose someone other than yourself for Box B." });
  }

  const subNo = nextLiquidationSubmissionNo();
  const now = new Date();
  const facts = liquidationActivityFacts(activityId);

  // The cash advance record is the authority on what was released — not the claimant's
  // input. With one on file the employee can no longer understate it to manufacture a
  // reimbursement, and the DV reference comes from Finance rather than being typed.
  // With none on file we fall back to the submitted figure, because assignments funded
  // before cash advances were recorded have no record to read. That gap closes as
  // Finance issues advances through this flow; until then allocatedAtFiling is what
  // flags a suspicious claim.
  const advance = releasedAdvanceForAssignment(activityId);
  // (A group's report may say whom each line was for; any other report's lines name nobody.)
  const linesProblem = groupLinesProblem(lines ? lines.particulars : null, withinAdvance ? advance : null);
  if (linesProblem) return res.status(400).json({ status: "error", message: linesProblem });
  const groupAdvance = withinAdvance && advance && isGroupAdvance(advance) ? advance : null;
  const typedDvNo = String(cashAdvanceDvNo || "").trim();
  // When the report is itemised, the total is the sum of the lines — never a separately
  // typed figure that could disagree with them.
  const spent = lines ? lines.total : (typedSpent ?? 0);
  // A seminar report: it needs Finance's advance, its items stay within it, and a leftover
  // is handed back with an OR. A general activity: the claim type must fit the advance.
  // (Cleaned like a name: invisible and control characters can't make it read differently.)
  const refund = { orNo: signatoryText(refundOrNo), orDate: refundOrDate };
  // A reimbursement: within their share, less what the office paid for them, with the receipts attached.
  const reimbursable = withinAllowance ? seatReimbursementLimit(activityId) : 0;
  const moneyProblem = withinAdvance
    ? withinAdvanceProblem(activityId, advance, spent, refund)
    : (() => {
        const message = withinAllowance
          ? reimbursementProblem({ spent, limit: reimbursable, files: (supportingDocs || []).filter(isRealFile).length }, pesoText)
          : claimTypeProblem(claimType, advance, { released: typedReleased, dvNo: typedDvNo });
        return message ? { code: 400, message } : null;
      })();
  if (moneyProblem) {
    return res.status(moneyProblem.code).json({ status: "error", message: moneyProblem.message });
  }
  const claim: ClaimType = withinAdvance ? "Liquidation" : withinAllowance ? "Reimbursement" : claimType;
  // A Reimbursement has no advance, so nothing typed into its boxes is kept.
  const isReimbursement = claim === "Reimbursement";
  const released = advance ? round2(Number(advance.amount)) : (isReimbursement ? 0 : typedReleased);
  if (isReimbursement && !(spent > 0)) {
    return res.status(400).json({ status: "error", message: NOTHING_TO_REIMBURSE_MESSAGE });
  }
  const balance = liquidationBalance(released, spent);
  // Box A prints the claimant's official name from their staff record, falling back to
  // the account name; never a name typed in the form.
  const staffRecord = employeeId ? (db.employees || []).find((e: any) => employeeIdForms(employeeId).includes(e.id)) : null;
  const officialName = String(staffRecord?.fullName || "").trim() || fullName;
  const newSub = {
    id: `liqsub-${Date.now()}`,
    submissionNo: subNo,
    activityId,
    employeeId,
    employeeName: officialName,
    claimType: claim,
    // Set only on a seminar report kept within its advance (see withinAdvanceProblem), or on one
    // claiming back what its attendee paid themselves, within their share (src/reimbursement.ts).
    ...(withinAdvance ? { withinAdvance: true } : {}),
    ...(withinAllowance ? { withinAllowance: true } : {}),
    totalReleased: released,
    totalSpent: spent,
    remainingBalance: pesos(centavos(released) - centavos(spent)),
    remarks: remarks || "",
    supportingDocs: claimantDocuments(supportingDocs || []),

    // COA Liquidation Report fields. A positive remainingBalance is the form's
    // "Amount Refunded"; a negative one is "Amount to be Reimbursed" — the split is
    // presentational, so only the one stored figure is kept.
    particulars: lines ? lines.particulars : [],
    serialNo: nextLiquidationSerialNo(now),
    entityName: LR_ENTITY_NAME,
    fundCluster: LR_FUND_CLUSTER,
    periodCoveredFrom: periodCoveredFrom || "",
    periodCoveredTo: periodCoveredTo || "",
    responsibilityCenterCode: responsibilityCenterCode || "",
    // Finance's own DV reference wins over anything typed into the form.
    cashAdvanceId: advance ? advance.id : undefined,
    cashAdvanceDvNo: advance ? advance.dvNo : (isReimbursement ? "" : typedDvNo),
    cashAdvanceDvDate: advance ? advance.dvDate : (isReimbursement ? "" : (cashAdvanceDvDate || "")),
    // Only money advanced can be refunded, so a Reimbursement has no OR, and neither has a
    // seminar report that used up its advance exactly.
    refundOrNo: isReimbursement ? "" : withinAdvance ? (balance.leftover > 0 ? refund.orNo : "") : (refundOrNo || ""),
    refundOrDate: isReimbursement ? "" : withinAdvance ? (balance.leftover > 0 ? refund.orDate : "") : (refundOrDate || ""),
    jevNo: "",

    // Box B as chosen at filing (copied from the signatory list; see above).
    representativeId: representative.id,
    representativeName: representative.fullName,
    representativePosition: representative.position,

    // Spending more than was received makes this a claim for the difference (never on a
    // seminar report, whose items stay within its advance). Derived, so it can never disagree
    // with the figures above.
    reimbursementAmount: balance.over,
    reimbursementStatus: balance.over > 0 ? "Awaiting Reimbursement" : "Not Required",
    reimbursementDvNo: "",
    reimbursementDate: "",
    reimbursedBy: "",

    // HR's own figure, so Finance can see a stated advance that disagrees with it. A group's is what
    // it may spend: the shares of those its advance covers who attended; a reimbursement's, what its
    // attendee could claim back.
    ...(facts ? {
      allocatedAtFiling: groupAdvance ? groupSpendCap(groupAdvance)! : withinAllowance ? reimbursable : facts.allocated,
      activityTitle: facts.title
    } : {}),

    status: "Pending HR Review",
    createdAt: new Date().toISOString(),
    dateSubmitted: new Date().toISOString(),
    // Use the vocabulary the rest of the workflow already speaks (see /resubmit below).
    // These previously started as "Pending Audit" / "Pending Concurrence" — values no
    // other route and no type in src/types.ts ever recognised — and hrStatus was never
    // set at all, leaving a required field undefined on every new submission.
    hrStatus: "Pending Review",
    financeStatus: "Pending Validation",
    divisionChiefStatus: "Pending Chief Approval"
  };

  db.liquidationSubmissions.push(newSub);

  // Check if it's a training participant liquidation. A group's report is for everyone its advance
  // covers who attended (the holder too, if they did).
  if (groupAdvance) {
    for (const c of groupAdvance.covers!) {
      const e = (db.trainingParticipants || []).find((p: any) => p && p.id === c.participantId);
      if (e && e.attendance === "Attended" && e.status === "Assigned") e.status = "Liquidation Pending";
    }
  } else {
    const pIndex = db.trainingParticipants.findIndex((p) => p.id === activityId);
    if (pIndex !== -1) {
      db.trainingParticipants[pIndex].status = "Liquidation Pending";
    }
  }
  const groupText = groupAdvance ? ` for a group of ${groupAdvance.covers!.length} (${namesText(groupAdvance.covers!.map(c => c.employeeName))})` : "";

  // A reimbursement says so, with what it claims and the seat's cash advance record (a request
  // declined, or an advance handed back before the seminar), so reviewers see how it came to be.
  const advanceHistory = !withinAllowance ? ""
    : !seatAdvance ? "no cash advance was asked for"
    : seatAdvance.status === "Declined" ? `cash advance request${seatAdvance.advanceNo ? ` ${seatAdvance.advanceNo}` : ""} declined`
    : seatAdvance.status === "Refunded" ? `cash advance ${seatAdvance.advanceNo} refunded${seatAdvance.refundedBeforeSeminar ? " before the seminar" : ""}${seatAdvance.refundOrNo ? ` (OR ${seatAdvance.refundOrNo})` : ""}`
    : `cash advance ${seatAdvance.advanceNo}: ${seatAdvance.status}`;
  notify({ role: UserRole.HR_OFFICER }, withinAllowance ? {
    title: "Reimbursement Claim Submitted",
    message: `${fullName} claims back ${pesoText(spent)} they paid themselves for ${facts?.title || "a seminar"} (${subNo}; within their ${pesoText(reimbursable)} share; ${advanceHistory}).`,
    type: "info",
    link: { tab: "requests", record: { kind: "liquidationReport", id: newSub.id } }
  } : {
    title: "Liquidation Report Submitted",
    message: `${fullName} submitted a liquidation report${groupText} for activity relationship evaluation.`,
    type: "info",
    link: { tab: "requests", record: { kind: "liquidationReport", id: newSub.id } }
  });
  for (const c of (groupAdvance?.covers || []).filter(c => c.participantId !== activityId)) {
    notifyEmployee(c.employeeId, {
      title: "Group liquidation report filed",
      message: `${officialName} filed the group's liquidation report ${subNo} for ${facts?.title || "your seminar"}, on the cash advance that covers you.`,
      type: "info",
      link: { tab: "employee_portal", record: { kind: "assignment", id: c.participantId } },
      dedupeKey: `group-report:${newSub.id}:${c.participantId}`
    });
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Submit Liquidation",
    `Submitted liquidation report: ${subNo}${groupText} (${claim}${withinAdvance ? `; ${balanceText(released, spent, newSub.refundOrNo)}` : ""}${withinAllowance
      ? `; ${pesoText(spent)} claimed back, limit ${pesoText(reimbursable)}; ${advanceHistory}` : ""})`);
  saveDB();
  res.json({ status: "success", data: newSub });
}));

app.put("/api/requests/:id/resubmit", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const {
    dateRequested, startDate, endDate, dateNeeded, meetingDate,
    departureDate, departureTime, arrivalDate, arrivalTime
  } = req.body;

  const request = db.requests.find((r: any) => r.id === id);
  if (!request) {
    return res.status(404).json({ status: "error", message: "Personnel Request not found" });
  }

  if (request.employeeId !== req.user.employeeId && (req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Forbidden: You cannot resubmit this request." });
  }
  // Only a request returned or rejected comes back, as the portal offers it. An approved one sent again
  // with new dates would print the Division Chief's name on a slip for dates nobody approved.
  const resubmittable: string[] = [RequestStatus.REJECTED, RequestStatus.RETURNED_BY_HR, RequestStatus.RETURNED_BY_CHIEF];
  if (!resubmittable.includes(request.status)) {
    return res.status(409).json({ status: "error", message: `This request is ${request.status}, so it can't be resubmitted.` });
  }
  // A vehicle request filed with a seminar's cash advance comes back only while no other one stands for
  // that seminar, for anyone its advance covers (one per seminar).
  const linked: any = request;
  if (linked.trainingParticipantId) {
    const a: any = linked.cashAdvanceId ? (db.cashAdvances || []).find((x: any) => x && x.id === linked.cashAdvanceId) : null;
    for (const pid of a ? coveredEnrolmentIds(a) : [linked.trainingParticipantId]) {
      const other = vehicleRequestFor(pid, request.id);
      if (other) {
        return res.status(409).json({
          status: "error",
          message: other.employeeId === request.employeeId
            ? `Vehicle request ${other.vrsNo || "on file"} already stands for this seminar (${other.status}), so this one can't be resubmitted.`
            : "Another vehicle request for this seminar already stands, so this one can't be resubmitted."
        });
      }
    }
  }
  delete (request as any).approvedBy;

  if (dateRequested) request.dateRequested = dateRequested;
  
  // Depending on request type update relevant date fields
  if (request.requestType === RequestType.LEAVE) {
    const leaveReq = request as any;
    if (startDate) leaveReq.startDate = startDate;
    if (endDate) leaveReq.endDate = endDate;
  } else if (request.requestType === RequestType.VEHICLE) {
    const vehicleReq = request as any;
    if (dateNeeded) vehicleReq.dateNeeded = dateNeeded;
    // Reservation slip times, only overwritten when the correction supplies them.
    if (departureDate !== undefined) vehicleReq.departureDate = departureDate;
    if (departureTime !== undefined) vehicleReq.departureTime = departureTime;
    if (arrivalDate !== undefined) vehicleReq.arrivalDate = arrivalDate;
    if (arrivalTime !== undefined) vehicleReq.arrivalTime = arrivalTime;
    // A slip filed before serials existed gets one on its first correction.
    if (!vehicleReq.vrsNo) vehicleReq.vrsNo = nextVrsNo(new Date());
  } else if (request.requestType === RequestType.ZOOM) {
    const zoomReq = request as any;
    if (meetingDate) zoomReq.meetingDate = meetingDate;
  }
  
  request.status = request.requestType === RequestType.VEHICLE ? RequestStatus.ENDORSED_TO_CHIEF : RequestStatus.PENDING;
  request.remarks = "Resubmitted with modified dates.";

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Resubmit Request", `Resubmitted personnel request: ${id}`);
  saveDB();
  res.json({ status: "success", data: request });
});

app.put("/api/liquidation-submissions/:id/resubmit", authenticateToken, transactional((req: any, res: any) => {
  const { id } = req.params;
  const sub = db.liquidationSubmissions.find(l => l.id === id);
  if (!sub) {
    return res.status(404).json({ status: "error", message: "Submission records not found" });
  }

  // Only the claimant corrects a report. The Administrator may still correct a general
  // activity's report, but a seminar's belongs to the attendee alone, as filing does.
  const isSeminarReport = (db.trainingParticipants || []).some((p: any) => p.id === sub.activityId);
  const ownReport = !!req.user.employeeId && employeeIdForms(String(sub.employeeId || "")).includes(req.user.employeeId);
  if (!ownReport && (isSeminarReport || (req as any).user.role !== UserRole.SUPER_ADMIN)) {
    return res.status(403).json({ status: "error", message: "Forbidden: You cannot resubmit this report details." });
  }
  // Only a report a reviewer returned can be corrected, and never once its claim was paid.
  if (sub.status !== "Returned" || sub.reimbursementStatus === "Reimbursed") {
    return res.status(409).json({ status: "error", message: "Only a report returned by HR or Finance for correction can be resubmitted." });
  }
  // Validated under the old rules and returned afterwards: its spending is already counted,
  // so validating a correction would count it twice. (Today a Return can't follow Validate.)
  if (sub.financeValidatedAt || sub.divisionChiefApprovedAt) {
    return res.status(409).json({ status: "error", message: `${sub.submissionNo} was validated before it was returned, and its spending is already counted, so it can't be corrected and validated again. Ask Finance to review it.` });
  }

  // Requirement 5: with a correction request open, only the parts the reviewer ticked can
  // change. Everything else keeps its stored value, whatever the client sends. A report
  // returned before checklists existed has no open request and is corrected as before.
  const open = [...(sub.corrections || [])].reverse().find(c => !c.resolvedAt) || null;
  const ticked = new Set<CorrectionField>((open?.items || []).map(i => i.field));
  const may = (f: CorrectionField) => !open || ticked.has(f);
  const body: any = { ...(req.body || {}) };
  if (!may("periodCovered")) { delete body.periodCoveredFrom; delete body.periodCoveredTo; }
  if (!may("responsibilityCenterCode")) delete body.responsibilityCenterCode;
  if (!may("particulars")) { delete body.particulars; delete body.totalSpent; }
  // The claim type decides whether there is an advance (and so a refund), so ticking it
  // reopens the advance and its refund OR too.
  if (!may("cashAdvance") && !may("claimType")) {
    delete body.totalReleased; delete body.cashAdvanceDvNo; delete body.cashAdvanceDvDate;
  }
  // On a seminar report kept within its advance, new items can change what is left to hand
  // back, so reopened particulars reopen the refund OR as well.
  if (!may("refundOr") && !may("claimType") && !(sub.withinAdvance && may("particulars"))) { delete body.refundOrNo; delete body.refundOrDate; }
  if (!may("claimType")) delete body.claimType;
  // Such a report always settles Finance's advance, and a seminar paid out of pocket is always a
  // Reimbursement with none: their claim type and advance aren't the claimant's to change.
  if (sub.withinAdvance || sub.withinAllowance) {
    delete body.claimType; delete body.totalReleased; delete body.cashAdvanceDvNo; delete body.cashAdvanceDvDate;
  }
  // A report filed before Box B existed must name one now, ticked or not.
  if (!may("representative") && sub.representativeId) delete body.representativeId;
  if (!may("remarks")) delete body.remarks;
  if (!may("addDocument")) delete body.supportingDocs;

  // Particulars ticked line by line: only those lines change, and the list keeps its shape.
  const lineItem = open?.items.find(i => i.field === "particulars");
  if (lineItem?.lineIds?.length && Array.isArray(body.particulars)) {
    const sent = new Map<string, any>(body.particulars.filter((p: any) => p && p.id).map((p: any) => [String(p.id), p]));
    const editOf = (p: any) => (lineItem.lineIds!.includes(p.id) ? sent.get(p.id) : undefined);
    // A line reopened on its own is corrected, not removed (the form offers no Remove then).
    const cleared = (sub.particulars || []).find((p: any) => {
      const edit = editOf(p);
      return edit && !String(edit.description ?? "").trim() && !(Number(edit.amount) > 0);
    });
    if (cleared) {
      return res.status(400).json({ status: "error", message: `"${cleared.description}" was reopened for correction: correct it rather than clearing it.` });
    }
    body.particulars = (sub.particulars || []).map((p: any) => {
      const edit = editOf(p);
      // (A group's line keeps whom it was for as corrected, the group when none is sent.)
      return edit ? { ...p, description: edit.description, amount: edit.amount, category: edit.category, participantId: edit.participantId || undefined } : p;
    });
    delete body.totalSpent;
  }

  // Files: a file is new when its id isn't on the report (or, for older files kept without
  // an id, its name), so a form that sends back the files it was given adds nothing.
  if (invalidSupportingDocs(body.supportingDocs)) {
    return res.status(400).json({ status: "error", message: INVALID_DOCS_MESSAGE });
  }
  const storedDocs: any[] = Array.isArray(sub.supportingDocs) ? sub.supportingDocs : [];
  const storedDocIds = new Set(storedDocs.map((d: any) => d?.id).filter(Boolean));
  const storedDocNames = new Set(storedDocs.map((d: any) => d?.name));
  const newDocs: any[] = (body.supportingDocs || []).filter((d: any) => d.id ? !storedDocIds.has(d.id) : !storedDocNames.has(d.name));

  // Files the reviewer asked to replace: each needs a new copy; the old one is kept as history.
  const current = storedDocs.filter((d: any) => d && !d.supersededAt);
  const replaceItem = open?.items.find(i => i.field === "replaceDocuments");
  const sentReplacements: any[] = Array.isArray(body.replacements) ? body.replacements : [];
  const replacements: { old: any; doc: any }[] = [];
  for (const docId of replaceItem?.documentIds || []) {
    const old = current.find((d: any) => d.id === docId);
    const r = sentReplacements.find((x: any) => x && x.replaces === docId);
    if (!old) continue; // already replaced in an earlier round
    if (!r || !r.doc || typeof r.doc !== "object" || Array.isArray(r.doc)) {
      return res.status(400).json({ status: "error", message: `Replace "${old.name}" before resubmitting: the reviewer asked for a new copy.` });
    }
    replacements.push({ old, doc: r.doc });
  }
  const fileProblem = [...newDocs, ...replacements.map(r => r.doc)].map(documentProblem).find(Boolean);
  if (fileProblem) {
    return res.status(400).json({ status: "error", message: fileProblem });
  }
  if (open && ticked.has("addDocument") && newDocs.length === 0) {
    return res.status(400).json({ status: "error", message: "Attach the missing document the reviewer asked for before resubmitting." });
  }

  const {
    totalSpent, remarks, particulars,
    periodCoveredFrom, periodCoveredTo, responsibilityCenterCode,
    cashAdvanceDvNo, cashAdvanceDvDate, refundOrNo, refundOrDate,
    representativeId, claimType: claimTypeIn, totalReleased: releasedIn
  } = body;
  // For the record of what this correction actually changed.
  const changeSnapshot = (s: any): Record<CorrectionField, string> => ({
    periodCovered: JSON.stringify([s.periodCoveredFrom || "", s.periodCoveredTo || ""]),
    responsibilityCenterCode: JSON.stringify(s.responsibilityCenterCode || ""),
    particulars: JSON.stringify((s.particulars || []).map((p: any) => [p.id, p.description, p.amount, p.category])),
    cashAdvance: JSON.stringify([s.totalReleased, s.cashAdvanceDvNo || "", s.cashAdvanceDvDate || ""]),
    refundOr: JSON.stringify([s.refundOrNo || "", s.refundOrDate || ""]),
    claimType: JSON.stringify(s.claimType || ""),
    representative: JSON.stringify(s.representativeId || ""),
    replaceDocuments: JSON.stringify((s.supportingDocs || []).filter((d: any) => d?.supersededAt).length),
    // A replacement's new copy answers "replace", not "add".
    addDocument: JSON.stringify((s.supportingDocs || []).filter((d: any) => d && !d.replaces).length),
    remarks: JSON.stringify(s.remarks || "")
  });
  const beforeCorrection = changeSnapshot(sub);
  // What the claimant could change: the ticked parts, the advance and refund OR when the
  // claim type reopened, and Box B on a report filed before it existed. A change the server
  // makes itself (Finance's record replacing a typed advance) isn't credited to them.
  const hadRepresentative = !!sub.representativeId;
  const claimantCouldChange = (f: CorrectionField) => may(f)
    || ((f === "cashAdvance" || f === "refundOr") && may("claimType"))
    || (f === "refundOr" && !!sub.withinAdvance && may("particulars"))
    || (f === "representative" && !hadRepresentative);

  const lines = normalizeParticulars(particulars);
  if (lines && lines.error) {
    return res.status(400).json({ status: "error", message: lines.error });
  }
  const linesProblem = groupLinesProblem(lines ? lines.particulars : null, sub.withinAdvance ? advanceOnFileFor(sub) : null);
  if (linesProblem) return res.status(400).json({ status: "error", message: linesProblem });

  // Box B: a new choice is checked and copied. Without one, the report keeps the person
  // chosen at filing; a report filed before Box B existed must name one now, because the
  // corrected form requires it.
  let newRepresentative: Signatory | null = null;
  if (representativeId !== undefined && representativeId !== null && representativeId !== "") {
    newRepresentative = activeSignatoryById(representativeId, "Authorized Representative");
    if (!newRepresentative) {
      return res.status(400).json({ status: "error", message: "Choose an active Authorized Representative for Box B." });
    }
    if (isClaimantSignatory(newRepresentative, { employeeId: sub.employeeId, fullName: sub.employeeName })) {
      return res.status(400).json({ status: "error", message: "Choose someone other than yourself for Box B." });
    }
  } else if (!sub.representativeId) {
    return res.status(400).json({
      status: "error",
      message: hasActiveSignatory("Authorized Representative")
        ? "Choose the Authorized Representative for Box B from the list."
        : NO_REPRESENTATIVE_MESSAGE
    });
  }

  // Claim type: a correction may change it, under the same rules as filing, and the cash
  // advance it implies changes with it. Finance's record, when there is one, is the
  // advance; otherwise the typed figures are, and a Reimbursement's are zero.
  if (claimTypeIn !== undefined && !isClaimType(claimTypeIn)) {
    return res.status(400).json({ status: "error", message: CHOOSE_CLAIM_TYPE_MESSAGE });
  }
  const claimType: ClaimType = isClaimType(claimTypeIn) ? claimTypeIn
    : isClaimType(sub.claimType) ? sub.claimType
    : (Number(sub.totalReleased) > 0 ? "Liquidation" : "Reimbursement");
  const releasedGiven = !(releasedIn === undefined || releasedIn === null || releasedIn === "");
  const releasedParsed = releasedGiven ? parsePeso(releasedIn) : null;
  if (releasedGiven && releasedParsed === null) {
    return res.status(400).json({ status: "error", message: ADVANCE_AMOUNT_MESSAGE });
  }
  // Only the parts open for correction are checked; the rest were set aside above.
  const referenceProblem = coaReferenceProblem(body) || reportHeaderProblem(body, sub);
  if (referenceProblem) {
    return res.status(400).json({ status: "error", message: referenceProblem });
  }
  // Finance's record stays the advance once the report is linked to it, settled or not.
  const recordedAdvance = advanceOnFileFor(sub);
  const typedReleased = releasedParsed !== null ? releasedParsed
    : claimType === "Reimbursement" ? 0 : round2(Number(sub.totalReleased || 0));
  const typedDvNo = String((cashAdvanceDvNo !== undefined ? cashAdvanceDvNo : sub.cashAdvanceDvNo) || "").trim();
  const claimProblem = claimTypeProblem(claimType, recordedAdvance, { released: typedReleased, dvNo: typedDvNo });
  if (claimProblem) {
    return res.status(400).json({ status: "error", message: claimProblem });
  }
  // Without particulars a plain total is read strictly, and when left out the stored one
  // stands. An itemised report is corrected through its lines, never a typed total.
  const spentGiven = !(totalSpent === undefined || totalSpent === null || totalSpent === "");
  const typedSpent = spentGiven ? parsePeso(totalSpent) : null;
  if (!lines && spentGiven && (typedSpent === null || (sub.particulars || []).length > 0)) {
    return res.status(400).json({
      status: "error",
      message: (sub.particulars || []).length > 0
        ? "This report is itemised: correct its particulars rather than the total."
        : "Enter the total spent as an amount of zero or more."
    });
  }
  const newSpent = lines ? lines.total : (typedSpent ?? round2(Number(sub.totalSpent || 0)));
  if (claimType === "Reimbursement" && !(newSpent > 0)) {
    return res.status(400).json({ status: "error", message: NOTHING_TO_REIMBURSE_MESSAGE });
  }
  // A seminar report kept within its advance: corrected or not, its items still can't go past
  // the advance, and a leftover needs its OR, as at filing.
  const refundNoNow = typeof refundOrNo === "string" ? signatoryText(refundOrNo) : String(sub.refundOrNo || "").trim();
  const refundDateNow = typeof refundOrDate === "string" ? refundOrDate : String(sub.refundOrDate || "");
  if (sub.withinAdvance) {
    const problem = withinAdvanceProblem(sub.activityId, recordedAdvance, newSpent, { orNo: refundNoNow, orDate: refundDateNow }, sub.id);
    if (problem) return res.status(problem.code).json({ status: "error", message: problem.message });
  }
  // Paid out of pocket: still within their share as it is now (HR may have re-priced the seminar or
  // entered what the office paid). Its receipts were attached at filing, and a file is never removed.
  if (sub.withinAllowance) {
    const message = reimbursementProblem({ spent: newSpent, limit: seatReimbursementLimit(sub.activityId) }, pesoText);
    if (message) return res.status(400).json({ status: "error", message });
  }

  // Update details. An itemised correction recomputes the total from its lines; a
  // submission that was never itemised keeps accepting a plain typed figure.
  // Recorded in the audit entry below when Box B changes.
  const boxBChange = newRepresentative && newRepresentative.id !== sub.representativeId
    ? `; Box B: ${sub.representativeName || "none"} → ${newRepresentative.fullName}`
    : "";
  if (newRepresentative) {
    sub.representativeId = newRepresentative.id;
    sub.representativeName = newRepresentative.fullName;
    sub.representativePosition = newRepresentative.position;
  }
  // What the correction changes about the claim, recorded in the audit entry and named in
  // HR's notice, so a lowered or removed advance can't pass unseen.
  const before = { type: sub.claimType, released: round2(Number(sub.totalReleased || 0)), dv: String(sub.cashAdvanceDvNo || "") };
  sub.claimType = claimType;
  if (recordedAdvance) {
    sub.cashAdvanceId = recordedAdvance.id;
    sub.totalReleased = round2(Number(recordedAdvance.amount));
    sub.cashAdvanceDvNo = recordedAdvance.dvNo;
    sub.cashAdvanceDvDate = recordedAdvance.dvDate;
  } else if (claimType === "Reimbursement") {
    delete sub.cashAdvanceId;
    sub.totalReleased = 0;
    sub.cashAdvanceDvNo = "";
    sub.cashAdvanceDvDate = "";
  } else {
    sub.totalReleased = typedReleased;
    sub.cashAdvanceDvNo = typedDvNo;
    if (typeof cashAdvanceDvDate === "string") sub.cashAdvanceDvDate = cashAdvanceDvDate;
  }
  const claimChanges: string[] = [];
  if (before.type !== claimType) claimChanges.push(`claim type ${before.type || "none"} → ${claimType}`);
  if (before.released !== sub.totalReleased || before.dv !== String(sub.cashAdvanceDvNo || "")) {
    claimChanges.push(`cash advance PHP ${before.released.toFixed(2)} (DV ${before.dv || "none"}) → PHP ${round2(sub.totalReleased).toFixed(2)} (DV ${sub.cashAdvanceDvNo || "none"})`);
  }
  const claimTypeChange = claimChanges.length ? `; ${claimChanges.join("; ")}` : "";
  // The claim as first stated stays on the report, so Finance, who pays and can check a
  // voucher against its books, sees what it said before a correction changed it.
  if (claimChanges.length) {
    sub.claimBeforeCorrection = {
      ...(sub.claimBeforeCorrection ?? { claimType: before.type, totalReleased: before.released, cashAdvanceDvNo: before.dv }),
      changedAt: new Date().toISOString(),
      changedBy: (req as any).user.fullName
    };
  }
  if (lines) sub.particulars = lines.particulars;
  sub.totalSpent = newSpent;
  sub.remainingBalance = pesos(centavos(sub.totalReleased) - centavos(sub.totalSpent));
  // Sent only when open for correction, so clearing the notes really clears them.
  if (typeof remarks === "string") sub.remarks = remarks.trim();

  // A correction can turn a settled report into a claim, or the reverse. Never downgrade
  // one already paid — that would silently reopen money the office has handed over.
  if (sub.reimbursementStatus !== "Reimbursed") {
    sub.reimbursementAmount = round2(Math.max(0, sub.totalSpent - sub.totalReleased));
    sub.reimbursementStatus = sub.totalSpent > sub.totalReleased ? "Awaiting Reimbursement" : "Not Required";
  }

  // Header fields are only overwritten when the correction actually supplies them.
  if (typeof periodCoveredFrom === "string") sub.periodCoveredFrom = periodCoveredFrom;
  if (typeof periodCoveredTo === "string") sub.periodCoveredTo = periodCoveredTo;
  if (typeof responsibilityCenterCode === "string") sub.responsibilityCenterCode = responsibilityCenterCode;
  // The DV fields were set with the claim type above. Only an advance can be refunded.
  if (claimType === "Reimbursement") {
    sub.refundOrNo = "";
    sub.refundOrDate = "";
  } else if (sub.withinAdvance) {
    // Checked above. A report that now uses up its advance exactly has nothing to hand back.
    const handsBack = liquidationBalance(sub.totalReleased, sub.totalSpent).leftover > 0;
    sub.refundOrNo = handsBack ? refundNoNow : "";
    sub.refundOrDate = handsBack ? refundDateNow : "";
  } else {
    if (typeof refundOrNo === "string") sub.refundOrNo = refundOrNo;
    if (typeof refundOrDate === "string") sub.refundOrDate = refundOrDate;
  }
  if (!sub.serialNo) sub.serialNo = nextLiquidationSerialNo(new Date());
  if (!sub.entityName) sub.entityName = LR_ENTITY_NAME;
  if (!sub.fundCluster) sub.fundCluster = LR_FUND_CLUSTER;
  
  // New files join the ones already on the report, which stay as they are.
  if (newDocs.length > 0) {
    sub.supportingDocs = [...storedDocs, ...claimantDocuments(newDocs, storedDocs)];
  }
  // A replaced file stays on the report, marked superseded, next to its new copy.
  const replacedAt = new Date().toISOString();
  replacements.forEach(({ old, doc }) => {
    const fresh: LiquidationDocument = {
      ...claimantDocuments([doc])[0],
      id: `doc-${crypto.randomUUID()}`,
      uploadedAt: replacedAt,
      replaces: old.id
    };
    old.supersededAt = replacedAt;
    old.replacedBy = fresh.id;
    sub.supportingDocs.push(fresh);
  });
  // Paid out of pocket: still at least one receipt with something in it once the files changed (a
  // replacement could be an empty copy). The whole correction is undone if not.
  if (sub.withinAllowance && !(sub.supportingDocs || []).some(isRealFile)) {
    return res.status(400).json({ status: "error", message: "Attach your official receipts (OR) for what you paid." });
  }

  // The corrected report goes back to whoever returned it (open question 5): to HR, or to
  // Finance with HR's verification still standing. A report returned before checklists
  // existed goes to HR, as it always did.
  const backTo = open?.returnTo ?? "Pending HR Review";
  const afterCorrection = changeSnapshot(sub);
  const changedFields = CORRECTABLE_FIELDS.filter(f => claimantCouldChange(f) && beforeCorrection[f] !== afterCorrection[f]);
  if (open) {
    open.resolvedAt = new Date().toISOString();
    open.changedFields = changedFields;
  }
  sub.status = backTo;
  sub.hrStatus = backTo === "Verified & Forwarded" ? "Verified & Forwarded" : "Pending Review";
  sub.financeStatus = "Pending Validation";
  sub.divisionChiefStatus = "Pending Chief Approval";
  // Box C is copied again when Finance validates the corrected report.
  delete sub.accountantSignatoryId;
  delete sub.accountantName;
  delete sub.accountantPosition;

  // Back to whoever returned it: Finance on its Liquidation Desk, HR in Request Management.
  const reportOnDesk: NotificationLink = { tab: "finance", subTab: "liquidation", record: { kind: "liquidationReport", id: sub.id } };
  const toFinance = backTo === "Verified & Forwarded";
  notify({ role: toFinance ? UserRole.FINANCE_OFFICER : UserRole.HR_OFFICER }, {
    title: "Liquidation Report Resubmitted",
    message: `${(req as any).user.fullName} corrected and resubmitted liquidation report ${sub.submissionNo}.${claimChanges.length ? ` Changed: ${claimChanges.join("; ")}.` : ""}`,
    type: "info",
    link: toFinance ? reportOnDesk : { tab: "requests", record: { kind: "liquidationReport", id: sub.id } }
  });
  if (claimChanges.length) {
    notify({ role: UserRole.FINANCE_OFFICER }, {
      title: "Corrected claim: check the cash advance",
      message: `${sub.submissionNo} was corrected by ${(req as any).user.fullName}. Changed: ${claimChanges.join("; ")}. Check the voucher before validating.`,
      type: "warning",
      link: reportOnDesk
    });
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Resubmit Liquidation",
    `Resubmitted liquidation report: ${sub.submissionNo}${open ? ` (round ${open.round}, changed: ${changedFields.join(", ") || "nothing"}; back to ${backTo === "Verified & Forwarded" ? "Finance" : "HR"})` : ""}${boxBChange}${claimTypeChange}${sub.withinAdvance ? `; ${balanceText(sub.totalReleased, sub.totalSpent, sub.refundOrNo)}` : ""}`);
  saveDB();
  res.json({ status: "success", data: sub });
}));

app.put("/api/liquidation-submissions/:id/hr-action", authenticateToken, transactional((req: any, res: any) => {
  if ((req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Access Restricted to HR Officer verification" });
  }
  const { id } = req.params;
  const { action, remarks } = req.body; // action: "Verify" | "Return"

  const sub = db.liquidationSubmissions.find(l => l.id === id);
  if (!sub) return res.status(404).json({ status: "error", message: "Submission records not found" });
  if (action !== "Verify" && action !== "Return") {
    return res.status(400).json({ status: "error", message: 'The action must be "Verify" or "Return".' });
  }
  // HR acts only while the report waits for it (a second click or a stale screen can't
  // move a report that has already gone on).
  if (sub.status !== "Pending HR Review") {
    return res.status(409).json({ status: "error", message: `${sub.submissionNo} isn't waiting for HR verification (it is ${sub.status}).` });
  }
  let returnNote = "";

  if (action === "Verify") {
    sub.hrStatus = "Verified & Forwarded";
    sub.hrRemarks = remarks || "Relationship confirmed between employee, activity, and budget line.";
    sub.hrVerifiedBy = (req as any).user.fullName;
    sub.hrVerifiedAt = new Date().toISOString();
    sub.status = "Verified & Forwarded";
    
    notify({ role: UserRole.FINANCE_OFFICER }, {
      title: "HR Verification Completed",
      message: `Liquidation submission ${sub.submissionNo} verified by HR & forwarded to Finance.`,
      type: "success",
      link: { tab: "finance", subTab: "liquidation", record: { kind: "liquidationReport", id: sub.id } }
    });
    if (isOwnRecord(req.user, sub.employeeId)) {
      flagSelfApproval(req.user, `verified their own liquidation report ${sub.submissionNo} (${pesoText(Number(sub.totalSpent || 0))} spent)`);
    } else if (reportCoversUser(sub, req.user)) {
      flagSelfApproval(req.user, `verified the group liquidation report ${sub.submissionNo} that covers them (${pesoText(Number(sub.totalSpent || 0))} spent, filed by ${sub.employeeName})`);
    }
  } else {
    // A Return carries the checklist of what to correct; the corrected report comes back to HR.
    const parsed = correctionRequestFrom(req.body, sub, req.user, "Pending HR Review");
    if ("error" in parsed) return res.status(400).json({ status: "error", message: parsed.error });
    sub.corrections = [...(sub.corrections || []), parsed.request];
    sub.hrStatus = "Returned by HR";
    sub.hrRemarks = parsed.request.remarks;
    sub.status = "Returned";
    notifyReportReturned(sub, "HR", parsed.request);
    returnNote = ` (round ${parsed.request.round}: ${parsed.request.items.map(i => i.field).join(", ")})`;
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "HR Verify Liquidation", `HR evaluated liquidation ${sub.submissionNo} with action ${action}${returnNote}`);
  saveDB();
  res.json({ status: "success", data: sub });
}));

app.put("/api/liquidation-submissions/:id/finance-action", authenticateToken, transactional((req: any, res: any) => {
  if ((req as any).user.role !== UserRole.FINANCE_OFFICER) {
    return res.status(403).json({ status: "error", message: "Access restricted to Financial Officer validations" });
  }

  const { id } = req.params;
  const { action, remarks } = req.body; // action: "Validate" | "Return"

  const sub = db.liquidationSubmissions.find(l => l.id === id);
  if (!sub) return res.status(404).json({ status: "error", message: "Submission records not found" });
  if (action !== "Validate" && action !== "Return") {
    return res.status(400).json({ status: "error", message: 'The action must be "Validate" or "Return".' });
  }
  // Finance acts only on a report HR has verified. This is also what stops a second
  // Validate from counting the same spending twice.
  if (sub.status !== "Verified & Forwarded") {
    return res.status(409).json({ status: "error", message: `${sub.submissionNo} isn't waiting for Finance validation (it is ${sub.status}).` });
  }
  let returnNote = "";

  if (action === "Validate") {
    // Counted once: a report validated (or, under the old rules, approved by the Division
    // Chief) may since have been returned and come back.
    if (sub.financeValidatedAt || sub.divisionChiefApprovedAt) {
      return res.status(409).json({ status: "error", message: `${sub.submissionNo} was already validated or approved, so its spending is already counted.` });
    }
    // Box C prints the Accountant on duty at validation. With none appointed nothing
    // changes: the report waits until the Administrator appoints one.
    const accountant = (db.signatories || []).find(s => s.role === "Accountant" && s.status === "Active");
    if (!accountant) {
      return res.status(409).json({
        status: "error",
        message: "No active Accountant to sign Box C. Ask the Administrator to appoint one in Utilities → Manage Signatories, then validate this report."
      });
    }
    // The report must agree with the cash advance on file: a Reimbursement has none, and a
    // Liquidation carries Finance's figure. Otherwise validating would settle the advance
    // and still owe the claim, paying twice, so it has to come back corrected first.
    const mismatch = advanceMismatch(sub);
    if (mismatch) {
      return res.status(409).json({ status: "error", message: `${mismatch} Return it so the employee can correct it.` });
    }
    // A seminar report kept within its advance still has to be: its items within the advance,
    // and an OR for the leftover, or the return recorded below couldn't be traced.
    const handedBack = sub.withinAdvance ? liquidationBalance(sub.totalReleased, sub.totalSpent) : null;
    // A group's report may spend only the shares of those who attended (attendance can change after
    // filing, so it is checked again here).
    const spendCap = sub.withinAdvance ? groupSpendCap(reportGroupAdvance(sub)) : null;
    if (spendCap !== null && centavos(sub.totalSpent) > centavos(spendCap)) {
      return res.status(409).json({
        status: "error",
        message: `${sub.submissionNo} spends ${pesoText(Number(sub.totalSpent))}, more than the shares of those its group's cash advance covers who attended (${pesoText(spendCap)}). Return it so the holder can correct it.`
      });
    }
    // A seminar paid out of pocket may claim only its attendee's share less what the office paid for
    // them, as it is now: HR may have re-priced the seminar or entered expenses since it was filed.
    if (sub.withinAllowance && !(sub.supportingDocs || []).some(isRealFile)) {
      return res.status(409).json({
        status: "error",
        message: `${sub.submissionNo} has no receipt with anything in it. Return it so the employee can attach their official receipts.`
      });
    }
    const reimbursableNow = sub.withinAllowance ? seatReimbursementLimit(sub.activityId) : null;
    if (reimbursableNow !== null && centavos(sub.totalSpent) > centavos(reimbursableNow)) {
      return res.status(409).json({
        status: "error",
        message: `${sub.submissionNo} claims ${pesoText(Number(sub.totalSpent))}, more than ${sub.employeeName} can claim back now (${pesoText(reimbursableNow)}: their share of the seminar's budget, less what the office paid for them). Return it so the employee can correct it.`
      });
    }
    if (handedBack && (!advanceOnFileFor(sub) || handedBack.status === "Over"
        || (handedBack.leftover > 0 && !(String(sub.refundOrNo || "").trim() && isCalendarDate(sub.refundOrDate))))) {
      return res.status(409).json({
        status: "error",
        message: `${sub.submissionNo} doesn't settle its cash advance as a seminar report must (items within the advance, and an OR for what is left). Return it so the employee can correct it.`
      });
    }
    // What the seminar holds in the training budget before this validation, to report what
    // returns to Unallocated (src/trainingBudget.ts).
    const seminarPart = (db.trainingParticipants || []).find((p: any) => p.id === sub.activityId);
    const seminar = seminarPart ? (db.trainingPrograms || []).find((p: any) => p.id === seminarPart.trainingProgramId) : null;
    const heldBefore = seminar ? seminarBudget(seminar, participantsForBudget()).committed : 0;
    // A copy, so appointing a new Accountant later never rewrites this report.
    sub.accountantSignatoryId = accountant.id;
    sub.accountantName = accountant.fullName;
    sub.accountantPosition = accountant.position;

    sub.financeStatus = "Validated & Approved";
    sub.financeRemarks = remarks || "Financial documentations, vouchers, and ledger matching validated and finalized.";
    sub.financeValidatedBy = (req as any).user.fullName;
    sub.financeValidatedAt = new Date().toISOString();
    
    // HSAC RAB 1 delegates box B of the COA Liquidation Report ("Head of Agency /
    // Authorized Representative") — the Chief's approval is not skipped, it is signed by
    // the authorised representative the form itself provides for. Reports filed with a
    // Box B signatory (Utilities → Manage Signatories) name that person; older reports
    // record the Financial Officer, who certified them under delegated authority.
    // divisionChiefApprovedBy stays the record of who clicked Validate.
    sub.divisionChiefStatus = "Certified by Authorized Representative";
    sub.divisionChiefRemarks = sub.representativeName
      ? `Box B certified by ${sub.representativeName}${sub.representativePosition ? `, ${sub.representativePosition}` : ""}; validated by the Financial Officer.`
      : "Certified by the Financial Officer under delegated authority.";
    sub.divisionChiefApprovedBy = (req as any).user.fullName;
    sub.divisionChiefApprovedAt = new Date().toISOString();
    sub.status = "Completed";

    // Check if it's a training participant. A group's report settles every enrolment its cash
    // advance covers (HSAC RAB 1: one cash advance, one report): each attendee is liquidated (the
    // holder only if they attended), HR's hand entries for any of them are replaced, and each line
    // goes to the attendee it was for, the holder's when it names nobody. Its spending counts once.
    const tPart = db.trainingParticipants.find(p => p.id === sub.activityId);
    const groupAdvance = reportGroupAdvance(sub);
    if (tPart) {
      const coveredParts: any[] = groupAdvance
        ? groupAdvance.covers!.map(c => db.trainingParticipants.find(p => p.id === c.participantId)).filter(Boolean)
        : [tPart];
      for (const p of coveredParts) if (!groupAdvance || p.attendance === "Attended") p.status = "Liquidated";
      const coveredIds = new Set(coveredParts.map((p: any) => p.id));
      const prog = db.trainingPrograms.find(p => p.id === tPart.trainingProgramId);

      // The report is now this participant's record of spending. Anything HR typed for
      // them before it arrived is replaced, so the seminar never counts it twice. Older
      // rows have no `source`: HR's carry a user id in submittedBy, a report's the
      // employee's own id. (A group's: for everyone it covers.) Not on a reimbursement: what
      // HR entered there is what the office paid itself, already left out of the claim's limit.
      const handRows = sub.withinAllowance ? [] : (db.trainingLiquidations || []).filter((r: any) =>
        coveredIds.has(r.trainingParticipantId) && (r.source === "hr" || (!r.source && r.submittedBy !== sub.employeeId)));
      if (handRows.length > 0) {
        const handTotal = round2(handRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
        db.trainingLiquidations = db.trainingLiquidations.filter((r: any) => !handRows.includes(r));
        if (prog) prog.usedBudget = Math.max(0, round2((prog.usedBudget || 0) - handTotal));
        logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Replace Hand-Entered Expenses",
          `${sub.submissionNo} replaced ${handRows.length} expense row(s) worth PHP ${handTotal.toFixed(2)} that HR had entered by hand for ${groupAdvance
            ? `the group it covers (${namesText(groupAdvance.covers!.map(c => c.employeeName))})` : sub.employeeName}`);
      }

      // Mirror the approved report into the training ledger. An itemised report copies
      // one row per PARTICULARS line so HR's breakdown shows what was actually bought;
      // a report with no line items still collapses to a single row, as before.
      const dateIncurred = new Date().toISOString().split("T")[0];
      const ledgerLines = (sub.particulars && sub.particulars.length > 0)
        ? sub.particulars.map((p: any) => ({
            description: p.description,
            amount: p.amount,
            category: TRAINING_EXPENSE_CATEGORIES.includes(p.category) ? p.category : "Miscellaneous",
            participantId: p.participantId
          }))
        : [{ description: sub.remarks || "Employee submitted liquidation", amount: sub.totalSpent, category: "Miscellaneous" }];

      ledgerLines.forEach((line: any, i: number) => {
        // On a group's report, the attendee the line names, else the holder; a holder who didn't
        // attend spent nothing of their own, so those lines are the seminar's (program-wide).
        // Otherwise the claimant's enrolment. Either way the spending counts once, in usedBudget.
        const forPart = !groupAdvance ? tPart
          : line.participantId && coveredIds.has(line.participantId) ? coveredParts.find((p: any) => p.id === line.participantId)
          : tPart.attendance === "Attended" ? tPart : null;
        db.trainingLiquidations.push({
          id: `tliq-${Date.now()}-${i}`,
          trainingProgramId: tPart.trainingProgramId,
          trainingParticipantId: forPart ? forPart.id : undefined,
          employeeId: !forPart ? undefined : forPart === tPart ? sub.employeeId : (enrolmentEmployee(forPart)?.employeeId || sub.employeeId),
          expenseCategory: line.category,
          description: line.description,
          amount: line.amount,
          dateIncurred,
          submittedBy: sub.employeeId,
          status: "Approved",
          source: "report"
        });
      });

      // Update the usedBudget in trainingPrograms
      if (prog) {
        prog.usedBudget = round2((prog.usedBudget || 0) + sub.totalSpent);
      }
    }

    const act = db.activities.find(a => a.id === sub.activityId);

    // Automatic categorised deduction on completion. A missing bucket is skipped with a notice to
    // the Budget Officer, and the spending stays undeducted. It is part of this validation's
    // transaction: if it fails part-way, the whole validation is undone rather than saved with a
    // bucket deducted and no link to show for it.
    autoDeductLiquidation(sub, {
      id: (req as any).user.id,
      username: (req as any).user.username,
      role: (req as any).user.role
    });

    db.financialTransactions.push({
      id: `tx-${Date.now()}`,
      transactionId: `TX-LIQ-${Date.now().toString().slice(-4)}`,
      transactionDate: new Date().toISOString().split("T")[0],
      supplier: "Regional Expenses",
      amount: sub.totalSpent,
      description: `Official travel liquidation for activity: ${act ? act.title : sub.submissionNo}`,
      status: TransactionStatus.LIQUIDATED,
      // The files the claim stands on now; copies a correction replaced stay on the report.
      supportingDocuments: (Array.isArray(sub.supportingDocs) ? sub.supportingDocs : []).filter((d: any) => d && !d.supersededAt).map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        filename: d.filename,
        uploadedAt: d.uploadedAt,
        validationStatus: "Validated"
      })),
      history: [
        { id: `his-${Date.now()}`, status: TransactionStatus.LIQUIDATED, changedBy: (req as any).user.fullName, changedAt: new Date().toISOString(), remarks: "Approved and finalized by Finance" }
      ],
      employeeRef: sub.employeeId,
      department: "Administrative and Finance Division",
      category: "Travel",
      createdBy: sub.employeeName,
      dateCreated: new Date().toISOString()
    });

    const owed = Number(sub.reimbursementAmount || 0);
    const claimPending = owed > 0 && sub.reimbursementStatus !== "Reimbursed";

    notify({ employee: sub.employeeId }, {
      title: "Liquidation APPROVED & FINALIZED",
      message: claimPending
        ? `Your liquidation report ${sub.submissionNo} has been validated. You spent ₱${owed.toFixed(2)} of your own money — Finance will reimburse you.`
        : handedBack
          ? `Your liquidation report ${sub.submissionNo} has been validated and finalized by Finance: ${handedBack.leftover > 0
              ? `the ${pesoText(handedBack.leftover)} you handed back (OR ${sub.refundOrNo}) went back to the training budget.`
              : "balanced, your cash advance fully used."}`
          : `Your liquidation report ${sub.submissionNo} has been validated and finalized by Finance.`,
      type: "success",
      link: { tab: "employee_portal", record: { kind: "liquidationReport", id: sub.id } }
    });
    // Everyone else the group's advance covered: their seminar is liquidated too.
    for (const c of (groupAdvance?.covers || []).filter(c => c.participantId !== sub.activityId)) {
      notifyEmployee(c.employeeId, {
        title: "Group liquidation validated",
        message: `Finance validated ${sub.employeeName}'s group liquidation report ${sub.submissionNo} for ${sub.activityTitle || "your seminar"}, which settles the cash advance that covered you.`,
        type: "success",
        link: { tab: "employee_portal", record: { kind: "assignment", id: c.participantId } },
        dedupeKey: `group-validated:${sub.id}:${c.participantId}`
      });
    }

    // Settle the advance this report accounts for, so an outstanding cash advance stops
    // showing as outstanding the moment it is properly liquidated.
    const settledAdvance = (db.cashAdvances || []).find((a: any) =>
      (sub.cashAdvanceId && a.id === sub.cashAdvanceId) ||
      (a.activityId === sub.activityId && a.status === "Released"
        && employeeIdForms(sub.employeeId).includes(a.employeeId)));
    if (settledAdvance && settledAdvance.status === "Released") {
      settledAdvance.status = "Liquidated";
      settledAdvance.liquidationId = sub.id;
      settledAdvance.liquidatedAt = new Date().toISOString();
    }

    // The seminar budget flow (decision 2, 2026-10-19): what the attendee didn't spend of their
    // advance goes back to the training budget now, recorded once with the person, seminar,
    // amount, OR and date. The budget rule counts their spending instead of their share from
    // here on, so the same amount returns to Unallocated (more, if the seminar now closes and
    // seats nobody used are released too).
    if (handedBack && handedBack.leftover > 0 && !sub.fundReturn) {
      sub.fundReturn = {
        amount: handedBack.leftover,
        orNo: String(sub.refundOrNo).trim(),
        orDate: String(sub.refundOrDate),
        recordedAt: sub.financeValidatedAt,
        recordedBy: (req as any).user.fullName
      };
    }
    if (seminar) {
      const after = seminarBudget(seminar, participantsForBudget());
      const freed = round2(heldBefore - after.committed);
      if (sub.fundReturn || freed !== 0) {
        logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Return to Training Budget",
          `${sub.submissionNo}: ${sub.employeeName}, ${sub.activityTitle || "a seminar"}${sub.fundReturn
            ? `, handed back ${pesoText(sub.fundReturn.amount)} of ${sub.cashAdvanceDvNo ? `the advance on DV ${sub.cashAdvanceDvNo}` : "their advance"} (OR ${sub.fundReturn.orNo}, ${sub.fundReturn.orDate})`
            : handedBack ? ", balanced: the advance fully used" : `, spent ${pesoText(sub.totalSpent)}`}; ${freed > 0
            ? `${pesoText(freed)} returns to the training budget's Unallocated${after.stage === "settled" ? " (the seminar is now settled)" : ""}`
            : freed < 0 ? `the seminar now holds ${pesoText(-freed)} more` : "Unallocated is unchanged"}.`);
      }
    }
    if (isOwnRecord(req.user, sub.employeeId)) {
      flagSelfApproval(req.user, `validated their own liquidation report ${sub.submissionNo} (${pesoText(Number(sub.totalSpent || 0))} spent${
        sub.fundReturn ? `; ${pesoText(sub.fundReturn.amount)} recorded as handed back, OR ${sub.fundReturn.orNo}` : ""})`);
    } else if (groupAdvance && groupAdvance.covers!.some(c => coverIsUser(req.user, c))) {
      flagSelfApproval(req.user, `validated the group liquidation report ${sub.submissionNo} that covers them (${pesoText(Number(sub.totalSpent || 0))} spent, filed by ${sub.employeeName}${
        sub.fundReturn ? `; ${pesoText(sub.fundReturn.amount)} recorded as handed back, OR ${sub.fundReturn.orNo}` : ""})`);
    }

    // The claimant is out of pocket until someone actually releases the money, so put it
    // in front of Finance rather than quietly closing the record.
    if (claimPending) {
      notify({ role: UserRole.FINANCE_OFFICER }, {
        title: "Reimbursement due",
        message: `${sub.employeeName} is owed ₱${owed.toFixed(2)} for ${sub.submissionNo}. Record the payment once the DV is released.`,
        type: "warning",
        link: { tab: "finance", subTab: "liquidation", record: { kind: "liquidationReport", id: sub.id } }
      });
    }
  } else {
    // A Return carries the checklist; the corrected report comes straight back to Finance,
    // since HR's verification still stands (open question 5).
    const parsed = correctionRequestFrom(req.body, sub, req.user, "Verified & Forwarded");
    if ("error" in parsed) return res.status(400).json({ status: "error", message: parsed.error });
    sub.corrections = [...(sub.corrections || []), parsed.request];
    sub.financeStatus = "Returned by Finance";
    sub.financeRemarks = parsed.request.remarks;
    sub.status = "Returned";
    notifyReportReturned(sub, "Finance", parsed.request);
    returnNote = ` (round ${parsed.request.round}: ${parsed.request.items.map(i => i.field).join(", ")})`;
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Finance Validate Liquidation", `Finance evaluated liquidation ${sub.submissionNo} with action ${action}${returnNote}${
    action === "Validate" && sub.withinAllowance ? ` (a reimbursement: ${pesoText(Number(sub.totalSpent))} owed to ${sub.employeeName}, to be paid from the Reimbursement Queue)` : ""}`);
  saveDB();
  res.json({ status: "success", data: sub });
}));

// Closes the loop on an out-of-pocket claim: the employee fronted the money, and this
// records the disbursement voucher that paid them back. Until this runs, the claimant is
// still owed — which is why finance-action leaves the report "Awaiting Reimbursement"
// instead of treating validation as the end of the story.
app.put("/api/liquidation-submissions/:id/record-reimbursement", authenticateToken, transactional((req: any, res: any) => {
  if ((req as any).user.role !== UserRole.FINANCE_OFFICER && (req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only the Financial Officer can record a reimbursement." });
  }

  const { dvNo, date } = req.body;
  const sub = db.liquidationSubmissions.find(l => l.id === req.params.id);
  if (!sub) return res.status(404).json({ status: "error", message: "Submission records not found" });
  // Nobody pays themselves, as nobody releases a cash advance to themselves (the plan approved
  // 2026-10-30; until then it was allowed and flagged): another Financial Officer or the
  // Administrator records it. The seat's employee is checked as well as the report's, since a staff
  // code can be edited (7j).
  const seat = (db.trainingParticipants || []).find((p: any) => p && p.id === sub.activityId);
  if (isOwnRecord(req.user, sub.employeeId) || (seat && isOwnRecord(req.user, seat.employeeId))) {
    return res.status(403).json({ status: "error", message: "You can't record the payment of your own claim: another Financial Officer or the Administrator has to." });
  }

  const owed = round2(Number(sub.reimbursementAmount || 0));
  if (owed <= 0) {
    return res.status(400).json({ status: "error", message: "This report has nothing to reimburse." });
  }
  if (sub.reimbursementStatus === "Reimbursed") {
    return res.status(400).json({ status: "error", message: `Already reimbursed on ${sub.reimbursementDate} via DV ${sub.reimbursementDvNo}.` });
  }
  if (sub.status !== "Completed") {
    return res.status(400).json({ status: "error", message: "Validate the liquidation report before releasing a reimbursement." });
  }
  // What is paid must still agree with the advance on file and with the report's own
  // figures, or the same money goes out twice.
  const mismatch = advanceMismatch(sub);
  const expected = round2(Math.max(0, Number(sub.totalSpent || 0) - Number(sub.totalReleased || 0)));
  if (mismatch || expected !== owed) {
    return res.status(409).json({
      status: "error",
      message: `${mismatch || `${sub.submissionNo}'s figures no longer come to PHP ${owed.toFixed(2)} owed.`} It can't be paid until the report and the cash advance agree.`
    });
  }
  // The voucher it is paid on follows a release's rules (src/dvNumber.ts, 12q): dated no later than
  // today and not before the report was validated, numbered YYYY-MM-NNNN in that date's month, and
  // never a number already on a cash advance or another reimbursement.
  if (!isCalendarDate(date) || date > manilaToday()) {
    return res.status(400).json({ status: "error", message: "Enter the DV date as YYYY-MM-DD, no later than today." });
  }
  const validatedOn = manilaDateOf(sub.financeValidatedAt);
  if (validatedOn && date < validatedOn) {
    return res.status(400).json({ status: "error", message: `The DV can't be dated before the report was validated (${formatLongDate(validatedOn)}).` });
  }
  const dv = readDvNumber(dvNo, date);
  if ("problem" in dv) return res.status(400).json({ status: "error", message: dv.problem });
  const dvUsed = dvInUse(dv.value, { reportId: sub.id });
  if (dvUsed) return res.status(409).json({ status: "error", message: dvUsed });

  sub.reimbursementStatus = "Reimbursed";
  sub.reimbursementDvNo = dv.value;
  sub.reimbursementDate = date;
  sub.reimbursedBy = (req as any).user.fullName;

  notifyEmployee(sub.employeeId, {
    title: "Reimbursement released",
    message: `₱${owed.toFixed(2)} for ${sub.submissionNo} was released on DV ${sub.reimbursementDvNo} dated ${formatLongDate(sub.reimbursementDate)}.`,
    type: "success",
    link: { tab: "employee_portal", record: { kind: "liquidationReport", id: sub.id } },
    dedupeKey: `reimbursed:${sub.id}`
  });

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Record Reimbursement",
    `Reimbursed PHP ${owed.toFixed(2)} to ${sub.employeeName} for ${sub.submissionNo} via DV ${sub.reimbursementDvNo}`);
  saveDB();
  res.json({ status: "success", data: sub });
}));
// Serial for the Vehicle Reservation Slip, e.g. "VRS-2026-09-014". Numbering restarts
// each month, matching the liquidation serial's shape.
function nextVrsNo(when: Date): string {
  const scope = `VRS-${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-`;
  const used = (db.requests || [])
    .map((r: any) => String(r.vrsNo || ""))
    .filter((n: string) => n.startsWith(scope))
    .map((n: string) => Number(n.slice(scope.length)) || 0);
  return `${scope}${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, "0")}`;
}

// --- CASH ADVANCES: the money-out record ---

function isCashAdvanceRole(role: UserRole) {
  return role === UserRole.FINANCE_OFFICER || role === UserRole.SUPER_ADMIN;
}

// Whether the signed-in user is the person a record is about (their own staff record), for
// segregation of duties:
// - Releasing money to yourself is refused: a Financial Officer or the Administrator can't
//   release, decline or refund a cash advance meant for them. Another one does it.
// - The checks along the way are allowed but flagged (the user's decision, 2026-10-20): an
//   officer recording their own attendance, verifying or validating their own report, or
//   recording their own reimbursement is warned on screen and gets a "Self-Approval" audit
//   entry (flagSelfApproval).
function isOwnRecord(user: any, employeeKey: unknown): boolean {
  return !!user?.employeeId && typeof employeeKey === "string" && employeeKey !== ""
    && employeeIdForms(employeeKey).includes(user.employeeId);
}

// The "Self-Approval" audit entry: who acted on their own record, and what they did. Callers save.
function flagSelfApproval(user: any, what: string) {
  logEvent(user.id, user.username, user.role, "Self-Approval",
    `${user.fullName} (${user.role}) ${what}. Allowed, and flagged for review: they acted on their own record.`);
}

// Whether the person an advance is for still works here: their staff record is active and
// their login (if any) isn't archived. Money isn't released to someone who has left.
function payeeIsActive(employeeKey: string): boolean {
  const emp = (db.employees || []).find((e: any) => employeeIdForms(employeeKey).includes(e.id));
  if (!emp || emp.isActive === false) return false;
  const login = (db.users || []).find((u: any) => u.employeeId && employeeIdForms(u.employeeId).includes(emp.id));
  return !(login && (login.status === "Archived" || login.status === "Deactivated"));
}

// An OR number already on another report or refund: each official receipt records one payment.
// The report or advance it is on, or null. Compared without case.
function orNumberInUse(orNo: string, exceptReportId?: string): string | null {
  const key = orNo.trim().toLowerCase();
  if (!key) return null;
  const report = (db.liquidationSubmissions || []).find((s: any) =>
    s && s.id !== exceptReportId && String(s.refundOrNo || "").trim().toLowerCase() === key);
  if (report) return report.submissionNo;
  const advance = (db.cashAdvances || []).find((a: any) => a && String(a.refundOrNo || "").trim().toLowerCase() === key);
  return advance ? advance.advanceNo : null;
}

// "CA-2026-09-001". Numbering restarts each month, like the liquidation serial.
function nextCashAdvanceNo(when: Date): string {
  const scope = `CA-${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-`;
  const used = (db.cashAdvances || [])
    .map((a: any) => String(a.advanceNo || ""))
    .filter((n: string) => n.startsWith(scope))
    .map((n: string) => Number(n.slice(scope.length)) || 0);
  return `${scope}${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, "0")}`;
}

// The advance still open against an assignment and paid to its own employee, if any (a group
// advance only for its holder). Cancelled and already-liquidated ones do not block a fresh release.
function openAdvanceFor(activityId: string, employeeForms: string[]) {
  return advancesCovering(db.cashAdvances || [], activityId).find((a: any) =>
    employeeForms.includes(a.employeeId) && a.status === "Released");
}

// A request the enrolment's own employee made that is still waiting for Finance (at most one): an
// individual request, or a group request they hold. Not one a co-participant made for them.
function pendingRequestFor(activityId: string): CashAdvance | null {
  return (db.cashAdvances || []).find((a: any) => a && a.activityId === activityId && a.status === "Requested") || null;
}

// Any request still waiting for Finance that would pay for the enrolment: its own, or a group
// request covering it. While one waits, no other advance is released for it.
function pendingRequestCovering(activityId: string): CashAdvance | null {
  return advanceCovering(db.cashAdvances || [], activityId, ["Requested"]);
}

// The cash-advance record that stands for an assignment now: a request waiting for Finance,
// the advance released, or else the latest one (settled, refunded, declined), its own or a group's
// covering it. At most one is ever Requested or Released at a time.
function currentAdvanceFor(activityId: string): CashAdvance | null {
  const list = advancesCovering(db.cashAdvances || [], activityId);
  // Its latest event: a refund or settlement comes after the release.
  const when = (a: any) => String(a.refundedAt || a.liquidatedAt || a.decidedAt || a.issuedAt || a.requestedAt || "");
  return list.find((a: any) => a.status === "Requested") || list.find((a: any) => a.status === "Released")
    || [...list].sort((a: any, b: any) => when(b).localeCompare(when(a)))[0] || null;
}

// --- Group cash advances (HSAC RAB 1, 2026-10-26, .claude/context/hsac-answers.md) ---
// Participants who attend together may have one cash advance processed for all of them: one
// participant (the holder) asks for it, receives the cash, files the one liquidation report and
// hands back the one leftover. Lookups are in src/advanceCoverage.ts.

// The staff record of an enrolment, or null.
function enrolmentEmployee(p: any): any | null {
  return p ? (db.employees || []).find((e: any) => e.id === p.employeeId || e.employeeId === p.employeeId) || null : null;
}

// Whether one of a group advance's covers is the signed-in user: by its staff code, or through the
// enrolment's staff record, since a staff code can be edited (7j) and an enrolment keeps the internal id.
function coverIsUser(user: any, c: CashAdvanceCover): boolean {
  if (isOwnRecord(user, c.employeeId)) return true;
  const p = (db.trainingParticipants || []).find((x: any) => x && x.id === c.participantId);
  return !!p && isOwnRecord(user, p.employeeId);
}

// Whether the signed-in user is paid or covered by an advance: its holder, or anyone it covers.
// Nobody releases, declines or refunds an advance that pays for them.
function advanceInvolves(user: any, a: CashAdvance): boolean {
  return isOwnRecord(user, a.employeeId) || (a.covers || []).some(c => coverIsUser(user, c));
}

// What the holder (or a co-participant) may be told about someone who can't be covered: no more than
// they need (RA 10173). Whether they attended, have an allowance or are settled; anything else
// (another advance or report, no longer active) is "can't be included now". Finance's replies and
// the audit log keep the exact reason.
const SHAREABLE_COVER_REASONS = new Set(["did not attend", "has no allowance from HR yet", "is already liquidated"]);
function coverReasonForHolder(why: string): string {
  return SHAREABLE_COVER_REASONS.has(why) ? why : "can't be included now";
}

// "Ana, Ben and Carla".
function namesText(names: string[]): string {
  return names.length <= 1 ? (names[0] || "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Why a co-participant can't be covered by the holder's group advance now, or null. The words follow
// their name ("Ana Cruz did not attend"); they name no other record, since the holder sees them.
// `exceptAdvanceId`: the group advance being released, which already covers them.
function groupCoverProblem(member: any, holder: any, exceptAdvanceId?: string): string | null {
  if (!member || !holder || member.trainingProgramId !== holder.trainingProgramId) return "isn't in this seminar";
  if (member.status === "Cancelled" || member.status === "Archived") return "is no longer on this seminar";
  if (member.status === "Liquidated") return "is already liquidated";
  if (member.attendance === "Did not attend") return "did not attend";
  if (reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], member.id)) return "already has a liquidation report for this seminar";
  const open = advancesCovering(db.cashAdvances || [], member.id)
    .find((a: any) => a.id !== exceptAdvanceId && (a.status === "Requested" || a.status === "Released"));
  if (open) return open.status === "Requested" ? "already has a cash advance request waiting" : "already has a cash advance for this seminar";
  const emp = enrolmentEmployee(member);
  if (!emp || !payeeIsActive(emp.employeeId || emp.id)) return "is no longer active";
  if (!(round2(Number(member.allowanceAllocated || 0)) > 0)) return "has no allowance from HR yet";
  return null;
}

// groupCoverProblem's words addressed to the person ("you did not attend", "you are no longer active").
function youForm(why: string): string {
  return why.replace(/^isn't /, "aren't ").replace(/^is /, "are ").replace(/^(already )?has /, "$1have ");
}

// The vehicle request filed with an advance (HSAC RAB 1: "Yes, pwede"), for the cash-advance screens:
// its number and status, added on the way out, never stored on the advance.
function withVehicle<T>(a: T): T {
  const id = (a as any)?.vehicleRequestId;
  if (!id) return a;
  const v: any = (db.requests || []).find((r: any) => r && r.id === id);
  return v ? { ...(a as any), vehicle: { vrsNo: v.vrsNo, status: v.status } } : a;
}

// The vehicle request standing for this enrolment's seminar (anything the Division Chief hasn't
// rejected): one filed with their own cash advance, or with a group's advance that covers them, since
// that trip includes them. One per seminar: asking again after Finance declines the advance doesn't file
// a second vehicle, nor does a member asking on their own while their group's still stands.
function vehicleRequestFor(participantId: string, exceptId?: string): any {
  return (db.requests || []).find((r: any) => {
    if (!r || r.id === exceptId || r.requestType !== RequestType.VEHICLE || r.status === RequestStatus.REJECTED) return false;
    if (r.trainingParticipantId === participantId) return true;
    const a: any = r.cashAdvanceId ? (db.cashAdvances || []).find((x: any) => x && x.id === r.cashAdvanceId) : null;
    return !!a && advanceCovers(a, participantId);
  }) || null;
}

// A group advance still open that someone else holds for this enrolment, or null.
function groupCoveringOthers(participantId: string): CashAdvance | null {
  const a = advanceCovering(db.cashAdvances || [], participantId, ["Requested", "Released"]);
  return a && a.activityId !== participantId ? a : null;
}

// What a covered member's card says about the group advance that pays for them.
function coveredText(a: CashAdvance, participantId: string): string {
  const share = pesoText(pesos(portionCentavos(a, participantId)));
  return a.status === "Requested"
    ? `${a.employeeName} asked Finance for one cash advance for your group, ${share} of it for you, so you don't need to ask for your own.`
    : `${a.employeeName} holds your group's cash advance ${a.advanceNo} (DV ${a.dvNo}), ${share} of it for you, and files the group's liquidation report.`;
}

// Whether the enrolment's employee may ask Finance for their cash advance, and why not. The
// seminar card shows the reason; POST /api/cash-advances/request enforces it.
function advanceRequestEligibility(p: any): { canRequest: boolean; reason?: string } {
  if (p.status === "Cancelled" || p.status === "Archived") return { canRequest: false, reason: "This enrolment was cancelled." };
  if (p.status === "Liquidated") return { canRequest: false, reason: "This seminar is already liquidated." };
  if (p.attendance === "Did not attend") return { canRequest: false, reason: "HR recorded that you did not attend, so no cash advance can be released." };
  const group = groupCoveringOthers(p.id);
  if (group) return { canRequest: false, reason: coveredText(group, p.id) };
  const report = reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], p.id);
  if (report) return { canRequest: false, reason: `Report ${report.submissionNo} has already been filed for this seminar.` };
  const current = currentAdvanceFor(p.id);
  if (current?.status === "Requested") return { canRequest: false, reason: "Your request is waiting for Finance." };
  if (current?.status === "Released") return { canRequest: false, reason: `Finance released ${current.advanceNo} (DV ${current.dvNo}).` };
  // (One refunded in full was given back, so asking again is fine.)
  if (current?.status === "Liquidated") return { canRequest: false, reason: `${current.advanceNo} is already liquidated.` };
  const elsewhere = openAdvanceElsewhere(p.employeeId, p.id);
  if (elsewhere) {
    return { canRequest: false, reason: `Your cash advance ${openAdvanceText(elsewhere)} isn't liquidated or refunded yet. COA rules allow a new cash advance only after the previous one is settled.` };
  }
  if (!(round2(Number(p.allowanceAllocated || 0)) > 0)) return { canRequest: false, reason: "HR hasn't set an allowance for you on this seminar yet." };
  return { canRequest: true };
}

app.get("/api/cash-advances", authenticateToken, (req: any, res) => {
  const { role, employeeId } = req.user;
  const all = db.cashAdvances || [];
  // (Each with the vehicle request filed alongside, if any: its number and status.)
  if (isCashAdvanceRole(role)) {
    return res.json({ status: "success", data: all.map(withVehicle) });
  }
  // Everyone else sees only their own, so the employee's liquidation form can fill and
  // lock its DV fields from the real record, and a group advance that covers them, for their
  // seminar card: who holds it, its status, the total and their own share only (not the others'
  // shares or staff codes, nor Finance's reasons, which are written for the holder).
  const forms = employeeIdForms(employeeId || "");
  const covered = (a: any) => Array.isArray(a.covers) && a.covers.some((c: any) => coverIsUser(req.user, c));
  res.json({
    status: "success",
    data: all
      .filter((a: any) => a && (forms.includes(a.employeeId) || covered(a)))
      .map((a: any) => forms.includes(a.employeeId) ? withVehicle(a) : {
        id: a.id, advanceNo: a.advanceNo, status: a.status,
        employeeName: a.employeeName, activityId: a.activityId, activityTitle: a.activityTitle, amount: a.amount,
        dvNo: a.dvNo, dvDate: a.dvDate, requestedAt: a.requestedAt, decidedAt: a.decidedAt, issuedAt: a.issuedAt,
        liquidatedAt: a.liquidatedAt, refundedAt: a.refundedAt,
        covers: a.covers.filter((c: any) => coverIsUser(req.user, c)),
        coversCount: a.covers.length,
        // (The group's vehicle, if one was asked for: they may be among its passengers.)
        vehicle: withVehicle(a).vehicle
      })
  });
});

// When an assignment was made. Enrolments and activities have no date of their own, but their
// ids carry the moment they were created (`part-<ms>-…`, `act-<ms>`). "" when an id doesn't.
function createdAtFromId(id: unknown): string {
  const m = /^(?:part|act)-(\d{12,14})(?:-|$)/.exec(String(id ?? ""));
  const ms = m ? Number(m[1]) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

// Who Finance may release money to, and who has already been funded.
//
// Finance cannot read the HR training tables (isTrainingRecordsRole excludes them), but
// they cannot release a cash advance without knowing who is assigned to what. This returns
// the minimum needed to do that - name, what it is for, HR's allocated ceiling, and the
// funding state - all derived server-side. It is not a window onto the HR module: no
// training needs, recommendations, plan entries or PDS history are exposed.
// Why no request can come yet for an unfunded seat, said to Finance: an advance is released only on the
// employee's request, made from their seminar card in the portal (Personnel only). Null while one can.
function noRequestReason(p: any, emp: any): string | null {
  if (!payeeIsActive(emp.employeeId || emp.id)) return "No longer active, so no cash advance can be asked for.";
  const login = (db.users || []).some((u: any) => u && u.role === UserRole.EMPLOYEE && u.status !== "Archived" && u.status !== "Deactivated"
    && employeeByKey(String(u.employeeId || ""))?.id === emp.id);
  if (!login) return "No Personnel login, so they can't ask from the portal. The Administrator can create one, or a colleague's group request can include them.";
  if (!(round2(Number(p.allowanceAllocated || 0)) > 0)) return "HR has set no allowance for them on this seminar, so there is nothing to ask for yet.";
  const elsewhere = openAdvanceElsewhere(p.employeeId, p.id);
  if (elsewhere) return `Their cash advance ${openAdvanceText(elsewhere)} isn't settled yet. COA rules allow a new one only after it is.`;
  return null;
}

app.get("/api/cash-advances/fundable", authenticateToken, (req: any, res) => {
  if (!isCashAdvanceRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Cash advances are restricted to the Financial Officer." });
  }

  const rows: any[] = [];
  const advanceFor = (activityId: string, forms: string[]) => {
    const open = openAdvanceFor(activityId, forms);
    if (open) return open;
    return (db.cashAdvances || []).find((a: any) =>
      a.activityId === activityId && forms.includes(a.employeeId) && (a.status === "Liquidated" || a.status === "Refunded")) || null;
  };

  for (const p of (db.trainingParticipants || [])) {
    if (p.status === "Archived") continue;
    // A representative went in their place (12z Part B): listed only for the refund their own advance
    // needed first, so it stays on Finance's record. A cancelled enrolment is never funded.
    const replaced = p.status === "Cancelled" && !!p.replacedBy;
    if (p.status === "Cancelled" && !replaced) continue;
    const emp = (db.employees || []).find((e: any) => e.id === p.employeeId || e.employeeId === p.employeeId);
    if (!emp) continue;
    // Someone a co-participant's group advance covers isn't listed apart (nor funded twice): the
    // holder's row names everyone it covers, and Finance acts on it there.
    // (Once a group was refunded in full, or declined, it no longer stands for them: an attendance
    // correction may leave them to be funded on their own.)
    const covering = currentAdvanceFor(p.id);
    if (covering && isGroupAdvance(covering) && covering.activityId !== p.id
        && (covering.status === "Requested" || covering.status === "Released" || covering.status === "Liquidated")) continue;
    const facts = liquidationActivityFacts(p.id);
    const forms = employeeIdForms(p.employeeId);
    const advance = advanceFor(p.id, forms);
    if (replaced && advance?.status !== "Refunded") continue;
    // Someone who did not attend gets no new advance and no liquidation form. One already
    // released stays listed, flagged, so Finance collects it back in full and records the
    // refund; a refunded one is listed as such.
    const didNotAttend = p.attendance === "Did not attend";
    // (A group's holder who didn't attend stays listed once it is settled: the row is the group's.)
    if (didNotAttend && !(advance && (advance.status === "Released" || advance.status === "Refunded"
        || (advance.status === "Liquidated" && isGroupAdvance(advance))))) continue;
    // The employee's own request, while it waits: Finance releases or declines it from the
    // request list rather than releasing the row directly.
    const request = pendingRequestFor(p.id);
    // A group advance this row holds: who it covers, and whether none of them attended (only then
    // is it refunded in full; otherwise the group's one report settles it).
    const group = [advance, request].find((a: any) => a && isGroupAdvance(a)) as CashAdvance | undefined;
    rows.push({
      groupNames: group ? group.covers!.map(c => c.employeeName) : null,
      groupAllAbsent: !!group && group.covers!.every(c =>
        (db.trainingParticipants || []).find((x: any) => x && x.id === c.participantId)?.attendance === "Did not attend"),
      didNotAttend,
      // Their own advance can still be handed back in full: released to them, the seminar still to
      // come, no attendance recorded (a representative goes in their place only once it is back).
      refundBeforeSeminar: !!advance && advance.status === "Released" && !isGroupAdvance(advance) && !p.attendance && seminarNotStarted(p.trainingProgramId),
      // Handed back before the seminar, as recorded then.
      refundedBeforeSeminar: !!advance && advance.status === "Refunded" && !!advance.refundedBeforeSeminar,
      // (Finance needs only that a representative took the seat, not who: RA 10173.)
      replaced,
      advanceId: advance ? advance.id : null,
      refundOrNo: advance?.status === "Refunded" ? advance.refundOrNo : null,
      refundOrDate: advance?.status === "Refunded" ? advance.refundOrDate : null,
      pendingRequestId: request ? request.id : null,
      requestedAt: request ? request.requestedAt : null,
      // An advance is released only on the employee's request: when none can come yet, why, so the desk
      // doesn't only say it is waiting.
      requestBlocked: !request && !advance ? noRequestReason(p, emp) : null,
      activityId: p.id,
      activityTitle: facts ? facts.title : "Seminar",
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      allocated: facts ? facts.allocated : 0,
      assignmentStatus: p.status,
      funded: !!(advance && advance.status === "Released"),
      advanceNo: advance ? advance.advanceNo : null,
      advanceAmount: advance ? advance.amount : null,
      // The voucher it went out on, so Finance can see it after the release.
      advanceDvNo: advance ? advance.dvNo : null,
      advanceDvDate: advance ? advance.dvDate : null,
      // For the desk's newest-first order (LIFO).
      assignedAt: createdAtFromId(p.id),
      advanceIssuedAt: advance ? advance.issuedAt || null : null,
      advanceSettledAt: advance ? advance.liquidatedAt || null : null,
      advanceRefundedAt: advance ? advance.refundedAt || null : null,
      advanceStatus: advance ? advance.status : null,
      liquidationFiled: !!reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], p.id)
    });
  }

  for (const a of (db.activities || [])) {
    if (a.status === "Completed") continue;
    const assigned = String(a.assignedEmployeeId || "").trim();
    // Activity.assignedEmployeeId holds an id OR a full name (src/types.ts), so match both.
    const emp = (db.employees || []).find((e: any) =>
      e.id === assigned || e.employeeId === assigned ||
      String(e.fullName || "").trim().toLowerCase() === assigned.toLowerCase());
    const facts = liquidationActivityFacts(a.id);
    const forms = emp ? [emp.id, emp.employeeId].filter(Boolean) : [assigned];
    const advance = advanceFor(a.id, forms);
    rows.push({
      activityId: a.id,
      activityTitle: facts ? facts.title : (a.title || "Activity"),
      employeeId: emp ? emp.employeeId : assigned,
      employeeName: emp ? emp.fullName : assigned,
      allocated: facts ? facts.allocated : 0,
      assignmentStatus: a.status,
      funded: !!(advance && advance.status === "Released"),
      advanceNo: advance ? advance.advanceNo : null,
      advanceAmount: advance ? advance.amount : null,
      // The voucher it went out on, so Finance can see it after the release.
      advanceDvNo: advance ? advance.dvNo : null,
      advanceDvDate: advance ? advance.dvDate : null,
      assignedAt: createdAtFromId(a.id),
      advanceIssuedAt: advance ? advance.issuedAt || null : null,
      advanceSettledAt: advance ? advance.liquidatedAt || null : null,
      advanceRefundedAt: advance ? advance.refundedAt || null : null,
      advanceStatus: advance ? advance.status : null,
      // (No request can come for a general activity: the request is a seminar's. None exists, 13c.)
      requestBlocked: !advance ? "Only a seminar's cash advance can be requested." : null,
      liquidationFiled: (db.liquidationSubmissions || []).some((l: any) => l.activityId === a.id)
    });
  }

  // Newest first (LIFO, like the office's request lists): by each row's latest event, its
  // assignment, release, settlement or refund. The desk orders each of its lists by its own.
  const latest = (r: any) => Math.max(0, ...[r.assignedAt, r.advanceIssuedAt, r.advanceSettledAt, r.advanceRefundedAt]
    .map((t: any) => Date.parse(t || "") || 0));
  rows.sort((x, y) => latest(y) - latest(x));
  res.json({ status: "success", data: rows });
});

// Finance's old direct release. A cash advance is released only on the employee's request: their own,
// a group's ("For my group…") or one filed with a vehicle, each made from their seminar card and
// released (or declined) under Cash Advance Requests through /:id/release. Releasing one nobody asked
// for put Finance's choice in place of the employee's (the user, 2026-10-29), so this only refuses.
app.post("/api/cash-advances", authenticateToken, (req: any, res: any) => {
  if (!isCashAdvanceRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Only the Financial Officer can release a cash advance." });
  }
  res.status(409).json({
    status: "error",
    message: "A cash advance is released only on the employee's request: their own, a group request or one filed with a vehicle. They ask for it from their seminar card; it then waits under Cash Advance Requests, where you release it with its disbursement voucher."
  });
});

// An attendee asks Finance for their seminar's cash advance (the seminar budget flow). The
// amount is their allowance (allocation ÷ seats, HR's ceiling), set here and never typed.
// Only for seminars, the only assignments there are (general activities can't be created, 13c).
app.post("/api/cash-advances/request", authenticateToken, transactional((req: any, res: any) => {
  const activityId = typeof req.body?.activityId === "string" ? req.body.activityId : "";
  const enrolment = activityId ? (db.trainingParticipants || []).find((p: any) => p && p.id === activityId) : null;
  if (!enrolment) {
    return res.status(404).json({ status: "error", message: "That seminar enrolment was not found. A cash advance is asked for from the seminar's card, for a seminar you are on." });
  }
  // Only the person enrolled, as with their liquidation report.
  if (!req.user.employeeId || !employeeIdForms(enrolment.employeeId).includes(req.user.employeeId)) {
    return res.status(403).json({ status: "error", message: "You can only request a cash advance for a seminar you are enrolled in." });
  }
  const eligibility = advanceRequestEligibility(enrolment);
  if (!eligibility.canRequest) return res.status(409).json({ status: "error", message: eligibility.reason });
  const facts = liquidationActivityFacts(enrolment.id);
  const emp = (db.employees || []).find((e: any) => e.id === enrolment.employeeId || e.employeeId === enrolment.employeeId);
  if (!facts || !emp) return res.status(404).json({ status: "error", message: "Your staff record or the seminar was not found." });
  // Money isn't released to someone who has left, so their request (and a group's) would only block
  // the others: refused here, as at release.
  if (!payeeIsActive(emp.employeeId || emp.id)) {
    return res.status(409).json({ status: "error", message: "Your staff record is no longer active, so no cash advance can be requested." });
  }

  // A group advance (HSAC RAB 1, 2026-10-26): the co-participants of the same seminar it also pays
  // for, each at their allowance. The one asking holds it. None listed: their own advance, as before.
  const rawCover = req.body?.coverParticipantIds;
  if (rawCover !== undefined && (!Array.isArray(rawCover) || rawCover.length > 200
      || rawCover.some((id: unknown) => typeof id !== "string" || id.length > 100))) {
    return res.status(400).json({ status: "error", message: "Choose the participants your group's cash advance covers." });
  }
  const memberIds = [...new Set<string>((rawCover || []).filter((id: string) => id && id !== enrolment.id))];
  const members: any[] = [];
  const problems: string[] = [];
  for (const id of memberIds) {
    const member = (db.trainingParticipants || []).find((p: any) => p && p.id === id);
    const why = groupCoverProblem(member, enrolment);
    // (Someone outside the seminar isn't named, and a colleague's reason is no more than needed.)
    if (why) problems.push(why === "isn't in this seminar" ? "one of them isn't in this seminar" : `${enrolmentEmployee(member)?.fullName || "One of them"} ${coverReasonForHolder(why)}`);
    else members.push(member);
  }
  if (problems.length > 0) {
    return res.status(409).json({ status: "error", message: `Your group's cash advance can't cover everyone you chose: ${problems.join("; ")}. Untick them and send it again.` });
  }
  const covers: CashAdvanceCover[] | undefined = members.length === 0 ? undefined : [
    { participantId: enrolment.id, employeeId: emp.employeeId, employeeName: emp.fullName, amount: facts.allocated },
    ...members.map((m: any) => {
      const e = enrolmentEmployee(m);
      return { participantId: m.id, employeeId: e.employeeId, employeeName: e.fullName, amount: round2(Number(m.allowanceAllocated || 0)) };
    })
  ];
  // Nobody decides an advance that pays for them, so a group must leave out at least one officer who
  // can release or decline it; otherwise it would wait for good, blocking everyone it covers.
  if (covers) {
    const prospective = { employeeId: emp.employeeId, covers } as CashAdvance;
    const deciders = (db.users || []).filter((u: any) => u && isCashAdvanceRole(u.role) && u.status !== "Archived" && u.status !== "Deactivated");
    if (!deciders.some((u: any) => !advanceInvolves(u, prospective))) {
      return res.status(409).json({
        status: "error",
        message: "This group would include everyone who can release a cash advance (the Financial Officer and the Administrator), so nobody could act on it. Leave one of them out."
      });
    }
  }
  // "Also request a vehicle" (HSAC RAB 1: "Yes, pwede"): filed in the same step, so both are made or
  // neither. Checked strictly here, unlike the general request form.
  let vehicle: VehicleWithAdvanceFields | null = null;
  // One vehicle request per seminar: one already standing (filed with an earlier, declined request, or
  // with a group's that includes them) isn't filed again, and their own goes with this request instead.
  const standingVehicle = vehicleRequestFor(enrolment.id);
  if (req.body?.vehicle !== undefined && req.body?.vehicle !== null) {
    if (standingVehicle) {
      const ref = `${standingVehicle.vrsNo || "on file"}: ${standingVehicle.status}`;
      return res.status(409).json({
        status: "error",
        message: standingVehicle.trainingParticipantId === enrolment.id
          ? `You already asked for a vehicle for this seminar (${ref}). Untick it to send the cash advance request alone.`
          : `A vehicle request for this seminar already includes you (${ref}), filed by ${standingVehicle.employeeName} with your group's request. Untick it to send the cash advance request alone.`
      });
    }
    // ...nor one for someone the group covers who is on a vehicle request for this seminar already.
    const onAnother = members.filter((m: any) => vehicleRequestFor(m.id));
    if (onAnother.length > 0) {
      const names = namesText(onAnother.map((m: any) => enrolmentEmployee(m)?.fullName || "One of them"));
      return res.status(409).json({
        status: "error",
        message: `${names} ${onAnother.length === 1 ? "is" : "are"} already on a vehicle request for this seminar. Untick ${onAnother.length === 1 ? "them" : "those people"}, or the vehicle.`
      });
    }
    const prog: any = (db.trainingPrograms || []).find((p: any) => p && p.id === enrolment.trainingProgramId);
    const v = checkVehicleWithAdvance(req.body.vehicle, manilaToday(), prog ? { startDate: prog.startDate, endDate: prog.endDate } : undefined);
    if ("error" in v) return res.status(400).json({ status: "error", message: v.error });
    vehicle = v.fields;
  }

  const request: CashAdvance = {
    id: `ca-${crypto.randomUUID()}`,
    advanceNo: "",            // numbered when released
    employeeId: emp.employeeId,
    employeeName: emp.fullName,
    activityId: enrolment.id,
    activityTitle: facts.title,
    amount: covers ? coversTotal(covers) : facts.allocated,
    dvNo: "",
    dvDate: "",
    purpose: facts.title,
    issuedBy: "",
    issuedAt: "",
    status: "Requested",
    requestedAt: new Date().toISOString(),
    requestedBy: req.user.fullName,
    ...(covers ? { covers } : {})
  };
  db.cashAdvances.push(request);
  // The vehicle request, linked both ways. It starts with the Division Chief (the Administrator), as
  // any vehicle request does, and is decided apart from the advance.
  let vehicleReq: any = null;
  if (vehicle) {
    vehicleReq = {
      id: `req-${crypto.randomUUID()}`,
      requestType: RequestType.VEHICLE,
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      dateRequested: manilaToday(),
      status: RequestStatus.ENDORSED_TO_CHIEF,
      ...vehicleRequestFields(vehicle),
      trainingParticipantId: enrolment.id,
      trainingProgramId: enrolment.trainingProgramId,
      cashAdvanceId: request.id
    };
    db.requests.push(vehicleReq);
    request.vehicleRequestId = vehicleReq.id;
    notify({ role: UserRole.SUPER_ADMIN }, {
      title: `New ${RequestType.VEHICLE}`,
      message: `${emp.fullName} submitted a ${RequestType.VEHICLE} (${vehicleReq.vrsNo}) for ${facts.title}, filed with their cash advance request.`,
      type: "info",
      link: { tab: "requests", record: { kind: "request", id: vehicleReq.id } }
    });
    logEvent(req.user.id, req.user.username, req.user.role, "Create Request",
      `Submitted digital request: ${RequestType.VEHICLE} ${vehicleReq.vrsNo} for ${facts.title}, filed with cash advance request ${request.id}.`);
  }
  // Asked again after a decline: their vehicle request, still standing, goes with this request, so the
  // request screens show the advance that is live, and Finance sees the vehicle with it. Not when the
  // group now covers someone already on another vehicle request for the seminar: that would make two.
  const ownStanding = !vehicleReq && standingVehicle && standingVehicle.trainingParticipantId === enrolment.id ? standingVehicle : null;
  const onOtherVehicles = ownStanding ? members.filter((m: any) => vehicleRequestFor(m.id, ownStanding.id)) : [];
  if (ownStanding && onOtherVehicles.length === 0) {
    ownStanding.cashAdvanceId = request.id;
    request.vehicleRequestId = ownStanding.id;
  }
  const linkedVehicle: any = vehicleReq || (request.vehicleRequestId ? standingVehicle : null);
  const vehicleStays = ownStanding && onOtherVehicles.length > 0
    ? ` Your vehicle request ${ownStanding.vrsNo} stays with your earlier request: ${namesText(onOtherVehicles.map((m: any) => enrolmentEmployee(m)?.fullName || "one of them"))} ${onOtherVehicles.length === 1 ? "is" : "are"} on another vehicle request for this seminar.`
    : "";
  const groupNames = covers ? namesText(covers.map(c => c.employeeName)) : "";
  const alsoVehicle = vehicleReq ? ` They also asked for a vehicle (${vehicleReq.vrsNo}), which the Division Chief decides.`
    : linkedVehicle ? ` Their vehicle request ${linkedVehicle.vrsNo} (${linkedVehicle.status}) goes with it.` : "";
  notify({ role: UserRole.FINANCE_OFFICER }, {
    title: covers ? "Group cash advance requested" : "Cash advance requested",
    message: (covers
      ? `${emp.fullName} asked for one ${pesoText(request.amount)} cash advance for ${covers.length} participants of ${facts.title}: ${groupNames}. Release it with a DV, or decline it.`
      : `${emp.fullName} asked for their ${pesoText(request.amount)} cash advance for ${facts.title}. Release it with a DV, or decline it.`) + alsoVehicle,
    type: "info",
    link: { tab: "finance", subTab: "liquidation", record: { kind: "cashAdvance", id: request.id } }
  });
  for (const c of (covers || []).slice(1)) {
    notifyEmployee(c.employeeId, {
      title: "Group cash advance requested",
      message: `${emp.fullName} asked Finance for one cash advance for your group at ${facts.title}, ${pesoText(c.amount)} of it for you, so you don't need to ask for your own. ${emp.fullName} receives the cash and files the group's liquidation report. To have your own instead, leave the request from your seminar card before Finance releases it.`,
      type: "info",
      link: { tab: "employee_portal", record: { kind: "assignment", id: c.participantId } },
      dedupeKey: `ca-group:${request.id}:${c.participantId}`
    });
  }
  logEvent(req.user.id, req.user.username, req.user.role, "Request Cash Advance",
    `${emp.fullName} asked for ${pesoText(request.amount)} for ${facts.title}${covers
      ? `, one advance for a group of ${covers.length}: ${covers.map(c => `${c.employeeName} (${pesoText(c.amount)})`).join(", ")}` : ""}`
    + (linkedVehicle && !vehicleReq ? `, with vehicle request ${linkedVehicle.vrsNo} (still standing)` : ""));
  saveDB();
  res.json({
    status: "success",
    message: (covers
      ? `Your request for ${pesoText(request.amount)} for your group of ${covers.length} was sent to Finance.`
      : `Your request for ${pesoText(request.amount)} was sent to Finance.`)
      + (vehicleReq ? ` Your vehicle request ${vehicleReq.vrsNo} went to the Division Chief.`
        : linkedVehicle ? ` Your vehicle request ${linkedVehicle.vrsNo} goes with it.` : vehicleStays),
    data: withVehicle(request)
  });
}));

// Who an attendee's group cash advance could cover: their co-participants in the seminar, each with
// why not when they can't be. Only for the employee enrolled; it lists names and allowances only.
app.get("/api/cash-advances/group-options", authenticateToken, (req: any, res: any) => {
  const activityId = typeof req.query?.activityId === "string" ? req.query.activityId : "";
  const enrolment = activityId ? (db.trainingParticipants || []).find((p: any) => p && p.id === activityId) : null;
  if (!enrolment) return res.status(404).json({ status: "error", message: "That seminar enrolment was not found." });
  if (!req.user.employeeId || !employeeIdForms(enrolment.employeeId).includes(req.user.employeeId)) {
    return res.status(403).json({ status: "error", message: "You can only see the participants of a seminar you are enrolled in." });
  }
  // Only someone who may ask now sees the list (RA 10173: co-participants' states aren't theirs to
  // browse). Inactive colleagues are left out rather than labelled, a colleague's reason says no more
  // than the holder needs (coverReasonForHolder), and an allowance shows only for someone coverable.
  const eligibility = advanceRequestEligibility(enrolment);
  if (!eligibility.canRequest) {
    return res.json({ status: "success", data: { canRequest: false, reason: eligibility.reason || null, ownAllowance: 0, options: [] } });
  }
  const options = (db.trainingParticipants || [])
    .filter((p: any) => p && p.trainingProgramId === enrolment.trainingProgramId && p.id !== enrolment.id && p.status !== "Cancelled" && p.status !== "Archived")
    .filter((p: any) => { const e = enrolmentEmployee(p); return !!e && payeeIsActive(e.employeeId || e.id); })
    .map((p: any) => {
      const name = enrolmentEmployee(p)?.fullName || "A participant";
      const why = groupCoverProblem(p, enrolment);
      return {
        participantId: p.id,
        employeeName: name,
        allowance: why ? null : round2(Number(p.allowanceAllocated || 0)),
        canCover: !why,
        reason: why ? `${name} ${coverReasonForHolder(why)}.` : null
      };
    })
    .sort((a: any, b: any) => a.employeeName.localeCompare(b.employeeName));
  res.json({
    status: "success",
    data: { canRequest: true, reason: null, ownAllowance: round2(Number(enrolment.allowanceAllocated || 0)), options }
  });
});

// Takes one co-participant off a group request Finance hasn't released (they leave it, or a
// representative is sent in their place, 12z Part B): the rest stay covered, and with only the holder
// left it is their own request. Callers notify, log and save.
function removeFromGroupRequest(request: CashAdvance, participantId: string) {
  const rest = (request.covers || []).filter(c => c.participantId !== participantId);
  if (rest.length <= 1) delete request.covers;
  else request.covers = rest;
  request.amount = request.covers ? coversTotal(request.covers) : round2(Number(rest[0]?.amount || 0));
}

// A covered member leaves a group request Finance hasn't released yet (the user's decision,
// 2026-10-26): they'd rather have their own advance. The request is re-priced without them; with
// only the holder left, it is the holder's own request. Once released, the cash is with the holder.
app.post("/api/cash-advances/:id/leave", authenticateToken, transactional((req: any, res: any) => {
  const request = (db.cashAdvances || []).find((a: any) => a && a.id === req.params.id);
  if (!request) return res.status(404).json({ status: "error", message: "Cash advance request not found." });
  const me = (request.covers || []).find((c: any) => c.participantId !== request.activityId && coverIsUser(req.user, c));
  if (!me) {
    return res.status(403).json({
      status: "error",
      message: isOwnRecord(req.user, request.employeeId)
        ? "You asked for this request. If your group no longer needs it, ask Finance to decline it."
        : "This cash advance doesn't cover you."
    });
  }
  if (request.status !== "Requested") {
    return res.status(409).json({
      status: "error",
      message: request.status === "Released"
        ? `Finance has already released ${request.advanceNo} to ${request.employeeName}: your share comes back in the group's liquidation report.`
        : `This request was already ${String(request.status).toLowerCase()}.`
    });
  }
  removeFromGroupRequest(request, me.participantId);
  const title = request.activityTitle || "the seminar";
  notifyEmployee(request.employeeId, {
    title: "A participant left your group's request",
    message: `${me.employeeName} left your group cash advance request for ${title}. It is now ${pesoText(request.amount)}${request.covers ? ` for ${request.covers.length} participants` : ", for you alone"}.`,
    type: "info",
    link: { tab: "employee_portal", record: { kind: "assignment", id: request.activityId } }
  });
  logEvent(req.user.id, req.user.username, req.user.role, "Leave Group Cash Advance Request",
    `${me.employeeName} left ${request.employeeName}'s group cash advance request for ${title}; it is now ${pesoText(request.amount)}${request.covers ? ` for ${namesText(request.covers.map((c: any) => c.employeeName))}` : ` for ${request.employeeName} alone`}.`);
  saveDB();
  res.json({ status: "success", message: `You left ${request.employeeName}'s group request. You can now ask Finance for your own cash advance.`, data: { id: request.id, status: request.status } });
}));

// Why Finance can't release an employee's request now, or null. Checked again at release,
// since the seminar may have changed since the request (attendance, a report, HR's allowance).
function requestReleaseProblem(request: CashAdvance): string | null {
  const enrolment = (db.trainingParticipants || []).find((p: any) => p && p.id === request.activityId);
  const facts = enrolment ? liquidationActivityFacts(enrolment.id) : null;
  if (!enrolment || !facts) return "The seminar enrolment no longer exists, so nothing can be released. Decline the request.";
  if (enrolment.status === "Cancelled" || enrolment.status === "Archived") return "This enrolment was cancelled, so nothing can be released. Decline the request.";
  if (enrolment.status === "Liquidated") return "This seminar is already liquidated, so nothing can be released. Decline the request.";
  if (enrolment.attendance === "Did not attend") return `HR recorded that ${request.employeeName} did not attend, so nothing can be released. Decline the request.`;
  const filed = reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], request.activityId);
  if (filed) return `${filed.submissionNo} has already been filed for this seminar, so no advance can be released for it. Decline the request.`;
  const open = releasedAdvanceForAssignment(request.activityId);
  if (open) return `${open.advanceNo} (DV ${open.dvNo}) is already out for this seminar. Decline the request.`;
  if (!payeeIsActive(request.employeeId)) return `${request.employeeName} is no longer active, so nothing can be released. Decline the request.`;
  // The request can wait: it can be released once the other advance is settled.
  const elsewhere = openAdvanceElsewhere(request.employeeId, request.activityId);
  if (elsewhere) {
    return `${request.employeeName} still has cash advance ${openAdvanceText(elsewhere)} not liquidated or refunded. COA rules allow no new cash advance until it is settled, so release this one after that, or decline it.`;
  }
  // HR may have re-priced the seminar since: the release is the allowance as it is now.
  if (!(centavos(facts.allocated) > 0)) return `HR has set no allowance for ${request.employeeName} on this seminar, so nothing can be released. Decline the request, or ask HR to set one.`;
  return null;
}

// The calendar date in the Philippines (UTC+8) of a stored timestamp, as YYYY-MM-DD, or "".
function manilaDateOf(iso: string | undefined): string {
  const ms = Date.parse(String(iso || ""));
  return isNaN(ms) ? "" : new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Each voucher has its own number (12q), whether it released a cash advance or paid a reimbursement
// (2026-10-30): one already used is a typing slip, or the same voucher paying twice. Compared as the
// same voucher however it was typed (dvKey), since earlier numbers were free text ("2026-10-101").
// The refusal, or null.
function dvInUse(dvNo: string, except: { advanceId?: string; reportId?: string } = {}): string | null {
  const key = dvKey(dvNo);
  const advance = (db.cashAdvances || []).find((a: any) => a && a.id !== except.advanceId && a.dvNo && dvKey(a.dvNo) === key);
  if (advance) return `DV ${dvNo} is already on cash advance ${advance.advanceNo} (${advance.employeeName}). Each voucher has its own number: check the one on this voucher.`;
  const paid = (db.liquidationSubmissions || []).find((s: any) => s && s.id !== except.reportId && s.reimbursementDvNo && dvKey(s.reimbursementDvNo) === key);
  if (paid) return `DV ${dvNo} already paid the reimbursement on ${paid.submissionNo} (${paid.employeeName}). Each voucher has its own number: check the one on this voucher.`;
  return null;
}

// Finance releases an employee's request: the voucher number and date, and the advance is out.
app.post("/api/cash-advances/:id/release", authenticateToken, transactional((req: any, res: any) => {
  if (!isCashAdvanceRole(req.user.role)) {
    return res.status(403).json({ status: "error", message: "Only the Financial Officer can release a cash advance." });
  }
  const request = (db.cashAdvances || []).find((a: any) => a && a.id === req.params.id);
  if (!request) return res.status(404).json({ status: "error", message: "Cash advance request not found." });
  if (advanceInvolves(req.user, request)) {
    return res.status(403).json({
      status: "error",
      message: isOwnRecord(req.user, request.employeeId)
        ? "You can't release your own cash advance: another Financial Officer or the Administrator has to."
        : "This group cash advance covers you, so you can't release it: another Financial Officer or the Administrator has to."
    });
  }
  if (request.status !== "Requested") {
    return res.status(409).json({
      status: "error",
      message: request.status === "Released" ? `This request was already released (${request.advanceNo}, DV ${request.dvNo}).` : `This request was already ${String(request.status).toLowerCase()}.`
    });
  }
  // A request that has to be declined anyway is said so first, before Finance fixes a voucher for it.
  const problem = requestReleaseProblem(request);
  if (problem) return res.status(409).json({ status: "error", message: problem });
  const dvDate = req.body?.dvDate;
  if (!isCalendarDate(dvDate) || dvDate > manilaToday()) {
    return res.status(400).json({ status: "error", message: "Enter the DV date as YYYY-MM-DD, no later than today." });
  }
  // HSAC's voucher numbers: YYYY-MM-NNNN, in the voucher date's month (src/dvNumber.ts).
  const dv = readDvNumber(req.body?.dvNo, dvDate);
  if ("problem" in dv) return res.status(400).json({ status: "error", message: dv.problem });
  const dvNo = dv.value;
  const asked = manilaDateOf(request.requestedAt);
  if (asked && dvDate < asked) {
    return res.status(400).json({ status: "error", message: `The DV can't be dated before the request (${formatLongDate(asked)}).` });
  }
  // Each voucher has its own number, across advances and reimbursements (dvInUse).
  const dvUsed = dvInUse(dvNo, { advanceId: request.id });
  if (dvUsed) return res.status(409).json({ status: "error", message: dvUsed });

  // The allowance as it is now: HR may have changed it since the request. A group is re-priced the
  // same way, person by person, and anyone who no longer qualifies (marked absent, left the
  // seminar, covered or reported elsewhere, no longer active) is left out; they may ask for their own.
  const askedFor = round2(Number(request.amount));
  const allowance = liquidationActivityFacts(request.activityId)!.allocated;
  const holderEnrolment = (db.trainingParticipants || []).find((p: any) => p && p.id === request.activityId);
  const dropped: { name: string; why: string; participantId: string; employeeId: string }[] = [];
  if (isGroupAdvance(request)) {
    const kept: CashAdvanceCover[] = [];
    for (const c of request.covers!) {
      if (c.participantId === request.activityId) { kept.push({ ...c, amount: allowance }); continue; }
      const member = (db.trainingParticipants || []).find((p: any) => p && p.id === c.participantId);
      const why = groupCoverProblem(member, holderEnrolment, request.id);
      if (why) dropped.push({ name: c.employeeName, why, participantId: c.participantId, employeeId: c.employeeId });
      else kept.push({ ...c, amount: round2(Number(member.allowanceAllocated || 0)) });
    }
    if (kept.length <= 1) delete request.covers;
    else request.covers = kept;
  }
  const total = request.covers ? coversTotal(request.covers) : allowance;
  // The amount Finance saw when they opened the request (the screen sends it): the voucher was prepared
  // for it, so a total that has changed since (someone left or no longer qualifies, or HR re-priced) is
  // shown to Finance first instead of being recorded against that voucher. The reply carries the new
  // amount, so the form releases that one once Finance has seen it.
  const expected = req.body?.expectedAmount;
  if (expected !== undefined && expected !== null && centavos(total) !== centavos(expected)) {
    return res.status(409).json({
      status: "error",
      message: `The amount changed since you opened this request: it is now ${pesoText(total)}${dropped.length > 0
        ? ` (left out: ${dropped.map(d => `${d.name}, ${d.why}`).join("; ")})` : ""}. Check the voucher, then release it again.`,
      data: { amount: total }
    });
  }
  // Finance's reply and the audit entry give each reason; the holder's notice gives no more than the
  // holder needs to know about a colleague (coverReasonForHolder).
  const changeNote = (exact: boolean) => (centavos(total) !== centavos(askedFor)
    ? ` ${request.covers || dropped.length > 0 ? "The total" : "HR changed the allowance"} changed from ${pesoText(askedFor)} since the request.` : "")
    + (dropped.length > 0 ? ` Left out: ${dropped.map(d => `${d.name} (${exact ? d.why : coverReasonForHolder(d.why)})`).join("; ")}.` : "");
  const changed = changeNote(true);
  const now = new Date();
  request.status = "Released";
  request.amount = total;
  request.advanceNo = nextCashAdvanceNo(now);
  request.dvNo = dvNo;
  request.dvDate = dvDate;
  request.issuedBy = req.user.fullName;
  request.issuedAt = now.toISOString();
  request.decidedBy = req.user.fullName;
  request.decidedAt = now.toISOString();

  const group = request.covers ? ` for your group of ${request.covers.length} (${namesText(request.covers.map(c => c.employeeName))})` : "";
  notifyEmployee(request.employeeId, {
    title: "Cash advance released",
    message: `${pesoText(request.amount)} was released to you on DV ${dvNo} dated ${formatLongDate(dvDate)} for ${request.activityTitle}${group}.${changeNote(false)} Your liquidation report can't go past it; hand back what you don't spend.`,
    type: "success",
    link: { tab: "employee_portal", record: { kind: "assignment", id: request.activityId } },
    dedupeKey: `ca-released:${request.id}`
  });
  for (const c of (request.covers || []).slice(1)) {
    notifyEmployee(c.employeeId, {
      title: "Group cash advance released",
      message: `Finance released ${request.advanceNo} (${pesoText(request.amount)}) to ${request.employeeName} for your group at ${request.activityTitle}, ${pesoText(c.amount)} of it for you. ${request.employeeName} files the group's liquidation report.`,
      type: "info",
      link: { tab: "employee_portal", record: { kind: "assignment", id: c.participantId } },
      dedupeKey: `ca-released:${request.id}:${c.participantId}`
    });
  }
  for (const d of dropped) {
    notifyEmployee(d.employeeId, {
      title: "Left out of a group cash advance",
      message: `Finance released ${request.employeeName}'s group cash advance for ${request.activityTitle} without you: you ${youForm(d.why)}. You may ask for your own if you still need one.`,
      type: "warning",
      link: { tab: "employee_portal", record: { kind: "assignment", id: d.participantId } }
    });
  }
  logEvent(req.user.id, req.user.username, req.user.role, "Release Cash Advance",
    `Released ${pesoText(request.amount)} to ${request.employeeName} for ${request.activityTitle} via DV ${dvNo} (${request.advanceNo}), as they requested on ${manilaLongDate(request.requestedAt)}${request.covers
      ? `, one advance for ${request.covers.map(c => `${c.employeeName} (${pesoText(c.amount)})`).join(", ")}` : ""}.${changed}`);
  saveDB();
  res.json({ status: "success", message: `${request.advanceNo}: ${pesoText(request.amount)} released to ${request.employeeName} on DV ${dvNo}${request.covers ? ` for ${request.covers.length} participants` : ""}.${changed}`, data: request });
}));

// Finance declines an employee's request, saying why. The employee may ask again.
app.post("/api/cash-advances/:id/decline", authenticateToken, transactional((req: any, res: any) => {
  if (!isCashAdvanceRole(req.user.role)) {
    return res.status(403).json({ status: "error", message: "Only the Financial Officer can decline a cash advance request." });
  }
  const request = (db.cashAdvances || []).find((a: any) => a && a.id === req.params.id);
  if (!request) return res.status(404).json({ status: "error", message: "Cash advance request not found." });
  if (advanceInvolves(req.user, request)) {
    return res.status(403).json({
      status: "error",
      message: isOwnRecord(req.user, request.employeeId)
        ? "You can't decide your own cash advance request: another Financial Officer or the Administrator has to."
        : "This group cash advance request covers you, so you can't decide it: another Financial Officer or the Administrator has to."
    });
  }
  if (request.status !== "Requested") {
    return res.status(409).json({ status: "error", message: `This request was already ${String(request.status).toLowerCase()}.` });
  }
  const reason = signatoryText(req.body?.reason);
  if (!reason || reason.length > 500) {
    return res.status(400).json({ status: "error", message: "Say why the request is declined, up to 500 characters." });
  }
  declineAdvanceRequest(request, reason, req.user.fullName);
  logEvent(req.user.id, req.user.username, req.user.role, "Decline Cash Advance Request",
    `Declined ${request.employeeName}'s ${pesoText(request.amount)} request for ${request.activityTitle}: ${reason}`);
  saveDB();
  res.json({ status: "success", message: `${request.employeeName}'s request was declined.`, data: request });
}));

// Closes a request without releasing it, and tells the employee why; for a group, everyone it
// covered too. Finance's reason is written for the holder, so the others are told only that it was
// declined, unless the caller words one for them (`othersReason`). Callers save and log.
function declineAdvanceRequest(request: CashAdvance, reason: string, by: string, othersReason = "") {
  request.status = "Declined";
  request.declineReason = reason;
  request.decidedBy = by;
  request.decidedAt = new Date().toISOString();
  notifyEmployee(request.employeeId, {
    title: "Cash advance request declined",
    message: `Your ${pesoText(request.amount)} cash advance request for ${request.activityTitle} was declined: ${reason}`,
    type: "warning",
    link: { tab: "employee_portal", record: { kind: "assignment", id: request.activityId } }
  });
  for (const c of (request.covers || []).slice(1)) {
    notifyEmployee(c.employeeId, {
      title: "Group cash advance request declined",
      message: `${request.employeeName}'s group cash advance request for ${request.activityTitle} was declined${othersReason ? `: ${othersReason}` : "."} You may ask for your own.`,
      type: "warning",
      link: { tab: "employee_portal", record: { kind: "assignment", id: c.participantId } }
    });
  }
}

// Whether a seminar is still to come (its first day after Manila's today): its attendance can't be
// recorded yet, and someone's own cash advance can still be handed back in full (12z Part B).
function seminarNotStarted(programId: string): boolean {
  const prog = (db.trainingPrograms || []).find((p: any) => p.id === programId);
  return !!prog && isIsoDate(prog.startDate) && String(prog.startDate).slice(0, 10) > manilaToday();
}

// Recording a refund (requirement 6; the user's decision of 2026-10-10): someone HR marked
// "Did not attend" gives their whole cash advance back. Until it is recorded their share
// stays held in the seminar's budget, so the same money can't fund another seminar while it
// is still out; once recorded, it returns to Unallocated. An attendee's advance is settled
// by their liquidation report instead, which carries its own refund OR.
app.post("/api/cash-advances/:id/refund", authenticateToken, transactional((req: any, res: any) => {
  if (!isCashAdvanceRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Only the Financial Officer can record a refund." });
  }
  const advance = (db.cashAdvances || []).find((a: any) => a && a.id === req.params.id);
  if (!advance) return res.status(404).json({ status: "error", message: "Cash advance not found." });
  if (advanceInvolves((req as any).user, advance)) {
    return res.status(403).json({
      status: "error",
      message: isOwnRecord((req as any).user, advance.employeeId)
        ? "You can't record the refund of your own cash advance: another Financial Officer or the Administrator has to."
        : "This group cash advance covers you, so you can't record its refund: another Financial Officer or the Administrator has to."
    });
  }
  if (advance.status !== "Released") {
    return res.status(409).json({ status: "error", message: `${advance.advanceNo} is ${String(advance.status).toLowerCase()}, so there is no refund to record.` });
  }
  const enrolment = (db.trainingParticipants || []).find((p: any) => p && p.id === advance.activityId);
  // A group's advance comes back in full only when nobody it covers attended (HSAC RAB 1: refunded
  // as one); otherwise its one liquidation report settles it, a non-attendee's share in its leftover.
  const group = isGroupAdvance(advance)
    ? advance.covers!.map((c: any) => (db.trainingParticipants || []).find((p: any) => p && p.id === c.participantId))
    : null;
  // Or someone's own advance handed back before the seminar starts, with no attendance recorded: e.g. a
  // representative goes in their place, which waits for their cash to come back (12z Part B).
  const beforeSeminar = !group && !!enrolment && !enrolment.attendance && seminarNotStarted(enrolment.trainingProgramId);
  if (group ? group.some((p: any) => !p || p.attendance !== "Did not attend") : (!enrolment || (enrolment.attendance !== "Did not attend" && !beforeSeminar))) {
    return res.status(409).json({
      status: "error",
      message: group
        ? `${advance.advanceNo} is settled by the group's liquidation report, which ${advance.employeeName} files. A group's advance is refunded in full here only when nobody it covers attended.`
        : `${advance.advanceNo} is settled by the employee's liquidation report. Only an advance to someone who did not attend, or one returned before the seminar starts, is refunded in full here.`
    });
  }
  // Before the seminar, the whole advance comes back only if none of it was spent: HR's hand-entered
  // expenses for them would make the full refund untrue (12z Part B review).
  if (beforeSeminar && (db.trainingLiquidations || []).some((r: any) => r && r.trainingParticipantId === enrolment.id)) {
    return res.status(409).json({ status: "error", message: `HR has entered expenses for ${advance.employeeName} on this seminar, so ${advance.advanceNo} can't come back in full before it. It is settled by their liquidation report.` });
  }
  const orNo = signatoryText(req.body?.orNo);
  const orDate = req.body?.orDate;
  if (!orNo || orNo.length > 50) {
    return res.status(400).json({ status: "error", message: "Enter the official receipt (OR) number of the refund, up to 50 characters." });
  }
  const orUsedOn = orNumberInUse(orNo);
  if (orUsedOn) {
    return res.status(400).json({ status: "error", message: `OR ${orNo} is already recorded on ${orUsedOn}. Each official receipt is used once: check the number.` });
  }
  if (!isCalendarDate(orDate) || orDate > manilaToday()) {
    return res.status(400).json({ status: "error", message: "Enter the OR date as YYYY-MM-DD, no later than today." });
  }
  // Money can't come back before it went out.
  if (isCalendarDate(advance.dvDate) && orDate < advance.dvDate) {
    return res.status(400).json({ status: "error", message: `The OR date can't be before the advance was released (DV dated ${advance.dvDate}).` });
  }

  // What the seminar holds before and after, for the message and the audit entry.
  const prog = (db.trainingPrograms || []).find((p: any) => p.id === enrolment.trainingProgramId);
  const heldBefore = prog ? seminarBudget(prog, participantsForBudget()).committed : 0;
  advance.status = "Refunded";
  advance.refundOrNo = orNo;
  advance.refundOrDate = orDate;
  advance.refundedBy = (req as any).user.fullName;
  advance.refundedAt = new Date().toISOString();
  // Kept as recorded, since attendance can change later (the desk lists it as returned before the seminar).
  if (beforeSeminar) advance.refundedBeforeSeminar = true;
  const freed = prog ? round2(heldBefore - seminarBudget(prog, participantsForBudget()).committed) : 0;
  const fy = prog ? (db.fiscalYears || []).find((f: any) => f.label === prog.fiscalYear) : null;
  const note = freed > 0
    ? fy && fy.status !== "Active"
      ? ` ${pesoText(freed)} returns to FY ${fy.label}'s Unallocated; that year is closed, so what it carried over doesn't change.`
      : ` ${pesoText(freed)} of the seminar's allocation returns to Unallocated.`
    : "";

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Record Advance Refund",
    `${advance.advanceNo}: ${advance.employeeName} refunded ${pesoText(advance.amount)} (OR ${orNo}, ${orDate}) for ${advance.activityTitle || "a seminar"}, ${group
      ? `the whole group advance: nobody it covered attended (${namesText(advance.covers!.map((c: any) => c.employeeName))})`
      : beforeSeminar ? "returned before the seminar" : "which they did not attend"}.${note}`);
  // A refund before the seminar has no "Did not attend" from HR behind it, so one Financial Officer's
  // record would close the advance alone: the employee and HR are told, so a refund nobody made is seen
  // (the security review, 2026-10-29).
  if (beforeSeminar) {
    notifyEmployee(advance.employeeId, {
      title: "Cash advance returned",
      message: `Finance recorded that you returned your ${pesoText(advance.amount)} cash advance ${advance.advanceNo} for ${advance.activityTitle || "the seminar"} before it started (OR ${orNo}, ${orDate}).`,
      type: "info",
      link: { tab: "employee_portal", record: { kind: "assignment", id: advance.activityId } }
    });
    notify({ role: UserRole.HR_OFFICER }, {
      title: "Cash advance returned before the seminar",
      message: `${(req as any).user.fullName} recorded that ${advance.employeeName} returned ${advance.advanceNo} (${pesoText(advance.amount)}) for ${advance.activityTitle || "a seminar"} before it started (OR ${orNo}).`,
      type: "info",
      link: { tab: "training_development", record: { kind: "seminar", id: enrolment.trainingProgramId } }
    });
  }
  saveDB();
  res.json({ status: "success", message: `Refund of ${pesoText(advance.amount)} from ${advance.employeeName}${group ? ` for the group's advance` : ""} recorded (OR ${orNo})${beforeSeminar ? ", returned before the seminar" : ""}.${note}`, data: advance });
}));

app.put("/api/liquidation-submissions/:id/chief-action", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only Division Chief can give the final seal" });
  }
  const sub = db.liquidationSubmissions.find(l => l.id === req.params.id);
  if (!sub) return res.status(404).json({ status: "error", message: "Submission records not found" });
  // Liquidation reports are verified by HR and validated by Finance, which certifies Box B
  // for the Division Chief under delegated authority (a documented RAB 1 rule). The Chief no
  // longer approves, returns or rejects them here; this used to act at any stage, even
  // before HR or Finance had checked the report (open question 9).
  return res.status(409).json({
    status: "error",
    message: `${sub.submissionNo} is verified by HR and validated by Finance, which certifies it for the Division Chief. The Division Chief doesn't approve, return or reject liquidation reports here.`
  });
});



// ==========================================
// TRAINING & DEVELOPMENT MANAGEMENT SYSTEM
// ==========================================

// Participant records are written with either the internal id ("emp-1") or the
// HR-facing employee number ("EMP001") depending on which path created them, so
// resolve both forms before matching.
function employeeIdForms(employeeId: string): string[] {
  const emp = (db.employees || []).find(e => e.id === employeeId || e.employeeId === employeeId);
  return emp ? [emp.id, emp.employeeId].filter(Boolean) : [employeeId];
}

// The staff record a key names: by internal id first, then by staff code. The TDP rule (12z) looks people
// up this way, so a staff code set to another record's internal id (7j) can't make it judge one person
// by another's Plan A, or name the wrong one.
function employeeByKey(key: string): Employee | undefined {
  const all = db.employees || [];
  return all.find(e => e.id === key) ?? all.find(e => e.employeeId === key);
}

// At least one training per year per employee (the user's rule, 2026-10-23; it replaced "at most
// one seminar per fiscal year"). What counts toward a year is decided in src/trainingCoverage.ts,
// shared by the participant picker's ranking, auto-enrolment and the coverage panel.
function trainingCoverageData() {
  return { enrolments: db.trainingParticipants || [], programs: db.trainingPrograms || [], records: db.trainings || [] };
}

function coverageFiscalYear(label: string) {
  const fy: any = (db.fiscalYears || []).find((f: any) => String(f.label) === String(label));
  return { label: String(label), start_date: fy?.start_date, end_date: fy?.end_date };
}

// --- TDP PARTICIPANT ELIGIBILITY, RECOMMENDER & LIQUIDATION DEADLINES ---

// Hired within this many months = "new hire", first in line for seminar seats.
const NEW_HIRE_MONTHS = 12;
// A participant must liquidate within this many days after the seminar ends.
const LIQUIDATION_DUE_DAYS = 30;

// The fields the eligibility rules need. A saved TrainingProgram fits, and so does
// an unsaved draft row from the TDP editor (no id yet).
type SeminarRef = {
  id?: string;
  seriesId?: string;
  title: string;
  fiscalYear: string;
  targetDivision?: string;
  targetSpecialization?: string;
  maxParticipants?: number;
  // Plan A entries this seminar covers, as ticked by HR.
  fulfillsNeedTitles?: string[];
};

// Cleans whatever the client sent into a stored list of covered plan needs:
// trimmed, blank-free, deduped by normalised title, and capped.
function normalizeFulfillsNeedTitles(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const title = String(entry ?? "").trim().slice(0, 300);
    const key = normalizeTitle(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(title);
    if (out.length >= 20) break;
  }
  return out;
}

// Which of this employee's own Plan A entries the seminar covers (same title, same fiscal year), with
// the plan's column for each: the same training can be needed for the function itself, or for an
// additional designation (HSAC RAB 1's answer 6: RA 12009 for the Admin Officer IV vs the BAC TWG).
function employeeCoveredNeeds(employeeId: string, program: SeminarRef): TrainingNeed[] {
  const emp = employeeByKey(employeeId);
  return coveredNeeds(db.trainingNeeds || [], emp ? [emp.id, emp.employeeId].filter(Boolean) : [employeeId], program);
}

// Whether the TDP identifies this employee for the seminar (HSAC RAB 1, 2026-10-28): their own Plan A
// for its fiscal year lists a need it covers. Anyone else is seated only with a justification (12z).
function tdpIdentifies(employeeId: string, program: SeminarRef): boolean {
  return employeeCoveredNeeds(employeeId, program).length > 0;
}

// "Today" as a calendar date in the Philippines (UTC+8, no DST), so deadlines flip
// at local midnight instead of 8 AM.
function manilaToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// The calendar date in the Philippines of a stored timestamp (ISO, in UTC), as "October 20,
// 2026". Slicing the timestamp instead gives the UTC date: a day early before 8 AM.
function manilaLongDate(iso: string | undefined): string {
  const date = manilaDateOf(iso);
  return date ? formatLongDate(date) : "an earlier date";
}

function isIsoDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}/.test(value);
}

function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Whole calendar days from `from` to `to`; negative when `to` is already past.
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = to.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
}

function liquidationDueDateFor(program: { endDate?: string } | undefined): string | null {
  return program && isIsoDate(program.endDate) ? addDaysToDate(program.endDate, LIQUIDATION_DUE_DAYS) : null;
}

function participantAllowance(program: TrainingProgram): number {
  return Math.round((Number(program.allocatedBudget || 0) / Math.max(1, program.maxParticipants || 1)) * 100) / 100;
}

// Same seminar = same series (a program and its fiscal-year rollover copies) or,
// for older programs saved before seriesId existed, the same normalised title.
function sameSeminar(a: SeminarRef, b: SeminarRef): boolean {
  const aSeries = a.seriesId || a.id;
  const bSeries = b.seriesId || b.id;
  if (aSeries && bSeries && aSeries === bSeries) return true;
  const aTitle = normalizeTitle(a.title);
  return aTitle !== "" && aTitle === normalizeTitle(b.title);
}

// Reason the employee already took (or is already booked into) this seminar, or null.
// Checks TDP enrolments and the HR-recorded training history.
function employeeAttendedSeminarBefore(employeeId: string, program: SeminarRef): string | null {
  const forms = employeeIdForms(employeeId);
  for (const p of db.trainingParticipants || []) {
    // An enrolment archived with an unused seminar never happened either.
    if (!forms.includes(p.employeeId) || p.status === "Cancelled" || p.status === "Archived") continue;
    // HR recorded that they did not attend: no reason to keep them from enrolling again.
    if (p.attendance === "Did not attend") continue;
    if (program.id && p.trainingProgramId === program.id) continue;
    const prog = (db.trainingPrograms || []).find(tp => tp.id === p.trainingProgramId);
    if (prog && sameSeminar(prog, program)) {
      return prog.fiscalYear === program.fiscalYear
        ? `Already enrolled in this seminar (FY ${prog.fiscalYear})`
        : `Attended this seminar in FY ${prog.fiscalYear}`;
    }
  }
  const title = normalizeTitle(program.title);
  if (title) {
    const record = (db.trainings || []).find(t =>
      forms.includes(t.employeeId) && t.status !== "Rejected" && normalizeTitle(t.title) === title);
    if (record) return `Attended this seminar (recorded ${record.dateConducted})`;
  }
  return null;
}

// Why this employee cannot be enrolled in the program, or null when they can.
// The recommender and every enrolment route share this, so the UI can never offer
// someone the server would refuse. Only the same seminar twice is refused: since 2026-10-23
// an employee may join several seminars in a fiscal year (at least one, no longer at most one).
function trainingEnrollmentBlock(employeeId: string, program: SeminarRef): { reason: string } | null {
  const attended = employeeAttendedSeminarBefore(employeeId, program);
  return attended ? { reason: attended } : null;
}

// --- Division coverage (HSAC RAB 1's answer 1: "someone must stay to man the division") ---
// The rule is in src/divisionCoverage.ts; these read it off the data. Days already past aren't
// checked: nobody can be kept at the office on them any more.

// Active staff with a division, as the rule counts them.
function coverageStaff(): CoverageStaff[] {
  return (db.employees || [])
    .filter(e => e && e.isActive !== false && String(e.division || "").trim())
    .map(e => ({ id: e.id, division: String(e.division).trim() }));
}

// Who a seminar takes from the office (Employee.id): its roster, less anyone cancelled, archived or
// marked "Did not attend".
function seminarAwayIds(programId: string): string[] {
  const ids = new Set<string>();
  for (const p of db.trainingParticipants || []) {
    if (!p || p.trainingProgramId !== programId || p.status === "Cancelled" || p.status === "Archived" || p.attendance === "Did not attend") continue;
    const emp = (db.employees || []).find(e => e.id === p.employeeId || e.employeeId === p.employeeId);
    if (emp) ids.add(emp.id);
  }
  return [...ids];
}

// Whether someone is at a seminar other than `exceptId` (and not archived) on a day.
function awayAtOtherSeminars(exceptId?: string): (id: string, date: string) => boolean {
  const away = new Map<string, Set<string>>();
  for (const prog of db.trainingPrograms || []) {
    if (!prog || prog.id === exceptId || prog.archivedAt) continue;
    const ids = seminarAwayIds(prog.id);
    if (ids.length === 0) continue;
    for (const date of seminarWeekdays(prog.startDate, prog.endDate)) {
      const set = away.get(date) ?? new Set<string>();
      ids.forEach(id => set.add(id));
      away.set(date, set);
    }
  }
  return (id, date) => !!away.get(date)?.has(id);
}

type SeminarSpan = { startDate: unknown; endDate: unknown; ids: string[] };

// What a change to one seminar (its days or its roster) adds to the divisions left with nobody at the
// office, on days still to come. `before`: the seminar as it was (null when it took nobody).
function addedDivisionGaps(programId: string | undefined, before: SeminarSpan | null, after: SeminarSpan): DivisionGap[] {
  const today = manilaToday();
  const staff = coverageStaff();
  const elsewhere = awayAtOtherSeminars(programId);
  const days = (s: SeminarSpan) => seminarWeekdays(s.startDate, s.endDate).filter(d => d >= today);
  const was = before ? divisionGaps(staff, days(before), before.ids, elsewhere) : [];
  return addedGaps(was, divisionGaps(staff, days(after), after.ids, elsewhere));
}

// The refusal (409, with the gaps for the screen) of a change that leaves a division with nobody, unless
// HR confirmed it (allowDivisionGap: true). True when it refused. A confirmed one is recorded by the
// caller once the change is made (logDivisionOverride).
function refuseDivisionGap(req: any, res: any, gaps: DivisionGap[]): boolean {
  if (gaps.length === 0 || req.body?.allowDivisionGap === true) return false;
  res.status(409).json({
    status: "error",
    message: `This leaves nobody at the office: ${gapText(gaps)}. Someone must stay to man the division.`,
    data: { code: "DIVISION_GAP", gaps }
  });
  return true;
}

function logDivisionOverride(req: any, gaps: DivisionGap[], what: string) {
  if (gaps.length === 0) return;
  logEvent(req.user.id, req.user.username, req.user.role, "Division Coverage Override",
    `${req.user.fullName} ${what}, confirming it leaves nobody at the office: ${gapText(gaps)}.`);
}

// HSAC RAB 1 (2026-10-28, known-issues 12z): someone the TDP doesn't identify for a seminar is seated
// only with a recorded justification. A save sends them as `tdpExceptions: { [employee id]: … }`; read
// and cleaned here, keyed by Employee.id, or the first problem (the save's 400).
function readTdpExceptions(raw: unknown): { map: Map<string, TdpJustificationInput> } | { problem: string } {
  const map = new Map<string, TdpJustificationInput>();
  if (raw == null) return { map };
  if (typeof raw !== "object" || Array.isArray(raw)) return { problem: "Send the justifications one per employee." };
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 200) return { problem: "Send at most 200 justifications in one save." };
  for (const [key, value] of entries) {
    const emp = employeeByKey(key);
    if (!emp) continue;
    const read = readTdpJustification(value, manilaToday());
    if ("problem" in read) return { problem: `${emp.fullName}: ${read.problem}` };
    map.set(emp.id, read.value);
  }
  return { map };
}

// Who on the seminar's roster the TDP identified, by enrolment, before a change (its needs may change):
// a save is held only to the people it seats outside the TDP, or turns outside.
function tdpRosterBefore(program: TrainingProgram): Map<string, boolean> {
  return new Map((db.trainingParticipants || [])
    .filter(p => p.trainingProgramId === program.id && p.status !== "Cancelled" && p.status !== "Archived")
    .map(p => [p.id, tdpIdentifies(p.employeeId, program)] as [string, boolean]));
}

// After a save has seated people: the enrolments it leaves outside the TDP with no justification (none
// sent, none on record), the justifications to record (on its new seats, or on anyone HR justified
// with it), and the seats its seminar's own justification covers (Part C). `created`: the enrolments the
// save made; `kept`: those HR unticked but it had to keep; `seminarCovers`: the seminar is outside the
// TDP and held with its own justification, which covers everyone on it.
function tdpSeatsPlan(program: TrainingProgram, created: TrainingParticipant[], before: Map<string, boolean>,
  sent: Map<string, TdpJustificationInput>, kept: Set<string> = new Set(), seminarCovers = false) {
  const createdIds = new Set(created.map(p => p.id));
  const seats = (db.trainingParticipants || [])
    .filter(p => p.trainingProgramId === program.id && p.status !== "Cancelled" && p.status !== "Archived")
    .map(p => {
      const empId = employeeByKey(p.employeeId)?.id ?? p.employeeId;
      const check: SeatCheck = {
        id: p.id,
        newSeat: createdIds.has(p.id),
        identifiedBefore: before.get(p.id) ?? false,
        identifiedAfter: tdpIdentifies(p.employeeId, program),
        justified: !!p.tdpException || sent.has(empId) || !!p.tdpUnderSeminar || seminarCovers,
        keptForHistory: kept.has(p.id)
      };
      return { p, empId, check };
    });
  const missing = new Set(seatsNeedingJustification(seats.map(s => s.check)));
  return {
    missing: seats.filter(s => missing.has(s.p.id)).map(s => s.p),
    toRecord: seats.filter(s => !s.check.identifiedAfter && sent.has(s.empId))
      .map(s => ({ participant: s.p, justification: sent.get(s.empId)!, newSeat: s.check.newSeat })),
    toCover: seminarCovers
      ? seats.filter(s => !s.check.identifiedAfter && !s.p.tdpException && !sent.has(s.empId) && !s.p.tdpUnderSeminar).map(s => s.p)
      : []
  };
}

// Whether a seminar is in the TDP (12z Part C): one of its titles is a need in its fiscal year's Plan A,
// anyone's. A title typed in that no plan lists doesn't count.
function seminarInTdp(program: SeminarRef): boolean {
  return seminarCoversPlan(db.trainingNeeds || [], program);
}

// The refusal (409) of a save that leaves a seminar outside the TDP with no justification of its own
// (Part C). The caller returns at once; in a transaction, the save is undone.
function refuseNotInTdp(res: any, program: TrainingProgram): void {
  res.status(409).json({
    status: "error",
    message: `"${String(program.title || "").trim()}" covers no need in FY ${program.fiscalYear}'s Plan A, so it is outside the TDP. `
      + "Record why it is held (a Central Office training, an invitation from another agency, a new law or issuance, or another reason) and who approved it.",
    data: { code: "NOT_IN_TDP" }
  });
}

// A seminar outside the TDP held with its own justification covers everyone seated on it (Part C): each
// seat records it, so it stays justified if the seminar later covers a need. Who seated whom is on
// record, as for Part A's seats: one "TDP Exception (seminar)" entry naming them, "Self-Approval" for an
// officer seating themself, and the Administrator's notice (`tellAdministrator`: not when the seminar's
// own justification was just recorded, whose notice already went). Callers save. True when it covered
// anyone.
function coverSeatsBySeminar(user: TdpActor, program: TrainingProgram, seats: TrainingParticipant[], tellAdministrator: boolean): boolean {
  const fresh = seats.filter(p => !p.tdpUnderSeminar);
  if (fresh.length === 0) return false;
  const at = new Date().toISOString();
  const title = JSON.stringify(String(program.title || "").trim());
  const names = fresh.map(p => employeeByKey(p.employeeId)?.fullName || p.employeeId);
  for (const p of fresh) {
    p.tdpUnderSeminar = at;
    if (isOwnRecord(user, p.employeeId)) flagSelfApproval(user, `seated themself in ${title} under the seminar's TDP justification`);
  }
  logEvent(user.id, user.username, user.role, "TDP Exception (seminar)",
    `${user.fullName} seated ${names.map(n => JSON.stringify(n)).join(", ")} in ${title} (FY ${program.fiscalYear}) under the seminar's justification.`);
  if (tellAdministrator && user.role !== UserRole.SUPER_ADMIN) {
    notify({ role: UserRole.SUPER_ADMIN }, {
      title: "Seated under a seminar's TDP exception",
      message: `${user.fullName} seated ${namesText(names)} in ${title} (FY ${program.fiscalYear}) under the seminar's justification.`,
      type: "info",
      link: { tab: "training_development", record: { kind: "seminar", id: program.id } },
      dedupeKey: `tdp-seminar-seats:${program.id}:${at}`
    });
  }
  return true;
}

const SEMINAR_TDP_FIELDS = ["kind", "reason", "referenceNo", "referenceDate"] as const;

// Records why a seminar outside the TDP is held (Part C): who recorded it and when, the "TDP Exception
// (seminar)" audit entry (the kind and who approved it, HR's words quoted; the reason stays on the
// seminar), and the Administrator's notice unless they recorded it. One that changes nothing records
// nothing, unless the seminar was renamed (`renamedFrom`): a justification is for the training it
// names, so it is confirmed for the new title. Callers save. True when it recorded one.
function recordSeminarTdpException(user: TdpActor, program: TrainingProgram, j: SeminarTdpJustificationInput, renamedFrom?: string): boolean {
  const before = program.tdpException;
  if (!renamedFrom && before && SEMINAR_TDP_FIELDS.every(f => (before[f] ?? "") === (j[f] ?? ""))
    && before.approvedBy.name === j.approvedBy.name && before.approvedBy.position === j.approvedBy.position) return false;
  const recordedAt = new Date().toISOString();
  program.tdpException = { ...j, recordedBy: { id: user.id, name: user.fullName, role: user.role }, recordedAt };
  const title = `${JSON.stringify(String(program.title || "").trim())} (FY ${program.fiscalYear})`;
  const what = renamedFrom ? `renamed ${JSON.stringify(renamedFrom)} to ${title} and recorded why it is held`
    : before ? `changed why ${title} is held` : `held ${title}`;
  logEvent(user.id, user.username, user.role, "TDP Exception (seminar)",
    `${user.fullName} ${what} outside the TDP. Kind: ${j.kind}. `
    + `Approved by: ${JSON.stringify(j.approvedBy.name)}, ${JSON.stringify(j.approvedBy.position)}.`
    + `${j.referenceNo ? ` Reference: ${JSON.stringify(j.referenceNo)}${j.referenceDate ? ` (${j.referenceDate})` : ""}.` : ""}`);
  if (user.role !== UserRole.SUPER_ADMIN) {
    notify({ role: UserRole.SUPER_ADMIN }, {
      title: before ? "Seminar's TDP exception changed" : "Seminar held outside the TDP",
      // HR's own words quoted, so a name can't read as the system's text.
      message: `${user.fullName} ${what} outside the TDP: ${j.kind}, approved by ${JSON.stringify(j.approvedBy.name)}.`,
      type: "info",
      link: { tab: "training_development", record: { kind: "seminar", id: program.id } },
      dedupeKey: `tdp-seminar:${program.id}:${recordedAt}`
    });
  }
  return true;
}

// The refusal (409, naming the people, for the screen to ask HR why each is seated) of a save that
// leaves someone outside the TDP with no justification. True when it refused; in a transaction, the
// save is then undone.
function refuseOutsideTdp(res: any, program: TrainingProgram, missing: TrainingParticipant[]): boolean {
  if (missing.length === 0) return false;
  const people = missing.map(p => {
    const emp = employeeByKey(p.employeeId);
    return { employeeId: emp?.id ?? p.employeeId, fullName: emp?.fullName ?? p.employeeId };
  });
  res.status(409).json({
    status: "error",
    message: `The TDP doesn't identify ${namesText(people.map(x => x.fullName))} for "${String(program.title || "").trim()}": `
      + `${people.length === 1 ? "their" : "each one's"} Plan A for FY ${program.fiscalYear} lists none of its needs. `
      + `Record why ${people.length === 1 ? "they are" : "each is"} seated: designated to do the tasks, identified by the Chief, or another reason.`,
    data: { code: "OUTSIDE_TDP", people }
  });
  return true;
}

// The Plan A needs a seminar covers, for the audit log: they decide who the TDP identifies on it (12z),
// so ticking one of someone's own needs is how they become "identified". HR's titles, quoted.
function seminarNeedsText(titles?: string[]): string {
  return (titles || []).length > 0 ? (titles || []).map(t => JSON.stringify(t)).join(", ") : "no Plan A need";
}
const seminarNeedsKey = (titles?: string[]) => (titles || []).map(normalizeTitle).sort().join("|");

type TdpActor = Pick<User, "id" | "username" | "fullName" | "role"> & { employeeId?: string };
const TDP_FIELDS = ["kind", "committee", "committeeOther", "reason", "referenceNo", "referenceDate"] as const;

// Records a justification on an enrolment: who recorded it and when, the "TDP Exception" audit entry
// (its kind and who identified them, HR's own words quoted; the reason stays on the enrolment, as it
// may mention someone's leave), the Administrator's notice unless they recorded it, and "Self-Approval"
// for an officer acting on their own seat. `newSeat`: the save seated them just now; otherwise HR is
// recording (or changing) why someone already on it is there. One that changes nothing records nothing.
// Callers save; inside a transaction a later refusal undoes all of it. True when it recorded one.
function recordTdpException(user: TdpActor, p: TrainingParticipant, program: TrainingProgram, j: TdpJustificationInput & Pick<TdpJustification, "inLieuOf">, newSeat: boolean): boolean {
  const before = p.tdpException;
  // A representative's stays "In lieu of" whichever route sends a new one (Part B): a seminar save's
  // `tdpExceptions` can correct its reason, never turn it into another kind.
  if (before?.kind === "In lieu of") j = { ...j, kind: "In lieu of", committee: undefined, committeeOther: undefined, inLieuOf: before.inLieuOf };
  if (before && TDP_FIELDS.every(f => (before[f] ?? "") === (j[f] ?? ""))
    && before.identifiedBy.name === j.identifiedBy.name && before.identifiedBy.position === j.identifiedBy.position) return false;
  const recordedAt = new Date().toISOString();
  p.tdpException = { ...j, recordedBy: { id: user.id, name: user.fullName, role: user.role }, recordedAt };
  const who = employeeByKey(p.employeeId)?.fullName || p.employeeId;
  // The title quoted too, so one typed to look like the fields that follow can't pass for them.
  const title = JSON.stringify(String(program.title || "").trim());
  const kind = j.kind === "Designated" && j.committee === "Other" ? `Designated (${JSON.stringify(j.committeeOther ?? "")})` : tdpKindText(j);
  const what = newSeat ? `seated ${who} in` : before ? `changed why ${who} is seated in` : `recorded why ${who} is seated in`;
  logEvent(user.id, user.username, user.role, "TDP Exception",
    `${user.fullName} ${what} ${title} (FY ${program.fiscalYear}) outside the TDP. Kind: ${kind}. `
    + `Identified by: ${JSON.stringify(j.identifiedBy.name)}, ${JSON.stringify(j.identifiedBy.position)}.`
    + `${j.referenceNo ? ` Reference: ${JSON.stringify(j.referenceNo)}${j.referenceDate ? ` (${j.referenceDate})` : ""}.` : ""}`);
  if (isOwnRecord(user, p.employeeId)) {
    flagSelfApproval(user, `${newSeat ? "seated themself in" : "recorded why they are seated in"} ${title} outside the TDP: ${kind}`);
  }
  if (user.role !== UserRole.SUPER_ADMIN) {
    notify({ role: UserRole.SUPER_ADMIN }, {
      title: newSeat ? "Seated outside the TDP" : before ? "TDP exception changed" : "TDP exception recorded",
      message: `${user.fullName} ${what} ${title} (FY ${program.fiscalYear}) outside the TDP: ${kind}, identified by ${JSON.stringify(j.identifiedBy.name)}.`,
      type: "info",
      link: { tab: "training_development", record: { kind: "seminar", id: program.id } },
      dedupeKey: `tdp-exception:${p.id}:${recordedAt}`
    });
  }
  return true;
}

// A seminar's dates as they will be saved: real dates, the end on or after the start.
function seminarDatesProblem(startDate: unknown, endDate: unknown): string | null {
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) return "Enter the seminar's start and end dates.";
  if (endDate < startDate) return "The end date can't be before the start date.";
  // The division rule reads a seminar's first MAX_SEMINAR_DAYS days, so a longer one would escape it.
  if ((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000 >= MAX_SEMINAR_DAYS) {
    return "A seminar can't run longer than a year.";
  }
  return null;
}

// A seminar's title, description and category as they will be saved: text, and not so long that
// matching titles (normalizeTitle) holds the server up. The title is required, with the room a Plan A
// need's title has, since a seminar can be named after one. It is saved cleaned like a name
// (`cleanText`: no control or direction characters, which could scramble the audit entries that quote it).
function seminarTextProblem(title: unknown, description: unknown, category: unknown): string | null {
  if (typeof title !== "string" || !title.trim()) return "Enter the seminar's title.";
  if (title.trim().length > 300) return "Keep the seminar's title under 300 characters.";
  if (!cleanText(title)) return "Enter the seminar's title.";
  if (description != null && (typeof description !== "string" || description.length > 2000)) {
    return "The description must be text, up to 2,000 characters.";
  }
  if (category != null && (typeof category !== "string" || category.length > 100)) return "The category must be text, up to 100 characters.";
  return null;
}

function monthsSinceHire(emp: Employee, today: string): number | null {
  if (!isIsoDate(emp.dateHired)) return null;
  const [hy, hm, hd] = emp.dateHired.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return (ty - hy) * 12 + (tm - hm) - (td < hd ? 1 : 0);
}

function matchesSeminarTarget(emp: Employee, program: SeminarRef): boolean {
  if (program.targetDivision && emp.division === program.targetDivision) return true;
  const spec = normalizeTitle(program.targetSpecialization);
  return spec !== "" && normalizeTitle(emp.fieldOfSpecialization).includes(spec);
}

// Scores every employee for a seminar. Priority 1 = new hires, 2 = no training yet in the
// seminar's fiscal year, 3 = everyone else; ineligible employees sort last with their reason.
function rankTrainingCandidates(program: SeminarRef): { candidates: TrainingCandidate[]; recommendedIds: string[] } {
  const today = manilaToday();
  // Their other trainings in the seminar's fiscal year (this seminar left out).
  const yearTrainings = yearTrainingCounter(trainingCoverageData(), coverageFiscalYear(program.fiscalYear), program.id);
  const mandates = trainingMandateIndex();
  const candidates: TrainingCandidate[] = (db.employees || [])
    .filter(emp => emp.isActive !== false)
    .map(emp => {
      const block = trainingEnrollmentBlock(emp.id, program);
      const months = monthsSinceHire(emp, today);
      const newHire = months !== null && months >= 0 && months < NEW_HIRE_MONTHS;
      const thisYear = yearTrainings(emp);
      const trainingsThisYear = [...thisYear.seminars, ...thisYear.records];
      const priority: 1 | 2 | 3 = newHire ? 1 : trainingsThisYear.length === 0 ? 2 : 3;
      const covered = employeeCoveredNeeds(emp.id, program);
      // Each title once, even when their plan lists it under two columns.
      const needMatches = [...new Set(covered.map(n => n.title))];
      return {
        needsThis: needMatches.length > 0,
        needMatches,
        // The plan's columns those entries are under (in the form's order).
        needCategories: TRAINING_NEED_CATEGORIES.filter(c => covered.some(n => n.category === c)),
        // Those the law requires (12z Part D): such listers come first among the listers.
        mandatedNeeds: needMatches.flatMap(title => { const m = mandateFor(title, mandates); return m ? [{ title, basis: m.basis }] : []; }),
        employeeId: emp.id,
        fullName: emp.fullName,
        position: emp.position || "",
        division: emp.division || "",
        dateHired: emp.dateHired || "",
        priority,
        priorityLabel: priority === 1 ? "New hire"
          : priority === 2 ? `No training yet in FY ${program.fiscalYear}`
          : `Already has a training in FY ${program.fiscalYear}`,
        monthsSinceHire: months,
        matchesTarget: matchesSeminarTarget(emp, program),
        trainingsThisYear,
        eligible: !block,
        ineligibleReason: block?.reason
      };
    });

  // Everyone should have at least one training a year, so those with none yet in the seminar's
  // fiscal year come first. Among them, and among the rest, the plan listing this training is the
  // strongest reason for a seat (a need the law requires ahead of the others), then the new-hire
  // preference.
  candidates.sort((a, b) =>
    Number(b.eligible) - Number(a.eligible) ||
    Number(a.trainingsThisYear.length > 0) - Number(b.trainingsThisYear.length > 0) ||
    Number(b.needsThis) - Number(a.needsThis) ||
    // Among the plan's listers, a training the law requires first (HSAC RAB 1's step 5).
    Number((b.mandatedNeeds ?? []).length > 0) - Number((a.mandatedNeeds ?? []).length > 0) ||
    a.priority - b.priority ||
    Number(b.matchesTarget) - Number(a.matchesTarget) ||
    b.dateHired.localeCompare(a.dateHired) ||
    a.fullName.localeCompare(b.fullName));

  const seats = Math.max(0, Number(program.maxParticipants) || 0);
  const recommendedIds = candidates.filter(c => c.eligible).slice(0, seats).map(c => c.employeeId);
  return { candidates, recommendedIds };
}

// --- OFFICIAL TDP: PLAN A (NEEDED TRAINING) & PLAN D (MONITORING) ---

// Accepts "YYYY-MM-DD" and the "MM/DD/YYYY" the PDS parser produces.
function toIsoDateLoose(value: any): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

// The plan's wording is usually longer than a seminar title ("Legal Research" vs
// "Legal Research Seminar"), so containment counts — but only for strings long
// enough that it cannot fire on an abbreviation.
function titlesMatch(a: string, b: string): boolean {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.length >= 6 && y.length >= 6 && (x.includes(y) || y.includes(x));
}

// Undated evidence still counts; only clearly later evidence is excluded.
function onOrBeforeAsOf(dateStr: string | null, asOf: string): boolean {
  return !dateStr || daysBetween(dateStr, asOf) >= 0;
}

// Plan D: did this employee take, during the plan year, the training they were listed as needing?
// Whether an enrolment counts as attended (Plan D): HR's attendance record when there is
// one; for an enrolment never marked, the older evidence of a filed or settled report.
function participantAttended(p: any): boolean {
  if (p.attendance) return p.attendance === "Attended";
  return p.status === "Liquidated" || p.status === "Liquidation Pending" || p.status === "Completed";
}

// Whether a dated record (a recorded training, a PDS entry) counts toward a need's plan year:
// dated within that fiscal year, or from the day the need was listed until the year ends. The
// second covers a year that started early, as when the next year is opened before its 1
// January. An undated record can't be placed in a year, so it doesn't count; HR can still
// mark the need accomplished by hand.
function inNeedPlanYear(need: TrainingNeed, date: string | null): boolean {
  if (!date) return false;
  const fy: any = (db.fiscalYears || []).find((f: any) => f.label === need.fiscalYear);
  const calendarYear = /^\d{4}$/.test(String(need.fiscalYear)) ? String(need.fiscalYear) : null;
  const start = toIsoDateLoose(fy?.start_date) || (calendarYear ? `${calendarYear}-01-01` : null);
  const end = toIsoDateLoose(fy?.end_date) || (calendarYear ? `${calendarYear}-12-31` : null);
  const listed = toIsoDateLoose(need.createdAt);
  const from = [start, listed].filter(Boolean).sort()[0] || null;
  return (!from || date >= from) && (!end || date <= end);
}

// For a need the rollover carried forward because it was still unmet: the entry it continues,
// the same need in the latest earlier plan year back to the one it was first raised in.
// Fiscal-year labels are years ("2027"), so the search always moves to an earlier year. A
// person can have one title under two columns; the carried copy keeps its column, so that
// entry comes first.
function earlierNeedEntry(need: TrainingNeed): TrainingNeed | null {
  const own = String(need.fiscalYear);
  const first = String(need.carriedFromFiscalYear || "");
  if (!/^\d{4}$/.test(own) || !/^\d{4}$/.test(first)) return null;
  const forms = employeeIdForms(need.employeeId);
  const key = normalizeTitle(need.title);
  for (let year = Number(own) - 1; year >= Number(first); year--) {
    const entries = (db.trainingNeeds || []).filter((n: TrainingNeed) =>
      n.fiscalYear === String(year) && forms.includes(n.employeeId) && normalizeTitle(n.title) === key);
    const entry = entries.find(n => n.category === need.category) || entries[0];
    if (entry) return entry;
  }
  return null;
}

function needAccomplishment(need: TrainingNeed, asOf: string): TrainingNeedStatus {
  if (typeof need.accomplishedOverride === "boolean") {
    return { accomplished: need.accomplishedOverride, source: "override" };
  }
  const forms = employeeIdForms(need.employeeId);
  const needKey = normalizeTitle(need.title);
  // A need belongs to one plan year, and only training done for that year accomplishes it: a
  // seminar of the same fiscal year (as the participant picker matches needs), or a record
  // dated in that year. Before, a training completed in one year also "completed" the same
  // need listed again for a later year. A need carried forward unmet also follows the entry it
  // continues (5).

  // 1. A seminar HR explicitly linked to this need — exact, no title guessing.
  for (const p of db.trainingParticipants || []) {
    if (!forms.includes(p.employeeId)) continue;
    if (!participantAttended(p)) continue;
    const prog = (db.trainingPrograms || []).find(tp => tp.id === p.trainingProgramId);
    if (!prog || prog.fiscalYear !== need.fiscalYear) continue;
    if (!(prog.fulfillsNeedTitles || []).some(t => normalizeTitle(t) === needKey)) continue;
    const when = toIsoDateLoose(prog.endDate);
    if (!onOrBeforeAsOf(when, asOf)) continue;
    return {
      accomplished: true,
      source: "seminar",
      evidence: `${prog.title} (FY ${prog.fiscalYear}) — linked to this need`,
      date: when || undefined
    };
  }

  // 2. A seminar whose title matches, for seminars created before the link existed.
  for (const p of db.trainingParticipants || []) {
    if (!forms.includes(p.employeeId)) continue;
    if (!participantAttended(p)) continue;
    const prog = (db.trainingPrograms || []).find(tp => tp.id === p.trainingProgramId);
    if (!prog || prog.fiscalYear !== need.fiscalYear || !titlesMatch(need.title, prog.title)) continue;
    const when = toIsoDateLoose(prog.endDate);
    if (!onOrBeforeAsOf(when, asOf)) continue;
    return { accomplished: true, source: "seminar", evidence: `${prog.title} (FY ${prog.fiscalYear})`, date: when || undefined };
  }

  // 3. HR's certificate-backed training ledger.
  for (const t of db.trainings || []) {
    if (!forms.includes(t.employeeId) || t.status === "Rejected") continue;
    if (!titlesMatch(need.title, t.title)) continue;
    const when = toIsoDateLoose(t.dateConducted);
    if (!inNeedPlanYear(need, when) || !onOrBeforeAsOf(when, asOf)) continue;
    return { accomplished: true, source: "recorded-training", evidence: t.title, date: when || undefined };
  }

  // 4. The L&D history parsed from the uploaded PDS (those rows key on the business id).
  const pdsRecord: any = (db.pds || []).find((r: any) => forms.includes(r.employeeId));
  for (const t of (pdsRecord?.trainings || [])) {
    if (!titlesMatch(need.title, t?.title || "")) continue;
    const when = toIsoDateLoose(t?.dateTo || t?.dateFrom);
    if (!inNeedPlanYear(need, when) || !onOrBeforeAsOf(when, asOf)) continue;
    return { accomplished: true, source: "pds", evidence: t.title, date: when || undefined };
  }

  // 5. A carried need is the same need, still open, so it is met once the entry it continues
  // is met: that year's seminar ended after the next year was opened (this office opens it
  // early), HR recorded a certificate late, or HR marked it accomplished. Old-year training is
  // judged only there, so HR's "not accomplished" on that entry still stands.
  const earlier = earlierNeedEntry(need);
  if (earlier) {
    const status = needAccomplishment(earlier, asOf);
    if (status.accomplished) {
      return status.source === "override"
        ? { ...status, evidence: `FY ${earlier.fiscalYear}'s need was marked accomplished` }
        : status;
    }
  }

  return { accomplished: false, source: null };
}

// Office headings as the workbook prints them; any other division follows these.
const TDP_OFFICE_ORDER = ["OFFICE OF THE CHIEF REGIONAL ADJUDICATOR", "LEGAL DIVISION", "ADMINISTRATIVE & FINANCE DIVISION"];

function officeHeading(division?: string): string {
  const d = (division || "").trim();
  return d ? d.toUpperCase().replace(/\bAND\b/g, "&") : "UNASSIGNED";
}

// The whole plan, grouped like the form: every active employee appears, even with
// no needs listed yet.
function buildTrainingPlan(fiscalYear: string, asOf: string): TrainingPlanOffice[] {
  const byOffice = new Map<string, TrainingPlanEmployee[]>();
  // Each need says whether the law requires it (12z Part D); Plan D lists the unmet ones first.
  const mandates = trainingMandateIndex();

  for (const emp of (db.employees || []).filter(e => e.isActive !== false)) {
    const forms = [emp.id, emp.employeeId].filter(Boolean);
    const needs = { "Function": [], "Additional Function": [], "Career Advancement": [] } as Record<TrainingNeedCategory, TrainingNeedRow[]>;
    for (const n of db.trainingNeeds || []) {
      if (n.fiscalYear !== fiscalYear || !forms.includes(n.employeeId)) continue;
      if (!needs[n.category]) continue;
      const mandate = mandateFor(n.title, mandates);
      needs[n.category].push({ ...n, status: needAccomplishment(n, asOf), ...(mandate ? { mandate } : {}) });
    }
    for (const c of TRAINING_NEED_CATEGORIES) {
      needs[c].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    }
    const heading = officeHeading(emp.division);
    if (!byOffice.has(heading)) byOffice.set(heading, []);
    byOffice.get(heading)!.push({
      employeeId: emp.id,
      fullName: emp.fullName,
      position: emp.position || "",
      division: emp.division || "",
      needs
    });
  }

  // Newest first within each office (LIFO, as the user asked on 2026-10-29). Employees carry no date of
  // their own, but a new id holds the moment it was added (`emp-<Date.now()>`), and records are appended
  // as they are added, so the seeded ones (emp-1 …) are the oldest and the stored order breaks ties.
  const stored = new Map((db.employees || []).map((e, i) => [e.id, i]));
  const addedAt = (id: string) => Number(/^emp-(\d{12,})$/.exec(id)?.[1] ?? 0);
  const newestFirst = (a: TrainingPlanEmployee, b: TrainingPlanEmployee) =>
    addedAt(b.employeeId) - addedAt(a.employeeId) || (stored.get(b.employeeId) ?? 0) - (stored.get(a.employeeId) ?? 0);

  return [...byOffice.entries()]
    .map(([office, employees]) => ({ office, employees: employees.sort(newestFirst) }))
    .sort((a, b) => {
      const ai = TDP_OFFICE_ORDER.indexOf(a.office);
      const bi = TDP_OFFICE_ORDER.indexOf(b.office);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.office.localeCompare(b.office);
    });
}

let smtpSkipWarned = false;
function sendEmployeeEmail(emp: Employee, subject: string, text: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (!smtpSkipWarned) {
      console.warn("SMTP_USER/SMTP_PASS not set; employee email notices are skipped (in-app notices still go out).");
      smtpSkipWarned = true;
    }
    return;
  }
  const account = (db.users || []).find(u => u.employeeId === emp.id || u.employeeId === emp.employeeId);
  const to = account?.email || emp.email;
  if (!to) return;
  // Sent once the change it reports is saved, so an undone change emails nobody.
  afterCommit(() => {
    transporter.sendMail({
      from: '"IntegraSync HR" <' + process.env.SMTP_USER + '>',
      to,
      subject,
      text
    }).catch(err => console.error(`Failed to send notice email to ${to}:`, err));
  });
}

// Bell notice (plus email) for one employee. Returns false when a notice with the
// same dedupeKey already exists. Callers are responsible for saveDB().
function notifyEmployee(employeeKey: string, notice: { title: string; message: string; type: Notification["type"]; link?: NotificationLink; dedupeKey?: string }): boolean {
  const emp = (db.employees || []).find(e => e.id === employeeKey || e.employeeId === employeeKey);
  if (!emp) return false;
  if (!notify({ employee: emp.employeeId || emp.id }, notice)) return false;
  sendEmployeeEmail(emp, notice.title, notice.message);
  return true;
}

function notifyTrainingAssignment(participant: TrainingParticipant, program: TrainingProgram) {
  const due = liquidationDueDateFor(program);
  const dates = !isIsoDate(program.startDate) ? "the scheduled dates"
    : program.startDate === program.endDate || !isIsoDate(program.endDate) ? formatLongDate(program.startDate)
    : `${formatLongDate(program.startDate)} to ${formatLongDate(program.endDate)}`;
  notifyEmployee(participant.employeeId, {
    title: `Seminar assignment: ${program.title}`,
    message: `You are assigned to "${program.title}" on ${dates}.` +
      (due ? ` Your liquidation is due on ${formatLongDate(due)} (${LIQUIDATION_DUE_DAYS} days after the seminar ends).` : ""),
    type: "info",
    link: { tab: "employee_portal", record: { kind: "assignment", id: participant.id } },
    dedupeKey: `assign:${participant.id}`
  });
}

// Whether this person holds a place on the seminar already (any enrolment but a cancelled one). The
// enrolment and the participants route's division check both ask it, so they can't disagree.
function onSeminarRoster(programId: string, emp: Employee): boolean {
  return (db.trainingParticipants || []).some(p =>
    p.trainingProgramId === programId && p.status !== "Cancelled" && (p.employeeId === emp.id || p.employeeId === emp.employeeId));
}

// Enrols each requested employee who passes the capacity and eligibility rules and
// notifies them. `alreadyEnrolled` is the program's current head count.
// Callers are responsible for saveDB().
function enrollTrainingParticipants(program: TrainingProgram, employeeIds: string[], actor: { id: string; username: string; role: string }, alreadyEnrolled: number) {
  const created: TrainingParticipant[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  let enrolled = alreadyEnrolled;

  for (const rawId of employeeIds) {
    // By internal id first, as the TDP checks look people up (12z), so a staff code equal to another
    // record's id (7j) can't seat a different person than the one checked and named.
    const emp = employeeByKey(rawId);
    if (!emp) {
      skipped.push(`${rawId} skipped: employee record not found.`);
      continue;
    }
    if (seen.has(emp.id)) continue;
    seen.add(emp.id);

    if (onSeminarRoster(program.id, emp)) {
      skipped.push(`${emp.fullName} skipped: already enrolled in this seminar.`);
      continue;
    }
    if (enrolled >= (program.maxParticipants || Infinity)) {
      skipped.push(`${emp.fullName} skipped: program reached capacity.`);
      continue;
    }
    const block = trainingEnrollmentBlock(emp.id, program);
    if (block) {
      skipped.push(`${emp.fullName} skipped: ${block.reason}.`);
      logEvent(
        actor.id, actor.username, actor.role,
        "Training Enrollment Blocked - Previously Attended",
        `${emp.fullName} was not enrolled in "${program.title}": ${block.reason}.`
      );
      continue;
    }

    const participant: TrainingParticipant = {
      id: `part-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      trainingProgramId: program.id,
      employeeId: emp.id,
      status: "Assigned",
      allowanceAllocated: participantAllowance(program),
      assignedAt: new Date().toISOString()
    };
    if (!db.trainingParticipants) db.trainingParticipants = [];
    db.trainingParticipants.push(participant);
    notifyTrainingAssignment(participant, program);
    created.push(participant);
    enrolled++;
  }
  return { created, skipped };
}

// Reminds participants who have not yet submitted a liquidation: once when 1-3 days
// remain, once on the due date, once when overdue. The dedupeKey per stage keeps it
// idempotent, so re-running (hourly, and on every restart) never repeats a notice.
function runLiquidationReminderSweep() {
  try {
    const today = manilaToday();
    let sent = 0;
    for (const p of db.trainingParticipants || []) {
      if (p.status !== "Assigned") continue;
      // The holder of a group's advance files the group's one report, even if they didn't attend
      // (the user's decision 5, 2026-10-26); someone it covers isn't reminded (HSAC RAB 1).
      const held = advanceCovering(db.cashAdvances || [], p.id, ["Released"]);
      const holdsGroup = !!held && isGroupAdvance(held) && held.activityId === p.id;
      if (groupCoveringOthers(p.id)) continue;
      // Filed already (an absent holder stays "Assigned" while the group's report is reviewed).
      if (reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], p.id)) continue;
      // Someone marked "Did not attend" dropped out (requirement 6) and gets no form, so they
      // have nothing to liquidate; an advance they hold is refunded instead.
      if (p.attendance === "Did not attend" && !holdsGroup) continue;
      const prog = (db.trainingPrograms || []).find(tp => tp.id === p.trainingProgramId);
      const due = liquidationDueDateFor(prog);
      if (!prog || !due) continue;

      const daysLeft = daysBetween(today, due);
      const stage = daysLeft < 0 ? "overdue" : daysLeft === 0 ? "due-today" : daysLeft <= 3 ? "due-soon" : null;
      if (!stage) continue;

      const dueText = formatLongDate(due);
      const whose = holdsGroup ? "Your group's" : "Your";
      const notice =
        stage === "overdue" ? {
          title: `Liquidation overdue: ${prog.title}`,
          message: `${whose} liquidation for "${prog.title}" was due on ${dueText}. Please submit it as soon as possible.`,
          type: "urgent" as const
        } : stage === "due-today" ? {
          title: `Liquidation due today: ${prog.title}`,
          message: `${whose} liquidation for "${prog.title}" is due today, ${dueText}.`,
          type: "warning" as const
        } : {
          title: `Liquidation due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}: ${prog.title}`,
          message: `${whose} liquidation for "${prog.title}" is due on ${dueText}.`,
          type: "warning" as const
        };
      // Opens the seminar's liquidation form, or says why it isn't open yet.
      if (notifyEmployee(p.employeeId, { ...notice, link: { tab: "employee_portal", liquidationActivityId: p.id }, dedupeKey: `liq-due:${p.id}:${stage}` })) sent++;
    }
    if (sent > 0) {
      saveDB();
      console.log(`[liquidation-reminders] sent ${sent} reminder(s)`);
    }
  } catch (err) {
    console.error("[liquidation-reminders] sweep failed:", err);
  }
}

// Employees may read or act on their own training records; HR and Admin on anyone's.
// HR and the Administrator may read anyone's training records; anyone else only their own
// (an officer's login is linked to their own employee record too).
function canAccessEmployeeTrainingRecords(user: any, employeeForms: string[]): boolean {
  if (isTrainingRecordsRole(user.role)) return true;
  return !!user.employeeId && employeeForms.includes(user.employeeId);
}

// Seminars run within office hours (the user, 2026-10-25): each day starts at 8:00 AM or later and
// ends by 5:00 PM, and a one-day seminar ends after it starts. Times are "HH:MM" (24-hour), as the
// planner's time boxes send them, so they compare as text. TrainingDevelopmentView checks the same
// on Save (seminarTimeProblem there), and the server is the rule.
const OFFICE_START = "08:00";
const OFFICE_END = "17:00";
function seminarTimeProblem(startDate: unknown, startTime: unknown, endDate: unknown, endTime: unknown): string | null {
  const hhmm = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if (!hhmm(startTime) || !hhmm(endTime)) return "Enter the start and end times.";
  const start = startTime as string;
  const end = endTime as string;
  if (start < OFFICE_START || start > OFFICE_END) return "The start time must be within office hours: 8:00 AM to 5:00 PM.";
  if (end < OFFICE_START || end > OFFICE_END) return "The end time must be within office hours: 8:00 AM to 5:00 PM.";
  if (startDate === endDate && end <= start) return "On a one-day seminar, the end time must be after the start time.";
  return null;
}

function computeTrainingHours(startDate: string, endDate: string, startTime?: string, endTime?: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  if (startTime && endTime) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (!isNaN(startH) && !isNaN(startM) && !isNaN(endH) && !isNaN(endM)) {
      const startDec = startH + (startM / 60);
      const endDec = endH + (endM / 60);
      const hoursPerDay = Math.max(0, endDec - startDec);
      if (hoursPerDay > 0) {
        return hoursPerDay * diffDays;
      }
    }
  }
  
  return diffDays * 8;
}

// Preset split of a participant's allowance across fixed expense categories.
// Used for short trainings where HR needs a per-head guide rather than one lump sum.
const DEFAULT_TRAINING_BUDGET_SPLIT: TrainingBudgetSplit = {
  Meals: 40,
  Transportation: 30,
  Accommodation: 20,
  Materials: 10
};

// Normalises whatever the client sent into a valid split. Falls back to the
// default when a category is missing/non-numeric, or when the total is not 100.
function normalizeBudgetSplit(raw: any): TrainingBudgetSplit {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TRAINING_BUDGET_SPLIT };
  const keys: (keyof TrainingBudgetSplit)[] = ["Meals", "Transportation", "Accommodation", "Materials"];
  const split = {} as TrainingBudgetSplit;
  for (const k of keys) {
    const v = Number(raw[k]);
    if (!isFinite(v) || v < 0) return { ...DEFAULT_TRAINING_BUDGET_SPLIT };
    split[k] = v;
  }
  const total = keys.reduce((sum, k) => sum + split[k], 0);
  return Math.round(total) === 100 ? split : { ...DEFAULT_TRAINING_BUDGET_SPLIT };
}

// The per-participant ceiling (allocatedBudget / maxParticipants) is unchanged —
// this only breaks that same number down by category.
function computePerParticipantBreakdown(prog: TrainingProgram) {
  const perParticipant = Number(prog.allocatedBudget || 0) / Math.max(1, prog.maxParticipants || 1);
  const split = normalizeBudgetSplit(prog.budgetSplit);
  return {
    perParticipant,
    split: (Object.keys(split) as (keyof TrainingBudgetSplit)[]).map(category => ({
      category,
      percentage: split[category],
      amount: perParticipant * (split[category] / 100)
    }))
  };
}

function autoAssignEmployeeToTraining(employee: Employee) {
  try {
    const activeFy = db.fiscalYears.find(f => f.status === "Active");
    if (!activeFy) return null;
    // Only active staff, as the picker and the coverage panel count them.
    if (employee.isActive === false) return null;

    // At least one training per year: auto-enrolment gives a first one to someone who has none
    // this fiscal year (a seminar, or a training HR recorded). Someone who has one needs nothing
    // here; HR can still add them to more seminars. (This used to log "Annual Limit" on every
    // profile edit, when an employee could have only one seminar a year.)
    const thisYear = yearTrainingCounter(trainingCoverageData(), coverageFiscalYear(activeFy.label))(employee);
    if (thisYear.seminars.length + thisYear.records.length > 0) return null;

    const candidates = (db.trainingPrograms || []).filter(p =>
      p.fiscalYear === activeFy.label &&
      !p.archivedAt &&
      ((p.targetDivision && p.targetDivision === employee.division) ||
       (p.targetSpecialization && p.targetSpecialization === employee.fieldOfSpecialization)) &&
      !employeeAttendedSeminarBefore(employee.id, p) &&
      // Never outside the TDP (12z): an exception needs someone to justify it, and nobody is here to.
      tdpIdentifies(employee.id, p)
    );
    if (candidates.length === 0) return null;

    // Only a seminar still to come can take them: not started, and not finished (requirement 6:
    // enrolling someone reopens a finished seminar). Nothing upcoming matches: nothing to do.
    const today = manilaToday();
    const enrolments = participantsForBudget();
    const upcoming = candidates.filter(p =>
      !(isIsoDate(p.startDate) && String(p.startDate).slice(0, 10) <= today) && !isSeminarSettled(p, enrolments));
    if (upcoming.length === 0) return null;
    // ...and only one with a free seat. (Filling a free seat in an upcoming seminar adds nothing
    // to what it holds, so the ceiling check is a guard that shouldn't fail.)
    const seatsTaken = (p: TrainingProgram) => (db.trainingParticipants || []).filter(pt => pt.trainingProgramId === p.id).length;
    const hasSeat = (p: TrainingProgram) => seatsTaken(p) < (p.maxParticipants || Infinity);
    const withOpenSeats = upcoming.filter(p =>
      hasSeat(p) && !trainingAllocationProblem(p.fiscalYear, Number(p.allocatedBudget || 0), p.id, true));

    if (withOpenSeats.length === 0) {
      // Tell HR, once per employee and seminar: every edit of their profile runs this again.
      const full = !upcoming.some(hasSeat);
      const missedProgram = full ? upcoming[0] : upcoming.find(hasSeat)!;
      notify({ role: UserRole.HR_OFFICER }, {
        title: full ? "Training Program at Capacity" : "Training Budget Can't Cover Enrollment",
        message: `${employee.fullName} matched training program "${missedProgram.title}", but ${full ? "it is full" : `the FY ${activeFy.label} training budget can't cover another participant`}. Please review manually.`,
        type: "warning",
        link: { tab: "training_development", record: { kind: "seminar", id: missedProgram.id } },
        dedupeKey: `auto-enrol-missed:${employee.id}:${missedProgram.id}`
      });
      return null;
    }

    // Someone must stay to man their division (HSAC RAB 1): a seminar that would leave it with nobody
    // isn't picked here, where nobody is asked to confirm. HR is told once, and can seat them by hand.
    const fits = withOpenSeats.filter(p => {
      const ids = seminarAwayIds(p.id);
      return addedDivisionGaps(p.id, { startDate: p.startDate, endDate: p.endDate, ids }, { startDate: p.startDate, endDate: p.endDate, ids: [...ids, employee.id] }).length === 0;
    });
    if (fits.length === 0) {
      notify({ role: UserRole.HR_OFFICER }, {
        title: "Enrollment Would Leave a Division Empty",
        message: `${employee.fullName} matched training program "${withOpenSeats[0].title}", but enrolling them would leave nobody at the office in ${employee.division}. Please review manually.`,
        type: "warning",
        link: { tab: "training_development", record: { kind: "seminar", id: withOpenSeats[0].id } },
        dedupeKey: `auto-enrol-gap:${employee.id}:${withOpenSeats[0].id}`
      });
      return null;
    }

    // 1. Specialization match beats division-only match.
    // 2. If tied, pick earliest startDate
    fits.sort((a, b) => {
      const aSpec = a.targetSpecialization === employee.fieldOfSpecialization ? 0 : 1;
      const bSpec = b.targetSpecialization === employee.fieldOfSpecialization ? 0 : 1;
      if (aSpec !== bSpec) return aSpec - bSpec;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    const chosen = fits[0];
    const part: TrainingParticipant = {
      id: `part-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      trainingProgramId: chosen.id,
      employeeId: employee.id,
      status: "Assigned",
      allowanceAllocated: participantAllowance(chosen),
      assignedAt: new Date().toISOString()
    };
    if (!db.trainingParticipants) db.trainingParticipants = [];
    db.trainingParticipants.push(part);
    notifyTrainingAssignment(part, chosen);

    logEvent("system", "system", UserRole.SUPER_ADMIN, "Auto-Enroll Training Participant",
      `Auto-enrolled ${employee.fullName} (${employee.employeeId}) into "${chosen.title}" based on ${chosen.targetSpecialization === employee.fieldOfSpecialization ? "specialization" : "division"} match.`);
    return part;
  } catch (error) {
    console.error("Failed auto-enrolling employee to training program:", error);
    return null;
  }
}

// --- SHARED TRAINING BUDGET USAGE ---
// Training utilization is always DERIVED from the programs themselves, never stored
// in a counter of its own. Three separate paths already increment
// trainingPrograms[].usedBudget with no idempotency guard, so a fourth stored total
// would drift; deriving keeps HR's planner and the Budget Officer's monitor in step.
// Note trainingBudgets joins on fiscalYearId while trainingPrograms joins on the
// fiscal year LABEL — the label must be resolved through db.fiscalYears first.
// Enrolments as the training budget rule reads them (src/trainingBudget.ts): each with the cash
// still out for it (a group advance split by its covers) and, once liquidated, what it spent. The
// rules are in src/server/budgetEnrolments.ts. `changed` prices an attendance change before it is
// saved.
function participantsForBudget(changed?: { id: string; attendance: string }): any[] {
  return enrolmentsForBudget({
    participants: db.trainingParticipants || [],
    advances: db.cashAdvances || [],
    ledgerRows: db.trainingLiquidations || [],
    reports: db.liquidationSubmissions || []
  }, changed);
}

function computeTrainingUsage(fiscalYearId: string) {
  const fy = (db.fiscalYears || []).find((f: any) => f.id === fiscalYearId);
  const tb = (db.trainingBudgets || []).find((b: any) => b.fiscalYearId === fiscalYearId);
  const totalBudget = Number(tb?.totalBudget || 0);
  // A seminar archived before anything happened to it is left out, as a deleted one was; one
  // archived after it finished still counts what it spent (src/trainingBudget.ts).
  const programs = (db.trainingPrograms || []).filter((p: any) => fy && p.fiscalYear === fy.label && !p.archivedBeforeUse);
  const allocated = programs.reduce((s: number, p: any) => s + Number(p.allocatedBudget || 0), 0);
  const spent = programs.reduce((s: number, p: any) => s + Number(p.usedBudget || 0), 0);
  // What the seminars take out of the budget: actual spending once a seminar is closed,
  // its allocation less the shares released for non-attendees until then (see
  // src/trainingBudget.ts). The rest is Unallocated.
  const enrolments = participantsForBudget();
  const seminars = programs.map((p: any) => seminarBudget(p, enrolments));
  const committed = round2(seminars.reduce((s: number, b) => s + b.committed, 0));
  return {
    totalBudget,
    allocated,
    spent,
    committed,
    // Unallocated. (Field name kept: existing consumers read `remaining`.)
    remaining: round2(totalBudget - committed),
    // What came back to Unallocated: from closed seminars (allocated − spent) and, while
    // seminars are still open, the shares of participants who did not attend.
    returnedFromSettled: round2(seminars.reduce((s: number, b) => s + b.returned, 0)),
    settledReturning: seminars.filter(b => b.returned > 0).length,
    releasedForAbsent: round2(seminars.reduce((s: number, b) => s + b.released, 0)),
    absentCount: seminars.reduce((s: number, b) => s + (b.released > 0 ? b.absent : 0), 0),
    // Cash advances still out with non-attendees: held until Finance records the refund.
    heldForAdvances: round2(seminars.reduce((s: number, b) => s + b.held, 0)),
    heldCount: seminars.reduce((s: number, b) => s + b.heldCount, 0),
    percentAllocated: totalBudget > 0 ? Math.round((allocated / totalBudget) * 100) : 0,
    percentSpent: totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0,
    programCount: programs.length
  };
}

// PHP amounts in messages, e.g. "PHP 2,500.00".
const pesoText = (n: number) => `PHP ${round2(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// A seminar's allocation, read strictly: pesos from 0 to a billion, blank meaning 0.
function readAllocation(value: unknown): number | null {
  return value === undefined || value === null || value === "" ? 0 : parsePeso(value);
}
// A seminar's seats: a whole number from 1 to 1,000. Undefined when not given.
function readSeats(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d{1,4}$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : null;
}
const ALLOCATION_MESSAGE = "Enter the allocated budget as an amount in pesos, from 0 to 1,000,000,000.";
const SEATS_MESSAGE = "Enter the number of seats as a whole number from 1 to 1,000.";

// Server-side ceiling check for training allocations: null when the change fits, otherwise
// why it doesn't. Only what the change ADDS to the year's seminars needs room
// (allocationIncrease in src/trainingBudget.ts): re-saving a row, cutting it, or editing a
// closed seminar always passes, even after an approved overspend has taken the year past
// its budget. `addsParticipants`: the save enrols someone new, which reopens a closed
// seminar. `newSeats`: the save changes the number of seats, which re-prices what a
// non-attendee's share releases. A closed year's unallocated money was carried over, so
// nothing in it can grow, and a label with no fiscal year is outside every budget.
function trainingAllocationProblem(fyLabel: string, newAmount: number, excludeProgramId?: string, addsParticipants = false, newSeats?: number): string | null {
  const existing = excludeProgramId ? (db.trainingPrograms || []).find((p: any) => p.id === excludeProgramId) : undefined;
  const increase = allocationIncrease(existing, participantsForBudget(), Number(newAmount || 0), addsParticipants, newSeats);
  if (increase <= 0) return null;
  const fy = (db.fiscalYears || []).find((f: any) => f.label === fyLabel);
  if (!fy) {
    return `There is no fiscal year ${String(fyLabel ?? "")}, so this change, which needs ${pesoText(increase)} more, can't be made.`;
  }
  if (fy.status !== "Active") {
    return `FY ${fy.label} is closed and its unallocated training money was carried over, so this change, which needs ${pesoText(increase)} more, can't be made.`;
  }
  const usage = computeTrainingUsage(fy.id);
  const projected = round2(usage.committed + increase);
  return projected > round2(usage.totalBudget)
    ? `Seminars would then take ${pesoText(projected)} of the ${fy.label} training budget of ${pesoText(usage.totalBudget)}.`
    : null;
}

app.get("/api/training/budgets", authenticateToken, (req: any, res: any) => {
  // Officers only: the figures include how many participants did not attend.
  if (![UserRole.SUPER_ADMIN, UserRole.HR_OFFICER, UserRole.FINANCE_OFFICER, UserRole.BUDGET_OFFICER].includes(req.user.role)) {
    return res.status(403).json({ status: "error", message: "Training budget figures are for the Administrator, HR, Finance and the Budget Officer." });
  }
  // Derived usage is spread onto each row; purely additive, so existing consumers
  // that only read totalBudget/carryOverBudget/newAnnualBudget are unaffected.
  const data = (db.trainingBudgets || []).map((b: any) => ({ ...b, ...computeTrainingUsage(b.fiscalYearId) }));
  res.json({ status: "success", data });
});

app.post("/api/training/budgets", authenticateToken, (req: any, res: any) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.BUDGET_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }
  const { fiscalYearId, newAnnualBudget, totalBudget } = req.body;
  
  const targetFy = db.fiscalYears.find((f: any) => f.id === fiscalYearId);
  if (!targetFy || targetFy.status !== "Active") {
    return res.status(400).json({ status: "error", message: "Cannot modify training budget for a closed fiscal year." });
  }

  // Backwards compatibility or direct override
  const annualAmount = newAnnualBudget !== undefined ? parseFloat(newAnnualBudget) : parseFloat(totalBudget);
  
  let budget = db.trainingBudgets.find(b => b.fiscalYearId === fiscalYearId);
  if (budget) {
    budget.newAnnualBudget = annualAmount;
    // Rounded: a carry-over with centavos would otherwise store e.g. 51000.299999999996.
    budget.totalBudget = round2((budget.carryOverBudget || 0) + annualAmount);
  } else {
    budget = {
      id: `tb-${Date.now()}`,
      fiscalYearId,
      carryOverBudget: 0,
      newAnnualBudget: annualAmount,
      totalBudget: annualAmount
    };
    db.trainingBudgets.push(budget);
  }
  const newBudget = budget;
  saveDB();
  res.json({ status: "success", data: newBudget });
});

// Training programs, participants and liquidation expenses are HR's records. The
// Budget module only sees the derived totals from GET /api/training/budgets.
function isTrainingRecordsRole(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.HR_OFFICER;
}

app.get("/api/training/programs", authenticateToken, (req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Training program details are restricted to HR." });
  }
  // With where each stands against the TDP (12z Part C). A seminar's own justification travels with
  // it, so this list stays HR's and the Administrator's, and out of the browser's cache.
  res.set("Cache-Control", "no-store");
  const rows: TrainingProgramRow[] = (db.trainingPrograms || []).map(p => ({
    ...p, tdp: seminarTdpStanding({ inTdp: seminarInTdp(p), tdpException: p.tdpException, createdAt: p.createdAt })
  }));
  res.json({ status: "success", data: rows });
});

// Ranked participant suggestions for a seminar. Works for saved programs
// (programId) and for unsaved draft rows; query values override stored ones so the
// ranking follows whatever HR is currently editing.
app.get("/api/training/recommendations", authenticateToken, (req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Training program details are restricted to HR." });
  }
  const q = req.query;
  const stored = q.programId ? (db.trainingPrograms || []).find(p => p.id === q.programId) : undefined;
  if (q.programId && !stored) {
    return res.status(404).json({ status: "error", message: "Program not found" });
  }
  const title = typeof q.title === "string" && q.title.trim() ? q.title.trim() : stored?.title;
  if (!title) {
    return res.status(400).json({ status: "error", message: "Enter the seminar title first so participants can be recommended." });
  }
  const activeFy = (db.fiscalYears || []).find((f: any) => f.status === "Active");
  const program: SeminarRef = {
    id: stored?.id,
    seriesId: stored?.seriesId,
    title,
    fiscalYear: (typeof q.fiscalYear === "string" && q.fiscalYear) || stored?.fiscalYear || activeFy?.label || "",
    targetDivision: typeof q.targetDivision === "string" ? q.targetDivision : stored?.targetDivision,
    targetSpecialization: typeof q.targetSpecialization === "string" ? q.targetSpecialization : stored?.targetSpecialization,
    maxParticipants: q.maxParticipants !== undefined ? (parseInt(q.maxParticipants) || 0) : stored?.maxParticipants,
    // Repeatable ?needTitle= lets an unsaved draft row rank correctly before it is saved.
    fulfillsNeedTitles: q.needTitle !== undefined
      ? normalizeFulfillsNeedTitles(Array.isArray(q.needTitle) ? q.needTitle : [q.needTitle])
      : stored?.fulfillsNeedTitles
  };
  // Who is already at another seminar on this one's weekdays (?startDate=&endDate= for a draft, as
  // HR edits it), for the picker's badge and its warning that a division would be left with nobody.
  const days = seminarWeekdays(
    typeof q.startDate === "string" && q.startDate ? q.startDate : stored?.startDate,
    typeof q.endDate === "string" && q.endDate ? q.endDate : stored?.endDate
  );
  const elsewhere = awayAtOtherSeminars(stored?.id);
  const ranked = rankTrainingCandidates(program);
  // Whether the seminar's own justification will cover everyone on it (12z Part C), so the picker asks
  // nobody for their own: the seminar as drafted is outside the TDP, and Save asks for one (a new
  // seminar, or one in the TDP now) or one is on record. The picker no longer guesses it from the row.
  const seminarCovers = !seminarInTdp(program) && (!stored || seminarInTdp(stored) || !!stored.tdpException);
  res.json({ status: "success", data: { ...ranked, candidates: ranked.candidates.map(c => ({ ...c, awayOn: days.filter(d => elsewhere(c.employeeId, d)) })), seminarCovers } });
});

// Programs & Budget's coverage panel: at least one training per year per employee. How many
// active employees have one in the fiscal year (the active one unless ?fiscalYear= names
// another), and who doesn't yet. HR and the Administrator, like the rest of the plan.
app.get("/api/training/coverage", authenticateToken, (req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Training coverage is restricted to HR." });
  }
  const asked = typeof req.query.fiscalYear === "string" ? req.query.fiscalYear.trim() : "";
  const activeFy = (db.fiscalYears || []).find((f: any) => f.status === "Active");
  const label = asked || activeFy?.label;
  if (!label) return res.status(400).json({ status: "error", message: "No fiscal year is active." });
  if (!(db.fiscalYears || []).some((f: any) => String(f.label) === String(label))) {
    return res.status(404).json({ status: "error", message: `There is no fiscal year ${label}.` });
  }
  res.json({ status: "success", data: trainingCoverage(db.employees || [], trainingCoverageData(), coverageFiscalYear(label)) });
});

// --- OFFICIAL TDP PLAN A / PLAN D ---
// HR owns these records, so the whole group is HR + Admin only.
function requireTrainingPlanRole(req: any, res: any): boolean {
  if (!isTrainingRecordsRole(req.user.role)) {
    res.status(403).json({ status: "error", message: "The Training and Development Plan is restricted to HR." });
    return false;
  }
  return true;
}

function activeFiscalYearLabel(): string {
  const fy = (db.fiscalYears || []).find((f: any) => f.status === "Active");
  return fy?.label || String(new Date().getFullYear());
}

// The distinct needed trainings in a year's plan — what HR ticks when saying which
// of them a seminar covers.
// --- POST-TRAINING PERFORMANCE EVALUATION REPORT ---

const EVALUATION_ITEM_COUNT = 5;

/**
 * Normalises the five scored statements. Anything that is not 1-4 becomes null ("not yet
 * rated") rather than an error, so a half-finished draft can still be saved; the total is
 * simply lower until every statement is scored.
 */
function normalizeEvaluationRatings(raw: any): (TrainingEvaluationRating | null)[] {
  const out: (TrainingEvaluationRating | null)[] = [];
  for (let i = 0; i < EVALUATION_ITEM_COUNT; i++) {
    const v = Number(Array.isArray(raw) ? raw[i] : undefined);
    out.push(v === 1 || v === 2 || v === 3 || v === 4 ? (v as TrainingEvaluationRating) : null);
  }
  return out;
}

function normalizeEvaluationComments(raw: any): string[] {
  const out: string[] = [];
  for (let i = 0; i < EVALUATION_ITEM_COUNT; i++) {
    out.push(String((Array.isArray(raw) ? raw[i] : "") ?? "").trim());
  }
  return out;
}

/**
 * Overall Rating is the sum of the five ticks and the Qualitative Rating is its band —
 * both derived here and never accepted from the client, so the printed rating can never
 * disagree with the boxes above it.
 */
function evaluationTotals(ratings: (TrainingEvaluationRating | null)[]) {
  const overallRating = ratings.reduce((sum: number, r) => sum + (r || 0), 0);
  const band = TRAINING_EVALUATION_BANDS.find(b => overallRating >= b.min && overallRating <= b.max);
  // The printed table stops at 20, which is also the maximum, so a miss can only mean a
  // malformed ratings array; fall back to the lowest band rather than leaving it blank.
  const qualitativeRating: TrainingQualitativeRating = band ? band.label : TRAINING_EVALUATION_BANDS[0].label;
  return { overallRating, qualitativeRating };
}

/** Everyone whose seminar has finished, with their evaluation if one exists. */
app.get("/api/training/evaluations", authenticateToken, (req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Training evaluations are restricted to HR." });
  }

  const today = manilaToday();
  const rows: any[] = [];

  for (const p of (db.trainingParticipants || [])) {
    if (p.status === "Cancelled" || p.status === "Archived") continue;
    const prog = (db.trainingPrograms || []).find((tp: any) => tp.id === p.trainingProgramId);
    if (!prog) continue;

    // Evaluation is about performance after the fact, so it opens when the seminar has
    // ended — not when the money is settled.
    const ended = toIsoDateLoose(prog.endDate);
    if (!ended || !onOrBeforeAsOf(ended, today)) continue;

    const emp = (db.employees || []).find((e: any) => e.id === p.employeeId || e.employeeId === p.employeeId);
    const evaluation = (db.trainingEvaluations || []).find((e: any) => e.trainingParticipantId === p.id) || null;

    rows.push({
      trainingParticipantId: p.id,
      trainingProgramId: prog.id,
      employeeId: p.employeeId,
      employeeName: emp ? emp.fullName : p.employeeId,
      // Printed on the report; read here so HR never retypes them.
      position: emp ? emp.position : "",
      division: emp ? emp.division : "",
      trainingTitle: String(prog.title || "").trim(),
      dateConducted: prog.startDate,
      dateEnded: prog.endDate,
      organizer: prog.facilitator || "",
      participantStatus: p.status,
      evaluation
    });
  }

  rows.sort((a, b) =>
    Number(!!a.evaluation) - Number(!!b.evaluation) ||
    String(a.employeeName).localeCompare(String(b.employeeName)));
  res.json({ status: "success", data: rows });
});

/** Create or update the evaluation for one participant. One per person per seminar. */
app.post("/api/training/evaluations", authenticateToken, (req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Only HR may record a training evaluation." });
  }

  const {
    trainingParticipantId, dateOfEvaluation, supervisorName, supervisorPosition,
    ratings, comments, status
  } = req.body || {};

  if (!trainingParticipantId) {
    return res.status(400).json({ status: "error", message: "Choose the participant this evaluation is for." });
  }

  const participant = (db.trainingParticipants || []).find((p: any) => p.id === trainingParticipantId);
  if (!participant) {
    return res.status(404).json({ status: "error", message: "That seminar participant no longer exists." });
  }
  // Taken off an archived seminar, or left off when it was restored: they never took part.
  if (participant.status === "Archived" || participant.status === "Cancelled") {
    return res.status(400).json({ status: "error", message: "This enrolment was cancelled, so there is nothing to evaluate." });
  }

  const prog = (db.trainingPrograms || []).find((tp: any) => tp.id === participant.trainingProgramId);
  if (!prog) {
    return res.status(404).json({ status: "error", message: "That seminar no longer exists." });
  }

  const ended = toIsoDateLoose(prog.endDate);
  if (!ended || !onOrBeforeAsOf(ended, manilaToday())) {
    return res.status(400).json({ status: "error", message: "This seminar has not finished yet, so it cannot be evaluated." });
  }

  const finalising = status === "Finalized";
  const cleanRatings = normalizeEvaluationRatings(ratings);
  const cleanComments = normalizeEvaluationComments(comments);

  // A draft may be incomplete; a finalised report is a signed record and may not be.
  if (finalising) {
    if (cleanRatings.some(r => r === null)) {
      return res.status(400).json({ status: "error", message: "Score all five statements before finalising." });
    }
    if (!String(supervisorName || "").trim()) {
      return res.status(400).json({ status: "error", message: "Enter the immediate supervisor's name before finalising." });
    }
    if (!isIsoDate(dateOfEvaluation)) {
      return res.status(400).json({ status: "error", message: "Enter the date of evaluation before finalising." });
    }
  }

  const totals = evaluationTotals(cleanRatings);
  const existing = (db.trainingEvaluations || []).find((e: any) => e.trainingParticipantId === trainingParticipantId);

  if (existing && existing.status === "Finalized") {
    return res.status(400).json({
      status: "error",
      message: `This evaluation was finalised on ${existing.dateOfEvaluation || existing.evaluatedAt?.split("T")[0]} and can no longer be changed.`
    });
  }

  const record = {
    id: existing ? existing.id : `tev-${Date.now()}`,
    trainingParticipantId,
    trainingProgramId: prog.id,
    employeeId: participant.employeeId,
    dateOfEvaluation: dateOfEvaluation || "",
    supervisorName: String(supervisorName || "").trim(),
    supervisorPosition: String(supervisorPosition || "").trim(),
    ratings: cleanRatings,
    comments: cleanComments,
    overallRating: totals.overallRating,
    qualitativeRating: totals.qualitativeRating,
    status: finalising ? "Finalized" : "Draft",
    evaluatedBy: (req as any).user.fullName,
    evaluatedAt: new Date().toISOString()
  };

  if (existing) Object.assign(existing, record);
  else db.trainingEvaluations.push(record);

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role,
    finalising ? "Finalize Training Evaluation" : "Save Training Evaluation",
    `${finalising ? "Finalised" : "Saved draft"} post-training evaluation for participant ${trainingParticipantId} — ${totals.overallRating}/20 (${totals.qualitativeRating})`);
  saveDB();
  res.json({ status: "success", data: record });
});

// --- PLAN A WORKBOOK IMPORT ---

/** Decodes the uploaded file and refuses anything that is not a zip, before any parsing. */
function decodePlanAUpload(base64Data: any): Buffer {
  const buf = Buffer.from(String(base64Data || ""), "base64");
  if (buf.length === 0) {
    throw new XlsxReadError("No file was received. Please choose the workbook and try again.");
  }
  if (buf.length > 20 * 1024 * 1024) {
    throw new XlsxReadError("That file is too large. The Plan A workbook should be well under 20 MB.");
  }
  // "PK\x03\x04" - every .xlsx starts here. A PDF or an older .xls fails immediately,
  // with a message that names the likely mistake.
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw new XlsxReadError("That is not an .xlsx workbook — please upload the Excel file, not a PDF or an older .xls.");
  }
  return buf;
}

/** Scans every sheet once; used by both routes so they can never disagree. */
function scanPlanAWorkbook(buf: Buffer) {
  const wb = readXlsxWorkbook(buf);
  return wb.sheets.map(s => ({ ref: s, scan: parsePlanASheet(wb.grid(s.part), s.name) }));
}

/**
 * Reads the workbook and reports what it found. Writes NOTHING — no saveDB() on this
 * path — so HR can upload, look, switch sheets and cancel without touching the plan.
 */
app.post("/api/training/needs/import/preview", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;

  const { base64Data, filename, sheetName } = req.body || {};
  const fiscalYear = req.body?.fiscalYear || activeFiscalYearLabel();

  let scanned: ReturnType<typeof scanPlanAWorkbook>;
  let buf: Buffer;
  try {
    buf = decodePlanAUpload(base64Data);
    scanned = scanPlanAWorkbook(buf);
  } catch (err: any) {
    const msg = err instanceof XlsxReadError ? err.message : "That workbook could not be read.";
    if (!(err instanceof XlsxReadError)) console.error("[plan-a-import] read failed:", err?.message || err);
    return res.status(400).json({ status: "error", message: msg });
  }

  const planASheets = scanned.filter(s => s.scan.isPlanA);
  if (planASheets.length === 0) {
    const detail = scanned.map(s => `"${s.ref.name}": ${s.scan.reason}`).join(" ");
    return res.status(400).json({
      status: "error",
      message: `No Plan A sheet was found in that workbook. ${detail}`
    });
  }

  // Prefer the sheet HR asked for, then the one whose year matches the plan being
  // edited, then the only Plan A sheet, then the most recent.
  const chosen =
    (sheetName && planASheets.find(s => s.ref.name === sheetName)) ||
    planASheets.find(s => s.scan.detectedYear === fiscalYear) ||
    (planASheets.length === 1 ? planASheets[0] : null) ||
    [...planASheets].sort((a, b) => String(b.scan.detectedYear || "").localeCompare(String(a.scan.detectedYear || "")))[0];

  if (sheetName && !planASheets.find(s => s.ref.name === sheetName)) {
    const bad = scanned.find(s => s.ref.name === sheetName);
    return res.status(400).json({
      status: "error",
      message: bad ? `${bad.scan.reason}` : `That workbook has no sheet named "${sheetName}".`
    });
  }

  const employees = db.employees || [];
  // Needs already in the target year, so the preview can say what would be skipped.
  const existing = new Set(
    (db.trainingNeeds || [])
      .filter((n: any) => n.fiscalYear === fiscalYear)
      .map((n: any) => trainingNeedKey(employeeIdForms(n.employeeId)[0], n.category, n.title))
  );

  const seenInFile = new Set<string>();
  let duplicatesInFile = 0;
  let alreadyInPlanTotal = 0;

  const blocks = chosen.scan.blocks.map(b => {
    const m = matchWorkbookName(b.name, employees);
    const emp = m.employeeId ? employees.find((e: any) => e.id === m.employeeId) : null;

    const needCounts: any = { "Function": 0, "Additional Function": 0, "Career Advancement": 0 };
    let alreadyInPlan = 0;
    for (const need of b.needs) {
      needCounts[need.category]++;
      // Count what a commit would skip, using the id it would actually be filed under.
      const key = trainingNeedKey(emp ? emp.id : `?${b.key}`, need.category, need.title);
      if (seenInFile.has(key)) duplicatesInFile++;
      else {
        seenInFile.add(key);
        if (emp && existing.has(key)) alreadyInPlan++;
      }
    }
    alreadyInPlanTotal += alreadyInPlan;

    return {
      key: b.key,
      startRow: b.startRow,
      workbookName: b.name,
      workbookPosition: b.position,
      workbookOffice: b.office,
      match: emp ? {
        employeeId: emp.id, fullName: emp.fullName,
        storedPosition: emp.position || "", storedDivision: emp.division || ""
      } : null,
      suggestions: m.suggestions,
      needCounts,
      sampleTitles: b.needs.slice(0, 3).map(n => n.title),
      alreadyInPlan,
      positionDiffers: !!(emp && b.position &&
        normalizeTitle(emp.position || "") !== normalizeTitle(b.position))
    };
  });

  const needs = chosen.scan.blocks.reduce((n, b) => n + b.needs.length, 0);
  const matched = blocks.filter(b => b.match).length;

  const preview = {
    fileDigest: crypto.createHash("sha256").update(buf).digest("hex"),
    filename: String(filename || "").slice(0, 200).replace(/[\u0000-\u001f]/g, ""),
    fiscalYear,
    sheets: scanned.map(s => ({
      name: s.ref.name,
      isPlanA: s.scan.isPlanA,
      reason: s.scan.reason,
      detectedYear: s.scan.detectedYear,
      employeeCount: s.scan.blocks.length,
      needCount: s.scan.blocks.reduce((n, b) => n + b.needs.length, 0)
    })),
    selectedSheet: chosen.ref.name,
    detectedYear: chosen.scan.detectedYear,
    yearMatchesFiscalYear: chosen.scan.detectedYear === fiscalYear,
    offices: chosen.scan.offices,
    totals: {
      blocks: blocks.length,
      matched,
      unmatched: blocks.length - matched,
      needs,
      duplicatesInFile,
      alreadyInPlan: alreadyInPlanTotal,
      netNewNeeds: needs - duplicatesInFile - alreadyInPlanTotal
    },
    warnings: chosen.scan.warnings,
    blocks
  };

  // Deliberately NOT logEvent'd. logEvent calls saveDB(), which rewrites the whole of
  // data_store.json synchronously and non-atomically — so logging a preview would mean a
  // full-file write every time HR switches sheets in the picker, and would break the one
  // invariant this whole design rests on: that looking at a workbook cannot change the
  // plan. The commit is logged; reading a file the user just uploaded is not an event
  // worth risking the database for.
  console.log(`[plan-a-import] preview by ${req.user.username}: "${preview.filename}" sheet "${chosen.ref.name}" — ${blocks.length} row(s), ${needs} need(s), ${matched} matched`);
  res.json({ status: "success", data: preview });
});

/**
 * Writes a confirmed import. Takes the same file back rather than the parsed rows, so
 * the titles stored are provably the ones HR previewed and a client cannot substitute
 * its own text.
 */
app.post("/api/training/needs/import/commit", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;

  const { base64Data, fileDigest, sheetName, filename } = req.body || {};
  const fiscalYear = req.body?.fiscalYear || activeFiscalYearLabel();
  const assignments = Array.isArray(req.body?.assignments) ? req.body.assignments : [];

  let buf: Buffer;
  let scanned: ReturnType<typeof scanPlanAWorkbook>;
  try {
    buf = decodePlanAUpload(base64Data);
    scanned = scanPlanAWorkbook(buf);
  } catch (err: any) {
    const msg = err instanceof XlsxReadError ? err.message : "That workbook could not be read.";
    return res.status(400).json({ status: "error", message: msg });
  }

  if (crypto.createHash("sha256").update(buf).digest("hex") !== String(fileDigest || "")) {
    return res.status(400).json({ status: "error", message: "The file changed since the preview. Please upload it again." });
  }

  const chosen = scanned.find(s => s.ref.name === sheetName);
  if (!chosen) return res.status(400).json({ status: "error", message: `That workbook has no sheet named "${sheetName}".` });
  if (!chosen.scan.isPlanA) return res.status(400).json({ status: "error", message: chosen.scan.reason || "That sheet is not Plan A." });

  // Writing into a closed year would put 480 needs somewhere nothing ever shows them.
  const fy = (db.fiscalYears || []).find((f: any) => f.label === fiscalYear);
  if (!fy) return res.status(400).json({ status: "error", message: `There is no fiscal year "${fiscalYear}".` });
  if (fy.status === "Closed") return res.status(400).json({ status: "error", message: `The ${fiscalYear} plan is closed and cannot be changed.` });

  if (assignments.length > 200) {
    return res.status(400).json({ status: "error", message: "That is more rows than one import can handle." });
  }

  // --- Validate every assignment BEFORE writing anything, so there are no partial imports.
  const byKey = new Map<string, PlanABlock>(chosen.scan.blocks.map(b => [b.key, b] as [string, PlanABlock]));
  const chosenEmployees = new Map<string, any>();
  const resolved: { block: any; emp: any }[] = [];

  for (const a of assignments) {
    const block = byKey.get(a?.key);
    if (!block) return res.status(400).json({ status: "error", message: `Row "${a?.key}" is no longer in that sheet. Please upload the file again.` });
    if (String(a?.workbookName ?? "") !== block.name) {
      return res.status(400).json({ status: "error", message: `Row ${block.startRow} changed since the preview. Please upload the file again.` });
    }
    if (!a.employeeId) continue; // deliberately skipped

    const emp = (db.employees || []).find((e: any) => e.id === a.employeeId || e.employeeId === a.employeeId);
    if (!emp) return res.status(404).json({ status: "error", message: `Row ${block.startRow} is mapped to an employee who no longer exists.` });
    if (emp.isActive === false) {
      return res.status(400).json({ status: "error", message: `${emp.fullName} is inactive, so their needs would not appear in the plan.` });
    }
    if (chosenEmployees.has(emp.id)) {
      return res.status(400).json({ status: "error", message: `Two rows are mapped to ${emp.fullName}. Each row must be a different employee.` });
    }
    chosenEmployees.set(emp.id, emp);
    resolved.push({ block, emp });
  }

  // --- Write. One dedupe index for the whole batch: the per-need scan the single-add
  // path uses would be O(n^2) with an employee lookup inside it at this volume.
  const seen = new Set<string>(
    (db.trainingNeeds || [])
      .filter((n: any) => n.fiscalYear === fiscalYear)
      .map((n: any) => trainingNeedKey(employeeIdForms(n.employeeId)[0], n.category, n.title))
  );
  const before = seen.size;

  let imported = 0, skippedDuplicateInFile = 0, skippedAlreadyInPlan = 0, i = 0;
  const perEmployee: any[] = [];

  for (const { block, emp } of resolved) {
    let mine = 0, skipped = 0;
    for (const need of block.needs) {
      const key = trainingNeedKey(emp.id, need.category, need.title);
      const wasThereBefore = seen.has(key);
      const r = createTrainingNeed(emp, need.category, need.title, fiscalYear, req.user.username, seen, String(i++));
      if (r.need) { imported++; mine++; }
      else {
        skipped++;
        if (r.code === "duplicate") { if (wasThereBefore && before > 0) skippedAlreadyInPlan++; else skippedDuplicateInFile++; }
      }
    }
    perEmployee.push({ employeeId: emp.id, fullName: emp.fullName, imported: mine, skipped });
  }

  const skippedRows = chosen.scan.blocks.length - resolved.length;
  const safeName = String(filename || "").slice(0, 200).replace(/[\u0000-\u001f]/g, "");

  // One audit entry, not one per need - 480 rows would bury the log and rewrite
  // data_store.json each time.
  logEvent(req.user.id, req.user.username, req.user.role, "Import Plan A Workbook",
    `Imported ${imported} training need(s) from "${safeName}" sheet "${chosen.ref.name}" into the ${fiscalYear} plan for ${resolved.length} employee(s); ` +
    `${skippedRows} row(s) skipped, ${skippedDuplicateInFile} duplicate(s) in the file, ${skippedAlreadyInPlan} already in the plan.`);

  if (imported > 0) {
    notify({ role: UserRole.HR_OFFICER }, {
      title: `${imported} training need(s) imported into Plan A`,
      message: `Plan A for ${fiscalYear} gained ${imported} need(s) from the uploaded workbook "${safeName}".`,
      type: "info",
      link: { tab: "training_development", subTab: "plan-a" }
    });
  }

  saveDB();
  res.json({
    status: "success",
    data: { fiscalYear, sheetName: chosen.ref.name, imported, skippedRows, skippedDuplicateInFile, skippedAlreadyInPlan, perEmployee }
  });
});

app.get("/api/training/needs/catalog", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const fiscalYear = (typeof req.query.fiscalYear === "string" && req.query.fiscalYear) || activeFiscalYearLabel();

  const byTitle = new Map<string, { title: string; employees: Set<string>; categories: Set<TrainingNeedCategory> }>();
  for (const need of db.trainingNeeds || []) {
    if (need.fiscalYear !== fiscalYear) continue;
    const key = normalizeTitle(need.title);
    if (!key) continue;
    if (!byTitle.has(key)) byTitle.set(key, { title: need.title, employees: new Set(), categories: new Set() });
    const entry = byTitle.get(key)!;
    entry.employees.add(employeeIdForms(need.employeeId)[0]);
    entry.categories.add(need.category);
  }

  // Mandated trainings first (12z Part D), then by how many people list them.
  const mandates = trainingMandateIndex();
  const data: TrainingNeedCatalogItem[] = catalogOrder([...byTitle.values()].map(e => {
    const mandate = mandateFor(e.title, mandates);
    return { title: e.title, employeeCount: e.employees.size, categories: [...e.categories], ...(mandate ? { mandate } : {}) };
  }));

  res.json({ status: "success", data: { fiscalYear, needs: data } });
});

// Plan A (needs) and Plan D (the same needs, checked off as of a date).
app.get("/api/training/needs", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const fiscalYear = (typeof req.query.fiscalYear === "string" && req.query.fiscalYear) || activeFiscalYearLabel();
  const asOf = toIsoDateLoose(req.query.asOf) || manilaToday();
  res.json({ status: "success", data: { fiscalYear, asOf, offices: buildTrainingPlan(fiscalYear, asOf) } });
});

interface CreateNeedResult {
  /** null when nothing was created; `code` and `message` then say why. */
  need: TrainingNeed | null;
  code: "bad-category" | "empty" | "too-long" | "duplicate" | null;
  message: string;
}

/** The dedupe key a training need occupies: one title, per person, per column, per year. */
function trainingNeedKey(employeeInternalId: string, category: string, title: string): string {
  return `${employeeInternalId}|${category}|${normalizeTitle(title)}`;
}

/**
 * The single place a training need is validated and created.
 *
 * Shared by the inline add-box and the workbook import so there is exactly one set of
 * rules. `seen` is the caller's dedupe index: the inline path omits it and pays for a
 * scan of db.trainingNeeds, while the bulk path pre-seeds it once — without that, 480
 * inserts would each re-scan every need and call employeeIdForms (itself a linear scan
 * of db.employees) inside the loop.
 *
 * `idSuffix` exists because `Date.now()` is not unique across a bulk insert: hundreds of
 * needs created in the same millisecond collide often enough that two could share an id,
 * which would make DELETE /api/training/needs/:id remove the wrong row.
 */
function createTrainingNeed(
  emp: any,
  category: any,
  rawTitle: string,
  fiscalYear: string,
  username: string,
  seen?: Set<string>,
  idSuffix?: string
): CreateNeedResult {

  if (!TRAINING_NEED_CATEGORIES.includes(category)) {
    return { need: null, code: "bad-category", message: "Category must be Function, Additional Function or Career Advancement." };
  }
  const cleanTitle = String(rawTitle || "").trim();
  if (!cleanTitle) return { need: null, code: "empty", message: "Enter the needed training." };
  if (cleanTitle.length > 300) return { need: null, code: "too-long", message: "Keep the needed training under 300 characters." };

  const key = trainingNeedKey(emp.id, category, cleanTitle);
  const isDuplicate = seen
    ? seen.has(key)
    : (db.trainingNeeds || []).some(n =>
        n.fiscalYear === fiscalYear && n.category === category &&
        employeeIdForms(n.employeeId).includes(emp.id) &&
        normalizeTitle(n.title) === normalizeTitle(cleanTitle));
  if (isDuplicate) {
    return { need: null, code: "duplicate", message: `"${cleanTitle}" is already listed for ${emp.fullName} under this column.` };
  }

  const need: TrainingNeed = {
    id: `need-${Date.now()}-${idSuffix ?? Math.floor(Math.random() * 100000)}`,
    employeeId: emp.id,
    fiscalYear,
    category,
    title: cleanTitle,
    createdAt: new Date().toISOString(),
    createdBy: username
  };
  if (!db.trainingNeeds) db.trainingNeeds = [];
  db.trainingNeeds.push(need);
  if (seen) seen.add(key);
  return { need, code: null, message: "" };
}

// A Plan A title as the audit lines quote it. It is stored as typed (only trimmed), so it is cleaned for
// the log, where a direction mark would turn the rest of the line around, and quoted as JSON, where a
// quote would pass for more of the line.
function auditNeedTitle(title: unknown): string {
  return JSON.stringify(cleanText(String(title ?? "").slice(0, 300)));
}

app.post("/api/training/needs", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const { employeeId, category, title } = req.body || {};
  const fiscalYear = req.body?.fiscalYear || activeFiscalYearLabel();

  const emp = (db.employees || []).find(e => e.id === employeeId || e.employeeId === employeeId);
  if (!emp) return res.status(404).json({ status: "error", message: "Employee not found." });

  const result = createTrainingNeed(emp, category, title, fiscalYear, req.user.username);
  if (!result.need) return res.status(400).json({ status: "error", message: result.message });

  const need = result.need;
  logEvent(req.user.id, req.user.username, req.user.role, "Add Training Need",
    `Added ${auditNeedTitle(need.title)} (${category}) for ${emp.fullName} in the ${fiscalYear} Training and Development Plan.`);
  saveDB();
  res.json({ status: "success", data: { ...need, status: needAccomplishment(need, manilaToday()) } });
});

app.put("/api/training/needs/:id", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const need = (db.trainingNeeds || []).find(n => n.id === req.params.id);
  if (!need) return res.status(404).json({ status: "error", message: "Training need not found." });

  const { title, category, remarks, accomplishedOverride } = req.body || {};
  // Who the TDP identifies follows these titles (12z), so a rename is logged with the old title too.
  const titleBefore = need.title;
  if (title !== undefined) {
    // As on create: text, at most 300 characters. Every TDP check matches titles (12z), so one far
    // longer would hold the server up each time.
    if (typeof title !== "string") return res.status(400).json({ status: "error", message: "Enter the needed training." });
    const cleanTitle = title.trim();
    if (!cleanTitle) return res.status(400).json({ status: "error", message: "Enter the needed training." });
    if (cleanTitle.length > 300) return res.status(400).json({ status: "error", message: "Keep the needed training under 300 characters." });
    need.title = cleanTitle;
  }
  if (category !== undefined) {
    if (!TRAINING_NEED_CATEGORIES.includes(category)) {
      return res.status(400).json({ status: "error", message: "Unknown column for this needed training." });
    }
    need.category = category;
  }
  if (remarks !== undefined) need.remarks = String(remarks).trim() || undefined;
  // null clears the override and hands the decision back to the evidence.
  if (accomplishedOverride !== undefined) {
    if (accomplishedOverride === null) delete need.accomplishedOverride;
    else if (typeof accomplishedOverride === "boolean") need.accomplishedOverride = accomplishedOverride;
    else return res.status(400).json({ status: "error", message: "accomplishedOverride must be true, false or null." });
  }

  const emp = (db.employees || []).find(e => e.id === need.employeeId || e.employeeId === need.employeeId);
  logEvent(req.user.id, req.user.username, req.user.role, "Update Training Need",
    `Updated ${titleBefore !== need.title ? `${auditNeedTitle(titleBefore)} to ` : ""}${auditNeedTitle(need.title)} (${need.category}) for ${emp ? emp.fullName : need.employeeId} in the ${need.fiscalYear} plan.`);
  saveDB();
  res.json({ status: "success", data: { ...need, status: needAccomplishment(need, manilaToday()) } });
});

app.delete("/api/training/needs/:id", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const index = (db.trainingNeeds || []).findIndex(n => n.id === req.params.id);
  if (index === -1) return res.status(404).json({ status: "error", message: "Training need not found." });

  const [removed] = db.trainingNeeds.splice(index, 1);
  const emp = (db.employees || []).find(e => e.id === removed.employeeId || e.employeeId === removed.employeeId);
  logEvent(req.user.id, req.user.username, req.user.role, "Remove Training Need",
    `Removed ${auditNeedTitle(removed.title)} (${removed.category}) for ${emp ? emp.fullName : removed.employeeId} from the ${removed.fiscalYear} plan.`);
  saveDB();
  res.json({ status: "success", message: "Training need removed." });
});

// --- Mandated trainings (HSAC RAB 1's step 5, "Prioritization – statutory/legal mandates"; 12z Part D) ---
// HR or the Administrator marks a training title as mandated, with the law or rule behind it, for every
// year. Its unmet needs then come first in Plan D, in planning and in the participant picker. Nothing is
// presumed: the list starts empty. Each change is in the audit log ("Mandated Training").
function trainingMandateIndex() {
  return mandateIndex(db.trainingMandates || []);
}

app.get("/api/training/mandates", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const data = (db.trainingMandates || []).filter(isMandate).sort((a, b) => a.basis.localeCompare(b.basis) || a.title.localeCompare(b.title));
  res.json({ status: "success", data });
});

app.post("/api/training/mandates", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  // A title from a plan (any year's: a mark applies to every year), matched as the plan matches it.
  const chosen = readMandateTitle(req.body?.title);
  if ("problem" in chosen) return res.status(400).json({ status: "error", message: chosen.problem });
  const { title, key } = chosen;
  if (!(db.trainingNeeds || []).some(n => normalizeTitle(n.title) === key)) {
    return res.status(400).json({ status: "error", message: "No year's plan lists that training. Choose it from the plan." });
  }
  const basis = readMandateBasis(req.body?.basis);
  if ("problem" in basis) return res.status(400).json({ status: "error", message: basis.problem });
  const existing = (db.trainingMandates || []).filter(isMandate).find(m => m.key === key);
  if (existing) return res.status(409).json({ status: "error", message: `"${existing.title}" is already marked as mandated (${existing.basis}).` });
  const user = req.user;
  const mandate: TrainingMandate = {
    id: `mandate-${crypto.randomUUID()}`,
    title, key, basis: basis.value,
    markedBy: { id: user.id, name: user.fullName, role: user.role },
    markedAt: new Date().toISOString()
  };
  if (!db.trainingMandates) db.trainingMandates = [];
  db.trainingMandates.push(mandate);
  logEvent(user.id, user.username, user.role, "Mandated Training",
    `${user.fullName} marked ${JSON.stringify(title)} as mandated: ${JSON.stringify(basis.value)}.`);
  saveDB();
  res.json({ status: "success", data: mandate });
});

app.put("/api/training/mandates/:id", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const mandate = (db.trainingMandates || []).filter(isMandate).find(m => m.id === req.params.id);
  if (!mandate) return res.status(404).json({ status: "error", message: "That mandated training is no longer marked." });
  const basis = readMandateBasis(req.body?.basis);
  if ("problem" in basis) return res.status(400).json({ status: "error", message: basis.problem });
  if (basis.value === mandate.basis) return res.json({ status: "success", message: "Nothing changed.", data: mandate });
  const before = mandate.basis;
  mandate.basis = basis.value;
  logEvent(req.user.id, req.user.username, req.user.role, "Mandated Training",
    `${req.user.fullName} changed why ${JSON.stringify(mandate.title)} is mandated, from ${JSON.stringify(before)} to ${JSON.stringify(basis.value)}.`);
  saveDB();
  res.json({ status: "success", data: mandate });
});

app.delete("/api/training/mandates/:id", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const index = (db.trainingMandates || []).findIndex(m => isMandate(m) && m.id === req.params.id);
  if (index === -1) return res.status(404).json({ status: "error", message: "That mandated training is no longer marked." });
  const [removed] = db.trainingMandates.splice(index, 1);
  logEvent(req.user.id, req.user.username, req.user.role, "Mandated Training",
    `${req.user.fullName} unmarked ${JSON.stringify(removed.title)} (${JSON.stringify(removed.basis)}): its needs are no longer listed first.`);
  saveDB();
  res.json({ status: "success", message: "Unmarked." });
});

// One transaction: a refusal after the participants are enrolled (a division left with nobody at the
// office) undoes the seminar and its enrolments together.
app.post("/api/training/programs", authenticateToken, transactional((req: any, res: any) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }
  res.set("Cache-Control", "no-store");   // the reply carries the seminar's justification (12z Part C)
  const body = req.body;
  const allocation = readAllocation(body.allocatedBudget);
  if (allocation === null) return res.status(400).json({ status: "error", message: ALLOCATION_MESSAGE });
  const seats = readSeats(body.maxParticipants);
  if (seats === null) return res.status(400).json({ status: "error", message: SEATS_MESSAGE });
  const datesProblem = seminarDatesProblem(body.startDate, body.endDate);
  if (datesProblem) return res.status(400).json({ status: "error", message: datesProblem });
  const timeProblem = seminarTimeProblem(body.startDate, body.startTime, body.endDate, body.endTime);
  if (timeProblem) return res.status(400).json({ status: "error", message: timeProblem });
  const textProblem = seminarTextProblem(body.title, body.description, body.category);
  if (textProblem) return res.status(400).json({ status: "error", message: textProblem });
  const tdpSent = readTdpExceptions(body.tdpExceptions);
  if ("problem" in tdpSent) return res.status(400).json({ status: "error", message: tdpSent.problem });
  const seminarSent = body.seminarTdpException == null ? null : readSeminarTdpJustification(body.seminarTdpException, manilaToday());
  if (seminarSent && "problem" in seminarSent) return res.status(400).json({ status: "error", message: seminarSent.problem });
  // Seminars are planned in the active fiscal year, as the planner does: a closed year's
  // unallocated money was carried over, and a label with no fiscal year is outside every budget.
  const fy = (db.fiscalYears || []).find((f: any) => f.label === body.fiscalYear);
  if (!fy || fy.status !== "Active") {
    const active = (db.fiscalYears || []).find((f: any) => f.status === "Active");
    return res.status(400).json({
      status: "error",
      message: active ? `Seminars are added to the active fiscal year, FY ${active.label}.` : "There is no active fiscal year to add the seminar to."
    });
  }

  // The client warns about over-allocation too, but that alert is bypassable —
  // the fiscal year's training ceiling is enforced here so the Budget Officer's
  // monitor can be trusted.
  const overBy = trainingAllocationProblem(body.fiscalYear, allocation);
  if (overBy) {
    return res.status(400).json({ status: "error", message: `${overBy} Please adjust the allocation.` });
  }

  // Calculate duration
  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive

  const totalHours = computeTrainingHours(body.startDate, body.endDate, body.startTime, body.endTime);

  const newProgramId = `tp-${Date.now()}`;
  const newProgram: TrainingProgram = {
    id: newProgramId,
    // A brand-new seminar starts its own series; rollover copies inherit it.
    seriesId: newProgramId,
    title: cleanText(body.title),
    description: body.description,
    category: body.category,
    allocatedBudget: allocation,
    usedBudget: 0,
    fiscalYear: body.fiscalYear,
    startDate: body.startDate,
    endDate: body.endDate,
    startTime: body.startTime,
    endTime: body.endTime,
    durationDays: diffDays,
    totalHours: totalHours,
    venue: body.venue,
    facilitator: body.facilitator,
    maxParticipants: seats ?? 1,
    targetSpecialization: body.targetSpecialization,
    targetDivision: body.targetDivision,
    budgetSplit: normalizeBudgetSplit(body.budgetSplit),
    // Which Plan A entries this seminar answers, ticked by HR from the plan.
    fulfillsNeedTitles: normalizeFulfillsNeedTitles(body.fulfillsNeedTitles),
    createdAt: new Date().toISOString(),
  };

  // A seminar the TDP doesn't cover (no need in its year's Plan A) is held only with its own
  // justification (12z Part C), which then covers everyone seated on it. Asked first.
  const inTdp = seminarInTdp(newProgram);
  if (seminarNeedsJustification({ isNew: true, inTdpBefore: false, inTdpAfter: inTdp, justified: !!seminarSent })) {
    refuseNotInTdp(res, newProgram);
    return;
  }
  const seminarCovers = !inTdp && !!seminarSent;

  db.trainingPrograms.push(newProgram);

  let skippedMessages: string[] = [];
  let created: TrainingParticipant[] = [];
  // Manual assignment from UI
  if (Array.isArray(body.participantIds)) {
    ({ created, skipped: skippedMessages } = enrollTrainingParticipants(newProgram, body.participantIds, (req as any).user, 0));
  }

  // Both judged on who was actually enrolled, and a refusal undoes the whole save (one transaction):
  // anyone the TDP doesn't identify needs a justification (HSAC RAB 1, 2026-10-28), unless the
  // seminar's own covers them, then someone must stay to man each division.
  const tdpPlan = tdpSeatsPlan(newProgram, created, new Map(), tdpSent.map, new Set(), seminarCovers);
  if (refuseOutsideTdp(res, newProgram, tdpPlan.missing)) return;
  const gaps = addedDivisionGaps(newProgram.id, null, { startDate: newProgram.startDate, endDate: newProgram.endDate, ids: seminarAwayIds(newProgram.id) });
  if (refuseDivisionGap(req, res, gaps)) return;
  if (seminarCovers && seminarSent && "value" in seminarSent) {
    recordSeminarTdpException((req as any).user, newProgram, seminarSent.value);
    // (The seminar's notice just went to the Administrator; the audit entry names who is on it.)
    coverSeatsBySeminar((req as any).user, newProgram, tdpPlan.toCover, false);
  }
  for (const r of tdpPlan.toRecord) recordTdpException((req as any).user, r.participant, newProgram, r.justification, r.newSeat);
  logDivisionOverride(req, gaps, `added "${String(newProgram.title || "").trim()}" (FY ${newProgram.fiscalYear})`);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Create Training Program",
    `${(req as any).user.fullName} added ${JSON.stringify(newProgram.title)} (FY ${newProgram.fiscalYear}), covering ${seminarNeedsText(newProgram.fulfillsNeedTitles)}.`);

  saveDB();
  res.json({ status: "success", data: newProgram, message: skippedMessages.length > 0 ? skippedMessages.join(" ") : undefined });
}));



// One transaction: the seminar, its allowances and its roster change together or not at all (an
// edit refused part-way used to leave the earlier changes in memory for the next save).
app.put("/api/training/programs/:id", authenticateToken, transactional((req: any, res: any) => {
  if (req.user.role !== UserRole.SUPER_ADMIN && req.user.role !== UserRole.HR_OFFICER && req.user.role !== "Super Admin" && req.user.role !== "HR Officer") {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }
  res.set("Cache-Control", "no-store");   // the reply carries the seminar's justification (12z Part C)
  const programIndex = (db.trainingPrograms || []).findIndex((p) => p.id === req.params.id);
  if (programIndex === -1) {
    return res.status(404).json({ status: "error", message: "Program not found" });
  }

  const body = req.body;
  const existingProgram = db.trainingPrograms[programIndex];
  if (existingProgram.archivedAt) {
    return res.status(409).json({ status: "error", message: `"${existingProgram.title}" is archived. Restore it before editing it.` });
  }
  // Who it took from the office, and when, before this edit: the division check counts only what the
  // edit adds.
  const coverageBefore = { startDate: existingProgram.startDate, endDate: existingProgram.endDate, ids: seminarAwayIds(existingProgram.id) };
  // Likewise who the TDP identified on it, before its needs may change (12z).
  const tdpBefore = tdpRosterBefore(existingProgram);
  const inTdpBefore = seminarInTdp(existingProgram);
  const allocation = body.allocatedBudget !== undefined ? readAllocation(body.allocatedBudget) : Number(existingProgram.allocatedBudget || 0);
  if (allocation === null) return res.status(400).json({ status: "error", message: ALLOCATION_MESSAGE });
  const newSeats = readSeats(body.maxParticipants);
  if (newSeats === null) return res.status(400).json({ status: "error", message: SEATS_MESSAGE });
  // The dates as they will be saved: a date not sent keeps the stored one (it used to be blanked).
  const startDate = body.startDate ?? existingProgram.startDate;
  const endDate = body.endDate ?? existingProgram.endDate;
  const datesProblem = seminarDatesProblem(startDate, endDate);
  if (datesProblem) return res.status(400).json({ status: "error", message: datesProblem });
  // Title, description and category as they will be saved: a value not sent keeps the stored one
  // (they used to be blanked, as the dates were).
  const title = body.title ?? existingProgram.title;
  const description = body.description ?? existingProgram.description;
  const category = body.category ?? existingProgram.category;
  const textProblem = seminarTextProblem(title, description, category);
  if (textProblem) return res.status(400).json({ status: "error", message: textProblem });
  const tdpSent = readTdpExceptions(body.tdpExceptions);
  if ("problem" in tdpSent) return res.status(400).json({ status: "error", message: tdpSent.problem });
  const seminarSent = body.seminarTdpException == null ? null : readSeminarTdpJustification(body.seminarTdpException, manilaToday());
  if (seminarSent && "problem" in seminarSent) return res.status(400).json({ status: "error", message: seminarSent.problem });
  // The times as they will be saved (a value not sent keeps the stored one). A seminar saved before
  // the office-hours rule with times outside it has to be corrected on its next edit.
  const timeProblem = seminarTimeProblem(
    startDate,
    body.startTime !== undefined ? body.startTime : existingProgram.startTime,
    endDate,
    body.endTime !== undefined ? body.endTime : existingProgram.endTime
  );
  if (timeProblem) return res.status(400).json({ status: "error", message: timeProblem });

  // Same ceiling as on create, checked against the year the seminar is in (an edit never
  // moves a seminar to another year). Enrolling someone new reopens a closed seminar, and
  // a new number of seats re-prices what a non-attendee's share releases, so both are
  // checked too, even when the allocation itself is unchanged.
  const enrolledForms = new Set((db.trainingParticipants || [])
    .filter(p => p.trainingProgramId === existingProgram.id && p.status !== "Cancelled" && p.status !== "Archived")
    .flatMap(p => employeeIdForms(p.employeeId)));
  const addsParticipants = Array.isArray(body.participantIds)
    && body.participantIds.some((raw: string) => !employeeIdForms(raw).some(f => enrolledForms.has(f)));
  const seatsChange = newSeats !== undefined && newSeats !== Number(existingProgram.maxParticipants || 1);
  // Enrolments with a cash advance on file (money Finance released for this seminar, held in
  // its budget until liquidated or refunded), a request for one still waiting, or a training
  // evaluation are history: a roster edit keeps them, as it keeps those with attendance or a
  // liquidation under way. (A declined request doesn't keep one.) A group advance keeps everyone
  // it covers.
  const withAdvance = new Set((db.cashAdvances || []).filter((a: any) => a && a.status !== "Declined").flatMap((a: any) => coveredEnrolmentIds(a)));
  const evaluated = new Set((db.trainingEvaluations || []).filter((e: any) => e && e.trainingParticipantId).map((e: any) => e.trainingParticipantId));
  const requested = Array.isArray(body.participantIds) ? new Set<string>(body.participantIds.map((raw: string) => employeeIdForms(raw)[0])) : null;
  // Seats can't go below the participants the seminar keeps after this save (not counting
  // anyone marked "Did not attend"): each one's allowance is allocation ÷ seats, so together
  // they would need more than the allocation. That is a mistake more often than not.
  if (seatsChange) {
    const staying = (db.trainingParticipants || []).filter(p => p.trainingProgramId === existingProgram.id
      && p.status !== "Cancelled" && p.status !== "Archived" && p.attendance !== "Did not attend"
      && (!requested || employeeIdForms(p.employeeId).some(f => requested.has(f))
        || p.status !== "Assigned" || !!p.attendance || withAdvance.has(p.id) || evaluated.has(p.id) || !!p.replaces)).length;
    if (newSeats! < staying) {
      return res.status(400).json({
        status: "error",
        message: `This seminar keeps ${staying} participant${staying === 1 ? "" : "s"} (not counting anyone marked "Did not attend"), so it needs at least ${staying} seat${staying === 1 ? "" : "s"}.`
      });
    }
  }
  if (body.allocatedBudget !== undefined || addsParticipants || seatsChange) {
    const overBy = trainingAllocationProblem(existingProgram.fiscalYear, allocation, existingProgram.id, addsParticipants, newSeats);
    if (overBy) {
      const reopens = addsParticipants && isSeminarSettled(existingProgram, participantsForBudget())
        ? "Adding a participant reopens this finished seminar, so its allocation counts again. "
        : "";
      return res.status(400).json({
        status: "error",
        message: `${reopens}${overBy} Please adjust the allocation${seatsChange ? " or the number of seats" : ""}.`
      });
    }
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const startTime = body.startTime !== undefined ? body.startTime : existingProgram.startTime;
  const endTime = body.endTime !== undefined ? body.endTime : existingProgram.endTime;
  const totalHours = computeTrainingHours(startDate, endDate, startTime, endTime);

  db.trainingPrograms[programIndex] = {
    ...existingProgram,
    // Backfill for programs saved before series tracking existed.
    seriesId: existingProgram.seriesId || existingProgram.id,
    title: cleanText(title),
    description,
    category,
    allocatedBudget: body.allocatedBudget !== undefined ? allocation : existingProgram.allocatedBudget,
    startDate,
    endDate,
    startTime: body.startTime !== undefined ? body.startTime : existingProgram.startTime,
    endTime: body.endTime !== undefined ? body.endTime : existingProgram.endTime,
    durationDays: diffDays,
    totalHours: totalHours,
    venue: body.venue !== undefined ? body.venue : existingProgram.venue,
    facilitator: body.facilitator !== undefined ? body.facilitator : existingProgram.facilitator,
    maxParticipants: newSeats ?? existingProgram.maxParticipants,
    targetDivision: body.targetDivision !== undefined ? body.targetDivision : existingProgram.targetDivision,
    targetSpecialization: body.targetSpecialization !== undefined ? body.targetSpecialization : existingProgram.targetSpecialization,
    budgetSplit: body.budgetSplit !== undefined ? normalizeBudgetSplit(body.budgetSplit) : normalizeBudgetSplit(existingProgram.budgetSplit),
    fulfillsNeedTitles: body.fulfillsNeedTitles !== undefined
      ? normalizeFulfillsNeedTitles(body.fulfillsNeedTitles)
      : existingProgram.fulfillsNeedTitles
  };

  // A seminar this edit takes outside the TDP is held only with its own justification (12z Part C),
  // which then covers everyone on it; an older seminar already outside it isn't refused for a re-save.
  // A justification is for the training it names: renamed, a seminar held with one is asked again (the
  // screen fills it in from before), so it can't carry over to a different training.
  const edited = db.trainingPrograms[programIndex];
  const renamed = normalizeTitle(existingProgram.title) !== normalizeTitle(edited.title);
  const inTdpAfter = seminarInTdp(edited);
  const seminarJustified = (!!edited.tdpException && !renamed) || !!seminarSent;
  if (seminarNeedsJustification({ isNew: false, inTdpBefore, inTdpAfter, justified: seminarJustified, renamedFromJustified: renamed && !!edited.tdpException })) {
    refuseNotInTdp(res, edited);
    return;
  }
  const seminarCovers = !inTdpAfter && seminarJustified;

  // Budget or head-count edits re-price the allowances nobody has liquidated yet, whether or
  // not the roster was sent: an allowance caps the cash advance Finance can release.
  for (const p of db.trainingParticipants || []) {
    if (p.trainingProgramId === existingProgram.id && p.status === "Assigned") p.allowanceAllocated = participantAllowance(db.trainingPrograms[programIndex]);
  }

  let skippedMessages: string[] = [];
  let created: TrainingParticipant[] = [];
  const keptForHistory = new Set<string>();
  // If participantIds are provided, reconcile the roster against them. Existing
  // enrolments are kept rather than deleted and re-created, so participant ids,
  // statuses and liquidation links survive an edit.
  if (requested) {
    const program = db.trainingPrograms[programIndex];
    const removedIds = new Set<string>();
    const keptForms = new Set<string>();
    let keptCount = 0;
    for (const p of (db.trainingParticipants || []).filter(p => p.trainingProgramId === program.id)) {
      if (p.status === "Cancelled") continue;
      const forms = employeeIdForms(p.employeeId);
      const stillSelected = forms.some(f => requested.has(f));
      // An enrolment with attendance on record is history, so editing the roster keeps it. So is a
      // representative's (12z Part B): deleting it would leave the one they replaced pointing nowhere.
      if (!stillSelected && p.status === "Assigned" && !p.attendance && !withAdvance.has(p.id) && !evaluated.has(p.id) && !p.replaces) {
        removedIds.add(p.id);
        continue;
      }
      if (!stillSelected) {
        keptForHistory.add(p.id);
        const emp = (db.employees || []).find(e => forms.includes(e.id));
        const name = emp ? emp.fullName : p.employeeId;
        skippedMessages.push(p.status !== "Assigned"
          ? `${name} was kept: their liquidation is already ${p.status === "Liquidated" ? "complete" : "in progress"}.`
          : p.attendance
            ? `${name} was kept: their attendance is already recorded.`
            : withAdvance.has(p.id)
              ? `${name} was kept: ${pendingRequestCovering(p.id) ? "a cash advance for them is waiting for Finance" : "Finance has released a cash advance for them for this seminar"}.`
              : evaluated.has(p.id)
                ? `${name} was kept: their training evaluation is on record.`
                : `${name} was kept: they were sent in someone's place. To change who goes, send a representative from the attendance list.`);
      }
      forms.forEach(f => keptForms.add(f));
      keptCount++;
    }
    db.trainingParticipants = (db.trainingParticipants || []).filter(p => !removedIds.has(p.id));

    const toAdd = [...requested].filter(id => !employeeIdForms(id).some(f => keptForms.has(f)));
    const enrolled = enrollTrainingParticipants(program, toAdd, (req as any).user, keptCount);
    created = enrolled.created;
    skippedMessages.push(...enrolled.skipped);
  }

  // What this edit adds, by its roster, needs or days; a refusal undoes the whole edit (the route is
  // one transaction): anyone it seats outside the TDP, or turns outside, needs a justification (HSAC
  // RAB 1, 2026-10-28), then someone must stay to man each division.
  const saved = db.trainingPrograms[programIndex];
  const tdpPlan = tdpSeatsPlan(saved, created, tdpBefore, tdpSent.map, keptForHistory, seminarCovers);
  if (refuseOutsideTdp(res, saved, tdpPlan.missing)) return;
  const gaps = addedDivisionGaps(saved.id, coverageBefore, { startDate: saved.startDate, endDate: saved.endDate, ids: seminarAwayIds(saved.id) });
  if (refuseDivisionGap(req, res, gaps)) return;
  if (seminarCovers) {
    const recorded = seminarSent && "value" in seminarSent
      ? recordSeminarTdpException((req as any).user, saved, seminarSent.value,
        renamed && existingProgram.tdpException ? String(existingProgram.title || "").trim() : undefined)
      : false;
    // Seats added under a justification already on record: the Administrator is told who.
    coverSeatsBySeminar((req as any).user, saved, tdpPlan.toCover, !recorded);
  }
  for (const r of tdpPlan.toRecord) recordTdpException((req as any).user, r.participant, saved, r.justification, r.newSeat);
  logDivisionOverride(req, gaps, `saved "${String(saved.title || "").trim()}" (FY ${saved.fiscalYear})`);
  if (seminarNeedsKey(existingProgram.fulfillsNeedTitles) !== seminarNeedsKey(saved.fulfillsNeedTitles)) {
    logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Change Seminar Needs",
      `${(req as any).user.fullName} changed the Plan A needs ${JSON.stringify(saved.title)} (FY ${saved.fiscalYear}) covers, `
      + `from ${seminarNeedsText(existingProgram.fulfillsNeedTitles)} to ${seminarNeedsText(saved.fulfillsNeedTitles)}.`);
  }
  // Its title decides who the TDP identifies on it, and what its justification is for (12z).
  if (renamed) {
    logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Rename Training Program",
      `${(req as any).user.fullName} renamed ${JSON.stringify(String(existingProgram.title || "").trim())} to ${JSON.stringify(saved.title)} (FY ${saved.fiscalYear}).`);
  }

  saveDB();
  res.json({ status: "success", data: db.trainingPrograms[programIndex], message: skippedMessages.length > 0 ? skippedMessages.join(" ") : undefined });
}));

// Why a seminar outside the TDP is held, recorded (or corrected) by HR or the Administrator without a
// full save (12z Part C): for one from before the rule, or one that lost its need since. As at saving,
// it covers everyone on the seminar who has no justification of their own.
app.put("/api/training/programs/:id/tdp-exception", authenticateToken, transactional((req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Only HR and the Administrator record why a seminar is held." });
  }
  res.set("Cache-Control", "no-store");
  const prog = (db.trainingPrograms || []).find(p => p.id === req.params.id);
  if (!prog) return res.status(404).json({ status: "error", message: "Program not found" });
  if (prog.archivedAt) {
    return res.status(409).json({ status: "error", message: `"${String(prog.title || "").trim()}" is archived. Restore it first.` });
  }
  if (seminarInTdp(prog)) {
    return res.status(409).json({ status: "error", message: `It covers a need in FY ${prog.fiscalYear}'s Plan A, so it is in the TDP and needs no justification.` });
  }
  const read = readSeminarTdpJustification(req.body, manilaToday());
  if ("problem" in read) return res.status(400).json({ status: "error", message: read.problem });
  const recorded = recordSeminarTdpException((req as any).user, prog, read.value);
  // Anyone on it with no justification of their own (seated before the rule, or the plan changed since).
  const covered = coverSeatsBySeminar((req as any).user, prog, tdpSeatsPlan(prog, [], new Map(), new Map(), new Set(), true).toCover, !recorded);
  saveDB();
  res.json({ status: "success", message: recorded || covered ? undefined : "Nothing changed.", data: { ...prog, tdp: "justified" } });
}));

// A saved seminar is archived, never deleted (the user, 2026-10-23: "the only ones that can be
// deleted is the ones that has not been saved yet"). A row that was never saved exists only on
// HR's screen, where it is discarded.
app.delete("/api/training/programs/:id", authenticateToken, (req: any, res: any) => {
  if (req.user.role !== UserRole.SUPER_ADMIN && req.user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Only HR or the Administrator can delete a seminar." });
  }
  const prog = (db.trainingPrograms || []).find((p: any) => p.id === req.params.id);
  if (!prog) return res.status(404).json({ status: "error", message: "Seminar not found." });
  return res.status(409).json({
    status: "error",
    message: `Saved seminars are archived, not deleted: archive "${String(prog.title || "").trim()}" instead. Only a new row that hasn't been saved can be discarded.`
  });
});

// What has happened to a seminar that has to stay on record, or "" when nothing has (what
// deleting one used to check, 12b).
function seminarHistory(prog: TrainingProgram): string {
  const enrolments = (db.trainingParticipants || []).filter((p: any) => p.trainingProgramId === prog.id);
  const ids = new Set(enrolments.map((p: any) => p.id));
  return enrolments.some((p: any) => p.attendance) ? "attendance has been recorded for it"
    : Number(prog.usedBudget || 0) > 0 ? `${pesoText(Number(prog.usedBudget))} has been spent on it`
    : (db.liquidationSubmissions || []).some((s: any) => ids.has(s.activityId)) ? "a liquidation report has been filed for it"
    : (db.cashAdvances || []).some((a: any) => a && coveredEnrolmentIds(a).some(id => ids.has(id)) && a.status !== "Requested" && a.status !== "Declined") ? "Finance has released a cash advance for it"
    : (db.cashAdvances || []).some((a: any) => a && coveredEnrolmentIds(a).some(id => ids.has(id)) && a.status === "Requested") ? "a cash advance request for it is waiting for Finance"
    : (db.trainingEvaluations || []).some((e: any) => e && (e.trainingProgramId === prog.id || ids.has(e.trainingParticipantId))) ? "a training evaluation has been recorded for it"
    : (db.trainingLiquidations || []).some((l: any) => l.trainingProgramId === prog.id) ? "expenses have been recorded for it"
    : "";
}

// Archiving a seminar (Programs & Budget → Archived Seminars). Nothing is erased. Two kinds:
// - Nothing has happened to it yet (what deleting used to allow): its participants are taken
//   off it (archived with it), and its whole allocation returns to Unallocated; the year's
//   figures leave it out, as a deleted seminar.
// - Finished (everyone who attended is liquidated, or nobody came: attendance shows nobody, or
//   nobody is enrolled though something was spent, as on a called-off seminar) with no cash
//   advance out and no request waiting: every record stays as it is, and it counts only what it
//   spent, as a closed seminar already does.
// Anything in between is refused, so no work in progress is hidden. So is a closed year, whose
// seminars stay as they were when its unallocated money was carried over.
app.post("/api/training/programs/:id/archive", authenticateToken, transactional((req: any, res: any) => {
  if (req.user.role !== UserRole.SUPER_ADMIN && req.user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Only HR or the Administrator can archive a seminar." });
  }
  res.set("Cache-Control", "no-store");   // the reply carries the seminar's justification (12z Part C)
  const prog: TrainingProgram | undefined = (db.trainingPrograms || []).find((p: any) => p.id === req.params.id);
  if (!prog) return res.status(404).json({ status: "error", message: "Seminar not found." });
  const title = String(prog.title || "").trim();
  if (prog.archivedAt) return res.status(409).json({ status: "error", message: `"${title}" is already archived.` });
  const fy = (db.fiscalYears || []).find((f: any) => f.label === prog.fiscalYear);
  // (Restore needs the year to be active, so a seminar with no year could never come back.)
  if (!fy) return res.status(409).json({ status: "error", message: `"${title}" can't be archived: there is no fiscal year ${prog.fiscalYear}.` });
  if (fy.status !== "Active") {
    return res.status(409).json({ status: "error", message: `"${title}" can't be archived: FY ${fy.label} is closed, and its seminars stay as they were when its unallocated money was carried over.` });
  }

  const history = seminarHistory(prog);
  if (history) {
    const ids = new Set((db.trainingParticipants || []).filter((p: any) => p.trainingProgramId === prog.id).map((p: any) => p.id));
    const forSeminar = (a: any) => !!a && coveredEnrolmentIds(a).some(id => ids.has(id));
    if ((db.cashAdvances || []).some((a: any) => forSeminar(a) && a.status === "Requested")) {
      return res.status(409).json({ status: "error", message: `"${title}" can't be archived yet: a cash advance request for it is waiting for Finance to release or decline it.` });
    }
    // The advance records themselves: the budget nets an advance against HR's hand entries for
    // that person, so an advance still "Released" can show as nothing out.
    const openAdvance = (db.cashAdvances || []).find((a: any) => forSeminar(a) && a.status === "Released");
    if (openAdvance) {
      return res.status(409).json({ status: "error", message: `"${title}" can't be archived yet: cash advance ${openAdvance.advanceNo} (DV ${openAdvance.dvNo}) is still out for it. Finance has to record its liquidation or refund first.` });
    }
    const budget = seminarBudget(prog, participantsForBudget());
    if (budget.outstanding > 0) {
      return res.status(409).json({ status: "error", message: `"${title}" can't be archived yet: ${pesoText(budget.outstanding)} in cash advances is still out for it. Finance has to record its liquidation or refund first.` });
    }
    // "planning" with history: nobody is enrolled, but something was spent (a called-off seminar).
    if (budget.stage === "open") {
      return res.status(409).json({ status: "error", message: `"${title}" can't be archived yet: it isn't finished. Archive it once everyone who attended has been liquidated, or attendance shows nobody came.` });
    }
  }

  const now = new Date().toISOString();
  let takenOff = 0;
  if (!history) {
    for (const p of db.trainingParticipants || []) {
      if (p.trainingProgramId !== prog.id || p.status === "Cancelled" || p.status === "Archived") continue;
      p.status = "Archived";
      p.archivedWithSeminarAt = now;
      takenOff++;
    }
  }
  prog.archivedAt = now;
  prog.archivedBy = req.user.fullName || req.user.username;
  if (!history) prog.archivedBeforeUse = true;
  const allocation = pesoText(Number(prog.allocatedBudget || 0));
  const details = history
    ? `Archived "${title}" (FY ${prog.fiscalYear}), finished: ${pesoText(Number(prog.usedBudget || 0))} spent; no figure changes.`
    : `Archived "${title}" (FY ${prog.fiscalYear}) before it was used: ${allocation} back to Unallocated${takenOff ? `, ${takenOff} participant${takenOff === 1 ? "" : "s"} taken off it` : ""}.`;
  logEvent(req.user.id, req.user.username, req.user.role, "Archive Training Program", details);
  saveDB();
  res.json({ status: "success", data: prog, message: details });
}));

// Restoring an archived seminar puts it back on Programs & Budget in the active fiscal year. One
// archived before use holds its allocation again, with the participants archived with it, so
// that needs room in Unallocated; a finished one counts only what it spent, as before.
app.post("/api/training/programs/:id/restore", authenticateToken, transactional((req: any, res: any) => {
  if (req.user.role !== UserRole.SUPER_ADMIN && req.user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Only HR or the Administrator can restore a seminar." });
  }
  res.set("Cache-Control", "no-store");   // the reply carries the seminar's justification (12z Part C)
  const prog: TrainingProgram | undefined = (db.trainingPrograms || []).find((p: any) => p.id === req.params.id);
  if (!prog) return res.status(404).json({ status: "error", message: "Seminar not found." });
  const title = String(prog.title || "").trim();
  if (!prog.archivedAt) return res.status(409).json({ status: "error", message: `"${title}" isn't archived.` });
  const fy = (db.fiscalYears || []).find((f: any) => f.label === prog.fiscalYear);
  if (!fy || fy.status !== "Active") {
    return res.status(409).json({ status: "error", message: `"${title}" can't be restored: FY ${prog.fiscalYear} is closed.` });
  }

  // The participants archived with it come back, unless they now can't take it: archived, they
  // no longer blocked a seminar with the same title, so they may be on one now (or have attended
  // it), or they may no longer be active. Those are left off (their enrolment is cancelled, and
  // kept on record) and named in the reply.
  const archivedWith = (db.trainingParticipants || []).filter((p: any) =>
    p.trainingProgramId === prog.id && p.status === "Archived" && p.archivedWithSeminarAt);
  const leftOff: string[] = [];
  const back = archivedWith.filter((p: any) => {
    const emp = (db.employees || []).find((e: any) => employeeIdForms(p.employeeId).includes(e.id));
    const reason = !emp ? "no staff record"
      : emp.isActive === false ? "no longer active"
      : trainingEnrollmentBlock(p.employeeId, prog)?.reason;
    if (reason) leftOff.push(`${emp?.fullName || p.employeeId} (${reason})`);
    return !reason;
  });
  const backIds = new Set(back.map((p: any) => p.id));
  const enrolments = participantsForBudget();
  // What the year's seminars take now (one archived before use takes nothing; a finished one
  // its spending), and what this one takes once restored with its participants.
  const before = prog.archivedBeforeUse ? 0 : seminarBudget(prog, enrolments).committed;
  const after = seminarBudget({ ...prog, archivedAt: undefined },
    enrolments.map((p: any) => backIds.has(p.id) ? { ...p, status: "Assigned" } : p)).committed;
  const increase = round2(Math.max(0, after - before));
  if (increase > 0) {
    const usage = computeTrainingUsage(fy.id);
    if (round2(usage.committed + increase) > round2(usage.totalBudget)) {
      return res.status(409).json({
        status: "error",
        message: `Restoring "${title}" holds ${pesoText(increase)} again, but only ${pesoText(Math.max(0, usage.remaining))} of the FY ${fy.label} training budget is Unallocated. Lower another seminar's allocation first.`
      });
    }
  }

  for (const p of archivedWith) {
    p.status = backIds.has(p.id) ? "Assigned" : "Cancelled";
    delete p.archivedWithSeminarAt;
  }
  delete prog.archivedAt;
  delete prog.archivedBy;
  delete prog.archivedBeforeUse;
  // Someone must stay to man each division (HSAC RAB 1): archived, it took nobody from the office; back,
  // its participants are away on its days again. A refusal undoes the restore (one transaction).
  const gaps = addedDivisionGaps(prog.id, null, { startDate: prog.startDate, endDate: prog.endDate, ids: seminarAwayIds(prog.id) });
  if (refuseDivisionGap(req, res, gaps)) return;
  logDivisionOverride(req, gaps, `restored "${title}" (FY ${prog.fiscalYear})`);
  const details = `Restored "${title}" (FY ${prog.fiscalYear})${increase > 0 ? `: it holds ${pesoText(increase)} again` : ""}`
    + `${back.length ? `, with ${back.length} participant${back.length === 1 ? "" : "s"} back on it` : ""}`
    + `${leftOff.length ? `; left off: ${leftOff.join("; ")}` : ""}.`;
  logEvent(req.user.id, req.user.username, req.user.role, "Restore Training Program", details);
  saveDB();
  res.json({ status: "success", data: prog, message: details });
}));

// POST /api/training/participants/:id/approve_liquidation was retired: it marked any
// enrolment Liquidated with no report and no attendance, and charged the allowance (not
// what was spent) to the seminar. Nothing called it. A seminar is settled only through a
// liquidation report that Finance validates.

app.get("/api/training/participants", authenticateToken, (req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Training program details are restricted to HR." });
  }
  // It carries why each exception is seated (12z): kept out of a shared PC's browser cache.
  res.set("Cache-Control", "no-store");
  // With each enrolment's cash advance still out (see participantsForBudget), so HR's planner
  // prices seminars exactly as the server does, and where it stands against the TDP (12z; this
  // route, like the justification itself, is HR's and the Administrator's only).
  const programs = new Map((db.trainingPrograms || []).map(p => [p.id, p]));
  const rows: TrainingParticipantRow[] = participantsForBudget().map(p => {
    const prog = programs.get(p.trainingProgramId);
    return { ...p, tdp: tdpStanding({ identified: !!prog && tdpIdentifies(p.employeeId, prog), tdpException: p.tdpException, underSeminar: p.tdpUnderSeminar, assignedAt: p.assignedAt }) };
  });
  res.json({ status: "success", data: rows });
});

// Why someone the TDP doesn't identify is on a seminar, recorded (or corrected) by HR or the
// Administrator without saving the seminar itself: for enrolments from before the rule, or seated
// before the plan changed (12z). Recorded as at seating: the audit entry and the Administrator's notice.
app.put("/api/training/participants/:id/tdp-exception", authenticateToken, transactional((req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Only HR and the Administrator record why someone is seated." });
  }
  const p = (db.trainingParticipants || []).find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ status: "error", message: "Enrolment not found." });
  if (p.status === "Cancelled" || p.status === "Archived") {
    return res.status(409).json({ status: "error", message: "This enrolment is no longer on the seminar." });
  }
  const prog = (db.trainingPrograms || []).find(x => x.id === p.trainingProgramId);
  if (!prog) return res.status(404).json({ status: "error", message: "Program not found" });
  if (prog.archivedAt) {
    return res.status(409).json({ status: "error", message: `"${String(prog.title || "").trim()}" is archived. Restore it first.` });
  }
  if (tdpIdentifies(p.employeeId, prog)) {
    return res.status(409).json({ status: "error", message: "The TDP identifies them for this seminar, so no justification is needed." });
  }
  // A representative's stays "In lieu of" the person they replaced (Part B): only its reason, who
  // identified them and its reference can be corrected.
  const inLieuOf = p.tdpException?.kind === "In lieu of" ? p.tdpException.inLieuOf : undefined;
  const read = readTdpJustification(req.body, manilaToday(), { inLieu: !!inLieuOf });
  if ("problem" in read) return res.status(400).json({ status: "error", message: read.problem });
  const recorded = recordTdpException((req as any).user, p, prog, inLieuOf ? { ...read.value, inLieuOf } : read.value, false);
  saveDB();
  res.set("Cache-Control", "no-store");
  res.json({ status: "success", message: recorded ? undefined : "Nothing changed.", data: { ...p, tdp: "justified" } });
}));

// Sending a representative in lieu of someone enrolled (HSAC RAB 1, 2026-10-28: "naka-leave si
// accountant, at may paid training by central office, need mag-identify ng representative in lieu of
// the accountant. Kasi sayang yung budget allotted"; 12z Part B). The original's enrolment is closed
// ("Cancelled", with `replacedBy`) and the representative gets a new one with the same allowance,
// linked back (`replaces`), and a justification "In lieu of" the original whether or not their own
// plan lists the training. A cash advance belongs to its enrolment, so the original's is settled first
// (src/representative.ts): their own request is closed, a group request covering them leaves them out,
// anything else waits for Finance. One transaction: a refusal undoes all of it.
app.post("/api/training/participants/:id/replace", authenticateToken, transactional((req: any, res: any) => {
  const user = (req as any).user;
  if (!isTrainingRecordsRole(user.role)) {
    return res.status(403).json({ status: "error", message: "Only HR and the Administrator send a representative." });
  }
  res.set("Cache-Control", "no-store");   // the reply carries the justification
  const original = (db.trainingParticipants || []).find(p => p.id === req.params.id);
  if (!original) return res.status(404).json({ status: "error", message: "Enrolment not found." });
  const prog = (db.trainingPrograms || []).find(p => p.id === original.trainingProgramId);
  if (!prog) return res.status(404).json({ status: "error", message: "Seminar not found." });
  const title = String(prog.title || "").trim();
  if (prog.archivedAt) return res.status(409).json({ status: "error", message: `"${title}" is archived. Restore it first.` });
  if (original.status === "Cancelled" || original.status === "Archived") {
    return res.status(409).json({ status: "error", message: "This enrolment is no longer on the seminar." });
  }
  const originalEmp = employeeByKey(original.employeeId);
  const originalName = originalEmp?.fullName || original.employeeId;
  if (original.attendance) {
    return res.status(409).json({ status: "error", message: `${originalName}'s attendance is already recorded (${original.attendance}), so a representative can't take their place now.` });
  }
  // A report needs attendance today, but older code liquidated enrolments without it: anything past
  // "Assigned", or covered by a report, has history, and stays.
  if (original.status !== "Assigned" || reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], original.id)) {
    return res.status(409).json({ status: "error", message: `${originalName}'s liquidation is already ${original.status === "Liquidated" ? "complete" : "under way"}, so a representative can't take their place.` });
  }
  // A representative goes in someone's place before or during the training, not after it.
  if (isIsoDate(prog.endDate) && String(prog.endDate).slice(0, 10) < manilaToday()) {
    return res.status(409).json({ status: "error", message: `"${title}" is over, so no representative can be sent: record ${originalName}'s attendance instead.` });
  }
  // HR's hand-entered expenses for them would stay on a closed enrolment, no longer netted against the
  // seat's cash (12z Part B review).
  if ((db.trainingLiquidations || []).some((r: any) => r && r.trainingParticipantId === original.id)) {
    return res.status(409).json({ status: "error", message: `HR has entered expenses for ${originalName} on this seminar, which stay with their enrolment, so a representative can't take their place.` });
  }
  const repEmp = typeof req.body?.employeeId === "string" ? employeeByKey(req.body.employeeId) : undefined;
  if (!repEmp) return res.status(400).json({ status: "error", message: "Choose the employee to send." });
  if (originalEmp && repEmp.id === originalEmp.id) return res.status(400).json({ status: "error", message: "Choose someone else to send in their place." });
  // Their staff record, or their login archived: the same test as for paying an advance.
  if (repEmp.isActive === false || !payeeIsActive(repEmp.id)) return res.status(409).json({ status: "error", message: `${repEmp.fullName} is no longer active.` });
  if (onSeminarRoster(prog.id, repEmp)) return res.status(409).json({ status: "error", message: `${repEmp.fullName} is already on this seminar.` });
  const read = readTdpJustification(req.body, manilaToday(), { inLieu: true });
  if ("problem" in read) return res.status(400).json({ status: "error", message: read.problem });

  // The original's cash advance first (the user's decision 4).
  const step = swapAdvanceStep(db.cashAdvances || [], original.id);
  if (step.action === "wait") {
    const a = (db.cashAdvances || []).find(x => x.id === step.advanceId)!;
    return res.status(409).json({
      status: "error",
      message: step.why === "ownAdvanceOut"
        ? seminarNotStarted(prog.id)
          ? `${originalName}'s cash advance ${a.advanceNo} (DV ${a.dvNo}) is out. Finance records its refund first (it can be handed back before the seminar starts), then send the representative.`
          : `${originalName}'s cash advance ${a.advanceNo} (DV ${a.dvNo}) is out, and the seminar has started, so it can't be handed back before it now. Record their attendance: if they didn't attend, Finance collects it back.`
        : step.why === "holdsGroupRequest"
          ? `${originalName} asked Finance for a cash advance that covers others too. Finance declines it first, then send the representative.`
          : a.activityId === original.id
            ? `${originalName} holds the group's cash advance ${a.advanceNo}, which the group's liquidation report or refund settles. A representative can't take their place before that.`
            : `${originalName} is covered by ${a.employeeName}'s group cash advance ${a.advanceNo}, which the group's liquidation report or refund settles. A representative can't take their place before that.`,
      data: { code: "ADVANCE_OPEN" }
    });
  }

  const takenBefore = seminarAwayIds(prog.id);
  // The original's seat is freed first, then the representative takes one (the usual checks: already
  // attended a seminar by this title, or a training HR recorded with it).
  original.status = "Cancelled";
  const enrolledCount = (db.trainingParticipants || []).filter(p => p.trainingProgramId === prog.id && p.status !== "Cancelled").length;
  const { created, skipped } = enrollTrainingParticipants(prog, [repEmp.id], user, enrolledCount);
  const rep = created[0];
  if (!rep) return res.status(409).json({ status: "error", message: skipped[0] || `${repEmp.fullName} could not be enrolled.` });
  const at = new Date().toISOString();
  rep.allowanceAllocated = original.allowanceAllocated;
  rep.replaces = original.id;
  const inLieuOf = { participantId: original.id, employeeId: originalEmp?.id ?? original.employeeId, fullName: originalName };
  rep.tdpException = { ...read.value, inLieuOf, recordedBy: { id: user.id, name: user.fullName, role: user.role }, recordedAt: at };
  original.replacedBy = { participantId: rep.id, employeeId: repEmp.id, fullName: repEmp.fullName, at, by: user.fullName };

  let advanceNote = "";
  if (step.action === "closeRequest") {
    const request = (db.cashAdvances || []).find(a => a.id === step.advanceId)!;
    declineAdvanceRequest(request, "A representative is going to the seminar in your place.", user.fullName);
    advanceNote = ` Their ${pesoText(request.amount)} cash advance request was closed, and they were told why.`;
  } else if (step.action === "leaveGroup") {
    const request = (db.cashAdvances || []).find(a => a.id === step.advanceId)!;
    removeFromGroupRequest(request, original.id);
    notifyEmployee(request.employeeId, {
      title: "A participant left your group's request",
      message: `${originalName} is no longer going to ${request.activityTitle || "the seminar"} (HR is sending a representative in their place), so your group cash advance request no longer covers them. It is now ${pesoText(request.amount)}${request.covers ? ` for ${request.covers.length} participants` : ", for you alone"}.`,
      type: "info",
      link: { tab: "employee_portal", record: { kind: "assignment", id: request.activityId } }
    });
    advanceNote = ` They were taken off ${request.employeeName}'s group cash advance request, now ${pesoText(request.amount)}${request.covers
      ? ` for ${namesText(request.covers.map(c => c.employeeName))}` : ` for ${request.employeeName} alone`}, and ${request.employeeName} was told.`;
  }

  // Someone must stay to man each division (12x): the swap may take the last one of the representative's.
  const gaps = addedDivisionGaps(prog.id, { startDate: prog.startDate, endDate: prog.endDate, ids: takenBefore },
    { startDate: prog.startDate, endDate: prog.endDate, ids: seminarAwayIds(prog.id) });
  if (refuseDivisionGap(req, res, gaps)) return;

  const j = read.value;
  // A vehicle request filed with the original's cash advance (12v Part B) stays standing: the Division
  // Chief, who decides vehicles, is told it no longer has its passenger on the seminar.
  const vehicle = vehicleRequestFor(original.id);
  const vehicleNote = vehicle ? ` Their vehicle request ${vehicle.vrsNo} (${vehicle.status}) still stands; the Division Chief decides it.` : "";
  // Names and the title quoted (HR's and the Administrator's own words, as in Part C's entries).
  const [repQ, originalQ, titleQ] = [JSON.stringify(repEmp.fullName), JSON.stringify(originalName), JSON.stringify(title)];
  logEvent(user.id, user.username, user.role, "Send Representative",
    `${user.fullName} sent ${repQ} to ${titleQ} (FY ${prog.fiscalYear}) in lieu of ${originalQ}. `
    + `Identified by: ${JSON.stringify(j.identifiedBy.name)}, ${JSON.stringify(j.identifiedBy.position)}.`
    + `${j.referenceNo ? ` Reference: ${JSON.stringify(j.referenceNo)}${j.referenceDate ? ` (${j.referenceDate})` : ""}.` : ""}${advanceNote}${vehicleNote}`);
  if (isOwnRecord(user, repEmp.id)) flagSelfApproval(user, `sent themself to ${titleQ} in lieu of ${originalQ}`);
  if (isOwnRecord(user, original.employeeId)) flagSelfApproval(user, `sent ${repQ} to ${titleQ} in their own place`);
  logDivisionOverride(req, gaps, `sent ${repQ} to ${titleQ} (FY ${prog.fiscalYear}) in lieu of ${originalQ}`);
  if (user.role !== UserRole.SUPER_ADMIN) {
    notify({ role: UserRole.SUPER_ADMIN }, {
      title: "Representative sent",
      message: `${user.fullName} sent ${repQ} to ${titleQ} (FY ${prog.fiscalYear}) in lieu of ${originalQ}, identified by ${JSON.stringify(j.identifiedBy.name)}.${vehicleNote}`,
      type: "info",
      link: { tab: "training_development", record: { kind: "seminar", id: prog.id } },
      dedupeKey: `representative:${original.id}`
    });
  }
  // The original is told their place went to someone else (the user's decision 8), never why.
  const dates = !isIsoDate(prog.startDate) ? ""
    : prog.startDate === prog.endDate || !isIsoDate(prog.endDate) ? ` on ${formatLongDate(prog.startDate)}`
    : ` from ${formatLongDate(prog.startDate)} to ${formatLongDate(prog.endDate)}`;
  notifyEmployee(original.employeeId, {
    title: `No longer enrolled: ${title}`,
    message: `HR is sending a representative to "${title}"${dates} in your place, so your enrolment was closed.`,
    type: "info",
    link: { tab: "employee_portal" },
    dedupeKey: `replaced:${original.id}`
  });
  saveDB();
  res.json({ status: "success", message: `${repEmp.fullName} goes to "${title}" in lieu of ${originalName}.${advanceNote}${vehicleNote}`, data: { replaced: original, representative: rep } });
}));

// Attendance: HR records it per participant once the seminar has started. It is stored
// apart from the liquidation status, and only "Attended" opens the liquidation form
// (seminarFormEligibility). Marking someone Attended tells them their form is ready.
app.put("/api/training/participants/:id/attendance", authenticateToken, transactional((req: any, res: any) => {
  if (req.user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Only HR records seminar attendance." });
  }
  res.set("Cache-Control", "no-store");   // the reply carries the enrolment, its justification included (12z)
  const participant = (db.trainingParticipants || []).find((p: any) => p.id === req.params.id);
  if (!participant) return res.status(404).json({ status: "error", message: "Enrolment not found." });
  const attendance = req.body?.attendance;
  if (attendance !== "Attended" && attendance !== "Did not attend") {
    return res.status(400).json({ status: "error", message: 'Attendance must be "Attended" or "Did not attend".' });
  }
  if (participant.status === "Cancelled" || participant.status === "Archived") {
    return res.status(400).json({ status: "error", message: "This enrolment was cancelled." });
  }
  const prog = (db.trainingPrograms || []).find((p: any) => p.id === participant.trainingProgramId);
  if (!prog) return res.status(404).json({ status: "error", message: "Seminar not found." });
  if (prog.archivedAt) {
    return res.status(409).json({ status: "error", message: `"${prog.title}" is archived. Restore it before changing attendance.` });
  }
  const start = isIsoDate(prog.startDate) ? String(prog.startDate).slice(0, 10) : "";
  if (!start || start > manilaToday()) {
    return res.status(400).json({ status: "error", message: `Attendance can be recorded once the seminar starts${start ? ` on ${start}` : ""}.` });
  }
  if (attendance === "Did not attend") {
    // Their own report, or their group's: the report counts them among those who attended.
    const report = reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], participant.id);
    if (report) {
      return res.status(409).json({
        status: "error",
        message: report.activityId === participant.id
          ? `This participant filed liquidation report ${report.submissionNo}, so they can't be marked as not attending.`
          : `Liquidation report ${report.submissionNo} has been filed for this participant's group, so they can't be marked as not attending.`
      });
    }
  }
  // Once Finance has validated a group's report, everyone it covered is settled by it: an attendee
  // was liquidated, and a non-attendee's share went back with the leftover. Changing anyone's
  // attendance then would reopen a share nothing could settle any more.
  const settledBy = reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], participant.id);
  if (settledBy?.financeValidatedAt && reportGroupAdvance(settledBy) && participant.attendance !== attendance) {
    return res.status(409).json({
      status: "error",
      message: `Finance validated ${settledBy.submissionNo}, the group's liquidation report that covers this participant, so their attendance can't change now.`
    });
  }
  if (participant.attendance === attendance) {
    return res.json({ status: "success", message: "Attendance was already recorded that way.", data: participant });
  }

  const actor = req.user;
  const previous = participant.attendance || "not recorded";
  // A non-attendee drops out of the seminar and their share returns to Unallocated at
  // once (requirement 6). Marking them attended again holds it for the seminar again,
  // which needs room like any other increase: refused in a closed year (its unallocated
  // money was carried over) or when the year's Unallocated can't cover it. Priced before
  // anything is saved.
  // (A cash advance still out with them stays held either way: participantsForBudget attaches
  // it to their enrolment.)
  // (Their share of it, when a group advance covers them.)
  const outstanding = pesos(releasedByEnrolment(db.cashAdvances || []).get(participant.id) || 0);
  const heldBefore = seminarBudget(prog, participantsForBudget()).committed;
  const after = seminarBudget(prog, participantsForBudget({ id: participant.id, attendance }));
  const freed = round2(heldBefore - after.committed);
  // Only marking someone attended again can hold more, so only that is checked. "Did not attend"
  // never holds more (src/trainingBudget.ts keeps a non-attendee's cash on top), and it is a fact
  // that is always recorded. A seminar under a label with no fiscal year is outside every
  // budget, so it is treated as closed.
  if (freed < 0 && attendance === "Attended") {
    const fy = (db.fiscalYears || []).find((f: any) => f.label === prog.fiscalYear);
    if (!fy || fy.status !== "Active") {
      return res.status(409).json({
        status: "error",
        message: fy
          ? `FY ${fy.label} is closed and its unallocated training money was carried over, so ${pesoText(-freed)} can't be held for this seminar again.`
          : `There is no fiscal year ${String(prog.fiscalYear ?? "")}, so ${pesoText(-freed)} can't be held for this seminar again.`
      });
    }
    const usage = computeTrainingUsage(fy.id);
    if (round2(usage.committed - freed) > round2(usage.totalBudget)) {
      return res.status(409).json({ status: "error", message: `Marking them as attended holds ${pesoText(-freed)} for the seminar again, but only ${pesoText(Math.max(0, usage.remaining))} is Unallocated. Lower another seminar's allocation first.` });
    }
  }
  participant.attendance = attendance;
  participant.attendanceBy = actor.fullName;
  participant.attendanceAt = new Date().toISOString();
  // A cash advance request still waiting can't be released to someone who didn't attend, so
  // it is closed now rather than left in Finance's list. They may ask again if HR corrects it.
  // (A group request they asked for closes too; one that only covers them is re-priced without
  // them when Finance releases it.)
  const closedRequest = attendance === "Did not attend" ? pendingRequestFor(participant.id) : null;
  if (closedRequest) {
    declineAdvanceRequest(closedRequest, "HR recorded that you did not attend the seminar.", actor.fullName,
      `HR recorded that ${closedRequest.employeeName} did not attend the seminar.`);
  }
  const budgetNote = freed > 0
    ? after.stage === "nobodyAttended"
      ? ` Nobody attended, so the seminar now counts only what it spent: ${pesoText(freed)} returns to Unallocated.`
      : ` ${pesoText(freed)} of the seminar's allocation returns to Unallocated.`
    : freed < 0 && attendance === "Attended" ? ` ${pesoText(-freed)} is held for the seminar again.` : "";
  // A group advance that covers them, someone else's or one they hold: their share is settled with the
  // group's (its one report, or its one refund if nobody it covers attended).
  const groupOfOthers = attendance === "Did not attend" ? groupCoveringOthers(participant.id) : null;
  const heldGroup = attendance === "Did not attend" ? advanceCovering(db.cashAdvances || [], participant.id, ["Released"]) : null;
  const holdsReleasedGroup = !!heldGroup && isGroupAdvance(heldGroup) && heldGroup.activityId === participant.id;
  const heldNote = (attendance === "Did not attend" && groupOfOthers
    ? groupOfOthers.status === "Released"
      ? ` Their ${pesoText(outstanding)} share of ${groupOfOthers.employeeName}'s group cash advance stays held for the seminar until the group's liquidation report (or refund) settles it.`
      : ` ${groupOfOthers.employeeName}'s group cash advance request leaves them out when Finance releases it.`
    : holdsReleasedGroup
      ? ` Their ${pesoText(outstanding)} share of the group's cash advance they hold stays held until the group's liquidation report (or, if nobody it covers attended, its refund) settles it.`
      : attendance === "Did not attend" && outstanding > 0
        ? ` Their ${pesoText(outstanding)} cash advance is still out, and stays held for the seminar until Finance records the refund.`
        : "") + (closedRequest ? ` Their ${pesoText(closedRequest.amount)} cash advance request was closed, and they were told why.` : "");

  const emp = (db.employees || []).find((e: any) => e.id === participant.employeeId || e.employeeId === participant.employeeId);
  // The form opens in the Employee Portal, which needs a Personnel login. Only then is
  // there someone to notify (and never an untargeted notice every employee would see).
  const personnelLogin = emp?.employeeId
    ? (db.users || []).find((u: any) => u.employeeId === emp.employeeId && u.role === UserRole.EMPLOYEE && u.status !== "Archived")
    : null;
  const name = emp ? emp.fullName : participant.employeeId;
  // A group's cash advance (HSAC RAB 1): its holder files the one report, once everyone's attendance
  // is recorded and someone attended. So the holder is told when that happens, and nobody it covers
  // gets a form of their own.
  const groupAdv = advanceCovering(db.cashAdvances || [], participant.id, ["Released"]);
  const inGroup = !!groupAdv && isGroupAdvance(groupAdv);
  const coveredByOther = inGroup && groupAdv!.activityId !== participant.id ? groupAdv : groupCoveringOthers(participant.id);
  if (inGroup) {
    const holderEnrolment = (db.trainingParticipants || []).find((p: any) => p && p.id === groupAdv!.activityId);
    if (holderEnrolment && seminarFormEligibility(holderEnrolment).canLiquidate) {
      notifyEmployee(groupAdv!.employeeId, {
        title: "Your group's liquidation form is ready",
        message: `HR has recorded the attendance of everyone your group's cash advance ${groupAdv!.advanceNo} covers, so the group's liquidation form for "${String(prog.title).trim()}" is ready.`,
        type: "info",
        link: { tab: "employee_portal", liquidationActivityId: groupAdv!.activityId },
        dedupeKey: `group-form:${groupAdv!.id}`
      });
    }
  } else if (attendance === "Attended" && personnelLogin && !coveredByOther) {
    notify({ employee: emp.employeeId }, {
      title: "Your liquidation form is ready",
      message: `Your liquidation form for "${String(prog.title).trim()}" is ready. Click here, or the seminar's title under My Assigned Activities, to open it.`,
      type: "info",
      link: { tab: "employee_portal", liquidationActivityId: participant.id }
    });
  }
  logEvent(actor.id, actor.username, actor.role, "Record Attendance",
    `${name} at "${String(prog.title).trim()}": ${previous} → ${attendance}${budgetNote || heldNote ? `;${budgetNote}${heldNote}` : ""}`);
  const ownAttendance = isOwnRecord(actor, participant.employeeId);
  if (ownAttendance) flagSelfApproval(actor, `recorded their own attendance at "${String(prog.title).trim()}": ${previous} → ${attendance}`);
  // On a group's advance that covers the HR officer, others' attendance decides when its report can be
  // filed, how much it may spend and whether it is refunded in full: flagged the same way.
  const actorsGroup = advanceCovering(db.cashAdvances || [], participant.id, ["Requested", "Released"]);
  if (!ownAttendance && actorsGroup && isGroupAdvance(actorsGroup) && advanceInvolves(actor, actorsGroup)) {
    flagSelfApproval(actor, `recorded ${name}'s attendance at "${String(prog.title).trim()}" (${previous} → ${attendance}) on group cash advance ${actorsGroup.advanceNo || "request"}, which covers them`);
  }
  saveDB();
  res.json({
    status: "success",
    message: (inGroup
      ? `${name} is marked as ${attendance === "Attended" ? "attended" : "not attending"}. ${groupAdv!.employeeName} files the liquidation report for the group that ${groupAdv!.advanceNo} covers, once everyone's attendance is recorded.`
      : coveredByOther
        ? `${name} is marked as ${attendance === "Attended" ? "attended" : "not attending"}. ${coveredByOther.employeeName} asked for one cash advance for their group, and files its liquidation report.`
        : attendance === "Did not attend"
          ? `${name} is marked as not attending, so no liquidation form will open for them.`
          : personnelLogin
            ? `${name} is marked as attended. Their liquidation form is open, and they have been notified.`
            : `${name} is marked as attended. They have no Personnel login, so they can't open the form in the Employee Portal yet.`) + budgetNote + heldNote
      + (ownAttendance ? " This was your own attendance, so it is flagged as self-approved in the audit log." : ""),
    data: participant
  });
}));

app.post("/api/training/participants", authenticateToken, transactional((req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Only HR can enroll training participants." });
  }
  res.set("Cache-Control", "no-store");   // the reply carries a justification (12z)
  const { trainingProgramId, employeeId } = req.body;
  const prog = db.trainingPrograms.find(p => p.id === trainingProgramId);
  if (!prog) return res.status(404).json({ status: "error", message: "Program not found" });
  if (!employeeId) return res.status(400).json({ status: "error", message: "employeeId is required." });
  // An archived seminar takes nobody new (12t): it would be enrolled with no seminar to attend.
  if (prog.archivedAt) {
    return res.status(409).json({ status: "error", message: `"${String(prog.title || "").trim()}" is archived. Restore it before adding participants.` });
  }

  const enrolledCount = (db.trainingParticipants || []).filter(p => p.trainingProgramId === trainingProgramId && p.status !== "Cancelled").length;
  if (enrolledCount >= (prog.maxParticipants || Infinity)) {
    return res.status(400).json({ status: "error", message: "Program has reached maximum capacity" });
  }

  // Enrolling someone in a closed seminar reopens it: what it holds goes back up (its
  // allocation, less any non-attendee's share), so it needs room in the year's training
  // budget, as on the program edit.
  const overBy = trainingAllocationProblem(prog.fiscalYear, Number(prog.allocatedBudget || 0), prog.id, true);
  if (overBy) {
    return res.status(400).json({
      status: "error",
      message: `Adding a participant reopens this finished seminar, so its allocation counts again. ${overBy} Please adjust the allocation.`
    });
  }

  // Why they are seated, if the TDP doesn't identify them (12z): one justification, for this person.
  const emp = (db.employees || []).find(e => e.id === employeeId || e.employeeId === employeeId);
  const sent = new Map<string, TdpJustificationInput>();
  if (req.body?.tdpException != null) {
    const read = readTdpJustification(req.body.tdpException, manilaToday());
    if ("problem" in read) return res.status(400).json({ status: "error", message: read.problem });
    if (emp) sent.set(emp.id, read.value);
  }

  const takenBefore = seminarAwayIds(prog.id);
  const { created, skipped } = enrollTrainingParticipants(prog, [employeeId], (req as any).user, enrolledCount);
  if (created.length === 0) {
    return res.status(400).json({ status: "error", message: skipped[0] || "Employee could not be enrolled." });
  }
  // Both judged on the enrolment as made, and a refusal undoes it (the route is one transaction): someone
  // the TDP doesn't identify needs a justification (HSAC RAB 1, 2026-10-28), then someone must stay to
  // man each division. Nobody is asked about a gap for an enrolment that was refused anyway.
  // A seminar outside the TDP held with its own justification covers the new seat (Part C).
  const seminarCovers = !seminarInTdp(prog) && !!prog.tdpException;
  const tdpPlan = tdpSeatsPlan(prog, created, new Map(), sent, new Set(), seminarCovers);
  if (refuseOutsideTdp(res, prog, tdpPlan.missing)) return;
  const gaps = addedDivisionGaps(prog.id, { startDate: prog.startDate, endDate: prog.endDate, ids: takenBefore },
    { startDate: prog.startDate, endDate: prog.endDate, ids: seminarAwayIds(prog.id) });
  if (refuseDivisionGap(req, res, gaps)) return;
  coverSeatsBySeminar((req as any).user, prog, tdpPlan.toCover, true);
  for (const r of tdpPlan.toRecord) recordTdpException((req as any).user, r.participant, prog, r.justification, r.newSeat);
  logDivisionOverride(req, gaps, `added ${emp?.fullName || "a participant"} to "${String(prog.title || "").trim()}" (FY ${prog.fiscalYear})`);
  saveDB();
  res.json({ status: "success", data: created[0] });
}));

app.get("/api/training/liquidations", authenticateToken, (req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Training program details are restricted to HR." });
  }
  const { trainingProgramId } = req.query;
  let liquidations = db.trainingLiquidations || [];
  
  if (trainingProgramId) {
    liquidations = liquidations.filter(l => l.trainingProgramId === trainingProgramId);
    const breakdown = liquidations.reduce((acc, curr) => {
      acc[curr.expenseCategory] = (acc[curr.expenseCategory] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const breakdownArray = Object.keys(breakdown).map(category => ({
      category,
      total: breakdown[category]
    }));

    // Actual spend grouped by the person it was charged to. Expenses with no
    // participant (venue, speaker fees) collect under "Unassigned".
    const byPerson = liquidations.reduce((acc, curr) => {
      const key = curr.employeeId || "__unassigned__";
      acc[key] = (acc[key] || 0) + Number(curr.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    const personBreakdown = Object.keys(byPerson).map(key => {
      const emp = key === "__unassigned__"
        ? null
        : (db.employees || []).find(e => e.id === key || e.employeeId === key);
      return {
        employeeId: key === "__unassigned__" ? null : key,
        name: emp ? emp.fullName : (key === "__unassigned__" ? "Unassigned (program-wide)" : key),
        total: byPerson[key]
      };
    }).sort((a, b) => b.total - a.total);

    // Preset per-participant allocation guide (additive — existing consumers ignore it)
    const prog = (db.trainingPrograms || []).find(p => p.id === trainingProgramId);
    const perParticipant = prog ? computePerParticipantBreakdown(prog) : null;

    // Everyone enrolled, named — so a monitor can show participants who are
    // assigned but have not spent yet, not just those appearing in personBreakdown.
    // Only fullName and division are exposed here; the full employee record stays
    // restricted to HR and Admin (see GET /api/employees).
    const participants = (db.trainingParticipants || [])
      .filter((p: any) => p.trainingProgramId === trainingProgramId)
      .map((p: any) => {
        const emp = (db.employees || []).find((e: any) => e.id === p.employeeId || e.employeeId === p.employeeId);
        const spent = liquidations
          .filter((l: any) => l.trainingParticipantId === p.id)
          .reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
        return {
          id: p.id,
          employeeId: p.employeeId,
          name: emp ? emp.fullName : p.employeeId,
          division: emp ? emp.division : null,
          position: emp ? emp.position : null,
          status: p.status,
          allowanceAllocated: Number(p.allowanceAllocated || 0),
          spent
        };
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return res.json({
      status: "success",
      data: liquidations,
      breakdown: breakdownArray,
      personBreakdown,
      participants,
      perParticipant: perParticipant ? perParticipant.perParticipant : 0,
      perParticipantSplit: perParticipant ? perParticipant.split : []
    });
  }

  res.json({ status: "success", data: liquidations });
});

// One transaction: the expense row and the seminar's spending change together, or not at all.
app.post("/api/training/liquidations", authenticateToken, transactional((req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Only HR can record training expenses." });
  }
  const { trainingProgramId, trainingParticipantId, expenseCategory, description, amount, receiptFileName, dateIncurred } = req.body;
  const amt = round2(parseFloat(amount));

  const prog = db.trainingPrograms.find(p => p.id === trainingProgramId);
  if (!prog) return res.status(404).json({ status: "error", message: "Program not found" });
  if (prog.archivedAt) {
    return res.status(409).json({ status: "error", message: `"${prog.title}" is archived. Restore it before recording an expense.` });
  }

  if (!isFinite(amt) || amt <= 0) {
    return res.status(400).json({ status: "error", message: "Please enter a valid expense amount greater than zero." });
  }

  // Charging an expense to a person is optional, but when given the participant
  // must actually belong to this program.
  let participant = null;
  if (trainingParticipantId) {
    participant = (db.trainingParticipants || []).find(p => p.id === trainingParticipantId);
    if (!participant || participant.trainingProgramId !== trainingProgramId) {
      return res.status(400).json({ status: "error", message: "Selected participant is not enrolled in this training program." });
    }
    // A participant who files a liquidation report is accounted for by that report, which
    // Finance's validation copies into this ledger; a hand entry as well would count the
    // same spending twice. So is one whose group's report has been filed.
    const report = reportCovering(db.liquidationSubmissions || [], db.cashAdvances || [], participant.id);
    if (report) {
      return res.status(400).json({
        status: "error",
        message: `This participant's spending comes from ${report.activityId === participant.id ? "their" : "their group's"} liquidation report ${report.submissionNo}, so it can't also be entered here. Program-wide costs (venue, speaker) can still be recorded without choosing a participant.`
      });
    }
    // Someone marked "Did not attend" dropped out (requirement 6) and refunds any advance in
    // full, so no spending is entered for them.
    if (participant.attendance === "Did not attend") {
      return res.status(400).json({
        status: "error",
        message: "HR recorded that this participant did not attend, so no expense can be charged to them. Program-wide costs (venue, speaker) can still be recorded without choosing a participant."
      });
    }
  }

  const liq: TrainingLiquidationExpense = {
    id: `tliq-${Date.now()}`,
    trainingProgramId,
    trainingParticipantId: participant ? participant.id : undefined,
    employeeId: participant ? participant.employeeId : undefined,
    expenseCategory,
    description,
    amount: amt,
    receiptFileName,
    dateIncurred,
    submittedBy: (req as any).user.id,
    status: "Approved", // auto-approved for simplicity, or "Pending" based on flow
    source: "hr"
  };

  if (round2((prog.usedBudget || 0) + amt) > prog.allocatedBudget) {
    return res.status(400).json({ status: "error", message: "Liquidation exceeds allocated training budget." });
  }

  prog.usedBudget = round2((prog.usedBudget || 0) + amt);
  db.trainingLiquidations.push(liq);
  saveDB();
  res.json({ status: "success", data: liq });
}));


// Models tried in order when reading an uploaded PDS, best-known-working first.
//
// gemini-3.6-flash answers plain prompts and accepts a PDF, and accepts a responseSchema
// — but returns 503 "high demand" for a PDF and a responseSchema TOGETHER, which is
// exactly this request. The wording sent us chasing Google's capacity for days; it is a
// fixed incompatibility, not a busy period, so it would never have recovered on its own.
// It stays in the list so the route self-heals if Google fixes it.
//
// The free tier meters requests per day PER MODEL, so this list also multiplies the
// daily ceiling rather than only providing a fallback.
const PDS_PARSE_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite"
];

/** Statuses where a different model is worth trying. Anything else fails identically. */
const PDS_RETRYABLE = new Set([429, 500, 502, 503, 504, 404]);

/**
 * Runs the extraction against each model in turn, returning the first success.
 * Throws the last error, tagged with what was tried, when every model fails.
 */
async function generatePdsExtraction(ai: any, request: any) {
  let lastError: any = null;

  for (const model of PDS_PARSE_MODELS) {
    try {
      const response = await ai.models.generateContent({ ...request, model });
      if (model !== PDS_PARSE_MODELS[0]) {
        console.log(`[pds-parse] ${PDS_PARSE_MODELS[0]} unavailable; parsed with ${model}`);
      }
      return response;
    } catch (err: any) {
      lastError = err;
      const status = Number(err?.status);
      console.warn(`[pds-parse] ${model} failed with ${status || "unknown"}`);
      // A bad key or a malformed request fails the same way everywhere — stop rather
      // than burn the daily quota of every model in the list proving it.
      if (!PDS_RETRYABLE.has(status)) break;
    }
  }

  const err: any = new Error(lastError?.message || "All PDS reader models failed.");
  err.status = Number(lastError?.status) || 502;
  err.triedAll = true;
  throw err;
}

/** What an HSAC clerk should read, rather than Google's raw JSON. */
function pdsParseUserMessage(status: number): string {
  if (status === 429) {
    return "The PDS reader has reached today's usage limit. Please enter your details manually, or try again tomorrow.";
  }
  if (status === 401 || status === 403) {
    return "The PDS reader is not configured correctly. Please tell your system administrator, and enter your details manually for now.";
  }
  return "The PDS reader is unavailable right now. Please try again in a few minutes, or enter your details manually.";
}

app.post("/api/pds/parse", authenticateToken, async (req: any, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    
    if (!base64Data) {
      return res.status(400).json({ status: "error", message: "No file data provided" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ status: "error", message: "GEMINI_API_KEY is missing from your .env file. Please add it and restart the server." });
    }

    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const response = await generatePdsExtraction(ai, {
      contents: [
        { inlineData: { data: base64Data, mimeType: mimeType || "application/pdf" } },
        "Extract the personal information from this Personal Data Sheet (PDS). If the document is missing some fields, leave them empty."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            surname: { type: Type.STRING },
            firstName: { type: Type.STRING },
            middleName: { type: Type.STRING },
            dateOfBirth: { type: Type.STRING, description: "YYYY-MM-DD" },
            placeOfBirth: { type: Type.STRING },
            sex: { type: Type.STRING },
            civilStatus: { type: Type.STRING },
            heightM: { type: Type.STRING },
            weightKg: { type: Type.STRING },
            bloodType: { type: Type.STRING },
            gsisId: { type: Type.STRING },
            pagibigId: { type: Type.STRING },
            philhealthId: { type: Type.STRING },
            sssId: { type: Type.STRING },
            tinNo: { type: Type.STRING },
            agencyEmployeeNo: { type: Type.STRING },
            citizenshipType: { type: Type.STRING },
            telephoneNo: { type: Type.STRING },
            mobileNo: { type: Type.STRING },
            emailAddress: { type: Type.STRING },
            rHouseNo: { type: Type.STRING },
            rStreet: { type: Type.STRING },
            rBarangay: { type: Type.STRING },
            rCityMunicipality: { type: Type.STRING },
            rProvince: { type: Type.STRING },
            rZipCode: { type: Type.STRING },
            spouseSurname: { type: Type.STRING },
            spouseFirstName: { type: Type.STRING },
            spouseMiddleName: { type: Type.STRING },
            spouseExtension: { type: Type.STRING },
            spouseOccupation: { type: Type.STRING },
            spouseEmployer: { type: Type.STRING },
            spouseBusinessAddress: { type: Type.STRING },
            spouseTelephone: { type: Type.STRING },
            fatherSurname: { type: Type.STRING },
            fatherFirstName: { type: Type.STRING },
            fatherMiddleName: { type: Type.STRING },
            fatherExtension: { type: Type.STRING },
            motherMaidenSurname: { type: Type.STRING },
            motherFirstName: { type: Type.STRING },
            motherMiddleName: { type: Type.STRING },
            children: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fullName: { type: Type.STRING },
                  dateOfBirth: { type: Type.STRING }
                }
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  level: { type: Type.STRING },
                  schoolName: { type: Type.STRING },
                  degreeCourse: { type: Type.STRING },
                  attendanceFrom: { type: Type.STRING },
                  attendanceTo: { type: Type.STRING },
                  highestLevelUnitsEarned: { type: Type.STRING },
                  yearGraduated: { type: Type.STRING },
                  scholarshipsHonorsReceived: { type: Type.STRING }
                }
              }
            },
            civilService: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  eligibilityName: { type: Type.STRING },
                  rating: { type: Type.STRING },
                  dateOfExamination: { type: Type.STRING },
                  placeOfExamination: { type: Type.STRING },
                  licenseNumber: { type: Type.STRING },
                  licenseValidityDate: { type: Type.STRING }
                }
              }
            },
            serviceRecords: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  inclusiveDateFrom: { type: Type.STRING },
                  inclusiveDateTo: { type: Type.STRING },
                  positionTitle: { type: Type.STRING },
                  departmentAgency: { type: Type.STRING },
                  monthlySalary: { type: Type.STRING },
                  salaryGrade: { type: Type.STRING },
                  statusOfAppointment: { type: Type.STRING },
                  govService: { type: Type.STRING }
                }
              }
            },
            trainings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  dateFrom: { type: Type.STRING },
                  dateTo: { type: Type.STRING },
                  trainingHours: { type: Type.STRING },
                  typeOfLAndD: { type: Type.STRING },
                  organizer: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const textResponse = response.text || "{}";
    const parsed = JSON.parse(textResponse);
    
    res.json({ status: "success", data: parsed });
  } catch (err: any) {
    // Keep the upstream detail in the server log for diagnosis, but never render
    // Google's raw JSON to an HSAC clerk filling in their own PDS.
    console.error("PDS Parsing error:", err?.status || "", err?.message || err);
    const status = Number(err?.status) || 502;
    res.status(502).json({
      status: "error",
      message: pdsParseUserMessage(status),
      // The frontend keeps manual entry available regardless; this just makes the
      // reason explicit for anyone reading the response.
      canEnterManually: true
    });
  }
});


// The dev server hands files from the project folder to the browser (Vite), and that folder also
// holds the database (data_store*.json: every employee, account and PDS), this server's source
// and other private files. Anyone who could reach the port could download them without signing
// in (found 2026-10-19). Only the app itself is served: index.html, src/, node_modules/ and
// Vite's own /@ paths. Any other file or folder at the project root answers 404, however it is
// spelled: Windows also opens "DATA_S~1.JSO" or "data_store.json.", so the file system is asked.
const SERVED_ROOT_ENTRIES = new Set(["index.html", "src", "node_modules"]);
function isPrivateProjectPath(urlPath: string): boolean {
  let p: string;
  try { p = decodeURIComponent(urlPath); } catch { return true; }
  p = path.posix.normalize(p.replace(/\\/g, "/"));
  if (p.startsWith("/@")) {
    // Vite's own paths. /@vite/... and /@react-refresh are its client. Any other /@x/ path (fs,
    // id, ...) can name a file, by its absolute path or relative to the project, so the rest is
    // checked like any other request.
    const m = p.match(/^\/@([^/]+)\/(.*)$/);
    if (!m || m[1] === "vite") return false;
    const rest = m[2];
    if (/^([a-zA-Z]:)?\//.test(rest)) {
      const rel = path.relative(process.cwd(), path.resolve(rest));
      if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return false;
      p = "/" + rel.replace(/\\/g, "/");
    } else {
      p = "/" + rest;
    }
  }
  // Windows ignores trailing dots and spaces, and ":name" opens a stream of the same file.
  const first = p.split("/").find(Boolean)?.split(":")[0].replace(/[. ]+$/, "");
  if (!first || first.toLowerCase().startsWith(".vite")) return false; // a Vite dependency cache
  if (SERVED_ROOT_ENTRIES.has(first.toLowerCase())) return false;
  return fs.existsSync(path.join(process.cwd(), first));
}

// An /api path no route answered (including routes removed from the app) gets the API's own
// envelope, rather than the app's page (a GET) or Express's text page. Registered after every
// route and before the page serving below.
app.use("/api", (req: any, res: any) => {
  res.status(404).json({ status: "error", message: "Not found." });
});

// Handle serving the Vite client in development and compiled files in production
if (process.env.NODE_ENV !== "production") {
  app.use((req: any, res: any, next: any) => (isPrivateProjectPath(req.path) ? res.status(404).end() : next()));
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then((vite) => {
    app.use(vite.middlewares);
    
    // Fallback index.html route for SPA
    app.get("*", (req, res, next) => {
      const idxPath = path.join(process.cwd(), "index.html");
      const html = fs.readFileSync(idxPath, "utf8");
      vite.transformIndexHtml(req.url, html).then((transformedHtml) => {
        res.status(200).set({ "Content-Type": "text/html" }).end(transformedHtml);
      }).catch(next);
    });
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req: any, res: any) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[IPFMS Server Host] Live operational portal initialized on core PORT ${PORT}`);
  // Liquidation-deadline reminders: once at startup, then hourly. Each notice is
  // deduplicated, so the short interval only makes delivery timelier.
  runLiquidationReminderSweep();
  setInterval(runLiquidationReminderSweep, 60 * 60 * 1000);
});
