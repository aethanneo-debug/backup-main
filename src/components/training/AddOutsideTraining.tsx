import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Info, ListChecks } from "lucide-react";
import { TRAINING_NEED_CATEGORIES, TRAINING_NEED_COLUMN_LABELS, type TdpTrainingChoice, type TrainingNeedCategory } from "../../types";
import { additionPairs, existingNeedFor, existingNeedText, NEED_ADDITION_TITLE_MAX, readOutsideTdpAddition, type NeedLike } from "../../tdpAdditions";
import { apiCall } from "../../utils";
import { manilaToday } from "../utilities/signatoryHelpers";
import { RequiredMark } from "../ui/RequiredMark";
import SeminarTdpFields, { seminarTdpControlId, seminarTdpRaw, seminarTdpValues, type SeminarTdpField, type SeminarTdpValues } from "./SeminarTdpFields";
import { columnsText, PROBLEM } from "./AddNeedParts";
import { capText, plural, RefusalBox, skippedGroups, SkippedList } from "./AddNeedSelection";
import { outsideProblemPart, outsideTitle, tdpChoiceFor, type OutsidePart } from "./outsideTraining";

// "Add Training Need", its second way (12ae, the user's request of 2026-11-09): a training the uploaded TDP doesn't list,
// such as one on a new law or a Central Office training. HR types the title, chooses its column and says why it is held,
// with the justification a seminar outside the TDP gives (12z Part C, SeminarTdpFields), for every ticked employee who
// doesn't have it yet. The need is marked "Outside the TDP" and never counts as a TDP need: the TDP doesn't identify its
// person by it, and a seminar for it is still held outside the TDP, its justification filled in from this one. A title
// the TDP lists goes in from the TDP's list instead. The dialog (AddTrainingNeedDialog.tsx) holds the employees; this
// holds the rest, checked with the server's own reader (readOutsideTdpAddition) as it is typed: Add waits until it passes.

interface Args {
  fiscalYear: string;
  /** The uploaded TDP's own trainings: a title among them goes in from the TDP's list instead. */
  choices: TdpTrainingChoice[];
  /** The ticked employees still on the list, in the order ticked. */
  employeeIds: string[];
  /** Each person's needs this year, every column, carried and added ones included (one need per training a year). */
  needsOf: Map<string, NeedLike[]>;
  nameOf: (employeeId: string) => string;
  /** After the server added it, with its own account of it. */
  onSaved: (message: string) => void;
  /** After a refusal: the page reloads the plan, so the preview shows it as it is now. */
  onRefused?: () => void;
}

/** The parts "Go to it" points to: what still keeps Add off once the employees and the title are there. */
const POINTED: OutsidePart[] = ["column", "kind", "reason", "name", "position", "referenceNo", "referenceDate"];
const isField = (part: OutsidePart | null): part is SeminarTdpField => !!part && part !== "employees" && part !== "title" && part !== "column";

