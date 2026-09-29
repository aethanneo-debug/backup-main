import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { PlanAImportPreview, TRAINING_NEED_CATEGORIES } from "../../../types";
import { apiCall } from "../../../utils";

interface Props {
  preview: PlanAImportPreview;
  /** key -> employeeId, or null to skip that row. */
  assignments: Record<string, string | null>;
  onAssign: (key: string, employeeId: string | null) => void;
  onSheetChange: (sheetName: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

interface Option { id: string; fullName: string; }

const SHORT_CATEGORY: Record<string, string> = {
  "Function": "Function",
  "Additional Function": "Add'l",
  "Career Advancement": "Career"
};

/**
 * What the workbook says, and who each row belongs to.
 *
 * The mapping table is the point of the whole feature: the workbook names real staff who
 * mostly have no employee record yet, so every row has to be pointed at someone — or
 * deliberately skipped — before anything is written.
 */
export default function PlanAImportPreviewTable({
  preview, assignments, onAssign, onSheetChange, onCancel, onConfirm
}: Props) {
  const [employees, setEmployees] = useState<Option[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiCall("/api/employees")
      .then(res => {
        if (cancelled || res.status !== "success") return;
        setEmployees(
          (res.data ?? [])
            .filter((e: any) => e.isActive !== false)
            .map((e: any) => ({ id: e.id, fullName: e.fullName }))
            .sort((a: Option, b: Option) => a.fullName.localeCompare(b.fullName))
        );
      })
      .catch(() => { /* the selects simply stay empty; the server still validates */ });
    return () => { cancelled = true; };
  }, []);

  // An employee already chosen elsewhere cannot be chosen twice — the server rejects it,
  // so the UI should not offer it.
  const taken = useMemo(() => {
    const m = new Map<string, string>();
    for (const [key, id] of Object.entries(assignments)) if (id) m.set(id, key);
    return m;
  }, [assignments]);

  const mappedRows = Object.values(assignments).filter(Boolean).length;
  const willAdd = preview.blocks
    .filter(b => assignments[b.key])
    .reduce((n, b) => n + TRAINING_NEED_CATEGORIES.reduce((s, c) => s + (b.needCounts[c] || 0), 0) - b.alreadyInPlan, 0);

  return (
    <div className="space-y-3">
      {/* Which sheet, and how each one was judged. */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="plan-a-sheet" className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Sheet
        </label>
        <select
          id="plan-a-sheet"
          value={preview.selectedSheet}
          onChange={e => onSheetChange(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
        >
          {preview.sheets.map(s => (
            <option key={s.name} value={s.name} disabled={!s.isPlanA}>
              {s.name}{s.isPlanA ? ` — ${s.needCount} needs` : ` — ${s.reason}`}
            </option>
          ))}
        </select>
        <span className="font-mono text-[10px] text-slate-400">
          {preview.offices.length} office{preview.offices.length === 1 ? "" : "s"} · {preview.totals.blocks} rows · {preview.totals.needs} needs
        </span>
      </div>

      {!preview.yearMatchesFiscalYear && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          That sheet is for CY {preview.detectedYear ?? "an unknown year"}, but you are editing the
          CY {preview.fiscalYear} plan. Everything imported goes into CY {preview.fiscalYear}.
        </p>
      )}

      {preview.warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {w}
        </p>
      ))}

      <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-lg border border-slate-200 custom-scrollbar">
        <table className="w-full min-w-[720px] text-left font-mono text-[11px]">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="border-b border-slate-200 text-[9px] uppercase tracking-wider text-slate-400">
              <th scope="col" className="px-2 py-1.5 font-bold">Row</th>
              <th scope="col" className="px-2 py-1.5 font-bold">In the workbook</th>
              <th scope="col" className="px-2 py-1.5 font-bold">Needs</th>
              <th scope="col" className="px-2 py-1.5 font-bold">Import as</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(preview.blocks ?? []).map(b => {
              const chosen = assignments[b.key] ?? "";
              const total = TRAINING_NEED_CATEGORIES.reduce((s, c) => s + (b.needCounts[c] || 0), 0);
              return (
                <tr key={b.key} className={chosen ? "" : "bg-slate-50/60"}>
                  <td className="px-2 py-1.5 align-top text-slate-400">{b.startRow}</td>
                  <td className="px-2 py-1.5 align-top">
                    <span className={b.workbookName ? "font-semibold text-slate-800" : "italic text-slate-400"}>
                      {b.workbookName || "(no name in the workbook)"}
                    </span>
                    <span className="block text-[10px] text-slate-500">{b.workbookPosition}</span>
                    {b.sampleTitles.length > 0 && (
                      <span className="block truncate text-[10px] text-slate-400" title={b.sampleTitles.join(" · ")}>
                        {b.sampleTitles[0]}…
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top whitespace-nowrap">
                    <span className="font-bold text-slate-700">{total}</span>
                    <span className="block text-[9px] text-slate-400">
                      {TRAINING_NEED_CATEGORIES.filter(c => b.needCounts[c]).map(c => `${SHORT_CATEGORY[c]} ${b.needCounts[c]}`).join(" · ")}
                    </span>
                    {b.alreadyInPlan > 0 && (
                      <span className="mt-0.5 inline-block rounded border border-amber-200 bg-amber-50 px-1 text-[9px] font-bold text-amber-700">
                        {b.alreadyInPlan} already listed
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <select
                      value={chosen}
                      onChange={e => onAssign(b.key, e.target.value || null)}
                      aria-label={`Import row ${b.startRow} as`}
                      className={`w-full rounded-lg border px-2 py-1 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350 ${
                        chosen ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-100 text-slate-500"
                      }`}
                    >
                      <option value="">— Skip this row —</option>
                      {employees.map(e => (
                        <option
                          key={e.id}
                          value={e.id}
                          disabled={taken.has(e.id) && taken.get(e.id) !== b.key}
                        >
                          {e.fullName}
                        </option>
                      ))}
                    </select>
                    {b.match && chosen === b.match.employeeId && (
                      <span className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                        <CheckCircle2 size={10} aria-hidden="true" /> matched by name
                      </span>
                    )}
                    {b.positionDiffers && chosen && (
                      <span className="mt-0.5 block text-[9px] text-slate-400">
                        stored as {b.match?.storedPosition || "—"} · position is not changed
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <p className="text-[11px] text-slate-600">
          Will add <strong className="font-mono text-slate-800">{Math.max(0, willAdd)}</strong> need
          {willAdd === 1 ? "" : "s"} for <strong className="font-mono text-slate-800">{mappedRows}</strong> employee
          {mappedRows === 1 ? "" : "s"}. <span className="text-slate-400">{preview.totals.blocks - mappedRows} row(s) skipped.</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={mappedRows === 0}
            className="cursor-pointer rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-350"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
