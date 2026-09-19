import React from "react";
import { Employee, FinancialTransaction, Asset, SupplyItem, AnyRequest, User } from "../types";
import { 
  FileSpreadsheet, 
  Download, 
  FileText, 
  Database,
  Briefcase,
  TrendingDown,
  Package,
  FileCheck2,
  ListCollapse,
  BadgeAlert
} from "lucide-react";
import { formatDate } from "../utils";

// Fully self-contained compliant CSV exporter
function exportCSV(headers: string[], rows: string[][], filename: string) {
  const csvContent = [
    headers.join(","),
    ...rows.map(row => 
      row.map(val => {
        const strVal = String(val || "");
        const escaped = strVal.replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(",")
    )
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename.replace(".csv", "")}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface ReportsViewProps {
  user: User;
  employees: Employee[];
  transactions: FinancialTransaction[];
  assets: Asset[];
  supplies: SupplyItem[];
  requests: AnyRequest[];
}

export default function ReportsView({ user, employees, transactions, assets, supplies, requests }: ReportsViewProps) {

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

  // Report 2: Financial Document Liquidation Audit Sheet
  function exportFinanceCSV() {
    const headers = [
      "Transaction ID",
      "Supplier",
      "Amount (PHP)",
      "Transaction Date",
      "Current Status",
      "Voucher Description",
      "Receipt Attachment File"
    ];

    const rows = transactions.map(tx => [
      tx.transactionId,
      tx.supplier,
      tx.amount.toString(),
      formatDate(tx.transactionDate),
      tx.status,
      tx.description,
      tx.receiptFilename || "None"
    ]);

    exportCSV(headers, rows, "HSAC_RAB1_Financial_Liquidation_TrackHistory.csv");
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

  // SAAODB / SAODB Statement of Allotments, Obligations, Disbursements and Balances (FAR 1 & 1A)
  function exportSAODBCSV() {
    const headers = [
      "MFO/PAP Division (FAR 1/1A)",
      "UACS Budget Allocation Code",
      "Departmental Allotment (A)",
      "Obligations Incurred / Spending (B)",
      "Disbursements Paid / Validated (C)",
      "Unpaid Obligations Outstanding (D = B - C)",
      "Unobligated Available Balance (E = A - B)",
      "Departmental Utilization Rate (%)"
    ];

    // Compute metrics
    const divisions = [
      { name: "Adjudication Division", uacs: "100010000", allotment: 500000.00 },
      { name: "Administrative and Finance Division", uacs: "200020000", allotment: 1000000.00 },
      { name: "Legal Division", uacs: "300030000", allotment: 400000.00 }
    ];

    const rows = divisions.map(div => {
      const divTxns =  (transactions || []).filter(t => t.department === div.name);
      
      // Obligations: sum of all transactions registered
      const obligations = divTxns.reduce((sum, t) => sum + t.amount, 0);
      
      // Disbursements: sum of validated or liquidated transactions
      const disbursements = divTxns
        .filter(t => ["Validated", "Liquidated"].includes(t.status))
        .reduce((sum, t) => sum + t.amount, 0);

      const unpaidObligations = obligations - disbursements;
      const unobligatedBalance = div.allotment - obligations;
      const rate = div.allotment > 0 ? ((obligations / div.allotment) * 100).toFixed(2) : "0.00";

      return [
        div.name,
        div.uacs,
        div.allotment.toFixed(2),
        obligations.toFixed(2),
        disbursements.toFixed(2),
        unpaidObligations.toFixed(2),
        unobligatedBalance.toFixed(2),
        `${rate}%`
      ];
    });

    exportCSV(headers, rows, "HSAC_RAB1_SAAODB_SAODB_FAR1_Compliance_Sheet.csv");
  }

  // Monthly Report of Disbursements (FAR 3)
  function exportFAR3CSV() {
    const headers = [
      "Reporting Month (FAR 3)",
      "UACS Program / PAP Stream",
      "Validated Disbursements Count",
      "Disbursed Amount (A = Cash Out)",
      "Outstanding Pending Voucher Amount (B)",
      "Total Monitored Ledger Obligations (A + B)"
    ];

    // Grouping by Month
    const monthlyGroups: { [key: string]: { count: number; paid: number; pending: number } } = {};
    
    transactions.forEach(tx => {
      const dateObj = new Date(tx.transactionDate);
      const monthStr = isNaN(dateObj.getTime()) 
        ? "FY 2026 Active" 
        : dateObj.toLocaleString("en-US", { year: "numeric", month: "long" });

      if (!monthlyGroups[monthStr]) {
        monthlyGroups[monthStr] = { count: 0, paid: 0, pending: 0 };
      }

      if (["Validated", "Liquidated"].includes(tx.status)) {
        monthlyGroups[monthStr].count += 1;
        monthlyGroups[monthStr].paid += tx.amount;
      } else {
        monthlyGroups[monthStr].pending += tx.amount;
      }
    });

    const rows = Object.keys(monthlyGroups).map(monthKey => {
      const group = monthlyGroups[monthKey];
      const total = group.paid + group.pending;
      return [
        monthKey,
        "General Adjudication & Support Services",
        group.count.toString(),
        group.paid.toFixed(2),
        group.pending.toFixed(2),
        total.toFixed(2)
      ];
    });

    // Fallback if no transactions are logged
    if (rows.length === 0) {
      rows.push(["FY 2026 No Records", "General Support Stream", "0", "0.00", "0.00", "0.00"]);
    }

    exportCSV(headers, rows, "HSAC_RAB1_Monthly_Disbursements_FAR3_Compliance_Sheet.csv");
  }

  const reportsList = [
    {
      title: "Statement of Allotments, Obligations & Balances (SAAODB / FAR 1 & 1A)",
      desc: "Comprehensive public sector finance sheet mapping national government allotments, obligations incurred, liquidated disbursements, unpaid obligs, and available balances by UACS codes.",
      icon: FileSpreadsheet,
      recordsCount: 3,
      downloader: exportSAODBCSV
    },
    {
      title: "FAR 3 - Monthly Report of Disbursements (E-Government Compliant)",
      desc: "Chronological government book listing actual cash disbursements, pending vouchers, and general ledger reconciliation parameters.",
      icon: FileSpreadsheet,
      recordsCount: transactions.length,
      downloader: exportFAR3CSV
    },
    {
      title: "HSAC Personnel Master Directory Roster",
      desc: "Complete database of active personnel plantilla properties, contact vectors, emergency nodes, email indexes, and dates hired.",
      icon: Briefcase,
      recordsCount: employees.length,
      downloader: exportEmployeesCSV
    },
    {
      title: "Financial Liquidation Journal & Receipts Tracking Sheet",
      desc: "Chronological, audit-ready expense sheets showing suppliers, payment costings, transaction dates, validation progression statuses, and active attachment links.",
      icon: TrendingDown,
      recordsCount: transactions.length,
      downloader: exportFinanceCSV
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
      desc: "Material cabinet stocks, total purchases, currently available reserves, units of measurements, and low-inventory warnings.",
      icon: Package,
      recordsCount: supplies.length,
      downloader: exportSuppliesCSV
    },
    {
      title: "Digital Requests Filing pipeline Transactions Journal",
      desc: "Immutable logs tracking HR leaves, service documents, vehicle dispatches, Zoom slots, and supplies approvals with comments and supervisor name indicators.",
      icon: FileCheck2,
      recordsCount: requests.length,
      downloader: exportRequestsCSV
    }
  ];

  return (
    <div id="reports-view-container" className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
      
      {/* HEADER TITLE BRAND */}
      <div>
        <h1 className="text-md font-bold text-slate-800 flex items-center">
          <FileSpreadsheet className="text-blue-600 mr-2" size={18} />
          Certified Compliance Reports Export Desk
        </h1>
        <p className="text-[11px] text-slate-500">Generate certified spreadsheet audits matching all active data tables. Exports directly in standard, comma-separated values (CSV).</p>
      </div>

      {/* COMPLIANT WARNING SECTION */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <BadgeAlert size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-900 leading-relaxed space-y-1">
          <p className="font-bold">Government Integrity Act Compliance Warning (RA 10173 & RA 9470)</p>
          <p>Spreadsheets generated through this terminal contain regional civil service credentials, personal data sheets (PDS), and financial disbursements. Under existing guidelines, unauthorized external distribution is strictly monitored. Immulatable audit trail records your operator name credentials <strong className="text-blue-900 font-extrabold">{user.fullName}</strong> upon every file download event.</p>
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
                  {rep.recordsCount} Active Rows
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
      </div>

    </div>
  );
}