export function useOutsideTraining({ fiscalYear, choices, employeeIds, needsOf, nameOf, onSaved, onRefused }: Args) {
  const base = useId();
  const ids = { base, title: `${base}-title`, columns: `${base}-outside-column`, why: `${base}-why`, problem: `${base}-problem`, preview: `${base}-preview` };
  const [typed, setTyped] = useState("");
  const [column, setColumn] = useState<TrainingNeedCategory | null>(null);
  const [values, setValues] = useState<SeminarTdpValues>(() => seminarTdpValues());
  // The part "Go to it" sent the focus to: its problem shows beside it until it is fixed.
  const [pointed, setPointed] = useState<OutsidePart | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // A refusal: Add was off while it was on its way, so the focus goes to the reason rather than the page.
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [focusError, setFocusError] = useState(0);
  useEffect(() => {
    if (focusError) errorRef.current?.focus();
  }, [focusError]);

  // The server's own reader, as it will read the save; Manila's day, as it checks a reference's date.
  const today = manilaToday();
  const { title, key } = outsideTitle(typed);
  // As the server's reader finds it: the typed text as typed, by either of its keys (a pasted soft hyphen included).
  const listed = tdpChoiceFor(typed, choices);
  const read = readOutsideTdpAddition({ employeeIds, title: typed, category: column, justification: seminarTdpRaw(values) }, { choices, today });
  const problem = "problem" in read ? read.problem : null;
  const part = problem ? outsideProblemPart(problem, values) : null;
  useEffect(() => {
    if (pointed && pointed !== part) setPointed(null);
  }, [pointed, part]);
  // What the save adds: the training for every ticked employee, less those who already have it (any column, carried and
  // earlier additions included), who are skipped and said. The column doesn't change who is skipped.
  const pairs = additionPairs(employeeIds, key && !listed ? [{ key, category: column ?? "Function", title }] : [], person => needsOf.get(person));

  function goTo(at: OutsidePart) {
    setPointed(at);
    const id = at === "column" ? `${base}-column-${Math.max(0, TRAINING_NEED_CATEGORIES.indexOf(column as TrainingNeedCategory))}`
      : isField(at) ? seminarTdpControlId(ids.why, at, values.kind)
      : at === "title" ? ids.title : "";
    if (id) document.getElementById(id)?.focus();
  }

  async function submit() {
    if (saving || !("value" in read) || pairs.add.length === 0) return;
    const { employeeIds: chosen, training, justification } = read.value;
    setError("");
    setSaving(true);
    try {
      const res = await apiCall("/api/training/needs/outside", {
        method: "POST",
        body: JSON.stringify({ fiscalYear, employeeIds: chosen, title: training.title, category: training.category, justification })
      });
      if (res?.status !== "success") throw new Error(res?.message || "The training couldn't be added.");
      onSaved(res.message || `Added “${training.title}” to the FY ${fiscalYear} plan, outside the TDP.`);
    } catch (err: any) {
      // E.g. everyone chosen already has it (another officer was quicker), or someone is no longer with the office.
      setSaving(false);
      setError(err?.message || "The training couldn't be added.");
      setFocusError(n => n + 1);
      onRefused?.();
    }
  }

  return {
    ids, typed, title, key, listed, column, values, today, saving, error, errorRef, problem, part,
    /** The part "Go to it" pointed to, while its problem is still the one in the way. */
    pointed: pointed && pointed === part ? pointed : null,
    employees: employeeIds.length,
    /** Over the most one save takes (50 employees), said as the TDP way says it; else null. */
    cap: capText(employeeIds.length, 1),
    add: pairs.add.length,
    skipped: skippedGroups(pairs.skip, nameOf, (_, stored) => stored),
    canAdd: !saving && !problem && pairs.add.length > 0,
    /** Something typed (the title, or any part of why it is held): closing would lose it, so the dialog asks first. */
    hasText: !!typed.trim() || Object.values(values).some(v => v.trim() !== ""),
    // A change makes the server's last refusal out of date.
    onTitle: (text: string) => { setTyped(text); setError(""); },
    onColumn: (c: TrainingNeedCategory) => { setColumn(c); setError(""); },
    onWhy: (patch: Partial<SeminarTdpValues>) => { setValues(v => ({ ...v, ...patch })); setError(""); },
    /** The typed training, as one employee's row says it: already in their plan, and where. */
    haveNote: (employeeId: string) => {
      const existing = key && !listed ? existingNeedFor(needsOf.get(employeeId), key) : null;
      return existing ? `Already has this training (${existingNeedText(existing)}).` : undefined;
    },
    goTo,
    /** Switching ways: the last refusal and pointer go; what was typed stays. */
    clear: () => { setError(""); setPointed(null); },
    submit
  };
}
export type OutsideTraining = ReturnType<typeof useOutsideTraining>;

const LABEL = "block text-[11px] font-semibold text-slate-700";
const INPUT = "w-full rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100";
const LINK = "cursor-pointer rounded font-semibold text-blue-700 underline hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

/** The right column: the training's title, the TDP training it turns out to be (with the way to the TDP's list), and
 * its column. */
