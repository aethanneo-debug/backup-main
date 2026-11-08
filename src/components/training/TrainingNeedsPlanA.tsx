import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, History, Loader2 } from "lucide-react";
import { PlanAImportResult, TdpTrainingChoice, TdpUpload, TrainingNeedRow, TrainingPlanOffice } from "../../types";
import { apiCall } from "../../utils";
import PlanAImportPanel from "./import/PlanAImportPanel";
import MandatedTrainingsPanel from "./MandatedTrainingsPanel";
import TdpStatusBar from "./TdpStatusBar";
import TdpPlanWindow from "./TdpPlanWindow";
import AddTrainingNeedDialog from "./AddTrainingNeedDialog";
import { addedChangesText, count } from "./tdpText";

// Training Needs (step 1): the year's TDP. HR uploads the RAB-1 workbook once a year (the instructor's review, R9),
// and Plan A, what each employee still needs, comes from it. Until then the upload panel shows; once it is in, a bar
// says which file, when and by whom, with Plan A behind "View uploaded TDP" (read-only) and "Replace with an amended
// TDP", the only way the TDP's own needs change (the server refuses renaming or removing one). "Add Training Need"
// gives someone the TDP doesn't list one of its trainings (12ad: a new hire, a new designation). Needs carried in unmet
// from an earlier year are in the plan either way, apart from the TDP, and so are those added after it.
type Message = { tone: "success" | "warning"; text: string; detail?: string };
type FocusTarget = "bar" | "replace" | "panel" | "upload" | "add";

const REPLACE_PANEL = "tdp-replace-panel";

const MESSAGE_TONE: Record<Message["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900"
};

/** What the first upload did, as the bar will count it. */
function uploadedMessage(result: PlanAImportResult, fiscalYear: string): Message {
  const needs = result.tdp?.needs ?? result.imported;
  const employees = result.tdp?.employees ?? (result.perEmployee ?? []).length;
  const skipped = [
    result.skippedRows > 0 ? `${count(result.skippedRows, "row")} skipped` : "",
    result.skippedAlreadyInPlan > 0 ? `${result.skippedAlreadyInPlan} already in the plan` : "",
    result.skippedDuplicateInFile > 0 ? `${result.skippedDuplicateInFile} duplicated in the workbook` : ""
  ].filter(Boolean);
  return {
    tone: "success",
    text: `The FY ${result.fiscalYear || fiscalYear} TDP is uploaded: ${count(needs, "need")} for ${count(employees, "employee")}.`,
    detail: skipped.length ? `${skipped.join(", ")}.` : undefined
  };
}

/** What a replacement did: the server's own counts. */
function replacedMessage(result: PlanAImportResult, fiscalYear: string): Message {
  const changes = result.tdp?.changes ?? {
    added: result.replace?.added ?? result.imported,
    removed: (result.replace?.removed ?? []).length,
    kept: (result.replace?.kept ?? []).length,
    moved: (result.replace?.moved ?? []).length
  };
  const file = result.tdp?.filename ? ` with “${result.tdp.filename}”` : "";
  const moved = changes.moved > 0 ? `${changes.moved} moved to another column, ` : "";
  // What it did to the needs HR had added after the TDP (12ad), when there were any.
  const addedNote = addedChangesText(result.tdp?.changes ?? {
    addedKept: (result.replace?.addedKept ?? []).length,
    adopted: (result.replace?.adopted ?? []).length
  });
  const now = result.tdp ? `It now lists ${count(result.tdp.needs, "need")} for ${count(result.tdp.employees, "employee")}.` : "";
  return {
    tone: "success",
    text: `The FY ${result.fiscalYear || fiscalYear} TDP is replaced${file}: ${count(changes.added, "need")} added, ${moved}${changes.removed} removed, ${changes.kept} kept because still in use.`,
    detail: [now, addedNote].filter(Boolean).join(" ") || undefined
  };
}

