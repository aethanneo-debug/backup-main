import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  FileClock,
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  RefreshCcw,
  Undo2,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { formatCurrency, formatDate, firstDateString } from "../../utils";
import { overviewFigures, reportStatusBadgeClass as statusBadgeClass, REPORT_STAGES, type OverviewAdvance, type OverviewReport } from "./overviewFigures";

/** What the overview reads from a GET /api/training/budgets row (the server derives these). */
export interface OverviewTrainingBudget {
  totalBudget?: number;
  allocated?: number;
  percentAllocated?: number;
  spent?: number;
  percentSpent?: number;
  remaining?: number;
}

/** Where the overview's own load stands. A list that failed is shown as such, never as 0. */
export interface OverviewLoadStatus {
  loading: boolean;
  reportsFailed: boolean;
  advancesFailed: boolean;
  budgetFailed: boolean;
}

interface FinanceOverviewProps {
  /** The fiscal year in view ("" until the years load). */
  fiscalYear: string;
  /** The fiscal-year chooser, shared with Finance's other pages. */
  yearControl: React.ReactNode;
  submissions: OverviewReport[];
  cashAdvances: OverviewAdvance[] | null;
  /** The year's training budget, or null when none is set. */
  trainingBudget: OverviewTrainingBudget | null;
  status: OverviewLoadStatus;
  /** Only the Financial Officer validates reports; the Administrator follows them. */
  canValidate: boolean;
  onRetry: () => void;
  onOpenDesk: () => void;
  /** The Liquidation Desk, scrolled to this report. */
  onOpenReport: (id: string) => void;
}

type Tone = "none" | "amber" | "rose" | "blue" | "emerald";

// House status pattern: -50 background, -700 text, -200 border.
const CARD_TONE: Record<Tone, string> = {
  none: "border-slate-200 bg-white",
  amber: "border-amber-200 bg-amber-50",
  rose: "border-rose-200 bg-rose-50",
  blue: "border-blue-200 bg-blue-50",
  emerald: "border-emerald-200 bg-emerald-50"
};
const VALUE_TONE: Record<Tone, string> = {
  none: "text-slate-900",
  amber: "text-amber-700",
  rose: "text-rose-700",
  blue: "text-blue-700",
  emerald: "text-emerald-700"
};

/** A figure. With onClick it is a button that opens where the figure comes from; without, it is
 * information only. */
