import { Ref, useId } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { TdpReplaceNeed, TdpReplaceSummary as Summary } from "../../../types";
import { count, hrKinds, hrNeedsText as hrNeeds } from "../tdpText";

// What replacing the TDP does, as the server's dry run worked it out (nothing is saved by it), and the step that
// replaces it. Removing a need takes it off Plan A and Monitoring, so the needs it removes and the ones it keeps are
// named, and the final button stays off while the check is out of date (the mapping changed since). Needs HR added
// after the TDP (12ad), or for trainings outside it (12ae, tagged), are never removed: those the amended TDP leaves out
// stay, those it lists become its own.
interface Props {
  summary: Summary;
  /** The mapping or sheet changed after this check: it may not be what Replace would do. */
  stale: boolean;
  /** Replace was refused because the plan changed since the check (409 TDP_CHANGED): this summary is the server's
   * answer as the plan is now, `was` the counts HR had confirmed. */
  changed?: { message: string; was: string };
  filename: string;
  fiscalYear: string;
  /** The replacement is on its way. */
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}

const STATS = "rounded-lg border px-2.5 py-1.5";

const NEUTRAL = "border-slate-200 bg-slate-50 text-slate-700";

// A count of nothing is drawn plain: "0 removed" is no warning.
function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`${STATS} ${value > 0 ? tone : NEUTRAL}`}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider">{label}</dt>
      <dd className="font-mono text-base font-bold leading-tight">{value}</dd>
    </div>
  );
}

// A need stays for a seminar only when its own person is seated for it (the user's decision of 2026-11-02).
const kept = (row: Summary["kept"][number]) =>
  row.reason === "seminar" ? `Seated for it on “${row.detail}”` : `Already accomplished: ${row.detail}`;

// HR's own additions come in two kinds: one of the TDP's trainings after it (12ad), or a training outside it (12ae).
// Said as the list holds them (hrKinds, hrNeeds: tdpText.ts), so a plan with only 12ad's reads as it always has.
/** A heading's start: "Added after the TDP", "Outside the TDP", or "Added by HR, after the TDP or outside it". */
function hrHeading(list: TdpReplaceNeed[]): string {
  const { outside, after } = hrKinds(list);
  return outside && after ? "Added by HR, after the TDP or outside it" : outside ? "Outside the TDP" : "Added after the TDP";
}
/** A tile's label start, shorter. */
function hrTile(list: TdpReplaceNeed[]): string {
  const { outside, after } = hrKinds(list);
  return outside && after ? "Added by HR" : outside ? "Outside TDP" : "Added after TDP";
}
/** A heading's start inside a caption: "Needs added after the TDP", "Needs outside the TDP". */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** The needs named in one list: employee, column, training, and a fourth column when `why` names it (why it stays, or
 * the column it moves from). */
