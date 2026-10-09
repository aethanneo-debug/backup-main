import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { BadgeCheck, Link2, Loader2, Pencil, UserPlus } from "lucide-react";
import { Employee, Signatory, SignatoryRole, SIGNATORY_ROLES } from "../../types";
import { apiCall } from "../../utils";
import ModalDialog from "../ui/ModalDialog";
import StaffCombobox from "./StaffCombobox";
import {
  ACTION_BUTTON, CANCEL_BUTTON, CONTROL, FormField, HINT, LABEL, Notice, control, describedBy
} from "./signatoryFormParts";
import {
  ACCOUNTANT,
  ROLE_PRINT_NOTE,
  SIGNATORY_TEXT_MAX,
  activeInRole,
  cleanText,
  displayDate,
  isCalendarDate,
  isSamePerson,
  isSingleHolderRole,
  joinNames,
  manilaToday
} from "./signatoryHelpers";

/**
 * Add a signatory, appoint a new Accountant, or edit an entry.
 *
 * "appoint" is "add" with the role fixed to Accountant: the server ends the current
 * Accountant's term in the same request, and this form says so before anything is saved.
 * In "edit" the role is read-only (the server refuses a change) and only an inactive
 * entry shows an end date.
 */

export type SignatoryFormMode = "add" | "appoint" | "edit";