function FigureCard({ label, value, note, tone = "none", icon: Icon, onClick }: {
  label: string;
  value: React.ReactNode;
  note: React.ReactNode;
  tone?: Tone;
  icon: LucideIcon;
  onClick?: () => void;
}) {
  const body = (
    <>
      {/* Room for a two-line label, so every value in a row lines up. */}
      <span className="flex min-h-[25px] items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{label}</span>
        <Icon size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
      </span>
      <span className={`mt-2.5 font-mono text-sm font-extrabold tracking-tight tabular-nums ${VALUE_TONE[tone]}`}>{value}</span>
      <span className="mt-1 text-[10px] leading-tight text-slate-500">{note}</span>
    </>
  );
  const shape = `flex flex-col justify-between rounded-xl border p-4 text-left shadow-sm ${CARD_TONE[tone]}`;
  if (!onClick) return <div data-figure-card className={shape}>{body}</div>;
  return (
    <button
      type="button"
      data-figure-card
      onClick={onClick}
      className={`${shape} cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
    >
      {body}
    </button>
  );
}

function SectionHeading({ id, title, aside }: { id: string; title: string; aside?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 id={id} className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</h2>
      {aside && <span className="text-[10px] text-slate-500">{aside}</span>}
    </div>
  );
}

function PanelHeading({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
      <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">{title}</h2>
      <Icon size={14} className="text-blue-600" aria-hidden="true" />
    </div>
  );
}

function PanelLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1 rounded text-[11px] font-semibold text-blue-700 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {label} <ArrowRight size={12} aria-hidden="true" />
    </button>
  );
}

/** A panel's body while its data is loading or couldn't be loaded. */
function PanelNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs italic text-slate-500">{children}</p>;
}

// The statuses as the Liquidation Desk shows them, each with whose turn it is.
const STAGE_ROWS: Array<{ key: "withHr" | "withFinance" | "validated" | "returned" | "other"; status: string; hint: string; bar: string }> = [
  { key: "withHr", status: REPORT_STAGES.withHr, hint: "With HR", bar: "bg-amber-400" },
  { key: "withFinance", status: REPORT_STAGES.withFinance, hint: "With Finance, to validate", bar: "bg-blue-500" },
  { key: "validated", status: REPORT_STAGES.validated, hint: "Validated by Finance", bar: "bg-emerald-500" },
  { key: "returned", status: REPORT_STAGES.returned, hint: "With the employee, to correct", bar: "bg-rose-400" },
  { key: "other", status: "Other", hint: "Older statuses", bar: "bg-slate-400" }
];

const percentOf = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0);

/**
 * Finance's Overview Dashboard: what is waiting on the Liquidation Desk, and the fiscal year's
 * liquidation totals. Every figure is the Liquidation Desk's own rule (overviewFigures.ts).
 */
export default function FinanceOverview({
  fiscalYear,
  yearControl,
  submissions,
  cashAdvances,
  trainingBudget,
  status,
  canValidate,
  onRetry,
  onOpenDesk,
  onOpenReport
}: FinanceOverviewProps) {
  const f = overviewFigures(submissions, cashAdvances, fiscalYear);
  const fy = fiscalYear || "…";
  const tb = trainingBudget;
  const total = Number(tb?.totalBudget || 0);
  const allocated = Number(tb?.allocated || 0);
  const spent = Number(tb?.spent || 0);
  const unallocated = Number(tb?.remaining ?? total);

  // A card's value and note: "…" while loading, a plain notice when its list couldn't be loaded,
  // and only then the figure, so nothing ever reads as a real zero by mistake.
  const failed = { reports: status.reportsFailed, advances: status.advancesFailed, budget: status.budgetFailed };
  const shown = (source: keyof typeof failed, value: React.ReactNode, note: React.ReactNode, tone: Tone = "none") =>
    status.loading ? { value: "…", note: "Loading…", tone: "none" as Tone }
      : failed[source] ? { value: "—", note: "Couldn't be loaded", tone: "none" as Tone }
      : { value, note, tone };
  const reportsReady = !status.loading && !status.reportsFailed;

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6 custom-scrollbar" aria-busy={status.loading}>
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-lg bg-blue-600 p-2 text-white" aria-hidden="true">
            <LayoutDashboard size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-blue-600">
              HSAC RAB 1 &middot; Finance &middot; Overview
            </p>
            <h1 className="mt-0.5 text-base font-bold text-slate-900">Liquidation Overview</h1>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">
              What is waiting on the Liquidation Desk, and fiscal year {fy}'s liquidation totals.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{yearControl}</div>
      </header>

      {!status.loading && (status.reportsFailed || status.advancesFailed || status.budgetFailed) && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <span className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Some figures couldn't be loaded. They are marked "Couldn't be loaded" below.
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <RefreshCcw size={12} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      <section aria-labelledby="overview-open">
        <SectionHeading id="overview-open" title="Open on the Liquidation Desk" aside="All fiscal years" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <FigureCard
            label="Reports to validate"
            {...shown("reports", f.toValidate,
              canValidate ? "Endorsed by HR, waiting for you" : "Endorsed by HR, waiting for the Financial Officer",
              canValidate && f.toValidate > 0 ? "amber" : "none")}
            icon={ClipboardCheck}
            onClick={onOpenDesk}
          />
          <FigureCard
            label="Cash advance requests"
            {...shown("advances", f.advanceRequests, "To release or decline", f.advanceRequests > 0 ? "amber" : "none")}
            icon={HandCoins}
            onClick={onOpenDesk}
          />
          <FigureCard
            label="Reimbursements to pay"
            {...shown("reports", f.reimbursementsToPay.count, `${formatCurrency(f.reimbursementsToPay.amount)} owed to employees`,
              f.reimbursementsToPay.count > 0 ? "amber" : "none")}
            icon={Receipt}
            onClick={onOpenDesk}
          />
          <FigureCard
            label="Advances not yet liquidated"
            {...shown("advances", f.advancesOut.count, `${formatCurrency(f.advancesOut.amount)} still with employees`,
              f.advancesOut.count > 0 ? "blue" : "none")}
            icon={Wallet}
            onClick={onOpenDesk}
          />
          <FigureCard
            label="Returned for correction"
            {...shown("reports", f.returned, "With the employee", f.returned > 0 ? "rose" : "none")}
            icon={Undo2}
            onClick={onOpenDesk}
          />
        </div>
      </section>

      <section aria-labelledby="overview-year">
        <SectionHeading id="overview-year" title={`Fiscal year ${fy}`} aside="Seminar reports count in their seminar's year" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <FigureCard
            label="Validated reports"
            {...shown("reports", f.year.validated, `of ${f.year.filed} in FY ${fy}`)}
            icon={BadgeCheck}
            onClick={onOpenDesk}
          />
          <FigureCard
            label="Amount liquidated"
            {...shown("reports", formatCurrency(f.year.liquidated), "Spent, per validated reports")}
            icon={FileClock}
            onClick={onOpenDesk}
          />
          <FigureCard
            label="Leftover returned"
            {...shown("reports", formatCurrency(f.year.leftoverReturned), "Handed back with an OR at validation",
              f.year.leftoverReturned > 0 ? "emerald" : "none")}
            icon={PiggyBank}
            onClick={onOpenDesk}
          />
          <FigureCard
            label="Reimbursed"
            {...shown("reports", formatCurrency(f.year.reimbursed), "Paid back to employees")}
            icon={Receipt}
            onClick={onOpenDesk}
          />
          {/* Information only: the training budget is the Budget Officer's (Budget Monitoring),
              and nothing in Financial Tracking leads there. */}
          <FigureCard
            label="Training budget unallocated"
            {...shown("budget", tb ? formatCurrency(unallocated) : "Not set",
              tb ? `of ${formatCurrency(total)} for FY ${fy}` : "Set by the Budget Officer",
              tb && unallocated < 0 ? "rose" : "none")}
            icon={Wallet}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        {/* The year's training budget, as Budget Monitoring and HR's planner show it. */}
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <PanelHeading title={`Training budget · FY ${fy}`} icon={Wallet} />
          {status.loading ? (
            <PanelNote>Loading…</PanelNote>
          ) : status.budgetFailed ? (
            <PanelNote>The training budget couldn't be loaded.</PanelNote>
          ) : tb ? (
            <>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Total budget</dt>
                  <dd className="font-mono font-bold text-slate-900">{formatCurrency(total)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Allocated by HR</dt>
                  <dd className="font-mono font-semibold text-indigo-700">{formatCurrency(allocated)} <span className="text-[10px] text-slate-500">({tb.percentAllocated || 0}%)</span></dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Actually spent</dt>
                  <dd className="font-mono font-semibold text-amber-700">{formatCurrency(spent)} <span className="text-[10px] text-slate-500">({tb.percentSpent || 0}%)</span></dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
                  <dt className="font-semibold text-slate-700">Unallocated</dt>
                  <dd className={`font-mono font-extrabold ${unallocated < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatCurrency(unallocated)}</dd>
                </div>
              </dl>
              <div
                className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`${Math.round(percentOf(allocated, total))}% allocated and ${Math.round(percentOf(spent, total))}% spent of the total`}
              >
                <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-200" style={{ width: `${percentOf(allocated, total)}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-amber-500" style={{ width: `${percentOf(spent, total)}%` }} />
              </div>
              <p className="mt-2 flex gap-3 text-[10px] text-slate-500" aria-hidden="true">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-200" />Allocated</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Spent</span>
              </p>
            </>
          ) : (
            <PanelNote>No training budget is set for FY {fy}. The Budget Officer sets it in Budget Monitoring.</PanelNote>
          )}
          <p className="mt-auto pt-4 text-[10px] text-slate-500">
            Set by the Budget Officer; HR allocates it to seminars in Training Plan &amp; Budget.
          </p>
        </section>

        {/* Where the year's reports stand. */}
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <PanelHeading title={`Reports · FY ${fy}`} icon={ClipboardCheck} />
          {status.loading ? (
            <PanelNote>Loading…</PanelNote>
          ) : status.reportsFailed ? (
            <PanelNote>The liquidation reports couldn't be loaded.</PanelNote>
          ) : f.year.filed === 0 ? (
            <PanelNote>No liquidation reports for FY {fy} yet.</PanelNote>
          ) : (
            <ul className="mt-3 space-y-3">
              {STAGE_ROWS.filter(row => row.key !== "other" || f.year.stages.other > 0).map(row => {
                const n = f.year.stages[row.key];
                return (
                  <li key={row.key}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-700">
                        {row.status} <span className="font-normal text-slate-500">· {row.hint}</span>
                      </span>
                      <span className="font-mono font-bold text-slate-900">{n}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                      <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${percentOf(n, f.year.filed)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <span className="text-[10px] text-slate-500">{reportsReady ? `${f.year.filed} in FY ${fy}` : ""}</span>
            <PanelLink label="Open Liquidation Desk" onClick={onOpenDesk} />
          </div>
        </section>

        {/* The year's newest reports; each opens on the Liquidation Desk. */}
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <PanelHeading title={`Latest reports · FY ${fy}`} icon={FileClock} />
          {status.loading ? (
            <PanelNote>Loading…</PanelNote>
          ) : status.reportsFailed ? (
            <PanelNote>The liquidation reports couldn't be loaded.</PanelNote>
          ) : f.year.latest.length === 0 ? (
            <PanelNote>No liquidation reports for FY {fy} yet.</PanelNote>
          ) : (
            <ul className="mt-3 space-y-2">
              {f.year.latest.map(r => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpenReport(r.id)}
                    className="w-full cursor-pointer rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-left hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-800">{r.submissionNo || "Report"}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${statusBadgeClass(r.status)}`}>{r.status || "Unknown"}</span>
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                      <span className="truncate">{r.employeeName || "—"}</span>
                      <span className="shrink-0 font-mono">{formatCurrency(Number(r.totalSpent || 0))}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">Filed {formatDate(firstDateString(r.createdAt, r.dateSubmitted))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
