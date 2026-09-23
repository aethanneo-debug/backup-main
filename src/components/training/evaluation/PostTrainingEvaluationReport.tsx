import React from "react";
import {
  TRAINING_EVALUATION_BANDS,
  TRAINING_EVALUATION_PROMPTS,
  TRAINING_EVALUATION_SCALE,
  TRAINING_EVALUATION_STATEMENTS,
  TrainingEvaluation
} from "../../../types";
import HsacLogo from "../../HsacLogo";
import { dateRange } from "./EvaluationRecordHeader";
import { TrainingEvaluationQueueRow, deriveTotals, longDate, toFiveComments, toFiveRatings } from "./evaluationQueue";

interface Props {
  row: TrainingEvaluationQueueRow;
  evaluation: TrainingEvaluation;
}

/** One sheet of the paper form. The print stylesheet breaks a page before each one. */
function Page({ n, of, children }: { n: number; of: number; children: React.ReactNode }) {
  return (
    <section
      className="pte-page mx-auto mb-4 w-full max-w-[820px] bg-white p-8 text-[11px] leading-snug text-slate-900 print:mb-0 print:max-w-none"
      aria-label={`Page ${n} of ${of}`}
    >
      {children}
      <p className="mt-4 text-right font-mono text-[9px] text-slate-500">
        Page {n} of {of}
      </p>
    </section>
  );
}

/** A labelled cell of the header grid. An empty value still prints its rule. */
function HeaderCell({ label, value, colSpan }: { label: string; value?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className="border border-slate-800 px-2 py-1.5 align-top">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">{label}</span>
      <span className="mt-0.5 block min-h-[1rem] border-b border-slate-400 text-[11px] font-bold text-slate-900">
        {(value ?? "").trim() || " "}
      </span>
    </td>
  );
}

/**
 * The official HSAC Post-Training Performance Evaluation Report, print-faithful.
 *
 * Presentational only — it never calls the API. The Overall and Qualitative Ratings are
 * printed from the server's stored values, which the server derives from the ticks; the
 * local fallback only covers a record saved before those fields existed.
 *
 * The signature line prints blank. The supervisor signs on paper, and the system never
 * draws a signature — it only prints the name and designation beneath the rule.
 */