interface SignatoryFormModalProps {
  mode: SignatoryFormMode;
  /** The entry being edited (edit mode). */
  signatory?: Signatory;
  /** Add mode: the role chosen in advance, e.g. from the "Add representative" prompt. */
  presetRole?: SignatoryRole;
  employees: Employee[];
  /** The full list, to tell who an appointment would replace. */
  signatories: Signatory[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

type Field = "fullName" | "position" | "role" | "effectiveFrom" | "effectiveTo";
type Errors = Partial<Record<Field, string>>;
const FIELD_ORDER: Field[] = ["fullName", "position", "role", "effectiveFrom", "effectiveTo"];

export default function SignatoryFormModal({
  mode, signatory, presetRole, employees, signatories, onClose, onSaved
}: SignatoryFormModalProps) {
  const editing = mode === "edit" && signatory ? signatory : null;
  const kind: SignatoryFormMode = editing ? "edit" : mode === "appoint" ? "appoint" : "add";
  const today = manilaToday();
  const showEndDate = editing?.status === "Inactive";

  const [employeeId, setEmployeeId] = useState(editing?.employeeId ?? "");
  const [fullName, setFullName] = useState(editing?.fullName ?? "");
  const [position, setPosition] = useState(editing?.position ?? "");
  const [role, setRole] = useState<SignatoryRole | "">(
    kind === "appoint" ? ACCOUNTANT : editing ? editing.role : presetRole ?? ""
  );
  const [effectiveFrom, setEffectiveFrom] = useState(editing?.effectiveFrom ?? today);
  const [effectiveTo, setEffectiveTo] = useState(editing?.effectiveTo ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const uid = useId();
  const ids = {
    form: `${uid}-form`, staff: `${uid}-staff`, staffHint: `${uid}-staff-hint`, fullName: `${uid}-name`,
    position: `${uid}-position`, role: `${uid}-role`, effectiveFrom: `${uid}-from`, effectiveTo: `${uid}-to`,
    notice: `${uid}-notice`
  };
  const refs = {
    staff: useRef<HTMLInputElement>(null),
    fullName: useRef<HTMLInputElement>(null),
    position: useRef<HTMLInputElement>(null),
    role: useRef<HTMLSelectElement>(null),
    effectiveFrom: useRef<HTMLInputElement>(null),
    effectiveTo: useRef<HTMLInputElement>(null)
  };

  // Only current staff can be picked; an existing link to a former employee still shows.
  const pickable = useMemo(
    () => (employees ?? [])
      .filter(e => e && e.isActive !== false)
      .sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? "")),
    [employees]
  );
  const linkedEmployee = employeeId ? (employees ?? []).find(e => e.id === employeeId) : undefined;

  // Picking someone replaces the search box, so move focus on to the next sensible field.
  const pendingFocus = useRef<"fullName" | "staff" | null>(null);
  useEffect(() => {
    const target = pendingFocus.current ? refs[pendingFocus.current].current : null;
    pendingFocus.current = null;
    target?.focus();
  }, [employeeId]);

  function pick(emp: Employee) {
    setEmployeeId(emp.id);
    setFullName(cleanText(emp.fullName));
    setPosition(cleanText(emp.position));
    pendingFocus.current = "fullName";
  }
  function unlink() {
    setEmployeeId("");
    pendingFocus.current = "staff";
  }

  // Who this save affects. The server is the judge; this only lets the form say it first.
  const effectiveRole: SignatoryRole | "" = kind === "appoint" ? ACCOUNTANT : editing ? editing.role : role;
  const draft = { employeeId: employeeId || undefined, fullName };
  const hasPerson = !!employeeId || cleanText(fullName) !== "";
  const others = effectiveRole ? activeInRole(signatories, effectiveRole).filter(s => s.id !== editing?.id) : [];
  const duplicate = hasPerson && (!editing || editing.status === "Active")
    ? others.find(s => isSamePerson(s, draft))
    : undefined;
  const replacing = !editing && isSingleHolderRole(effectiveRole) ? others.filter(s => !isSamePerson(s, draft)) : [];
  const newName = cleanText(fullName) || "this person";
  // A replacement starts today, the day the current term ends (the server refuses a
  // backdated one, which would give two holders for the same days).
  const startDate = replacing.length > 0 ? today : effectiveFrom;

  function validate(): Errors {
    const errs: Errors = {};
    const name = cleanText(fullName);
    const pos = cleanText(position);
    if (!name) errs.fullName = "Enter the full name.";
    else if (name.length > SIGNATORY_TEXT_MAX) errs.fullName = `Keep the name to ${SIGNATORY_TEXT_MAX} characters or fewer (now ${name.length}).`;
    if (!pos) errs.position = "Enter the position.";
    else if (pos.length > SIGNATORY_TEXT_MAX) errs.position = `Keep the position to ${SIGNATORY_TEXT_MAX} characters or fewer (now ${pos.length}).`;
    if (kind === "add" && !role) errs.role = "Choose a role.";
    if (!isCalendarDate(startDate)) errs.effectiveFrom = "Enter a valid start date.";
    else if (startDate > today) errs.effectiveFrom = `The start date can't be later than today (${displayDate(today)}).`;
    if (showEndDate) {
      if (!isCalendarDate(effectiveTo)) errs.effectiveTo = "Enter the date the term ended.";
      else if (effectiveTo > today) errs.effectiveTo = `The end date can't be later than today (${displayDate(today)}).`;
      else if (isCalendarDate(startDate) && effectiveTo < startDate) errs.effectiveTo = "The end date can't be earlier than the start date.";
    }
    return errs;
  }
  // Errors appear after the first Save attempt, then update as the fields are corrected.
  const errors: Errors = submitted ? validate() : {};

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSubmitted(true);
    setServerError("");
    const errs = validate();
    const firstInvalid = FIELD_ORDER.find(f => errs[f]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    const name = cleanText(fullName);
    const pos = cleanText(position);
    // On edit the staff link is sent only when it changed: the server re-checks any id it
    // receives, so resending a link to a since-removed record would block every save.
    const linkChanged = !!editing && employeeId !== (editing.employeeId ?? "");
    setSaving(true);
    try {
      const res = editing
        ? await apiCall(`/api/signatories/${encodeURIComponent(editing.id)}`, {
            method: "PUT",
            body: JSON.stringify({
              fullName: name, position: pos, effectiveFrom: startDate,
              ...(linkChanged ? { employeeId: employeeId || "" } : {}),
              ...(showEndDate ? { effectiveTo } : {})
            })
          })
        : await apiCall("/api/signatories", {
            method: "POST",
            // A replacement's start date is left to the server, which uses its own "today"; a
            // PC whose clock is a day off would otherwise be refused with no way to fix it.
            body: JSON.stringify({
              fullName: name, position: pos, role: effectiveRole,
              ...(replacing.length > 0 ? {} : { effectiveFrom: startDate }),
              ...(employeeId ? { employeeId } : {})
            })
          });
      if (res?.status !== "success") throw new Error(res?.message || "The signatory could not be saved.");
      onSaved(res.message || (editing ? `${name}'s entry was updated.` : `${name} was added as ${effectiveRole}.`));
    } catch (err: any) {
      // apiCall throws on a non-2xx, carrying the server's own message (e.g. a 409 duplicate).
      setServerError(err?.message || "The signatory could not be saved. Please try again.");
      setSaving(false);
    }
  }

  const heading = {
    add: { title: "Add signatory", subtitle: "Names here print on official forms.", icon: UserPlus },
    appoint: { title: "Appoint new Accountant", subtitle: "Use this when the Accountant resigns or is replaced.", icon: BadgeCheck },
    edit: { title: "Edit signatory", subtitle: editing ? `${editing.fullName} · ${editing.role} · ${editing.status}` : "", icon: Pencil }
  }[kind];
  const HeadingIcon = heading.icon;
  const submitLabel = editing ? "Save changes"
    : kind === "appoint" || replacing.length > 0 ? `Appoint ${effectiveRole}` : "Add signatory";

  return (
    <ModalDialog
      title={heading.title}
      subtitle={heading.subtitle}
      icon={<HeadingIcon size={16} aria-hidden="true" />}
      onClose={onClose}
      busy={saving}
      initialFocusRef={kind === "edit" || pickable.length === 0 ? refs.fullName : refs.staff}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={CANCEL_BUTTON}>
            Cancel
          </button>
          <button
            type="submit"
            form={ids.form}
            disabled={saving}
            aria-describedby={replacing.length > 0 || duplicate ? ids.notice : undefined}
            className={`${ACTION_BUTTON} bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500`}
          >
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : submitLabel}
          </button>
        </>
      }
    >
      <form id={ids.form} noValidate onSubmit={handleSubmit} className="space-y-4">
        <p className="text-[11px] text-slate-500">
          Fields marked <span className="text-rose-600" aria-hidden="true">*</span>
          <span className="sr-only">with an asterisk</span> are required.
        </p>