/** HR and the Administrator plan trainings (`canPlan`, the server checks again): "Add Training Need" is theirs. */
export default function TrainingNeedsPlanA({ onChanged, canPlan = false }: { onChanged?: () => void; canPlan?: boolean }) {
  const [offices, setOffices] = useState<TrainingPlanOffice[]>([]);
  const [fiscalYear, setFiscalYear] = useState("");
  const [tdp, setTdp] = useState<TdpUpload | null>(null);
  const [carried, setCarried] = useState(0);
  // Needs added after the TDP this year, and the TDP's own trainings "Add Training Need" offers (12ad).
  const [added, setAdded] = useState(0);
  const [choices, setChoices] = useState<TdpTrainingChoice[]>([]);
  // The TDP's own list, or the year's plan for a TDP uploaded before its list was kept: the dialog says which.
  const [choicesFrom, setChoicesFrom] = useState<"tdp" | "plan" | null>(null);
  // The fiscal year the dialog opened on, or null while it is closed. A reload that brings another year (a new fiscal
  // year opened meanwhile) closes it and says nothing was added, so it can never send to a year HR didn't see.
  const [adding, setAdding] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // A quiet reload that failed: the screen stays as it was, with Retry.
  const [reloadError, setReloadError] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [focusTo, setFocusTo] = useState<FocusTarget | null>(null);
  const loads = useRef(0);
  const barHeading = useRef<HTMLHeadingElement>(null);
  const replaceButton = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const uploadHeading = useRef<HTMLHeadingElement>(null);
  // Everyone still with the office, needs or not, in the plan's order: who a need can be added for.
  const employees = useMemo(() => (offices ?? []).flatMap(o => o.employees ?? []), [offices]);

  // `quiet`: refresh in place, without the spinner, so the panels stay mounted and keep their messages (the mandated
  // trainings' "… is marked as mandated.", a replacement's refusal). The newest load answers for the screen.
  async function load(quiet = false) {
    const mine = ++loads.current;
    if (!quiet) setLoading(true);
    try {
      const res = await apiCall("/api/training/needs");
      if (mine !== loads.current) return;
      if (res.status !== "success") throw new Error(res.message || "Unable to load the plan.");
      setOffices(res.data?.offices ?? []);
      setFiscalYear(res.data?.fiscalYear ?? "");
      setTdp(res.data?.tdp ?? null);
      setCarried(Number(res.data?.carried) || 0);
      setAdded(Number(res.data?.added) || 0);
      setChoices(Array.isArray(res.data?.choices) ? res.data.choices : []);
      setChoicesFrom(res.data?.choicesFrom === "plan" || res.data?.choicesFrom === "tdp" ? res.data.choicesFrom : null);
      setError("");
      setReloadError("");
    } catch (err: any) {
      if (mine !== loads.current) return;
      if (quiet) setReloadError(err?.message || "Unable to load the plan.");
      else setError(err?.message || "Unable to load the plan.");
    } finally {
      if (mine === loads.current) setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // The dialog belongs to the year it opened on: once a reload brings another one, or no TDP, it closes and the page says
  // nothing was added (a refusal's reload is what brings it: "The 2028 plan is closed …").
  useEffect(() => {
    if (adding === null || (adding === fiscalYear && tdp)) return;
    setAdding(null);
    setMessage({
      tone: "warning",
      text: adding !== fiscalYear
        ? `The active fiscal year is now FY ${fiscalYear}: nothing was added to the FY ${adding} plan.`
        : `The FY ${adding} TDP is no longer in force: nothing was added.`
    });
    setFocusTo(tdp ? "add" : "upload");
  }, [adding, fiscalYear, tdp]);

  // A control that only exists after the next render (the bar after an upload, the panel once opened) takes the focus
  // when it arrives.
  useEffect(() => {
    if (!focusTo) return;
    const el = focusTo === "bar" ? barHeading.current : focusTo === "replace" ? replaceButton.current
      : focusTo === "add" ? addButton.current : focusTo === "upload" ? uploadHeading.current : panelHeading.current;
    if (!el) return;
    el.focus();
    setFocusTo(null);
  }, [focusTo, tdp, replacing, loading]);

  function handleImported(result: PlanAImportResult) {
    const replaced = !!result.replace || result.tdp?.kind === "replace";
    setReplacing(false);
    setMessage(replaced ? replacedMessage(result, fiscalYear) : uploadedMessage(result, fiscalYear));
    setFocusTo("bar");
    load(true);
    onChanged?.();
  }

  // Refused, e.g. because another officer uploaded the TDP meanwhile (409): the plan is reloaded, so the bar shows the
  // TDP in force. A first upload's panel goes once it does, so its message is shown here; a replacement shows its own.
  function handleRefused(text: string, status?: number) {
    if (!tdp && status === 409 && text) setMessage({ tone: "warning", text });
    load(true);
  }

  // A need carried in from an earlier year, or one HR added after the TDP, is no TDP's, so these are what Plan A lets HR
  // take out while they aren't in use (the user's decisions of 2026-11-02 and 2026-11-08; the server refuses any
  // other). The window shows what came of it.
  async function removeNeed(need: TrainingNeedRow): Promise<{ problem: string } | { outside: string[] }> {
    try {
      const res = await apiCall(`/api/training/needs/${encodeURIComponent(need.id)}`, { method: "DELETE" });
      if (res.status !== "success") return { problem: res.message || "That need couldn't be removed." };
      // The seminars it was the last need in the plan for, which now need their own justification (12z Part C).
      const outside = (Array.isArray(res.data?.seminarsOutside) ? res.data.seminarsOutside : [])
        .map((s: any) => (typeof s?.title === "string" ? s.title : "")).filter(Boolean);
      await load(true);
      onChanged?.();
      return { outside };
    } catch (err: any) {
      return { problem: err?.message || "That need couldn't be removed." };
    }
  }

  function openReplace() {
    setMessage(null);
    setReplacing(true);
    setFocusTo("panel");
  }

  // Added (12ad): the dialog closes on the server's own words, and the plan reloads in place, so the bar's count and the
  // window follow without a page refresh.
  function handleAdded(text: string) {
    setAdding(null);
    setMessage({ tone: "success", text });
    setFocusTo("add");
    load(true);
    onChanged?.();
  }

  function closeReplace() {
    setReplacing(false);
    setFocusTo("replace");
  }

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 text-sm text-slate-500 py-16">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading the Training and Development Plan…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-start justify-between gap-3">
        <span className="flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />{error}</span>
        <button onClick={() => load()} className="font-semibold underline shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">Training and Development Plan, FY {fiscalYear}</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          HR uploads the year's TDP once, from the RAB-1 workbook. Plan A, what each employee still needs, comes from it; its
          needs change only through an amended TDP, and <strong>Add Training Need</strong> gives someone it doesn&rsquo;t list (a new
          hire, a new designation) one of its trainings. Seminars they attend are checked off in <strong>Monitoring</strong>.
        </p>
      </div>

      {tdp ? (
        <TdpStatusBar
          tdp={tdp}
          carried={carried}
          added={added}
          replacing={replacing}
          replacePanelId={REPLACE_PANEL}
          onView={() => setViewing(true)}
          onReplace={() => (replacing ? panelHeading.current?.focus() : openReplace())}
          canPlan={canPlan}
          onAdd={() => { setMessage(null); setAdding(fiscalYear); }}
          headingRef={barHeading}
          replaceRef={replaceButton}
          addRef={addButton}
        />
      ) : (
        <>
          {carried > 0 && (
            <p data-tdp="carried" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <History size={14} className="shrink-0 text-amber-600" aria-hidden="true" />
              <span>
                {count(carried, "need")} carried in unmet from an earlier year {carried === 1 ? "is" : "are"} already in the FY {fiscalYear} plan.
                {carried === 1 ? " It isn't" : " They aren't"} part of the TDP, and {carried === 1 ? "stays" : "stay"} when it is uploaded.
              </span>
              <button
                type="button"
                data-tdp="view-carried"
                onClick={() => setViewing(true)}
                className="cursor-pointer rounded font-semibold text-blue-700 underline hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                View {carried === 1 ? "it" : "them"}
              </button>
            </p>
          )}
          {/* Reading the official workbook instead of retyping it: once a year. */}
          <PlanAImportPanel fiscalYear={fiscalYear} mode="upload" onImported={handleImported} onRefused={handleRefused} headingRef={uploadHeading} />
        </>
      )}

      <div role="status" aria-live="polite" data-tdp="message">
        {message && (
          <div className={`rounded-lg border px-3 py-2 text-xs ${MESSAGE_TONE[message.tone]}`}>
            <p className="flex items-start gap-2 font-semibold">
              {message.tone === "success"
                ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                : <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />}
              <span className="min-w-0 break-words">{message.text}</span>
            </p>
            {message.detail && <p className="mt-0.5 pl-[22px] text-[11px]">{message.detail}</p>}
          </div>
        )}
      </div>

      {reloadError && (
        <p role="alert" className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span className="flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />The plan couldn't be reloaded: {reloadError}</span>
          <button type="button" onClick={() => load(true)} className="shrink-0 rounded font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">Retry</button>
        </p>
      )}

      {tdp && replacing && (
        <PlanAImportPanel
          id={REPLACE_PANEL}
          fiscalYear={fiscalYear}
          mode="replace"
          current={tdp}
          onImported={handleImported}
          onRefused={handleRefused}
          onClose={closeReplace}
          headingRef={panelHeading}
        />
      )}

      {/* Which trainings the law requires (HSAC RAB 1's step 5): they come first everywhere else. */}
      <MandatedTrainingsPanel fiscalYear={fiscalYear} onChanged={() => { load(true); onChanged?.(); }} />

      {viewing && (
        <TdpPlanWindow
          fiscalYear={fiscalYear}
          offices={offices}
          tdp={tdp}
          onClose={() => {
            setViewing(false);
            // The last carried need removed takes "View them" with it: the focus goes to the upload instead.
            if (!tdp && carried === 0) setFocusTo("upload");
          }}
          onRemoveNeed={removeNeed}
        />
      )}

      {/* One of the TDP's own trainings for someone it doesn't list (12ad). A refusal reloads the plan, so the dialog's
          lists show it as the server has it now (e.g. another officer added the same need meanwhile). Only on the year it
          opened on (see the effect above). */}
      {adding !== null && adding === fiscalYear && tdp && canPlan && (
        <AddTrainingNeedDialog
          fiscalYear={adding}
          employees={employees}
          choices={choices}
          choicesFrom={choicesFrom}
          onClose={() => setAdding(null)}
          onSaved={handleAdded}
          onRefused={() => load(true)}
        />
      )}
    </div>
  );
}
