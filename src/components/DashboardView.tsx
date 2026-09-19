import React from "react";
import { User, UserRole, TransactionStatus, AssetStatus, RequestStatus } from "../types";
import { 
  Users, 
  FileText, 
  Layers, 
  Package, 
  TrendingUp, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  DollarSign, 
  ArrowRight,
  TrendingDown
} from "lucide-react";
import { formatCurrency, formatDate } from "../utils";

interface DashboardViewProps {
  user: User;
  summaryData: any;
  loading: boolean;
  setActiveTab: (tab: string) => void;
}

export default function DashboardView({ user, summaryData, loading, setActiveTab }: DashboardViewProps) {
  if (loading || !summaryData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50">
        <div className="h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-mono text-slate-500">Querying regional data indexes...</p>
      </div>
    );
  }

  const { stats, auditLogs, recentRequests, recentTransactions } = summaryData;

  // General executive charts mapping
  const hrStatsList = [
    { label: "Total Workforce", value: stats.totalEmployees, desc: "Active roster employees", color: "bg-blue-500", text: "text-blue-600" },
    { label: "Permanent Staff", value: stats.activeEmployees, desc: "Regular plantilla posts", color: "bg-emerald-500", text: "text-emerald-600" },
    { label: "Professional Training", value: stats.trainingCount, desc: "Certificates compiled", color: "bg-amber-500", text: "text-amber-600" }
  ];

  const finStatsList = [
    { label: "Total Expenditure", value: formatCurrency(stats.totalExpenditure), desc: "Direct liquidating papers", color: "bg-purple-500", text: "text-purple-600" },
    { label: "Pending Validation", value: stats.pendingValidations, desc: "Awaiting Finance audit", color: "bg-rose-500", text: "text-rose-600" },
    { label: "Validated & Passed", value: stats.validatedTransactions, desc: "Budget certified correct", color: "bg-indigo-500", text: "text-indigo-600" }
  ];

  const astStatsList = [
    { label: "Total Registered Assets", value: stats.totalAssets, desc: "Hardware items in system", color: "bg-violet-500", text: "text-violet-600" },
    { label: "Assigned to Employees", value: stats.assignedAssets, desc: "Active PAR accountability", color: "bg-teal-500", text: "text-teal-600" },
    { label: "Damaged / Suspended", value: stats.damagedAssets, desc: "Require repair action", color: "bg-red-500", text: "text-red-600" }
  ];

  return (
    <div id="ipfms-dashboard-view" className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
      {/* WELCOME BANNER WITH USER PROFILE */}
      {user.role !== UserRole.SUPER_ADMIN && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 translate-x-12 -translate-y-12">
            <Layers size={280} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full font-bold">
                Secure Terminal Active
              </span>
              <h1 className="text-xl font-bold tracking-tight mt-2 flex items-center">
                Welcome Back, {user.fullName}!
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-xl font-sans">
                Integrated Personnel and Financial Management System • HSAC RAB No. 1 Philippines.
                Logged in with <span className="font-semibold text-amber-400">{user.role}</span> authority.
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                id="dash-btn-requests"
                onClick={() => setActiveTab("requests")}
                className="bg-amber-500 text-slate-900 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-amber-400 transition-colors flex items-center shadow-md shadow-amber-500/15"
              >
                <span>Submit Service Form</span>
                <ArrowRight size={14} className="ml-1.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED STATS WIDGET GRID (ADAPTIVE TO ROLES) */}
      <section className="space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
          Core Module Metrics
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* PERSONNEL SECTION */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold text-slate-800 flex items-center">
                <Users size={16} className="text-blue-500 mr-1.5" />
                HR & Workforce
              </span>
              <button 
                onClick={() => setActiveTab("employees")} 
                className="text-[10px] text-blue-600 font-medium hover:underline flex items-center"
              >
                <span>Manage</span>
                <ArrowRight size={10} className="ml-0.5" />
              </button>
            </div>
            <div className="space-y-3">
              {hrStatsList.map((stat, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                    <p className="text-[9px] text-slate-400">{stat.desc}</p>
                  </div>
                  <span className={`text-md font-bold font-mono ${stat.text}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FINANCIAL EXPENSES */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold text-slate-800 flex items-center">
                <FileText size={16} className="text-emerald-500 mr-1.5" />
                Receipt Ledger
              </span>
              <button 
                onClick={() => setActiveTab("finance")} 
                className="text-[10px] text-emerald-600 font-medium hover:underline flex items-center"
              >
                <span>Audit Vouchers</span>
                <ArrowRight size={10} className="ml-0.5" />
              </button>
            </div>
            <div className="space-y-3">
              {finStatsList.map((stat, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                    <p className="text-[9px] text-slate-400">{stat.desc}</p>
                  </div>
                  <span className={`text-md font-bold font-mono ${stat.text}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ASSET INVENTORY */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold text-slate-800 flex items-center">
                <Package size={16} className="text-purple-500 mr-1.5" />
                Accountability PAR
              </span>
              <button 
                onClick={() => setActiveTab("assets")} 
                className="text-[10px] text-purple-600 font-medium hover:underline flex items-center"
              >
                <span>Inventory</span>
                <ArrowRight size={10} className="ml-0.5" />
              </button>
            </div>
            <div className="space-y-3">
              {astStatsList.map((stat, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                    <p className="text-[9px] text-slate-400">{stat.desc}</p>
                  </div>
                  <span className={`text-md font-bold font-mono ${stat.text}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CHARTS & COMPARATIV TELEMETRY */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG FINANCIAL BAR GRAPH CHART */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold font-sans text-slate-800 uppercase tracking-tight flex items-center">
              <TrendingUp size={15} className="text-amber-500 mr-1.5 animate-pulse" />
              Monthly Budget Utilization Index
            </h4>
            <span className="text-[10px] font-mono text-slate-400">RAB 1 Regional Ledger</span>
          </div>

          {/* CUSTOM BAR CHART RENDERED WITH CLEAN SCALABLE SVGS WITHOUT WEIRD CHART PACKAGES */}
          <div className="h-44 flex items-end justify-between px-4 pt-4 border-b border-l border-slate-100 relative">
            <div className="absolute top-2 left-4 text-[9px] text-slate-400 font-mono">PHP 20,000 max</div>
            <div className="absolute bottom-1/2 left-4 w-full border-t border-slate-50 border-dashed"></div>
            
            {/* JAN */}
            <div className="flex flex-col items-center flex-1 space-y-2">
              <div className="w-8 bg-slate-200 hover:bg-amber-300 rounded-t h-12 transition-all cursor-pointer relative group">
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  PHP5,200
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-semibold uppercase">Jan</span>
            </div>

            {/* FEB */}
            <div className="flex flex-col items-center flex-1 space-y-2">
              <div className="w-8 bg-slate-200 hover:bg-amber-300 rounded-t h-16 transition-all cursor-pointer relative group">
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  PHP8,100
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-semibold uppercase">Feb</span>
            </div>

            {/* MAR */}
            <div className="flex flex-col items-center flex-1 space-y-2">
              <div className="w-8 bg-slate-200 hover:bg-amber-300 rounded-t h-28 transition-all cursor-pointer relative group">
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  PHP14,500
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-semibold uppercase">Mar</span>
            </div>

            {/* APR */}
            <div className="flex flex-col items-center flex-1 space-y-2">
              <div className="w-8 bg-slate-200 hover:bg-amber-300 rounded-t h-10 transition-all cursor-pointer relative group">
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  PHP4,900
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-semibold uppercase">Apr</span>
            </div>

            {/* MAY */}
            <div className="flex flex-col items-center flex-1 space-y-2">
              <div className="w-8 bg-amber-500 rounded-t h-32 transition-all cursor-pointer relative group">
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  PHP16,200
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-semibold uppercase font-mono">May</span>
            </div>

            {/* JUN (Active) */}
            <div className="flex flex-col items-center flex-1 space-y-2">
              <div className="w-8 bg-slate-500 rounded-t h-36 transition-all cursor-pointer relative group">
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  PHP18,100
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-semibold uppercase font-mono">Jun *</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 text-center">
            * Indicates current active fiscal period data matching transaction receipts.
          </div>
        </div>

        {/* RECENT SECURIT ACTION STREAM */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold font-sans text-slate-800 uppercase tracking-tight flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="flex items-center">
              <Activity size={15} className="text-rose-500 mr-1.5 animate-pulse" />
              Administrative Audits
            </span>
            {user.role === UserRole.SUPER_ADMIN && (
              <button 
                onClick={() => setActiveTab("audit")} 
                className="text-[9px] text-rose-600 font-medium hover:underline"
              >
                View Logs
              </button>
            )}
          </h4>
          <div className="space-y-3.5 max-h-44 overflow-y-auto pr-1">
            {auditLogs && auditLogs.length > 0 ? (
              auditLogs.map((log: any) => (
                <div key={log.id} className="flex gap-2 text-[11px] leading-relaxed select-none">
                  <span className="text-[9px] text-slate-400 font-mono w-16 shrink-0 pt-0.5">
                    {log.timestamp ? log.timestamp.split("T")[1].substring(0, 5) : "Time"}
                  </span>
                  <div className="overflow-hidden">
                    <span className="font-semibold text-slate-700 mr-1">{log.username}</span>
                    <span className="text-slate-400">[{log.role}]</span>
                    <p className="mt-0.5 text-slate-600 truncate">{log.action}: {log.details}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 font-mono text-[10px] text-center pt-8">No logins done</p>
            )}
          </div>
        </div>
      </section>

      {/* RECENT RECORDS QUICK TABLES */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECENT OUTSTANDING VOUCHERS */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold font-sans text-slate-800 uppercase tracking-tight flex items-center">
              <FileText size={15} className="text-slate-500 mr-1.5" />
              Recent Expense Records
            </h4>
            <button 
              onClick={() => setActiveTab("finance")} 
              className="text-[10px] text-slate-500 font-medium hover:underline"
            >
              See List
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="pb-2">Transaction ID</th>
                  <th className="pb-2">Supplier</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions && recentTransactions.length > 0 ? (
                  recentTransactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="py-2.5 font-mono text-slate-700">{tx.transactionId}</td>
                      <td className="py-2.5 font-medium text-slate-600 line-clamp-1 max-w-[120px]">{tx.supplier}</td>
                      <td className="py-2.5 text-right font-mono text-slate-700 font-semibold">{formatCurrency(tx.amount)}</td>
                      <td className="py-2.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${
                          tx.status === TransactionStatus.LIQUIDATED 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : tx.status === TransactionStatus.VALIDATED
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 font-mono">No vouchers registered</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* WORKFLOW PIPELINE (REQUESTS SUBMITTED) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold font-sans text-slate-800 uppercase tracking-tight flex items-center">
              <Clock size={15} className="text-slate-500 mr-1.5" />
              Outstanding Regional Requests
            </h4>
            <button 
              onClick={() => setActiveTab("requests")} 
              className="text-[10px] text-slate-500 font-medium hover:underline"
            >
              Examine Workflow
            </button>
          </div>
          <div className="space-y-2.5 max-h-56 overflow-y-auto">
            {recentRequests && recentRequests.length > 0 ? (
              recentRequests.map((req: any) => (
                <div key={req.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg hover:border-slate-200 transition-colors">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-800">{req.requestType}</p>
                    <p className="text-[9px] text-slate-400">{req.employeeName} • {formatDate(req.dateRequested)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    req.status === RequestStatus.APPROVED 
                      ? "bg-emerald-100 text-emerald-800" 
                      : req.status === RequestStatus.REJECTED 
                      ? "bg-rose-100 text-rose-800" 
                      : "bg-slate-100 text-slate-600 animate-pulse"
                  }`}>
                    {req.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 font-mono text-[10px] text-center py-8">All request pipelines empty</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
