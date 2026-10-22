import React, { useEffect, useState } from "react";
import { User, UserRole, RequestStatus, NotificationLink } from "../types";
import {
  Users,
  ClipboardCheck,
  FileClock,
  Layers,
  Package,
  Activity,
  Clock,
  ArrowRight,
  RefreshCcw
} from "lucide-react";
import { apiCall, formatCurrency, formatDate, firstDateString } from "../utils";
import {
  latestReports,
  liquidatedByMonth,
  overviewFigures,
  reportStatusBadgeClass,
  type OverviewAdvance,
  type OverviewReport
} from "./finance/overviewFigures";
import MonthlyLiquidationChart from "./dashboard/MonthlyLiquidationChart";

interface DashboardViewProps {
  user: User;
  summaryData: any;
  loading: boolean;
  setActiveTab: (tab: string) => void;
  /** Opens a screen the way a notification does (App's openNotificationLink). */
  onOpenLink: (link: NotificationLink) => void;
}

/** The liquidation lists the dashboard reads; undefined until they load. */
interface LiquidationLoad {
  reports: OverviewReport[];
  reportsFailed: boolean;
  /** null when they couldn't be loaded. */
  advances: OverviewAdvance[] | null;
  fiscalYear: string;
}

const MANILA_DAY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
const MANILA_TIME = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

/** An audit entry's moment in Manila ("Oct 22" and "4:05 PM"); null when it can't be read. */
function manilaStamp(timestamp?: string): [string, string] | null {
  const at = new Date(timestamp ?? "");
  return Number.isNaN(at.getTime()) ? null : [MANILA_DAY.format(at), MANILA_TIME.format(at)];
}

