// The Plan A switch: who is listed, and the way to everyone else. Two fixed options, the one on
// highlighted, so it is plain which list is in use: a single button whose label flipped looked as if
// nothing happened. Moved out of ParticipantPickerModal.tsx when the checklist came (2026-10-30); the
// representative panel (SendRepresentativePanel.tsx) uses it too, with a line of its own.
import type { ReactNode } from "react";

interface Props {
  planOnly: boolean;
  /** Everyone whose Plan A lists the training. */
  listers: number;
  /** Everyone off the plan not selected yet. */
  outsidePlan: number;
  /** All active staff the server listed. */
  everyone: number;
  /** Off the plan and hidden by the Plan A view (0 while it shows everyone). */
  hiddenCount: number;
  /** The seminar's own justification covers everyone on it (12z Part C). */
  seminarCovers: boolean;
  fyText: string;
  onSwitch: (all: boolean) => void;
  /** The line in the caller's own words (a representative needs no justification of their own); else the picker's. */
  line?: ReactNode;
}

export default function PlanAViewSwitch({ planOnly, listers, outsidePlan, everyone, hiddenCount, seminarCovers, fyText, onSwitch, line }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
      {/* Read out when it changes, so a screen reader hears what the switch did. Its basis puts the switch
          on a line of its own at phone width, rather than squeezing this into a narrow column. */}
      <p aria-live="polite" className="min-w-0 flex-1 basis-60">
        {line ?? (planOnly
          ? listers === 0
            ? `Nobody's Plan A for ${fyText} lists this training.`
            : `Showing the ${listers} employee${listers === 1 ? "" : "s"} whose Plan A for ${fyText} lists this training.`
          : outsidePlan === 0
            ? "Showing all employees."
            : <>
                Showing all employees: <strong className="text-slate-800">{outsidePlan} outside the plan</strong>{" "}
                {outsidePlan === 1 ? "was" : "were"} added to the list below{seminarCovers ? "." : "; seating one needs a justification."}
              </>)}
      </p>
      {(!planOnly || hiddenCount > 0) && (
        <div role="group" aria-label="Who to choose from" className="inline-flex shrink-0 rounded-lg border border-blue-200 bg-white p-0.5">
          {([["plan", `Plan A listers (${listers})`], ["all", `All employees (${everyone})`]] as const).map(([which, label]) => {
            const on = (which === "plan") === planOnly;
            return (
              <button
                key={which}
                type="button"
                aria-pressed={on}
                onClick={() => onSwitch(which === "all")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  on ? "bg-blue-600 text-white" : "text-blue-700 hover:bg-blue-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