export function OutsideTrainingPart({ o, onUseTdp }: { o: OutsideTraining; onUseTdp: (choice: TdpTrainingChoice) => void }) {
  const hintId = `${o.ids.title}-hint`;
  const inTdpId = `${o.ids.title}-in-tdp`;
  const columnHintId = `${o.ids.columns}-hint`;
  const columnProblem = o.pointed === "column" ? o.problem : null;
  return (
    <div data-outside="training" className="min-w-0 space-y-3">
      <div>
        <label htmlFor={o.ids.title} className={LABEL}>Training<RequiredMark /></label>
        <p id={hintId} className="text-[11px] text-slate-500">
          Its title as the plan, and a seminar for it, should read: e.g. the law&rsquo;s or the course&rsquo;s own name. One training a save.
        </p>
        <input
          id={o.ids.title}
          type="text"
          data-outside="title"
          value={o.typed}
          maxLength={NEED_ADDITION_TITLE_MAX}
          disabled={o.saving}
          autoComplete="off"
          aria-describedby={[hintId, o.listed ? inTdpId : ""].filter(Boolean).join(" ")}
          aria-invalid={!!o.listed || undefined}
          onChange={e => o.onTitle(e.target.value)}
          className={`${INPUT} mt-1 ${o.listed ? "border-amber-400" : "border-slate-300"}`}
        />
        <p className="mt-0.5 text-right text-[10px] tabular-nums text-slate-500" aria-hidden="true">{o.typed.length}/{NEED_ADDITION_TITLE_MAX}</p>
        {/* A title the TDP lists, said as it is typed, with the way to its list: added from there, it is a TDP need. */}
        <div aria-live="polite">
          {o.listed && (
            <div id={inTdpId} data-outside="in-tdp" className="mt-1 space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              <p className="flex items-start gap-2">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  &ldquo;{o.listed.title}&rdquo; is in the uploaded TDP, under {columnsText(o.listed.categories)}. Add it from the TDP&rsquo;s own
                  list, where it counts as a TDP need.
                </span>
              </p>
              <button type="button" data-outside="to-tdp" onClick={() => onUseTdp(o.listed!)} disabled={o.saving} className={`${LINK} ml-[21px]`}>
                Tick it in the TDP&rsquo;s list
              </button>
            </div>
          )}
        </div>
      </div>
      <fieldset aria-describedby={[columnHintId, columnProblem ? o.ids.problem : ""].filter(Boolean).join(" ")}>
        <legend className={LABEL}>Column<RequiredMark /></legend>
        <p id={columnHintId} className="text-[11px] text-slate-500">The official form&rsquo;s column it goes under, for every ticked employee.</p>
        <div className="mt-1 space-y-1">
          {TRAINING_NEED_CATEGORIES.map((c, i) => (
            <label key={c} className="flex cursor-pointer items-start gap-2 text-xs text-slate-800">
              <input
                type="radio"
                id={`${o.ids.base}-column-${i}`}
                name={o.ids.columns}
                value={c}
                className="mt-0.5 shrink-0 accent-blue-600"
                checked={o.column === c}
                disabled={o.saving}
                onChange={() => o.onColumn(c)}
              />
              <span className="min-w-0">{TRAINING_NEED_COLUMN_LABELS[c]}</span>
            </label>
          ))}
        </div>
        {columnProblem && <p id={o.ids.problem} role="alert" className={PROBLEM}>{columnProblem}</p>}
      </fieldset>
    </div>
  );
}

/** Below the lists: why it is held (the justification a seminar outside the TDP gives), what the save will do, and the
 * server's refusal, with what was ticked and typed still there. */
export function OutsideBelow({ o }: { o: OutsideTraining }) {
  const field = isField(o.pointed) ? o.pointed : null;
  return (
    <>
      <section data-outside="justification" aria-labelledby={`${o.ids.why}-heading`} className="space-y-3 rounded-lg border border-slate-200 p-3">
        <div>
          <h3 id={`${o.ids.why}-heading`} className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Justification</h3>
          <p className="text-[11px] text-slate-500">The one a seminar held outside the TDP gives: a seminar for this training starts its own from it.</p>
        </div>
        <SeminarTdpFields
          id={o.ids.why}
          values={o.values}
          onChange={o.onWhy}
          today={o.today}
          disabled={o.saving}
          markRequired
          problem={field && o.problem ? { field, id: o.ids.problem, text: o.problem } : null}
        />
        <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
          <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          HR and the Administrator are told; the reason stays out of the audit log.
        </p>
      </section>
      <OutsidePreview o={o} />
      <RefusalBox text={o.error} boxRef={o.errorRef} />
    </>
  );
}