export default function DashboardView({ user, summaryData, loading, setActiveTab, onOpenLink }: DashboardViewProps) {
  // Liquidation figures come from the lists Finance's overview reads, by the same rules
  // (finance/overviewFigures.ts), so the two screens always agree.
  const [liq, setLiq] = useState<LiquidationLoad | undefined>(undefined);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLiq(undefined);
    Promise.all([
      apiCall("/api/liquidation-submissions").catch(() => null),
      apiCall("/api/cash-advances").catch(() => null),
      apiCall("/api/fiscal-years/active").catch(() => null)
    ]).then(([subRes, caRes, fyRes]) => {
      if (cancelled) return;
      setLiq({
        reports: subRes?.status === "success" ? subRes.data || [] : [],
        reportsFailed: subRes?.status !== "success",
        advances: caRes?.status === "success" ? caRes.data || [] : null,
        fiscalYear: fyRes?.label ? String(fyRes.label) : ""
      });
    });
    return () => { cancelled = true; };
  }, [reloadKey]);
  const retryLiquidation = () => setReloadKey(k => k + 1);

  if (loading || !summaryData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50">
        <div className="h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-mono text-slate-500">Querying regional data indexes...</p>
      </div>
    );
  }

  const { stats, auditLogs, recentRequests } = summaryData;

  // General executive charts mapping
  const hrStatsList = [
    { label: "Total Workforce", value: stats.totalEmployees, desc: "Active roster employees", color: "bg-blue-500", text: "text-blue-600" },
    // Counted from each staff record's employment status; "—" from a server that doesn't send it.
    { label: "Permanent Staff", value: stats.permanentEmployees ?? "—", desc: "Permanent or regular appointment", color: "bg-emerald-500", text: "text-emerald-600" },
    { label: "Professional Training", value: stats.trainingCount, desc: "Certificates compiled", color: "bg-amber-500", text: "text-amber-600" }
  ];

  // Liquidation: "…" while loading, "—" when a list couldn't be loaded, never a false zero.
  const f = liq ? overviewFigures(liq.reports, liq.advances, liq.fiscalYear) : null;
  const shown = (failed: boolean, value: React.ReactNode, desc: string) =>
    !liq ? { value: "…", desc: "Loading…" } : failed ? { value: "—", desc: "Couldn't be loaded" } : { value, desc };
  const liqStatsList = [
    { label: "Waiting for Finance", text: "text-amber-600",
      ...shown(!!liq?.reportsFailed, f?.toValidate, "Endorsed by HR, to validate") },
    { label: "Advances Not Yet Liquidated", text: "text-blue-600",
      ...shown(liq?.advances === null, f?.advancesOut.count, `${formatCurrency(f?.advancesOut.amount ?? 0)} with employees`) },
    { label: `Validated in FY ${liq?.fiscalYear || "…"}`, text: "text-emerald-600",
      ...shown(!!liq?.reportsFailed, f?.year.validated, `${formatCurrency(f?.year.liquidated ?? 0)} liquidated`) }
  ];
  const liqFailed = !!liq && (liq.reportsFailed || liq.advances === null);
  const latest = liq ? latestReports(liq.reports, 5) : [];

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
              {/* Staff records live in Personnel Information → Personal Data Sheet. */}
              <button
                onClick={() => setActiveTab("pds")}
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

          {/* LIQUIDATION (the Liquidation Desk at a glance; details on Finance's overview) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow" aria-busy={!liq}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold text-slate-800 flex items-center">
                <ClipboardCheck size={16} className="text-emerald-500 mr-1.5" />
                Liquidation
              </span>
              <button
                onClick={() => onOpenLink({ tab: "finance", subTab: "dashboard" })}
                className="text-[10px] text-emerald-600 font-medium hover:underline flex items-center"
              >
                <span>Overview</span>
                <ArrowRight size={10} className="ml-0.5" />
              </button>
            </div>
            <div className="space-y-3">
              {liqStatsList.map((stat, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                    <p className="text-[9px] text-slate-400">{stat.desc}</p>
                  </div>
                  <span className={`text-md font-bold font-mono ${stat.text}`}>{stat.value}</span>
                </div>
              ))}
              {liqFailed && (
                <button type="button" onClick={retryLiquidation} className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-rose-700 underline">
                  <RefreshCcw size={10} aria-hidden="true" /> Retry
                </button>
              )}
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
        {/* What validated reports spent, month by month (real figures). */}
        <MonthlyLiquidationChart
          months={liquidatedByMonth(liq?.reports)}
          loading={!liq}
          failed={!!liq?.reportsFailed}
          onRetry={retryLiquidation}
        />

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
              auditLogs.map((log: any) => {
                // Stored in UTC; shown as the day and time in Manila.
                const stamp = manilaStamp(log.timestamp);
                return (
                  <div key={log.id} className="flex gap-2 text-[11px] leading-relaxed select-none">
                    <span className="text-[9px] text-slate-500 font-mono w-16 shrink-0 pt-0.5 leading-tight">
                      {stamp ? <>{stamp[0]}<br />{stamp[1]}</> : "—"}
                    </span>
                    <div className="overflow-hidden">
                      <span className="font-semibold text-slate-700 mr-1">{log.username}</span>
                      <span className="text-slate-400">[{log.role}]</span>
                      <p className="mt-0.5 text-slate-600 truncate">{log.action}: {log.details}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-slate-400 font-mono text-[10px] text-center pt-8">No logins done</p>
            )}
          </div>
        </div>
      </section>

      {/* RECENT RECORDS QUICK TABLES */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LATEST LIQUIDATION REPORTS (each opens its details in Request Management) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4" aria-busy={!liq}>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold font-sans text-slate-800 uppercase tracking-tight flex items-center">
              <FileClock size={15} className="text-slate-500 mr-1.5" />
              Latest Liquidation Reports
            </h4>
            <button
              onClick={() => setActiveTab("requests")}
              className="text-[10px] text-slate-500 font-medium hover:underline"
            >
              See List
            </button>
          </div>
          {!liq ? (
            <p className="text-slate-400 font-mono text-[10px] text-center py-8">Loading…</p>
          ) : liq.reportsFailed ? (
            <p className="flex items-center justify-center gap-2 py-8 text-[11px] text-rose-700">
              The liquidation reports couldn't be loaded.
              <button type="button" onClick={retryLiquidation} className="inline-flex cursor-pointer items-center gap-1 font-semibold underline">
                <RefreshCcw size={11} aria-hidden="true" /> Retry
              </button>
            </p>
          ) : latest.length === 0 ? (
            <p className="text-slate-400 font-mono text-[10px] text-center py-8">No liquidation reports filed yet</p>
          ) : (
            <ul className="space-y-2.5">
              {latest.map(r => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpenLink({ tab: "requests", record: { kind: "liquidationReport", id: r.id } })}
                    className="w-full flex justify-between items-center gap-3 p-3 border border-slate-100 rounded-lg text-left hover:border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold font-mono text-slate-800">{r.submissionNo || "Report"}</span>
                      <span className="block truncate text-[9px] text-slate-500">
                        {r.employeeName || "—"} • Filed {formatDate(firstDateString(r.createdAt, r.dateSubmitted))}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] font-mono font-semibold text-slate-700">{formatCurrency(Number(r.totalSpent || 0))}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${reportStatusBadgeClass(r.status)}`}>{r.status || "Unknown"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* WORKFLOW PIPELINE (REQUESTS SUBMITTED) — the newest open ones, newest first */}
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
