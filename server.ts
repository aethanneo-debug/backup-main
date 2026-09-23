import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI, Type } from "@google/genai";
import crypto from "crypto";
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
  TrainingPlanEmployee,
  TrainingPlanOffice,
  TRAINING_NEED_CATEGORIES,
  SpendingCategory,
  SPENDING_CATEGORIES,
  TrainingExpenseCategory,
  TRAINING_EXPENSE_CATEGORIES
} from "./src/types";

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
  activityBudgetLinks: any[];
  pds: PDS[];
  fiscalYears: any[];
  hsacBudgets: any[];
  trainingBudgets: any[];
  trainingPrograms: TrainingProgram[];
  trainingParticipants: TrainingParticipant[];
  trainingLiquidations: TrainingLiquidationExpense[];
  trainingNeeds: TrainingNeed[];
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
            isRead: false,
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
            targetRole: UserRole.HR_OFFICER
          },
          {
            id: "notif-2",
            title: "Low Supply Inventory Range Alert",
            message: "Supply stock for 'A4 Multi-purpose Bond Paper (80gsm)' is currently low (5 units left). Please arrange purchase acquisition.",
            type: "warning",
            isRead: false,
            timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
            targetRole: UserRole.SUPER_ADMIN
          },
          {
            id: "notif-3",
            title: "Financial Liquidation Verification",
            message: "Juan dela Cruz submitted a travel liquidation of ₱12,000 for travel request REQ-TRV-112. Support vouchers need verification.",
            type: "info",
            isRead: false,
            timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
            targetRole: UserRole.FINANCE_OFFICER
          },
          {
            id: "notif-4",
            title: "Comprehensive Security Compliance Log Audit",
            message: "All HR and Finance tables comply with RA 10173 Data Privacy protection directives. Periodic validation complete.",
            type: "success",
            isRead: false,
            timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
            targetRole: UserRole.SUPER_ADMIN
          },
          {
            id: "notif-5",
            title: "En Banc Board Case Reconciliation Scheduled",
            message: "A general assembly has been scheduled for case adjustments on Room B at 09:00 AM.",
            type: "info",
            isRead: false,
            timestamp: new Date(Date.now() - 3600000 * 28).toISOString(),
            targetRole: UserRole.EMPLOYEE
          },
          {
            id: "notif-6",
            title: "Meeting Room Assignment Active",
            message: "Zoom meeting 'RAB 1 En Banc Case Reconciliation Adjudication' setup is ready for launch.",
            type: "success",
            isRead: false,
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
            status: "Pending Finance Validation",
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
      if (!loaded.cashAdvances) {
        loaded.cashAdvances = [];
        changed = true;
      }

      // Records finalised before the wording change recorded the Financial Officer's
      // delegated certification of box B as "Bypassed (Auto-Approved by Finance)" signed
      // by "System" — which reads as a skipped approval rather than the documented RAB 1
      // business rule it is. Re-attribute them to the officer who actually validated.
      for (const sub of (loaded.liquidationSubmissions || [])) {
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

      // Backfill HR's allocated figure and a readable activity label onto reports filed
      // before they were stamped, so Finance's queue can flag a stated advance that
      // disagrees with HR's record on existing data too, not only on new submissions.
      for (const sub of (loaded.liquidationSubmissions || [])) {
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

      if (changed) {
        fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(loaded, null, 2), "utf8");
      }
      return loaded;
    } catch (e) {
      console.error("Error reading data_store.json, re-initializing", e);
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
        isRead: false,
        timestamp: "2026-06-16T02:00:00Z",
        targetRole: UserRole.HR_OFFICER
      },
      {
        id: "notif-2",
        title: "Low Supply Inventory Range Alert",
        message: "Supply stock for 'A4 Multi-purpose Bond Paper (80gsm)' is currently low (5 units left). Please arrange purchase acquisition.",
        type: "warning",
        isRead: false,
        timestamp: "2026-06-16T01:30:00Z",
        targetRole: UserRole.SUPER_ADMIN
      },
      {
        id: "notif-3",
        title: "Financial Liquidation Verification",
        message: "Juan dela Cruz submitted a travel liquidation of ₱12,000 for travel request REQ-TRV-112. Support vouchers need verification.",
        type: "info",
        isRead: false,
        timestamp: "2026-06-15T18:00:00Z",
        targetRole: UserRole.FINANCE_OFFICER
      },
      {
        id: "notif-4",
        title: "Comprehensive Security Compliance Log Audit",
        message: "All HR and Finance tables comply with RA 10173 Data Privacy protection directives. Periodic validation complete.",
        type: "success",
        isRead: false,
        timestamp: "2026-06-15T10:00:00Z",
        targetRole: UserRole.SUPER_ADMIN
      },
      {
        id: "notif-5",
        title: "En Banc Board Case Reconciliation Scheduled",
        message: "A general assembly has been scheduled for case adjustments on Room B at 09:00 AM.",
        type: "info",
        isRead: false,
        timestamp: "2026-06-15T09:00:00Z",
        targetRole: UserRole.EMPLOYEE
      },
      {
        id: "notif-6",
        title: "Meeting Room Assignment Active",
        message: "Zoom meeting 'RAB 1 En Banc Case Reconciliation Adjudication' setup is ready for launch.",
        type: "success",
        isRead: false,
        timestamp: "2026-06-15T08:00:00Z",
        targetRole: UserRole.EMPLOYEE
      }
    ],
    activities: [],
    liquidationSubmissions: [],
    cashAdvances: [],
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
    trainingNeeds: []
  };

  // Write initial setup
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(seedDB, null, 2), "utf8");
  return seedDB;
}

const db = getInitialData();