/** What the save will do, above the footer: the training for how many employees, who is skipped and why, and what still
 * keeps Add off, with the way to it. */
function OutsidePreview({ o }: { o: OutsideTraining }) {
  const column = o.column ? TRAINING_NEED_COLUMN_LABELS[o.column] : "";
  const ready = o.employees > 0 && !!o.key && !o.listed && o.add > 0;
  const headline =
    o.employees === 0 && !o.key ? "Nothing yet: tick at least one employee, and type the training."
    : o.employees === 0 ? "Tick at least one employee: each gets this training."
    : !o.key ? `Type the training's title, up to ${NEED_ADDITION_TITLE_MAX} characters: each of the ${plural(o.employees, "ticked employee")} gets it.`
    : o.listed ? `“${o.listed.title}” is in the uploaded TDP: tick it in the TDP’s list instead.`
    : o.add === 0 ? `Nothing to add: every ticked employee already has “${o.title}”.`
    : `Adds “${o.title}”${column ? ` under “${column}”` : ""} to ${o.add === 1 ? "the plan of 1 employee" : `the plans of ${plural(o.add, "employee")}`}, marked Outside the TDP.`;
  // Once there is something to add: the column, or a part of the justification, still missing.
  const still = ready && o.problem && o.part && POINTED.includes(o.part) ? o.problem : null;
  return (
    <section data-outside="preview" aria-labelledby={`${o.ids.preview}-heading`} className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <h3 id={`${o.ids.preview}-heading`} className="text-[11px] font-bold uppercase tracking-wider text-slate-600">This save</h3>
      <p
        id={`${o.ids.preview}-count`}
        data-outside="preview-count"
        className={`flex items-start gap-2 text-xs font-semibold ${ready ? "text-slate-800" : o.employees > 0 && o.key ? "text-amber-800" : "text-slate-500"}`}
      >
        <ListChecks size={14} className={`mt-0.5 shrink-0 ${ready ? "text-blue-600" : ""}`} aria-hidden="true" />
        <span className="min-w-0 break-words">{headline}</span>
      </p>
      {still && (
        <p id={`${o.ids.preview}-still`} data-outside="still-needed" className="flex flex-wrap items-start gap-x-2 gap-y-1 pl-[22px] text-[11px] font-semibold text-amber-800">
          <span className="min-w-0 break-words">Still needed: {still}</span>
          <button type="button" onClick={() => o.goTo(o.part!)} className={LINK}>Go to it</button>
        </p>
      )}
      {/* More employees ticked than one save takes: what keeps Add off, as the TDP way says it. */}
      {o.cap && (
        <p id={`${o.ids.preview}-cap`} data-outside="preview-cap" className="flex items-start gap-2 text-[11px] font-semibold text-rose-700">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{o.cap}</span>
        </p>
      )}
      <SkippedList skipped={o.skipped} trainings={1} listProps={{ "data-outside": "skipped" }} />
    </section>
  );
}

/** The footer's button for this way: it waits until the server's own reader passes the form. */
export function OutsideSubmit({ o, className }: { o: OutsideTraining; className: string }) {
  return (
    <button
      type="button"
      data-outside="submit"
      onClick={() => { void o.submit(); }}
      disabled={!o.canAdd}
      // What the save does and what still keeps it off; not the list of skips, which can be long.
      aria-describedby={`${o.ids.preview}-count ${o.ids.preview}-still ${o.ids.preview}-cap`}
      className={className}
    >
      {o.saving ? "Adding…" : "Add training outside the TDP"}
    </button>
  );
}
