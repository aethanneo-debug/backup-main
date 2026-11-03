import { AlertTriangle, ListChecks } from "lucide-react";
import { datesText, type DivisionGap } from "../../divisionCoverage";

// The participant picker's intro box and footer, moved out of ParticipantPickerModal.tsx when the instructor's
// review's view made it long (R10, 2026-11-03). Who is listed is worked out in pickGroups.ts.

/** What is particular to this seminar. The order itself is in "How this list is ordered". */
export function PickerIntro({ coversNeeds, seminarCovers, fyText }: { coversNeeds: boolean; seminarCovers: boolean; fyText: string }) {
  return (
    <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 p-3 rounded-lg flex gap-2">
      <ListChecks size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
      <p>
        Tick the employees who will attend.{" "}
        {coversNeeds && (
          <>This seminar covers Plan A needs, so at first only the employees whose plan lists it are shown; their badge says in
          which column: for their <strong>function</strong>, an <strong>additional designation</strong>, or <strong>career advancement</strong>.{" "}
          {/* (Not when the seminar's own justification covers everyone: then nobody is asked why.) */}
          {!seminarCovers && (
            <>Someone the TDP doesn&rsquo;t list, such as an employee hired after it was approved, is under <strong>All employees</strong>:
            tick them and record why they are seated.{" "}</>
          )}</>
        )}
        {seminarCovers && (
          <>This seminar covers no Plan A need, so it is held <strong>outside the TDP</strong> with its own justification, which
          covers everyone on it.{" "}</>
        )}
        You see first those with <strong>no training yet in {fyText}</strong>, and anyone whose need for it is mandated; the
        lists under them open the rest.
      </p>
    </div>
  );
}

/** The division warning, what still needs a justification, and the two buttons. */
export function PickerFooter({ gaps, pending, pendingHidden, canConfirm, selected, onCancel, onConfirm }: {
  /** The divisions this choice would leave with nobody at the office. */
  gaps: DivisionGap[];
  /** People ticked who still need a justification, and how many of them the search hides. */
  pending: number;
  pendingHidden: number;
  canConfirm: boolean;
  selected: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-200 bg-slate-50 space-y-3 shrink-0">
      {/* A division left with nobody at the office: a warning, since HR may go ahead knowingly. Under
          the list, it stays in view while people are ticked, and coming or going it moves no row. */}
      {gaps.length > 0 && (
        <div role="status" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Someone must stay to man the division. With these participants, nobody would be left at the office:</p>
            <ul className="list-disc pl-4">
              {gaps.map(g => <li key={g.division}>{g.division}: on {datesText(g.dates)}</li>)}
            </ul>
            <p>You can still save it. Save asks you to confirm any day this change adds, and records it in the audit log.</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {pending > 0 && (
          <p role="status" className="mr-auto text-xs text-amber-800">
            {pending === 1 ? "1 person needs" : `${pending} people need`} a justification: record why, or untick them
            {pendingHidden > 0 ? ` (${pendingHidden} hidden by the search)` : ""}.
          </p>
        )}
        <button onClick={onCancel} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm Participants ({selected})
        </button>
      </div>
    </div>
  );
}
