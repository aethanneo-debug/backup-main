import {
  TRAINING_EVALUATION_BANDS,
  TRAINING_EVALUATION_SCALE,
  TRAINING_EVALUATION_STATEMENTS,
  TrainingEvaluationRating
} from "../../../types";
import { BAND_BADGE, deriveTotals } from "./evaluationQueue";

interface Props {
  /** Unique per open form, so two rows on screen never share a radio group name. */
  idPrefix: string;
  ratings: (TrainingEvaluationRating | null)[];
  /** Omitted on a finalised report, which is read-only. */
  onChange?: (index: number, value: TrainingEvaluationRating) => void;
  readOnly?: boolean;
}

/**
 * Part I of the Post-Training Performance Evaluation Report.
 *
 * The paper form is a tick in one of four columns, so this is four radios per statement
 * and not a dropdown: the officer sees every option and where the tick sits without
 * opening anything. The Overall and Qualitative Ratings below are derived, never typed —
 * the server recomputes both from the ticks and ignores whatever the client sends, so the
 * total printed on the report can never disagree with the boxes above it.
 */
export default function EvaluationRatingGrid({ idPrefix, ratings, onChange, readOnly = false }: Props) {
  const { overallRating, qualitativeRating } = deriveTotals(ratings);
  const scored = ratings.filter(r => r !== null).length;
  const complete = scored === TRAINING_EVALUATION_STATEMENTS.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">Rating scale</span>
        {TRAINING_EVALUATION_SCALE.map(s => (
          <span key={s.value} className="text-[10px] text-slate-600">
            <strong className="font-mono text-slate-800">{s.value}</strong> &mdash; {s.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-[11px]">
          <caption className="sr-only">
            Part I — five performance statements, each scored from 1 (Needs Improvement) to 4 (Outstanding).
          </caption>
          <thead>
            <tr className="bg-slate-50">
              <th
                scope="col"
                className="border border-slate-200 px-2 py-1.5 text-left font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500"
              >
                Performance Indicator
              </th>
              {TRAINING_EVALUATION_SCALE.map(s => (
                <th key={s.value} scope="col" className="w-[76px] border border-slate-200 px-1 py-1.5 text-center">
                  <span className="block font-mono text-xs font-bold text-slate-800">{s.value}</span>
                  <span className="block text-[8px] font-bold uppercase leading-tight tracking-wide text-slate-400">
                    {s.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(TRAINING_EVALUATION_STATEMENTS ?? []).map((statement, i) => {
              const unscored = ratings[i] === null;
              return (
                <tr key={i} className={unscored && !readOnly ? "bg-amber-50" : "bg-white"}>
                  <th scope="row" className="border border-slate-200 px-2 py-2 text-left align-top font-normal">
                    <span className="flex gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-slate-400">{i + 1}.</span>
                      <span className="leading-snug text-slate-700">{statement}</span>
                    </span>
                    {unscored && !readOnly && (
                      <span className="mt-1 block font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700">
                        Not yet scored
                      </span>
                    )}
                  </th>
                  {TRAINING_EVALUATION_SCALE.map(s => {
                    const checked = ratings[i] === s.value;
                    return (
                      <td key={s.value} className="border border-slate-200 p-0 text-center align-middle">
                        <label
                          className={
                            readOnly
                              ? "flex cursor-default items-center justify-center py-2.5"
                              : "flex cursor-pointer items-center justify-center py-2.5 hover:bg-blue-50"
                          }
                        >
                          <input
                            type="radio"
                            name={idPrefix + "-statement-" + i}
                            value={s.value}
                            checked={checked}
                            disabled={readOnly}
                            onChange={() => onChange?.(i, s.value)}
                            aria-label={`Statement ${i + 1}: ${s.value} — ${s.label}`}
                            className="h-4 w-4 accent-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Derived, and labelled as such — HR must never read these as fields to fill. */}
      <div className="rounded-lg border border-slate-200 border-t-2 border-t-blue-600 bg-slate-50 p-3">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Overall Rating
            </span>
            <strong className="font-mono text-xl font-bold tabular-nums text-slate-900">
              {overallRating}
              <span className="text-xs font-semibold text-slate-400"> / 20</span>
            </strong>
          </div>
          <div>
            <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Qualitative Rating
            </span>
            <span
              className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${BAND_BADGE[qualitativeRating]}`}
            >
              {qualitativeRating}
            </span>
          </div>
          <div className="min-w-[13rem] flex-1">
            <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Equivalent bands
            </span>
            <ul className="mt-1 flex flex-wrap gap-1">
              {TRAINING_EVALUATION_BANDS.map(b => {
                const active = overallRating >= b.min && overallRating <= b.max;
                return (
                  <li
                    key={b.label}
                    aria-current={active ? "true" : undefined}
                    className={
                      active
                        ? "rounded border border-slate-400 bg-white px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-800"
                        : "rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] text-slate-400"
                    }
                  >
                    {b.min}&ndash;{b.max} {b.label}
                    {active && <span className="sr-only"> (current band)</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-slate-500">
          Both figures are computed by the system from the ticks above &mdash; they are not typed and cannot be
          overridden.{" "}
          {complete ? (
            <span className="font-semibold text-slate-600">All five statements scored.</span>
          ) : (
            <span className="font-semibold text-amber-700">
              Provisional: {scored} of {TRAINING_EVALUATION_STATEMENTS.length} statements scored.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
