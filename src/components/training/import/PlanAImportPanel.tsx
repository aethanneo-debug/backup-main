import { Ref, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { PlanAImportAssignment, PlanAImportPreview, PlanAImportResult, TdpReplaceSummary as Summary, TdpUpload } from "../../../types";
import { apiCall, apiErrorCode, type ApiError } from "../../../utils";
import PlanAImportPreviewTable from "./PlanAImportPreview";
import TdpReplaceSummary from "./TdpReplaceSummary";

export type PlanAImportMode = "upload" | "replace";

interface Props {
  /** The plan year being edited; the destination for everything imported. */
  fiscalYear: string;
  /** "upload": the year's first TDP. "replace": an amended TDP in place of the one in force (the instructor's
   * review, R9), checked first by a dry run that says what it adds, removes and keeps. */
  mode?: PlanAImportMode;
  /** Replace mode: the TDP in force, named in the steps. */
  current?: TdpUpload | null;
  /** Called after a successful commit, with what the server did. */
  onImported: (result: PlanAImportResult) => void;
  /** The server refused the commit (or, in replace mode, its check): the plan may have changed meanwhile. */
  onRefused?: (message: string, status?: number) => void;
  /** Replace mode: closes the steps (Cancel). */
  onClose?: () => void;
  id?: string;
  headingRef?: Ref<HTMLHeadingElement>;
}

type Stage = "idle" | "reading" | "previewing" | "committing";

/** "2 added, 3 removed, 0 kept because still in use, 461 unchanged." (and how many moved to another column, and what
 * happens to needs HR added after the TDP, if any: 12ad) */
const countsText = (s: Summary) => {
  const addedKept = (s.addedKept ?? []).length;
  const adopted = (s.adopted ?? []).length;
  return `${s.added} added, ${(s.moved ?? []).length > 0 ? `${(s.moved ?? []).length} moved to another column, ` : ""}${(s.removed ?? []).length} removed, ` +
    `${(s.kept ?? []).length} kept because still in use, ${s.unchanged} unchanged` +
    `${addedKept > 0 ? `; of those added after the TDP, ${addedKept} kept` : ""}` +
    `${adopted > 0 ? `${addedKept > 0 ? " and" : "; of those added after the TDP,"} ${adopted} now in the amended TDP` : ""}.`;
};

const REPLACE_STEPS = ["Upload the amended TDP", "Map its rows", "Check what changes", "Replace"];

/**
 * Uploading the official RAB-1 workbook into Plan A.
 *
 * Deliberately two steps. Of the 15 people the 2026 sheet names, only a couple usually
 * match an employee record, so importing blind would attach hundreds of needs to nobody.
 * The preview reads the file and writes nothing; HR maps or skips each row; only the
 * confirm writes.
 *
 * Replacing the TDP adds a step: a dry run of the commit (`dryRun`), whose summary names what would be removed and
 * what is kept because still in use. It belongs to the mapping it was run with: change a row or the sheet and it is
 * out of date, and Replace waits for a fresh check. Replace sends the check's `fingerprint` back, so what HR confirmed
 * is what happens: if the plan changed since (another officer's replacement, a seminar, a Monitoring mark), the server
 * refuses with what it would do now (409 TDP_CHANGED), which takes the old summary's place and is confirmed afresh.
 */
export default function PlanAImportPanel({ fiscalYear, mode = "upload", current, onImported, onRefused, onClose, id, headingRef }: Props) {
  const replacing = mode === "replace";
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PlanAImportPreview | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [dragging, setDragging] = useState(false);
  // Replace mode: the dry run's answer, with the mapping it was run with and its fingerprint (sent back with Replace).
  // `changed`: the server's answer to a Replace refused because the plan changed since, with the counts it replaced.
  const [check, setCheck] = useState<{ key: string; summary: Summary; fingerprint?: string; changed?: { message: string; was: Summary } } | null>(null);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState("");
  // Kept so the commit can re-send the same bytes the preview read.
  const fileRef = useRef<{ base64: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(false);
  const [focusSummary, setFocusSummary] = useState(0);
  // A refused replacement: the steps' table and summary went while it was on its way, so the focus is put on the
  // reason rather than left to fall to the page.
  const [focusError, setFocusError] = useState(0);
  useEffect(() => {
    if (focusError) errorRef.current?.focus();
  }, [focusError]);

  // A check's answer (or the plan's change since) is brought to the top, its heading taking the focus, so the counts
  // are on screen rather than below the mapping.
  useEffect(() => {
    const heading = summaryRef.current;
    if (!focusSummary || !heading) return;
    heading.closest("section")?.scrollIntoView({ block: "start" });
    heading.focus({ preventScroll: true });
  }, [focusSummary]);

  function reset() {
    setStage("idle");
    setError("");
    setPreview(null);
    setAssignments({});
    setCheck(null);
    setStatus("");
    fileRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }

  async function runPreview(base64: string, name: string, sheetName?: string) {
    setStage("reading");
    setError("");
    setCheck(null);
    setStatus("");
    try {
      const res = await apiCall("/api/training/needs/import/preview", {
        method: "POST",
        body: JSON.stringify({ base64Data: base64, filename: name, fiscalYear, sheetName })
      });
      if (res.status !== "success") throw new Error(res.message || "That workbook could not be read.");
      const data: PlanAImportPreview = res.data;
      setPreview(data);
      // Pre-select the exact matches; everything else starts as "skip" so a row is only
      // imported because someone chose to.
      const next: Record<string, string | null> = {};
      for (const b of data.blocks ?? []) next[b.key] = b.match ? b.match.employeeId : null;
      setAssignments(next);
      setStage("previewing");
    } catch (err: any) {
      // apiCall throws on a non-2xx, so the server's message only surfaces here.
      setError(err.message || "That workbook could not be read.");
      setStage("idle");
      fileRef.current = null;
    }
  }

  function takeFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Please choose the .xlsx workbook — not a PDF, a CSV, or an older .xls.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("That file is too large. The Plan A workbook should be well under 20 MB.");
      return;
    }
    setStage("reading");
    const reader = new FileReader();
    reader.onerror = () => { setError("That file could not be read from your computer."); setStage("idle"); };
    reader.onload = e => {
      // readAsDataURL gives "data:...;base64,XXXX" — the server wants the bare payload.
      const base64 = String(e.target?.result || "").split(",")[1] || "";
      fileRef.current = { base64, name: file.name };
      runPreview(base64, file.name);
    };
    reader.readAsDataURL(file);
  }

  const assignmentList = (): PlanAImportAssignment[] =>
    (preview?.blocks ?? []).map(b => ({ key: b.key, workbookName: b.workbookName, employeeId: assignments[b.key] ?? null }));
  // What a check belongs to: the file, the sheet and every row's choice.
  const keyOf = (list: PlanAImportAssignment[]) =>
    JSON.stringify([preview?.fileDigest ?? "", preview?.selectedSheet ?? "", list.map(a => [a.key, a.employeeId])]);
  const commitBody = (list: PlanAImportAssignment[]) => ({
    base64Data: fileRef.current?.base64,
    filename: fileRef.current?.name,
    fileDigest: preview?.fileDigest,
    sheetName: preview?.selectedSheet,
    fiscalYear: preview?.fiscalYear,
    assignments: list
  });
  const fresh = !!check && !!preview && check.key === keyOf(assignmentList());

  /** Replace mode, step 3: what the amended TDP would add, remove and keep. The server's dry run changes nothing. */
  async function runCheck() {
    if (!preview || !fileRef.current || inFlight.current) return;
    const list = assignmentList();
    if (!list.some(a => a.employeeId)) return;
    const key = keyOf(list);
    inFlight.current = true;
    setChecking(true);
    setError("");
    setStatus("Checking what the amended TDP changes…");
    try {
      const res = await apiCall("/api/training/needs/import/commit", {
        method: "POST",
        body: JSON.stringify({ ...commitBody(list), replace: true, dryRun: true })
      });
      const summary: Summary | undefined = res?.data?.replace;
      if (res.status !== "success" || !summary) throw new Error(res.message || "The check could not be completed.");
      const fingerprint = typeof res.data?.fingerprint === "string" ? res.data.fingerprint : undefined;
      setCheck({ key, summary, fingerprint });
      setStatus(`Checked: ${countsText(summary)} Nothing is saved yet.`);
      setFocusSummary(n => n + 1);
    } catch (err: any) {
      const e = err as ApiError;
      setCheck(null);
      setStatus("");
      setError(e?.message || "The check could not be completed.");
      if (e?.status === 409) onRefused?.(e.message, e.status);
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }

  async function commit() {
    if (!preview || !fileRef.current || inFlight.current) return;
    const list = assignmentList();
    const mapped = list.filter(a => a.employeeId).length;
    if (mapped === 0) return;
    // The first upload asks here, as it always has. A replacement was confirmed in its own step, on a fresh check.
    if (replacing) {
      if (!fresh) return;
    } else if (!confirm(`Import training needs for ${mapped} employee${mapped === 1 ? "" : "s"} into the CY ${preview.fiscalYear} plan?\n\nRows left on "Skip" are not imported.`)) {
      return;
    }

    // The check Replace was confirmed on: what the server compares the plan against.
    const confirmed = replacing ? check : null;
    inFlight.current = true;
    setStage("committing");
    setError("");
    setStatus(replacing ? "Replacing the TDP…" : "Adding the training needs…");
    try {
      const res = await apiCall("/api/training/needs/import/commit", {
        method: "POST",
        body: JSON.stringify({ ...commitBody(list), ...(replacing ? { replace: true, fingerprint: confirmed?.fingerprint } : {}) })
      });
      if (res.status !== "success") throw new Error(res.message || "The import could not be completed.");
      setStatus("");
      onImported(res.data as PlanAImportResult);
      reset();
    } catch (err: any) {
      const e = err as ApiError;
      const now = e?.data && typeof e.data === "object" ? (e.data as { replace?: Summary; fingerprint?: unknown }) : null;
      setStatus("");
      if (replacing && confirmed && apiErrorCode(err) === "TDP_CHANGED" && now?.replace) {
        // The plan changed since the check: what the amended TDP does now takes the old summary's place, and Replace
        // waits for HR to confirm it. Nothing is sent again by itself.
        setError("");
        setCheck({
          key: keyOf(list),
          summary: now.replace,
          fingerprint: typeof now.fingerprint === "string" ? now.fingerprint : undefined,
          changed: { message: e.message, was: confirmed.summary }
        });
        setStatus(`${e.message} ${countsText(now.replace)}`);
        setFocusSummary(n => n + 1);
      } else {
        setError(e?.message || "The import could not be completed.");
        // The plan may have changed meanwhile, so the check no longer stands: it has to be run again.
        setCheck(null);
        if (replacing) setFocusError(n => n + 1);
      }
      setStage("previewing");
      onRefused?.(e?.message || "", e?.status);
    } finally {
      inFlight.current = false;
    }
  }

  // Replace mode: where the steps are.
  const step = stage === "idle" || stage === "reading" ? 1 : stage === "committing" ? 4 : checking ? 3 : fresh ? 4 : 2;
  const busy = checking || stage === "committing";

  return (
    <section
      id={id}
      data-tdp-panel={mode}
      aria-labelledby={id ? `${id}-title` : undefined}
      className="mb-4 overflow-hidden rounded-xl border border-slate-200 border-t-2 border-t-blue-600 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h3
          id={id ? `${id}-title` : undefined}
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-700 focus:outline-none"
        >
          <FileSpreadsheet size={12} className="text-blue-600" aria-hidden="true" />
          {replacing ? `Replace the FY ${fiscalYear} TDP with an amended one` : "Import the official workbook"}
        </h3>
        <span className="flex items-center gap-2">
          {preview && (
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Nothing is saved until you confirm
            </span>
          )}
          {replacing && onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close the replace steps"
              className="cursor-pointer rounded-lg p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>

      <div className="space-y-3 p-4">
        {replacing && (
          <ol aria-label="Steps" className="flex flex-wrap gap-x-4 gap-y-1.5">
            {REPLACE_STEPS.map((label, i) => {
              const n = i + 1;
              const done = step > n;
              return (
                <li
                  key={label}
                  aria-current={step === n ? "step" : undefined}
                  className={`flex items-center gap-1.5 text-[11px] font-semibold ${step === n ? "text-blue-700" : done ? "text-emerald-700" : "text-slate-500"}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                      step === n ? "bg-blue-600 text-white" : done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                    }`}
                    aria-hidden="true"
                  >
                    {done ? <Check size={10} strokeWidth={3} /> : n}
                  </span>
                  {label}
                  {done && <span className="sr-only"> (done)</span>}
                </li>
              );
            })}
          </ol>
        )}

        {error && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 focus:outline-none">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {/* What is happening, read out as it changes: reading, checking, the check's counts, replacing. */}
        <div role="status" aria-live="polite" data-tdp="status">
          {(stage === "reading" || stage === "committing") ? (
            <p className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {stage === "reading" ? "Reading the workbook…" : status}
            </p>
          ) : checking ? (
            <p className="flex items-center gap-2 text-[11px] text-slate-600">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" /> {status}
            </p>
          ) : check && fresh && status ? (
            <p className="sr-only">{status}</p>
          ) : check && !fresh ? (
            <p className="sr-only">The mapping changed since the check: check again before replacing.</p>
          ) : null}
        </div>

        {stage === "idle" && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files?.[0]); }}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragging ? "border-blue-500 bg-blue-50/50" : "border-slate-300 bg-slate-50"
            }`}
          >
            <Upload size={26} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-700">
              {replacing ? "Upload the amended TDP (.xlsx)" : "Upload the RAB-1 Training and Development Plan (.xlsx)"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-[11px] leading-snug text-slate-500">
              {replacing ? (
                <>
                  It replaces {current?.filename ? <strong className="break-all font-semibold text-slate-700">“{current.filename}”</strong> : "the TDP"}, in
                  force for FY {fiscalYear}. You map its rows, then see exactly what it adds, removes and keeps before anything is saved.
                </>
              ) : (
                <>
                  Plan A is read from the workbook and shown to you first. You choose which employee
                  each row belongs to before anything is added to the plan.
                </>
              )}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              data-tdp="file"
              onChange={e => takeFile(e.target.files?.[0])}
            />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
              >
                Choose file
              </button>
              {replacing && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {stage === "previewing" && preview && (
          <PlanAImportPreviewTable
            preview={preview}
            assignments={assignments}
            mode={mode}
            confirmLabel={replacing ? (check ? "Check again" : "Check what changes") : undefined}
            confirmSecondary={replacing && fresh}
            busy={checking}
            onAssign={(key, employeeId) => setAssignments(prev => ({ ...prev, [key]: employeeId }))}
            onSheetChange={name => fileRef.current && runPreview(fileRef.current.base64, fileRef.current.name, name)}
            onCancel={replacing && onClose ? onClose : reset}
            onConfirm={replacing ? runCheck : commit}
          />
        )}

        {replacing && stage === "previewing" && check && (
          <TdpReplaceSummary
            summary={check.summary}
            stale={!fresh}
            changed={check.changed && { message: check.changed.message, was: countsText(check.changed.was) }}
            filename={fileRef.current?.name || preview?.filename || ""}
            fiscalYear={fiscalYear}
            busy={busy}
            onConfirm={commit}
            onCancel={onClose ?? reset}
            headingRef={summaryRef}
          />
        )}
      </div>
    </section>
  );
}
