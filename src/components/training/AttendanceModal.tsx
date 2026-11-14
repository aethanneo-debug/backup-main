import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Loader2, UserX } from "lucide-react";
import { AttendanceStatus, Employee, TrainingParticipant, TrainingParticipantRow, TrainingProgram, type TdpJustificationInput } from "../../types";
import { apiCall, formatDate } from "../../utils";
import { tdpBadgeText } from "../../tdpRules";
import ModalDialog from "../ui/ModalDialog";
import { useRecordHighlight } from "../ui/useRecordHighlight";
import TdpJustificationForm from "./TdpJustificationForm";
import SendRepresentativePanel from "./SendRepresentativePanel";
import CertificatePanel from "./CertificatePanel";
import { clockText, manilaMoment, seminarHasEnded, seminarLastDay } from "../../attendanceCertificate";

/**
 * HR's attendance roster for one seminar (Training Plan & Budget). Only attendees get a
 * liquidation form, so HR records each participant as Attended, on their certificate of
 * attendance, or Did not attend, which needs no file. Either can be recorded only once the
 * seminar has ended, after its last day's end time (the user's rule of 2026-11-14), and
 * neither touches a cash advance request. Someone who already filed a report can't be marked
 * as not attending. The server enforces every one of these rules; this only shows them first.
 */

interface AttendanceModalProps {
  program: TrainingProgram;
  /** This seminar's enrolments, with where each stands against the TDP; cancelled ones too, so whoever a
   * representative replaced stays listed. */
  participants: TrainingParticipantRow[];
  employees: Employee[];
  /** Only HR records attendance; everyone else sees the roster read-only. */
  canRecord: boolean;
  /** HR and the Administrator record why someone outside the TDP is seated, and send a representative (12z). */
  canJustify?: boolean;
  /** The signed-in officer's staff code: recording their own attendance is allowed but flagged. */
  currentEmployeeId?: string;
  /** A seat a notice is about: scrolled to and outlined. */
  focusSeat?: { id: string; key: number } | null;
  onClose: () => void;
  /** Called after a change so the page can reload its data. */
  onChanged: () => void;
}

