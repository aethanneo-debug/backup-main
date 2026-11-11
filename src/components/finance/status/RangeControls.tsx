import { useId, type ReactNode } from "react";
import { AlertTriangle, CalendarRange } from "lucide-react";
import { PRESET_LABEL, type DateRange, type RangePreset } from "../statusFigures";

/** The presets, narrowest first; "All time" is the one in force at first. */
export const PRESETS: readonly RangePreset[] = ["thisMonth", "lastMonth", "thisQuarter", "fiscalYear", "all"];

interface RangeControlsProps {
  /** The fiscal year in view: "This fiscal year" is named by it ("FY 2029") once it is known. */
  fiscalYear: string;
  /** The preset in force, or null while a range typed in is. */
  preset: RangePreset | null;
  /** What the From and To boxes hold: the range typed in, else the preset's own days. */
  inputs: DateRange;
  /** Why the range typed in can't be used (rangeProblem's words), or null. */
  problem: string | null;
  /** The range in force, in words: "Nov 1–30, 2026", "All dates". */
  words: string;
  /** A line under it, or null. */
  note: ReactNode;
  /** Nothing in the range is counted anywhere: a true zero, said so. */
  nothing: boolean;
  onPreset: (preset: RangePreset) => void;
  /** A day typed in a box; `bad`: the browser can't read what the box holds (half typed, or not a real day), and so
   * reports "" for it, which mustn't read as "no bound". */
  onType: (side: "from" | "to", value: string, bad: boolean) => void;
}

const LABEL = "font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500";
const INPUT = "w-full min-w-0 rounded-lg border bg-white px-2 py-1 font-mono text-xs text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 sm:w-auto";

/**
 * The range Finance's figures by date cover: a preset (pressed, `aria-pressed`), or two days typed in. Typing either day
 * makes the range a custom one and un-presses the presets; the boxes start from the days in force, so changing one keeps
 * the other. A range that can't be used is said (rangeProblem), and the figures stay those of the last one that could.
 */
export default function RangeControls({ fiscalYear, preset, inputs, problem, words, note, nothing, onPreset, onType }: RangeControlsProps) {
  const id = useId();
  const presetsId = `${id}-presets`, fromId = `${id}-from`, toId = `${id}-to`, problemId = `${id}-problem`;
  const inputClass = `${INPUT} ${problem ? "border-rose-400" : "border-slate-300"}`;
  return (
    <div className="custom-scrollbar rounded-2xl border border-slate-200 bg-white p-2 shadow-sm max-sm:overflow-x-auto sm:p-4">
      {/* Below 640 px it keeps 16rem and scrolls sideways inside its box (the app’s sidebar leaves the page a few dozen pixels). */}
      <div className="max-sm:min-w-[16rem]">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p id={presetsId} className={LABEL}>Range</p>
            <div role="group" aria-labelledby={presetsId} className="mt-1.5 flex flex-wrap gap-1.5">
              {PRESETS.map(p => {
                const on = preset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    data-range-preset={p}
                    aria-pressed={on}
                    onClick={() => onPreset(p)}
                    className={`max-w-full cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                      on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    {/* The year shown with the FY button, which may not be the current one. */}
                    {p === "fiscalYear" && fiscalYear ? `FY ${fiscalYear}` : PRESET_LABEL[p]}
                  </button>
                );
              })}
            </div>
          </div>
          <fieldset className="min-w-0">
            <legend className={LABEL}>Custom</legend>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <label htmlFor={fromId} className="text-[11px] font-semibold text-slate-600">From</label>
              <input
                id={fromId}
                data-range-from=""
                type="date"
                value={inputs.from}
                onChange={e => onType("from", e.target.value, e.currentTarget.validity.badInput)}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? problemId : undefined}
                className={inputClass}
              />
              <label htmlFor={toId} className="text-[11px] font-semibold text-slate-600">To</label>
              <input
                id={toId}
                data-range-to=""
                type="date"
                value={inputs.to}
                onChange={e => onType("to", e.target.value, e.currentTarget.validity.badInput)}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? problemId : undefined}
                className={inputClass}
              />
            </div>
          </fieldset>
        </div>

        {problem && (
          <p id={problemId} role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{problem} The figures below still show {words}.</span>
          </p>
        )}

        {/* Read out when it changes, so pressing a preset or typing a day says what is now shown. */}
        <div role="status" className="mt-3 flex items-start gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
          <CalendarRange size={13} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
          <p className="min-w-0 break-words">
            Showing <strong data-range-text="" className="font-semibold text-slate-800">{words}</strong>
            {nothing && <span className="mt-1 block font-semibold text-slate-700">Nothing filed or requested in this range.</span>}
          </p>
        </div>
        {note && <p className="mt-1 break-words text-[10px] leading-snug text-slate-500">{note}</p>}
        <p className="mt-1 break-words text-[10px] leading-snug text-slate-500">
          Days are Manila&rsquo;s, both ends included. A record with no date that can be read counts only under All time.
        </p>
      </div>
    </div>
  );
}
