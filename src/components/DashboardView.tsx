import React, { useEffect, useState } from "react";
import { User, UserRole, RequestStatus, NotificationLink, type TrainingCoverage } from "../types";
import {
  Users,
  ClipboardCheck,
  FileClock,
  Layers,
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
import { manilaDay } from "../trainingCalendar";
import MonthlyLiquidationChart from "./dashboard/MonthlyLiquidationChart";
import BudgetCharts from "./dashboard/BudgetCharts";
import TrainingCalendar from "./dashboard/TrainingCalendar";
import UpcomingTrainings from "./dashboard/UpcomingTrainings";
import { PanelLink } from "./dashboard/LoadStates";
import PanelBoundary from "./dashboard/PanelBoundary";
import { useApiLoad } from "./dashboard/useApiLoad";
import { useTrainingBudget } from "./dashboard/useTrainingBudget";
import { useTrainingSchedule } from "./dashboard/useTrainingSchedule";

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

/** Who has at least one training this fiscal year (the coverage route: staff still with the office, src/staffStatus.ts). */
async function loadCoverage(): Promise<TrainingCoverage> {
  const res = await apiCall("/api/training/coverage");
  if (res?.status !== "success" || !res.data) throw new Error(res?.message || "");
  return res.data as TrainingCoverage;
}

export default function DashboardView({ user, summaryData, loading, setActiveTab, onOpenLink }: DashboardViewProps) {
  // The training budget, the seminars (for its chart, the calendar and the upcoming list) and the coverage: each loads on
  // its own, with its own "…", "—" and Retry (12ag).
  const budget = useTrainingBudget();
  const schedule = useTrainingSchedule();
  const coverage = useApiLoad(loadCoverage);
  // The server's day once the schedule has loaded (a PC's clock can be wrong), Manila's by the browser's until then.
  const today = schedule.asOf ?? manilaDay();
  const openSeminar = (id: string) => onOpenLink({ tab: "training_development", record: { kind: "seminar", id } });
  const openPrograms = () => onOpenLink({ tab: "training_development", subTab: "programs" });

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

  // App's summary holds only the workforce counts and the outstanding requests. Until it arrives those show "…" and
  // the rest of the page draws: it used to wait behind a spinner for the whole page, so a summary that never came hid
  // the training panels too (the code review of 12ag). App keeps no failure for it, so it stays "…" if it never comes.
  const summaryReady = !!summaryData && !loading;
  const stats = summaryReady ? summaryData.stats : undefined;
  const recentRequests: any[] | undefined = summaryReady && Array.isArray(summaryData.recentRequests) ? summaryData.recentRequests : undefined;
  const count = (n: unknown) => (!stats ? "…" : typeof n === "number" ? n : "—");

  // Who has a training this fiscal year (a seminar, or one HR recorded), of the staff still with the office: "…" while
  // loading, "—" with the server's reason when it couldn't be loaded. It replaces the count of HR's hand-entered
  // records, which missed seminars.
  const cov = coverage.data;
  const trained = coverage.loading
    ? { value: "…", desc: "Loading…" }
    : coverage.failed || !cov
      ? { value: "—", desc: coverage.message ? `Couldn't be loaded: ${coverage.message}` : "Couldn't be loaded" }
      : { value: `${cov.covered} of ${cov.total}`, desc: `Staff still with the office, FY ${cov.fiscalYear}` };

  // General executive charts mapping
  const hrStatsList: { label: string; value: React.ReactNode; desc: string; text: string; stat?: string }[] = [
    { label: "Total Workforce", value: count(stats?.totalEmployees), desc: "Active roster employees", text: "text-blue-600" },
    // Counted from each staff record's employment status; "—" from a server that doesn't send it.
    { label: "Permanent Staff", value: count(stats?.permanentEmployees), desc: "Permanent or regular appointment", text: "text-emerald-600" },
    { label: "With a training this FY", ...trained, text: "text-slate-800", stat: "trained" }
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

  return (
    // min-w-0: as a flex item of <main> it may be narrower than its content, which then wraps instead of
    // pushing the page sideways. On a phone the sidebar leaves about 100 px, so there a word or an amount
    // too long for its box breaks rather than sticking out (overflow-wrap is inherited).
    <div id="ipfms-dashboard-view" className="min-w-0 flex-1 overflow-y-auto p-2 sm:p-6 bg-slate-50 space-y-6 max-sm:[overflow-wrap:anywhere]">
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

      {/* Each panel fails on its own (PanelBoundary): a record it can't draw shows a box in its place, and the rest of
          the page, the sidebar included, keeps working (the security review of 12ag). */}

      {/* THE TRAINING BUDGET (12ag): the year's figures, what is taken and free, and each seminar's allocation. */}
      <PanelBoundary name="The training budget">
        <BudgetCharts budget={budget} schedule={schedule} onOpenPrograms={openPrograms} />
      </PanelBoundary>

      {/* THE TRAINING CALENDAR AND WHAT IS COMING UP (12ag): side by side on a wide screen, one above the other below.
          Only the active year's seminars open in Programs & Budget, which lists no other year's. */}
      <section aria-label="Training schedule" className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PanelBoundary name="The training calendar" className="xl:col-span-2">
          <TrainingCalendar
            className="xl:col-span-2"
            seminars={schedule.seminars}
            details={schedule.details}
            today={today}
            onOpenSeminar={openSeminar}
            activeFiscalYear={schedule.activeFiscalYear}
            loading={schedule.loading}
            failed={schedule.failed}
            message={schedule.message}
            onRetry={schedule.retry}
          />
        </PanelBoundary>
        <PanelBoundary name="Upcoming trainings">
          <UpcomingTrainings
            seminars={schedule.seminars}
            details={schedule.details}
            today={today}
            loading={schedule.loading}
            failed={schedule.failed}
            message={schedule.message}
            onRetry={schedule.retry}
            quietFailure
            onOpenSeminar={openSeminar}
            activeFiscalYear={schedule.activeFiscalYear}
            emptyAction={<PanelLink onClick={openPrograms}>Plan one in Programs &amp; Budget</PanelLink>}
          />
        </PanelBoundary>
      </section>

      {/* DETAILED STATS WIDGET GRID (ADAPTIVE TO ROLES) */}
      <section className="space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
          Core Module Metrics
        </h3>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* The two cards: side by side on a tablet, one above the other beside the chart on a wide screen. */}
          <div className="grid grid-cols-1 content-start gap-6 md:grid-cols-2 xl:grid-cols-1">
            {/* PERSONNEL SECTION */}
            <PanelBoundary name="HR & Workforce">
            <div data-dash="workforce" aria-busy={coverage.loading || !stats} className="min-w-0 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex flex-wrap items-center justify-between gap-x-2 border-b border-slate-100 pb-3">
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
                  <div key={idx} className="flex flex-wrap justify-between items-center gap-x-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                      <p className="text-[9px] text-slate-500">{stat.desc}</p>
                    </div>
                    <span data-stat={stat.stat} className={`text-base font-bold font-mono ${stat.text}`}>{stat.value}</span>
                  </div>
                ))}
                {coverage.failed && (
                  <button type="button" onClick={coverage.retry} className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-rose-700 underline">
                    <RefreshCcw size={10} aria-hidden="true" /> Retry
                  </button>
                )}
              </div>
            </div>
            </PanelBoundary>

            {/* LIQUIDATION (the Liquidation Desk at a glance; details on Finance's overview) */}
            <PanelBoundary name="Liquidation">
            <div className="min-w-0 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow" aria-busy={!liq}>
              <div className="flex flex-wrap items-center justify-between gap-x-2 border-b border-slate-100 pb-3">
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
                  <div key={idx} className="flex flex-wrap justify-between items-center gap-x-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                      <p className="text-[9px] text-slate-500">{stat.desc}</p>
                    </div>
                    <span className={`text-base font-bold font-mono ${stat.text}`}>{stat.value}</span>
                  </div>
                ))}
                {liqFailed && (
                  <button type="button" onClick={retryLiquidation} className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-rose-700 underline">
                    <RefreshCcw size={10} aria-hidden="true" /> Retry
                  </button>
                )}
              </div>
            </div>
            </PanelBoundary>
          </div>

          {/* What validated reports spent, month by month (real figures). Wrapped, so the chart's own
              lg:col-span-2 can't open a second column in this grid below xl; on a phone its six fixed
              columns need 18rem, so there it scrolls sideways inside this box. */}
          <PanelBoundary name="Liquidated per month" className="xl:col-span-2">
          <div className="custom-scrollbar min-w-0 xl:col-span-2 max-sm:overflow-x-auto">
            <div className="max-sm:min-w-[18rem]">
              <MonthlyLiquidationChart
                months={liquidatedByMonth(liq?.reports)}
                loading={!liq}
                failed={!!liq?.reportsFailed}
                onRetry={retryLiquidation}
              />
            </div>
          </div>
          </PanelBoundary>
        </div>
      </section>

      {/* RECENT RECORDS QUICK TABLES */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LATEST LIQUIDATION REPORTS (each opens its details in Request Management) */}
        <PanelBoundary name="Latest Liquidation Reports">
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
                    className="w-full flex justify-between items-center gap-3 p-3 border border-slate-100 rounded-lg text-left hover:border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 max-sm:flex-wrap"
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold font-mono text-slate-800">{r.submissionNo || "Report"}</span>
                      <span className="block truncate text-[9px] text-slate-500">
                        {r.employeeName || "—"} • Filed {formatDate(firstDateString(r.createdAt, r.dateSubmitted))}
                      </span>
                    </span>
                    {/* On a phone the amount and the status wrap under the number instead of sticking out. */}
                    <span className="flex min-w-0 items-center gap-2 max-sm:flex-wrap sm:shrink-0">
                      <span className="text-[11px] font-mono font-semibold text-slate-700">{formatCurrency(Number(r.totalSpent || 0))}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${reportStatusBadgeClass(r.status)}`}>{r.status || "Unknown"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </PanelBoundary>

        {/* WORKFLOW PIPELINE (REQUESTS SUBMITTED) — the newest open ones, newest first */}
        <PanelBoundary name="Outstanding Regional Requests">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4" aria-busy={!recentRequests}>
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
            {!recentRequests ? (
              <p className="text-slate-500 font-mono text-[10px] text-center py-8">Loading…</p>
            ) : recentRequests.length > 0 ? (
              recentRequests.map((req: any) => (
                <div key={req.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg hover:border-slate-200 transition-colors">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-800">{req.requestType}</p>
                    {/* Read as text only, as the reports list above reads its dates: a record stored before 2026-11-11 can
                        hold a date of another kind (12w), though the server now sends only text. */}
                    <p className="text-[9px] text-slate-500">{req.employeeName} • {formatDate(firstDateString(req.dateRequested, req.createdAt))}</p>
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
        </PanelBoundary>
      </section>
    </div>
  );
}
