import { ReactNode } from "react";
import {
  AlertTriangle, BadgeCheck, CheckCircle2, CircleMinus, Link2, Pencil, RefreshCw, RotateCcw, Signature, UserPlus, UserX
} from "lucide-react";
import { Signatory } from "../../types";
import { ROLE_PRINT_NOTE, displayDate } from "./signatoryHelpers";

/**
 * The signatory list and its states: loading (skeleton rows), load error (Retry), nothing
 * entered yet, nothing matching the filters, and the table itself. Rows have no Delete:
 * a printed report may carry the name, so an entry is only ever made inactive.
 */

interface SignatoryTableProps {
  /** Rows after filtering. */
  rows: Signatory[];
  /** Entries before filtering; 0 means nothing has been entered yet. */
  totalCount: number;
  /** First load still running (nothing to show yet). */
  loading: boolean;
  /** First load failed (nothing to show). */
  error: string;
  /** Plain words for the current filters, e.g. "active Accountants". */
  filterDescription: string;
  onRetry: () => void;
  onAdd: () => void;
  onAppoint: () => void;
  onShowAll: () => void;
  onEdit: (s: Signatory) => void;
  onDeactivate: (s: Signatory) => void;
  onReactivate: (s: Signatory) => void;
}

const COLUMNS = ["Name", "Position", "Role", "Status", "Effective from", "Effective to"];
const TH = "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-600";
const TD = "px-4 py-3 align-top";
const BUTTON =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1";
const PRIMARY = `${BUTTON} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`;
const SECONDARY = `${BUTTON} border-blue-200 bg-white text-blue-700 hover:bg-blue-50`;

const STATUS: Record<Signatory["status"], { cls: string; icon: ReactNode }> = {
  Active: { cls: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: <CheckCircle2 size={11} aria-hidden="true" /> },
  Inactive: { cls: "border-slate-200 bg-slate-50 text-slate-700", icon: <CircleMinus size={11} aria-hidden="true" /> }
};

function TableFrame({ busy, children }: { busy?: boolean; children: ReactNode }) {
  return (
    <div className="custom-scrollbar max-h-[65vh] overflow-auto" aria-busy={busy || undefined}>
      <table className="w-full min-w-[880px] border-collapse text-left text-xs">
        <caption className="sr-only">Signatories whose names print on official forms</caption>
        <thead>
          <tr>
            {COLUMNS.map(c => <th key={c} scope="col" className={TH}>{c}</th>)}
            <th scope="col" className={`${TH} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <tr key={i} className="animate-pulse">
          {[40, 32, 36, 16, 24, 20].map((w, j) => (
            <td key={j} className={TD}><div className="h-3 rounded bg-slate-100" style={{ width: `${w * 4}px`, maxWidth: "100%" }} /></td>
          ))}
          <td className={TD}><div className="ml-auto h-6 w-40 rounded-lg bg-slate-100" /></td>
        </tr>
      ))}
    </>
  );
}

function Row({ s, onEdit, onDeactivate, onReactivate }: {
  s: Signatory; onEdit: () => void; onDeactivate: () => void; onReactivate: () => void;
}) {
  const active = s.status === "Active";
  const status = STATUS[s.status] ?? STATUS.Inactive;
  return (
    <tr className="transition-colors hover:bg-slate-50/70">
      <td className={TD}>
        <span className={`font-semibold ${active ? "text-slate-800" : "text-slate-600"}`}>{s.fullName}</span>
        {s.employeeId && (
          <span className="ml-1.5 inline-flex align-middle text-slate-500" title="Linked to a staff record">
            <Link2 size={12} aria-hidden="true" />
            <span className="sr-only">(linked to a staff record)</span>
          </span>
        )}
      </td>
      <td className={`${TD} text-slate-600`}>{s.position}</td>
      <td className={TD}>
        <span className="font-medium text-slate-700">{s.role}</span>
        {ROLE_PRINT_NOTE[s.role] && (
          <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{ROLE_PRINT_NOTE[s.role]}</span>
        )}
      </td>
      <td className={TD}>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.cls}`}>
          {status.icon}
          {s.status}
        </span>
      </td>
      <td className={`${TD} whitespace-nowrap tabular-nums text-slate-700`}>{displayDate(s.effectiveFrom)}</td>
      <td className={`${TD} whitespace-nowrap tabular-nums text-slate-700`}>
        {s.effectiveTo ? displayDate(s.effectiveTo) : (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">None</span>
          </>
        )}
      </td>
      <td className={TD}>
        <div className="flex justify-end gap-2 whitespace-nowrap">
          <button type="button" onClick={onEdit} className={`${BUTTON} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            <Pencil size={12} aria-hidden="true" />
            Edit<span className="sr-only"> {s.fullName}</span>
          </button>
          {active ? (
            <button type="button" onClick={onDeactivate} className={`${BUTTON} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}>
              <UserX size={12} aria-hidden="true" />
              Resigned / Replaced<span className="sr-only">: {s.fullName}</span>
            </button>
          ) : (
            <button type="button" onClick={onReactivate} className={`${BUTTON} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>
              <RotateCcw size={12} aria-hidden="true" />
              Reactivate<span className="sr-only"> {s.fullName}</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function SignatoryTable(props: SignatoryTableProps) {
  const { rows, totalCount, loading, error, filterDescription } = props;

  if (loading) {
    return (
      <TableFrame busy>
        <SkeletonRows />
      </TableFrame>
    );
  }

  if (error) {
    return (
      <div role="alert" className="m-4 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span><strong>The signatory list could not be loaded.</strong> {error}</span>
        </p>
        <button type="button" onClick={props.onRetry} className={`${BUTTON} shrink-0 self-start border-rose-300 bg-white text-rose-700 hover:bg-rose-100 sm:self-auto`}>
          <RefreshCw size={12} aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Signature size={22} aria-hidden="true" />
        </span>
        <p className="mx-auto max-w-md text-sm text-slate-600">
          <strong className="text-slate-800">No signatories yet</strong> — add the Accountant and the Authorized
          Representatives who sign liquidation reports.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={props.onAdd} className={PRIMARY}>
            <UserPlus size={13} aria-hidden="true" />
            Add signatory
          </button>
          <button type="button" onClick={props.onAppoint} className={SECONDARY}>
            <BadgeCheck size={13} aria-hidden="true" />
            Appoint Accountant
          </button>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm font-semibold text-slate-700">No signatories match these filters.</p>
        <p className="mt-1 text-xs text-slate-500">There are no {filterDescription} on the list.</p>
        <button type="button" onClick={props.onShowAll} className={`${SECONDARY} mt-4`}>
          Show all signatories
        </button>
      </div>
    );
  }

  return (
    <TableFrame>
      {rows.map(s => (
        <Row
          key={s.id}
          s={s}
          onEdit={() => props.onEdit(s)}
          onDeactivate={() => props.onDeactivate(s)}
          onReactivate={() => props.onReactivate(s)}
        />
      ))}
    </TableFrame>
  );
}
