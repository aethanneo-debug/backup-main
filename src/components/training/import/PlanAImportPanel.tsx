import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { PlanAImportAssignment, PlanAImportPreview, PlanAImportResult } from "../../../types";
import { apiCall } from "../../../utils";
import PlanAImportPreviewTable from "./PlanAImportPreview";

interface Props {
  /** The plan year being edited; the destination for everything imported. */
  fiscalYear: string;
  /** Called after a successful commit so Plan A refetches. */
  onImported: () => void;
}

type Stage = "idle" | "reading" | "previewing" | "committing" | "done";

/**
 * Uploading the official RAB-1 workbook into Plan A.
 *
 * Deliberately two steps. Of the 15 people the 2026 sheet names, only a couple usually
 * match an employee record, so importing blind would attach hundreds of needs to nobody.
 * The preview reads the file and writes nothing; HR maps or skips each row; only the
 * confirm writes.
 */
export default function PlanAImportPanel({ fiscalYear, onImported }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PlanAImportPreview | null>(null);
  const [result, setResult] = useState<PlanAImportResult | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [dragging, setDragging] = useState(false);
  // Kept so the commit can re-send the same bytes the preview read.
  const fileRef = useRef<{ base64: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStage("idle");
    setError("");
    setPreview(null);
    setResult(null);
    setAssignments({});
    fileRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }

  async function runPreview(base64: string, name: string, sheetName?: string) {
    setStage("reading");
    setError("");
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
      for (const b of data.blocks) next[b.key] = b.match ? b.match.employeeId : null;
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

  async function commit() {
    if (!preview || !fileRef.current) return;
    const list: PlanAImportAssignment[] = preview.blocks.map(b => ({
      key: b.key,
      workbookName: b.workbookName,
      employeeId: assignments[b.key] ?? null
    }));
    const mappedRows = list.filter(a => a.employeeId).length;
    if (mappedRows === 0) return;

    if (!confirm(`Import training needs for ${mappedRows} employee${mappedRows === 1 ? "" : "s"} into the CY ${preview.fiscalYear} plan?\n\nRows left on "Skip" are not imported.`)) return;

    setStage("committing");
    setError("");
    try {
      const res = await apiCall("/api/training/needs/import/commit", {
        method: "POST",
        body: JSON.stringify({
          base64Data: fileRef.current.base64,
          filename: fileRef.current.name,
          fileDigest: preview.fileDigest,
          sheetName: preview.selectedSheet,
          fiscalYear: preview.fiscalYear,
          assignments: list
        })
      });
      if (res.status !== "success") throw new Error(res.message || "The import could not be completed.");
      setResult(res.data);
      setStage("done");
      onImported();
    } catch (err: any) {
      setError(err.message || "The import could not be completed.");
      setStage("previewing");
    }
  }

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 border-t-2 border-t-blue-600 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h3 className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-700">
          <FileSpreadsheet size={12} className="text-blue-600" aria-hidden="true" />
          Import the official workbook
        </h3>
        {preview && stage !== "done" && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
            Nothing is saved until you confirm
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

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
              Upload the RAB-1 Training and Development Plan (.xlsx)
            </p>
            <p className="mx-auto mt-1 max-w-md text-[11px] leading-snug text-slate-500">
              Plan A is read from the workbook and shown to you first. You choose which employee
              each row belongs to before anything is added to the plan.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={e => takeFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
            >
              Choose file
            </button>
          </div>
        )}

        {(stage === "reading" || stage === "committing") && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {stage === "reading" ? "Reading the workbook…" : "Adding the training needs…"}
          </div>
        )}

        {stage === "previewing" && preview && (
          <PlanAImportPreviewTable
            preview={preview}
            assignments={assignments}
            onAssign={(key, employeeId) => setAssignments(prev => ({ ...prev, [key]: employeeId }))}
            onSheetChange={name => fileRef.current && runPreview(fileRef.current.base64, fileRef.current.name, name)}
            onCancel={reset}
            onConfirm={commit}
          />
        )}

        {stage === "done" && result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 size={14} aria-hidden="true" />
              Imported {result.imported} training need{result.imported === 1 ? "" : "s"} for {result.perEmployee.length} employee{result.perEmployee.length === 1 ? "" : "s"}.
            </p>
            <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-emerald-900">
              {result.perEmployee.map(p => (
                <li key={p.employeeId}>
                  {p.fullName} — {p.imported} added{p.skipped > 0 ? `, ${p.skipped} skipped` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-emerald-800">
              {result.skippedRows} row{result.skippedRows === 1 ? "" : "s"} skipped
              {result.skippedAlreadyInPlan > 0 && `, ${result.skippedAlreadyInPlan} already in the plan`}
              {result.skippedDuplicateInFile > 0 && `, ${result.skippedDuplicateInFile} duplicated in the workbook`}.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-3 cursor-pointer text-[11px] font-semibold text-blue-700 underline hover:text-blue-800"
            >
              Import another file
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