export default function PostTrainingEvaluationReport({ row, evaluation }: Props) {
  const ratings = toFiveRatings(evaluation.ratings);
  const comments = toFiveComments(evaluation.comments);
  const fallback = deriveTotals(ratings);
  const overall = typeof evaluation.overallRating === "number" ? evaluation.overallRating : fallback.overallRating;
  const qualitative = evaluation.qualitativeRating || fallback.qualitativeRating;
  const isDraft = evaluation.status !== "Finalized";

  return (
    <div id="pte-print-root" className="w-full">
      {isDraft && (
        <p className="mx-auto mb-2 max-w-[820px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 print:hidden">
          This is a <strong className="font-semibold">draft</strong>. Print it to check the wording, but finalise it
          before sending it up for signature.
        </p>
      )}

      {/* ---------- Page 1: masthead, header block, Part I, band table ---------- */}
      <Page n={1} of={3}>
        <header className="mb-4 flex items-center justify-center gap-3 text-center">
          <HsacLogo size={44} />
          <div className="leading-tight">
            <p className="text-[10px]">Republic of the Philippines</p>
            <p className="text-[12px] font-bold uppercase tracking-tight">
              Human Settlements Adjudication Commission
            </p>
            <p className="text-[9px] italic">Komisyon sa Adhudikasyon para sa Pananahanang Pantao</p>
            <p className="text-[9px] font-bold uppercase text-slate-700">Regional Adjudication Branch No. I</p>
            <p className="text-[9px] text-slate-600">
              Dona Pepita Building, Quezon Avenue, Barangay II, San Fernando City, La Union
            </p>
          </div>
        </header>

        <h1 className="mb-1 text-center text-[13px] font-extrabold uppercase tracking-[0.15em]">
          Post-Training Performance Evaluation Report
        </h1>
        <p className="mb-3 text-center text-[9px] italic text-slate-600">
          To be accomplished by the immediate supervisor after the employee has attended the training or seminar.
        </p>

        <table className="w-full table-fixed border-collapse border border-slate-800">
          <tbody>
            <tr>
              <HeaderCell label="Name of Employee" value={row.employeeName} />
              <HeaderCell label="Position" value={row.position} />
            </tr>
            <tr>
              <HeaderCell label="Division / Unit" value={row.division} />
              <HeaderCell label="Date of Evaluation" value={longDate(evaluation.dateOfEvaluation)} />
            </tr>
            <tr>
              <HeaderCell label="Title of Training / Seminar Attended" value={row.trainingTitle} colSpan={2} />
            </tr>
            <tr>
              <HeaderCell label="Date Conducted" value={dateRange(row.dateConducted, row.dateEnded)} />
              <HeaderCell label="Organizer / Facilitator" value={row.organizer} />
            </tr>
          </tbody>
        </table>

        <h2 className="mt-4 text-[11px] font-bold uppercase tracking-wide">Part I. Performance Indicators</h2>
        <p className="mb-2 text-[10px]">
          Rate the employee on each statement by placing a check mark (&#10003;) under the appropriate column, using
          the scale below.
        </p>

        {/* The scale, printed as its own table exactly as the form does. */}
        <table className="mb-3 w-1/2 border-collapse border border-slate-800">
          <thead>
            <tr className="bg-slate-100">
              <th scope="col" className="border border-slate-800 px-2 py-1 text-[9px] font-bold uppercase">
                Rating
              </th>
              <th scope="col" className="border border-slate-800 px-2 py-1 text-[9px] font-bold uppercase">
                Equivalent
              </th>
            </tr>
          </thead>
          <tbody>
            {TRAINING_EVALUATION_SCALE.map(s => (
              <tr key={s.value}>
                <td className="border border-slate-800 px-2 py-1 text-center font-mono font-bold">{s.value}</td>
                <td className="border border-slate-800 px-2 py-1">{s.label}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="w-full border-collapse border border-slate-800">
          <thead>
            <tr className="bg-slate-100">
              <th scope="col" className="w-10 border border-slate-800 px-1 py-1 text-[9px] font-bold uppercase">
                No.
              </th>
              <th scope="col" className="border border-slate-800 px-2 py-1 text-left text-[9px] font-bold uppercase">
                Statement
              </th>
              {TRAINING_EVALUATION_SCALE.map(s => (
                <th key={s.value} scope="col" className="w-12 border border-slate-800 px-1 py-1 text-center">
                  <span className="block font-mono text-[11px] font-bold">{s.value}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(TRAINING_EVALUATION_STATEMENTS ?? []).map((statement, i) => (
              <tr key={i}>
                <td className="border border-slate-800 px-1 py-1.5 text-center font-mono">{i + 1}</td>
                <td className="border border-slate-800 px-2 py-1.5 align-top">{statement}</td>
                {TRAINING_EVALUATION_SCALE.map(s => (
                  <td
                    key={s.value}
                    className="border border-slate-800 px-1 py-1.5 text-center align-middle text-[13px] font-bold"
                  >
                    {ratings[i] === s.value ? "✓" : " "}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-slate-100">
              <td colSpan={2} className="border border-slate-800 px-2 py-1.5 text-right text-[10px] font-bold uppercase">
                Overall Rating
              </td>
              <td colSpan={4} className="border border-slate-800 px-2 py-1.5 text-center">
                <span className="font-mono text-[13px] font-bold tabular-nums">{overall}</span>
                <span className="font-mono text-[10px]"> / 20</span>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-slate-800 px-2 py-1.5 text-right text-[10px] font-bold uppercase">
                Qualitative Rating
              </td>
              <td colSpan={4} className="border border-slate-800 px-2 py-1.5 text-center text-[11px] font-bold uppercase">
                {qualitative}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide">Rating Equivalent</p>
        <table className="mt-1 w-1/2 border-collapse border border-slate-800">
          <thead>
            <tr className="bg-slate-100">
              <th scope="col" className="border border-slate-800 px-2 py-1 text-[9px] font-bold uppercase">
                Total Score
              </th>
              <th scope="col" className="border border-slate-800 px-2 py-1 text-[9px] font-bold uppercase">
                Qualitative Rating
              </th>
            </tr>
          </thead>
          <tbody>
            {TRAINING_EVALUATION_BANDS.map(b => (
              <tr key={b.label}>
                <td className="border border-slate-800 px-2 py-1 text-center font-mono">
                  {b.min} &ndash; {b.max}
                </td>
                <td className="border border-slate-800 px-2 py-1">{b.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Page>

      {/* ---------- Pages 2 and 3: Part II, then the signature block ---------- */}
      <Page n={2} of={3}>
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide">Part II. Narrative Report</h2>
        {[0, 1, 2].map(i => (
          <Answer key={i} index={i} prompt={TRAINING_EVALUATION_PROMPTS[i]} answer={comments[i]} />
        ))}
      </Page>

      <Page n={3} of={3}>
        {[3, 4].map(i => (
          <Answer key={i} index={i} prompt={TRAINING_EVALUATION_PROMPTS[i]} answer={comments[i]} />
        ))}

        {/* Wet signature: the rule prints blank, the name and designation beneath it. */}
        <div className="mt-10 flex flex-col items-start gap-1">
          <div className="h-10" aria-hidden="true" />
          <p className="w-80 border-t border-slate-800 pt-1 text-[11px] font-bold uppercase text-slate-900">
            {(evaluation.supervisorName || "").trim() || " "}
          </p>
          <p className="w-80 text-[10px] text-slate-700">{(evaluation.supervisorPosition || "").trim() || " "}</p>
          <p className="w-80 text-[9px] italic text-slate-600">
            Name, signature, and designation of the Immediate Supervisor
          </p>
          <p className="mt-4 text-[10px]">
            Date:{" "}
            <span className="inline-block min-w-[10rem] border-b border-slate-800 px-1 text-[11px] font-semibold">
              {longDate(evaluation.dateOfEvaluation) || " "}
            </span>
          </p>
        </div>
      </Page>
    </div>
  );
}

/** One Part II prompt with the supervisor's answer on ruled space. */
function Answer({ index, prompt, answer }: { index: number; prompt: string; answer: string }) {
  const text = (answer || "").trim();
  return (
    <div className="mb-4">
      <p className="flex gap-1.5 text-[11px] font-semibold">
        <span className="font-mono">{index + 1}.</span>
        <span>{prompt}</span>
      </p>
      <p className="mt-1 min-h-[3.5rem] whitespace-pre-line border-b border-slate-400 pb-1 text-[11px] text-slate-900">
        {text || " "}
      </p>
    </div>
  );
}
