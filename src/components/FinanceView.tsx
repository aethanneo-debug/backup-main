import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { 
  FinancialTransaction, 
  User, 
  UserRole, 
  TransactionStatus, 
  SupportingDocument,
  Liquidation,
  BudgetAllocation,
  FinanceAuditLog,
  BudgetRequestItem
} from "../types";
import { 
  LayoutDashboard, 
  Search, 
  Filter, 
  Plus, 
  TrendingUp, 
  Clock,
  CheckCircle, 
  AlertTriangle, 
  FileCheck,
  FileCode,
  DollarSign,
  Download,
  BookOpen,
  ArrowUpRight,
  PlusCircle,
  X,
  History,
  Tag,
  Building2,
  Percent,
  Edit2,
  Calendar,
  Layers,
  FileSpreadsheet,
  UserCheck,
  Activity,
  ArrowRight
} from "lucide-react";
import LiquidationDeskView from "./finance/LiquidationDeskView";
import { apiCall, formatCurrency, formatDate, downloadCSV } from "../utils";

interface FinanceViewProps {
  user: User;
  transactions: FinancialTransaction[];
  employees?: any[];
  fetchSummary: () => void;
  onRefresh: () => void;
  activeSubTab?: string;
  setActiveSubTab?: (tab: string) => void;
}