        {editing?.status === "Inactive" && (
          <Notice tone="blue">
            This entry is inactive. Correct its details or dates here if they were recorded wrong. To have this person
            sign again, close this and choose <strong>Reactivate</strong>.
          </Notice>
        )}

        {/* STAFF RECORD — optional link that fills the name and position */}
        <div>
          {employeeId ? (
            <>
              <span className={LABEL}>Staff record</span>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <div className="min-w-0 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Link2 size={12} className="shrink-0 text-blue-600" aria-hidden="true" />
                    <span className="truncate">{linkedEmployee?.fullName ?? "Linked staff record (details not available)"}</span>
                  </p>
                  {linkedEmployee && (
                    <p className="truncate text-slate-600">{[linkedEmployee.position, linkedEmployee.division].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={unlink}
                  className="shrink-0 cursor-pointer rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Remove link<span className="sr-only"> to this staff record</span>
                </button>
              </div>
              <p className={HINT}>Removing the link keeps the name and position as typed below.</p>
            </>
          ) : pickable.length > 0 ? (
            <>
              <label htmlFor={ids.staff} className={LABEL}>
                Staff record <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <StaffCombobox id={ids.staff} employees={pickable} onSelect={pick} describedBy={ids.staffHint} inputRef={refs.staff} />
              <p id={ids.staffHint} className={HINT}>
                Picking someone fills in the name and position from their staff record; both stay editable. Not on the
                staff list? Leave this blank and type the name below.
              </p>
            </>
          ) : (
            <Notice tone="blue">The staff list isn't available right now. Type the name and position below.</Notice>
          )}
        </div>

        <FormField id={ids.fullName} label="Full name" required hint="Exactly as it should print on the form." error={errors.fullName}>
          <input
            ref={refs.fullName} id={ids.fullName} type="text" value={fullName} autoComplete="off"
            onChange={e => setFullName(e.target.value)}
            aria-required="true" aria-invalid={!!errors.fullName}
            aria-describedby={describedBy(ids.fullName, true, errors.fullName)}
            className={control(errors.fullName)}
          />
        </FormField>

        <FormField id={ids.position} label="Position" required hint="Printed under the name, e.g. Accountant III." error={errors.position}>
          <input
            ref={refs.position} id={ids.position} type="text" value={position} autoComplete="off"
            onChange={e => setPosition(e.target.value)}
            aria-required="true" aria-invalid={!!errors.position}
            aria-describedby={describedBy(ids.position, true, errors.position)}
            className={control(errors.position)}
          />
        </FormField>

        {kind === "add" ? (
          <FormField id={ids.role} label="Role" required hint="Accountant prints in Box C of the Liquidation Report; Authorized Representatives in Box B." error={errors.role}>
            <select
              ref={refs.role} id={ids.role} value={role}
              onChange={e => setRole(e.target.value as SignatoryRole | "")}
              aria-required="true" aria-invalid={!!errors.role}
              aria-describedby={describedBy(ids.role, true, errors.role)}
              className={control(errors.role)}
            >
              <option value="">Select a role…</option>
              {SIGNATORY_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_PRINT_NOTE[r] ? `${r} (${ROLE_PRINT_NOTE[r]})` : r}</option>
              ))}
            </select>
          </FormField>
        ) : (
          <FormField
            id={ids.role}
            label="Role"
            hint={kind === "edit"
              ? "The role can't be changed. To move this person to another role, mark this entry Resigned / Replaced and add them again under the new role."
              : "Prints in Box C of the Liquidation Report. Only one Accountant is active at a time, so appointing a new one ends the current term today."}
          >
            <input
              id={ids.role} type="text" readOnly value={effectiveRole}
              aria-describedby={`${ids.role}-hint`}
              className={`${CONTROL} cursor-default border-slate-200 bg-slate-50 text-slate-600`}
            />
          </FormField>
        )}

