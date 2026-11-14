import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, BadgeCheck, Banknote, Loader2, RefreshCw } from "lucide-react";
import { apiCall, formatCurrency, formatDate } from "../../utils";
import { sumPesos } from "../../liquidationMoney";
import type { SortValue } from "../../tableView";
import SectionCard, { SectionCount } from "../ui/SectionCard";
import { DataTable, TableChips, TablePager, TableSearch, type TableColumn } from "../ui/DataTable";
import { useTableView } from "../ui/useTableView";
import AdvanceRefundForm from "./AdvanceRefundForm";
import { ADVANCE_STAGES, advanceRowDate, advanceStage, filedWithoutAdvance, noAdvanceNow, refundDue, type AdvanceStage, type FundableRow } from "./advanceDeskRows";
import { olderDv } from "../../dvNumber";

interface Props {
  /** Bumped by the parent so a liquidation elsewhere refreshes the funding state here. */
  refreshKey?: number;
  /** Lets the parent reload its own liquidation lists after a refund is recorded here (advances are
   * released under Cash Advance Requests now). */
  onReleased?: () => void;
}

type Chip = "all" | AdvanceStage;

const rowId = (row: FundableRow) => row.activityId;

// What a row's amount is: the advance's, or what HR set aside while nothing has gone out.
const notFunded = (row: FundableRow) => advanceStage(row) === "unfunded";
const amountOf = (row: FundableRow) => (notFunded(row) ? Number(row.allocated || 0) : Number(row.advanceAmount || 0));

const SORTS: Record<string, (row: FundableRow) => SortValue> = {
  employee: row => row.employeeName,
  seminar: row => row.activityTitle,
  advance: row => row.advanceNo,
  amount: amountOf,
  stands: row => ADVANCE_STAGES.findIndex(s => s.id === advanceStage(row)),
  date: row => advanceRowDate(row) || null
};

/** "One advance for a group of 3: Ana, Ben, Carla", on the holder's row. */
function GroupLine({ row }: { row: FundableRow }) {
  if (!row.groupNames || row.groupNames.length < 2) return null;
  return (
    <span className="block text-[10px] text-slate-500">
      One advance for a group of {row.groupNames.length}: {row.groupNames.join(", ")}
    </span>
  );
}

/** "CA-2026-10-001", then "DV No. 2026-10-0101 · dated Oct 20, 2026": an advance and the voucher it went out
 * on, which Finance releases it by, so the voucher stands out. */
function AdvanceRef({ row }: { row: FundableRow }) {
  if (!row.advanceNo) return <span className="text-slate-400">None yet</span>;
  return (
    <span className="block font-mono text-[11px] text-slate-600">
      <span className="block whitespace-nowrap">{row.advanceNo}</span>
      {row.advanceDvNo && (
        <span className="mt-0.5 inline-block rounded border border-blue-200 bg-blue-50 px-1.5 py-px text-[10px] font-semibold text-blue-700">
          DV No. {row.advanceDvNo}{row.advanceDvDate ? ` · dated ${formatDate(row.advanceDvDate)}` : ""}
        </span>
      )}
      {/* Typed as free text before the voucher format (2026-10-29), and kept as typed. */}
      {olderDv(row.advanceDvNo) && (
        <span data-dv-older className="mt-0.5 block font-sans text-[10px] text-slate-500">Entered before the voucher number format</span>
      )}
    </span>
  );
}

const Done = ({ children }: { children: ReactNode }) => (
  <span className="flex items-start gap-1 text-slate-600">
    <BadgeCheck size={13} className="mt-px shrink-0 text-emerald-600" aria-hidden="true" />
    <span>{children}</span>
  </span>
);

