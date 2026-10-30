import type { ReactNode } from "react";
import { ChevronRight, Scale } from "lucide-react";
import { BADGE, RecommendedBadge, TONE } from "./candidateBadges";

// "How this list is ordered" in the participant picker: the server's ranking (rankTrainingCandidates in
// server.ts) in plain words, with a sample of each badge in the rows' own colours.

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-slate-800">{children}</strong>;
const Sample = ({ tone, children }: { tone: string; children: ReactNode }) => (
  <span className={`${BADGE} ${tone} inline-flex items-center gap-1 align-middle`}>{children}</span>
);

/** `fyText`: "FY 2027", or "this fiscal year". `anyTarget`: a row matches a target stored on the seminar. */
export default function ParticipantOrderKey({ fyText, anyTarget }: { fyText: string; anyTarget: boolean }) {
  return (
    <details id="participant-order-key" className="group text-xs">
      <summary className="inline-flex cursor-pointer select-none list-none items-center gap-1 rounded font-semibold text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} aria-hidden="true" className="transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" />
        How this list is ordered
      </summary>
      <div className="mt-1.5 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 leading-relaxed text-slate-700">
        <p>Who comes first, in order of importance:</p>
        <ol className="list-decimal space-y-1 pl-5 marker:font-semibold marker:text-slate-500">
          <li>
            <B>Those who can be enrolled.</B> The <B>Not eligible</B> come last: already enrolled in this seminar, attended it
            in an earlier year, or HR recorded a training with the same title.
          </li>
          <li>
            <B>No training yet in {fyText}</B> <Sample tone={TONE.firstTraining}>No training yet this FY</Sample>: everyone
            should have at least one training a year.
          </li>
          <li>
            <B>Their own Plan A for {fyText} lists this training</B> <Sample tone={TONE.needsThis}>Needs this</Sample>: the
            Training and Development Plan identifies them.
          </li>
          <li>
            Among those, <B>a training the law requires</B>{" "}
            <Sample tone={TONE.mandated}><Scale size={10} aria-hidden="true" />Mandated</Sample> first.
          </li>
          <li>
            <B>New hires</B> <Sample tone={TONE.newHire}>New hire</Sample>: hired less than 12 months ago.
          </li>
          <li>
            Then{" "}
            {anyTarget && <>those matching the seminar&rsquo;s target <Sample tone={TONE.neutral}>Target match</Sample>, then </>}
            <B>the most recently hired</B>, then <B>by name</B>, A to Z.
          </li>
        </ol>
        <p className="border-t border-slate-200 pt-2 text-slate-600">
          The <RecommendedBadge className="align-middle" /> badge marks the top of this order, one for each free seat.
        </p>
      </div>
    </details>
  );
}
