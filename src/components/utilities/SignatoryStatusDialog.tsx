import { useId, useRef, useState } from "react";
import { Loader2, RotateCcw, UserX } from "lucide-react";
import { Signatory } from "../../types";
import { apiCall } from "../../utils";
import ModalDialog from "../ui/ModalDialog";
import { ACTION_BUTTON, CANCEL_BUTTON, HINT, LABEL, Notice, control } from "./signatoryFormParts";
import {
  SIGNATORY_TEXT_MAX,
  VACANCY_IMPACT,
  activeInRole,
  cleanText,
  displayDate,
  isSingleHolderRole,
  joinNames,
  manilaToday
} from "./signatoryHelpers";

/**
 * Confirms ending a signatory's term ("Resigned / Replaced") or starting a new one
 * ("Reactivate"), and says beforehand what else changes: a role left with nobody active,
 * or a current Accountant whose term ends because this one comes back.
 */

export type SignatoryStatusAction = "deactivate" | "reactivate";

interface SignatoryStatusDialogProps {
  action: SignatoryStatusAction;
  signatory: Signatory;
  /** The full list, to tell whether this is the last active holder of the role. */
  signatories: Signatory[];
  onClose: () => void;
  onDone: (message: string) => void;
  /** For an Accountant: appointing the successor ends this term in the same step. */
  onAppointInstead?: () => void;
}

export default function SignatoryStatusDialog({
  action, signatory, signatories, onClose, onDone, onAppointInstead
}: SignatoryStatusDialogProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const reasonRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  const reasonHintId = useId();

  const deactivating = action === "deactivate";
  const { fullName: name, role } = signatory;
  const today = displayDate(manilaToday());
  const othersActive = activeInRole(signatories, role).filter(s => s.id !== signatory.id);
  const leavesNone = deactivating && othersActive.length === 0;
  const replacing = !deactivating && isSingleHolderRole(role) ? othersActive : [];

  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const why = cleanText(reason);
      const res = await apiCall(`/api/signatories/${encodeURIComponent(signatory.id)}/${action}`, {
        method: "PUT",
        body: JSON.stringify(deactivating && why ? { reason: why } : {})
      });
      if (res?.status !== "success") throw new Error(res?.message || "The change could not be saved.");
      const fallback = deactivating
        ? `${name} is now inactive; their term as ${role} ended today.${leavesNone ? ` No ${role} is active now.` : ""}`
        : `${name} is an active ${role} again.`;
      onDone(res.message || fallback);
    } catch (err: any) {
      // apiCall throws on a non-2xx, carrying the server's own message (e.g. already inactive).
      setError(err?.message || "The change could not be saved. Please try again.");
      setSaving(false);
    }
  }

  return (
    <ModalDialog
      size="sm"
      title={deactivating ? "Resigned / Replaced" : "Reactivate signatory"}
      subtitle={`${name} · ${role}`}
      icon={deactivating ? <UserX size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
      onClose={onClose}
      busy={saving}
      initialFocusRef={deactivating ? reasonRef : cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" onClick={onClose} disabled={saving} className={CANCEL_BUTTON}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className={`${ACTION_BUTTON} ${
              deactivating
                ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
                : "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500"
            }`}
          >
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : deactivating ? "Mark as Resigned / Replaced" : "Reactivate"}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs leading-relaxed text-slate-700">
        {deactivating ? (
          <>
            <p>
              This ends <strong>{name}</strong>'s term as {role} today, {today}. The name stops appearing on new
              forms; reports already prepared keep it. The entry stays on the list as Inactive and can be
              reactivated later.
            </p>

            {leavesNone && (
              <Notice tone="amber">
                <strong>{name} is the only active {role}.</strong> {VACANCY_IMPACT[role] ?? ""}
              </Notice>
            )}

            {isSingleHolderRole(role) && onAppointInstead && (
              <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-blue-800">
                Is someone taking over?{" "}
                <button
                  type="button"
                  onClick={onAppointInstead}
                  disabled={saving}
                  className="cursor-pointer font-semibold underline underline-offset-2 hover:text-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed"
                >
                  Appoint the new {role} instead
                </button>{" "}
                — it ends {name}'s term in the same step.
              </p>
            )}

            <div>
              <label htmlFor={reasonId} className={LABEL}>
                Reason <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                ref={reasonRef}
                id={reasonId}
                type="text"
                value={reason}
                maxLength={SIGNATORY_TEXT_MAX}
                onChange={e => setReason(e.target.value)}
                aria-describedby={reasonHintId}
                placeholder="e.g. Resigned effective 30 September 2026"
                className={control()}
              />
              <p id={reasonHintId} className={HINT}>
                Recorded in the audit log, up to {SIGNATORY_TEXT_MAX} characters.
              </p>
            </div>
          </>
        ) : (
          <>
            <p>
              <strong>{name}</strong> becomes an active {role} again, starting today, {today}. Their previous term
              ({displayDate(signatory.effectiveFrom)} to {displayDate(signatory.effectiveTo)}) is kept in the audit log.
            </p>
            {replacing.length > 0 && (
              <Notice tone="amber">
                Saving makes <strong>{name}</strong> the {role} again.{" "}
                <strong>{joinNames(replacing.map(s => s.fullName))}</strong>'s term{replacing.length > 1 ? "s" : ""} will
                end today.
              </Notice>
            )}
          </>
        )}

        {error && (
          <Notice tone="rose" role="alert">
            <strong>Not saved.</strong> {error}
          </Notice>
        )}
      </div>
    </ModalDialog>
  );
}
