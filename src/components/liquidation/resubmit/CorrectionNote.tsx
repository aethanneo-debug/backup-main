import { MessageSquareWarning } from "lucide-react";

/** The reviewer's note beside a part of the form they reopened for correction. */
export default function CorrectionNote({ note, id }: { note?: string; id?: string }) {
  if (!note) return null;
  return (
    <p id={id} className="mt-1 flex items-start gap-1 font-sans text-[11px] font-semibold text-amber-800">
      <MessageSquareWarning size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="sr-only">Reviewer&rsquo;s note: </span>
        {note}
      </span>
    </p>
  );
}
