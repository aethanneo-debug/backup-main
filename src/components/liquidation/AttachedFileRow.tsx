import type { LiquidationDocument } from "../../types";
import { FILE_INPUT_ACCEPT } from "../../fileRules";

interface AttachedFileRowProps {
  file: LiquidationDocument;
  /** In a correction: a file filed with the report, which stays on it. */
  stored: boolean;
  /** In a correction: the reviewer asked for a new copy of it. */
  toReplace: boolean;
  /** The new copy chosen, if any. */
  replacement?: { name: string };
  /** The reviewer's note about replacing, for screen readers. */
  describedBy?: string;
  /** A filed file the person on the form may open; a colleague's certificate isn't one. */
  onView?: () => void;
  onDownload: () => void;
  onChooseReplacement: (file: File) => void;
  onUndoReplacement: () => void;
  onRemove: () => void;
}

const ACTION = "text-[10px] font-bold font-mono uppercase cursor-pointer";

/** One file on the liquidation form: what it is, and what can be done with it here. In a correction the
 * filed copies stay on the report (only new files can be removed), and a file marked for replacing gets a
 * new copy instead. */
export default function AttachedFileRow({
  file, stored, toReplace, replacement, describedBy, onView, onDownload, onChooseReplacement, onUndoReplacement, onRemove
}: AttachedFileRowProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border text-[11px] ${
        file.supersededAt ? "bg-white border-slate-100 text-slate-400"
          : toReplace ? "bg-amber-50 border-amber-200 text-slate-700"
          : "bg-slate-50 border-slate-200 text-slate-600"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={`truncate font-mono ${file.supersededAt ? "line-through" : ""}`}>📎 {file.name}</span>
        {file.size && <span className="text-[9px] bg-slate-200 text-slate-600 font-bold font-mono px-1.5 rounded">{file.size}</span>}
        {file.supersededAt && (
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 text-[9px] font-bold uppercase text-slate-500">Replaced, kept in history</span>
        )}
        {toReplace && !replacement && (
          <span className="rounded border border-amber-200 bg-white px-1.5 text-[9px] font-bold uppercase text-amber-700">Replace this file</span>
        )}
        {replacement && (
          <span className="text-[10px] font-semibold text-emerald-700">&rarr; new copy: {replacement.name}</span>
        )}
      </div>
      <div className="flex items-center space-x-1.5">
        {file.content && (
          <button type="button" onClick={onDownload} className={`text-blue-600 hover:text-blue-800 ${ACTION}`}>
            Download
          </button>
        )}
        {stored && file.hasFile && onView && (
          <button type="button" onClick={onView} className={`text-blue-600 hover:text-blue-800 ${ACTION}`}>
            View<span className="sr-only"> {file.name}</span>
          </button>
        )}
        {toReplace && (
          <>
            <input
              id={`replace-${file.id}`}
              type="file"
              accept={FILE_INPUT_ACCEPT}
              className="hidden"
              onChange={e => {
                const chosen = e.target.files?.[0];
                if (chosen) onChooseReplacement(chosen);
                e.target.value = "";
              }}
            />
            {replacement ? (
              <button type="button" onClick={onUndoReplacement} className={`text-slate-500 hover:text-slate-700 ${ACTION}`}>
                Undo<span className="sr-only"> the new copy of {file.name}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => document.getElementById(`replace-${file.id}`)?.click()}
                aria-describedby={describedBy}
                className="rounded border border-amber-300 bg-white px-2 py-0.5 text-amber-800 hover:bg-amber-100 text-[10px] font-bold font-mono uppercase cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Replace file<span className="sr-only">: {file.name}</span>
              </button>
            )}
          </>
        )}
        {!stored && !file.supersededAt && (
          <button type="button" onClick={onRemove} className={`text-rose-500 hover:text-rose-700 ${ACTION}`}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
