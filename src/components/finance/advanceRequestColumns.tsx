import { CashAdvance } from "../../types";
import { firstTimestamp, formatCurrency, formatDate } from "../../utils";
import type { SortValue } from "../../tableView";
import type { TableColumn } from "../ui/DataTable";

// The table of Cash Advance Requests (AdvanceRequestsList.tsx), and what a request's window says about it.

/** Everyone a group's request covers, the one who asked first. */
export const groupOf = (r: CashAdvance) => r.covers ?? [];

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