function saveDB() {
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(db, null, 2), "utf8");
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


    // Also copy training programs from active year to new year
    if (activeFy) {
      const activePrograms = (db.trainingPrograms || []).filter(p => p.fiscalYear === activeFy.label);
      const newPrograms = activePrograms.map(p => ({
        ...p,
        id: `tp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        // Keep the copy in the original's series so past attendees stay blocked.
        seriesId: p.seriesId || p.id,
        fiscalYear: newFy.label,
        usedBudget: 0
      }));
      db.trainingPrograms = [...(db.trainingPrograms || []), ...newPrograms];
      
      const activeTrainingBudget = (db.trainingBudgets || []).find(b => b.fiscalYearId === activeFy.id);
      if (activeTrainingBudget) {
        const allocatedBudget = activePrograms.reduce((sum, p) => sum + Number(p.allocatedBudget || 0), 0);
        const carryOver = Math.max(0, Number(activeTrainingBudget.totalBudget || 0) - allocatedBudget);

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
      //
      // This also repairs the link the programme copy above would otherwise break: those
      // copies keep their `fulfillsNeedTitles`, and without the matching need in the new
      // year the participant ranking and the Plan D checkoff would both find nothing.
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
        if (!db.notifications) db.notifications = [];
        db.notifications.push({
          id: `notif-${Date.now()}-needs`,
          title: `${carriedNeeds.length} unmet training need${carriedNeeds.length === 1 ? "" : "s"} carried to ${newFy.label}`,
          message: `Plan A for ${newFy.label} starts with ${carriedNeeds.length} need${carriedNeeds.length === 1 ? "" : "s"} still unmet from ${activeFy.label}. Accomplished needs were left with ${activeFy.label}.`,
          isRead: false,
          type: "info",
          timestamp: new Date().toISOString(),
          targetRole: UserRole.HR_OFFICER
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

  if ((req as any).user.role === UserRole.EMPLOYEE && req.user.employeeId !== employeeId) {
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

  const emp = db.employees.find(e => e.employeeId === employeeId);
  if (!emp) {
    return res.status(404).json({ status: "error", message: "Target employee record not found" });
  }

  if (filename) {
    emp.pdsFieldName = filename || "PDS_Document_Uploaded.pdf";
    emp.pdsUploadedAt = new Date().toISOString();
  }


  if (data) {
    if (!db.pds) db.pds = [];
    
    // Update salary across the system if Admin modifies it
    if (data.salary !== undefined && (req as any).user.role === UserRole.SUPER_ADMIN) {
      emp.salary = Number(data.salary);
    }
    if (data.position !== undefined) {
      emp.position = data.position;
    }

    const existingIndex = db.pds.findIndex((p: any) => p.employeeId === employeeId);

    if (existingIndex >= 0) {
      db.pds[existingIndex] = { ...db.pds[existingIndex], ...data };
    } else {
      db.pds.push({ id: `pds-${Date.now()}`, employeeId, ...data });
    }
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Upload PDS", `Updated Personal Data Sheet (PDS) for ${emp.fullName} (${employeeId})`);
  saveDB();
  res.json({ status: "success", data: emp });
});

// Employee specific details (Training & History)
app.get("/api/employees/:employeeId/trainings", authenticateToken, (req: any, res: any) => {
  const { employeeId } = req.params;
  const manualRecords = db.trainings.filter(t => t.employeeId === employeeId);
  
  const assignedRecords = db.trainingParticipants
    .filter(p => p.employeeId === employeeId && p.status === "Liquidated")
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
          remarks: `Assigned via Training Plan (${prog.category})`
        };
      }
      return null;
    })
    .filter(Boolean);
    
  res.json({ status: "success", data: [...manualRecords, ...assignedRecords] });
});

app.get("/api/employees/:employeeId/assigned_activities", authenticateToken, (req: any, res: any) => {
  const { employeeId } = req.params;
  // TDP enrolments store Employee.id ("emp-...") while this route is called with the
  // business id ("EMP001"), so match either form.
  const forms = employeeIdForms(employeeId);
  if (!canAccessEmployeeTrainingRecords(req.user, forms)) {
    return res.status(403).json({ status: "error", message: "You can only view your own assigned seminars." });
  }
  const assignedRecords = db.trainingParticipants
    .filter(p => forms.includes(p.employeeId) && p.status !== "Liquidated" && p.status !== "Archived" && p.status !== "Cancelled")
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
          status: p.status || "Scheduled",
          assignedBy: "HR"
        };
      }
      return null;
    })
    .filter(Boolean);
    
  res.json({ status: "success", data: assignedRecords });
});

app.post("/api/employees/:employeeId/liquidate_activity/:participantId", authenticateToken, (req: any, res: any) => {
  const { employeeId, participantId } = req.params;
  const forms = employeeIdForms(employeeId);
  if (!canAccessEmployeeTrainingRecords(req.user, forms)) {
    return res.status(403).json({ status: "error", message: "You can only liquidate your own seminars." });
  }

  const pIndex = db.trainingParticipants.findIndex(p => p.id === participantId && forms.includes(p.employeeId));
  if (pIndex !== -1) {
    db.trainingParticipants[pIndex].status = "Liquidation Pending";
    // Optional: save liquidation details like receipts in a separate table
    saveDB();
    res.json({ status: "success", message: "Liquidation submitted" });
  } else {
    res.status(404).json({ status: "error", message: "Record not found" });
  }
});


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
  const history = db.employmentHistory.filter(h => h.employeeId === employeeId);
  res.json({ status: "success", data: history });
});


// 3. Financial Document & Receipt Tracking Module
app.get("/api/financial-transactions", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.financialTransactions });
});

app.post("/api/financial-transactions", authenticateToken, (req: any, res) => {
  const data = req.body;

  // Enforce Roles: Admin or Finance
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.FINANCE_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized to log financial receipts" });
  }

  const txnId = `TXN-2026-${Math.floor(100 + Math.random() * 900)}`;
  const empRef = data.employeeRef || req.user.employeeId || "EMP003";
  const dept = data.department || req.user.division || "Administrative and Finance Division";
  const cat = data.category || "Other";

  const newTxn: FinancialTransaction = {
    id: `tx-${Date.now()}`,
    transactionId: txnId,
    transactionDate: data.transactionDate || new Date().toISOString().split("T")[0],
    supplier: data.supplier,
    amount: Number(data.amount),
    description: data.description,
    receiptFilename: data.receiptFilename || "receipt.png",
    status: TransactionStatus.PENDING_VALIDATION,
    supportingDocuments: data.supportingDocuments || [],
    history: [{
      id: `th-${Date.now()}`,
      status: TransactionStatus.PENDING_VALIDATION,
      changedBy: (req as any).user.fullName,
      changedAt: new Date().toISOString(),
      remarks: "Receipt submitted to registry ledger. Awaiting Finance verification."
    }],
    employeeRef: empRef,
    department: dept,
    category: cat,
    createdBy: (req as any).user.fullName,
    dateCreated: new Date().toISOString().split("T")[0]
  };

  db.financialTransactions.push(newTxn);
  
  // Create precise finance audit log trace
  logFinanceAudit((req as any).user.fullName, "Transaction Creation", "Financial Transactions", "None", txnId);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Register Receipt", `Logged regional financial receipt ${newTxn.transactionId} matching PHP ${newTxn.amount} from ${newTxn.supplier}`);
  saveDB();
  res.json({ status: "success", data: newTxn });
});

// Update financial transactions workflow status index
app.put("/api/financial-transactions/:id/status", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  // Finance Officer or Super Admin validation
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.FINANCE_OFFICER) {
    return res.status(403).json({ status: "error", message: "Only Finance Officers can validate journals" });
  }

  const txn = db.financialTransactions.find(t => t.id === id);
  if (!txn) {
    return res.status(404).json({ status: "error", message: "Financial entry ledger index not found" });
  }

  const oldStatus = txn.status;
  txn.status = status as TransactionStatus;

  txn.history.push({
    id: `th-${Date.now()}`,
    status: txn.status,
    changedBy: (req as any).user.fullName,
    changedAt: new Date().toISOString(),
    remarks: remarks || `Workflow shift to: ${status}`
  });

  // Track budget utilization dynamically upon validating transactions
  if (status === TransactionStatus.VALIDATED || status === TransactionStatus.LIQUIDATED) {
    if (oldStatus !== TransactionStatus.VALIDATED && oldStatus !== TransactionStatus.LIQUIDATED) {
      const deptBudget = db.budgetAllocations.find(b => b.department === txn.department);
      if (deptBudget) {
        deptBudget.budgetUtilized += txn.amount;
        deptBudget.remainingBudget = deptBudget.budgetAllocation - deptBudget.budgetUtilized;
        deptBudget.budgetPercentageUsed = Math.round((deptBudget.budgetUtilized / deptBudget.budgetAllocation) * 100);
        logFinanceAudit((req as any).user.fullName, "Update Budget Utilization", "Budget Monitoring", `${deptBudget.budgetUtilized - txn.amount}`, `${deptBudget.budgetUtilized}`);
      }
    }
  }

  logFinanceAudit((req as any).user.fullName, "Transaction Status Shift", "Financial Transactions", oldStatus, status);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Validate Financial Record", `Upgraded ledger transaction ${txn.transactionId} status from ${oldStatus} to ${status}`);
  saveDB();
  res.json({ status: "success", data: txn });
});

// Attach general supporting document to transaction index
app.post("/api/financial-transactions/:id/documents", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { name, type, filename } = req.body;

  const txn = db.financialTransactions.find(t => t.id === id);
  if (!txn) {
    return res.status(404).json({ status: "error", message: "Financial entry ledger index not found" });
  }

  const scanFile = filename || "scanned_doc.pdf";
  const newDoc = {
    id: `doc-${Date.now()}`,
    name,
    type,
    filename: scanFile,
    uploadedAt: new Date().toISOString(),
    uploadedBy: (req as any).user.fullName,
    validationStatus: "Validated",
    versions: [
      { version: 1, filename: scanFile, uploadedAt: new Date().toISOString(), uploadedBy: (req as any).user.fullName }
    ]
  };

  txn.supportingDocuments.push(newDoc as any);
  
  logFinanceAudit((req as any).user.fullName, "Receipt Upload", "Supporting Documents", "None", name);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Upload Support Doc", `Attached supporting document: "${name}" (${type}) to transaction ledger ${txn.transactionId}`);
  saveDB();
  res.json({ status: "success", data: txn });
});

// Replace/update version of a supporting document
app.post("/api/financial-transactions/:id/documents/:docId/replace", authenticateToken, (req: any, res) => {
  const { id, docId } = req.params;
  const { filename } = req.body;

  const txn = db.financialTransactions.find(t => t.id === id);
  if (!txn) {
    return res.status(404).json({ status: "error", message: "Financial entry ledger index not found" });
  }

  const doc = txn.supportingDocuments.find(d => d.id === docId);
  if (!doc) {
    return res.status(404).json({ status: "error", message: "Supporting document not found in this transaction" });
  }

  if (!doc.versions) {
    doc.versions = [];
  }
  if (doc.versions.length === 0) {
    doc.versions.push({
      version: 1,
      filename: doc.filename,
      uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy || "Staff uploader"
    });
  }

  const nextVersionNum = doc.versions.length + 1;
  const safeFilename = filename || `updated_v${nextVersionNum}_${doc.filename}`;

  doc.versions.push({
    version: nextVersionNum,
    filename: safeFilename,
    uploadedAt: new Date().toISOString(),
    uploadedBy: (req as any).user.fullName
  });

  const oldFilename = doc.filename;
  doc.filename = safeFilename;
  doc.uploadedAt = new Date().toISOString();
  doc.uploadedBy = (req as any).user.fullName;

  logFinanceAudit((req as any).user.fullName, "Document Replaced", "Supporting Documents", oldFilename, safeFilename);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Replace Support Doc", `Replaced file for "${doc.name}" on ${txn.transactionId} from ${oldFilename} to ${safeFilename}`);
  saveDB();

  res.json({ status: "success", data: txn });
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
// Single source of truth for how a spend is applied to a budget bucket. Used by
// both the automatic deduction on liquidation completion and the manual
// "Establish Integration Link" fallback, so the two can never drift apart.
function applyBudgetDeduction(budget: any, spentAmount: number) {
  budget.budgetUtilized = Number(budget.budgetUtilized || 0) + Number(spentAmount || 0);
  const base = Number(budget.budgetAllocation || 0) + Number(budget.carryOver || 0);
  budget.remainingBudget = base - budget.budgetUtilized - Number(budget.unliquidatedAdvances || 0);
  budget.budgetPercentageUsed = base > 0 ? Math.round((budget.budgetUtilized / base) * 100) : 0;
}

// A liquidation is deducted exactly once. Both paths record an activityBudgetLink,
// so the presence of a link is the idempotency marker regardless of which ran.
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
    if (!db.notifications) db.notifications = [];
    db.notifications.push({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: "Budget Auto-Deduction Skipped",
      message: `Liquidation ${sub.submissionNo} (${category}, ₱${spent.toLocaleString()}) has no matching ${department} budget bucket for ${activeFy.label}. Please link it manually.`,
      type: "warning",
      isRead: false,
      timestamp: new Date().toISOString(),
      targetRole: UserRole.BUDGET_OFFICER
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

// --- DYNAMIC PERMANENT ACTIVITY-BUDGET LINKING ENDPOINTS ---
app.get("/api/finance/activity-budget-links", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.activityBudgetLinks || [] });
});

app.post("/api/finance/activity-budget-links", authenticateToken, (req: any, res) => {
  const { liquidationNo, employee, department, amount, budgetId } = req.body;
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.BUDGET_OFFICER && (req as any).user.role !== UserRole.FINANCE_OFFICER) {
    return res.status(403).json({ status: "error", message: "Only Budget or Finance Officers can map activities to budgets." });
  }

  // A liquidation may only be deducted once, whether automatically on completion
  // or manually here. This keeps the manual fallback available for edge cases
  // without letting it double-count an already-deducted spend.
  if (isAlreadyDeducted(liquidationNo)) {
    return res.status(400).json({ status: "error", message: `Liquidation ${liquidationNo} has already been deducted from a budget bucket.` });
  }

  const sub = db.liquidationSubmissions?.find((s: any) => s.submissionNo === liquidationNo);

  const newLink = {
    id: `bl-${Date.now()}`,
    liquidationNo,
    employee,
    department,
    amount: Number(amount),
    budgetId,
    category: sub ? resolveSpendingCategory(sub) : undefined,
    source: "manual",
    timestamp: new Date().toISOString()
  };

  if (!db.activityBudgetLinks) db.activityBudgetLinks = [];
  db.activityBudgetLinks.unshift(newLink);

  // Add actual spent amount to utilized budget when Integration Link is established
  const budget = db.budgetAllocations.find((b: any) => b.id === budgetId);
  if (budget) {
    const spentAmount = sub ? Number(sub.totalSpent || 0) : Number(amount || 0);
    applyBudgetDeduction(budget, spentAmount);
  }

  logFinanceAudit((req as any).user.fullName, "Map Activity To Budget", "Budget Linking", "None", `${liquidationNo} linked to ${budgetId}`);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Map Activity Budget", `Linked activity ${liquidationNo} to budget total`);
  saveDB();

  res.json({ status: "success", data: newLink });
});

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

app.get("/api/finance/budget-requests", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.budgetRequests || [] });
});

app.post("/api/finance/budget-requests", authenticateToken, (req: any, res) => {
  const { department, amountRequested, requestType, purpose } = req.body;
  const newRequest: BudgetRequestItem = {
    id: `br-${Date.now()}`,
    department,
    amountRequested: Number(amountRequested),
    requestType,
    purpose,
    status: "Pending",
    createdAt: new Date().toISOString(),
  };
  if (!db.budgetRequests) {
    db.budgetRequests = [];
  }
  db.budgetRequests.push(newRequest);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Submit Budget Request", `Submitted ${requestType} request for ${department} of PHP ${amountRequested}`);
  saveDB();
  res.json({ status: "success", data: newRequest });
});

app.post("/api/finance/budget-requests/:id/action", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { action, remarks } = req.body; // Approved or Returned

  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only the Division Chief has concession authority to approve/return budget request adjustments." });
  }

  const reqItem = db.budgetRequests?.find(r => r.id === id);
  if (!reqItem) {
    return res.status(404).json({ status: "error", message: "Budget request not found" });
  }

  reqItem.status = action;
  reqItem.remarks = remarks;
  reqItem.approvedBy = (req as any).user.fullName;

  if (action === "Approved") {
    const budget = db.budgetAllocations.find(b => b.department === reqItem.department);
    if (budget) {
      const oldAllocation = budget.budgetAllocation;
      budget.budgetAllocation += reqItem.amountRequested;
      budget.remainingBudget = budget.budgetAllocation + (budget.carryOver || 0) - budget.budgetUtilized;
      budget.budgetPercentageUsed = Math.round((budget.budgetUtilized / (budget.budgetAllocation + (budget.carryOver || 0))) * 100);
      logFinanceAudit((req as any).user.fullName, `Augment Budget Allocation via request ${reqItem.id}`, "Budget Monitoring", `${oldAllocation}`, `${budget.budgetAllocation}`);
    } else {
      const activeFy = (db.fiscalYears || []).find((f: any) => f.status === "Active");
      db.budgetAllocations.push({
        id: `b-${Date.now()}`,
        fiscalYearId: activeFy?.id || "fy-1",
        department: reqItem.department,
        budgetAllocation: reqItem.amountRequested,
        budgetUtilized: 0,
        remainingBudget: reqItem.amountRequested,
        budgetPercentageUsed: 0,
        allocatedPS: reqItem.amountRequested,
        utilizedPS: 0,
        remainingPS: reqItem.amountRequested,
        allocatedMOOE: 0, utilizedMOOE: 0, remainingMOOE: 0,
        allocatedCO: 0, utilizedCO: 0, remainingCO: 0
      });
    }
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, `${action} Budget Request`, `${action} budget request ${id} with remarks: ${remarks}`);
  saveDB();
  res.json({ status: "success", data: reqItem });
});

app.get("/api/budget-requests", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.budgetRequests || [] });
});

app.put("/api/budget-requests/:id/approve", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only the Division Chief has concession authority to approve/return budget request adjustments." });
  }

  const reqItem = db.budgetRequests?.find(r => r.id === id);
  if (!reqItem) {
    return res.status(404).json({ status: "error", message: "Budget request not found" });
  }

  reqItem.status = status;
  reqItem.remarks = remarks || "";
  reqItem.approvedBy = (req as any).user.fullName;

  if (status === "Approved") {
    const budget = db.budgetAllocations.find(b => b.department === reqItem.department);
    if (budget) {
      const oldAllocation = budget.budgetAllocation;
      budget.budgetAllocation += reqItem.amountRequested;
      budget.remainingBudget = budget.budgetAllocation + (budget.carryOver || 0) - budget.budgetUtilized;
      budget.budgetPercentageUsed = Math.round((budget.budgetUtilized / (budget.budgetAllocation + (budget.carryOver || 0))) * 100);
      logFinanceAudit((req as any).user.fullName, `Augment Budget Allocation (Chief Concurrence) ${reqItem.id}`, "Budget Monitoring", `${oldAllocation}`, `${budget.budgetAllocation}`);
    } else {
      const activeFy = (db.fiscalYears || []).find((f: any) => f.status === "Active");
      db.budgetAllocations.push({
        id: `b-${Date.now()}`,
        fiscalYearId: activeFy?.id || "fy-1",
        department: reqItem.department,
        budgetAllocation: reqItem.amountRequested,
        budgetUtilized: 0,
        remainingBudget: reqItem.amountRequested,
        budgetPercentageUsed: 0,
        allocatedPS: reqItem.amountRequested,
        utilizedPS: 0,
        remainingPS: reqItem.amountRequested,
        allocatedMOOE: 0, utilizedMOOE: 0, remainingMOOE: 0,
        allocatedCO: 0, utilizedCO: 0, remainingCO: 0
      });
    }
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, `Resolve Budget Request: ${status}`, `${status} budget request ${id} with comments: ${remarks}`);
  saveDB();
  res.json({ status: "success", data: reqItem });
});

// --- NEW FINANCE AUDIT ENDPOINT ---
app.get("/api/finance/audit-logs", authenticateToken, (req: any, res: any) => {
  res.json({ status: "success", data: db.financeAuditLogs || [] });
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
app.get("/api/requests", authenticateToken, (req: any, res) => {
  // Employees can only view their own requests unless they are Admin, HR, Department Head, Custodian
  const { role, employeeId } = req.user;
  
  if (role === UserRole.EMPLOYEE) {
    const records = db.requests.filter(r => r.employeeId === employeeId);
    return res.json({ status: "success", data: records });
  }
  
  res.json({ status: "success", data: db.requests });
});

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
      fullReq = {
        ...baseReq,
        destination: data.destination,
        purpose: data.purpose,
        dateNeeded: data.dateNeeded,
        passengers: data.passengers
      } as any;
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
  
  // Trigger system notification dynamically
  if (!db.notifications) {
    db.notifications = [];
  }
  let targetRole: string | undefined = undefined;
  if (fullReq.requestType === RequestType.LEAVE || fullReq.requestType === RequestType.SERVICE_RECORD || fullReq.requestType === RequestType.SUPPLY || fullReq.requestType === RequestType.VEHICLE || fullReq.requestType === RequestType.ZOOM) {
    targetRole = UserRole.HR_OFFICER;
  }
  db.notifications.push({
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: `New ${fullReq.requestType}`,
    message: `${fullReq.employeeName} submitted a ${fullReq.requestType} for verification and approval.`,
    type: "info",
    isRead: false,
    timestamp: new Date().toISOString(),
    targetRole
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
  
  // Total stats values (general overview)
  const activeEmployees = db.employees.filter(e => e.isActive).length;
  const totalEmployees = activeEmployees;
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
      auditLogs: db.auditLogs.slice(0, 8), // recent activities
      recentRequests: db.requests.slice(0, 5),
      recentTransactions: db.financialTransactions.slice(0, 5),
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

// 8. Dynamic Notifications APIs
app.get("/api/notifications", authenticateToken, (req: any, res) => {
  if (!db.notifications) {
    db.notifications = [];
  }
  const role = (req as any).user.role;
  const employeeId = req.user.employeeId;
  // Send notifications belonging to this role OR globals (which have no targetRole), filtered by employeeId if targetRole is Employee
  const filtered = db.notifications.filter(n => {
    const roleMatches = !n.targetRole || n.targetRole === role;
    if (role === UserRole.EMPLOYEE) {
      return roleMatches && (!n.targetEmployeeId || n.targetEmployeeId === employeeId);
    }
    return roleMatches;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json({ status: "success", data: filtered });
});

app.post("/api/notifications/:id/read", authenticateToken, (req: any, res) => {
  if (!db.notifications) {
    db.notifications = [];
  }
  const { id } = req.params;
  const notif = db.notifications.find(n => n.id === id);
  if (notif) {
    notif.isRead = true;
    saveDB();
    res.json({ status: "success", data: notif });
  } else {
    res.status(404).json({ status: "error", message: "Notification slot not found" });
  }
});

app.post("/api/notifications/read-all", authenticateToken, (req: any, res) => {
  if (!db.notifications) {
    db.notifications = [];
  }
  const role = (req as any).user.role;
  const employeeId = req.user.employeeId;
  db.notifications.forEach(n => {
    const roleMatches = !n.targetRole || n.targetRole === role;
    if (role === UserRole.EMPLOYEE) {
      if (roleMatches && (!n.targetEmployeeId || n.targetEmployeeId === employeeId)) {
        n.isRead = true;
      }
    } else {
      if (roleMatches) {
        n.isRead = true;
      }
    }
  });
  saveDB();
  res.json({ status: "success", message: "All user notifications marked as read successfully" });
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


// Test Email Route
app.post("/api/admin/test-email", authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Requires Administrator / Division Chief privileges" });
  }
  
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(400).json({ status: "error", message: "SMTP credentials are not configured in the environment secrets." });
  }

  const { targetEmail } = req.body;
  if (!targetEmail) {
    return res.status(400).json({ status: "error", message: "Target email is required." });
  }

  try {
    const info = await transporter.sendMail({
      from: '"IntegraSync Test" <' + process.env.SMTP_USER + '>',
      to: targetEmail,
      subject: 'IntegraSync - Email System Test',
      text: 'If you are reading this, the IntegraSync email system is working correctly!'
    });
    console.log("Test email sent successfully:", info.response);
    res.json({ status: "success", message: "Test email sent successfully. Check your inbox!" });
  } catch (error: any) {
    console.error("Test email failed:", error);
    res.status(500).json({ status: "error", message: "Failed to send email: " + error.message });
  }
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

  if (endorse) {
    request.status = RequestStatus.ENDORSED_TO_CHIEF;
    request.remarks = remarks || "Endorsed under HR review benchmarks.";
  } else {
    request.status = RequestStatus.RETURNED_BY_HR;
    request.remarks = remarks || "Returned with HR verification queries.";
  }
  
  if (!db.notifications) db.notifications = [];
  db.notifications.push({
    id: `notif-${Date.now()}`,
    title: endorse ? "Request Endorsed" : "Request Returned to Employee",
    message: endorse 
      ? `HR Officer ${(req as any).user.fullName} endorsed ${request.requestType} for ${request.employeeName} to Division Chief.`
      : `HR Officer ${(req as any).user.fullName} returned ${request.requestType} with remarks: "${remarks}".`,
    type: endorse ? "success" : "warning",
    isRead: false,
    timestamp: new Date().toISOString(),
    targetRole: endorse ? UserRole.SUPER_ADMIN : UserRole.EMPLOYEE,
    targetEmployeeId: endorse ? undefined : request.employeeId
  });

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Endorse Personnel Request", `HR acted on request ${request.id}, status: ${request.status}`);
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

  if (!db.notifications) db.notifications = [];
  db.notifications.push({
    id: `notif-${Date.now()}`,
    title: `Request ${request.status}`,
    message: `Division Chief Hon. Romeo M. Alcantara acted on your ${request.requestType}: ${request.status}`,
    type: request.status === RequestStatus.APPROVED ? "success" : "warning",
    isRead: false,
    timestamp: new Date().toISOString(),
    targetRole: UserRole.EMPLOYEE,
    targetEmployeeId: request.employeeId
  });

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Final Chief Decision", `Chief decided ${request.id}, status: ${request.status}`);
  saveDB();
  res.json({ status: "success", data: request });
});


// C. ASSIGNED ACTIVITIES APIs
app.get("/api/activities", authenticateToken, (req: any, res) => {
  const { role, employeeId } = req.user;
  
  if (role === UserRole.EMPLOYEE) {
    const empRecord = db.employees.find((e) => e.employeeId === employeeId);
    const altId = empRecord ? empRecord.id : null;
    const list = db.activities.filter((a) => a.assignedEmployeeId === employeeId || a.assignedEmployeeId === altId);
    
    // Inject assigned training programs
    const trainings = db.trainingParticipants.filter((p) => p.employeeId === altId || p.employeeId === employeeId);
    for (const t of trainings) {
      const prog = db.trainingPrograms.find((p) => p.id === t.trainingProgramId);
      if (prog) {
        list.push({
          id: t.id,
          activityNo: `TRN-2026-${prog.id.replace('tp-','')}`,
          title: `Seminar/Training: ${prog.title}`,
          description: prog.description || "Assigned training program",
          dateScheduled: prog.startDate,
          endDate: prog.endDate,
          liquidationDueDate: liquidationDueDateFor(prog),
          participantStatus: t.status,
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

app.post("/api/activities", authenticateToken, (req: any, res) => {
  const { title, description, dateScheduled, allottedBudget, budgetId, assignedEmployeeId } = req.body;
  if (!title || !allottedBudget || !assignedEmployeeId) {
    return res.status(400).json({ status: "error", message: "Missing required activity definition metrics" });
  }

  const newAct = {
    id: `act-${Date.now()}`,
    activityNo: `ACT-2026-0${db.activities.length + 1}`,
    title,
    description: description || "",
    dateScheduled: dateScheduled || new Date().toISOString().split("T")[0],
    allottedBudget: Number(allottedBudget),
    budgetId: budgetId || "b-2",
    assignedEmployeeId,
    status: "Active"
  };

  db.activities.push(newAct);
  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Create Activity", `Created assigned employee activity: ${title}`);
  saveDB();
  res.json({ status: "success", data: newAct });
});


// D. THREE-STAGED EXHAUSTIVE LIQUIDATION SUBMISSIONS APIs
app.get("/api/liquidation-submissions", authenticateToken, (req: any, res) => {
  const { role, employeeId } = req.user;
  if (role === UserRole.EMPLOYEE) {
    const list = db.liquidationSubmissions.filter(l => l.employeeId === employeeId);
    return res.json({ status: "success", data: list });
  }
  res.json({ status: "success", data: db.liquidationSubmissions });
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

// Normalises the PARTICULARS block. Returns null when the payload carries no usable
// lines, so an older client sending only `totalSpent` keeps working unchanged.
function normalizeParticulars(raw: any): { particulars: any[]; total: number; error?: string } | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const particulars: any[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i] || {};
    const description = String(p.description || "").trim();
    const amount = round2(Number(p.amount));
    if (!description && !amount) continue; // blank row the user never filled in
    if (!description) {
      return { particulars: [], total: 0, error: `Particular ${i + 1} needs a description.` };
    }
    if (!isFinite(amount) || amount < 0) {
      return { particulars: [], total: 0, error: `"${description}" needs an amount of zero or more.` };
    }
    // An unrecognised or missing bucket falls back rather than failing the whole
    // report — the claimant's money is not held up by a bad dropdown value.
    const category: TrainingExpenseCategory =
      TRAINING_EXPENSE_CATEGORIES.includes(p.category) ? p.category : "Miscellaneous";
    particulars.push({ id: String(p.id || `lp-${Date.now()}-${i}`), description, amount, category });
  }
  if (particulars.length === 0) return null;
  return { particulars, total: round2(particulars.reduce((s, p) => s + p.amount, 0)) };
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

app.post("/api/liquidation-submissions", authenticateToken, (req: any, res) => {
  const { employeeId, fullName } = req.user;
  const {
    activityId, totalReleased, totalSpent, remarks, supportingDocs, particulars,
    periodCoveredFrom, periodCoveredTo, responsibilityCenterCode,
    cashAdvanceDvNo, cashAdvanceDvDate, refundOrNo, refundOrDate
  } = req.body;
  if (!activityId) {
    return res.status(400).json({ status: "error", message: "Please choose the activity this report settles." });
  }
  // A cash advance of zero is legitimate: an employee assigned to a seminar who never
  // received the advance pays out of pocket, and this report is how they claim it back.
  // Only a missing or negative figure is rejected.
  const releasedRaw = Number(totalReleased);
  if (totalReleased === undefined || totalReleased === null || totalReleased === "" || !isFinite(releasedRaw) || releasedRaw < 0) {
    return res.status(400).json({ status: "error", message: "Enter the cash advance you actually received — enter 0 if you received none." });
  }

  const lines = normalizeParticulars(particulars);
  if (lines && lines.error) {
    return res.status(400).json({ status: "error", message: lines.error });
  }
  if (!lines && !(Number(totalSpent) > 0)) {
    return res.status(400).json({ status: "error", message: "Add at least one particular describing what was spent." });
  }

  // Mirrors the ownership checks already in liquidate_activity and /resubmit.
  if ((req as any).user.role !== UserRole.SUPER_ADMIN
      && liquidationActivityOwnedByUser(activityId, req.user) === false) {
    return res.status(403).json({ status: "error", message: "You can only liquidate your own assigned activity." });
  }

  const subNo = `LIQSUB-2026-0${db.liquidationSubmissions.length + 1}`;
  const now = new Date();
  const facts = liquidationActivityFacts(activityId);

  // The cash advance record is the authority on what was released — not the claimant's
  // input. With one on file the employee can no longer understate it to manufacture a
  // reimbursement, and the DV reference comes from Finance rather than being typed.
  // With none on file we fall back to the submitted figure, because assignments funded
  // before cash advances were recorded have no record to read. That gap closes as
  // Finance issues advances through this flow; until then allocatedAtFiling is what
  // flags a suspicious claim.
  const advance = openAdvanceFor(activityId, employeeIdForms(employeeId || ""));
  const released = advance ? round2(Number(advance.amount)) : round2(Number(totalReleased));
  // When the report is itemised, the total is the sum of the lines — never a separately
  // typed figure that could disagree with them.
  const spent = lines ? lines.total : round2(Number(totalSpent || 0));
  const newSub = {
    id: `liqsub-${Date.now()}`,
    submissionNo: subNo,
    activityId,
    employeeId,
    employeeName: fullName,
    totalReleased: released,
    totalSpent: spent,
    remainingBalance: round2(released - spent),
    remarks: remarks || "",
    supportingDocs: supportingDocs || [],

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
    cashAdvanceDvNo: advance ? advance.dvNo : (cashAdvanceDvNo || ""),
    cashAdvanceDvDate: advance ? advance.dvDate : (cashAdvanceDvDate || ""),
    refundOrNo: refundOrNo || "",
    refundOrDate: refundOrDate || "",
    jevNo: "",

    // Spending more than was received makes this a claim for the difference. Derived, so
    // it can never disagree with the figures above.
    reimbursementAmount: round2(Math.max(0, spent - released)),
    reimbursementStatus: spent > released ? "Awaiting Reimbursement" : "Not Required",
    reimbursementDvNo: "",
    reimbursementDate: "",
    reimbursedBy: "",

    // HR's own figure, so Finance can see a stated advance that disagrees with it.
    ...(facts ? { allocatedAtFiling: facts.allocated, activityTitle: facts.title } : {}),

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
  
  // Check if it's a training participant liquidation
  const pIndex = db.trainingParticipants.findIndex((p) => p.id === activityId);
  if (pIndex !== -1) {
    db.trainingParticipants[pIndex].status = "Liquidation Pending";
  }

  if (!db.notifications) db.notifications = [];
  db.notifications.push({
    id: `notif-${Date.now()}`,
    title: "Liquidation Report Submitted",
    message: `${fullName} submitted a liquidation report for activity relationship evaluation.`,
    isRead: false,
    type: "info",
    timestamp: new Date().toISOString(),
    targetRole: UserRole.HR_OFFICER
  });

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Submit Liquidation", `Submitted liquidation report: ${subNo}`);
  saveDB();
  res.json({ status: "success", data: newSub });
});

app.put("/api/requests/:id/resubmit", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { dateRequested, startDate, endDate, dateNeeded, meetingDate } = req.body;

  const request = db.requests.find((r: any) => r.id === id);
  if (!request) {
    return res.status(404).json({ status: "error", message: "Personnel Request not found" });
  }

  if (request.employeeId !== req.user.employeeId && (req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Forbidden: You cannot resubmit this request." });
  }
  
  if (dateRequested) request.dateRequested = dateRequested;
  
  // Depending on request type update relevant date fields
  if (request.requestType === RequestType.LEAVE) {
    const leaveReq = request as any;
    if (startDate) leaveReq.startDate = startDate;
    if (endDate) leaveReq.endDate = endDate;
  } else if (request.requestType === RequestType.VEHICLE) {
    const vehicleReq = request as any;
    if (dateNeeded) vehicleReq.dateNeeded = dateNeeded;
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

app.put("/api/liquidation-submissions/:id/resubmit", authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const {
    totalSpent, remarks, supportingDocs, particulars,
    periodCoveredFrom, periodCoveredTo, responsibilityCenterCode,
    cashAdvanceDvNo, cashAdvanceDvDate, refundOrNo, refundOrDate
  } = req.body;

  const sub = db.liquidationSubmissions.find(l => l.id === id);
  if (!sub) {
    return res.status(404).json({ status: "error", message: "Submission records not found" });
  }

  if (sub.employeeId !== req.user.employeeId && (req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Forbidden: You cannot resubmit this report details." });
  }

  const lines = normalizeParticulars(particulars);
  if (lines && lines.error) {
    return res.status(400).json({ status: "error", message: lines.error });
  }

  // Update details. An itemised correction recomputes the total from its lines; a
  // submission that was never itemised keeps accepting a plain typed figure.
  if (lines) sub.particulars = lines.particulars;
  sub.totalSpent = lines ? lines.total : round2(Number(totalSpent || 0));
  sub.remainingBalance = round2(sub.totalReleased - sub.totalSpent);
  sub.remarks = remarks || sub.remarks;

  // A correction can turn a settled report into a claim, or the reverse. Never downgrade
  // one already paid — that would silently reopen money the office has handed over.
  if (sub.reimbursementStatus !== "Reimbursed") {
    sub.reimbursementAmount = round2(Math.max(0, sub.totalSpent - sub.totalReleased));
    sub.reimbursementStatus = sub.totalSpent > sub.totalReleased ? "Awaiting Reimbursement" : "Not Required";
  }

  // Header fields are only overwritten when the correction actually supplies them.
  if (periodCoveredFrom !== undefined) sub.periodCoveredFrom = periodCoveredFrom;
  if (periodCoveredTo !== undefined) sub.periodCoveredTo = periodCoveredTo;
  if (responsibilityCenterCode !== undefined) sub.responsibilityCenterCode = responsibilityCenterCode;
  if (cashAdvanceDvNo !== undefined) sub.cashAdvanceDvNo = cashAdvanceDvNo;
  if (cashAdvanceDvDate !== undefined) sub.cashAdvanceDvDate = cashAdvanceDvDate;
  if (refundOrNo !== undefined) sub.refundOrNo = refundOrNo;
  if (refundOrDate !== undefined) sub.refundOrDate = refundOrDate;
  if (!sub.serialNo) sub.serialNo = nextLiquidationSerialNo(new Date());
  if (!sub.entityName) sub.entityName = LR_ENTITY_NAME;
  if (!sub.fundCluster) sub.fundCluster = LR_FUND_CLUSTER;
  
  if (supportingDocs && supportingDocs.length > 0) {
    // Append unique documents to keep version history
    const uniqueDocs = [...sub.supportingDocs];
    for (const d of supportingDocs) {
      if (!uniqueDocs.some(existing => existing.name === d.name)) {
        uniqueDocs.push(d);
      }
    }
    sub.supportingDocs = uniqueDocs;
  }

  // Revert statuses for workflow loop re-execution
  sub.status = "Pending HR Review";
  sub.hrStatus = "Pending Review";
  sub.financeStatus = "Pending Validation";
  sub.divisionChiefStatus = "Pending Chief Approval";

  if (!db.notifications) db.notifications = [];
  db.notifications.push({
    id: `notif-${Date.now()}`,
    title: "Liquidation Report Resubmitted",
    message: `${(req as any).user.fullName} corrected and resubmitted liquidation report ${sub.submissionNo}.`,
    isRead: false,
    type: "info",
    timestamp: new Date().toISOString(),
    targetRole: UserRole.HR_OFFICER
  });

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Resubmit Liquidation", `Resubmitted liquidation report: ${sub.submissionNo}`);
  saveDB();
  res.json({ status: "success", data: sub });
});

app.put("/api/liquidation-submissions/:id/hr-action", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Access Restricted to HR Officer verification" });
  }
  const { id } = req.params;
  const { action, remarks } = req.body; // action: "Verify" | "Return"

  const sub = db.liquidationSubmissions.find(l => l.id === id);
  if (!sub) return res.status(404).json({ status: "error", message: "Submission records not found" });

  if (action === "Verify") {
    sub.hrStatus = "Verified & Forwarded";
    sub.hrRemarks = remarks || "Relationship confirmed between employee, activity, and budget line.";
    sub.hrVerifiedBy = (req as any).user.fullName;
    sub.hrVerifiedAt = new Date().toISOString();
    sub.status = "Verified & Forwarded";
    
    if (!db.notifications) db.notifications = [];
    db.notifications.push({
      id: `notif-${Date.now()}`,
      title: "HR Verification Completed",
      message: `Liquidation submission ${sub.submissionNo} verified by HR & forwarded to Finance.`,
      isRead: false,
      type: "success",
      timestamp: new Date().toISOString(),
      targetRole: UserRole.FINANCE_OFFICER
    });
  } else {
    sub.hrStatus = "Returned by HR";
    sub.hrRemarks = remarks || "Assigned activity/employee mismatch; returned for revision.";
    sub.status = "Returned";
    
    if (!db.notifications) db.notifications = [];
    db.notifications.push({
      id: `notif-${Date.now()}`,
      title: "Liquidation Submission Returned",
      message: `Your liquidation report ${sub.submissionNo} was returned by HR: ${remarks}`,
      isRead: false,
      type: "warning",
      timestamp: new Date().toISOString(),
      targetRole: UserRole.EMPLOYEE,
      targetEmployeeId: sub.employeeId
    });
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "HR Verify Liquidation", `HR evaluated liquidation ${sub.submissionNo} with action ${action}`);
  saveDB();
  res.json({ status: "success", data: sub });
});

app.put("/api/liquidation-submissions/:id/finance-action", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.FINANCE_OFFICER) {
    return res.status(403).json({ status: "error", message: "Access restricted to Financial Officer validations" });
  }

  const { id } = req.params;
  const { action, remarks } = req.body; // action: "Validate" | "Return"

  const sub = db.liquidationSubmissions.find(l => l.id === id);
  if (!sub) return res.status(404).json({ status: "error", message: "Submission records not found" });

  if (action === "Validate") {
    sub.financeStatus = "Validated & Approved";
    sub.financeRemarks = remarks || "Financial documentations, vouchers, and ledger matching validated and finalized.";
    sub.financeValidatedBy = (req as any).user.fullName;
    sub.financeValidatedAt = new Date().toISOString();
    
    // HSAC RAB 1 delegates box B of the COA Liquidation Report ("Head of Agency /
    // Authorized Representative") to the Financial Officer. This is a documented business
    // rule from the stakeholder interview — the Chief's approval is not skipped, it is
    // signed by the authorised representative the form itself provides for. Record who
    // certified it: box B is a signature line, and "System" cannot sign one.
    sub.divisionChiefStatus = "Certified by Authorized Representative";
    sub.divisionChiefRemarks = "Certified by the Financial Officer under delegated authority.";
    sub.divisionChiefApprovedBy = (req as any).user.fullName;
    sub.divisionChiefApprovedAt = new Date().toISOString();
    sub.status = "Completed";

    // Check if it's a training participant
    const tPart = db.trainingParticipants.find(p => p.id === sub.activityId);
    if (tPart) {
      tPart.status = "Liquidated";
      // Mirror the approved report into the training ledger. An itemised report copies
      // one row per PARTICULARS line so HR's breakdown shows what was actually bought;
      // a report with no line items still collapses to a single row, as before.
      const dateIncurred = new Date().toISOString().split("T")[0];
      const ledgerLines = (sub.particulars && sub.particulars.length > 0)
        ? sub.particulars.map((p: any) => ({
            description: p.description,
            amount: p.amount,
            category: TRAINING_EXPENSE_CATEGORIES.includes(p.category) ? p.category : "Miscellaneous"
          }))
        : [{ description: sub.remarks || "Employee submitted liquidation", amount: sub.totalSpent, category: "Miscellaneous" }];

      ledgerLines.forEach((line: any, i: number) => {
        db.trainingLiquidations.push({
          id: `tliq-${Date.now()}-${i}`,
          trainingProgramId: tPart.trainingProgramId,
          trainingParticipantId: tPart.id,
          employeeId: sub.employeeId,
          expenseCategory: line.category,
          description: line.description,
          amount: line.amount,
          dateIncurred,
          submittedBy: sub.employeeId,
          status: "Approved"
        });
      });
      
      // Update the usedBudget in trainingPrograms
      const prog = db.trainingPrograms.find(p => p.id === tPart.trainingProgramId);
      if (prog) {
        prog.usedBudget = (prog.usedBudget || 0) + sub.totalSpent;
      }
    }

    const act = db.activities.find(a => a.id === sub.activityId);

    // Automatic categorised deduction on completion. Wrapped so a budget problem
    // can never block the validation response; manual "Establish Integration
    // Link" remains available as a fallback for anything skipped here.
    try {
      autoDeductLiquidation(sub, {
        id: (req as any).user.id,
        username: (req as any).user.username,
        role: (req as any).user.role
      });
    } catch (error) {
      console.error("Auto budget deduction failed for", sub.submissionNo, error);
    }

    db.financialTransactions.push({
      id: `tx-${Date.now()}`,
      transactionId: `TX-LIQ-${Date.now().toString().slice(-4)}`,
      transactionDate: new Date().toISOString().split("T")[0],
      supplier: "Regional Expenses",
      amount: sub.totalSpent,
      description: `Official travel liquidation for activity: ${act ? act.title : sub.submissionNo}`,
      status: TransactionStatus.LIQUIDATED,
      supportingDocuments: sub.supportingDocs.map((d: any) => ({
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

    if (!db.notifications) db.notifications = [];
    const owed = Number(sub.reimbursementAmount || 0);
    const claimPending = owed > 0 && sub.reimbursementStatus !== "Reimbursed";

    db.notifications.push({
      id: `notif-${Date.now()}`,
      title: "Liquidation APPROVED & FINALIZED",
      message: claimPending
        ? `Your liquidation report ${sub.submissionNo} has been validated. You spent ₱${owed.toFixed(2)} of your own money — Finance will reimburse you.`
        : `Your liquidation report ${sub.submissionNo} has been validated and finalized by Finance.`,
      isRead: false,
      type: "success",
      timestamp: new Date().toISOString(),
      targetRole: UserRole.EMPLOYEE,
      targetEmployeeId: sub.employeeId
    });

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

    // The claimant is out of pocket until someone actually releases the money, so put it
    // in front of Finance rather than quietly closing the record.
    if (claimPending) {
      db.notifications.push({
        id: `notif-${Date.now()}-reimb`,
        title: "Reimbursement due",
        message: `${sub.employeeName} is owed ₱${owed.toFixed(2)} for ${sub.submissionNo}. Record the payment once the DV is released.`,
        isRead: false,
        type: "warning",
        timestamp: new Date().toISOString(),
        targetRole: UserRole.FINANCE_OFFICER
      });
    }
  } else {
    sub.financeStatus = "Returned by Finance";
    sub.financeRemarks = remarks || "Receipt vouchers incomplete; returned for clarification.";
    sub.status = "Returned";

    if (!db.notifications) db.notifications = [];
    db.notifications.push({
      id: `notif-${Date.now()}`,
      title: "Liquidation Submission Returned (Finance)",
      message: `Your liquidation report ${sub.submissionNo} was returned by Finance: ${remarks}`,
      isRead: false,
      type: "warning",
      timestamp: new Date().toISOString(),
      targetRole: UserRole.EMPLOYEE,
      targetEmployeeId: sub.employeeId
    });
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Finance Validate Liquidation", `Finance evaluated liquidation ${sub.submissionNo} with action ${action}`);
  saveDB();
  res.json({ status: "success", data: sub });
});

// Closes the loop on an out-of-pocket claim: the employee fronted the money, and this
// records the disbursement voucher that paid them back. Until this runs, the claimant is
// still owed — which is why finance-action leaves the report "Awaiting Reimbursement"
// instead of treating validation as the end of the story.
app.put("/api/liquidation-submissions/:id/record-reimbursement", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.FINANCE_OFFICER && (req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only the Financial Officer can record a reimbursement." });
  }

  const { dvNo, date } = req.body;
  const sub = db.liquidationSubmissions.find(l => l.id === req.params.id);
  if (!sub) return res.status(404).json({ status: "error", message: "Submission records not found" });

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
  if (!String(dvNo || "").trim() || !isIsoDate(date)) {
    return res.status(400).json({ status: "error", message: "A disbursement voucher number and a payment date are required." });
  }

  sub.reimbursementStatus = "Reimbursed";
  sub.reimbursementDvNo = String(dvNo).trim();
  sub.reimbursementDate = date;
  sub.reimbursedBy = (req as any).user.fullName;

  notifyEmployee(sub.employeeId, {
    title: "Reimbursement released",
    message: `₱${owed.toFixed(2)} for ${sub.submissionNo} was released on DV ${sub.reimbursementDvNo} dated ${formatLongDate(sub.reimbursementDate)}.`,
    type: "success",
    dedupeKey: `reimbursed:${sub.id}`
  });

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Record Reimbursement",
    `Reimbursed PHP ${owed.toFixed(2)} to ${sub.employeeName} for ${sub.submissionNo} via DV ${sub.reimbursementDvNo}`);
  saveDB();
  res.json({ status: "success", data: sub });
});
// --- CASH ADVANCES: the money-out record ---

function isCashAdvanceRole(role: UserRole) {
  return role === UserRole.FINANCE_OFFICER || role === UserRole.SUPER_ADMIN;
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

// The advance still open against an assignment, if any. Cancelled and already-liquidated
// ones do not block a fresh release.
function openAdvanceFor(activityId: string, employeeForms: string[]) {
  return (db.cashAdvances || []).find((a: any) =>
    a.activityId === activityId && employeeForms.includes(a.employeeId) && a.status === "Released");
}

app.get("/api/cash-advances", authenticateToken, (req: any, res) => {
  const { role, employeeId } = req.user;
  const all = db.cashAdvances || [];
  if (isCashAdvanceRole(role)) {
    return res.json({ status: "success", data: all });
  }
  // Everyone else sees only their own, so the employee's liquidation form can fill and
  // lock its DV fields from the real record.
  const forms = employeeIdForms(employeeId || "");
  res.json({ status: "success", data: all.filter((a: any) => forms.includes(a.employeeId)) });
});

// Who Finance may release money to, and who has already been funded.
//
// Finance cannot read the HR training tables (isTrainingRecordsRole excludes them), but
// they cannot release a cash advance without knowing who is assigned to what. This returns
// the minimum needed to do that - name, what it is for, HR's allocated ceiling, and the
// funding state - all derived server-side. It is not a window onto the HR module: no
// training needs, recommendations, plan entries or PDS history are exposed.
app.get("/api/cash-advances/fundable", authenticateToken, (req: any, res) => {
  if (!isCashAdvanceRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Cash advances are restricted to the Financial Officer." });
  }

  const rows: any[] = [];
  const advanceFor = (activityId: string, forms: string[]) => {
    const open = openAdvanceFor(activityId, forms);
    if (open) return open;
    return (db.cashAdvances || []).find((a: any) =>
      a.activityId === activityId && forms.includes(a.employeeId) && a.status === "Liquidated") || null;
  };

  for (const p of (db.trainingParticipants || [])) {
    if (p.status === "Cancelled" || p.status === "Archived") continue;
    const emp = (db.employees || []).find((e: any) => e.id === p.employeeId || e.employeeId === p.employeeId);
    if (!emp) continue;
    const facts = liquidationActivityFacts(p.id);
    const forms = employeeIdForms(p.employeeId);
    const advance = advanceFor(p.id, forms);
    rows.push({
      activityId: p.id,
      activityTitle: facts ? facts.title : "Seminar",
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      allocated: facts ? facts.allocated : 0,
      assignmentStatus: p.status,
      funded: !!(advance && advance.status === "Released"),
      advanceNo: advance ? advance.advanceNo : null,
      advanceAmount: advance ? advance.amount : null,
      advanceStatus: advance ? advance.status : null,
      liquidationFiled: (db.liquidationSubmissions || []).some((l: any) => l.activityId === p.id)
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
      advanceStatus: advance ? advance.status : null,
      liquidationFiled: (db.liquidationSubmissions || []).some((l: any) => l.activityId === a.id)
    });
  }

  // Unfunded first - that is the work queue.
  rows.sort((x, y) => Number(x.funded) - Number(y.funded) || String(x.employeeName).localeCompare(String(y.employeeName)));
  res.json({ status: "success", data: rows });
});

app.post("/api/cash-advances", authenticateToken, (req: any, res) => {
  if (!isCashAdvanceRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Only the Financial Officer can release a cash advance." });
  }

  const { activityId, employeeId, amount, dvNo, dvDate, purpose } = req.body;
  if (!activityId || !employeeId) {
    return res.status(400).json({ status: "error", message: "Choose the employee and the assignment this advance funds." });
  }

  const emp = (db.employees || []).find((e: any) => e.id === employeeId || e.employeeId === employeeId);
  if (!emp) return res.status(404).json({ status: "error", message: "Employee not found." });

  const released = round2(Number(amount));
  if (!isFinite(released) || released <= 0) {
    return res.status(400).json({ status: "error", message: "Enter the amount released, greater than zero." });
  }
  if (!String(dvNo || "").trim() || !isIsoDate(dvDate)) {
    return res.status(400).json({ status: "error", message: "A disbursement voucher number and date are required." });
  }

  const facts = liquidationActivityFacts(activityId);
  if (!facts) {
    return res.status(404).json({ status: "error", message: "That assignment no longer exists." });
  }
  // HR's allocation is a ceiling. Releasing more than was set aside has to go back to HR
  // rather than be quietly absorbed here.
  if (facts.allocated > 0 && released > facts.allocated) {
    return res.status(400).json({
      status: "error",
      message: `That exceeds the PHP ${facts.allocated.toFixed(2)} HR allocated. Ask HR to raise the allocation first.`
    });
  }

  const forms = employeeIdForms(emp.employeeId);
  const existing = openAdvanceFor(activityId, forms);
  if (existing) {
    return res.status(400).json({
      status: "error",
      message: `${emp.fullName} already has an open advance for this assignment (${existing.advanceNo}, DV ${existing.dvNo}).`
    });
  }

  const now = new Date();
  const advance = {
    id: `ca-${Date.now()}`,
    advanceNo: nextCashAdvanceNo(now),
    employeeId: emp.employeeId,
    employeeName: emp.fullName,
    activityId,
    activityTitle: facts.title,
    amount: released,
    dvNo: String(dvNo).trim(),
    dvDate,
    purpose: purpose || facts.title,
    issuedBy: (req as any).user.fullName,
    issuedAt: now.toISOString(),
    status: "Released"
  };

  db.cashAdvances.push(advance);

  notifyEmployee(emp.employeeId, {
    title: "Cash advance released",
    message: `PHP ${released.toFixed(2)} was released to you on DV ${advance.dvNo} dated ${formatLongDate(dvDate)} for ${facts.title}. Liquidate it within ${LIQUIDATION_DUE_DAYS} days of the activity.`,
    type: "info",
    dedupeKey: `ca-released:${advance.id}`
  });

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Release Cash Advance",
    `Released PHP ${released.toFixed(2)} to ${emp.fullName} for ${facts.title} via DV ${advance.dvNo} (${advance.advanceNo})`);
  saveDB();
  res.json({ status: "success", data: advance });
});

app.put("/api/liquidation-submissions/:id/chief-action", authenticateToken, (req: any, res) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ status: "error", message: "Only Division Chief can give the final seal" });
  }
  const { id } = req.params;
  const { action, remarks } = req.body; // action: "Approve" | "Reject" | "Return"

  const sub = db.liquidationSubmissions.find(l => l.id === id);
  if (!sub) return res.status(404).json({ status: "error", message: "Submission records not found" });

  if (action === "Approve") {
    sub.divisionChiefStatus = "Approved";
    sub.divisionChiefRemarks = remarks || "Final liquidation approved. Record is finalized.";
    sub.divisionChiefApprovedBy = (req as any).user.fullName;
    sub.divisionChiefApprovedAt = new Date().toISOString();
    sub.status = "Approved";

    const act = db.activities.find(a => a.id === sub.activityId);

    // Same automatic deduction as the Finance path. The idempotency guard inside
    // autoDeductLiquidation makes running both harmless.
    try {
      autoDeductLiquidation(sub, {
        id: (req as any).user.id,
        username: (req as any).user.username,
        role: (req as any).user.role
      });
    } catch (error) {
      console.error("Auto budget deduction failed for", sub.submissionNo, error);
    }

    db.financialTransactions.push({
      id: `tx-${Date.now()}`,
      transactionId: `TX-LIQ-${Date.now().toString().slice(-4)}`,
      transactionDate: new Date().toISOString().split("T")[0],
      supplier: "Regional Expenses",
      amount: sub.totalSpent,
      description: `Official travel liquidation for activity: ${act ? act.title : sub.submissionNo}`,
      status: TransactionStatus.LIQUIDATED,
      supportingDocuments: sub.supportingDocs.map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        filename: d.filename,
        uploadedAt: d.uploadedAt,
        validationStatus: "Validated"
      })),
      history: [
        { id: `his-${Date.now()}`, status: TransactionStatus.LIQUIDATED, changedBy: (req as any).user.fullName, changedAt: new Date().toISOString(), remarks: "Approved and finalized from Employee Liquidation submission" }
      ],
      employeeRef: sub.employeeId,
      department: "Administrative and Finance Division",
      category: "Travel",
      createdBy: sub.employeeName,
      dateCreated: new Date().toISOString()
    });

    if (!db.notifications) db.notifications = [];
    db.notifications.push({
      id: `notif-${Date.now()}`,
      title: "Liquidation APPROVED",
      message: `Your liquidation report ${sub.submissionNo} has received the final approved seal from Division Chief Hon. Romeo M. Alcantara!`,
      isRead: false,
      type: "success",
      timestamp: new Date().toISOString(),
      targetRole: UserRole.EMPLOYEE,
      targetEmployeeId: sub.employeeId
    });
  } else if (action === "Return") {
    sub.divisionChiefStatus = "Returned by Chief";
    sub.divisionChiefRemarks = remarks || "Returned for revisions by Division Chief.";
    sub.status = "Returned";

    if (!db.notifications) db.notifications = [];
    db.notifications.push({
      id: `notif-${Date.now()}`,
      title: "Liquidation Submission Returned by Division Chief",
      message: `Your liquidation report ${sub.submissionNo} was returned for adjustments by Division Chief: ${remarks}`,
      isRead: false,
      type: "warning",
      timestamp: new Date().toISOString(),
      targetRole: UserRole.EMPLOYEE,
      targetEmployeeId: sub.employeeId
    });
  } else {
    sub.divisionChiefStatus = "Rejected";
    sub.divisionChiefRemarks = remarks || "Disapproved by Division Chief.";
    sub.status = "Rejected";

    if (!db.notifications) db.notifications = [];
    db.notifications.push({
      id: `notif-${Date.now()}`,
      title: "Liquidation Submission REJECTED",
      message: `Your liquidation report ${sub.submissionNo} was Rejected by Division Chief: ${remarks}`,
      isRead: false,
      type: "urgent",
      timestamp: new Date().toISOString(),
      targetRole: UserRole.EMPLOYEE,
      targetEmployeeId: sub.employeeId
    });
  }

  logEvent((req as any).user.id, (req as any).user.username, (req as any).user.role, "Chief Final Liquidation Seal", `Chief evaluated liquidation ${sub.submissionNo} with action ${action}`);
  saveDB();
  res.json({ status: "success", data: sub });
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

function employeeAlreadyHasTrainingThisYear(employeeId: string, fiscalYear: string): boolean {
  if (!db.trainingParticipants) return false;
  const forms = employeeIdForms(employeeId);
  return db.trainingParticipants.some(p => {
    if (!forms.includes(p.employeeId)) return false;
    if (p.status === "Cancelled") return false;

    const prog = (db.trainingPrograms || []).find(tp => tp.id === p.trainingProgramId);
    return prog && prog.fiscalYear === fiscalYear;
  });
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

// Which of this employee's own Plan A entries the seminar covers.
function employeeNeedMatches(employeeId: string, program: SeminarRef): string[] {
  const covered = (program.fulfillsNeedTitles || []).map(normalizeTitle).filter(Boolean);
  if (covered.length === 0) return [];
  const forms = employeeIdForms(employeeId);
  return (db.trainingNeeds || [])
    .filter(n => forms.includes(n.employeeId) && n.fiscalYear === program.fiscalYear && covered.includes(normalizeTitle(n.title)))
    .map(n => n.title);
}

// "Today" as a calendar date in the Philippines (UTC+8, no DST), so deadlines flip
// at local midnight instead of 8 AM.
function manilaToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

function normalizeTitle(title: string | undefined): string {
  return (title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
    if (!forms.includes(p.employeeId) || p.status === "Cancelled") continue;
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

function otherTrainingThisYear(employeeId: string, fiscalYear: string, excludeProgramId?: string): TrainingProgram | null {
  const forms = employeeIdForms(employeeId);
  for (const p of db.trainingParticipants || []) {
    if (!forms.includes(p.employeeId) || p.status === "Cancelled") continue;
    if (excludeProgramId && p.trainingProgramId === excludeProgramId) continue;
    const prog = (db.trainingPrograms || []).find(tp => tp.id === p.trainingProgramId);
    if (prog && prog.fiscalYear === fiscalYear) return prog;
  }
  return null;
}

// Why this employee cannot be enrolled in the program, or null when they can.
// The recommender and every enrolment route share this, so the UI can never offer
// someone the server would refuse.
function trainingEnrollmentBlock(employeeId: string, program: SeminarRef): { rule: "attended" | "annual"; reason: string } | null {
  const attended = employeeAttendedSeminarBefore(employeeId, program);
  if (attended) return { rule: "attended", reason: attended };
  const other = otherTrainingThisYear(employeeId, program.fiscalYear, program.id);
  if (other) return { rule: "annual", reason: `Already assigned to "${other.title}" for FY ${program.fiscalYear}` };
  return null;
}

function monthsSinceHire(emp: Employee, today: string): number | null {
  if (!isIsoDate(emp.dateHired)) return null;
  const [hy, hm, hd] = emp.dateHired.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return (ty - hy) * 12 + (tm - hm) - (td < hd ? 1 : 0);
}

function hasTdpHistory(employeeId: string, excludeProgramId?: string): boolean {
  const forms = employeeIdForms(employeeId);
  return (db.trainingParticipants || []).some(p =>
    forms.includes(p.employeeId) && p.status !== "Cancelled" && p.trainingProgramId !== excludeProgramId);
}

function matchesSeminarTarget(emp: Employee, program: SeminarRef): boolean {
  if (program.targetDivision && emp.division === program.targetDivision) return true;
  const spec = normalizeTitle(program.targetSpecialization);
  return spec !== "" && normalizeTitle(emp.fieldOfSpecialization).includes(spec);
}

// Scores every employee for a seminar. Priority 1 = new hires, 2 = never attended a
// TDP seminar, 3 = everyone else; ineligible employees sort last with their reason.
function rankTrainingCandidates(program: SeminarRef): { candidates: TrainingCandidate[]; recommendedIds: string[] } {
  const today = manilaToday();
  const candidates: TrainingCandidate[] = (db.employees || [])
    .filter(emp => emp.isActive !== false)
    .map(emp => {
      const block = trainingEnrollmentBlock(emp.id, program);
      const months = monthsSinceHire(emp, today);
      const newHire = months !== null && months >= 0 && months < NEW_HIRE_MONTHS;
      const history = hasTdpHistory(emp.id, program.id);
      const priority: 1 | 2 | 3 = newHire ? 1 : !history ? 2 : 3;
      const needMatches = employeeNeedMatches(emp.id, program);
      return {
        needsThis: needMatches.length > 0,
        needMatches,
        employeeId: emp.id,
        fullName: emp.fullName,
        position: emp.position || "",
        division: emp.division || "",
        dateHired: emp.dateHired || "",
        priority,
        priorityLabel: priority === 1 ? "New hire" : priority === 2 ? "No TDP history yet" : "Attended other TDP seminars",
        monthsSinceHire: months,
        hasTdpHistory: history,
        matchesTarget: matchesSeminarTarget(emp, program),
        eligible: !block,
        ineligibleReason: block?.reason
      };
    });

  // The plan listing this training is the strongest reason for a seat, so it
  // outranks the new-hire preference — which still decides among those who need it.
  candidates.sort((a, b) =>
    Number(b.eligible) - Number(a.eligible) ||
    Number(b.needsThis) - Number(a.needsThis) ||
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

// Plan D: did this employee already take the training they were listed as needing?
function needAccomplishment(need: TrainingNeed, asOf: string): TrainingNeedStatus {
  if (typeof need.accomplishedOverride === "boolean") {
    return { accomplished: need.accomplishedOverride, source: "override" };
  }
  const forms = employeeIdForms(need.employeeId);
  const needKey = normalizeTitle(need.title);

  // 1. A seminar HR explicitly linked to this need — exact, no title guessing.
  for (const p of db.trainingParticipants || []) {
    if (!forms.includes(p.employeeId)) continue;
    if (p.status !== "Liquidated" && p.status !== "Liquidation Pending" && p.status !== "Completed") continue;
    const prog = (db.trainingPrograms || []).find(tp => tp.id === p.trainingProgramId);
    if (!prog || !(prog.fulfillsNeedTitles || []).some(t => normalizeTitle(t) === needKey)) continue;
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
    if (p.status !== "Liquidated" && p.status !== "Liquidation Pending" && p.status !== "Completed") continue;
    const prog = (db.trainingPrograms || []).find(tp => tp.id === p.trainingProgramId);
    if (!prog || !titlesMatch(need.title, prog.title)) continue;
    const when = toIsoDateLoose(prog.endDate);
    if (!onOrBeforeAsOf(when, asOf)) continue;
    return { accomplished: true, source: "seminar", evidence: `${prog.title} (FY ${prog.fiscalYear})`, date: when || undefined };
  }

  // 3. HR's certificate-backed training ledger.
  for (const t of db.trainings || []) {
    if (!forms.includes(t.employeeId) || t.status === "Rejected") continue;
    if (!titlesMatch(need.title, t.title)) continue;
    const when = toIsoDateLoose(t.dateConducted);
    if (!onOrBeforeAsOf(when, asOf)) continue;
    return { accomplished: true, source: "recorded-training", evidence: t.title, date: when || undefined };
  }

  // 4. The L&D history parsed from the uploaded PDS (those rows key on the business id).
  const pdsRecord: any = (db.pds || []).find((r: any) => forms.includes(r.employeeId));
  for (const t of (pdsRecord?.trainings || [])) {
    if (!titlesMatch(need.title, t?.title || "")) continue;
    const when = toIsoDateLoose(t?.dateTo || t?.dateFrom);
    if (!onOrBeforeAsOf(when, asOf)) continue;
    return { accomplished: true, source: "pds", evidence: t.title, date: when || undefined };
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

  for (const emp of (db.employees || []).filter(e => e.isActive !== false)) {
    const forms = [emp.id, emp.employeeId].filter(Boolean);
    const needs = { "Function": [], "Additional Function": [], "Career Advancement": [] } as Record<TrainingNeedCategory, TrainingNeedRow[]>;
    for (const n of db.trainingNeeds || []) {
      if (n.fiscalYear !== fiscalYear || !forms.includes(n.employeeId)) continue;
      if (!needs[n.category]) continue;
      needs[n.category].push({ ...n, status: needAccomplishment(n, asOf) });
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

  return [...byOffice.entries()]
    .map(([office, employees]) => ({ office, employees: employees.sort((a, b) => a.fullName.localeCompare(b.fullName)) }))
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
  transporter.sendMail({
    from: '"IntegraSync HR" <' + process.env.SMTP_USER + '>',
    to,
    subject,
    text
  }).catch(err => console.error(`Failed to send notice email to ${to}:`, err));
}

// Bell notice (plus email) for one employee. Returns false when a notice with the
// same dedupeKey already exists. Callers are responsible for saveDB().
function notifyEmployee(employeeKey: string, notice: { title: string; message: string; type: Notification["type"]; dedupeKey?: string }): boolean {
  const emp = (db.employees || []).find(e => e.id === employeeKey || e.employeeId === employeeKey);
  if (!emp) return false;
  if (!db.notifications) db.notifications = [];
  if (notice.dedupeKey && db.notifications.some(n => n.dedupeKey === notice.dedupeKey)) return false;
  db.notifications.push({
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    title: notice.title,
    message: notice.message,
    type: notice.type,
    isRead: false,
    timestamp: new Date().toISOString(),
    targetRole: UserRole.EMPLOYEE,
    // GET /api/notifications compares this with the login's employeeId, which is
    // the business form ("EMP001"), not Employee.id ("emp-...").
    targetEmployeeId: emp.employeeId,
    dedupeKey: notice.dedupeKey
  });
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
    dedupeKey: `assign:${participant.id}`
  });
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
    const emp = (db.employees || []).find(e => e.id === rawId || e.employeeId === rawId);
    if (!emp) {
      skipped.push(`${rawId} skipped: employee record not found.`);
      continue;
    }
    if (seen.has(emp.id)) continue;
    seen.add(emp.id);

    const alreadyInProgram = (db.trainingParticipants || []).some(p =>
      p.trainingProgramId === program.id && p.status !== "Cancelled" && (p.employeeId === emp.id || p.employeeId === emp.employeeId));
    if (alreadyInProgram) {
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
        block.rule === "attended" ? "Training Enrollment Blocked - Previously Attended" : "Training Enrollment Blocked - Annual Limit",
        `${emp.fullName} was not enrolled in "${program.title}": ${block.reason}.`
      );
      continue;
    }

    const participant: TrainingParticipant = {
      id: `part-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      trainingProgramId: program.id,
      employeeId: emp.id,
      status: "Assigned",
      allowanceAllocated: participantAllowance(program)
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
      const prog = (db.trainingPrograms || []).find(tp => tp.id === p.trainingProgramId);
      const due = liquidationDueDateFor(prog);
      if (!prog || !due) continue;

      const daysLeft = daysBetween(today, due);
      const stage = daysLeft < 0 ? "overdue" : daysLeft === 0 ? "due-today" : daysLeft <= 3 ? "due-soon" : null;
      if (!stage) continue;

      const dueText = formatLongDate(due);
      const notice =
        stage === "overdue" ? {
          title: `Liquidation overdue: ${prog.title}`,
          message: `Your liquidation for "${prog.title}" was due on ${dueText}. Please submit it as soon as possible.`,
          type: "urgent" as const
        } : stage === "due-today" ? {
          title: `Liquidation due today: ${prog.title}`,
          message: `Your liquidation for "${prog.title}" is due today, ${dueText}.`,
          type: "warning" as const
        } : {
          title: `Liquidation due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}: ${prog.title}`,
          message: `Your liquidation for "${prog.title}" is due on ${dueText}.`,
          type: "warning" as const
        };
      if (notifyEmployee(p.employeeId, { ...notice, dedupeKey: `liq-due:${p.id}:${stage}` })) sent++;
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
function canAccessEmployeeTrainingRecords(user: any, employeeForms: string[]): boolean {
  if (isTrainingRecordsRole(user.role)) return true;
  return user.role === UserRole.EMPLOYEE && !!user.employeeId && employeeForms.includes(user.employeeId);
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

    // Rule B check — already has a training this fiscal year?
    const alreadyAssigned = employeeAlreadyHasTrainingThisYear(employee.id, activeFy.label);

    if (alreadyAssigned) {
      logEvent(
        "system", "System", "System",
        "Training Enrollment Blocked - Annual Limit",
        `Employee ${employee.fullName} was not auto-enrolled because they already have a training program for ${activeFy.label}.`
      );
      return null;
    }

    const candidates = (db.trainingPrograms || []).filter(p =>
      p.fiscalYear === activeFy.label &&
      ((p.targetDivision && p.targetDivision === employee.division) ||
       (p.targetSpecialization && p.targetSpecialization === employee.fieldOfSpecialization)) &&
      !employeeAttendedSeminarBefore(employee.id, p)
    );
    if (candidates.length === 0) return null;

    const withOpenSeats = candidates.filter(p => {
      const count = (db.trainingParticipants || []).filter(pt => pt.trainingProgramId === p.id).length;
      return count < (p.maxParticipants || Infinity);
    });

    if (withOpenSeats.length === 0) {
      // Programs are at capacity - create notification for HR
      const missedProgram = candidates[0];
      const notif: Notification = {
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: "Training Program at Capacity",
        message: `New employee ${employee.fullName} matched training program "${missedProgram.title}" but it is at capacity. Please review manually.`,
        type: "warning",
        isRead: false,
        timestamp: new Date().toISOString(),
        targetRole: UserRole.HR_OFFICER
      };
      if (!db.notifications) db.notifications = [];
      db.notifications.push(notif);
      return null;
    }

    // 1. Specialization match beats division-only match.
    // 2. If tied, pick earliest startDate
    withOpenSeats.sort((a, b) => {
      const aSpec = a.targetSpecialization === employee.fieldOfSpecialization ? 0 : 1;
      const bSpec = b.targetSpecialization === employee.fieldOfSpecialization ? 0 : 1;
      if (aSpec !== bSpec) return aSpec - bSpec;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    const chosen = withOpenSeats[0];
    const part: TrainingParticipant = {
      id: `part-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      trainingProgramId: chosen.id,
      employeeId: employee.id,
      status: "Assigned",
      allowanceAllocated: participantAllowance(chosen)
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
function computeTrainingUsage(fiscalYearId: string) {
  const fy = (db.fiscalYears || []).find((f: any) => f.id === fiscalYearId);
  const tb = (db.trainingBudgets || []).find((b: any) => b.fiscalYearId === fiscalYearId);
  const totalBudget = Number(tb?.totalBudget || 0);
  const programs = (db.trainingPrograms || []).filter((p: any) => fy && p.fiscalYear === fy.label);
  const allocated = programs.reduce((s: number, p: any) => s + Number(p.allocatedBudget || 0), 0);
  const spent = programs.reduce((s: number, p: any) => s + Number(p.usedBudget || 0), 0);
  return {
    totalBudget,
    allocated,
    spent,
    unallocated: totalBudget - allocated,
    percentAllocated: totalBudget > 0 ? Math.round((allocated / totalBudget) * 100) : 0,
    percentSpent: totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0,
    programCount: programs.length
  };
}

// Server-side ceiling check for training allocations. Returns null when the amount
// fits, or the offending figures when it does not. When editing an existing program
// its current allocation is excluded so re-saving an unchanged row never trips.
function trainingAllocationExceeds(fyLabel: string, newAmount: number, excludeProgramId?: string) {
  const fy = (db.fiscalYears || []).find((f: any) => f.label === fyLabel);
  if (!fy) return null;
  const usage = computeTrainingUsage(fy.id);
  const current = excludeProgramId
    ? usage.allocated - Number((db.trainingPrograms || []).find((p: any) => p.id === excludeProgramId)?.allocatedBudget || 0)
    : usage.allocated;
  const projected = current + Number(newAmount || 0);
  return projected > usage.totalBudget ? { projected, totalBudget: usage.totalBudget } : null;
}

app.get("/api/training/budgets", authenticateToken, (req: any, res: any) => {
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
    budget.totalBudget = (budget.carryOverBudget || 0) + annualAmount;
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
  res.json({ status: "success", data: db.trainingPrograms || [] });
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
  res.json({ status: "success", data: rankTrainingCandidates(program) });
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

  const data: TrainingNeedCatalogItem[] = [...byTitle.values()]
    .map(e => ({ title: e.title, employeeCount: e.employees.size, categories: [...e.categories] }))
    .sort((a, b) => b.employeeCount - a.employeeCount || a.title.localeCompare(b.title));

  res.json({ status: "success", data: { fiscalYear, needs: data } });
});

// Plan A (needs) and Plan D (the same needs, checked off as of a date).
app.get("/api/training/needs", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const fiscalYear = (typeof req.query.fiscalYear === "string" && req.query.fiscalYear) || activeFiscalYearLabel();
  const asOf = toIsoDateLoose(req.query.asOf) || manilaToday();
  res.json({ status: "success", data: { fiscalYear, asOf, offices: buildTrainingPlan(fiscalYear, asOf) } });
});

app.post("/api/training/needs", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const { employeeId, category, title } = req.body || {};
  const fiscalYear = req.body?.fiscalYear || activeFiscalYearLabel();

  const emp = (db.employees || []).find(e => e.id === employeeId || e.employeeId === employeeId);
  if (!emp) return res.status(404).json({ status: "error", message: "Employee not found." });
  if (!TRAINING_NEED_CATEGORIES.includes(category)) {
    return res.status(400).json({ status: "error", message: "Category must be Function, Additional Function or Career Advancement." });
  }
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) return res.status(400).json({ status: "error", message: "Enter the needed training." });
  if (cleanTitle.length > 300) return res.status(400).json({ status: "error", message: "Keep the needed training under 300 characters." });

  const duplicate = (db.trainingNeeds || []).some(n =>
    n.fiscalYear === fiscalYear && n.category === category &&
    employeeIdForms(n.employeeId).includes(emp.id) &&
    normalizeTitle(n.title) === normalizeTitle(cleanTitle));
  if (duplicate) {
    return res.status(400).json({ status: "error", message: `"${cleanTitle}" is already listed for ${emp.fullName} under this column.` });
  }

  const need: TrainingNeed = {
    id: `need-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    employeeId: emp.id,
    fiscalYear,
    category,
    title: cleanTitle,
    createdAt: new Date().toISOString(),
    createdBy: req.user.username
  };
  if (!db.trainingNeeds) db.trainingNeeds = [];
  db.trainingNeeds.push(need);
  logEvent(req.user.id, req.user.username, req.user.role, "Add Training Need",
    `Added "${cleanTitle}" (${category}) for ${emp.fullName} in the ${fiscalYear} Training and Development Plan.`);
  saveDB();
  res.json({ status: "success", data: { ...need, status: needAccomplishment(need, manilaToday()) } });
});

app.put("/api/training/needs/:id", authenticateToken, (req: any, res: any) => {
  if (!requireTrainingPlanRole(req, res)) return;
  const need = (db.trainingNeeds || []).find(n => n.id === req.params.id);
  if (!need) return res.status(404).json({ status: "error", message: "Training need not found." });

  const { title, category, remarks, accomplishedOverride } = req.body || {};
  if (title !== undefined) {
    const cleanTitle = String(title).trim();
    if (!cleanTitle) return res.status(400).json({ status: "error", message: "Enter the needed training." });
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
    `Updated "${need.title}" (${need.category}) for ${emp ? emp.fullName : need.employeeId} in the ${need.fiscalYear} plan.`);
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
    `Removed "${removed.title}" (${removed.category}) for ${emp ? emp.fullName : removed.employeeId} from the ${removed.fiscalYear} plan.`);
  saveDB();
  res.json({ status: "success", message: "Training need removed." });
});

app.post("/api/training/programs", authenticateToken, (req: any, res: any) => {
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }
  const body = req.body;

  // The client warns about over-allocation too, but that alert is bypassable —
  // the fiscal year's training ceiling is enforced here so the Budget Officer's
  // monitor can be trusted.
  const overBy = trainingAllocationExceeds(body.fiscalYear, parseFloat(body.allocatedBudget) || 0);
  if (overBy) {
    return res.status(400).json({
      status: "error",
      message: `Total allocated budget (PHP ${overBy.projected.toLocaleString()}) would exceed the ${body.fiscalYear} training budget of PHP ${overBy.totalBudget.toLocaleString()}. Please adjust the allocation.`
    });
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
    title: body.title,
    description: body.description,
    category: body.category,
    allocatedBudget: parseFloat(body.allocatedBudget) || 0,
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
    maxParticipants: parseInt(body.maxParticipants) || 1,
    targetSpecialization: body.targetSpecialization,
    targetDivision: body.targetDivision,
    budgetSplit: normalizeBudgetSplit(body.budgetSplit),
    // Which Plan A entries this seminar answers, ticked by HR from the plan.
    fulfillsNeedTitles: normalizeFulfillsNeedTitles(body.fulfillsNeedTitles),
    createdAt: new Date().toISOString(),
  };

  db.trainingPrograms.push(newProgram);

  let skippedMessages: string[] = [];
  // Manual assignment from UI
  if (Array.isArray(body.participantIds)) {
    skippedMessages = enrollTrainingParticipants(newProgram, body.participantIds, (req as any).user, 0).skipped;
  }

  saveDB();
  res.json({ status: "success", data: newProgram, message: skippedMessages.length > 0 ? skippedMessages.join(" ") : undefined });
});



app.put("/api/training/programs/:id", authenticateToken, (req: any, res: any) => {
  if (req.user.role !== UserRole.SUPER_ADMIN && req.user.role !== UserRole.HR_OFFICER && req.user.role !== "Super Admin" && req.user.role !== "HR Officer") {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }
  const programIndex = (db.trainingPrograms || []).findIndex((p) => p.id === req.params.id);
  if (programIndex === -1) {
    return res.status(404).json({ status: "error", message: "Program not found" });
  }

  const body = req.body;
  const existingProgram = db.trainingPrograms[programIndex];

  // Same ceiling as on create. The program being edited is excluded from the running
  // total so re-saving an unchanged row never trips the check.
  if (body.allocatedBudget !== undefined) {
    const overBy = trainingAllocationExceeds(
      body.fiscalYear || existingProgram.fiscalYear,
      parseFloat(body.allocatedBudget) || 0,
      existingProgram.id
    );
    if (overBy) {
      return res.status(400).json({
        status: "error",
        message: `Total allocated budget (PHP ${overBy.projected.toLocaleString()}) would exceed the ${body.fiscalYear || existingProgram.fiscalYear} training budget of PHP ${overBy.totalBudget.toLocaleString()}. Please adjust the allocation.`
      });
    }
  }

  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const startTime = body.startTime !== undefined ? body.startTime : existingProgram.startTime;
  const endTime = body.endTime !== undefined ? body.endTime : existingProgram.endTime;
  const totalHours = computeTrainingHours(body.startDate, body.endDate, startTime, endTime);

  db.trainingPrograms[programIndex] = {
    ...existingProgram,
    // Backfill for programs saved before series tracking existed.
    seriesId: existingProgram.seriesId || existingProgram.id,
    title: body.title,
    description: body.description,
    category: body.category,
    allocatedBudget: body.allocatedBudget !== undefined ? (parseFloat(body.allocatedBudget) || 0) : existingProgram.allocatedBudget,
    startDate: body.startDate,
    endDate: body.endDate,
    startTime: body.startTime !== undefined ? body.startTime : existingProgram.startTime,
    endTime: body.endTime !== undefined ? body.endTime : existingProgram.endTime,
    durationDays: diffDays,
    totalHours: totalHours,
    venue: body.venue !== undefined ? body.venue : existingProgram.venue,
    facilitator: body.facilitator !== undefined ? body.facilitator : existingProgram.facilitator,
    maxParticipants: body.maxParticipants !== undefined ? (parseInt(body.maxParticipants) || 1) : existingProgram.maxParticipants,
    targetDivision: body.targetDivision !== undefined ? body.targetDivision : existingProgram.targetDivision,
    targetSpecialization: body.targetSpecialization !== undefined ? body.targetSpecialization : existingProgram.targetSpecialization,
    budgetSplit: body.budgetSplit !== undefined ? normalizeBudgetSplit(body.budgetSplit) : normalizeBudgetSplit(existingProgram.budgetSplit),
    fulfillsNeedTitles: body.fulfillsNeedTitles !== undefined
      ? normalizeFulfillsNeedTitles(body.fulfillsNeedTitles)
      : existingProgram.fulfillsNeedTitles
  };

  let skippedMessages: string[] = [];
  // If participantIds are provided, reconcile the roster against them. Existing
  // enrolments are kept rather than deleted and re-created, so participant ids,
  // statuses and liquidation links survive an edit.
  if (Array.isArray(body.participantIds)) {
    const program = db.trainingPrograms[programIndex];
    const requested = new Set<string>();
    for (const rawId of body.participantIds) {
      requested.add(employeeIdForms(rawId)[0]);
    }

    const removedIds = new Set<string>();
    const keptForms = new Set<string>();
    let keptCount = 0;
    for (const p of (db.trainingParticipants || []).filter(p => p.trainingProgramId === program.id)) {
      if (p.status === "Cancelled") continue;
      const forms = employeeIdForms(p.employeeId);
      const stillSelected = forms.some(f => requested.has(f));
      if (!stillSelected && p.status === "Assigned") {
        removedIds.add(p.id);
        continue;
      }
      if (!stillSelected) {
        const emp = (db.employees || []).find(e => forms.includes(e.id));
        skippedMessages.push(`${emp ? emp.fullName : p.employeeId} was kept: their liquidation is already ${p.status === "Liquidated" ? "complete" : "in progress"}.`);
      }
      // Budget or head-count edits re-price only allowances nobody has liquidated yet.
      if (p.status === "Assigned") p.allowanceAllocated = participantAllowance(program);
      forms.forEach(f => keptForms.add(f));
      keptCount++;
    }
    db.trainingParticipants = (db.trainingParticipants || []).filter(p => !removedIds.has(p.id));

    const toAdd = [...requested].filter(id => !employeeIdForms(id).some(f => keptForms.has(f)));
    skippedMessages.push(...enrollTrainingParticipants(program, toAdd, (req as any).user, keptCount).skipped);
  }

  saveDB();
  res.json({ status: "success", data: db.trainingPrograms[programIndex], message: skippedMessages.length > 0 ? skippedMessages.join(" ") : undefined });
});

app.delete("/api/training/programs/:id", authenticateToken, (req: any, res: any) => {
  if (req.user.role !== "Super Admin" && req.user.role !== "HR Officer") {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }
  db.trainingPrograms = (db.trainingPrograms || []).filter(p => p.id !== req.params.id);
  db.trainingParticipants = (db.trainingParticipants || []).filter(p => p.trainingProgramId !== req.params.id);
  db.trainingLiquidations = (db.trainingLiquidations || []).filter(l => l.trainingProgramId !== req.params.id);
  saveDB();
  res.json({ status: "success" });
});

app.post("/api/training/participants/:id/approve_liquidation", authenticateToken, (req: any, res: any) => {
  const { id } = req.params;
  
  if ((req as any).user.role !== UserRole.SUPER_ADMIN && (req as any).user.role !== UserRole.HR_OFFICER) {
    return res.status(403).json({ status: "error", message: "Unauthorized" });
  }

  const pIndex = db.trainingParticipants.findIndex(p => p.id === id);
  if (pIndex !== -1) {
    db.trainingParticipants[pIndex].status = "Liquidated";
    
    // Auto-update the program's used budget based on the participant's allocation (or actual liquidation amount if we were tracking it)
    const progIndex = db.trainingPrograms.findIndex(prog => prog.id === db.trainingParticipants[pIndex].trainingProgramId);
    if (progIndex !== -1) {
      db.trainingPrograms[progIndex].usedBudget += db.trainingParticipants[pIndex].allowanceAllocated || 0;
    }
    
    saveDB();
    res.json({ status: "success", message: "Liquidation approved and recorded in history." });
  } else {
    res.status(404).json({ status: "error", message: "Participant record not found" });
  }
});

app.get("/api/training/participants", authenticateToken, (req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Training program details are restricted to HR." });
  }
  res.json({ status: "success", data: db.trainingParticipants || [] });
});

app.post("/api/training/participants", authenticateToken, (req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Only HR can enroll training participants." });
  }
  const { trainingProgramId, employeeId } = req.body;
  const prog = db.trainingPrograms.find(p => p.id === trainingProgramId);
  if (!prog) return res.status(404).json({ status: "error", message: "Program not found" });
  if (!employeeId) return res.status(400).json({ status: "error", message: "employeeId is required." });

  const enrolledCount = (db.trainingParticipants || []).filter(p => p.trainingProgramId === trainingProgramId && p.status !== "Cancelled").length;
  if (enrolledCount >= (prog.maxParticipants || Infinity)) {
    return res.status(400).json({ status: "error", message: "Program has reached maximum capacity" });
  }

  const { created, skipped } = enrollTrainingParticipants(prog, [employeeId], (req as any).user, enrolledCount);
  if (created.length === 0) {
    return res.status(400).json({ status: "error", message: skipped[0] || "Employee could not be enrolled." });
  }
  saveDB();
  res.json({ status: "success", data: created[0] });
});

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

app.post("/api/training/liquidations", authenticateToken, (req: any, res: any) => {
  if (!isTrainingRecordsRole((req as any).user.role)) {
    return res.status(403).json({ status: "error", message: "Only HR can record training expenses." });
  }
  const { trainingProgramId, trainingParticipantId, expenseCategory, description, amount, receiptFileName, dateIncurred } = req.body;
  const amt = parseFloat(amount);

  const prog = db.trainingPrograms.find(p => p.id === trainingProgramId);
  if (!prog) return res.status(404).json({ status: "error", message: "Program not found" });

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
    status: "Approved" // auto-approved for simplicity, or "Pending" based on flow
  };

  if (prog.usedBudget + amt > prog.allocatedBudget) {
    return res.status(400).json({ status: "error", message: "Liquidation exceeds allocated training budget." });
  }

  prog.usedBudget += amt;
  db.trainingLiquidations.push(liq);
  saveDB();
  res.json({ status: "success", data: liq });
});


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

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
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
    console.error("PDS Parsing error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});


// Handle serving the Vite client in development and compiled files in production
if (process.env.NODE_ENV !== "production") {
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
