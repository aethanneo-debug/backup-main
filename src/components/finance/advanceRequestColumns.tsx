import { CashAdvance } from "../../types";
import { firstTimestamp, formatCurrency, formatDate } from "../../utils";
import { LATE_RELEASE_DAYS } from "../../reimbursement";
import type { SortValue } from "../../tableView";
import { TableChips, type TableColumn } from "../ui/DataTable";

// The table of Cash Advance Requests (AdvanceRequestsList.tsx), and what a request's window says about it.

/** Everyone a group's request covers, the one who asked first. */
export const groupOf = (r: CashAdvance) => r.covers ?? [];

/** A request HR's attendance closed before its release (12ai), listed while its release can still be recorded. */
export const isClosedRequest = (r: CashAdvance) => r.status !== "Requested" && !!r.lateRelease;

/** The list's two kinds: the requests waiting, and those HR's attendance closed. */
export function RequestChips({ chip, onChip, waiting, closed }: {
  chip: "waiting" | "closed";
  onChip: (chip: "waiting" | "closed") => void;
  waiting: number;
  closed: number;
}) {
  return (
    <TableChips<"waiting" | "closed">
      chips={[{ id: "waiting", label: "Waiting", count: waiting }, { id: "closed", label: "Closed by HR's attendance", count: closed }]}
      value={chip}
      onChange={onChip}
      label="Which requests"
    />
  );
}

/** Above the closed requests: why they are there, and when to record one's release. */
export function ClosedRequestsIntro() {
  return (
    <p className="mx-3 mb-2 max-w-3xl text-[11px] text-slate-600">
      HR recorded the attendance before these requests were released, so each seminar is claimed back as a
      reimbursement. If the cash for one was handed out before then, record its release with that voucher: the seminar is
      then liquidated with it. Otherwise nothing is needed: it stays closed, and leaves this list once a report, another
      cash advance or an expense the office paid settles a seat it covered, or once {LATE_RELEASE_DAYS} days have passed
      since it was closed.
    </p>
  );
}

/** What a closed request's window says: when it was closed, and the one case its release is recorded in. */
export function ClosedRequestNote({ request }: { request: CashAdvance }) {
  const closedOn = request.lateRelease?.closedOn ? formatDate(request.lateRelease.closedOn) : "the day HR recorded the attendance";
  const problem = request.lateRelease?.problem;
  const until = request.lateRelease?.until ? formatDate(request.lateRelease.until) : "";
  return (
    <>
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-700">
        <strong>Closed on {closedOn}{request.decidedBy ? ` by ${request.decidedBy}` : ""}:</strong> HR recorded the attendance
        before it was released, so the seminar is claimed back as a reimbursement. Record its release only if the cash was
        handed out by then: the voucher must be dated on or before {closedOn}, it is recorded at the amount requested, and the
        seminar is then liquidated with it, still due 30 days after the seminar.{until ? ` This can be recorded until ${until}; after that it stays closed.` : ""}
      </p>
      {/* What would still refuse it now (the server's own check), so no voucher is prepared for nothing. */}
      {problem && <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">Its release can&rsquo;t be recorded now: {problem}</p>}
    </>
  );
}

export const REQUEST_SORTS: Record<string, (r: CashAdvance) => SortValue> = {
  asked: r => firstTimestamp(r.requestedAt) || null,
  employee: r => r.employeeName,
  seminar: r => r.activityTitle,
  amount: r => Number(r.amount),
  vehicle: r => r.vehicle?.vrsNo || null
};

export const requestSearchText = (r: CashAdvance) =>
  [r.employeeName, r.activityTitle, ...groupOf(r).map(c => c.employeeName), r.vehicle?.vrsNo, r.vehicle?.status].join(" ");

/** A request in its window: when it was asked for, the amount, everyone a group's covers, and a vehicle filed with it. */
export function RequestFacts({ request }: { request: CashAdvance }) {
  const group = groupOf(request);
  const isGroup = group.length > 1;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase text-slate-500">Asked on</p>
          <p>{request.requestedAt ? formatDate(String(request.requestedAt)) : "Not recorded"}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] font-bold uppercase text-slate-500">{isGroup ? "Allowances asked for" : "Allowance asked for"}</p>
          <strong className="font-mono text-slate-800">{formatCurrency(Number(request.amount))}</strong>
        </div>
      </div>
      {/* A group advance (HSAC RAB 1): one request, released to the one who asked. */}
      {isGroup && (
        <p className="text-[11px] text-slate-600">
          <span className="font-semibold">One advance for {group.length}:</span>{" "}
          {group.map(c => `${c.employeeName} (${formatCurrency(Number(c.amount))})`).join(", ")}
        </p>
      )}
      {/* A vehicle request filed in the same step: decided by the Division Chief, not here. */}
      {request.vehicle && (
        <p className="text-[11px] text-slate-600">
          <span className="font-semibold">Also asked for a vehicle:</span>{" "}
          <span className="font-mono">{request.vehicle.vrsNo || ""}</span> ({request.vehicle.status}).
          {request.vehicle.status === "Approved" || request.vehicle.status === "Rejected" ? " Decided by the Division Chief." : " The Division Chief decides it."}
        </p>
      )}
    </>
  );
}

export const REQUEST_COLUMNS: TableColumn<CashAdvance>[] = [
  {
    key: "asked",
    header: "Asked On",
    sortable: true,
    cell: r => <span className="whitespace-nowrap font-mono text-[11px] text-slate-600">{r.requestedAt ? formatDate(String(r.requestedAt)) : "—"}</span>
  },
  {
    key: "employee",
    header: "Employee",
    sortable: true,
    className: "min-w-[130px]",
    cell: r => (
      <span className="block">
        <span className="block font-semibold text-slate-800">{r.employeeName}</span>
        {/* A group advance (HSAC RAB 1): one request, released to the one who asked. */}
        {groupOf(r).length > 1 && <span className="block text-[10px] text-slate-500">Group of {groupOf(r).length}</span>}
      </span>
    )
  },
  { key: "seminar", header: "Seminar", sortable: true, className: "min-w-[160px]", cell: r => <span title={r.activityTitle} className="line-clamp-2 text-slate-600">{r.activityTitle}</span> },
  {
    key: "amount",
    header: "Amount",
    sortable: true,
    align: "right",
    cell: r => <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-slate-800">{formatCurrency(Number(r.amount))}</span>
  },
  {
    key: "vehicle",
    header: "Vehicle",
    sortable: true,
    cell: r => r.vehicle
      ? (
        <span className="block">
          <span className="block whitespace-nowrap font-mono text-[11px] text-slate-700">{r.vehicle.vrsNo || "Filed"}</span>
          <span className="block text-[10px] text-slate-500">{r.vehicle.status}</span>
        </span>
      )
      : <span className="text-slate-500">None</span>
  }
];
