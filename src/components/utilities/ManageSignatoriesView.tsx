import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, BadgeCheck, CheckCircle2, RefreshCw, Signature, UserPlus, X } from "lucide-react";
import { Employee, Signatory, SignatoryRole, SIGNATORY_ROLES, User, UserRole } from "../../types";
import { apiCall } from "../../utils";
import SectionCard from "../ui/SectionCard";
import SignatorySummary from "./SignatorySummary";
import SignatoryTable from "./SignatoryTable";
import SignatoryFormModal, { SignatoryFormMode } from "./SignatoryFormModal";
import SignatoryStatusDialog, { SignatoryStatusAction } from "./SignatoryStatusDialog";
import { REPRESENTATIVE } from "./signatoryHelpers";

/**
 * Utilities → Manage Signatories (Administrator only).
 *
 * Everyone whose name prints on an official form is entered here, so replacing someone
 * who resigned is data entry rather than a code change. Entries are never deleted, only
 * made inactive, because a report already printed may carry the name.
 */

interface ManageSignatoriesViewProps {
  user: User;
  employees: Employee[];
}

type RoleFilter = "All" | SignatoryRole;
type StatusFilter = "All" | Signatory["status"];
type FormState = { mode: SignatoryFormMode; signatory?: Signatory; presetRole?: SignatoryRole };
type StatusState = { action: SignatoryStatusAction; signatory: Signatory };

