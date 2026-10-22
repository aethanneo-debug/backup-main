import { useEffect, useState } from "react";
import { Archive, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import type { TrainingParticipant, TrainingProgram } from "../../types";
import { formatCurrency, formatDate } from "../../utils";

interface Props {
  fiscalYear: string;
  /** The fiscal year's archived seminars. */
  seminars: TrainingProgram[];
  participants: TrainingParticipant[];
  /** HR and the Administrator restore; the server checks it too. */
  canRestore: boolean;
  busyId: string | null;
  onRestore: (seminar: TrainingProgram) => void;
  /** A seminar to show: when it is in this list, the list opens (the caller outlines its row). */
  revealId?: string;
  revealKey?: number;
}

/**
 * Programs & Budget → Archived Seminars (the user, 2026-10-23: archive instead of delete; only an
 * unsaved row can be deleted). Nothing in an archived seminar is erased. One archived before use
 * ("Not held") gave its allocation back and had its participants taken off it; a finished one
 * keeps every record and still counts what it spent. Restore puts it back on the list above.
 */
export default function ArchivedSeminars({ fiscalYear, seminars, participants, canRestore, busyId, onRestore, revealId, revealKey }: Props) {
  const [open, setOpen] = useState(false);
  const holdsReveal = !!revealId && (seminars ?? []).some(s => s.id === revealId);
  useEffect(() => {
    if (holdsReveal) setOpen(true);
  }, [holdsReveal, revealId, revealKey]);
  if ((seminars ?? []).length === 0) return null;
  // Newest archived first.
  const sorted = [...seminars].sort((a, b) => String(b.archivedAt || "").localeCompare(String(a.archivedAt || "")));
  const enrolments = (id: string) => (participants ?? []).filter(p => p.trainingProgramId === id);

  return (
    <section aria-labelledby="archived-seminars" className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Archive size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <h3 id="archived-seminars" className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
              Archived Seminars ({fiscalYear}){" "}
              <span className="ml-1 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 align-middle">{seminars.length}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Seminars taken off the list above. Nothing in them is erased; restore one to work on it again.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="archived-seminars-list"
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {/* Always rendered (hidden while closed), so the button's aria-controls names an element. */}
      <div id="archived-seminars-list" hidden={!open} className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <caption className="sr-only">Archived seminars of fiscal year {fiscalYear}, newest archived first</caption>
            <thead>
              <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th scope="col" className="px-3 py-2">Seminar</th>
                <th scope="col" className="px-3 py-2">Date</th>
                <th scope="col" className="px-3 py-2">Participants</th>
                <th scope="col" className="px-3 py-2">Money</th>
                <th scope="col" className="px-3 py-2">Archived</th>
                <th scope="col" className="px-3 py-2 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(s => {
                const rows = enrolments(s.id);
                const takenOff = rows.filter(p => p.status === "Archived" && p.archivedWithSeminarAt).length;
                const attended = rows.filter(p => p.attendance === "Attended").length;
                const absent = rows.filter(p => p.attendance === "Did not attend").length;
                const title = String(s.title || "").trim() || "Untitled seminar";
                // Held when somebody attended; otherwise it never ran (archived before use, nobody
                // came, or called off after something was spent on it).
                const held = attended > 0;
                return (
                  <tr key={s.id} data-record-id={s.id} className="align-top">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-slate-800">{title}</p>
                      <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        held ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"
                      }`}>
                        {held ? "Finished" : "Not held"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      {s.startDate ? formatDate(s.startDate) : "—"}
                      {s.endDate && s.endDate !== s.startDate ? ` – ${formatDate(s.endDate)}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {s.archivedBeforeUse
                        ? (takenOff ? `${takenOff} taken off it` : "None")
                        : attended || absent
                          ? `${attended} attended${absent ? `, ${absent} did not attend` : ""}`
                          : "None"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {s.archivedBeforeUse ? (
                        <span>{formatCurrency(Number(s.allocatedBudget || 0))} returned to Unallocated</span>
                      ) : (
                        <span>
                          {formatCurrency(Number(s.usedBudget || 0))} spent
                          <span className="text-slate-400"> of {formatCurrency(Number(s.allocatedBudget || 0))}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      <p className="whitespace-nowrap">{s.archivedAt ? formatDate(s.archivedAt) : "—"}</p>
                      {s.archivedBy && <p className="text-[10px] text-slate-500">by {s.archivedBy}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canRestore && (
                        <button
                          type="button"
                          onClick={() => onRestore(s)}
                          disabled={busyId === s.id}
                          aria-label={`Restore ${title}`}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-50"
                        >
                          <RotateCcw size={12} aria-hidden="true" /> {busyId === s.id ? "Restoring…" : "Restore"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
    </section>
  );
}
