import { useEffect, useRef, type ReactNode } from "react";
import { History } from "lucide-react";
import type { TdpJustificationInput, TrainingCandidate } from "../../types";
import { formatDate } from "../../utils";
import { BADGE, CandidateBadges, RecommendedBadge, TONE } from "./candidateBadges";
import TdpJustificationForm from "./TdpJustificationForm";
import { dateRange } from "./TrainingHistoryCards";
import type { PickRow } from "./ParticipantChecklist";

// One person's row in the participant picker's checklist (ParticipantChecklist.tsx): the box, their name and badges,
// the "History" button (R10: each row links to that person's trainings, R11), the justification button and its form.
// Someone already sent to this training who isn't on this seminar gets a read-only row: no box, and when and where
// they went instead of the badges. Moved out of ParticipantChecklist.tsx when the history came (2026-11-03).

/** When and where they were sent (R10's "Already sent to this training"), from the server's `alreadySent`. */
function SentDetails({ c }: { c: TrainingCandidate }) {
  const sent = c.alreadySent;
  // An older server's answer has only the reason.
  if (!sent) return <span className={`${BADGE} ${TONE.ineligible}`}>{c.ineligibleReason || "Already sent to this training"}</span>;
  if (sent.source === "seminar") {
    return (
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-700">
        <span className={`${BADGE} ${TONE.neutral}`}>Seminar{sent.fiscalYear ? ` · FY ${sent.fiscalYear}` : ""}</span>
        <span className="min-w-0 break-words font-medium text-slate-800">{sent.title || "Untitled seminar"}</span>
        <span className="text-slate-600">{dateRange(sent.startDate, sent.endDate)}</span>
        <span className={`${BADGE} ${sent.attendance === "Attended" ? TONE.attended : TONE.neutral}`}>
          {sent.attendance === "Attended" ? "Attended" : "Attendance not recorded"}
        </span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-700">
      <span className={`${BADGE} ${TONE.neutral}`}>HR record</span>
      <span className="min-w-0 break-words font-medium text-slate-800">{sent.title || "Untitled training"}</span>
      <span className="text-slate-600">{sent.recordedOn ? `recorded ${formatDate(sent.recordedOn)}` : "no date recorded"}</span>
    </span>
  );
}

/** Opens the person's training history over the picker. A sibling of the row's label, never inside it: a click on it
 * mustn't tick the box. */
function HistoryButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-history-link
      onClick={onClick}
      className="mt-2 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <History size={12} aria-hidden="true" />
      History<span className="sr-only">: {name}</span>
    </button>
  );
}

export default function PickRowItem({ r, boxId, formOpen, onToggle, onHistory, onOpenForm, onKeep, onCancel }: {
  r: PickRow;
  boxId: string;
  formOpen: boolean;
  onToggle: () => void;
  onHistory: () => void;
  onOpenForm: () => void;
  onKeep: (value: TdpJustificationInput) => void;
  onCancel: () => void;
}) {
  // The box's name is the person's name alone; the rest of the row describes it.
  const nameId = `${boxId}-name`, recId = `${boxId}-rec`, infoId = `${boxId}-info`;
  const where = [r.c?.position, r.c?.division].filter(Boolean).join(" · ");
  const standing = r.standing && <span className={`${BADGE} ${r.standing.tone}`}>{r.standing.text}</span>;
  const sent = !!r.c && !r.c.eligible;
  const name = (
    <span
      id={nameId}
      className={`min-w-0 break-words font-medium ${r.c ? "text-sm" : "font-mono text-xs"} ${
        r.c && !r.c.eligible && !r.ticked ? "text-slate-600" : "text-slate-800"
      }`}
    >
      {r.name}
    </span>
  );
  const info = (
    <span id={infoId} className="block">
      {where && <span className="block break-words text-xs text-slate-600">{where}</span>}
      {/* Already sent (another run of this training, an earlier year, or an HR record): when and where. */}
      {sent && <span className="block pt-1"><SentDetails c={r.c!} /></span>}
      {r.c && !r.readOnly
        ? <span className="block pt-1"><CandidateBadges c={r.c} selected={r.ticked} omitIneligible={sent}>{standing}</CandidateBadges></span>
        : !r.c && standing && <span className="flex flex-wrap gap-1 pt-1">{standing}</span>}
    </span>
  );

  if (r.readOnly) {
    return (
      <li data-employee-id={r.id} data-selected="false" data-readonly="true" className="px-3">
        <div className="flex items-start gap-3">
          {/* Where the box would be, so the names line up with the rows above. */}
          <span className="mt-3 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 py-2.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">{name}</span>
            {info}
          </div>
          <HistoryButton name={r.name} onClick={onHistory} />
        </div>
      </li>
    );
  }

  return (
    <li
      data-employee-id={r.id}
      data-selected={r.ticked ? "true" : "false"}
      data-recommended={r.recommended ? "true" : undefined}
      className={`px-3 transition-colors duration-150 motion-reduce:transition-none ${
        r.ticked ? "bg-blue-50/60 shadow-[inset_3px_0_0_0_var(--color-blue-600)]" : r.disabled ? "" : "hover:bg-slate-50"
      }`}
    >
      {/* The label spans the row, so the whole row ticks the box as in the needs dialog; the buttons
          and the form are its siblings, never inside it. */}
      <div className="flex items-start gap-3">
        <input
          id={boxId}
          type="checkbox"
          data-pick
          checked={r.ticked}
          disabled={r.disabled}
          onChange={onToggle}
          aria-labelledby={nameId}
          aria-describedby={r.recommended ? `${recId} ${infoId}` : infoId}
          className="mt-3 h-4 w-4 shrink-0 cursor-pointer accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed"
        />
        <label htmlFor={boxId} className={`min-w-0 flex-1 py-2.5 ${r.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {name}
            {r.recommended && <RecommendedBadge id={recId} />}
          </span>
          {info}
        </label>
        <HistoryButton name={r.name} onClick={onHistory} />
      </div>
      {r.why && (
        <div className="-mt-1 pb-2.5 pl-7">
          <button
            type="button"
            onClick={onOpenForm}
            className="rounded text-xs font-semibold text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {r.why}<span className="sr-only">: {r.name}</span>
          </button>
        </div>
      )}
      {formOpen && (
        <FormSlot>
          <TdpJustificationForm employeeName={r.name} initial={r.formInitial} onSave={onKeep} onCancel={onCancel} />
        </FormSlot>
      )}
    </li>
  );
}

// The justification form opens under its row and scrolls into view, clear of the toolbar (the list's
// scroll margin): whole when it fits below the toolbar, else from its top. ("nearest" alone does nothing
// when the form overflows both edges, which left its question under the toolbar at phone width.)
function FormSlot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let scroller = el.parentElement;
    while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const room = (scroller?.clientHeight ?? window.innerHeight) - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    el.scrollIntoView({ block: el.offsetHeight <= room ? "nearest" : "start" });
  }, []);
  return <div ref={ref} className="pb-3 sm:pl-7">{children}</div>;
}
