import type { ReactNode } from "react";
import { Award, Eye, ReceiptText, Wallet } from "lucide-react";
import type { ClaimType, TrainingHistoryRecord, TrainingHistorySeminar } from "../../types";
import { formatCurrency, formatDate } from "../../utils";
import { recordCounts } from "../../trainingRecord";
import { ClaimTypeBadge } from "../liquidation/ClaimType";

// One row of an employee's training history (the instructor's review, R11), as a card: a seminar seat with its
// certificate, cash advance and liquidation report, or a training HR recorded. Only what the server sent is drawn: an
// employee's own history leaves out what other people's records hold (a group report's figures, who went in their
// place), so those parts simply don't appear. The list itself is EmployeeTrainingHistory.tsx.

const BADGE = "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold";
const TONES = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  wait: "border-amber-200 bg-amber-50 text-amber-800",
  bad: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  none: "border-slate-200 bg-slate-50 text-slate-600"
} as const;
type Tone = keyof typeof TONES;

export const Badge = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={`${BADGE} ${TONES[tone]}`}>{children}</span>
);

/** "May 10, 2026", or "May 10, 2026 – May 11, 2026" for a seminar of several days. */
export function dateRange(start: string, end: string): string {
  if (!start) return "Not set";
  return !end || end === start ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

const hoursText = (hours: number) => (hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : "Not set");

// The stages in the house colours: settled in emerald, waiting in amber, refused in rose, under way in blue.
export const advanceTone = (status: string): Tone =>
  status === "Liquidated" || status === "Refunded" ? "ok"
    : status === "Requested" ? "wait"
    : status === "Declined" ? "bad"
    : status === "Released" ? "info" : "none";
export const reportTone = (status: string): Tone =>
  status === "Completed" || status === "Approved" ? "ok"
    : status === "Returned" ? "wait"
    : status === "Rejected" ? "bad" : "info";
export const recordTone = (status: string): Tone =>
  status === "Verified" ? "ok" : status === "Returned" || status === "Rejected" ? "bad" : "wait";

const MONEY = "font-mono tabular-nums";

/** Label-value pairs, in a grid that folds to two columns on a narrow screen. */
function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
          <dd className="mt-0.5 break-words text-xs text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One of a seminar card's three parts: the certificate, the cash advance, the report. */
function Part({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1 bg-white px-4 py-3 text-xs text-slate-700">
      <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span className="text-slate-400" aria-hidden="true">{icon}</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <p className="text-slate-500">{children}</p>;

function CardHead({ kind, fiscalYear, title, badges }: { kind: string; fiscalYear: string; title: string; badges: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600">{kind}</span>
          {fiscalYear ? `FY ${fiscalYear}` : "No fiscal year on file"}
        </p>
        <h3 className="mt-1 break-words text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-1">{badges}</div>
    </div>
  );
}

export function SeminarHistoryCard({ row, onViewCertificate }: {
  row: TrainingHistorySeminar;
  onViewCertificate: (row: TrainingHistorySeminar) => void;
}) {
  const title = row.title || "Untitled seminar";
  const advance = row.advance;
  const report = row.report;
  // A covered member's copy of the group's report: its number and status only (12v decision 8).
  const reportFiguresWithheld = !!report?.group && report.totalSpent === undefined && !report.claimType;
  const holder = advance?.group && !advance.group.isHolder ? advance.group.holder : "";
  // Absent from a covered member's own copy, whose amount is then their share.
  const members = advance?.group?.members;
  return (
    <li
      data-history-row
      data-kind="seminar"
      data-participant-id={row.participantId}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="space-y-3 px-4 py-3">
        <CardHead
          kind="Seminar"
          fiscalYear={row.fiscalYear}
          title={title}
          badges={
            <>
              {row.attendance === "Attended" && <Badge tone="ok">Attended</Badge>}
              {row.attendance === "Did not attend" && <Badge tone="bad">Did not attend</Badge>}
              {!row.attendance && row.seat === "enrolled" && <Badge tone="none">Attendance not recorded</Badge>}
              {row.seat === "replaced" && <Badge tone="none">Replaced by a representative</Badge>}
              {row.seat === "cancelled" && <Badge tone="none">Taken off the seminar</Badge>}
            </>
          }
        />
        <Facts
          items={[
            ["Dates", dateRange(row.startDate, row.endDate)],
            ["Venue", row.venue || "Not set"],
            ["Hours", hoursText(row.hours)],
            ["Facilitator", row.facilitator || "Not set"]
          ]}
        />
        {/* Who went in whose place: HR and the Administrator only (12z Part B); the server sends nothing else. */}
        {(row.replacedBy || row.inLieuOf) && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {row.replacedBy && <>Replaced by <strong className="font-semibold">{row.replacedBy}</strong>, sent in lieu of this employee. </>}
            {row.inLieuOf && <>Sent in lieu of <strong className="font-semibold">{row.inLieuOf}</strong>.</>}
          </p>
        )}
      </div>

      <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-3">
        <Part icon={<Award size={12} />} title="Certificate of attendance">
          {row.certificate ? (
            <>
              <p className="break-all font-medium text-slate-800">{row.certificate.name || "Certificate of attendance"}</p>
              {row.certificate.uploadedAt && <Muted>Uploaded {formatDate(row.certificate.uploadedAt)}</Muted>}
              <button
                type="button"
                data-history-cert
                onClick={() => onViewCertificate(row)}
                className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Eye size={12} aria-hidden="true" /> View<span className="sr-only"> the certificate for {title}</span>
              </button>
            </>
          ) : (
            <Muted>Not on file</Muted>
          )}
        </Part>

        <Part icon={<Wallet size={12} />} title="Cash advance">
          {advance ? (
            <>
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono font-semibold text-slate-800">{advance.advanceNo || "No number"}</span>
                <Badge tone={advanceTone(advance.status)}>{advance.status || "Status not recorded"}</Badge>
              </p>
              <p>
                <span className={`font-semibold text-slate-800 ${MONEY}`}>{formatCurrency(advance.amount)}</span>
                {!advance.group ? "" : members === undefined ? " (your share)" : " for the group"}
              </p>
              {advance.share !== undefined && members !== undefined && <p>Share: <span className={MONEY}>{formatCurrency(advance.share)}</span></p>}
              {advance.group && (
                <p>
                  {advance.group.isHolder ? "Holder of the group's advance" : `Covered by ${advance.group.holder || "a colleague"}'s group advance`}
                  {members !== undefined ? ` (${members} ${members === 1 ? "person" : "people"})` : ""}
                </p>
              )}
              {advance.dvNo && (
                <p>DV No. <span className={MONEY}>{advance.dvNo}</span>{advance.dvDate ? ` · dated ${formatDate(advance.dvDate)}` : ""}</p>
              )}
              {(advance.refundOrNo || advance.refundedAt) && (
                <p>
                  Refunded
                  {advance.refundOrNo && <>: OR <span className={MONEY}>{advance.refundOrNo}</span></>}
                  {advance.refundedAt ? `${advance.refundOrNo ? " · " : " on "}${formatDate(advance.refundedAt)}` : ""}
                </p>
              )}
            </>
          ) : (
            <Muted>None</Muted>
          )}
        </Part>

        <Part icon={<ReceiptText size={12} />} title="Liquidation report">
          {report ? (
            <>
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono font-semibold text-slate-800">{report.submissionNo || "No number"}</span>
                <Badge tone={reportTone(report.status)}>{report.status || "Status not recorded"}</Badge>
              </p>
              {(report.claimType || report.group) && (
                <p className="flex flex-wrap gap-1">
                  <ClaimTypeBadge claimType={report.claimType as ClaimType | undefined} small />
                  {report.group && <Badge tone="none">Group report</Badge>}
                </p>
              )}
              {report.totalSpent !== undefined && (
                <p>Spent: <span className={`font-semibold text-slate-800 ${MONEY}`}>{formatCurrency(report.totalSpent)}</span></p>
              )}
              {report.refund && (
                <p>
                  Handed back: <span className={MONEY}>{formatCurrency(report.refund.amount)}</span>
                  {report.refund.orNo ? <> · OR <span className={MONEY}>{report.refund.orNo}</span></> : null}
                </p>
              )}
              {reportFiguresWithheld && <Muted>Filed for the group by {holder || "its holder"}.</Muted>}
            </>
          ) : (
            <Muted>Not filed</Muted>
          )}
        </Part>
      </div>
    </li>
  );
}

export function RecordHistoryCard({ row, extra }: { row: TrainingHistoryRecord; extra?: ReactNode }) {
  return (
    <li data-history-row data-kind="record" data-training-record={row.id} className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <CardHead
        kind="HR record"
        fiscalYear={row.fiscalYear}
        title={row.title || "Untitled training"}
        badges={<Badge tone={recordTone(row.status)}>{row.status || "Pending verification"}</Badge>}
      />
      <Facts
        items={[
          ["Date", row.dateConducted ? formatDate(row.dateConducted) : "Not recorded"],
          ["Organizer", row.organizer || "Not recorded"],
          ["Hours", hoursText(row.hours)],
          // HR records keep a file name only, no file.
          ["Certificate file", row.certificateFilename ? <span className="break-all">{row.certificateFilename}</span> : "None"]
        ]}
      />
      {row.remarks && <p className="min-w-0 break-words text-[11px] text-rose-700">Remarks: {row.remarks}</p>}
      {!recordCounts(row) && (
        <p data-history-uncounted className="text-[11px] text-slate-500">
          Not counted toward the year&rsquo;s training, Plan D or the PDS: HR returned it.
        </p>
      )}
      {extra}
    </li>
  );
}
