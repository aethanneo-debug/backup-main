import { useId, type ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { formatCurrency } from "../../../utils";
import { Skeleton } from "../../dashboard/LoadStates";
import { ShowFigures, TD, TD_NUM, TH, TH_NUM } from "../../dashboard/hr/HrPanel";
import { shareText, type FigureLine, type PanelKey, type PanelModel } from "./statusRows";

interface StatusPanelProps {
  /** data-status: which of the three it is. */
  panel: PanelKey;
  title: string;
  icon: LucideIcon;
  /** One line on what it counts, and what its amounts are. */
  description: ReactNode;
  model: PanelModel;
  /** The chart, drawn only once its figures are known. */
  chart: ReactNode;
  /** The grey block's size while it loads: "h-36" for the ring, the bars' height for theirs. */
  skeleton: string;
  /** e.g. "The cash advances couldn't be loaded." */
  failedNote: string;
  /** Said when nothing in the range is counted here (a true zero), or null. */
  emptyNote: string | null;
  /** The table's caption: what it holds, and the range. */
  caption: string;
  /** What the desk link opens it for, for screen readers: "cash advances". */
  deskFor: string;
  onOpenDesk: () => void;
  className?: string;
}

/**
 * One of the three panels of Finance's figures by date (12ag Part C), in the overview's own look (rounded-2xl, mono
 * uppercase heading): the chart, then each status's count and amount, then the same in a table. Each figure that can be
 * shown carries data-status-row (a status, as statusFigures names it), or data-status-total (a sum of our own), with
 * data-count and data-amount; one still loading, or whose list couldn't be loaded, carries none of them, so nothing can
 * read it as 0. Side by side once the panel is 36rem wide (a container query), one above the other when narrower.
 */
export default function StatusPanel(props: StatusPanelProps) {
  const { panel, title, icon: Icon, description, model, chart, skeleton, failedNote, emptyNote, caption, deskFor, onOpenDesk, className = "" } = props;
  const titleId = useId();
  return (
    <section
      data-status={panel}
      aria-labelledby={titleId}
      aria-busy={model.state === "loading"}
      className={`custom-scrollbar @container min-w-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm max-sm:overflow-x-auto sm:p-5 ${className}`}
    >
      {/* Below 640 px the app's sidebar leaves the page a few dozen pixels: the panel keeps 16rem and scrolls sideways
          inside itself, rather than wrapping a word to a line. */}
      <div className="flex h-full flex-col max-sm:min-w-[16rem]">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <h3 id={titleId} className="min-w-0 font-mono text-xs font-bold uppercase tracking-wider text-slate-800">{title}</h3>
          <Icon size={14} className="shrink-0 text-blue-600" aria-hidden="true" />
        </div>
        <p className="mt-2 text-[10px] leading-snug text-slate-500">{description}</p>

        <div className="mt-3 flex flex-col gap-4 @xl:flex-row @xl:items-start">
          <div className="min-w-0 @xl:w-60 @xl:shrink-0">
            {model.state === "loading" ? (
              <Skeleton className={skeleton} />
            ) : model.state === "failed" ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-[11px] italic text-slate-500">{failedNote}</p>
            ) : chart}
          </div>
          <ul className="min-w-0 flex-1 space-y-2" aria-label={`${title}: count and amount by status`}>
            {model.lines.map(line => <FigureItem key={line.key} line={line} />)}
          </ul>
        </div>

        {emptyNote && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">{emptyNote}</p>}

        <ShowFigures>
          <table className="w-full min-w-[17rem] text-left">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH_NUM}>Count</th>
                <th scope="col" className={TH_NUM}>Amount</th>
                <th scope="col" className={TH_NUM}>Share</th>
              </tr>
            </thead>
            <tbody>
              {model.lines.map(line => {
                const v = shownValues(line);
                return (
                  <tr key={line.key} className={line.emphasis === "total" ? "border-t border-slate-200 font-semibold text-slate-700" : "border-b border-slate-50"}>
                    <th scope="row" className={`${TD} text-slate-700 ${line.emphasis ? "font-semibold" : "font-normal"} ${line.indent ? "pl-3" : ""}`}>{line.label}</th>
                    <td className={TD_NUM}>{v.count}</td>
                    <td className={`${TD_NUM} whitespace-nowrap`}>{v.ready ? v.amount : v.count}</td>
                    <td className={TD_NUM}>{v.ready && model.state === "ready" ? shareText(line.tally.count, model.whole.count) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ShowFigures>

        <div className="mt-auto flex justify-end pt-4">
          <button
            type="button"
            onClick={onOpenDesk}
            aria-label={`Open Liquidation Desk, for the ${deskFor}`}
            className="inline-flex cursor-pointer items-center gap-1 rounded text-[11px] font-semibold text-blue-700 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Open Liquidation Desk <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

/** A figure as shown: "…" while it loads, "—" when its list couldn't be loaded, else the count and the amount. */
function shownValues(line: FigureLine): { ready: boolean; count: string; amount: string } {
  if (line.state === "loading") return { ready: false, count: "…", amount: "Loading…" };
  if (line.state === "failed") return { ready: false, count: "—", amount: "Couldn't be loaded" };
  return { ready: true, count: String(line.tally.count), amount: formatCurrency(line.tally.amount) };
}

/** One line of the figures: its colour (as in the chart), the status and whose turn it is, then its count and amount. */
function FigureItem({ line }: { line: FigureLine }) {
  const v = shownValues(line);
  return (
    <li
      data-status-row={v.ready && !line.sum ? line.key : undefined}
      data-status-total={v.ready && line.sum ? line.key : undefined}
      data-count={v.ready ? line.tally.count : undefined}
      data-amount={v.ready ? line.tally.amount : undefined}
      className={`flex items-start gap-2 ${line.indent ? "pl-4" : ""} ${line.emphasis === "total" ? "border-t border-slate-200 pt-2" : ""}`}
    >
      <span aria-hidden="true" className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={line.color ? { backgroundColor: line.color } : undefined} />
      <span className="min-w-0 flex-1 break-words">
        <span className={`block text-[11px] ${line.emphasis ? "font-bold text-slate-800" : "font-semibold text-slate-700"}`}>{line.label}</span>
        {line.hint && <span className="block text-[10px] leading-snug text-slate-500">{line.hint}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-xs font-bold tabular-nums text-slate-900">
          {v.count}
          {v.ready && <span className="sr-only"> {line.tally.count === 1 ? line.unit[0] : line.unit[1]}</span>}
        </span>
        <span className={`block text-[10px] ${v.ready ? "font-mono tabular-nums text-slate-600" : "italic text-slate-500"}`}>{v.amount}</span>
      </span>
    </li>
  );
}