/** Where the row's advance stands, in the words the desk has always used. */
function Standing({ row }: { row: FundableRow }) {
  const stage = advanceStage(row);
  if (stage === "unfunded") {
    // Released only on the employee's request (their own, a group's, or one filed with a vehicle),
    // under Cash Advance Requests above; the server refuses any other.
    if (row.pendingRequestId) {
      return (
        <span className="block font-semibold text-amber-800">
          {row.groupNames && row.groupNames.length > 1 ? `Requested for a group of ${row.groupNames.length}` : "Requested"}
          {row.requestedAt ? ` on ${formatDate(row.requestedAt)}` : ""}: see Cash Advance Requests
        </span>
      );
    }
    // No request can come yet (no Personnel login, no allowance, another advance out): said, rather than only "waiting".
    if (row.requestBlocked) {
      return <span className="block text-slate-600"><span className="font-semibold">No request can come yet.</span> {row.requestBlocked}</span>;
    }
    return <span className="block font-semibold text-slate-600">Waiting for the employee&rsquo;s request</span>;
  }
  if (stage === "settled") return <Done>liquidated</Done>;
  if (stage === "refunded" || stage === "returnedEarly") {
    return (
      <>
        <Done>refunded, OR {row.refundOrNo}{row.refundOrDate ? ` (${formatDate(row.refundOrDate)})` : ""}</Done>
        {row.replaced && <span className="block text-slate-500">a representative went in their place</span>}
      </>
    );
  }
  const due = refundDue(row);
  return (
    <>
      {/* No liquidation form opens for a non-attendee, so the advance is collected back in full rather than
          liquidated. Their share of the seminar stays held in the training budget until the refund is
          recorded. A group's comes back in full only when nobody it covers attended. */}
      {due ? (
        <span className="block rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700">
          {row.groupNames ? "Nobody in the group attended: collect the full refund" : "Did not attend: collect the full refund"}
        </span>
      ) : (
        <span className="block text-slate-600">{row.liquidationFiled ? "liquidation filed" : "not yet liquidated"}</span>
      )}
      {/* A holder who didn't attend still files the group's report when others did (the user's decision,
          2026-10-26): the cash was released to them. */}
      {row.groupNames && row.didNotAttend && !row.groupAllAbsent && (
        <span className="block italic text-slate-500">{row.employeeName} did not attend, but holds the cash and files the group&rsquo;s report.</span>
      )}
      {/* Their own advance, the seminar still to come: it can come back in full before it, e.g. when a
          representative will go in their place (HR's swap waits for the refund). */}
      {!due && row.refundBeforeSeminar && row.advanceId && (
        <span className="block text-slate-500">Handed back before the seminar (e.g. a representative goes in their place)?</span>
      )}
    </>
  );
}

const COLUMNS: TableColumn<FundableRow>[] = [
  {
    key: "employee",
    header: "Employee",
    sortable: true,
    className: "min-w-[140px]",
    cell: row => (
      <span className="block">
        <span className="block font-semibold text-slate-800">{row.employeeName}</span>
        <GroupLine row={row} />
      </span>
    )
  },
  { key: "seminar", header: "Seminar", sortable: true, className: "min-w-[140px]", cell: row => <span title={row.activityTitle} className="line-clamp-2 text-slate-600">{row.activityTitle}</span> },
  { key: "advance", header: "Advance & DV", sortable: true, className: "min-w-[200px]", cell: row => <AdvanceRef row={row} /> },
  {
    key: "amount",
    header: "Amount",
    sortable: true,
    align: "right",
    cell: row => (
      <span className="block">
        <span className="block whitespace-nowrap font-mono tabular-nums text-slate-800">{formatCurrency(amountOf(row))}</span>
        {notFunded(row) && <span className="block text-[10px] text-slate-500">HR allocated</span>}
      </span>
    )
  },
  { key: "stands", header: "Where It Stands", sortable: true, className: "min-w-[190px] space-y-1 text-[11px]", cell: row => <Standing row={row} /> },
  {
    key: "date",
    header: "Date",
    sortable: true,
    cell: row => {
      const at = advanceRowDate(row);
      return <span className="whitespace-nowrap font-mono text-[11px] text-slate-600">{at ? formatDate(new Date(at).toISOString()) : "—"}</span>;
    }
  }
];

