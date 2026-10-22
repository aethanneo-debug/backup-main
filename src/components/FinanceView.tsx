import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import {
  FinancialTransaction,
  User,
  UserRole,
  Liquidation,
  BudgetAllocation,
  CashAdvance,
  ScreenFocus
} from "../types";
import { useRecordHighlight } from "./ui/useRecordHighlight";
import {
  LayoutDashboard,
  Plus,
  AlertTriangle,
  Download,
  BookOpen,
  ArrowUpRight,
  X,
  Edit2,
  Calendar,
  UserCheck,
  ChevronDown
} from "lucide-react";
import LiquidationDeskView from "./finance/LiquidationDeskView";
import FinanceOverview from "./finance/FinanceOverview";
import DocumentsVault from "./finance/DocumentsVault";
import { reportFiscalYear } from "./finance/overviewFigures";
import { apiCall, formatCurrency } from "../utils";

interface FinanceViewProps {
  user: User;
  transactions: FinancialTransaction[];
  employees?: any[];
  onRefresh: () => void;
  activeSubTab?: string;
  setActiveSubTab?: (tab: string) => void;
  /** From a notification: a liquidation report to show on the Liquidation Desk. */
  focus?: ScreenFocus | null;
  onFocusHandled?: () => void;
}

export default function FinanceView({
  user,
  transactions,
  employees = [],
  onRefresh,
  activeSubTab: propsActiveSubTab,
  setActiveSubTab: propsSetActiveSubTab,
  focus,
  onFocusHandled
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
  // The Overview Dashboard's own load: undefined until it first lands, so its cards say
  // "Loading…" rather than 0; then the cash advances (null if they couldn't be loaded) and which
  // other lists failed.
  const [overviewLoad, setOverviewLoad] = useState<
    { advances: CashAdvance[] | null; reportsFailed: boolean; budgetFailed: boolean } | undefined
  >(undefined);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [subRemarks, setSubRemarks] = useState("");

  // Selected details
  const [selectedLiq, setSelectedLiq] = useState<Liquidation | null>(null);

  // Form modals state
  const [isLiqModalOpen, setIsLiqModalOpen] = useState(false);
  const [isLiqActionModalOpen, setIsLiqActionModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // The fiscal year being viewed. Empty until the years load, then the active one (see
  // fetchFinanceAddons). It used to start at a hardcoded "2026", which was never
  // replaced, so the whole Finance view stayed on 2026 after 2027 became active.
  const [activeFiscalYear, setActiveFiscalYear] = useState<string>("");
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [isFiscalYearModalOpen, setIsFiscalYearModalOpen] = useState(false);
  const [isConfirmingNewFy, setIsConfirmingNewFy] = useState(false);

  // For budget edit
  const [editingBudget, setEditingBudget] = useState<BudgetAllocation | null>(null);
  const [newAllocationVal, setNewAllocationVal] = useState("");
  const [editingHsacBudgetId, setEditingHsacBudgetId] = useState<string | null>(null);
  const [newHsacApprVal, setNewHsacApprVal] = useState("");

  // Forms values
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

  const isBudgetOrAdmin = [UserRole.SUPER_ADMIN, UserRole.BUDGET_OFFICER].includes(user.role);

  // A notification opened the Liquidation Desk (App sets the sub-tab): reload it, then show the
  // report (scrolled to and outlined). Only after the fresh load lands (counted by
  // financeLoads): until then the report may still sit where it was before, e.g. in the index
  // rather than in the queue.
  const [financeLoads, setFinanceLoads] = useState(0);
  const [shownReport, setShownReport] = useState<{ id: string; key: number; afterLoad: number } | null>(null);
  // An employee's cash advance request: the request list loads on its own and shows it.
  const [focusAdvance, setFocusAdvance] = useState<{ id: string; nonce: number } | null>(null);
  useEffect(() => {
    if (!focus) return;
    if (focus.record?.kind === "liquidationReport") {
      setShownReport({ id: focus.record.id, key: focus.nonce, afterLoad: financeLoads });
      fetchFinanceAddons();
    } else if (focus.record?.kind === "cashAdvance") {
      setFocusAdvance({ id: focus.record.id, nonce: focus.nonce });
    }
    onFocusHandled?.();
  }, [focus?.nonce]);
  useRecordHighlight(shownReport && financeLoads > shownReport.afterLoad ? shownReport.id : null, shownReport?.key);

  // Budget Monitoring is the Budget Officer's (and the Administrator's). Nothing in Financial
  // Tracking leads there, and anyone else who lands on it anyway is sent back to the overview.
  // So is anyone on a page that no longer exists (the Transactions Journal, Revisions Audit: an
  // old link, or state kept by the dev server's hot reload), rather than seeing a blank page.
  useEffect(() => {
    const known = ["dashboard", "vault", "liquidation", "budgets"].includes(activeSubTab);
    if (!known || (activeSubTab === "budgets" && !isBudgetOrAdmin)) setActiveSubTab("dashboard");
  }, [activeSubTab, isBudgetOrAdmin]);

  // Opens the Liquidation Desk on a report, as a notification does: it is shown (scrolled to and
  // outlined) once the desk's fresh load lands. Used by the overview and the Documents Vault.
  const openReportOnDesk = (id: string) => {
    setShownReport({ id, key: Date.now(), afterLoad: financeLoads });
    setActiveSubTab("liquidation");
  };

  // Fetch liquidations, budgets, and logs
  async function fetchFinanceAddons() {
    try {
      const resFy = await apiCall("/api/fiscal-years").catch(() => null);
      if (Array.isArray(resFy)) setFiscalYears(resFy);
      // Open on the active fiscal year (the calendar year if none can be read), then stay
      // on whichever year the user picks with the FY button.
      let fyLabel = activeFiscalYear;
      if (!fyLabel) {
        const active = Array.isArray(resFy) ? resFy.find((f: any) => f.status === "Active") : null;
        fyLabel = active?.label || String(new Date().getFullYear());
        setActiveFiscalYear(fyLabel);
      }

      const resLiq = await apiCall("/api/finance/liquidations").catch(() => ({ status: "error", data: [] }));
      if (resLiq.status === "success") {
        setLiquidations(resLiq.data || []);
      }
      // Never without a year: an empty label returns every year's division budgets.
      const resBud = await apiCall(`/api/budgets?fiscalYearLabel=${fyLabel}`).catch(() => ({ status: "error", data: [] }));
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
      // Every report comes with its attached files inside, so the pages that don't show reports
      // skip it: Budget Monitoring (only the training budget) and the Documents Vault (its own
      // list carries no file contents).
      const resSub = activeSubTab === "budgets" || activeSubTab === "vault"
        ? null
        : await apiCall("/api/liquidation-submissions").catch(() => ({ status: "error", data: [] }));
      if (resSub?.status === "success") {
        setSubmissions(resSub.data || []);
      }
      // The Overview Dashboard also counts cash advances (requests waiting, advances still out).
      if (activeSubTab === "dashboard") {
        const resCa = await apiCall("/api/cash-advances").catch(() => ({ status: "error", data: [] }));
        setOverviewLoad({
          advances: resCa.status === "success" ? (resCa.data || []) : null,
          reportsFailed: resSub?.status !== "success",
          budgetFailed: resTb.status !== "success"
        });
      }
    } catch (err) {
      console.error("Error loading supplementary finance modules", err);
      if (activeSubTab === "dashboard") setOverviewLoad({ advances: null, reportsFailed: true, budgetFailed: true });
    } finally {
      setFinanceLoads(n => n + 1);
    }
  }

  // The ledger (Budget Monitoring's "Export Database" reads it); App loads it.
  useEffect(() => {
    setTxnList(transactions || []);
  }, [transactions]);

  useEffect(() => {
    fetchFinanceAddons();
  }, [activeSubTab, activeFiscalYear]);

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

  // Validate a liquidation report (Finance officer). A Return goes through its checklist
  // dialog on the Liquidation Desk instead.
  async function handleFinanceValidate(subId: string, remarks: string) {
    try {
      const res = await apiCall(`/api/liquidation-submissions/${subId}/finance-action`, {
        method: "PUT",
        body: JSON.stringify({ action: "Validate", remarks: remarks || "Financial documentations validated & finalized." })
      });
      if (res.status === "success") {
        alert("Dossier validated and finalized successfully!");
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
    // The Liquidation Desk passes the index rows on screen (its claim-type filter applied).
    liquidations: (list: any[] = yearFilteredSubmissions) => {
      const headers = ["Liquidation Number", "Claim Type", "Reference Request", "Employee", "Department", "Allocated Released", "Liquidated Amount", "Remaining Balance Return", "Status", "Close Date"];
      const rows = list.map(l => [
        l.submissionNo,
        l.claimType || "",
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
  // Nothing is listed until the year is known: startsWith("") would match every year.
  const yearFilteredTxns = activeFiscalYear ? txnList.filter(tx => tx.transactionDate.startsWith(activeFiscalYear)) : [];
  // A report counts in its seminar's fiscal year, or the year it was filed when it has none
  // (reportFiscalYear, shared with the Overview Dashboard). Matching the filing date alone put
  // an FY 2027 seminar's report under 2026, because FY 2027 opened in October 2026. Older
  // reports name their date `dateSubmitted`, not `createdAt`, so both are read.
  const yearFilteredSubmissions = activeFiscalYear
    ? submissions.filter(s => reportFiscalYear(s) === activeFiscalYear)
    : [];

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

  // The fiscal-year chooser; it opens the "Select Fiscal Year" dialog. Every page that
  // lists one year's records shows it, so the year in view is never hidden.
  const fyButton = (
    <button
      onClick={() => setIsFiscalYearModalOpen(true)}
      title="Change the fiscal year shown"
      aria-haspopup="dialog"
      className="bg-slate-100 hover:bg-slate-200 text-slate-900 text-[10px] font-bold py-2 px-3 uppercase tracking-wider rounded-lg border flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
    >
      <Calendar size={13} />
      {/* The viewed year's real status: a past year reads CLOSED, not ACTIVE. */}
      <span>FY {activeFiscalYear || "…"} {currentFy?.status?.toUpperCase()}</span>
      <ChevronDown size={13} aria-hidden="true" />
    </button>
  );

  // Training programs carry the fiscal year LABEL ("2026"), not the id — the server
  // derives its totals the same way, so these agree with the summary tiles.

  return (
    <div id="finance-workstation-container" className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50">
      
      {/* CORE DESK VIEWPORT */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* VIEW 1: OVERVIEW DASHBOARD — the Liquidation Desk at a glance (finance/FinanceOverview). */}
        {activeSubTab === "dashboard" && (
          <FinanceOverview
            fiscalYear={activeFiscalYear}
            yearControl={fyButton}
            submissions={submissions}
            cashAdvances={overviewLoad?.advances ?? null}
            trainingBudget={currentFy ? trainingBudgets.find(b => b.fiscalYearId === currentFy.id) ?? null : null}
            status={{
              loading: !overviewLoad,
              reportsFailed: !!overviewLoad?.reportsFailed,
              advancesFailed: !!overviewLoad && overviewLoad.advances === null,
              budgetFailed: !!overviewLoad?.budgetFailed
            }}
            canValidate={user.role === UserRole.FINANCE_OFFICER}
            onRetry={() => { setOverviewLoad(undefined); fetchFinanceAddons(); }}
            onOpenDesk={() => setActiveSubTab("liquidation")}
            onOpenReport={openReportOnDesk}
          />
        )}

        {/* VIEW 3: DOCUMENTS VAULT — every file attached to a liquidation report (finance/DocumentsVault).
            The Transactions Journal (VIEW 2) and the old vault of its vouchers were removed on
            2026-10-22: Finance records its work on the Liquidation Desk. */}
        {activeSubTab === "vault" && (
          <DocumentsVault
            fiscalYear={activeFiscalYear}
            yearControl={fyButton}
            onOpenReport={openReportOnDesk}
          />
        )}

        {/* VIEW 4: LIQUIDATION WORKFLOW MONITORING */}
        {activeSubTab === "liquidation" && (
          <LiquidationDeskView
            user={user}
            submissions={submissions}
            yearFilteredSubmissions={yearFilteredSubmissions}
            activeFiscalYear={activeFiscalYear}
            yearControl={fyButton}
            selectedSub={selectedSub}
            subRemarks={subRemarks}
            setSelectedSub={setSelectedSub}
            setSubRemarks={setSubRemarks}
            onValidate={handleFinanceValidate}
            onExport={exportMethods.liquidations}
            onQueueRefresh={() => { fetchFinanceAddons(); onRefresh(); }}
            focusAdvance={focusAdvance}
            onFocusAdvanceHandled={() => setFocusAdvance(null)}
          />
        )}

        {/* VIEW 5: BUDGET ALLOCATION & UTILIZATION (Budget Officer and Administrator only) */}
        {activeSubTab === "budgets" && !isBudgetOrAdmin && (
          <div className="flex-1 p-6">
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm">
              Budget Monitoring is for the Budget Officer and the Administrator.
            </p>
          </div>
        )}
        {activeSubTab === "budgets" && isBudgetOrAdmin && (
          <div id="budget-officer-container" className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            
            {/* COMPREHENSIVE BUDGET OFFICER ROLE ROLE HEADER */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="bg-blue-500/20 text-blue-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-blue-500/35 uppercase tracking-wider font-mono">Budget Officer Authorized</span>
                  <span className="text-slate-400 text-xs">|</span>
                  <span className="text-xs text-slate-300 font-mono">RAB 1 Regional Treasury</span>
                </div>
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">Regional Budget Allocation & Utilization Desk</h1>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  Set the annual training and seminar budget, track how much of it HR has allocated and spent, and start each new fiscal year.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {fyButton}
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

            {/* Allocation & utilization: the annual Training & Seminar budget that HR's Training Plan &
                Budget allocates. */}
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
                          {/* Unallocated = total minus what the seminars take: actual spending once
                              a seminar is closed, its allocation less any non-attendee's share
                              until then (src/trainingBudget.ts). The same figure carries over
                              when the next fiscal year starts. */}
                          <div className="flex flex-col bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            <span className="text-[10px] uppercase font-bold text-blue-800 mb-1">Unallocated</span>
                            <span className={`text-2xl font-extrabold tracking-tight ${(tb?.remaining ?? approved) < 0 ? "text-red-600" : "text-slate-900"}`}>{formatCurrency(tb?.remaining ?? approved)}</span>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5">of {formatCurrency(approved)} total</span>
                            {/* What came back to it this year (requirement 6). */}
                            {Number(tb?.returnedFromSettled) > 0 && (
                              <span className="text-[10px] font-semibold text-emerald-700 mt-1">
                                Returned to Unallocated by {tb.settledReturning} seminar{tb.settledReturning === 1 ? "" : "s"}: {formatCurrency(Number(tb.returnedFromSettled))}
                              </span>
                            )}
                            {Number(tb?.releasedForAbsent) > 0 && (
                              <span className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                                Released for {tb.absentCount} participant{tb.absentCount === 1 ? "" : "s"} who did not attend: {formatCurrency(Number(tb.releasedForAbsent))}
                              </span>
                            )}
                            {Number(tb?.heldForAdvances) > 0 && (
                              <span className="text-[10px] font-semibold text-amber-700 mt-0.5">
                                Held until {tb.heldCount} cash advance{tb.heldCount === 1 ? " is" : "s are"} refunded: {formatCurrency(Number(tb.heldForAdvances))}
                              </span>
                            )}
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

          </div>
        )}

      </div>

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
