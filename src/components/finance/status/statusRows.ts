// Finance's figures by date filed or requested (12ag Part C): what each of the three panels lists, in the office's
// words and the house colours, whether a figure can be shown yet, and the range in words. Pure (no React); tested
// (tests/statusRows.test.ts). The figures are statusFigures.ts's: nothing here counts a record, it only sums its tallies.
import { sumPesos } from "../../../liquidationMoney";
import { dateRange } from "../../dashboard/schedule";
import { rangeProblem, type DateRange, type RangePreset, type StatusFigures, type Tally } from "../statusFigures";

/**
 * The range chosen: a preset in force, or two days typed in, with the last range that could be used (in force while the
 * typed one can't) and whether a box holds a date the browser can't read (half typed or impossible: the box then reports
 * "", which would otherwise read as "no bound" and widen the range: the code review of Part C).
 */
export type RangeChoice =
  | { kind: "preset"; preset: RangePreset }
  | { kind: "custom"; typed: DateRange; fallback: DateRange; bad: { from: boolean; to: boolean } };

/** Why the typed range can't be used, or null. */
export function choiceProblem(choice: RangeChoice): string | null {
  if (choice.kind !== "custom") return null;
  if (choice.bad.from || choice.bad.to) return "Enter the dates as real days.";
  return rangeProblem(choice.typed);
}

/** The range in force: the preset's days, the typed ones, or, while those can't be used, the last that could. */
export function rangeInForce(choice: RangeChoice, presetDays: (preset: RangePreset) => DateRange): DateRange {
  if (choice.kind === "preset") return presetDays(choice.preset);
  return choiceProblem(choice) ? choice.fallback : choice.typed;
}

/**
 * The choice after a day is typed in one box (`bad`: the box can't be read). It starts from the days in force, so the
 * other box keeps its day; while the typed range can't be used, the last one that could stays in force.
 */
export function nextChoice(
  prev: RangeChoice, side: "from" | "to", day: string, bad: boolean, presetDays: (preset: RangePreset) => DateRange
): RangeChoice {
  const typed = prev.kind === "preset" ? presetDays(prev.preset) : prev.typed;
  const flags = prev.kind === "preset" ? { from: false, to: false } : prev.bad;
  return {
    kind: "custom",
    typed: side === "from" ? { from: day, to: typed.to } : { from: typed.from, to: day },
    fallback: rangeInForce(prev, presetDays),
    bad: { ...flags, [side]: bad }
  };
}

/**
 * The charts' colours: -600 shades, each keeping 3:1 against white as a chart's marks must, and a darker second shade
 * where two statuses of one meaning sit side by side. Never purple: it marks "Outside the TDP" (12ae).
 */
export const STATUS_COLOR = {
  /** emerald-600: done (liquidated, paid). */
  done: "#059669",
  /** emerald-800: done another way (refunded), beside "liquidated". */
  doneOther: "#065f46",
  /** amber-600: someone has to act (HR verifies, Finance releases). */
  action: "#d97706",
  /** amber-800: still pending, a second shade (cash out with no report yet; a claim's payment still owed). */
  pending: "#92400e",
  /** blue-500 (the theme's): in progress (with Finance; released, not yet settled). */
  progress: "#0d39e6",
  /** rose-600: returned for correction, or declined. */
  returned: "#e11d48",
  /** slate-500: closed (cancelled). */
  closed: "#64748b",
  /** slate-700: statuses nothing writes any more. */
  other: "#334155"
} as const;

/** The two lists the figures come from (GET /api/liquidation-submissions and GET /api/cash-advances). */
export type Source = "reports" | "advances";

/** Where a figure stands: "…" while loading, "—" when a list it needs couldn't be loaded, never a false 0. */
export type Availability = "loading" | "failed" | "ready";

export interface LoadState {
  loading: boolean;
  reportsFailed: boolean;
  advancesFailed: boolean;
}

export function availability(needs: readonly Source[], load: LoadState): Availability {
  if (load.loading) return "loading";
  return needs.some(s => (s === "reports" ? load.reportsFailed : load.advancesFailed)) ? "failed" : "ready";
}

/** The worst of several: a chart drawn from figures one of which can't be shown can't be drawn either. */
export const worst = (states: readonly Availability[]): Availability =>
  states.includes("loading") ? "loading" : states.includes("failed") ? "failed" : "ready";

/** One line of a panel's figures: a status (a part of its chart), or a sum. */
export interface FigureLine {
  /** The status's key in statusFigures (data-status-row), or, with `sum`, a sum of our own (data-status-total). */
  key: string;
  sum?: boolean;
  label: string;
  /** The chart's axis label. */
  short: string;
  /** Whose turn it is, or what it means. */
  hint?: string;
  /** Its colour in the chart; a sum has none. */
  color?: string;
  /** What one record is: ["report", "reports"]. */
  unit: readonly [string, string];
  tally: Tally;
  state: Availability;
  /** Part of the sum above it ("Not yet liquidated"). */
  indent?: boolean;
  emphasis?: "group" | "total";
}

