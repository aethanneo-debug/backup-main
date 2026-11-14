import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "../../../utils";
import { TipBox, TipFigures } from "../../dashboard/hr/HrPanel";
import { countWords, shareText, type FigureLine } from "./statusRows";

/** slate-200: the empty ring, when nothing was filed or is due in the range. */
const TRACK = "#e2e8f0";

interface Slice {
  key: string;
  name: string;
  value: number;
  fill: string;
  line?: FigureLine;
}

interface StatusDonutProps {
  /** data-chart: "fin-liquidations", "fin-reimbursements". */
  chartId: string;
  parts: FigureLine[];
  /** The chart's title, with the range ("Liquidations, this month"). */
  title: string;
  /** The part that is done (emerald), whose share sits in the hole: "liquidated", "paid". */
  doneKey: string;
  /** The word under the share: "liquidated", "paid". */
  doneWord: string;
  /** Said when nothing is in the range: "Nothing filed or due in this range." */
  emptyText: string;
  /** The hole's word when nothing is in the range: "nothing due", "none filed". */
  emptyWord: string;
}

/**
 * One panel's records in the range as one ring, by count: the part that is done (emerald; liquidated, or paid) against
 * each part not done yet, and the share done in the hole, rounded down so 100% means every one. The Liquidations panel
 * and the Reimbursement Claims panel draw it (the user's request of 2026-11-14: the claims panel gets the same ring). No
 * keyboard layer: Recharts 3 would make the ring a Tab stop that moves nothing (a pie's tooltip is per slice); the list
 * beside it and "Show the figures" carry every figure.
 */
export default function StatusDonut({ chartId, parts, title, doneKey, doneWord, emptyText, emptyWord }: StatusDonutProps) {
  const whole = parts.reduce((n, p) => n + p.tally.count, 0);
  const done = parts.find(p => p.key === doneKey)?.tally.count ?? 0;
  const pct = whole > 0 ? Math.floor((done / whole) * 100) : null;
  const slices: Slice[] = whole > 0
    ? parts.filter(p => p.tally.count > 0).map(p => ({ key: p.key, name: p.label, value: p.tally.count, fill: p.color ?? TRACK, line: p }))
    : [{ key: "none", name: "Nothing in this range", value: 1, fill: TRACK }];
  const summary = whole > 0
    ? `${pct}% ${doneWord}. ${parts.map(p => `${p.label}: ${countWords(p.tally.count, p.unit)}, ${formatCurrency(p.tally.amount)}`).join("; ")}.`
    : emptyText;

  return (
    <div data-chart={chartId} className="relative mx-auto aspect-square w-36 max-w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart title={title} desc={`${summary} The list beside the chart gives every figure.`} accessibilityLayer={false}>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="64%"
            outerRadius="96%"
            startAngle={90}
            endAngle={-270}
            stroke="#ffffff"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {slices.map(s => <Cell key={s.key} fill={s.fill} />)}
          </Pie>
          <Tooltip
            // Wider than the ring: it may go past the ring's box (nothing around it clips it above 640 px).
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 30 }}
            content={({ active, payload }) => {
              const line = active ? (payload?.[0]?.payload as Slice | undefined)?.line : undefined;
              if (!line) return null;
              return (
                <TipBox className="w-56">
                  <p className="font-semibold text-slate-800">{line.label}</p>
                  {line.hint && <p className="text-[10px] text-slate-500">{line.hint}</p>}
                  <TipFigures lines={[["Count", countWords(line.tally.count, line.unit)], ["Amount", formatCurrency(line.tally.amount)], ["Share", shareText(line.tally.count, whole)]]} />
                </TipBox>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* The share done, in the hole (the chart's own title and description carry it for screen readers). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold leading-none tabular-nums text-slate-800">{pct === null ? "—" : `${pct}%`}</span>
        <span className="mt-0.5 text-[10px] text-slate-500">{pct === null ? emptyWord : doneWord}</span>
      </div>
    </div>
  );
}