function NeedList({ caption, rows, why }: { caption: string; rows: (TdpReplaceNeed & { why?: string })[]; why?: string }) {
  return (
    <div className="custom-scrollbar max-h-56 overflow-auto rounded-lg border border-slate-200" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left text-[11px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-[9px] uppercase tracking-wider text-slate-500">
            <th scope="col" className="sticky top-0 border-b border-slate-200 bg-slate-50 px-2 py-1.5 font-bold">Employee</th>
            <th scope="col" className="sticky top-0 border-b border-slate-200 bg-slate-50 px-2 py-1.5 font-bold">Column</th>
            <th scope="col" className="sticky top-0 border-b border-slate-200 bg-slate-50 px-2 py-1.5 font-bold">Training</th>
            {why && <th scope="col" className="sticky top-0 border-b border-slate-200 bg-slate-50 px-2 py-1.5 font-bold">{why}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.employee}|${row.category}|${row.title}|${i}`} className="align-top">
              <td className="border-b border-slate-100 px-2 py-1.5 font-semibold text-slate-800">{row.employee}</td>
              <td className="whitespace-nowrap border-b border-slate-100 px-2 py-1.5 text-slate-600">{row.category}</td>
              <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">
                {row.title}
                {/* A training the TDP doesn't list, planned by HR (12ae). */}
                {row.outside && (
                  <span data-need-mark="outside" className="ml-1.5 inline-block rounded border border-purple-200 bg-purple-50 px-1 py-px align-middle text-[10px] font-semibold text-purple-800">
                    outside the TDP
                  </span>
                )}
              </td>
              {why && <td className="border-b border-slate-100 px-2 py-1.5 text-slate-600">{row.why}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TdpReplaceSummary({ summary, stale, changed, filename, fiscalYear, busy, onConfirm, onCancel, headingRef }: Props) {
  const id = useId();
  const removed = summary.removed ?? [];
  const added = summary.addedNeeds ?? [];
  const movedRows = (summary.moved ?? []).map(row => ({ ...row, why: row.from }));
  const keptRows = (summary.kept ?? []).map(row => ({ ...row, why: kept(row) }));
  // Seminars that would cover no training left in the plan: they would need their own justification (12z Part C).
  const outside = summary.seminarsOutside ?? [];
  // Needs HR added after the TDP, or for trainings outside it: every one is kept (not in the amended TDP) or adopted
  // (listed by it, in place or moved, so also counted there). With none, their tiles would only ever read 0.
  const addedKept = summary.addedKept ?? [];
  const adopted = summary.adopted ?? [];
  const anyAdded = addedKept.length + adopted.length > 0;
  const nothingChanges = summary.added === 0 && movedRows.length === 0 && removed.length === 0 && keptRows.length === 0;

  return (
    <div className="space-y-3">
      <section data-tdp="summary" data-stale={stale ? "true" : "false"} aria-labelledby={`${id}-title`} className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <h4 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="text-xs font-bold text-slate-800 focus:outline-none">
          3. What the amended TDP changes in the FY {fiscalYear} plan
        </h4>
        <p className="mt-0.5 text-[11px] text-slate-500">Checked against the plan as it is now. Nothing has been saved yet.</p>

        {changed && !stale && (
          <div data-tdp="changed" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{changed.message || "The plan changed since you checked what the amended TDP would do."}</span>
            </p>
            <p className="mt-1 pl-[21px]">
              This is what it does now; nothing was replaced. Before, it was: {changed.was} Read it again, then replace.
            </p>
          </div>
        )}

        {stale && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            The mapping changed after this check, so it may not be what Replace would do. Check again before replacing.
          </p>
        )}

        <div className={stale ? "opacity-60" : ""}>
          <dl className={`mt-3 grid grid-cols-2 gap-2 ${anyAdded ? "sm:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-6"}`}>
            <Stat label="Added" value={summary.added} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
            <Stat label="Unchanged" value={summary.unchanged} tone={NEUTRAL} />
            <Stat label="Moved: other column" value={movedRows.length} tone="border-blue-200 bg-blue-50 text-blue-800" />
            <Stat label="Removed" value={removed.length} tone="border-rose-200 bg-rose-50 text-rose-800" />
            <Stat label="Kept: still in use" value={keptRows.length} tone="border-amber-200 bg-amber-50 text-amber-800" />
            <Stat label="Carried: always kept" value={summary.carried} tone={NEUTRAL} />
            {anyAdded && (
              <>
                <Stat label={`${hrTile([...addedKept, ...adopted])}: kept`} value={addedKept.length} tone={NEUTRAL} />
                <Stat label={`${hrTile([...addedKept, ...adopted])}: now listed`} value={adopted.length} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
              </>
            )}
          </dl>
          <p className="mt-2 text-[11px] text-slate-600">
            {nothingChanges
              ? anyAdded
                ? "The amended TDP adds, moves and removes no need."
                : "The amended TDP lists the same needs as the plan: no need is added or removed."
              : "Unchanged needs stay as they are, with Monitoring's marks and remarks."}
            {summary.carried > 0 && ` ${count(summary.carried, "need")} carried from an earlier year ${summary.carried === 1 ? "isn't" : "aren't"} part of any TDP, so ${summary.carried === 1 ? "it stays" : "they stay"}.`}
            {addedKept.length > 0 && ` ${hrNeeds(addedKept)} ${addedKept.length === 1 ? "isn't" : "aren't"} in it, so ${addedKept.length === 1 ? "it stays" : "they stay"}.`}
            {adopted.length > 0 && ` ${hrNeeds(adopted)} ${adopted.length === 1 ? "is" : "are"} listed by it for the same person, so ${adopted.length === 1 ? "it becomes a TDP need" : "they become TDP needs"}.`}
          </p>

          {added.length > 0 && (
            <div className="mt-3 space-y-1">
              <h5 className="text-[11px] font-bold text-emerald-800">Added ({added.length}): new in the amended TDP</h5>
              <NeedList caption={`Needs the amended TDP adds (${added.length})`} rows={added} />
            </div>
          )}
          {movedRows.length > 0 && (
            <div className="mt-3 space-y-1">
              <h5 className="text-[11px] font-bold text-blue-800">Moved to another column ({movedRows.length}): the same training for the same person, under the amended TDP's column; Monitoring's marks and remarks stay</h5>
              <NeedList caption={`Needs moved to another column (${movedRows.length})`} rows={movedRows} why="Moved from" />
            </div>
          )}
          {removed.length > 0 && (
            <div className="mt-3 space-y-1">
              <h5 className="text-[11px] font-bold text-rose-800">Removed ({removed.length}): not in the amended TDP, and nothing uses them</h5>
              <NeedList caption={`Needs the amended TDP removes (${removed.length})`} rows={removed} />
            </div>
          )}
          {keptRows.length > 0 && (
            <div className="mt-3 space-y-1">
              <h5 className="text-[11px] font-bold text-amber-800">Kept because still in use ({keptRows.length}): not in the amended TDP, but their person is seated for them on a seminar, or they were accomplished</h5>
              <NeedList caption={`Needs kept because still in use (${keptRows.length})`} rows={keptRows} why="Why it stays" />
            </div>
          )}
          {addedKept.length > 0 && (
            <div className="mt-3 space-y-1">
              <h5 className="text-[11px] font-bold text-slate-700">{hrHeading(addedKept)}, kept ({addedKept.length}): not in the amended TDP; a need HR added stays, as a carried one does</h5>
              <NeedList caption={`Needs ${lowerFirst(hrHeading(addedKept))}, kept (${addedKept.length})`} rows={addedKept} />
            </div>
          )}
          {adopted.length > 0 && (
            <div className="mt-3 space-y-1">
              <h5 className="text-[11px] font-bold text-emerald-800">{hrHeading(adopted)}, now in the amended TDP ({adopted.length}): it lists them for the same person, so they become TDP needs</h5>
              <NeedList caption={`Needs ${lowerFirst(hrHeading(adopted))}, now in the amended TDP (${adopted.length})`} rows={adopted} />
            </div>
          )}
          {outside.length > 0 && (
            <div data-tdp="outside" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  {outside.length === 1 ? "1 seminar" : `${outside.length} seminars`} would cover no training left in the plan, as nobody seated on{" "}
                  {outside.length === 1 ? "it" : "them"} keeps a need for {outside.length === 1 ? "it" : "them"}:
                </span>
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-[34px]">
                {outside.map(s => <li key={s.id} className="break-words">{s.title || "(a seminar with no title)"}</li>)}
              </ul>
              <p className="mt-1 pl-[21px]">
                {outside.length === 1 ? "It" : "They"} would read “Not in the TDP” in Programs &amp; Budget, and need {outside.length === 1 ? "its" : "their"} own
                justification there (Add why).
              </p>
            </div>
          )}
        </div>
      </section>

      {/* The confirmation, in the panel: what Replace does, said once more beside the button that does it. */}
      <section aria-labelledby={`${id}-confirm`} className="rounded-xl border border-amber-300 bg-amber-50 p-3 sm:p-4">
        <h4 id={`${id}-confirm`} className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
          <ShieldAlert size={14} aria-hidden="true" /> 4. Replace the FY {fiscalYear} TDP
        </h4>
        <p className="mt-1 text-[11px] leading-relaxed text-amber-900">
          <strong className="break-all">“{filename}”</strong> becomes the TDP in force:{" "}
          {count(summary.added, "need")} added{movedRows.length > 0 ? `, ${movedRows.length} moved to another column` : ""} and {removed.length} removed
          {keptRows.length > 0 ? `; ${keptRows.length} it leaves out ${keptRows.length === 1 ? "stays" : "stay"} because still in use` : ""}.
          {removed.length > 0 && " Removed needs leave Plan A and Monitoring."}
          {addedKept.length > 0 && ` ${hrNeeds(addedKept)} ${addedKept.length === 1 ? "stays" : "stay"}.`}
          {adopted.length > 0 && ` ${hrNeeds(adopted)} ${adopted.length === 1 ? "becomes" : "become"} the TDP's own.`}
          {outside.length > 0 && ` ${outside.length === 1 ? "1 seminar" : `${outside.length} seminars`} would then need ${outside.length === 1 ? "its" : "their"} own justification.`}{" "}
          The replacement is recorded in the audit log, and HR and the
          Administrator are notified. To change it later, upload another amended TDP.
        </p>
        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-tdp="confirm"
            onClick={onConfirm}
            disabled={stale || busy}
            aria-describedby={stale ? `${id}-stale` : undefined}
            className="cursor-pointer rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Replacing…" : "Replace the TDP"}
          </button>
        </div>
        {stale && <p id={`${id}-stale`} className="mt-2 text-right text-[11px] font-semibold text-amber-900">Check again first: the mapping changed.</p>}
      </section>
    </div>
  );
}