export type PanelKey = "liquidations" | "advances" | "reimbursements";

export interface PanelModel {
  /** Every line of the figures list, in order: the statuses and the sums. */
  lines: FigureLine[];
  /** The chart's parts: each status, "other" only when there is one. */
  parts: FigureLine[];
  /** What the panel counts in all: the chart's whole, and what "nothing in this range" tests. */
  whole: Tally;
  /** The chart's state: the worst of its parts'. */
  state: Availability;
}

const REPORT: readonly [string, string] = ["report", "reports"];
const ADVANCE: readonly [string, string] = ["cash advance", "cash advances"];
const CLAIM: readonly [string, string] = ["claim", "claims"];
const OTHER_HINT = "Statuses no longer in use";

type Spec = Omit<FigureLine, "tally" | "state">;
const C = STATUS_COLOR;

const LIQUIDATION_SPECS: Record<"liquidated" | "withHr" | "withFinance" | "returned" | "noReport" | "other", Spec> = {
  liquidated: { key: "liquidated", label: "Liquidated", short: "Liquidated", hint: "Validated by Finance", color: C.done, unit: REPORT },
  withHr: { key: "withHr", label: "With HR", short: "With HR", hint: "HR verifies the report", color: C.action, unit: REPORT, indent: true },
  withFinance: { key: "withFinance", label: "With Finance", short: "With Finance", hint: "Finance validates the report", color: C.progress, unit: REPORT, indent: true },
  returned: { key: "returned", label: "Returned for correction", short: "Returned", hint: "The employee corrects the report", color: C.returned, unit: REPORT, indent: true },
  noReport: { key: "noReport", label: "Released, no report yet", short: "No report yet", hint: "The cash advance is out; a report or a refund settles it", color: C.pending, unit: ADVANCE, indent: true },
  other: { key: "other", label: "Other statuses", short: "Other", hint: OTHER_HINT, color: C.other, unit: REPORT }
};

const ADVANCE_SPECS: Record<"requested" | "released" | "declined" | "liquidated" | "refunded" | "cancelled" | "other", Spec> = {
  requested: { key: "requested", label: "Requested", short: "Requested", hint: "Finance releases or declines it", color: C.action, unit: ADVANCE },
  released: { key: "released", label: "Released", short: "Released", hint: "With the employee, not yet settled", color: C.progress, unit: ADVANCE },
  declined: { key: "declined", label: "Declined", short: "Declined", hint: "Turned down by Finance", color: C.returned, unit: ADVANCE },
  liquidated: { key: "liquidated", label: "Liquidated", short: "Liquidated", hint: "Settled by a validated report", color: C.done, unit: ADVANCE },
  refunded: { key: "refunded", label: "Refunded", short: "Refunded", hint: "Handed back in full", color: C.doneOther, unit: ADVANCE },
  cancelled: { key: "cancelled", label: "Cancelled", short: "Cancelled", hint: "No longer open", color: C.closed, unit: ADVANCE },
  other: { key: "other", label: "Other statuses", short: "Other", hint: OTHER_HINT, color: C.other, unit: ADVANCE }
};

const CLAIM_SPECS: Record<"withHr" | "withFinance" | "returned" | "awaitingPayment" | "paid" | "other", Spec> = {
  withHr: { key: "withHr", label: "With HR", short: "With HR", hint: "HR verifies the claim", color: C.action, unit: CLAIM },
  withFinance: { key: "withFinance", label: "With Finance", short: "With Finance", hint: "Finance validates the claim", color: C.progress, unit: CLAIM },
  returned: { key: "returned", label: "Returned for correction", short: "Returned", hint: "The employee corrects the claim", color: C.returned, unit: CLAIM },
  awaitingPayment: { key: "awaitingPayment", label: "Validated, payment pending", short: "Payment pending", hint: "Finance records the payment", color: C.pending, unit: CLAIM },
  paid: { key: "paid", label: "Paid", short: "Paid", hint: "Reimbursed to the employee", color: C.done, unit: CLAIM },
  other: { key: "other", label: "Other statuses", short: "Other", hint: OTHER_HINT, color: C.other, unit: CLAIM }
};

const add = (...tallies: Tally[]): Tally => ({
  count: tallies.reduce((n, t) => n + t.count, 0),
  amount: sumPesos(tallies.map(t => t.amount))
});

