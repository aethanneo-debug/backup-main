import type { ReactNode } from "react";
import type { ClaimType, TrainingHistorySeminar } from "../../types";
import { formatCurrency, formatDate } from "../../utils";
import { ClaimTypeBadge } from "../liquidation/ClaimType";
import { Badge, advanceTone, reportTone } from "../training/TrainingHistoryCards";
import { seatWord } from "./trainingReportRows";

// The cells the employee's history and the seminar's report share: a seat's attendance, certificate, cash advance and
// liquidation report, as the history describes them to HR. They print as they show.

const MONEY = "font-mono tabular-nums";

/** Nothing to show, said to a screen reader too. */
export const Blank = () => (
  <>
    <span aria-hidden="true" className="text-slate-400">&mdash;</span>
    <span className="sr-only">None</span>
  </>
);

const Line = ({ children }: { children: ReactNode }) => <span className="block break-words">{children}</span>;

export function AttendanceCell({ attendance, seat }: Pick<TrainingHistorySeminar, "attendance" | "seat">) {
  if (attendance === "Attended") return <Badge tone="ok">Attended</Badge>;
  if (attendance === "Did not attend") return <Badge tone="bad">Did not attend</Badge>;
  // Someone taken off a seminar was never going to have attendance recorded.
  return seat === "enrolled" ? <Badge tone="none">Not recorded</Badge> : <Blank />;
}

/** Who went in whose place, where the seat has it. */
export function SeatNote({ seat, replacedBy, inLieuOf }: Pick<TrainingHistorySeminar, "seat" | "replacedBy" | "inLieuOf">) {
  return (
    <>
      {seat === "replaced" && <Line>{replacedBy ? `Replaced by ${replacedBy}` : seatWord(seat)}</Line>}
      {seat === "cancelled" && <Line>{seatWord(seat)}</Line>}
      {inLieuOf && <Line>In lieu of {inLieuOf}</Line>}
    </>
  );
}

export function CertificateCell({ certificate }: Pick<TrainingHistorySeminar, "certificate">) {
  if (!certificate) return <span className="text-slate-500">Not on file</span>;
  return (
    <>
      <Line><Badge tone="ok">On file</Badge></Line>
      <span className="mt-0.5 block break-all">{certificate.name}</span>
      {certificate.uploadedAt && <span className="block text-slate-500">{formatDate(certificate.uploadedAt)}</span>}
    </>
  );
}

/** The seat's cash advance. A group's shows this seat's share and names the advance and its holder, so its money isn't read as counted on every seat. */
export function AdvanceCell({ advance }: Pick<TrainingHistorySeminar, "advance">) {
  if (!advance) return <span className="text-slate-500">None</span>;
  const group = advance.group;
  return (
    <>
      <span className="flex flex-wrap items-center gap-1">
        <span className="break-all font-mono font-semibold text-slate-800">{advance.advanceNo || "No number"}</span>
        <Badge tone={advanceTone(advance.status)}>{advance.status || "Status not recorded"}</Badge>
      </span>
      {group ? (
        <>
          {advance.share !== undefined && <Line>Share: <span className={`font-semibold text-slate-800 ${MONEY}`}>{formatCurrency(advance.share)}</span></Line>}
          <Line>
            Group advance of <span className={MONEY}>{formatCurrency(advance.amount)}</span> held by {group.holder || (group.isHolder ? "this employee" : "a colleague")}
            {group.members !== undefined ? ` (${group.members} ${group.members === 1 ? "person" : "people"})` : ""}
          </Line>
        </>
      ) : (
        <Line><span className={`font-semibold text-slate-800 ${MONEY}`}>{formatCurrency(advance.amount)}</span></Line>
      )}
      {advance.dvNo && <Line>DV No. <span className={MONEY}>{advance.dvNo}</span>{advance.dvDate ? ` · ${formatDate(advance.dvDate)}` : ""}</Line>}
      {(advance.refundOrNo || advance.refundedAt) && (
        <Line>
          Refunded{advance.refundOrNo ? <>: OR <span className={MONEY}>{advance.refundOrNo}</span></> : ""}
          {advance.refundedAt ? `${advance.refundOrNo ? " · " : " on "}${formatDate(advance.refundedAt)}` : ""}
        </Line>
      )}
    </>
  );
}

/**
 * The report that settles the seat. A group's one report sits on every seat it covers. On a seminar's report
 * (`figuresOnHolder`) its figures go on the holder's row alone, so they aren't read as counted on each; on one employee's
 * history they are marked as the group's.
 */
export function LiquidationCell({ report, advance, figuresOnHolder = false }: Pick<TrainingHistorySeminar, "report" | "advance"> & { figuresOnHolder?: boolean }) {
  if (!report) return <span className="text-slate-500">Not filed</span>;
  const covered = report.group;
  const ofGroup = covered || !!advance?.group;
  const showFigures = !(figuresOnHolder && covered);
  const whose = covered ? " (the group's)" : "";
  return (
    <>
      <span className="flex flex-wrap items-center gap-1">
        <span className="break-all font-mono font-semibold text-slate-800">{report.submissionNo || "No number"}</span>
        <Badge tone={reportTone(report.status)}>{report.status || "Status not recorded"}</Badge>
      </span>
      {(report.claimType || ofGroup) && (
        <span className="mt-0.5 flex flex-wrap gap-1">
          <ClaimTypeBadge claimType={report.claimType as ClaimType | undefined} small />
          {ofGroup && <Badge tone="none">Group report</Badge>}
        </span>
      )}
      {showFigures ? (
        <>
          {report.totalSpent !== undefined && <Line>Spent: <span className={`font-semibold text-slate-800 ${MONEY}`}>{formatCurrency(report.totalSpent)}</span>{whose}</Line>}
          {report.refund && (
            <Line>
              Handed back: <span className={MONEY}>{formatCurrency(report.refund.amount)}</span>{whose}
              {report.refund.orNo ? <> · OR <span className={MONEY}>{report.refund.orNo}</span></> : null}
            </Line>
          )}
        </>
      ) : (
        <Line><span className="text-slate-500">Its figures are on the holder&rsquo;s row.</span></Line>
      )}
    </>
  );
}

/** Label-value pairs, for a seminar's details, its budget and its totals. */
export function ReportFacts({ title, items, hook }: {
  title: string;
  items: [string, ReactNode][];
  hook?: "details" | "budget";
}) {
  return (
    <section data-report-details={hook === "details" ? "" : undefined} data-report-budget={hook === "budget" ? "" : undefined} className="min-w-0">
      <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{title}</h4>
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white p-3">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-0.5 break-words text-xs text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
