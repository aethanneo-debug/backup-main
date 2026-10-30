import { useEffect, useId, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { TrainingCandidate, TrainingProgram, type TdpJustificationInput } from "../../types";
import { apiCall, apiErrorCode, getLocalTodayString } from "../../utils";
import { addedGaps, datesText, divisionGapQuestion, divisionGaps, gapText, seminarWeekdays } from "../../divisionCoverage";
import PlanAViewSwitch from "./PlanAViewSwitch";
import TdpJustificationForm from "./TdpJustificationForm";

// Sending a representative in lieu of someone enrolled (HSAC RAB 1, 2026-10-28: e.g. the accountant is on
// leave and a paid Central Office training shouldn't go to waste; known-issues 12z Part B), under their
// row in the attendance list. HR chooses who goes and records why ("In lieu of", with the reason and who
// identified them). The server closes the original's enrolment, tells them, and seats the representative;
// it refuses while the original's cash advance is still out, and asks before leaving a division with
// nobody at the office.
interface Props {
  program: TrainingProgram;
  /** The enrolment whose place is taken: its id, its staff record id, and the employee's name. */
  original: { id: string; employeeId: string; name: string };
  /** Everyone on the seminar now, by staff record id: they can't be sent, and count for the division warning. */
  rosterIds: string[];
  onClose: () => void;
  /** After the representative is seated, with the server's account of it. */
  onSent: (message: string) => void;
  /** While a send is in flight: the list it sits in stays open and offers no other swap until it answers. */
  onBusy?: (busy: boolean) => void;
}

const SELECT = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
const BUTTON = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export default function SendRepresentativePanel({ program, original, rosterIds, onClose, onSent, onBusy }: Props) {
  const id = useId();
  const [candidates, setCandidates] = useState<TrainingCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [chosen, setChosen] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The seminar as saved: the server ranks everyone for it (Plan A listers and those with no training
    // yet this year first) and says who can't be enrolled and who is at another seminar on its days.
    apiCall(`/api/training/recommendations?programId=${encodeURIComponent(program.id)}`)
      .then(res => { if (!cancelled) setCandidates(res?.data?.candidates ?? []); })
      .catch(err => { if (!cancelled) setLoadError(err?.message || "The employees could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [program.id]);

  const onRoster = new Set(rosterIds);
  const choices = (candidates ?? []).filter(c => c.eligible && !onRoster.has(c.employeeId) && c.employeeId !== original.employeeId);
  // A seminar that covers Plan A needs lists, at first, only those whose own plan for its year lists one of
  // them. "All employees" stays for the Chief's own choice (HSAC RAB 1, 2026-10-28: the Chief may identify
  // anyone, e.g. in lieu of an accountant on leave); the "In lieu of" reason is recorded either way.
  const coversNeeds = (program.fulfillsNeedTitles ?? []).length > 0;
  const planOnly = coversNeeds && !showAll;
  const listed = choices.filter(c => c.needsThis);
  const shown = planOnly ? listed : choices;
  const chosenOne = shown.find(c => c.employeeId === chosen);
  const fyText = program.fiscalYear ? `FY ${program.fiscalYear}` : "this fiscal year";
  // Back to the plan's list: someone chosen off it is let go, and their form with them.
  const switchView = (all: boolean) => {
    setShowAll(all);
    if (!all && chosen && !listed.some(c => c.employeeId === chosen)) setChosen("");
  };

  // Someone must stay to man each division (HSAC RAB 1): what this swap adds on the days still to come.
  // The server checks it again and asks; this only warns first.
  const newGaps = useMemo(() => {
    const today = getLocalTodayString();
    const days = seminarWeekdays(program.startDate, program.endDate).filter(d => d >= today);
    if (!chosen || days.length === 0 || candidates.length === 0) return [];
    const staff = candidates.map(c => ({ id: c.employeeId, division: c.division }));
    const away = new Map(candidates.map(c => [c.employeeId, new Set(c.awayOn ?? [])]));
    const isAway = (staffId: string, day: string) => !!away.get(staffId)?.has(day);
    const before = divisionGaps(staff, days, rosterIds, isAway);
    const after = divisionGaps(staff, days, [...rosterIds.filter(x => x !== original.employeeId), chosen], isAway);
    return addedGaps(before, after);
  }, [chosen, candidates, rosterIds.join("|"), original.employeeId, program.startDate, program.endDate]);

  async function send(value: TdpJustificationInput) {
    setSending(true);
    onBusy?.(true);
    setError("");
    let body: Record<string, unknown> = {
      employeeId: chosen, reason: value.reason, identifiedBy: value.identifiedBy,
      referenceNo: value.referenceNo, referenceDate: value.referenceDate
    };
    try {
      for (;;) {
        try {
          const res = await apiCall(`/api/training/participants/${encodeURIComponent(original.id)}/replace`, { method: "POST", body: JSON.stringify(body) });
          onSent(res?.message || "The representative was sent.");
          return;
        } catch (err: any) {
          // The swap would leave a division with nobody at the office: HR may still go ahead, knowingly.
          if (apiErrorCode(err) === "DIVISION_GAP" && !body.allowDivisionGap) {
            if (!window.confirm(divisionGapQuestion(err.message, "Send"))) return;
            body = { ...body, allowDivisionGap: true };
            continue;
          }
          throw err;
        }
      }
    } catch (err: any) {
      // E.g. their cash advance is still out: the server says what has to happen first.
      setError(err?.message || "The representative could not be sent.");
    } finally {
      setSending(false);
      onBusy?.(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="mt-2 space-y-2.5 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs">
      <h4 id={`${id}-title`} className="text-[11px] font-bold text-blue-900">Send a representative in lieu of {original.name}</h4>
      <p className="text-[11px] text-slate-600">
        {original.name}&rsquo;s enrolment is closed and they are told; the representative gets the usual assignment notice. If{" "}
        {original.name} has a cash advance out, Finance records its refund first.
      </p>
      <div>
        {/* Tied to the list only while there is one to choose from. */}
        <label htmlFor={!loading && !loadError && shown.length > 0 ? `${id}-choice` : undefined} className="mb-0.5 block text-[11px] font-semibold text-slate-700">Who goes instead</label>
        {loading ? (
          <p className="flex items-center gap-2 text-slate-500"><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Loading the employees…</p>
        ) : loadError ? (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{loadError}</p>
        ) : choices.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-center text-slate-500">Nobody else can be enrolled in this seminar.</p>
        ) : (
          <div className="space-y-1.5">
            {coversNeeds ? (
              <PlanAViewSwitch
                planOnly={planOnly}
                listers={listed.length}
                outsidePlan={choices.length - listed.length}
                everyone={choices.length}
                hiddenCount={planOnly ? choices.length - listed.length : 0}
                seminarCovers={false}
                fyText={fyText}
                onSwitch={switchView}
                line={planOnly
                  ? listed.length === 0
                    ? <>Nobody else&rsquo;s Plan A for {fyText} lists this training. If the Chief identifies someone anyway, &ldquo;All employees&rdquo; lists everyone who can go.</>
                    : `Showing the ${listed.length} employee${listed.length === 1 ? "" : "s"} whose Plan A for ${fyText} lists this training.`
                  : `Showing everyone who can go${choices.length > listed.length ? `, ${choices.length - listed.length} of them outside the plan` : ""}.`}
              />
            ) : (
              <p className="text-[11px] text-slate-600">This seminar covers no Plan A need, so everyone who can go is listed.</p>
            )}
            {shown.length > 0 && (
              <select id={`${id}-choice`} className={SELECT} value={chosen} disabled={sending} autoFocus onChange={e => { setChosen(e.target.value); setError(""); }}>
                <option value="">Choose an employee…</option>
                {shown.map(c => (
                  <option key={c.employeeId} value={c.employeeId}>
                    {c.fullName} — {c.division || "No division"}{!planOnly && c.needsThis ? " · listed in their plan" : ""}
                    {(c.awayOn ?? []).length > 0 ? ` · at another seminar on ${datesText(c.awayOn!)}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
      <div role="status" aria-live="polite">
        {newGaps.length > 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            This leaves nobody at the office: {gapText(newGaps)}. Someone must stay to man the division; Send asks you to confirm.
          </p>
        )}
      </div>
      {chosenOne ? (
        <TdpJustificationForm
          key={chosenOne.employeeId}
          employeeName={chosenOne.fullName}
          inLieuOf={original.name}
          saveLabel="Send"
          saving={sending}
          onSave={value => { void send(value); }}
          onCancel={onClose}
        />
      ) : (
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={BUTTON}>Cancel</button>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{error}</p>}
    </section>
  );
}