const FILTER_SELECT =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30";
const HEADER_BUTTON =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function ManageSignatoriesView({ user, employees }: ManageSignatoriesViewProps) {
  const isAdmin = user?.role === UserRole.SUPER_ADMIN;

  // null until the first load succeeds; a failed reload keeps the last good list on screen.
  const [signatories, setSignatories] = useState<Signatory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Active");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [statusChange, setStatusChange] = useState<StatusState | null>(null);
  const requestSeq = useRef(0);
  const successRef = useRef<HTMLDivElement>(null);
  const roleFilterId = useId();
  const statusFilterId = useId();

  // After a save the button that opened the dialog may be gone (the row left the filtered
  // list), so focus would fall to the page. Move it to the confirmation instead. This runs
  // after the dialog's own focus-return, so it wins.
  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);

  const load = useCallback(async () => {
    // Only the latest request may update the page, so a slow earlier one can't win.
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiCall("/api/signatories");
      if (seq !== requestSeq.current) return;
      if (res?.status !== "success") throw new Error(res?.message || "Please try again.");
      setSignatories(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      if (seq === requestSeq.current) setLoadError(err?.message || "Please try again.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const all = useMemo(() => signatories ?? [], [signatories]);
  const rows = useMemo(
    () => all.filter(s =>
      (roleFilter === "All" || s.role === roleFilter) && (statusFilter === "All" || s.status === statusFilter)),
    [all, roleFilter, statusFilter]
  );

  if (!isAdmin) {
    return <div id="access-denied" className="p-6 text-xs text-rose-500 font-mono font-bold">Unauthenticated credentials path error [RA 10173 Security Block].</div>;
  }

  const loaded = signatories !== null;
  const filterDescription =
    `${statusFilter === "All" ? "" : `${statusFilter.toLowerCase()} `}${roleFilter === "All" ? "signatories" : `${roleFilter}s`}`;
  const noun = all.length === 1 ? "signatory" : "signatories";
  const countText = !loaded
    ? ""
    : rows.length === all.length
      ? `${all.length} ${noun}`
      : `Showing ${rows.length} of ${all.length} ${noun}`;

  function openForm(next: FormState) {
    setSuccess("");
    setStatusChange(null);
    setForm(next);
  }
  function openStatusChange(next: StatusState) {
    setSuccess("");
    setForm(null);
    setStatusChange(next);
  }
  function handleSaved(message: string) {
    setForm(null);
    setStatusChange(null);
    setSuccess(message);
    load();
  }

  return (
    <div className="min-w-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      {/* HEADER + messages (kept in one block so an empty message area adds no gap) */}
      <div>
        <header className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-800">
              <Signature className="shrink-0 text-blue-600" size={24} aria-hidden="true" />
              Manage Signatories
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
              Names here print on official forms, such as Boxes B and C of the Liquidation Report. When a signatory
              resigns or is replaced, update this list; no change to the system is needed. Entries are never deleted,
              so reports that already carry a name keep it.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openForm({ mode: "appoint" })}
              disabled={!loaded}
              className={`${HEADER_BUTTON} border border-blue-200 bg-white text-blue-700 hover:bg-blue-50`}
            >
              <BadgeCheck size={15} aria-hidden="true" />
              Appoint new Accountant
            </button>
            <button
              type="button"
              onClick={() => openForm({ mode: "add" })}
              disabled={!loaded}
              className={`${HEADER_BUTTON} bg-blue-600 text-white hover:bg-blue-700`}
            >
              <UserPlus size={15} aria-hidden="true" />
              Add signatory
            </button>
          </div>
        </header>

        <div role="status" aria-live="polite" aria-atomic="true">
          {success && (
            <div
              ref={successRef}
              tabIndex={-1}
              className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <p className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{success}</span>
              </p>
              <button
                type="button"
                onClick={() => setSuccess("")}
                aria-label="Dismiss message"
                className="shrink-0 cursor-pointer rounded p-0.5 text-emerald-700 hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {loaded && loadError && (
          <div role="alert" className="mt-4 flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span><strong>The list could not be refreshed;</strong> it may be out of date. {loadError}</span>
            </p>
            <button
              type="button"
              onClick={load}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 font-semibold text-rose-700 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 sm:self-auto"
            >
              <RefreshCw size={12} aria-hidden="true" />
              Retry
            </button>
          </div>
        )}
      </div>

      {(loaded || loading) && (
        <SignatorySummary
          signatories={signatories}
          onAppoint={() => openForm({ mode: "appoint" })}
          onAddRepresentative={() => openForm({ mode: "add", presetRole: REPRESENTATIVE })}
        />
      )}

      <SectionCard
        icon={<Signature size={12} className="text-blue-600" aria-hidden="true" />}
        title="Signatory list"
        bodyClassName=""
      >
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <label htmlFor={roleFilterId} className="mb-1 block text-[11px] font-semibold text-slate-600">Role</label>
            <select id={roleFilterId} value={roleFilter} onChange={e => setRoleFilter(e.target.value as RoleFilter)} className={FILTER_SELECT}>
              <option value="All">All roles</option>
              {SIGNATORY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={statusFilterId} className="mb-1 block text-[11px] font-semibold text-slate-600">Status</label>
            <select id={statusFilterId} value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className={FILTER_SELECT}>
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <p className="text-xs text-slate-500" aria-live="polite">{countText}</p>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              {loading ? "Loading…" : "Reload"}
            </button>
          </div>
        </div>

        <SignatoryTable
          rows={rows}
          totalCount={all.length}
          loading={!loaded && loading}
          error={loaded ? "" : loadError}
          filterDescription={filterDescription}
          onRetry={load}
          onAdd={() => openForm({ mode: "add" })}
          onAppoint={() => openForm({ mode: "appoint" })}
          onShowAll={() => {
            setRoleFilter("All");
            setStatusFilter("All");
          }}
          onEdit={s => openForm({ mode: "edit", signatory: s })}
          onDeactivate={s => openStatusChange({ action: "deactivate", signatory: s })}
          onReactivate={s => openStatusChange({ action: "reactivate", signatory: s })}
        />
      </SectionCard>

      {form && (
        <SignatoryFormModal
          mode={form.mode}
          signatory={form.signatory}
          presetRole={form.presetRole}
          employees={employees ?? []}
          signatories={all}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}

      {statusChange && (
        <SignatoryStatusDialog
          action={statusChange.action}
          signatory={statusChange.signatory}
          signatories={all}
          onClose={() => setStatusChange(null)}
          onDone={handleSaved}
          onAppointInstead={() => openForm({ mode: "appoint" })}
        />
      )}
    </div>
  );
}
