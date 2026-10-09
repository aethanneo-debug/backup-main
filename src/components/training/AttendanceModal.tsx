import { useState } from "react";
import { CalendarCheck, CheckCircle2, Loader2, UserX } from "lucide-react";
import { AttendanceStatus, Employee, TrainingParticipant, TrainingProgram } from "../../types";
import { apiCall, formatDate } from "../../utils";
import ModalDialog from "../ui/ModalDialog";

/**
 * HR's attendance roster for one seminar (Training Plan & Budget). Only attendees get a
 * liquidation form, so HR records each participant as Attended or Did not attend once
 * the seminar has started. Someone who already filed a report can't be marked as not
 * attending. The server enforces every one of these rules; this only shows them first.
 */

interface AttendanceModalProps {
  program: TrainingProgram;
  /** This seminar's enrolments. */
  participants: TrainingParticipant[];
  employees: Employee[];
  /** Only HR records attendance; everyone else sees the roster read-only. */
  canRecord: boolean;
  onClose: () => void;
  /** Called after a change so the page can reload its data. */
  onChanged: () => void;
}

const manilaToday = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

const BADGE: Record<AttendanceStatus | "none", string> = {
  Attended: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Did not attend": "border-rose-200 bg-rose-50 text-rose-700",
  none: "border-slate-200 bg-slate-50 text-slate-600"
};
const ACTION =
  "inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function AttendanceModal({ program, participants, employees, canRecord, onClose, onChanged }: AttendanceModalProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const start = String(program.startDate || "").slice(0, 10);
  const started = !!start && start <= manilaToday();
  const roster = (participants ?? []).filter(p => p.status !== "Cancelled" && p.status !== "Archived");
  const nameOf = (p: TrainingParticipant) =>
    (employees ?? []).find(e => e.id === p.employeeId || e.employeeId === p.employeeId)?.fullName || p.employeeId;
  // Filing a report moves the enrolment to Liquidation Pending; it stays attended from then on.
  const hasFiled = (p: TrainingParticipant) => p.status === "Liquidation Pending" || p.status === "Liquidated";

  async function record(p: TrainingParticipant, attendance: AttendanceStatus) {
    setSavingId(p.id);
    setError("");
    setNotice("");
    try {
      const res = await apiCall(`/api/training/participants/${encodeURIComponent(p.id)}/attendance`, {
        method: "PUT",
        body: JSON.stringify({ attendance })
      });
      if (res?.status !== "success") throw new Error(res?.message || "Attendance could not be saved.");
      // The server says what actually happened, e.g. that someone without a Personnel
      // login can't open the form, so the notice never claims a notification it didn't send.
      setNotice(res.message || (attendance === "Attended"
        ? `${nameOf(p)} is marked as attended.`
        : `${nameOf(p)} is marked as not attending, so no liquidation form will open for them.`));
      onChanged();
    } catch (err: any) {
      // apiCall throws on a refusal with the server's own message (e.g. a report already filed).
      setError(err?.message || "Attendance could not be saved.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <ModalDialog
      title="Attendance"
      subtitle={`${String(program.title || "").trim()} · ${formatDate(program.startDate)}${program.endDate && program.endDate !== program.startDate ? ` to ${formatDate(program.endDate)}` : ""}`}
      icon={<CalendarCheck size={16} aria-hidden="true" />}
      onClose={onClose}
      busy={!!savingId}
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={!!savingId}
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Close
        </button>
      }
    >
      <div className="space-y-3 text-xs text-slate-700">
        <p className="text-[11px] text-slate-500">
          Only participants marked <strong>Attended</strong> get a liquidation form. Marking someone attended opens
          their form and notifies them.
        </p>
        {!started && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            Attendance can be recorded from {start ? formatDate(start) : "the seminar's start date"}, when the seminar starts.
          </p>
        )}
        {!canRecord && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">Only HR records attendance.</p>
        )}
        <div role="status" aria-live="polite">
          {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">{notice}</p>}
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{error}</p>}

        {roster.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-slate-500">
            No one is enrolled in this seminar yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {roster.map(p => {
              const state: AttendanceStatus | "none" = p.attendance ?? "none";
              const saving = savingId === p.id;
              const locked = !canRecord || !started || !!savingId;
              return (
                <li key={p.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{nameOf(p)}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${BADGE[state]}`}>
                        {state === "none" ? "Not recorded" : state}
                      </span>
                      {p.attendanceBy && p.attendanceAt && (
                        <span>by {p.attendanceBy}, {formatDate(p.attendanceAt)}</span>
                      )}
                      {hasFiled(p) && <span>· liquidation report filed</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => record(p, "Attended")}
                      disabled={locked || p.attendance === "Attended"}
                      className={`${ACTION} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-500`}
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
                      Attended<span className="sr-only">: {nameOf(p)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => record(p, "Did not attend")}
                      disabled={locked || p.attendance === "Did not attend" || hasFiled(p)}
                      title={hasFiled(p) ? "They already filed a liquidation report" : undefined}
                      className={`${ACTION} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-500`}
                    >
                      <UserX size={12} aria-hidden="true" />
                      Did not attend<span className="sr-only">: {nameOf(p)}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModalDialog>
  );
}
