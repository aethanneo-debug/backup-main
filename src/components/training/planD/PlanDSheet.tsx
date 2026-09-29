import { Fragment } from "react";
import { TRAINING_NEED_CATEGORIES } from "../../../types";
import { longDate } from "../evaluation/evaluationQueue";
import PlanHeader from "../PlanHeader";
import { PLAN_D_HEADINGS, PlanDSnapshot, hasNoNeeds, notAccomplishedText, planDLines } from "./planDRows";

const COLUMN_COUNT = PLAN_D_HEADINGS.length;

// "FUNCTION/DESIGNATION" is wider than its column on Letter paper; let it wrap after the slash.
function breakAfterSlashes(text: string) {
  return text.split("/").map((part, i, parts) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && <>/<wbr /></>}
    </Fragment>
  ));
}

/**
 * The official RAB-1 "Training and Development Plan - D", print-faithful. Presentational
 * only — it never calls the API.
 *
 * Each need sits on its own line with its NOT ACCOMPLISHED pair beside it, and an employee's
 * name spans their whole block. The table uses separate borders so a block can drop the rules
 * under its name cells: collapsed borders would let the neighbouring cell's rule win. The
 * left edge is drawn by each row's first cell rather than the table, whose own border would
 * run on into the space a page break leaves under the last row.
 */
export default function PlanDSheet({ plan }: { plan: PlanDSnapshot }) {
  const offices = plan.offices ?? [];

  return (
    <div id="tdpd-print-root" className="mx-auto min-w-[960px] bg-white p-8 text-slate-900 print:min-w-0 print:p-0">
      <PlanHeader planTitle="Training and Development Plan - D" subtitle={`as of ${longDate(plan.asOf)}`} />

      <table className="w-full table-fixed border-separate border-spacing-0 text-[10px] leading-snug">
        {/* Name and Position fixed; the six need columns share the rest equally. */}
        <colgroup>
          <col style={{ width: "12%" }} />
          <col style={{ width: "11%" }} />
          {PLAN_D_HEADINGS.slice(2).map((_, i) => <col key={i} />)}
        </colgroup>
        <thead>
          <tr>
            {PLAN_D_HEADINGS.map((heading, i) => (
              <th
                key={i}
                scope="col"
                className={`border-t border-r border-b border-slate-600 bg-slate-100 px-1.5 py-1.5 text-center align-middle text-[9px] font-bold uppercase leading-tight tracking-wide ${
                  i === 0 ? "border-l" : ""
                }`}
              >
                {breakAfterSlashes(heading)}
              </th>
            ))}
          </tr>
        </thead>
        {/* A title with no spaces (a pasted link) wraps inside its column instead of spilling. */}
        <tbody className="break-words">
          {offices.length === 0 && (
            <tr>
              <td colSpan={COLUMN_COUNT} className="border-l border-r border-b border-slate-600 p-4 text-center italic text-slate-500">
                No employees on record.
              </td>
            </tr>
          )}
          {offices.map(office => (
            <Fragment key={office.office}>
              <tr>
                <td
                  colSpan={COLUMN_COUNT}
                  className="border-l border-r border-b border-slate-600 bg-slate-50 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider"
                >
                  {office.office}
                </td>
              </tr>
              {(office.employees ?? []).map(emp => {
                const lines = planDLines(emp);
                const nothingListed = hasNoNeeds(emp);
                return lines.map((line, i) => {
                  const last = i === lines.length - 1;
                  // The name cells only close their block on its last line.
                  const nameCell = `border-r border-slate-600 px-1.5 py-1 align-top ${last ? "border-b" : ""}`;
                  return (
                    <tr key={`${emp.employeeId}-${i}`}>
                      <td className={`${nameCell} border-l font-semibold`}>{i === 0 ? emp.fullName : ""}</td>
                      <td className={nameCell}>{i === 0 ? emp.position : ""}</td>
                      {nothingListed ? (
                        <td colSpan={COLUMN_COUNT - 2} className="border-r border-b border-slate-600 px-1.5 py-1 align-top italic text-slate-500">
                          No training needs listed in Plan A.
                        </td>
                      ) : (
                        TRAINING_NEED_CATEGORIES.flatMap(c => {
                          const need = line[c];
                          // Light rules between an employee's needs, a dark one under the block.
                          const cell = `border-r border-b border-r-slate-600 px-1.5 py-1 align-top ${
                            last ? "border-b-slate-600" : "border-b-slate-300"
                          }`;
                          return [
                            <td key={`${c}-need`} className={cell}>{need?.title ?? ""}</td>,
                            <td key={`${c}-not`} className={cell}>{notAccomplishedText(need)}</td>
                          ];
                        })
                      )}
                    </tr>
                  );
                });
              })}
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* The workbook prints who prepared and approved it. The system does not know who holds
          those posts, so the rules print blank and are signed on paper. */}
      <div className="mt-10 grid grid-cols-2 gap-16 break-inside-avoid text-[10px]">
        {["Prepared by:", "Approved by:"].map(label => (
          <div key={label}>
            <p className="font-semibold">{label}</p>
            <div className="h-10" aria-hidden="true" />
            <p className="w-72 border-t border-slate-800 pt-1 text-[9px] italic text-slate-600">Signature over printed name</p>
            <div className="h-6" aria-hidden="true" />
            <p className="w-72 border-t border-slate-800 pt-1 text-[9px] italic text-slate-600">Position / Designation</p>
            <p className="mt-4">
              Date: <span className="inline-block w-40 border-b border-slate-800">&nbsp;</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