/** The lines and chart parts of one panel. "Other" shows only when something has one of those statuses. */
export function panelModel(panel: PanelKey, f: StatusFigures, load: LoadState): PanelModel {
  const reports = availability(["reports"], load);
  const advances = availability(["advances"], load);
  // A released advance counts as "no report" only once the reports are known: it is looked up among them.
  const both = availability(["reports", "advances"], load);
  const line = (spec: Spec, tally: Tally, state: Availability): FigureLine => ({ ...spec, tally, state });

  if (panel === "liquidations") {
    const L = f.liquidations, S = LIQUIDATION_SPECS;
    const parts = [
      line(S.liquidated, L.liquidated, reports),
      line(S.withHr, L.withHr, reports),
      line(S.withFinance, L.withFinance, reports),
      line(S.returned, L.returned, reports),
      line(S.noReport, L.noReport, both),
      ...(L.other.count > 0 ? [line(S.other, L.other, reports)] : [])
    ];
    // Reports and released advances together, so neither word fits one of them.
    // Its amount adds two kinds of money, so its hint says which (the code review of Part C): the reports' spending, and
    // the cash released on advances with no report yet (the "Advances not yet liquidated" card above counts only those).
    const notYet: FigureLine = {
      key: "notYet", sum: true, label: "Not yet liquidated", short: "Not yet", unit: ["record", "records"], emphasis: "group",
      hint: "Reports at what they spent; cash advances with no report at the cash released",
      tally: add(L.withHr, L.withFinance, L.returned, L.noReport), state: both
    };
    const filed: FigureLine = {
      key: "filed", label: "Reports filed", short: "Filed", hint: "Cash advances with no report yet aren't counted here",
      unit: REPORT, emphasis: "total", tally: L.filed, state: reports
    };
    return { lines: [parts[0], notYet, ...parts.slice(1), filed], parts, whole: add(L.filed, L.noReport), state: worst(parts.map(p => p.state)) };
  }

  if (panel === "advances") {
    const A = f.advances, S = ADVANCE_SPECS;
    // Nothing sets an advance "Cancelled" any more (a waiting request is declined), so its line shows only when an older
    // one is in the range, as "other" does.
    const keys = ["requested", "released", "declined", "liquidated", "refunded"] as const;
    const parts = [
      ...keys.map(k => line(S[k], A[k], advances)),
      ...(A.cancelled.count > 0 ? [line(S.cancelled, A.cancelled, advances)] : []),
      ...(A.other.count > 0 ? [line(S.other, A.other, advances)] : [])
    ];
    const total: FigureLine = {
      key: "total", label: "Requested in all", short: "In all", hint: "Every cash advance requested in the range",
      unit: ADVANCE, emphasis: "total", tally: A.total, state: advances
    };
    return { lines: [...parts, total], parts, whole: A.total, state: advances };
  }

  const R = f.reimbursements, S = CLAIM_SPECS;
  const keys = ["withHr", "withFinance", "returned", "awaitingPayment", "paid"] as const;
  const parts = [...keys.map(k => line(S[k], R[k], reports)), ...(R.other.count > 0 ? [line(S.other, R.other, reports)] : [])];
  const total: FigureLine = {
    key: "total", label: "Claims filed", short: "In all", hint: "Every reimbursement claim filed in the range",
    unit: CLAIM, emphasis: "total", tally: R.total, state: reports
  };
  return { lines: [...parts, total], parts, whole: R.total, state: reports };
}

/** "Nov 1–30, 2026", "From Nov 1, 2026", "Up to Nov 30, 2026", or "All dates" (the days are YYYY-MM-DD, as checked). */
export function rangeWords({ from, to }: DateRange): string {
  if (from && to) return dateRange(from, to);
  if (from) return `From ${dateRange(from, from)}`;
  if (to) return `Up to ${dateRange(to, to)}`;
  return "All dates";
}

/** "1 report", "3 reports". */
export const countWords = (n: number, unit: readonly [string, string]) => `${n} ${n === 1 ? unit[0] : unit[1]}`;

/**
 * A bar chart's axis step, for four even intervals up to at least `max`: a whole number up to 10, then multiples of 5,
 * 50, 500… (Recharts' own rounding). Drawn as explicit ticks, so the axis never ends on a squeezed extra tick ("9 10"),
 * and a range with nothing in it still draws 0 to 4.
 */
export function axisStep(max: number): number {
  const x = Math.max(0, Number(max) || 0) / 4;
  if (x <= 1) return 1;
  const unit = x <= 10 ? 1 : 5 * 10 ** (Math.floor(Math.log10(x)) - 1);
  return Math.ceil(x / unit) * unit;
}

/** Whole percent of the whole's count, rounded down as the ring rounds it (so 100% means every one: 199 of 200 is 99%),
 * or "—" when there is nothing to measure against. */
export function shareText(count: number, whole: number): string {
  return whole > 0 ? `${Math.floor((count / whole) * 100)}%` : "—";
}
