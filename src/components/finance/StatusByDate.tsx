import { useId, useMemo, useState } from "react";
import { ClipboardCheck, HandCoins, Receipt } from "lucide-react";
import { manilaDay } from "../../trainingCalendar";
import PanelBoundary from "../dashboard/PanelBoundary";
import { presetRange, statusFigures, type RangePreset, type StatusAdvance, type StatusReport } from "./statusFigures";
import LiquidationsDonut from "./status/LiquidationsDonut";
import RangeControls from "./status/RangeControls";
import StatusBars from "./status/StatusBars";
import StatusPanel from "./status/StatusPanel";
import { choiceProblem, nextChoice, panelModel, rangeInForce, rangeWords, type LoadState, type PanelModel, type RangeChoice } from "./status/statusRows";

export type { StatusAdvance } from "./statusFigures";

export interface StatusByDateProps {
  /** GET /api/liquidation-submissions, as Finance's overview already holds it. */
  reports: readonly StatusReport[];
  /** GET /api/cash-advances; null when they couldn't be loaded. */
  advances: readonly StatusAdvance[] | null;
  /** The fiscal year in view ("" until the years load). */
  fiscalYear: string;
  /** Its first and last days, for "This fiscal year". */
  fiscalYearDates?: { start?: string; end?: string };
  status: LoadState;
  onOpenDesk: () => void;
}

/**
 * Finance's figures by date filed or requested (the instructor's request of 2026-11-11, 12ag Part C): every status of
 * the liquidations, cash advances and reimbursement claims filed or requested in a range of days, by the rules of
 * statusFigures.ts, from the two lists the overview already loads. Its own box (PanelBoundary): a record it can't draw
 * shows a notice in its place, and the rest of Finance's page keeps working.
 */
export default function StatusByDate(props: StatusByDateProps) {
  return (
    <PanelBoundary name="The figures by date filed or requested">
      <StatusSection {...props} />
    </PanelBoundary>
  );
}

function StatusSection({ reports, advances, fiscalYear, fiscalYearDates, status, onOpenDesk }: StatusByDateProps) {
  const headingId = useId();
  const [choice, setChoice] = useState<RangeChoice>({ kind: "preset", preset: "all" });
  const today = manilaDay();
  const presetDays = (preset: RangePreset) =>
    presetRange(preset, today, { label: fiscalYear, start: fiscalYearDates?.start, end: fiscalYearDates?.end });

  // The rules of the choice are statusRows.ts's (tested): a box the browser can't read, or a range that isn't one, keeps
  // the last range that could be used in force.
  const problem = choiceProblem(choice);
  const range = rangeInForce(choice, presetDays);
  const words = rangeWords(range);
  const figures = useMemo(() => statusFigures(reports, advances, range), [reports, advances, range.from, range.to]);
  const onType = (side: "from" | "to", day: string, bad: boolean) => setChoice(prev => nextChoice(prev, side, day, bad, presetDays));

  const load: LoadState = { loading: status.loading, reportsFailed: status.reportsFailed, advancesFailed: status.advancesFailed };
  const liquidations = panelModel("liquidations", figures, load);
  const cashAdvances = panelModel("advances", figures, load);
  const claims = panelModel("reimbursements", figures, load);
  const models = [liquidations, cashAdvances, claims];
  // A true zero: every list loaded, and nothing in the range anywhere. Said once, above; a panel says its own when only
  // it has nothing.
  const nothing = models.every(m => m.state === "ready" && m.whole.count === 0);
  const emptyNote = (m: PanelModel, text: string) => (!nothing && m.state === "ready" && m.whole.count === 0 ? text : null);

  const fiscalPreset = choice.kind === "preset" && choice.preset === "fiscalYear";
  const note = !fiscalPreset ? null
    : range.from || range.to
      ? `From the first to the last day of FY ${fiscalYear}. The “Fiscal year ${fiscalYear}” cards below count seminar reports in their seminar’s year instead, so their figures can differ.`
      : `FY ${fiscalYear || "…"}’s days aren’t known yet, so every date is counted.`;

  return (
    <section data-status-range="" aria-labelledby={headingId} className="min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 id={headingId} className="min-w-0 break-words font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">By date filed or requested</h2>
        <span className="min-w-0 text-[10px] text-slate-500">Reports and claims by the day they were filed; cash advances by the day they were requested</span>
      </div>

      <RangeControls
        fiscalYear={fiscalYear}
        preset={choice.kind === "preset" ? choice.preset : null}
        inputs={choice.kind === "custom" ? choice.typed : range}
        problem={problem}
        words={words}
        note={note}
        nothing={nothing}
        onPreset={preset => setChoice({ kind: "preset", preset })}
        onType={onType}
      />

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <StatusPanel
          panel="liquidations"
          title="Liquidations"
          icon={ClipboardCheck}
          description="Reports by the day they were filed, and released cash advances still without one by the day they were requested. Amounts: what each report spent, or the cash released."
          model={liquidations}
          chart={<LiquidationsDonut parts={liquidations.parts} rangeText={words} />}
          skeleton="mx-auto h-36 w-36 max-w-full"
          failedNote={status.reportsFailed ? "The liquidation reports couldn't be loaded." : "The cash advances couldn't be loaded, so the share liquidated can't be worked out."}
          emptyNote={emptyNote(liquidations, "No liquidation report was filed, and no released cash advance is waiting for one, in this range.")}
          caption={`Liquidations, ${words}: count, amount and share by status`}
          deskFor="liquidation reports"
          onOpenDesk={onOpenDesk}
          className="lg:col-span-2 xl:col-span-1"
        />
        <StatusPanel
          panel="advances"
          title="Cash advances"
          icon={HandCoins}
          description="Cash advances by the day they were requested (an older one released directly, by the day it was released). A group's advance counts once. Amounts: the cash asked for or released."
          model={cashAdvances}
          chart={<StatusBars chartId="fin-advances" parts={cashAdvances.parts} title={`Cash advances requested, ${words}`} />}
          skeleton="h-44"
          failedNote="The cash advances couldn't be loaded."
          emptyNote={emptyNote(cashAdvances, "No cash advance was requested in this range.")}
          caption={`Cash advances, ${words}: count, amount and share by status`}
          deskFor="cash advances"
          onOpenDesk={onOpenDesk}
        />
        <StatusPanel
          panel="reimbursements"
          title="Reimbursement claims"
          icon={Receipt}
          description="What the Reimbursement Queue pays: claims for seminars employees paid for themselves, and older liquidations that spent more than their advance (for the difference), by the day they were filed. Amounts: what each claim asks for."
          model={claims}
          chart={<StatusBars chartId="fin-reimbursements" parts={claims.parts} title={`Reimbursement claims filed, ${words}`} />}
          skeleton="h-40"
          failedNote="The reimbursement claims couldn't be loaded."
          emptyNote={emptyNote(claims, "No reimbursement claim was filed in this range.")}
          caption={`Reimbursement claims, ${words}: count, amount and share by status`}
          deskFor="reimbursement claims"
          onOpenDesk={onOpenDesk}
        />
      </div>
    </section>
  );
}
