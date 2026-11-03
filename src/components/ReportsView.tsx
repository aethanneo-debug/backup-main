import React from "react";
import { Employee, Asset, SupplyItem, AnyRequest, User, UserRole } from "../types";
import {
  FileSpreadsheet,
  Download,
  Database,
  Briefcase,
  Package,
  FileCheck2,
  BadgeAlert
} from "lucide-react";
import { downloadCsvTable, formatDate } from "../utils";
import PlanDReportCard from "./training/planD/PlanDReportCard";
import TrainingReports from "./reports/TrainingReports";

// (A blank value stays blank; a name or a title typed by someone can't start a formula, csvCell.)
function exportCSV(headers: string[], rows: string[][], filename: string) {
  downloadCsvTable([headers, ...rows.map(row => row.map(val => val || ""))], `${filename.replace(".csv", "")}_${new Date().toISOString().split("T")[0]}`);
}

interface ReportsViewProps {
  user: User;
  employees: Employee[];
  assets: Asset[];
  supplies: SupplyItem[];
  requests: AnyRequest[];
}

export default function ReportsView({ user, employees, assets, supplies, requests }: ReportsViewProps) {

  // Plan D is HR's record, and GET /api/training/needs answers only HR and the Admin.
  // Finance and Budget reach this page too, so they don't get a card that can only fail.
  const canExportPlanD = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.HR_OFFICER;

  // Report 1: Regional HR Personnel Master List
  function exportEmployeesCSV() {
    const headers = [
      "Plantilla Number",
      "Full Name",
      "Position/Title",
      "Division",
      "Employment Status",
      "Email Address",
      "Contact Number",
      "Date Hired",
      "Primary Address",
      "Emergency Contact Name",
      "Emergency Contact Phone"
    ];

    const rows = employees.map(emp => [
      emp.plantillaNumber || "N/A – Non-Plantilla",
      emp.fullName,
      emp.position,
      emp.division,
      emp.employmentStatus,
      emp.email,
      emp.contactNumber || "N/A",
      formatDate(emp.dateHired),
      emp.address || "N/A",
      emp.emergencyContactName || "N/A",
      emp.emergencyContactPhone || "N/A"
    ]);

    exportCSV(headers, rows, "HSAC_RAB1_Personnel_Master_List.csv");
  }

  // Report 3: Physical Assets Accountability Registry
  function exportAssetsCSV() {
    const headers = [
      "Asset Inventory Tag",
      "Serials Manufacturer",
      "Category",
      "Description Specs",
      "Cost (PHP)",
      "Acquisition Date",
      "Status",
      "PAR Holder Name",
      "PAR Holder Plantilla Number"
    ];

    const rows = assets.map(ast => [
      ast.assetNumber,
      ast.serialNumber,
      ast.category,
      ast.description,
      ast.cost.toString(),
      formatDate(ast.dateAcquired),
      ast.status,
      ast.assignedToName || "None",
      employees.find(e => e.id === ast.assignedToId || e.employeeId === ast.assignedToId)?.plantillaNumber || (ast.assignedToId ? "N/A – Non-Plantilla" : "None")
    ]);

    exportCSV(headers, rows, "HSAC_RAB1_Assets_PAR_Catalog.csv");
  }

  // Report 4: Office Supplies Catalog
  function exportSuppliesCSV() {
    const headers = [
      "Supply Item ID",
      "Supply Name",
      "Total Purchased Stock",
      "Available Shelf Stock",
      "Measurement Unit"
    ];

    const rows = supplies.map(sup => [
      sup.id,
      sup.name,
      sup.totalQuantity.toString(),
      sup.availableQuantity.toString(),
      sup.unit
    ]);

    exportCSV(headers, rows, "HSAC_RAB1_Stockroom_Supplies_Audit.csv");
  }

  // Report 5: Request Filing pipelines
  function exportRequestsCSV() {
    const headers = [
      "Request ID",
      "Date Filed",
      "Employee Filer",
      "Plantilla Number",
      "Request Type",
      "Status",
      "Assessor Action Remarks",
      "Approved By / Signatory"
    ];

    const rows = requests.map(req => [
      req.id,
      formatDate(req.dateRequested),
      req.employeeName,
      employees.find(e => e.id === req.employeeId || e.employeeId === req.employeeId)?.plantillaNumber || "N/A – Non-Plantilla",
      req.requestType,
      req.status,
      req.remarks || "No remarks logged.",
      req.approvedBy || "Awaiting"
    ]);

    exportCSV(headers, rows, "HSAC_RAB1_Digital_Filing_Workflow_Journal.csv");
  }

  const reportsList = [
    {
      title: "HSAC Personnel Master Directory Roster",
      desc: "Every staff record: plantilla details, contact and emergency details, email, and date hired.",
      icon: Briefcase,
      recordsCount: employees.length,
      downloader: exportEmployeesCSV
    },
    {
      title: "Physical Property Accounts Catalog (PAR)",
      desc: "Registry of regional IT equipment, furniture, vehicular assets, acquisition cost records, active structural assignments, and hardware serials.",
      icon: Database,
      recordsCount: assets.length,
      downloader: exportAssetsCSV
    },
    {
      title: "Stockroom Supplies Ledger Audit Roll",
      desc: "Material cabinet stocks, total purchases, currently available reserves, and units of measurement.",
      icon: Package,
      recordsCount: supplies.length,
      downloader: exportSuppliesCSV
    },
    {
      title: "Filed Requests Register",
      desc: "Filed requests for leave, service documents, vehicle trips, Zoom slots and supplies, with comments and who approved them.",
      icon: FileCheck2,
      recordsCount: requests.length,
      downloader: exportRequestsCSV
    }
  ];

  return (
    <div id="reports-view-container" className="flex-1 overflow-y-auto p-2 sm:p-6 bg-slate-50 space-y-6">
      
      {/* HEADER TITLE BRAND */}
      <div>
        <h1 className="text-md font-bold text-slate-800 flex items-center">
          <FileSpreadsheet className="text-blue-600 mr-2" size={18} />
          Generated Reports
        </h1>
        <p className="text-[11px] text-slate-500">Download the office's records as spreadsheets, in standard comma-separated values (CSV).</p>
      </div>

      {/* COMPLIANT WARNING SECTION */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <BadgeAlert size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-900 leading-relaxed space-y-1">
          <p className="font-bold">These reports hold personal data (RA 10173)</p>
          <p>They contain employees' records, and what was spent on their trainings. The system doesn't record who downloads or prints them, and a saved file is outside its access rules: keep it off shared folders and drives, and delete it when you're done.</p>
        </div>
      </div>

      {/* GRID REPORTS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reportsList.map((rep, idx) => {
          const Icon = rep.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-9 w-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700 border border-slate-200">
                  <Icon size={16} />
                </div>
                
                <div>
                  <h3 className="text-xs font-bold font-sans text-slate-800">{rep.title}</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{rep.desc}</p>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">
                  {rep.recordsCount} rows
                </span>
                
                <button
                  onClick={rep.downloader}
                  className="bg-slate-900 hover:bg-slate-800 text-white border border-slate-850 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 shadow-sm transition-colors"
                >
                  <Download size={11} />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>
          );
        })}
        {canExportPlanD && <PlanDReportCard />}
        {/* The training reports (the instructor's review, R11): HR's and the Administrator's alone, like Plan D. */}
        {canExportPlanD && <TrainingReports employees={employees} />}
      </div>

    </div>
  );
}