        <div className={`grid gap-4 ${showEndDate ? "sm:grid-cols-2" : ""}`}>
          <FormField
            id={ids.effectiveFrom}
            label="Effective from"
            required
            hint={replacing.length > 0
              ? "Today: a replacement starts the day the current term ends."
              : editing?.status === "Active"
                ? "An active entry has no end date. Use Resigned / Replaced to end the term."
                : "Today or earlier."}
            error={errors.effectiveFrom}
          >
            <input
              ref={refs.effectiveFrom} id={ids.effectiveFrom} type="date" value={startDate} max={today}
              onChange={e => setEffectiveFrom(e.target.value)}
              disabled={replacing.length > 0}
              aria-required="true" aria-invalid={!!errors.effectiveFrom}
              aria-describedby={describedBy(ids.effectiveFrom, true, errors.effectiveFrom)}
              className={`${control(errors.effectiveFrom)} sm:max-w-xs disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600`}
            />
          </FormField>
          {showEndDate && (
            <FormField id={ids.effectiveTo} label="Effective to" required hint="The last day of the term." error={errors.effectiveTo}>
              <input
                ref={refs.effectiveTo} id={ids.effectiveTo} type="date" value={effectiveTo}
                min={isCalendarDate(startDate) ? startDate : undefined} max={today}
                onChange={e => setEffectiveTo(e.target.value)}
                aria-required="true" aria-invalid={!!errors.effectiveTo}
                aria-describedby={describedBy(ids.effectiveTo, true, errors.effectiveTo)}
                className={control(errors.effectiveTo)}
              />
            </FormField>
          )}
        </div>

        {/* What saving will do, said before it happens. Not a live region: the sentence holds the
            typed name, so it would be re-read on every keystroke. It describes the Save button
            instead, so a screen reader reads it right before saving. */}
        <div>
          {duplicate ? (
            <Notice tone="amber" id={ids.notice}>
              <strong>{duplicate.fullName}</strong> is already an active {effectiveRole}, so this entry can't be saved.
              Choose someone else, or edit the existing entry.
            </Notice>
          ) : replacing.length > 0 ? (
            <Notice tone="amber" id={ids.notice}>
              Saving makes <strong>{newName}</strong> the {effectiveRole}.{" "}
              <strong>{joinNames(replacing.map(s => s.fullName))}</strong>'s term{replacing.length > 1 ? "s" : ""} will end today.
            </Notice>
          ) : kind === "appoint" ? (
            <Notice tone="blue">No Accountant is active right now. Saving makes {newName} the Accountant.</Notice>
          ) : null}
        </div>

        {serverError && (
          <Notice tone="rose" role="alert">
            <strong>Not saved.</strong> {serverError}
          </Notice>
        )}
      </form>
    </ModalDialog>
  );
}