export default function FinanceView({ 
  user, 
  transactions, 
  employees = [],
  fetchSummary, 
  onRefresh,
  activeSubTab: propsActiveSubTab,
  setActiveSubTab: propsSetActiveSubTab
}: FinanceViewProps) {
  // Navigation tabs
  const [internalActiveSubTab, setInternalActiveSubTab] = useState<string>("dashboard");
  const activeSubTab = propsActiveSubTab !== undefined ? propsActiveSubTab : internalActiveSubTab;
  const setActiveSubTab = propsSetActiveSubTab !== undefined ? propsSetActiveSubTab : setInternalActiveSubTab;

  // State collections from backend
  const [txnList, setTxnList] = useState<FinancialTransaction[]>(transactions || []);
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [budgets, setBudgets] = useState<BudgetAllocation[]>([]);
  const [hsacBudgets, setHsacBudgets] = useState<any[]>([]);
  const [trainingBudgets, setTrainingBudgets] = useState<any[]>([]);
  const [editingTrainingBudget, setEditingTrainingBudget] = useState(false);
  const [newTrainingBudgetVal, setNewTrainingBudgetVal] = useState("");
  const [budgetRequests, setBudgetRequests] = useState<BudgetRequestItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<FinanceAuditLog[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [subRemarks, setSubRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeJournalTab, setActiveJournalTab] = useState<string>("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [catFilter, setCatFilter] = useState("All");

  // Selected details
  const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null);
  const [selectedLiq, setSelectedLiq] = useState<Liquidation | null>(null);

  // Form modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isLiqModalOpen, setIsLiqModalOpen] = useState(false);
  const [isLiqActionModalOpen, setIsLiqActionModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [innerBudgetTab, setInnerBudgetTab] = useState<"allocations" | "requests" | "linking" | "reporting">("allocations");
    const [selectedDivisionFilter, setSelectedDivisionFilter] = useState("Adjudication Division");
  const [isAddBudgetRequestOpen, setIsAddBudgetRequestOpen] = useState(false);
  
    const [addBudgetRequestForm, setAddBudgetRequestForm] = useState({ department: "Adjudication Division", amountRequested: "", requestType: "Augmentation" as const, purpose: "" });
  
  // Local state to store linked employee activities/liquidations to budgets
  const [budgetLinks, setBudgetLinks] = useState<Array<{ id: string, liquidationNo: string, employee: string, department: string, amount: number, budgetId: string, timestamp: string }>>([]);
  
  const [selectedLinkingLiqId, setSelectedLinkingLiqId] = useState("");
  const [selectedLinkingBudgetId, setSelectedLinkingBudgetId] = useState("");

  const [consolidationPeriod, setConsolidationPeriod] = useState<"Monthly" | "Quarterly">("Quarterly");
  const [consolidationValue, setConsolidationValue] = useState("Q2"); // Q1, Q2, Q3, Q4, or Month Names

  const [activeFiscalYear, setActiveFiscalYear] = useState<string>("2026");
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [isFiscalYearModalOpen, setIsFiscalYearModalOpen] = useState(false);
  const [isConfirmingNewFy, setIsConfirmingNewFy] = useState(false);

  // For budget edit
  const [editingBudget, setEditingBudget] = useState<BudgetAllocation | null>(null);
  const [newAllocationVal, setNewAllocationVal] = useState("");
  const [editingHsacBudgetId, setEditingHsacBudgetId] = useState<string | null>(null);
  const [newHsacApprVal, setNewHsacApprVal] = useState("");
        const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Document replacement & versioning modals
  const [selectedVaultDoc, setSelectedVaultDoc] = useState<SupportingDocument | null>(null);
  const [selectedVaultTx, setSelectedVaultTx] = useState<FinancialTransaction | null>(null);
  const [isVersionHistoryModalOpen, setIsVersionHistoryModalOpen] = useState(false);
  const [isReplaceFileModalOpen, setIsReplaceFileModalOpen] = useState(false);
  const [replacementFilename, setReplacementFilename] = useState("");
  const [activeVaultFilter, setActiveVaultFilter] = useState<string | null>(null);

  // Forms values
  const [txFormData, setTxFormData] = useState({
    supplier: "",
    amount: "",
    transactionDate: "",
    description: "",
    receiptFilename: "",
    category: "Office Supplies",
    department: "Administrative and Finance Division",
    employeeRef: ""
  });

  const [docFormData, setDocFormData] = useState({
    name: "",
    type: "Invoice" as any,
    filename: ""
  });

  const [auditFormData, setAuditFormData] = useState({
    status: TransactionStatus.UNDER_REVIEW as any,
    remarks: ""
  });

  const [liqFormData, setLiqFormData] = useState({
    employee: "",
    department: "Administrative and Finance Division",
    amountReleased: "",
    amountLiquidated: "",
    requestRef: "",
    notes: ""
  });

  const [liqActionData, setLiqActionData] = useState({
    status: "Submitted" as any,
    notes: "",
    amountLiquidated: ""
  });

  const isFinanceOrAdmin = [UserRole.SUPER_ADMIN, UserRole.FINANCE_OFFICER].includes(user.role);
  const isBudgetOrAdmin = [UserRole.SUPER_ADMIN, UserRole.BUDGET_OFFICER].includes(user.role);

  // Fetch liquidations, budgets, and logs
  async function fetchFinanceAddons() {
    try {
      setLoading(true);
      const resFy = await apiCall("/api/fiscal-years").catch(() => null);
      if (resFy) {
        setFiscalYears(resFy);
        // Find active if none selected
        const active = resFy.find((f: any) => f.status === "Active");
        if (active && !activeFiscalYear) setActiveFiscalYear(active.label);
      }
      
      const resLiq = await apiCall("/api/finance/liquidations").catch(() => ({ status: "error", data: [] }));
      if (resLiq.status === "success") {
        setLiquidations(resLiq.data || []);
      }
      const resBud = await apiCall(`/api/budgets?fiscalYearLabel=${activeFiscalYear || ""}`).catch(() => ({ status: "error", data: [] }));
      if (Array.isArray(resBud)) {
        setBudgets(resBud); // Assuming endpoint returns array
      } else if (resBud.status === "success") {
        setBudgets(resBud.data || []);
      }

      const resHb = await apiCall("/api/hsac-budgets").catch(() => ({ status: "error", data: [] }));
      if (resHb.status === "success") {
        setHsacBudgets(resHb.data || []);
      }
      const resTb = await apiCall("/api/training/budgets").catch(() => ({ status: "error", data: [] }));
      if (resTb.status === "success") {
        setTrainingBudgets(resTb.data || []);
      }
      const resBudReq = await apiCall("/api/finance/budget-requests").catch(() => ({ status: "error", data: [] }));
      if (resBudReq.status === "success") {
        setBudgetRequests(resBudReq.data || []);
      }
      const resAud = await apiCall("/api/finance/audit-logs").catch(() => ({ status: "error", data: [] }));
      if (resAud.status === "success") {
        setAuditLogs(resAud.data || []);
      }
      const resSub = await apiCall("/api/liquidation-submissions").catch(() => ({ status: "error", data: [] }));
      if (resSub.status === "success") {
        setSubmissions(resSub.data || []);
      }
      const resLnk = await apiCall("/api/finance/activity-budget-links").catch(() => ({ status: "error", data: [] }));
      if (resLnk.status === "success") {
        setBudgetLinks(resLnk.data || []);
      }
    } catch (err) {
      console.error("Error loading supplementary finance modules", err);
    } finally {
      setLoading(false);
    }
  }

  // Load backend arrays on mount and updates
  useEffect(() => {
    setTxnList(transactions || []);
    if (selectedTx) {
      const updated = transactions.find(t => t.id === selectedTx.id);
      if (updated) setSelectedTx(updated);
    }
    if (selectedVaultTx) {
      const updatedTx = transactions.find(t => t.id === selectedVaultTx.id);
      if (updatedTx) {
        setSelectedVaultTx(updatedTx);
        if (selectedVaultDoc) {
          const updatedDoc = updatedTx.supportingDocuments?.find(d => d.id === selectedVaultDoc.id);
          if (updatedDoc) setSelectedVaultDoc(updatedDoc);
        }
      }
    }
  }, [transactions]);

  // Handle support doc replacement
  async function handleReplaceDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVaultTx || !selectedVaultDoc) return;
    try {
      setLoading(true);
      const res = await apiCall(`/api/financial-transactions/${selectedVaultTx.id}/documents/${selectedVaultDoc.id}/replace`, {
        method: "POST",
        body: JSON.stringify({ filename: replacementFilename })
      });
      if (res.status === "success") {
        setIsReplaceFileModalOpen(false);
        setReplacementFilename("");
        onRefresh();
      }
    } catch (err: any) {
      console.error("Failed to amend/replace dossier supporting file:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFinanceAddons();
  }, [activeSubTab, activeFiscalYear]);

  // Submit expense record
  async function handleCreateTx(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiCall("/api/financial-transactions", {
        method: "POST",
        body: JSON.stringify(txFormData)
      });
      if (res.status === "success") {
        alert("Transaction item logged successfully into system ledger!");
        setIsTxModalOpen(false);
        onRefresh();
        fetchSummary();
        // Reset
        setTxFormData({
          supplier: "",
          amount: "",
          transactionDate: "",
          description: "",
          receiptFilename: "",
          category: "Office Supplies",
          department: "Administrative and Finance Division",
          employeeRef: ""
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Attach digital supporting doc
  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTx) return;
    try {
      const res = await apiCall(`/api/financial-transactions/${selectedTx.id}/documents`, {
        method: "POST",
        body: JSON.stringify(docFormData)
      });
      if (res.status === "success") {
        alert("Supporting voucher file uploaded successfully!");
        setIsDocModalOpen(false);
        onRefresh();
        // Reset
        setDocFormData({
          name: "",
          type: "Invoice",
          filename: ""
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Evaluate workflow progression
  async function handleAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTx) return;
    try {
      const res = await apiCall(`/api/financial-transactions/${selectedTx.id}/status`, {
        method: "PUT",
        body: JSON.stringify(auditFormData)
      });
      if (res.status === "success") {
        alert("Voucher validated and ledger status updated successfully!");
        setIsAuditModalOpen(false);
        onRefresh();
        fetchSummary();
        fetchFinanceAddons();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Submit Liquidation Advance
  async function handleCreateLiq(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiCall("/api/finance/liquidations", {
        method: "POST",
        body: JSON.stringify(liqFormData)
      });
      if (res.status === "success") {
        alert("Liquidation cash advance record registered!");
        setIsLiqModalOpen(false);
        fetchFinanceAddons();
        // Reset
        setLiqFormData({
          employee: "",
          department: "Administrative and Finance Division",
          amountReleased: "",
          amountLiquidated: "",
          requestRef: "",
          notes: ""
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Action on individual liquidation
  async function handleLiqAction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLiq) return;
    try {
      const res = await apiCall(`/api/finance/liquidations/${selectedLiq.id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: liqActionData.status,
          note: liqActionData.notes,
          amountLiquidated: liqActionData.amountLiquidated !== "" ? Number(liqActionData.amountLiquidated) : undefined
        })
      });
      if (res.status === "success") {
        alert("Liquidation dossier evaluated and advanced!");
        setIsLiqActionModalOpen(false);
        setSelectedLiq(null);
        fetchFinanceAddons();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Handle action on liquidation submission under multi-stage flow (Finance officer)
  async function handleFinanceLiquidationAction(subId: string, action: "Validate" | "Return", remarks: string) {
    if (action === "Return" && !remarks) {
      alert("Please enter remarks explaining the grounds for return.");
      return;
    }
    try {
      const res = await apiCall(`/api/liquidation-submissions/${subId}/finance-action`, {
        method: "PUT",
        body: JSON.stringify({ action, remarks: remarks || "Financial documentations validated & finalized." })
      });
      if (res.status === "success") {
        alert(action === "Validate" ? "Dossier validated and finalized successfully!" : "Dossier returned to employee with remarks.");
        setSelectedSub(null);
        setSubRemarks("");
        fetchFinanceAddons();
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message || "Failed to process liquidation validation.");
    }
  }

  // Modify budget allocation
  async function handleUpdateBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBudget) return;
    try {
      const res = await apiCall(`/api/finance/budgets/${editingBudget.id}`, {
        method: "PUT",
        body: JSON.stringify({ budgetAllocation: Number(newAllocationVal) })
      });
      if (res.status === "success") {
        alert("Treasury division budget allocation re-balanced!");
        setEditingBudget(null);
        setIsBudgetModalOpen(false);
        fetchFinanceAddons();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Submit a new budget realignment / augmentation request
  async function handleCreateBudgetRequest(department: string, amountRequested: number, requestType: "Augmentation" | "Realignment" | "Emergency", purpose: string) {
    try {
      const res = await apiCall(`/api/finance/budget-requests`, {
        method: "POST",
        body: JSON.stringify({ department, amountRequested, requestType, purpose })
      });
      if (res.status === "success") {
        alert("Budget allocation request filed successfully and queued for review.");
        fetchFinanceAddons();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Act on a pending budget request
  async function handleActionBudgetRequest(id: string, action: "Approved" | "Returned", remarks?: string) {
    try {
      const res = await apiCall(`/api/finance/budget-requests/${id}/action`, {
        method: "POST",
        body: JSON.stringify({ action, remarks: remarks || "" })
      });
      if (res.status === "success") {
        alert(`Budget allocation request successfully ${action}!`);
        fetchFinanceAddons();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Simulated export to CSV for financial reports
  function generateFinancialReport(title: string, headers: string[], rows: string[][], filename: string) {
    const csvContent = [
      `HSAC REGIONAL FINANCE OFFICE REPORT: ${title.toUpperCase()}`,
      `Generated on: ${new Date().toLocaleString()}`,
      `Generated by: ${user.fullName} (${user.role})`,
      "",
      headers.join(","),
      ...rows.map(row => 
        row.map(val => {
          const s = String(val || "").replace(/"/g, '""');
          return `"${s}"`;
        }).join(",")
      )
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Render Export actions
  const exportMethods = {
    transactions: () => {
      const headers = ["Voucher ID", "Supplier", "Transaction Date", "Amount (PHP)", "Status", "Department", "Category", "Created By", "Scope Description"];
      const rows = yearFilteredTxns.map(tx => [
        tx.transactionId,
        tx.supplier,
        tx.transactionDate,
        tx.amount.toString(),
        tx.status,
        tx.department || "N/A",
        tx.category || "N/A",
        tx.createdBy || "N/A",
        tx.description
      ]);
      generateFinancialReport("Financial Transactions Master Register", headers, rows, "HSAC_Financial_Transactions_Acreage");
    },
    liquidations: () => {
      const headers = ["Liquidation Number", "Reference Request", "Employee", "Department", "Allocated Released", "Liquidated Amount", "Remaining Balance Return", "Status", "Close Date"];
      const rows = yearFilteredSubmissions.map(l => [
        l.submissionNo,
        l.activityId,
        l.employeeName,
        "N/A",
        l.totalReleased.toString(),
        l.totalSpent.toString(),
        l.remainingBalance.toString(),
        l.status,
        l.liquidationDate
      ]);
      generateFinancialReport("Cash Advance and Liquidation Monitors", headers, rows, "HSAC_Liquidation_Logistics");
    },
    budgets: () => {
      const headers = ["Department Module", "Budget Allocation (PHP)", "Utilized Treasury", "Remaining Reserve", "Utilization Percent"];
      const rows = budgets.map(b => {
        const deptYearTxns = yearFilteredTxns.filter(t => (t.department || "").toLowerCase() === b.department.toLowerCase());
        const txObligations = deptYearTxns.filter(t => t.status === "Validated" || t.status === "Liquidated").reduce((sum, t) => sum + t.amount, 0);
                    const totalPayroll = 0; // Employees payroll disabled to allow zero start
                    const obligations = txObligations + totalPayroll;
        return [
          b.department,
          (b.budgetAllocation + (b.carryOver || 0)).toString(),
          obligations.toString(),
          (b.budgetAllocation + (b.carryOver || 0) - obligations).toString(),
          `${Math.round((obligations / Math.max(1, b.budgetAllocation + (b.carryOver || 0))) * 100)}%`
        ];
      });
      generateFinancialReport("Departmental Budget Allocation Balances", headers, rows, "HSAC_Budget_Utilization_Summary");
    }
  };

  // Live filter matching for Transactions
  const yearFilteredTxns = txnList.filter(tx => tx.transactionDate.startsWith(activeFiscalYear));
  const yearFilteredSubmissions = submissions.filter(s => s.createdAt && s.createdAt.startsWith(activeFiscalYear));

  const filteredTxns = yearFilteredTxns.filter((tx) => {
    const matchesSearch = 
      tx.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesJournalTab = activeJournalTab === "All" ? true : tx.status === activeJournalTab;
    const matchesDept = deptFilter === "All" ? true : tx.department === deptFilter;
    const matchesCat = catFilter === "All" ? true : tx.category === catFilter;

    return matchesSearch && matchesJournalTab && matchesDept && matchesCat;
  });

  const workflowSteps = [
    TransactionStatus.PENDING_VALIDATION,
    TransactionStatus.UNDER_REVIEW,
    TransactionStatus.VALIDATED,
    TransactionStatus.LIQUIDATED,
    TransactionStatus.ARCHIVED
  ];

  // Calculations for dashboard indicators
  const totalExpenditureVal = yearFilteredTxns.reduce((sum, tx) => sum + tx.amount, 0);
  const validatedTxCount = yearFilteredTxns.filter(tx => tx.status === TransactionStatus.VALIDATED).length;
  const pendingTxCount = yearFilteredTxns.filter(tx => tx.status === TransactionStatus.PENDING_VALIDATION).length;
  
  const pendingLiqCount = yearFilteredSubmissions.filter(s => s.status !== "Completed").length;
  const completedLiqCount = yearFilteredSubmissions.filter(s => s.status === "Completed").length;
  const totalApprovedLiqAmount = yearFilteredSubmissions.filter(s => s.status === "Completed").reduce((acc, s) => acc + s.totalSpent, 0);

  const totalBudgetAllocationSum = budgets.reduce((acc, b) => acc + b.budgetAllocation + (b.carryOver || 0), 0);
  const totalBudgetUtilizedSum = yearFilteredTxns.filter(t => t.status === "Validated" || t.status === "Liquidated").reduce((sum, t) => sum + t.amount, 0);
  const overallUtilizationPercent = totalBudgetAllocationSum > 0 ? Math.round((totalBudgetUtilizedSum / totalBudgetAllocationSum) * 100) : 0;

  const handleStartNewFiscalYear = async () => {
    const nextYear = String(Number(activeFiscalYear) + 1);
    
    try {
      const res = await apiCall('/api/fiscal-years', {
        method: 'POST',
        body: JSON.stringify({
          label: nextYear,
          start_date: `${nextYear}-01-01`,
          end_date: `${nextYear}-12-31`
        })
      });
      if (res.status === 'success') {
        alert(`Successfully started Fiscal Year ${nextYear}`);
        await fetchFinanceAddons();
        setActiveFiscalYear(nextYear);
      } else {
        alert(res.message || "Failed to create new fiscal year");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred");
    }
  };

  const currentFy = fiscalYears.find(fy => fy.label === activeFiscalYear);

  // Training programs carry the fiscal year LABEL ("2026"), not the id — the server
  // derives its totals the same way, so these agree with the summary tiles.

  return (
    <div id="finance-workstation-container" className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50">
      
      {/* CORE DESK VIEWPORT */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* VIEW 1: FINANCES WORKSPACE OVERVIEW DASHBOARD */}
        {activeSubTab === "dashboard" && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <div className="flex justify-between items-center bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
              <div>
                <h1 className="text-md font-bold text-slate-900 flex items-center gap-1.5 leading-tight">
                  <Building2 size={16} className="text-amber-500" />
                  <span>Corporate Finance Desk & Treasury Summary</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">Real-time fiscal reporting, regional ledger compliance monitors, and cash allocation statistics.</p>
              </div>
              <button 
                onClick={() => setIsFiscalYearModalOpen(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold py-1.5 px-2.5 uppercase tracking-wider rounded-lg border flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Calendar size={11} />
                <span>FY {activeFiscalYear} ACTIVE</span>
              </button>
            </div>

            {/* TEN METRICS CARD ROWS */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
              {[
                { 
                  label: "Total Transactions", 
                  value: yearFilteredTxns.length, 
                  desc: "Ledger Volume Count", 
                  icon: Layers, 
                  color: "border-slate-200 hover:border-slate-400 hover:bg-slate-50/30", 
                  action: () => {
                    setActiveSubTab("journal");
                    setActiveJournalTab("All");
                  }
                },
                { 
                  label: "Pending Validations", 
                  value: pendingTxCount, 
                  desc: "Awaiting Finance Audit", 
                  icon: Clock, 
                  color: "border-rose-200 text-rose-600 bg-rose-50/20 hover:bg-rose-50/40 hover:border-rose-300", 
                  action: () => {
                    setActiveSubTab("journal");
                    setActiveJournalTab(TransactionStatus.PENDING_VALIDATION);
                  }
                },
                { 
                  label: "Validated Cleared", 
                  value: validatedTxCount, 
                  desc: "Cleared Expenditures", 
                  icon: FileCheck, 
                  color: "border-blue-200 text-blue-600 bg-blue-50/20 hover:bg-blue-50/40 hover:border-blue-300", 
                  action: () => {
                    setActiveSubTab("journal");
                    setActiveJournalTab(TransactionStatus.VALIDATED);
                  }
                },
                { 
                  label: "Pending Liquidations", 
                  value: pendingLiqCount, 
                  desc: "Outstanding Ad-Vouchers", 
                  icon: AlertTriangle, 
                  color: "border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-50/40 hover:border-amber-300", 
                  action: () => {
                    setActiveSubTab("liquidation");
                  }
                },
                { 
                  label: "Liquidated Finished", 
                  value: completedLiqCount, 
                  desc: "Closed Liquidation Dossiers", 
                  icon: CheckCircle, 
                  color: "border-emerald-200 text-emerald-600 bg-emerald-50/20 hover:bg-emerald-50/40 hover:border-emerald-300", 
                  action: () => {
                    setActiveSubTab("liquidation");
                  }
                },
                { 
                  label: "Corporate Spending", 
                  value: formatCurrency(totalExpenditureVal), 
                  desc: "Total Logs Amount", 
                  icon: DollarSign, 
                  color: "border-slate-200 text-slate-800 hover:border-slate-400 hover:bg-slate-50/30", 
                  action: () => {
                    setActiveSubTab("journal");
                    setActiveJournalTab("All");
                  }
                },
                { 
                  label: "Utilized Liquidations", 
                  value: formatCurrency(totalApprovedLiqAmount), 
                  desc: "Reclaimed Expenditures", 
                  icon: TrendingUp, 
                  color: "border-slate-200 text-emerald-800 hover:border-slate-400 hover:bg-slate-50/30", 
                  action: () => {
                    setActiveSubTab("liquidation");
                  }
                },
                { 
                  label: "Treasury Pool Used", 
                  value: formatCurrency(totalBudgetUtilizedSum), 
                  desc: "Total Departmental Spends", 
                  icon: DollarSign, 
                  color: "border-slate-200 hover:border-slate-400 hover:bg-slate-50/30", 
                  action: () => {
                    setActiveSubTab("budgets");
                    setInnerBudgetTab("allocations");
                  }
                },
                { 
                  label: "Total Yearly Budget", 
                  value: formatCurrency(totalBudgetAllocationSum), 
                  desc: "Allotted Regional Fund", 
                  icon: DollarSign, 
                  color: "border-slate-200 hover:border-slate-400 hover:bg-slate-50/30", 
                  action: () => {
                    setActiveSubTab("budgets");
                    setInnerBudgetTab("allocations");
                  }
                },
                { 
                  label: "Overall Budget Used", 
                  value: `${overallUtilizationPercent}%`, 
                  desc: "Percent Utilization Ratio", 
                  icon: Percent, 
                  color: "border-amber-200 text-amber-700 bg-amber-50/10 hover:bg-amber-50/20 hover:border-amber-300", 
                  action: () => {
                    setActiveSubTab("budgets");
                    setInnerBudgetTab("reporting");
                  }
                },
              ].map((m, i) => (
                <div 
                  key={i} 
                  onClick={m.action}
                  className={`bg-white border p-4 rounded-xl shadow-sm flex flex-col justify-between cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] ${m.color}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight">{m.label}</span>
                    <m.icon size={14} className="opacity-60" />
                  </div>
                  <div className="mt-2.5">
                    <p className="text-sm font-extrabold font-mono tracking-tight">{m.value}</p>
                    <p className="text-[9px] text-slate-400 mt-1 leading-none">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* DYNAMIC VISUALISATIONS / CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* CHART 1: TREASURY BUDGET UTILIZATION PROGRESS DESK */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="border-b pb-2 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Departmental Budget Pools</h3>
                  <TrendingUp size={14} className="text-amber-500" />
                </div>

                <div className="space-y-4 pt-1">
                  {budgets.map((b) => {
                    const deptYearTxns = yearFilteredTxns.filter(t => (t.department || "").toLowerCase() === b.department.toLowerCase());
                    const txObligations = deptYearTxns.filter(t => t.status === "Validated" || t.status === "Liquidated").reduce((sum, t) => sum + t.amount, 0);
                    const totalPayroll = 0; // Employees payroll disabled to allow zero start
                    const obligations = txObligations + totalPayroll;
                    const isOverspent = obligations >= (b.budgetAllocation + (b.carryOver || 0));
                    const percentageUsed = Math.round((obligations / Math.max(1, b.budgetAllocation + (b.carryOver || 0))) * 100);
                    return (
                      <div key={b.id} className="space-y-1.5 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-800">{b.department}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isOverspent ? "bg-rose-100 text-rose-800 outline outline-1 outline-rose-200 animate-pulse" : "bg-slate-150 text-slate-700"}`}>
                            {isOverspent ? "OVERSPENT ALERT" : `${percentageUsed}% USED`}
                          </span>
                        </div>
                        
                        {/* Progressive Bar */}
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isOverspent ? "bg-rose-500" : percentageUsed > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                          />
                        </div>

                                                <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                          <span>Spent: {formatCurrency(obligations)}</span>
                          <span>Total Allocation: {formatCurrency(b.budgetAllocation + (b.carryOver || 0))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* CHART 2: RECENT TRANSACTIONS CHRONOLOGY SLIDES */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="border-b pb-2 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Fiscal Spending Categorisations</h3>
                  <Layers size={14} className="text-blue-500" />
                </div>

                <div className="space-y-2.5">
                  {[
                    { category: "Office Supplies", icon: Tag, color: "bg-blue-100 text-blue-800 border-blue-200" },
                    { category: "Travel Expenses", icon: TrendingUp, color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
                    { category: "Fuel/Tolls", icon: Tag, color: "bg-amber-100 text-amber-800 border-amber-200" },
                    { category: "Utility Bills", icon: Tag, color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
                    { category: "Maintenance", icon: AlertTriangle, color: "bg-rose-100 text-rose-800 border-rose-200" },
                    { category: "Other", icon: Layers, color: "bg-slate-100 text-slate-800 border-slate-200" },
                  ].map((cat, idx) => {
                    const matchesCount = yearFilteredTxns.filter(tx => tx.category === cat.category).length;
                    const sum = yearFilteredTxns.filter(tx => tx.category === cat.category).reduce((acc, tx) => acc + tx.amount, 0);

                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <div className="flex items-center space-x-2">
                          <span className={`p-1.5 rounded-lg ${cat.color.split(" ")[0]} border`}>
                            <cat.icon size={12} />
                          </span>
                          <span className="text-[11px] font-semibold text-slate-700">{cat.category}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold font-mono text-slate-800">{formatCurrency(sum)}</p>
                          <p className="text-[9px] text-slate-400 font-mono">{matchesCount} ledger slips</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CHART 3: MONITORED ACTION TRAILS WIDGET */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="border-b pb-2 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Recent Treasury Activity Rails</h3>
                  <Activity size={14} className="text-emerald-500" />
                </div>

                <div className="space-y-3 max-h-[310px] overflow-y-auto pr-1">
                  {auditLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl text-[10px] relative">
                      <div className="flex justify-between items-center border-b pb-1 mb-1 border-slate-200/50">
                        <span className="font-extrabold text-slate-800 font-mono">{log.action}</span>
                        <span className="text-slate-400 tracking-wide font-mono">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-slate-600">Module: <strong className="text-slate-700 font-mono">{log.module}</strong></p>
                      <p className="text-slate-600 mt-0.5 font-medium leading-tight select-none">
                        Shift: <span className="text-rose-500 line-through">{String(log.previousValue)}</span> <ArrowRight size={8} className="inline mx-1 text-slate-400" /> <span className="text-emerald-600 font-bold">{String(log.newValue)}</span>
                      </p>
                      <p className="text-right text-[9px] text-slate-400 font-bold mt-1 uppercase">Auditor: {log.user}</p>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="text-center text-slate-400 text-xs italic py-10 font-mono">No actions recorded on dashboard rails.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW 2: TRANSACTIONS JOURNAL GRIDVIEW */}
        {activeSubTab === "journal" && (
          <div className="flex-1 flex min-h-0 overflow-hidden bg-slate-50">
            
            {/* LEADING RECORD WRAPPER */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h1 className="text-md font-bold text-slate-800">Financial Documents & Expenditure Registry</h1>
                  <p className="text-xs text-slate-500">Track, edit, and validate treasury disbursement vouchers, receipts, and invoices.</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportMethods.transactions}
                    className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-lg text-xs font-semibold flex items-center shadow-sm"
                  >
                    <Download size={13} className="mr-1.5" />
                    <span>CSV Report</span>
                  </button>

                  {isFinanceOrAdmin && (
                    <button
                      onClick={() => setIsTxModalOpen(true)}
                      className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center shadow-sm cursor-pointer"
                    >
                      <Plus size={14} className="mr-1.5" />
                      <span>Log Receipt</span>
                    </button>
                  )}
                </div>
              </div>

              {/* DISBURSE STATUS FILTERS */}
              <div className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-xl border border-slate-200/80 items-stretch sm:items-center justify-between shrink-0">
                <div className="flex gap-1 overflow-x-auto p-1 bg-slate-50 rounded-lg">
                  {["All", ...workflowSteps].map((tab) => {
                    const isActive = activeJournalTab === tab;
                    const count = tab === "All" 
                      ? yearFilteredTxns.length 
                      : yearFilteredTxns.filter(t => t.status === tab).length;

                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveJournalTab(tab)}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase shrink-0 cursor-pointer ${
                          isActive 
                            ? "bg-slate-900 text-white shadow-sm" 
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        }`}
                      >
                        <span>{tab}</span>
                        <span className={`ml-1.5 px-1 rounded text-[9px] font-semibold ${isActive ? "bg-amber-400 text-slate-900" : "bg-slate-200 text-slate-600"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 items-center">
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="border border-slate-200 text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 focus:outline-none"
                  >
                    <option value="All">All Departments</option>
                    <option value="Adjudication Division">Adjudication Div</option>
                    <option value="Administrative and Finance Division">Admin & Finance</option>
                    <option value="Legal Division">Legal Div</option>
                  </select>

                  <select
                    value={catFilter}
                    onChange={(e) => setCatFilter(e.target.value)}
                    className="border border-slate-200 text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 focus:outline-none"
                  >
                    <option value="All">All Categories</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Travel Expenses">Travel Expenses</option>
                    <option value="Fuel/Tolls">Fuel/Tolls</option>
                    <option value="Utility Bills">Utility Bills</option>
                    <option value="Professional Services">Professional Services</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* SEARCH INPUT BAR */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter register entries by Supplier, Transaction Reference, or description coordinates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-sm"
                />
              </div>

              {/* DATA TABLE LEDGER GRID */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px] select-none">
                        <th className="p-4 w-28">ID Code</th>
                        <th className="p-4">Supplier / Vendor</th>
                        <th className="p-4">Department</th>
                        <th className="p-4">Category</th>
                        <th className="p-4 text-right">Disbursed (PHP)</th>
                        <th className="p-4 text-center">Receipt Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTxns.length > 0 ? (
                        filteredTxns.map((tx) => (
                          <tr
                            key={tx.id}
                            onClick={() => {
                              setSelectedTx(tx);
                              setAuditFormData({ status: tx.status as any, remarks: "" });
                            }}
                            className={`cursor-pointer transition-colors ${
                              selectedTx?.id === tx.id ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="p-4 font-mono font-bold text-slate-700">{tx.transactionId}</td>
                            <td className="p-4 text-slate-900 font-medium">
                              {tx.supplier}
                              <p className="text-[9px] text-slate-400 font-normal mt-0.5">{tx.transactionDate}</p>
                            </td>
                            <td className="p-4 text-slate-500 truncate max-w-[150px]">{tx.department || "Admin & Finance"}</td>
                            <td className="p-4">
                              <span className="bg-slate-100 text-slate-700 text-[9px] px-2 py-0.5 rounded font-bold border capitalize">
                                {tx.category || "Other"}
                              </span>
                            </td>
                            <td className="p-4 text-right font-mono text-slate-800 font-bold">{formatCurrency(tx.amount)}</td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${
                                tx.status === TransactionStatus.LIQUIDATED 
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                                  : tx.status === TransactionStatus.VALIDATED
                                  ? "bg-blue-50 text-blue-800 border-blue-200"
                                  : tx.status === TransactionStatus.PENDING_VALIDATION
                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-16 text-slate-400 font-mono italic">
                            No matching financial records in selected category query stack.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* SIDE PANEL DETAIL WORKSTATION */}
            {selectedTx && (
              <div className="w-96 bg-white border-l border-slate-200 overflow-y-auto flex flex-col shrink-0 animate-in slide-in-from-right-10 duration-200">
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center space-x-1.5">
                    <FileCode size={15} className="text-amber-400 animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Ledger Inspector</h3>
                  </div>
                  <button onClick={() => setSelectedTx(null)} className="text-slate-400 hover:text-white p-1">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 space-y-6">
                  
                  {/* BASE DETAILS CARD */}
                  <div className="border-b border-slate-100 pb-5">
                    <span className="text-[9px] font-mono font-bold text-slate-400">Transaction Registry ID:</span>
                    <h2 className="text-sm font-bold font-mono text-slate-800">{selectedTx.transactionId}</h2>
                    <div className="mt-3 p-3 bg-slate-900 text-amber-400 rounded-lg text-center shadow-inner font-mono font-bold text-lg select-all">
                      {formatCurrency(selectedTx.amount)}
                    </div>
                    <div className="mt-3 space-y-1.5 text-[11px] text-slate-600">
                      <p>Supplier: <strong className="text-slate-800">{selectedTx.supplier}</strong></p>
                      <p>Department: <strong className="text-slate-700">{selectedTx.department || "N/A"}</strong></p>
                      <p>Category: <strong className="text-slate-700">{selectedTx.category || "N/A"}</strong></p>
                      <p>Employee Reference: <code className="bg-slate-100 font-bold p-0.5 rounded text-amber-700">{selectedTx.employeeRef || "N/A"}</code></p>
                      <p>Disbursed On: {selectedTx.transactionDate}</p>
                    </div>
                  </div>

                  {/* SCOPE OF EXPENDITURE */}
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Ledger Purview Description</span>
                    <p className="text-[11px] leading-relaxed text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {selectedTx.description}
                    </p>
                  </div>

                  {/* LIQUIDATING ATTACHMENTS */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-1">
                      <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Liquidational Files</span>
                      {isFinanceOrAdmin && (
                        <button 
                          onClick={() => setIsDocModalOpen(true)}
                          className="text-[10px] text-amber-600 hover:underline font-semibold flex items-center"
                        >
                          <PlusCircle size={11} className="mr-0.5" />
                          <span>Attach Code Doc</span>
                        </button>
                      )}
                    </div>

                    {selectedTx.receiptFilename && (
                      <div className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between text-[11px] border border-slate-150">
                        <div className="flex items-center space-x-1.5">
                          <Tag size={13} className="text-amber-500 shrink-0" />
                          <span className="font-semibold text-slate-700">Official Receipt (Primary)</span>
                        </div>
                        <button 
                          onClick={() => {
                            const dummyText = `RECEIPT PROOF\n\nFilename: ${selectedTx.receiptFilename}\nTransaction Ref: ${selectedTx.transactionId}\nAmount: ${formatCurrency(selectedTx.amount)}\n\n[END OF FILE]`;
                            const blob = new Blob([dummyText], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = selectedTx.receiptFilename + ".txt";
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="text-[10px] text-slate-500 hover:underline font-bold truncate max-w-[120px]"
                        >
                          {selectedTx.receiptFilename}
                        </button>
                      </div>
                    )}

                    {/* DYNAMIC LISTED DOCUMENT CODES */}
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {selectedTx.supportingDocuments && selectedTx.supportingDocuments.length > 0 ? (
                        selectedTx.supportingDocuments.map((doc: SupportingDocument) => (
                          <div key={doc.id} className="p-2 border border-slate-100 bg-slate-50/50 rounded-lg text-[10px] flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-800 line-clamp-1">{doc.name}</p>
                              <p className="text-[9px] text-slate-400">
                                {doc.type} • {formatDate(doc.uploadedAt)}
                              </p>
                              {doc.uploadedBy && (
                                <p className="text-[8px] text-slate-400 font-mono">By: {doc.uploadedBy}</p>
                              )}
                            </div>
                            <button 
                              onClick={() => {
                                const dummyText = `DOCUMENT REPLICA\n\nFilename: ${doc.filename}\nType: ${doc.type}\nUploaded by: ${doc.uploadedBy}\nDate: ${doc.uploadedAt}\nVersion: V${doc.versions?.length || 1}\n\n[END OF FILE]`;
                                const blob = new Blob([dummyText], { type: "text/plain" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = doc.filename + ".txt";
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-slate-200"
                              title="Download document replica"
                            >
                              <Download size={13} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-400 italic py-2">No secondary invoices, purchase request, or disbursement voucher codes attached.</p>
                      )}
                    </div>
                  </div>

                  {/* HISTORY RAILS */}
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block border-b pb-0.5">Voucher History Logs</span>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {selectedTx.history && selectedTx.history.length > 0 ? (
                        selectedTx.history.map((hist) => (
                          <div key={hist.id} className="text-[10px] bg-slate-50 p-2 rounded border border-slate-100 space-y-1">
                            <div className="flex justify-between items-center text-slate-500 font-mono text-[9px]">
                              <span className="font-bold text-slate-700">{hist.status}</span>
                              <span>{formatDate(hist.changedAt)}</span>
                            </div>
                            <p className="text-slate-600">Remarks: <em>{hist.remarks}</em></p>
                            <p className="text-[9px] text-slate-400 text-right">By: {hist.changedBy}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No timeline registered.</p>
                      )}
                    </div>
                  </div>

                  {/* ACTION TRIGGER BOX */}
                  {isFinanceOrAdmin && (
                    <div className="pt-4 border-t border-slate-100">
                      <button
                        onClick={() => setIsAuditModalOpen(true)}
                        className="w-full bg-slate-900 border border-slate-850 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                      >
                        <History size={13} />
                        <span>Update Validation Status</span>
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        )}

        {/* VIEW 3: RECEIPTS & DOCUMENTS VAULT */}
        {activeSubTab === "vault" && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <div className="flex justify-between items-center bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
              <div>
                <h1 className="text-md font-bold text-slate-900">Official Document Repository & Invoices Vault</h1>
                <p className="text-xs text-slate-500 mt-1 font-sans">Index, version-control and trace audit files including Purchase Requests (PR), Disbursement Vouchers (DV), official Supplier Invoices, and Liquidation Reports.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200/85">
              {[
                { type: "Purchase Request", desc: "Approved procurement requirements", count: yearFilteredTxns.flatMap(t => t.supportingDocuments || []).filter(d => d.type === "Purchase Request").length },
                { type: "Invoice", desc: "Suppliers official cargo invoices", count: yearFilteredTxns.flatMap(t => t.supportingDocuments || []).filter(d => d.type === "Invoice").length },
                { type: "Disbursement Voucher", desc: "Cash release certifications", count: yearFilteredTxns.flatMap(t => t.supportingDocuments || []).filter(d => d.type === "Disbursement Voucher").length },
                { type: "Liquidation Report", desc: "Post-expenditure reconciliation sheets", count: yearFilteredTxns.flatMap(t => t.supportingDocuments || []).filter(d => d.type === "Liquidation Report").length },
              ].map((box, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveVaultFilter(activeVaultFilter === box.type ? null : box.type)}
                  className={`p-4 text-left rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${activeVaultFilter === box.type ? "bg-blue-50 border-blue-400 shadow-md ring-1 ring-blue-400" : "bg-slate-50 border-slate-200/60 hover:border-slate-300 hover:shadow-sm"}`}
                >
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 font-mono">{box.type}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{box.desc}</p>
                  </div>
                  <div className="flex justify-between items-end mt-4 w-full">
                    <span className="text-lg font-bold font-mono text-slate-700">{box.count} PDFs</span>
                    <span className="text-[9px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-black px-1.5 py-0.5 rounded">SECURE</span>
                  </div>
                </button>
              ))}
            </div>

            {/* MASTER LIST OF ALL EXPENSE DOCUMENTS WITH VERSIONING */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-850 uppercase tracking-widest font-mono">Dossier File Version Logs {activeVaultFilter && `(${activeVaultFilter})`}</span>
                <span className="text-[10px] text-slate-400 font-mono tracking-tight font-black">
                  {yearFilteredTxns.flatMap(t => t.supportingDocuments || []).filter(d => activeVaultFilter ? d.type === activeVaultFilter : true).length} FILES MANAGED
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto custom-scrollbar border border-slate-150 rounded-lg p-1 bg-white">
                {yearFilteredTxns.map((tx) => (
                  tx.supportingDocuments?.filter(doc => activeVaultFilter ? doc.type === activeVaultFilter : true).map((doc: SupportingDocument) => (
                    <div key={doc.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <code className="text-[9px] bg-slate-100 font-bold p-0.5 rounded text-amber-700 font-mono uppercase tracking-wide">{tx.transactionId}</code>
                          <strong className="text-xs text-slate-800">{doc.name}</strong>
                          <span className="text-[9px] text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-full capitalize font-semibold">{doc.type}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">File Reference: <em className="text-slate-800 underline font-mono select-all font-medium">{doc.filename}</em></p>
                        <p className="text-[9px] text-slate-400 font-mono">Uploaded Date: {formatDate(doc.uploadedAt)} • Uploader: {doc.uploadedBy || "Andres B. Bonifacio"}</p>
                      </div>

                      {/* VERSIONING HISTORY ACTION PANEL */}
                      <div className="flex items-center space-x-4">
                        <div className="text-right text-[10px] font-mono leading-tight bg-slate-50 p-2 border rounded-lg">
                          <p className="font-bold text-slate-700">Audit Status: <span className="text-emerald-600">Approved ✓</span></p>
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedVaultTx(tx);
                              setSelectedVaultDoc(doc);
                              setIsVersionHistoryModalOpen(true);
                            }} 
                            className="text-[9px] text-amber-700 font-black hover:underline mt-1 uppercase cursor-pointer"
                          >
                            View Version History Archive (V{doc.versions?.length || 1})
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVaultTx(tx);
                            setSelectedVaultDoc(doc);
                            setReplacementFilename(doc.filename);
                            setIsReplaceFileModalOpen(true);
                          }}
                          className="bg-white border text-[10px] text-slate-700 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                        >
                          <Layers size={11} />
                          <span>Replace File</span>
                        </button>
                      </div>
                    </div>
                  ))
                ))}

                {yearFilteredTxns.flatMap(t => t.supportingDocuments || []).filter(d => activeVaultFilter ? d.type === activeVaultFilter : true).length === 0 && (
                  <p className="p-8 text-center text-slate-400 text-xs font-mono italic">No documents found matching the selected criteria.</p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* VIEW 4: LIQUIDATION WORKFLOW MONITORING */}
        {activeSubTab === "liquidation" && (
          <LiquidationDeskView
            user={user}
            submissions={submissions}
            yearFilteredSubmissions={yearFilteredSubmissions}
            activeFiscalYear={activeFiscalYear}
            selectedSub={selectedSub}
            subRemarks={subRemarks}
            setSelectedSub={setSelectedSub}
            setSubRemarks={setSubRemarks}
            onFinanceAction={handleFinanceLiquidationAction}
            onExport={exportMethods.liquidations}
            onQueueRefresh={() => { fetchFinanceAddons(); onRefresh(); }}
          />
        )}

        {/* VIEW 5: BUDGET ALLOCATION & UTILIZATION */}
        {activeSubTab === "budgets" && (
          <div id="budget-officer-container" className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            
            {/* COMPREHENSIVE BUDGET OFFICER ROLE ROLE HEADER */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="bg-blue-500/20 text-blue-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-blue-500/35 uppercase tracking-wider font-mono">Budget Officer Authorized</span>
                  <span className="text-slate-400 text-xs">|</span>
                  <span className="text-xs text-slate-300 font-mono">RAB 1 Regional Treasury</span>
                </div>
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">Regional Budget Allocation, Requests & reporting desk</h1>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  Authorized workflow control center for earmarking programs, tracking obligation liquidations, approving realignments, and compiling FAR / SAAODB reports.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsFiscalYearModalOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-900 text-[10px] font-bold py-2 px-3 uppercase tracking-wider rounded-lg border flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                >
                  <Calendar size={13} />
                  <span>FY {activeFiscalYear} ACTIVE</span>
                </button>
                {isBudgetOrAdmin && currentFy?.status === "Active" && (
                  <button 
                    onClick={() => setIsConfirmingNewFy(true)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-900 text-[10px] font-bold py-2 px-3 uppercase tracking-wider rounded-lg border flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <Plus size={13} />
                    <span>Start New Fiscal Year</span>
                  </button>
                )}
                <button
                  onClick={exportMethods.budgets}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center shadow-sm cursor-pointer"
                >
                  <Download size={13} className="mr-1.5 text-blue-400" />
                  <span>Export Database</span>
                </button>
              </div>
            </div>

            {/* THE ROLE'S 7-FEATURE TAB SYSTEM */}
            <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-white p-1 rounded-xl shadow-xs">
              <button
                onClick={() => setInnerBudgetTab("allocations")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  innerBudgetTab === "allocations" 
                    ? "bg-slate-900 text-white shadow-sm" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Percent size={14} />
                <span>Allocation & Utilization Tracking</span>
              </button>

              <button
                onClick={() => setInnerBudgetTab("requests")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all relative flex items-center space-x-2 cursor-pointer ${
                  innerBudgetTab === "requests" 
                    ? "bg-slate-900 text-white shadow-sm" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Clock size={14} />
                <span>Adjustments & Requests Hub</span>
                {budgetRequests.filter(r => r.status === "Pending").length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                    {budgetRequests.filter(r => r.status === "Pending").length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setInnerBudgetTab("linking")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  innerBudgetTab === "linking" 
                    ? "bg-slate-900 text-white shadow-sm" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Activity size={14} />
                <span>Activity & Budget Linking</span>
              </button>

              <button
                onClick={() => setInnerBudgetTab("reporting")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  innerBudgetTab === "reporting" 
                    ? "bg-slate-900 text-white shadow-sm" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <FileSpreadsheet size={14} />
                <span>SAODB, FAR & Consolidation</span>
              </button>
            </div>

            
            {/* TAB 1 CONTENT: BUDGET ALLOCATION & UTILIZATION TRACKING */}
            {innerBudgetTab === "allocations" && (
              <div className="space-y-6">
                {(() => {
                  const tb = currentFy ? trainingBudgets.find(b => b.fiscalYearId === currentFy.id) : null;
                  const approved = tb ? tb.totalBudget : 0;
                  
                  return (
                    <div className="bg-white border rounded-2xl p-5 shadow-sm mb-6 flex flex-col md:flex-row gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-sm font-extrabold uppercase text-slate-800 font-mono tracking-wider">Annual Training & Seminar Expense Budget ({activeFiscalYear})</h3>
                          {user.role === UserRole.BUDGET_OFFICER && currentFy?.status === "Active" && (
                            editingTrainingBudget ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  value={newTrainingBudgetVal}
                                  onChange={(e) => setNewTrainingBudgetVal(e.target.value)}
                                  className="w-32 text-xs font-mono p-1 border rounded"
                                  autoFocus
                                />
                                <button
                                  onClick={async () => {
                                    const val = Number(newTrainingBudgetVal);
                                    if (!isNaN(val) && currentFy) {
                                      const res = await apiCall("/api/training/budgets", {
                                        method: "POST",
                                        body: JSON.stringify({ fiscalYearId: currentFy.id, newAnnualBudget: val })
                                      });
                                      if (res.status === "success") {
                                        const tbRes = await apiCall("/api/training/budgets");
                                        if (tbRes.status === "success") setTrainingBudgets(tbRes.data);
                                      }
                                      setEditingTrainingBudget(false);
                                    }
                                  }}
                                  className="text-[10px] uppercase font-bold text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingTrainingBudget(false)}
                                  className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingTrainingBudget(true);
                                  setNewTrainingBudgetVal((tb?.newAnnualBudget !== undefined ? tb.newAnnualBudget : ((tb?.totalBudget || 0) - (tb?.carryOverBudget || 0))).toString());
                                }}
                                className="text-[10px] uppercase font-mono tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 cursor-pointer"
                              >
                                Edit Annual Budget
                              </button>
                            )
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-b pb-4">
                          <div className="flex flex-col bg-slate-50 p-3 rounded-lg border">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Carry Over Budget</span>
                            <span className="text-xl font-bold text-teal-700 tracking-tight">{formatCurrency(tb?.carryOverBudget || 0)}</span>
                          </div>
                          <div className="flex flex-col bg-slate-50 p-3 rounded-lg border">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">New Annual Budget</span>
                            <span className="text-xl font-bold text-blue-700 tracking-tight">{formatCurrency(tb?.newAnnualBudget !== undefined ? tb.newAnnualBudget : ((tb?.totalBudget || 0) - (tb?.carryOverBudget || 0)))}</span>
                          </div>
                          {/* Allocated and Spent are derived server-side from the training
                              programs themselves, so they always match HR's planner. */}
                          <div className="flex flex-col bg-slate-50 p-3 rounded-lg border">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Allocated by HR</span>
                            <span className="text-xl font-bold text-indigo-700 tracking-tight">{formatCurrency(tb?.allocated || 0)}</span>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5">{tb?.percentAllocated || 0}% of total</span>
                          </div>
                          <div className="flex flex-col bg-slate-50 p-3 rounded-lg border">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Actually Spent</span>
                            <span className="text-xl font-bold text-amber-700 tracking-tight">{formatCurrency(tb?.spent || 0)}</span>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5">{tb?.percentSpent || 0}% of total</span>
                          </div>
                          <div className="flex flex-col bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            <span className="text-[10px] uppercase font-bold text-blue-800 mb-1">Unallocated</span>
                            <span className={`text-2xl font-extrabold tracking-tight ${(tb?.unallocated ?? approved) < 0 ? "text-red-600" : "text-slate-900"}`}>{formatCurrency(tb?.unallocated ?? approved)}</span>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5">of {formatCurrency(approved)} total</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">
                          This budget is set by the Budget Officer. HR allocates portions of it to Training and Development Plans; program and participant details are managed by HR in Training Plan &amp; Budget.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 2 CONTENT: AGREEMENTS AND BUDGET REQUEST ADJUSTMENTS */}
            {innerBudgetTab === "requests" && (
              <div className="space-y-6">
                
                {/* REQUEST AD-HOC PANEL */}
                {isAddBudgetRequestOpen ? (
                  <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">Create Realignment/Augmentation Proposal</h4>
                      <button onClick={() => setIsAddBudgetRequestOpen(false)} className="text-slate-400 hover:text-slate-950 font-bold text-xs">✕ Close Form</button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-500">Destination Department</label>
                        <select
                          value={addBudgetRequestForm.department}
                          onChange={(e) => setAddBudgetRequestForm({ ...addBudgetRequestForm, department: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs font-semibold rounded-lg"
                        >
                          {budgets.map(b => (
                            <option key={b.id} value={b.department}>{b.department}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-500">Amount to Request (PHP)</label>
                        <input
                          type="number"
                          placeholder="e.g. 150000"
                          value={addBudgetRequestForm.amountRequested}
                          onChange={(e) => setAddBudgetRequestForm({ ...addBudgetRequestForm, amountRequested: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs font-mono font-bold rounded-lg"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-500">Proposal Request Type</label>
                        <select
                          value={addBudgetRequestForm.requestType}
                          onChange={(e) => setAddBudgetRequestForm({ ...addBudgetRequestForm, requestType: e.target.value as any })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs font-semibold rounded-lg"
                        >
                          <option value="Augmentation">Allotment Augmentation</option>
                          <option value="Realignment">Fund Realignment</option>
                          <option value="Emergency">Emergency Allotment</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-500">Purpose / Rational Basis for Request</label>
                      <textarea
                        rows={2}
                        placeholder="State technical justification..."
                        value={addBudgetRequestForm.purpose}
                        onChange={(e) => setAddBudgetRequestForm({ ...addBudgetRequestForm, purpose: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 text-xs rounded-lg"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!addBudgetRequestForm.amountRequested || !addBudgetRequestForm.purpose) {
                          return alert("Please fill amount and purpose basis.");
                        }
                        await handleCreateBudgetRequest(
                          addBudgetRequestForm.department,
                          Number(addBudgetRequestForm.amountRequested),
                          addBudgetRequestForm.requestType,
                          addBudgetRequestForm.purpose
                        );
                        setIsAddBudgetRequestOpen(false);
                        setAddBudgetRequestForm({ department: "Adjudication Division", amountRequested: "", requestType: "Augmentation", purpose: "" });
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-mono text-xs px-4 py-2 font-bold shadow-sm cursor-pointer"
                    >
                      Submit Adjustments Proposal
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500">Monitor budget requests, realignments, and supplemental fund requests filed by departments.</p>
                    {currentFy?.status === "Active" && (
                      <button
                        onClick={() => setIsAddBudgetRequestOpen(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-mono text-[11px] px-3 py-1.5 rounded-lg flex items-center space-x-1 font-bold shadow-sm cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Filing Supplemental Proposal</span>
                      </button>
                    )}
                  </div>
                )}

                {/* THE BUDGET ADJUSTMENT PROPOSALS TABLE */}
                <div className="bg-white border rounded-2xl shadow-sm overflow-hidden border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-4">Requested Div/Dept</th>
                        <th className="p-4">Proposal Type</th>
                        <th className="p-4 text-right">Requested Sum</th>
                        <th className="p-4">Basis / Purpose Of Request</th>
                        <th className="p-4">Filer Date</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-center">Action Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {budgetRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-bold text-slate-800">{req.department}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[9px] bg-indigo-50 border border-indigo-200 font-semibold text-indigo-700">
                              {req.requestType}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-slate-900">{formatCurrency(req.amountRequested)}</td>
                          <td className="p-4 text-slate-500 text-xs max-w-xs truncate" title={req.purpose}>{req.purpose}</td>
                          <td className="p-4 text-slate-400 select-none font-mono text-[10px]">{formatDate(req.createdAt)}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              req.status === "Approved" 
                                ? "bg-emerald-50 text-emerald-800 border-emerald-250 border" 
                                : req.status === "Returned" 
                                ? "bg-rose-50 text-rose-800 border-rose-200 border" 
                                : "bg-amber-50 text-amber-800 border-amber-250 border animate-pulse"
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {req.status === "Pending" ? (
                              user.role === UserRole.SUPER_ADMIN && currentFy?.status === "Active" ? (
                                rejectingRequestId === req.id ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="text"
                                      placeholder="Reason..."
                                      value={rejectReason}
                                      onChange={(e) => setRejectReason(e.target.value)}
                                      className="w-24 text-[10px] font-mono p-1 border border-rose-300 rounded"
                                      autoFocus
                                    />
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => {
                                          if (rejectReason.trim()) {
                                            handleActionBudgetRequest(req.id, "Returned", rejectReason.trim());
                                            setRejectingRequestId(null);
                                            setRejectReason("");
                                          }
                                        }}
                                        className="bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded cursor-pointer"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => {
                                          setRejectingRequestId(null);
                                          setRejectReason("");
                                        }}
                                        className="bg-slate-200 text-slate-700 text-[9px] px-1.5 py-0.5 rounded cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-1.5 justify-center">
                                    <button
                                      onClick={() => handleActionBudgetRequest(req.id, "Approved")}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded text-[10px] cursor-pointer"
                                    >
                                      Approve & Allot
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectingRequestId(req.id);
                                        setRejectReason("");
                                      }}
                                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2 py-1 rounded text-[10px] cursor-pointer"
                                    >
                                      Return & Reject
                                    </button>
                                  </div>
                                )
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono italic">
                                  Awaiting Division Chief Concurrence
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] italic text-slate-400 font-mono">
                                {req.remarks ? `${req.status}: ${req.remarks}` : `Approved by ${req.approvedBy || "Division Chief"}`}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {budgetRequests.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400 font-mono italic">No supplemental budget proposals stored.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* TAB 3 CONTENT: DETAILED BUDGET & EMPLOYEE ACTIVITY LINKING */}
            {innerBudgetTab === "linking" && (
              <div className="space-y-6">
                
                {/* THE LINKER CARD CONTROL BOARD */}
                <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
                  <h4 className="text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider">Connect Validated Employee Activity to Budget Allocations</h4>
                  <p className="text-xs text-slate-550 leading-relaxed md:max-w-2xl">
                    A liquidation submission is linked to the employee’s account, personnel record, assigned activity, uploaded financial documents, and related budget record.
                    Connect real-time employee cash advance expenditures to specific budget allotment buckets.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-dashed">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-500">1. Select Employee Liquidation</label>
                      <select
                        value={selectedLinkingLiqId}
                        onChange={(e) => setSelectedLinkingLiqId(e.target.value)}
                        className="w-full border p-2 text-xs bg-white rounded-lg font-bold"
                      >
                        <option value="">-- Choose Active Submission --</option>
                        {submissions.filter(s => s.status === "Completed" && !budgetLinks.some(bl => bl.liquidationNo === s.submissionNo)).map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.submissionNo} - {l.employeeName} ({formatCurrency(l.totalReleased)} released)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-500">2. Link to Target Budget Record</label>
                      <select
                        value={selectedLinkingBudgetId}
                        onChange={(e) => setSelectedLinkingBudgetId(e.target.value)}
                        className="w-full border p-2 text-xs bg-white rounded-lg font-bold"
                      >
                        <option value="">-- Choose Budget Bucket --</option>
                        {budgets.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.department} - Available Cap: {formatCurrency(b.remainingBudget)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={async () => {
                          if (!selectedLinkingLiqId || !selectedLinkingBudgetId) {
                            return alert("Please select both a Liquidation advance and a Budget record");
                          }
                          const liq = submissions.find(l => l.id === selectedLinkingLiqId);
                          const bud = budgets.find(b => b.id === selectedLinkingBudgetId);
                          if (liq && bud) {
                            try {
                              const amountVal = liq.totalSpent || 0;
                              const res = await apiCall("/api/finance/activity-budget-links", {
                                method: "POST",
                                body: JSON.stringify({
                                  liquidationNo: liq.submissionNo,
                                  employee: liq.employeeName,
                                  department: bud.department,
                                  amount: amountVal,
                                  budgetId: bud.id
                                })
                              });
                              if (res.status === "success") {
                                setBudgetLinks([res.data, ...budgetLinks]);
                                setBudgets(budgets.map(b => {
                                  if (b.id === bud.id) {
                                    const spent = Number(liq.totalSpent || 0);
                                    const utilized = b.budgetUtilized + spent;
                                    const unliquidated = (b.unliquidatedAdvances || 0);
                                    return {
                                      ...b,
                                      budgetUtilized: utilized,
                                      unliquidatedAdvances: unliquidated,
                                      remainingBudget: b.budgetAllocation + (b.carryOver || 0) - utilized - unliquidated,
                                      budgetPercentageUsed: Math.round((utilized / (b.budgetAllocation + (b.carryOver || 0))) * 100)
                                    };
                                  }
                                  return b;
                                }));
                                setSelectedLinkingLiqId("");
                                setSelectedLinkingBudgetId("");
                                alert(`Activity ${liq.submissionNo} successfully mapped to budget ${bud.department}!`);
                              } else {
                                alert("Failed to establish link: " + (res.message || "Unknown error"));
                              }
                            } catch (e: any) {
                              alert("Error establishing link: " + e.message);
                            }
                          }
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold p-2.5 rounded-lg flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                      >
                        <Activity size={13} />
                        <span>Establish Integration Link</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* THE LINKING ACTIVITY LEDGER RECORD */}
                <div className="bg-white border text-xs rounded-xl shadow-sm border-slate-200">
                  <div className="p-4 border-b font-extrabold uppercase font-mono tracking-wider text-slate-700">
                    Integration Ledger: Validated Employee Activity & Budget Mappings
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3">Linking ID</th>
                          <th className="p-3">Liquidation Number</th>
                          <th className="p-3">Employee Personnel Reference</th>
                          <th className="p-3">Assigned Activity Division</th>
                          <th className="p-3">Mapped Budget Allotment</th>
                          <th className="p-3 text-right">Amount Liquidated</th>
                          <th className="p-3">Integration Timestamp</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[10px]">
                        {budgetLinks.map((link) => (
                          <tr key={link.id} className="hover:bg-slate-50/40">
                            <td className="p-3 text-slate-400">{link.id}</td>
                            <td className="p-3 font-bold text-blue-700">{link.liquidationNo}</td>
                            <td className="p-3 font-sans truncate font-semibold text-slate-705">{link.employee}</td>
                            <td className="p-3 font-sans">{link.department}</td>
                            <td className="p-3 text-slate-700 font-sans font-bold">{link.department} Allotment</td>
                            <td className="p-3 text-right font-black text-slate-800">{formatCurrency(link.amount)}</td>
                            <td className="p-3 text-slate-400 font-mono">{formatDate(link.timestamp)}</td>
                            <td className="p-3 text-center">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase text-emerald-800 bg-emerald-50 border border-emerald-250">
                                Linked & Reconciled
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 4 CONTENT: COMPREHENSIVE CONSOLIDATION & SAODB FAR REPORTING GATEWAYS */}
            {innerBudgetTab === "reporting" && (
              <div className="space-y-6">
                
                {/* CONTROLS CARD */}
                <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-3 border-slate-100">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800 font-mono tracking-wider">SAODB and FAR Report Consolidation Engine</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Select a target reporting period. The validated budget allocations and active transactions are integrated dynamically.
                      </p>
                    </div>

                    <div className="flex gap-2 items-center mt-3 md:mt-0 bg-slate-50 p-2.5 rounded-xl border">
                      <select
                        value={consolidationPeriod}
                        onChange={(e) => {
                          setConsolidationPeriod(e.target.value as any);
                          setConsolidationValue(e.target.value === "Quarterly" ? "Q2" : "July");
                        }}
                        className="border bg-white text-xs p-1.5 rounded-md font-bold text-slate-700"
                      >
                        <option value="Monthly">Monthly Summary</option>
                        <option value="Quarterly">Quarterly Consolidation</option>
                      </select>

                      <select
                        value={consolidationValue}
                        onChange={(e) => setConsolidationValue(e.target.value)}
                        className="border bg-white text-xs p-1.5 rounded-md font-bold text-slate-700"
                      >
                        {consolidationPeriod === "Quarterly" ? (
                          <>
                            <option value="Q1">Q1 (January - March 2026)</option>
                            <option value="Q2">Q2 (April - June 2026)</option>
                            <option value="Q3">Q3 (July - September 2026)</option>
                            <option value="Q4">Q4 (October - December 2026)</option>
                          </>
                        ) : (
                          <>
                            <option value="January">January</option>
                            <option value="February">February</option>
                            <option value="March">March</option>
                            <option value="April">April</option>
                            <option value="May">May</option>
                            <option value="June">June</option>
                            <option value="July">July</option>
                            <option value="August">August</option>
                            <option value="September">September</option>
                            <option value="October">October</option>
                            <option value="November">November</option>
                            <option value="December">December</option>
                          </>
                        )}
                      </select>

                      <button
                        onClick={() => {
                          const csvContent = "Consolidation Report," + consolidationValue + "\n\nCategory,Amount\nTotal Income,0.00\nTotal Expenses,0.00\nBalance,0.00\n";
                          const blob = new Blob([csvContent], { type: "text/csv" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "Consolidation_" + consolidationValue + ".csv";
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Consolidate Range
                      </button>
                    </div>
                  </div>

                  {/* SAAODB INTEGRAL REUSE DOCUMENT EXPLANATION CONTAINER */}
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 text-slate-700">
                    <div className="flex items-center space-x-1">
                      <FileCheck size={14} className="text-indigo-600" />
                      <strong className="text-xs text-indigo-900 font-sans uppercase font-bold tracking-wide">Data Reuse and Automation Integration</strong>
                    </div>
                    <p className="text-xs leading-relaxed text-indigo-950">
                      Eliminate repeated manual encoding! All validated transaction disbursements and approved employee liquidation reports in the database are reused instantly to populate SAAODB (Statement of Allotments, Obligations, Disbursements and Balances) and Financial Accountability Reports (FAR 1, FAR 1-A).
                    </p>
                  </div>
                </div>

                 {/* SAAODB & FAR PREVIEW BOARD */}
                 <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-6">
                   
                   {(() => {
                     const SAAODBTotals = budgets.reduce((totals, b) => {
                       const deptTxns = (yearFilteredTxns || []).filter(t => t.department.toLowerCase() === b.department.toLowerCase());
                       
                       const txObligations = deptTxns
                         .filter(t => t.status === "Validated" || t.status === "Liquidated")
                         .reduce((sum, t) => sum + t.amount, 0);
                         
                       const txDisbursements = deptTxns
                         .filter(t => t.status === "Liquidated")
                         .reduce((sum, t) => sum + t.amount, 0);

                       const totalPayroll = 0; // Employees payroll disabled to allow zero start
                       const obligations = txObligations + totalPayroll;
                       const disbursements = txDisbursements;

                       totals.allotment += b.budgetAllocation + (b.carryOver || 0);
                       totals.obligations += obligations;
                       totals.disbursements += disbursements;
                       return totals;
                     }, { allotment: 0, obligations: 0, disbursements: 0 });

                     const unpaidAllotmentBalance = SAAODBTotals.allotment - SAAODBTotals.obligations;

                     return (
                       <>
                         {/* Report Cover */}
                         <div className="text-center space-y-1 py-4 border-b border-dashed">
                           <h2 className="text-lg font-black text-slate-900 tracking-tight">STATEMENT OF ALLOTMENTS, OBLIGATIONS, DISBURSEMENTS AND BALANCES (SAAODB)</h2>
                           <h3 className="text-xs uppercase font-mono tracking-widest text-slate-500 font-extrabold">FAR FORM NO. 1 & 1A INTEGRAL ACCRUAL PREVIEW</h3>
                           <p className="text-[10px] text-slate-400 font-mono">Consolidated Period Target: <span className="text-blue-600 font-bold">{consolidationValue} 2026</span> | Entity Code: HSAC-RAB1-PH</p>
                         </div>

                         {/* Summary grid */}
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                           <div className="p-3 bg-slate-50 border rounded-xl">
                             <p className="text-[9px] font-mono text-slate-400 uppercase">Consolidated Allotment</p>
                             <p className="text-xs font-black text-slate-800 pt-1">
                               {formatCurrency(SAAODBTotals.allotment)}
                             </p>
                           </div>
                           <div className="p-3 bg-slate-50 border rounded-xl">
                             <p className="text-[9px] font-mono text-slate-400 uppercase">Consolidated Obligations</p>
                             <p className="text-xs font-black text-indigo-700 pt-1">
                               {formatCurrency(SAAODBTotals.obligations)}
                             </p>
                           </div>
                           <div className="p-3 bg-slate-50 border rounded-xl">
                             <p className="text-[9px] font-mono text-slate-400 uppercase">Consolidated disbursements</p>
                             <p className="text-xs font-black text-emerald-800 pt-1">
                               {formatCurrency(SAAODBTotals.disbursements)}
                             </p>
                           </div>
                           <div className="p-3 bg-slate-50 border rounded-xl">
                             <p className="text-[9px] font-mono text-slate-400 uppercase">Unpaid Balance Of Allotment</p>
                             <p className="text-xs font-black text-rose-700 pt-1">
                               {formatCurrency(unpaidAllotmentBalance)}
                             </p>
                           </div>
                         </div>

                         {/* Dynamic populated row records */}
                         <div className="overflow-x-auto rounded-lg border">
                           <table className="w-full text-left text-xs border-collapse">
                             <thead>
                               <tr className="bg-slate-900 text-white font-mono uppercase text-[9px] tracking-wide border-b">
                                 <th className="p-3">Accrued Program (PAP) Class</th>
                                 <th className="p-3 text-right">Approved Base Allotment</th>
                                 <th className="p-3 text-right">Retained Surplus (Carryover)</th>
                                 <th className="p-3 text-right">Total Active Allotment</th>
                                 <th className="p-3 text-right">Registered Obligations</th>
                                 <th className="p-3 text-right">Actual Disbursements</th>
                                 <th className="p-3 text-right">Unpaid Obligations</th>
                                 <th className="p-3 text-right">Remaining Balance</th>
                                 <th className="p-3 text-center">Coverage Burn</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y font-mono text-[10px]">
                               {budgets.map((b) => {
                                 const deptTxns = (yearFilteredTxns || []).filter(t => t.department.toLowerCase() === b.department.toLowerCase());
                                 
                                 const txObligations = deptTxns
                                   .filter(t => t.status === "Validated" || t.status === "Liquidated")
                                   .reduce((sum, t) => sum + t.amount, 0);
                                   
                                 const txDisbursements = deptTxns
                                   .filter(t => t.status === "Liquidated")
                                   .reduce((sum, t) => sum + t.amount, 0);

                                 const totalPayroll = 0; // Employees payroll disabled to allow zero start
                                 const obligations = txObligations + totalPayroll;
                                 const disbursements = txDisbursements;
                                 const unliquidated = b.unliquidatedAdvances || 0;

                                 const unpaidObs = obligations - disbursements;
                                 const remAllotment = b.budgetAllocation + (b.carryOver || 0) - obligations - unliquidated;
                                 return (
                                   <tr key={b.id} className="hover:bg-slate-50/50">
                                     <td className="p-3 font-sans font-bold text-slate-800">{b.department}</td>
                                     <td className="p-3 text-right font-bold">{formatCurrency(b.budgetAllocation)}</td>
                                     <td className="p-3 text-right font-semibold text-teal-700">{formatCurrency(b.carryOver || 0)}</td>
                                     <td className="p-3 text-right font-bold text-blue-700">{formatCurrency(b.budgetAllocation + (b.carryOver || 0))}</td>
                                     <td className="p-3 text-right text-indigo-700 font-semibold">{formatCurrency(obligations)}</td>
                                     <td className="p-3 text-right text-emerald-700 font-semibold">{formatCurrency(disbursements)}</td>
                                     <td className="p-3 text-right text-slate-600">{formatCurrency(unpaidObs)}</td>
                                     <td className="p-3 text-right font-black text-rose-750">{formatCurrency(remAllotment)}</td>
                                     <td className="p-3 text-center">
                                       <span className="bg-blue-50 text-blue-900 rounded font-bold px-1 py-0.5 text-[9px]">
                                         {Math.round((obligations / (b.budgetAllocation + (b.carryOver || 0))) * 100)}% utilized
                                       </span>
                                     </td>
                                   </tr>
                                 );
                               })}
                             </tbody>
                           </table>
                         </div>
                       </>
                     );
                   })()}

                  {/* Printing / Finalization controllers */}
                  <div className="p-4 bg-slate-50 rounded-xl flex flex-col md:flex-row justify-between items-center gap-3">
                    <div className="text-[10px] text-slate-500 font-mono">
                      * Generated dynamically using validated active transaction logs. No manual input errors. Code: FAR-1-SAAODB-HSAC
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          window.print();
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                      >
                        Print SAAODB Report
                      </button>
                      <button
                        onClick={() => {
                          {
                            const data = budgets.map(b => {
                              const deptYearTxns = yearFilteredTxns.filter(t => (t.department || "").toLowerCase() === b.department.toLowerCase());
                              const txObligations = deptYearTxns.filter(t => t.status === "Validated" || t.status === "Liquidated").reduce((sum, t) => sum + t.amount, 0);
                    const totalPayroll = 0; // Employees payroll disabled to allow zero start
                    const obligations = txObligations + totalPayroll;
                              return {
                                "UACS Code": b.uacsCode || "N/A",
                                "Department": b.department,
                                "Total Allocation": b.budgetAllocation + (b.carryOver || 0),
                                "Obligations Incurred": obligations,
                                "Unobligated Balance": b.budgetAllocation + (b.carryOver || 0) - obligations
                              };
                            });
                            downloadCSV(data, ["UACS Code", "Department", "Total Allocation", "Obligations Incurred", "Unobligated Balance"], "HSAC_FAR1_CONSOLIDATED_" + consolidationValue + ".csv");
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                      >
                        Finalize & Download FAR Form
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

        {/* VIEW 6: FINANCE AUDIT TRAIL REVISIONS TABLE */}
        {activeSubTab === "auditLogs" && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <div className="flex justify-between items-center bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
              <div>
                <h1 className="text-md font-bold text-slate-900 flex items-center gap-1">
                  <span>Immutability Audit Revisions Ledger</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">Chronological trace logs capturing exact revisions including User, Action, Coordinates, Previous Value and New Value.</p>
              </div>
            </div>

            {/* AUDIT TIMELINE RECORDS */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-y-auto max-h-[550px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-4 w-40">Timestamp</th>
                      <th className="p-4">Finance Officer</th>
                      <th className="p-4">Operational Action</th>
                      <th className="p-4">Target Module</th>
                      <th className="p-4">Previous state reference</th>
                      <th className="p-4">New validated state</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[10px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="p-4 text-slate-400 select-none">{formatDate(log.timestamp)}</td>
                        <td className="p-4 font-bold text-slate-850 font-sans text-xs">{log.user}</td>
                        <td className="p-4 font-bold text-amber-700">{log.action}</td>
                        <td className="p-4 text-slate-600 font-sans font-semibold text-xs">{log.module}</td>
                        <td className="p-4 text-rose-600 line-through truncate max-w-[150px]">{log.previousValue}</td>
                        <td className="p-4 text-emerald-600 font-black truncate max-w-[150px]">{log.newValue}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400 italic">No revision logs inside immutability ledger.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* RECORD NEW EXPENSE MODAL */}
      {isTxModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in scale-in-95 duration-100">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono">Log General Expense Receipt</h3>
              <button onClick={() => setIsTxModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTx} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Supplier / Vendor Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Petron Gas Terminal SF"
                  value={txFormData.supplier}
                  onChange={(e) => setTxFormData({ ...txFormData, supplier: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Disbursed Cost Amount (PHP) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="25000.00"
                    value={txFormData.amount}
                    onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                    className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Transaction Date *</label>
                  <input
                    required
                    type="date"
                    value={txFormData.transactionDate}
                    onChange={(e) => setTxFormData({ ...txFormData, transactionDate: e.target.value })}
                    className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Transaction Category *</label>
                  <select
                    value={txFormData.category}
                    onChange={(e) => setTxFormData({ ...txFormData, category: e.target.value })}
                    className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs"
                  >
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Travel Expenses">Travel Expenses</option>
                    <option value="Fuel/Tolls">Fuel/Tolls</option>
                    <option value="Utility Bills">Utility Bills</option>
                    <option value="Professional Services">Professional Services</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Department Division Allocation *</label>
                  <select
                    value={txFormData.department}
                    onChange={(e) => setTxFormData({ ...txFormData, department: e.target.value })}
                    className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs"
                  >
                    <option value="Adjudication Division">Adjudication Division</option>
                    <option value="Administrative and Finance Division">Administrative and Finance Division</option>
                    <option value="Legal Division">Legal Division</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-gray block">Employee Reference ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP006"
                    value={txFormData.employeeRef}
                    onChange={(e) => setTxFormData({ ...txFormData, employeeRef: e.target.value })}
                    className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-gray block">Receipt Digital Stamp Filename</label>
                  <input
                    type="text"
                    placeholder="PetronSlip_921.png"
                    value={txFormData.receiptFilename}
                    onChange={(e) => setTxFormData({ ...txFormData, receiptFilename: e.target.value })}
                    className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Expense Scope Description *</label>
                <textarea
                  required
                  placeholder="Provide brief summary explaining transaction purposes (e.g. purchase of high-resolution projectors for hearings room)..."
                  value={txFormData.description}
                  onChange={(e) => setTxFormData({ ...txFormData, description: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs h-20"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 font-semibold px-5 py-2 rounded-lg text-xs shadow-md cursor-pointer"
                >
                  Submit Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BACKING ATTACHMENT MODAL */}
      {isDocModalOpen && selectedTx && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-100">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono">Upload Supporting Document</h3>
              <button onClick={() => setIsDocModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddDoc} className="p-5 space-y-4">
              <p className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-150 leading-relaxed font-semibold select-none">
                Attaching secondary audit file to transaction index: <strong className="text-slate-700 font-mono">{selectedTx.transactionId}</strong>
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Document Label Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Verified Supplier Invoice"
                  value={docFormData.name}
                  onChange={(e) => setDocFormData({ ...docFormData, name: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Voucher Classification *</label>
                <select
                  value={docFormData.type}
                  onChange={(e) => setDocFormData({ ...docFormData, type: e.target.value as any })}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs animate-none"
                >
                  <option value="Purchase Request">Purchase Request (PR)</option>
                  <option value="Invoice">Supplier Invoice (INV)</option>
                  <option value="Disbursement Voucher">Disbursement Voucher (DV)</option>
                  <option value="Liquidation Report">Liquidation Report (LR)</option>
                  <option value="Other">Other supporting files</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">File Reference Name</label>
                <input
                  type="text"
                  placeholder="INV_2026_9921_Scan.pdf"
                  value={docFormData.filename}
                  onChange={(e) => setDocFormData({ ...docFormData, filename: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 font-semibold px-4 py-1.5 rounded-lg text-xs shadow-sm cursor-pointer"
                >
                  Upload Supporting File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VALUATION STATUS ADJUDICATOR STATUS MODAL */}
      {isAuditModalOpen && selectedTx && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-100">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono">Evaluate Validation Stage</h3>
              <button onClick={() => setIsAuditModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAudit} className="p-5 space-y-4">
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-slate-700 text-[11px] leading-relaxed rounded-xl font-medium select-none">
                Updating status of transaction <code className="font-bold text-slate-900 bg-white px-1 py-0.5 rounded border">{selectedTx.transactionId}</code> matching disbursed value {formatCurrency(selectedTx.amount)}.
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Select Workflow Stage *</label>
                <select
                  value={auditFormData.status}
                  onChange={(e) => setAuditFormData({ ...auditFormData, status: e.target.value as any })}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value={TransactionStatus.PENDING_VALIDATION}>Pending Validation</option>
                  <option value={TransactionStatus.UNDER_REVIEW}>Under Review</option>
                  <option value={TransactionStatus.VALIDATED}>Validated (Cleared for liquidation)</option>
                  <option value={TransactionStatus.LIQUIDATED}>Liquidated (Reconciliation completed)</option>
                  <option value={TransactionStatus.ARCHIVED}>Archived</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Ledger Auditor remarks *</label>
                <textarea
                  required
                  placeholder="Describe receipt checking details or treasury voucher clearing codes..."
                  value={auditFormData.remarks}
                  onChange={(e) => setAuditFormData({ ...auditFormData, remarks: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs h-24 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end animate-none">
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 font-semibold px-4 py-1.5 rounded-lg text-xs shadow-sm cursor-pointer"
                >
                  Validate Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      

      {/* LIQUIDATION TRIAGE ACTION MODAL */}
      {isLiqActionModalOpen && selectedLiq && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-100">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono">Triage Liquidation Workflow</h3>
              <button onClick={() => setIsLiqActionModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleLiqAction} className="p-5 space-y-4">
              <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200 p-2.5 rounded-lg font-medium">
                Advancing liquidation loop for <strong className="text-slate-700">{selectedLiq.employee}</strong>. Released advance is {formatCurrency(selectedLiq.amountReleased)}.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Adjust Workflow Stage *</label>
                <select
                  value={liqActionData.status}
                  onChange={(e) => setLiqActionData({ ...liqActionData, status: e.target.value as any })}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs text-slate-800"
                >
                  <option value="Pending Submission">Pending Submission</option>
                  <option value="Submitted">Submitted ( slop receipts presented )</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Completed">Completed ( Close advance, charge budget )</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">Approved Cash Spent Amount (PHP)</label>
                <input
                  type="number"
                  placeholder="e.g. 4800.00"
                  value={liqActionData.amountLiquidated}
                  onChange={(e) => setLiqActionData({ ...liqActionData, amountLiquidated: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">Workflow notes</label>
                <textarea
                  placeholder="Receipt checked, matched bank deposit voucher references cleanly..."
                  value={liqActionData.notes}
                  onChange={(e) => setLiqActionData({ ...liqActionData, notes: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs h-20"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsLiqActionModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 font-semibold px-4 py-1.5 rounded-lg text-xs shadow-sm cursor-pointer"
                >
                  Confirm Shifting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* VERSION HISTORY ARCHIVE MODAL */}
      {isVersionHistoryModalOpen && selectedVaultDoc && selectedVaultTx && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-100">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono">Dossier File Version History</h3>
              <button 
                onClick={() => {
                  setIsVersionHistoryModalOpen(false);
                  setSelectedVaultDoc(null);
                  setSelectedVaultTx(null);
                }} 
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider block">Target Reference</span>
                <p className="text-xs font-bold text-slate-800">
                  {selectedVaultDoc.name} <span className="text-[9px] text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded-full capitalize font-semibold ml-2 inline-block">{selectedVaultDoc.type}</span>
                </p>
                <code className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold block w-fit">
                  {selectedVaultTx.transactionId}
                </code>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block font-bold">Certified Version Logs</label>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {(!selectedVaultDoc.versions || selectedVaultDoc.versions.length === 0) ? (
                    <div className="flex items-start space-x-3 p-2.5 rounded-lg border border-dashed border-slate-200">
                      <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded-full text-xs font-black">1</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{selectedVaultDoc.filename}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Uploaded: {formatDate(selectedVaultDoc.uploadedAt)} • {selectedVaultDoc.uploadedBy || "Andres B. Bonifacio"}</p>
                      </div>
                    </div>
                  ) : (
                    selectedVaultDoc.versions.map((v, idx) => (
                      <div key={idx} className="flex items-start space-x-3 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
                        <div className="bg-slate-900 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-mono font-black">{v.version}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate" title={v.filename}>{v.filename}</p>
                          <p className="text-[10px] text-slate-400 font-mono">Uploaded: {formatDate(v.uploadedAt)} • {v.uploadedBy || "Staff uploader"}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 font-mono leading-relaxed select-none">
                This document is secured and validated. Modifications are version controlled in compliance with audited public sector ledger accountability mandates.
              </p>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsVersionHistoryModalOpen(false);
                    setSelectedVaultDoc(null);
                    setSelectedVaultTx(null);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-1.5 rounded-lg text-xs shadow-sm cursor-pointer"
                >
                  Close Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPLACE FILE MODAL */}
      {isReplaceFileModalOpen && selectedVaultDoc && selectedVaultTx && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-100">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono">Replace supporting document</h3>
              <button 
                onClick={() => {
                  setIsReplaceFileModalOpen(false);
                  setSelectedVaultDoc(null);
                  setSelectedVaultTx(null);
                  setReplacementFilename("");
                }} 
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleReplaceDocument} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider block">Replacing Document Instance</span>
                <p className="text-xs font-bold text-slate-800">
                  {selectedVaultDoc.name}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">Current: {selectedVaultDoc.filename}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block font-bold">New file reference name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. AMENDED_INV_2026.pdf"
                  value={replacementFilename}
                  onChange={(e) => setReplacementFilename(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="p-3 border border-dashed border-slate-200 rounded-lg bg-indigo-50/25 space-y-1 select-none">
                <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest font-mono">Secure PDF Dropzone Check</span>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Drag and drop your amended document or use browser selection. New revisions are stamped under active identity of {user.fullName}.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsReplaceFileModalOpen(false);
                    setSelectedVaultDoc(null);
                    setSelectedVaultTx(null);
                    setReplacementFilename("");
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-slate-900 border border-slate-850 text-white hover:bg-slate-800 font-semibold px-4 py-1.5 rounded-lg text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Archiving..." : "Amend & Save Revision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FISCAL YEAR MODAL */}
      {isConfirmingNewFy && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <h3 className="font-semibold text-sm tracking-tight text-amber-800 flex items-center gap-2">
                <AlertTriangle size={16} />
                Confirm New Fiscal Year
              </h3>
              <button 
                onClick={() => setIsConfirmingNewFy(false)}
                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to start Fiscal Year <span className="font-bold">{String(Number(activeFiscalYear) + 1)}</span>? 
              </p>
              <p className="text-xs text-slate-500">
                This will automatically close {activeFiscalYear} and calculate carryover balances for all active division funds. This action cannot be easily reversed.
              </p>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsConfirmingNewFy(false)}
                  className="flex-1 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsConfirmingNewFy(false);
                    handleStartNewFiscalYear();
                  }}
                  className="flex-1 bg-amber-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
                >
                  Confirm & Start
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {isFiscalYearModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-sm tracking-tight text-slate-800 flex items-center gap-2">
                <Calendar size={16} className="text-blue-600" />
                Select Fiscal Year
              </h3>
              <button 
                onClick={() => setIsFiscalYearModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">
                  Available Fiscal Years
                </label>
                <div className="relative">
                  <select 
                    value={activeFiscalYear}
                    onChange={(e) => {
                      setActiveFiscalYear(e.target.value);
                      setIsFiscalYearModalOpen(false);
                    }}
                    className="w-full bg-white border border-slate-300 text-slate-800 p-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm cursor-pointer appearance-none"
                  >
                    {fiscalYears.length > 0 ? (
                      fiscalYears.map(fy => (
                        <option key={fy.id} value={fy.label}>Fiscal Year {fy.label} {fy.status === "Active" ? "(Active)" : ""}</option>
                      ))
                    ) : (
                      <>
                        <option value="2026">Fiscal Year 2026</option>
                        <option value="2025">Fiscal Year 2025</option>
                        
                      </>
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                Selecting a prior fiscal year will automatically update all ledgers, reporting charts, and financial indicators.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