const BADGE: Record<AttendanceStatus | "none", string> = {
  Attended: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Did not attend": "border-rose-200 bg-rose-50 text-rose-700",
  none: "border-slate-200 bg-slate-50 text-slate-600"
};
const ACTION =
  "inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function AttendanceModal({ program, participants, employees, canRecord, canJustify = false, currentEmployeeId, focusSeat, onClose, onChanged }: AttendanceModalProps) {
  useRecordHighlight(focusSeat?.id, focusSeat?.key);
  // The page's list may be older than the certificates uploaded since it loaded: they are HR's basis for "Attended".
  useEffect(() => { onChanged(); }, []);
  const [savingId, setSavingId] = useState<string | null>(null);
  // A certificate HR is uploading for someone: the list stays open until it is answered.
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The enrolment whose TDP justification form is open (12z), its save, and its own error (shown by the form).
  const [justifyId, setJustifyId] = useState<string | null>(null);
  const [justifying, setJustifying] = useState(false);
  const [justifyError, setJustifyError] = useState("");
  // The enrolment a representative is being sent for (Part B), by id, and whether its send is in flight.
  const [repFor, setRepFor] = useState<string | null>(null);
  const [sendingRep, setSendingRep] = useState(false);

  // On Manila's clock, as the server reads it (seminarHasEnded): after the last day's end time.
  const ended = seminarHasEnded(program, manilaMoment(Date.now()));
  const lastDay = seminarLastDay(program);
  const endsAt = clockText(program.endTime);
  const roster = (participants ?? []).filter(p => p.status !== "Cancelled" && p.status !== "Archived");
  // Whoever a representative replaced: their enrolment is closed, and kept on record.
  const replaced = (participants ?? []).filter(p => p.status === "Cancelled" && p.replacedBy);
  const staffOf = (p: TrainingParticipant) => (employees ?? []).find(e => e.id === p.employeeId || e.employeeId === p.employeeId);
  const nameOf = (p: TrainingParticipant) => staffOf(p)?.fullName || p.employeeId;
  // The one a representative took the place of, by name.
  const inLieuName = (p: TrainingParticipantRow) => {
    const original = (participants ?? []).find(x => x.id === p.replaces);
    return original ? nameOf(original) : p.tdpException?.inLieuOf?.fullName;
  };
  // Filing a report moves the enrolment to Liquidation Pending; it stays attended from then on.
  const hasFiled = (p: TrainingParticipant) => p.status === "Liquidation Pending" || p.status === "Liquidated";
  // The officer's own enrolment: they may record it, but it is flagged in the audit log (the
  // user's decision, 2026-10-20), so they're told on the row and asked before it is saved.
  const isOwn = (p: TrainingParticipant) => {
    if (!currentEmployeeId) return false;
    const emp = (employees ?? []).find(e => e.id === p.employeeId || e.employeeId === p.employeeId);
    return p.employeeId === currentEmployeeId || emp?.employeeId === currentEmployeeId || emp?.id === currentEmployeeId;
  };

  async function record(p: TrainingParticipantRow, attendance: AttendanceStatus) {
    if (isOwn(p) && !window.confirm(`This is your own attendance. Recording it as "${attendance}" will be marked as self-approved in the audit log. Record it anyway?`)) return;
    setSavingId(p.id);
    setError("");
    setNotice("");
    try {
      const res = await apiCall(`/api/training/participants/${encodeURIComponent(p.id)}/attendance`, {
        method: "PUT",
        // "Attended" names the certificate this list showed: the server refuses it if another has replaced it.
        body: JSON.stringify({ attendance, ...(attendance === "Attended" ? { certificateId: p.certificate?.id } : {}) })
      });
      if (res?.status !== "success") throw new Error(res?.message || "Attendance could not be saved.");
      // The server says what actually happened, e.g. that someone without a Personnel
      // login can't open the form, so the notice never claims a notification it didn't send.
      setNotice(res.message || (attendance === "Attended"
        ? `${nameOf(p)} is marked as attended.`
        : `${nameOf(p)} is marked as not attending, so no liquidation form will open for them.`));
      onChanged();
    } catch (err: any) {
      // apiCall throws on a refusal with the server's own message (e.g. a report already filed). The list is
      // reloaded, since a refusal can mean it is out of date (a certificate replaced meanwhile).
      setError(err?.message || "Attendance could not be saved.");
      onChanged();
    } finally {
      setSavingId(null);
    }
  }

  // Why someone outside the TDP is on the seminar, saved at once (the seminar itself isn't saved).
  async function justify(p: TrainingParticipant, value: TdpJustificationInput) {
    setJustifying(true);
    setJustifyError("");
    setNotice("");
    try {
      const res = await apiCall(`/api/training/participants/${encodeURIComponent(p.id)}/tdp-exception`, {
        method: "PUT",
        body: JSON.stringify(value)
      });
      if (res?.status !== "success") throw new Error(res?.message || "The justification could not be saved.");
      setNotice(res.message === "Nothing changed." ? "Nothing changed." : `Recorded why ${nameOf(p)} is seated.`);
      setJustifyId(null);
      onChanged();
    } catch (err: any) {
      setJustifyError(err?.message || "The justification could not be saved.");
    } finally {
      setJustifying(false);
    }
  }
  const openJustify = (id: string | null) => { setJustifyId(id); setJustifyError(""); };

  return (
    <ModalDialog
      title="Attendance"
      subtitle={`${String(program.title || "").trim()} · ${formatDate(program.startDate)}${program.endDate && program.endDate !== program.startDate ? ` to ${formatDate(program.endDate)}` : ""}${program.venue ? ` · ${program.venue}` : ""}`}
      icon={<CalendarCheck size={16} aria-hidden="true" />}
      onClose={onClose}
      busy={!!savingId || justifying || sendingRep || uploading}
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={!!savingId || sendingRep || uploading}
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Close
        </button>
      }
    >
      <div className="space-y-3 text-xs text-slate-700">
        <p className="text-[11px] text-slate-500">
          Only participants marked <strong>Attended</strong> get a form. Marking someone attended needs their
          certificate of attendance on file, opens their form and notifies them, and decides how they settle: with a cash
          advance released, a liquidation report; with none, a reimbursement claim.{" "}
          <strong>Did not attend</strong> needs no file. Recording attendance never changes a cash advance request: one
          Finance didn&rsquo;t release or decline by the seminar&rsquo;s first day has already expired.
        </p>
        {!ended && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            {lastDay
              ? <>Attendance can be recorded once the seminar has ended: after {endsAt ? `${endsAt} on ` : ""}{formatDate(lastDay)}.</>
              : "This seminar has no dates yet, so its attendance can't be recorded."}
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
              const locked = !canRecord || !ended || !!savingId;
              const tdpText = tdpBadgeText(p.tdp, p.tdpException);
              const why = p.tdpException;
              // A representative: whose place they took, unless their badge already says so (the TDP
              // identifies some for the training anyway, and they show no badge).
              const lieu = p.replaces ? inLieuName(p) : undefined;
              const lieuInBadge = !!tdpText && why?.kind === "In lieu of";
              // Before attendance is recorded, someone can be sent in their place (Part B).
              const canSend = canJustify && !p.attendance && p.status === "Assigned" && repFor !== p.id && !sendingRep;
              // HR and the Administrator upload a certificate for staff who can't use the portal, and for anyone
              // whose own uploads reached the limit. Once the attendance stands on one, nothing replaces it here.
              const settled = !!p.certificate && p.attendance === "Attended";
              const twins = p.certificate?.sameFileAs ?? [];
              return (
                <li key={p.id} data-record-id={p.id} className="px-3 py-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                        {canRecord && isOwn(p) && (
                          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            You: flagged as self-approved if you record it
                          </span>
                        )}
                        {tdpText && (
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${p.tdp === "justified" || p.tdp === "seminar" ? "border-slate-300 bg-slate-50 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                            {tdpText}
                          </span>
                        )}
                        {lieu && !lieuInBadge && (
                          <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">In lieu of {lieu}</span>
                        )}
                        {canJustify && tdpText && p.tdp !== "seminar" && justifyId !== p.id && (
                          <button type="button" onClick={() => openJustify(p.id)} disabled={justifying} className="font-semibold text-blue-700 hover:underline disabled:opacity-50">
                            {why ? "Change why" : "Add why"}<span className="sr-only">: {nameOf(p)}</span>
                          </button>
                        )}
                        {canSend && (
                          <button type="button" onClick={() => { setRepFor(p.id); setNotice(""); }} className="font-semibold text-blue-700 hover:underline">
                            Send a representative<span className="sr-only">: in lieu of {nameOf(p)}</span>
                          </button>
                        )}
                      </p>
                      {/* The justification itself: HR and the Administrator only (this list is theirs). */}
                      {why && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {why.reason} · identified by {why.identifiedBy.name} ({why.identifiedBy.position})
                          {why.referenceNo ? ` · ${why.referenceNo}${why.referenceDate ? `, ${formatDate(why.referenceDate)}` : ""}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => record(p, "Attended")}
                        disabled={locked || p.attendance === "Attended" || !p.certificate}
                        title={!p.certificate && p.attendance !== "Attended" ? "Their certificate of attendance isn't on file yet" : undefined}
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
                  </div>
                  {/* HR's basis for "Attended" (R4). */}
                  <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5">
                    <CertificatePanel
                      participantId={p.id}
                      certificate={p.certificate}
                      blockedReason={settled ? null : p.certificateBlockedReason}
                      canUpload={canJustify && (!p.hasPersonnelLogin || !!p.certificateCapped) && !settled}
                      ownerName={nameOf(p)}
                      onUploaded={message => { setError(""); setNotice(message); onChanged(); }}
                      onBusy={setUploading}
                    />
                    {!p.certificate && p.hasPersonnelLogin && !p.certificateCapped && !p.certificateBlockedReason && (
                      <p className="mt-0.5 text-[10px] text-slate-500">They upload it from their seminar card.</p>
                    )}
                    {p.hasPersonnelLogin && p.certificateCapped && !settled && !p.certificateBlockedReason && (
                      <p className="mt-0.5 text-[10px] text-slate-500">Their own uploads reached the limit, so you can upload it for them.</p>
                    )}
                    {twins.length > 0 && (
                      <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                        Same file as the certificate on file for {twins.map(t => `${t.name}${t.seminar ? ` ("${t.seminar}")` : ""}`).join(", ")}.
                        Check that it names {nameOf(p)} before recording the attendance.
                      </p>
                    )}
                  </div>
                  {justifyId === p.id && (
                    <>
                      <TdpJustificationForm
                        employeeName={nameOf(p)}
                        initial={why}
                        // A representative's stays "In lieu of" (the server keeps it so).
                        inLieuOf={why?.kind === "In lieu of" ? (lieu || why.inLieuOf?.fullName || "another participant") : undefined}
                        saveLabel="Save"
                        saving={justifying}
                        onSave={value => justify(p, value)}
                        onCancel={() => openJustify(null)}
                      />
                      {justifyError && <p role="alert" className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{justifyError}</p>}
                    </>
                  )}
                  {repFor === p.id && (
                    <SendRepresentativePanel
                      program={program}
                      original={{ id: p.id, employeeId: staffOf(p)?.id ?? p.employeeId, name: nameOf(p) }}
                      // (Not anyone marked "Did not attend": they are at the office, as the server counts them.)
                      rosterIds={roster.filter(x => x.attendance !== "Did not attend").map(x => staffOf(x)?.id ?? x.employeeId)}
                      onBusy={setSendingRep}
                      onClose={() => setRepFor(null)}
                      onSent={message => { setRepFor(null); setNotice(message); onChanged(); }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {/* Whoever a representative went in lieu of: their enrolment is closed, and kept on record. */}
        {replaced.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Replaced by a representative</h3>
            <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/60">
              {replaced.map(p => (
                <li key={p.id} className="px-3 py-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-600">{nameOf(p)}</span>: replaced by {p.replacedBy!.fullName} on {formatDate(p.replacedBy!.at)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