/**
 * Each assignment's cash advance — the money-out half of the liquidation cycle — from the
 * employee's request to its settlement, and its refunds, in one table (the instructor's review, R8).
 *
 * The COA form's "AMOUNT OF CASH ADVANCE PER DV NO. __ DTD __" refers to the voucher an
 * advance was released on, under Cash Advance Requests (only on the employee's request).
 * Recording it is what makes the claimant's later report checkable: with an advance on file
 * the server overrides whatever they type, and with none the report is a reimbursement claim.
 */
export default function CashAdvanceDesk({ refreshKey = 0, onReleased }: Props) {
  const [rows, setRows] = useState<FundableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [chip, setChip] = useState<Chip>("all");

  // Recording a refund: which advance, and what the server said it did.
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const noticeRef = useRef<HTMLParagraphElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiCall("/api/cash-advances/fundable");
      if (res.status === "success") setRows(res.data ?? []);
      else setLoadError(res.message || "Could not load the funding list.");
    } catch (err: any) {
      setLoadError(err.message || "Could not load the funding list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  // The refund's window had the focus, and the button that opened it has gone with its row's stage.
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  // Only assignments with a place on the desk: advanceStage says which. Once a report is filed the server
  // refuses an advance (it could never be settled), so those are counted apart below.
  const listed = useMemo(() => rows.filter(row => advanceStage(row) !== null), [rows]);
  const countOf = (stage: AdvanceStage) => listed.filter(row => advanceStage(row) === stage).length;
  const unfunded = countOf("unfunded");
  const reimbursed = useMemo(() => rows.filter(filedWithoutAdvance), [rows]);
  // Past asking, with nothing released or waiting: claimed back as reimbursements (12ai), so counted apart too.
  const claimedBack = useMemo(() => rows.filter(noAdvanceNow), [rows]);
  const outstanding = useMemo(() => sumPesos(rows.filter(r => r.funded).map(r => r.advanceAmount)), [rows]);

  const table = useTableView<FundableRow>({
    rows: listed,
    rowId,
    searchText: row => [row.employeeName, row.activityTitle, row.advanceNo, row.advanceDvNo, row.refundOrNo, ...(row.groupNames ?? [])].join(" "),
    filter: row => chip === "all" || advanceStage(row) === chip,
    filterKey: chip,
    sorts: SORTS,
    // Newest first (LIFO, the instructor's rule for the office's lists), each row by its own event.
    defaultSort: { key: "date", dir: "desc" },
    clearFilter: () => setChip("all")
  });

  const refundable = (row: FundableRow) => advanceStage(row) === "released" && !!row.advanceId && (refundDue(row) || !!row.refundBeforeSeminar);
  const refunding = rows.find(row => row.advanceId === refundingId && refundable(row)) ?? null;

  return (
    <SectionCard
      icon={<Banknote size={12} className="text-blue-600" aria-hidden="true" />}
      title="Cash Advance Desk"
      action={<SectionCount>{unfunded} unfunded</SectionCount>}
      caption="Money Out"
      bodyClassName=""
    >
      <div className="space-y-3 p-4 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-[11px] text-slate-500">
            Each assignment&rsquo;s cash advance, from the employee&rsquo;s request to its settlement. An advance is
            released only on the employee&rsquo;s request (their own, for a group, or with a vehicle), under Cash Advance
            Requests, with its disbursement voucher. The claimant&rsquo;s report takes its advance figure and DV from that
            record, not from what they type.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {countOf("released") > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-right">
                <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-blue-700">Unliquidated</span>
                <strong className="font-mono text-sm text-blue-800">{formatCurrency(outstanding)}</strong>
              </div>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              aria-label="Reload the funding list"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>

        {loadError && (
          <p className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
            <span className="flex gap-2"><AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />{loadError}</span>
            <button onClick={load} className="shrink-0 cursor-pointer font-semibold underline">Retry</button>
          </p>
        )}

        {/* What a recorded refund did, in the server's words. */}
        <div role="status" aria-live="polite">
          {notice && (
            <p ref={noticeRef} tabIndex={-1} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 focus:outline-none">
              <BadgeCheck size={13} className="shrink-0" aria-hidden="true" />
              {notice}
            </p>
          )}
        </div>

        {rows.length > 0 && reimbursed.length > 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            {reimbursed.length} assignment{reimbursed.length === 1 ? " was" : "s were"} liquidated without
            an advance on record (reimbursements), so {reimbursed.length === 1 ? "it needs" : "they need"} nothing
            here: no advance can be released once a report is filed. If an employee did receive one, return the report so
            they can correct it to a Liquidation.
          </p>
        )}
        {rows.length > 0 && claimedBack.length > 0 && (
          <p data-desk-note="claimed-back" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            {claimedBack.length} assignment{claimedBack.length === 1 ? " is" : "s are"} past asking for a cash advance (the seminar
            has started, a certificate of attendance is on file, or HR recorded the attendance) with none released: nothing to
            fund here. A request not released or declined by the seminar&rsquo;s first day expires. Once the seminar ends and HR
            records an attendee&rsquo;s attendance, their seminar is claimed back as a reimbursement.
          </p>
        )}
        {rows.length > 0 && unfunded === 0 && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
            <BadgeCheck size={13} className="shrink-0" aria-hidden="true" />
            Every current assignment has been funded or settled.
          </p>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading assignments…
        </div>
      ) : rows.length === 0 ? (
        !loadError && (
          <div className="m-4 mt-0 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <Banknote size={28} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-600">No assignments to fund</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Employees appear here once HR assigns them to a seminar or activity.
            </p>
          </div>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <TableChips<Chip>
              chips={[
                { id: "all", label: "All", count: listed.length },
                ...ADVANCE_STAGES.map(s => ({ id: s.id, label: s.label, count: countOf(s.id) }))
              ]}
              value={chip}
              onChange={setChip}
              label="Where the advances stand"
            />
            <TableSearch table={table} id="advance-search" label="Search the cash advance desk" placeholder="Employee, seminar, advance, DV or OR" />
          </div>
          <DataTable
            table={table}
            columns={COLUMNS}
            caption="Each assignment's cash advance, newest first"
            rowId={rowId}
            actionsHeader="Action"
            actions={row => (refundable(row) ? (
              <button
                type="button"
                onClick={() => { setNotice(""); setRefundingId(row.advanceId!); }}
                className={`cursor-pointer whitespace-nowrap rounded-lg border bg-white px-2 py-1 text-[11px] font-bold focus:outline-none focus-visible:ring-2 ${
                  refundDue(row) ? "border-rose-300 text-rose-700 hover:bg-rose-50 focus-visible:ring-rose-500" : "border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-blue-500"
                }`}
              >
                Record refund<span className="sr-only">: {row.employeeName}, {row.advanceNo}{refundDue(row) ? "" : ", before the seminar"}</span>
              </button>
            ) : null)}
            minWidth={960}
            searchId="advance-search"
            empty={
              <p className="m-4 mt-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                Nothing to list here: every assignment on record has no advance to follow.
              </p>
            }
            filteredEmpty={
              <div className="m-4 mt-0 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                <p className="text-xs font-semibold text-slate-600">No advances here.</p>
                <button
                  type="button"
                  onClick={() => setChip("all")}
                  className="mt-1 cursor-pointer rounded text-[11px] font-semibold text-blue-700 underline hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Show all advances
                </button>
              </div>
            }
          />
          <TablePager table={table} label="Pages of the cash advance desk" />
        </>
      )}

      {refunding && (
        <AdvanceRefundForm
          key={refunding.advanceId}
          advanceId={refunding.advanceId!}
          advanceNo={refunding.advanceNo}
          employeeName={refunding.employeeName}
          amount={Number(refunding.advanceAmount || 0)}
          beforeSeminar={!refundDue(refunding)}
          groupNames={refunding.groupNames && refunding.groupNames.length > 1 ? refunding.groupNames : undefined}
          onCancel={() => setRefundingId(null)}
          onRecorded={async message => {
            setRefundingId(null);
            setNotice(message);
            await load();
            onReleased?.();
          }}
        />
      )}
    </SectionCard>
  );
}
