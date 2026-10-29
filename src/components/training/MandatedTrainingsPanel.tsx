import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Scale } from "lucide-react";
import { TrainingMandate, TrainingNeedCatalogItem } from "../../types";
import { apiCall, formatDate } from "../../utils";
import { MANDATE_BASIS_MAX, MANDATE_SUGGESTIONS, readMandateBasis } from "../../trainingMandates";

// Trainings the law requires (HSAC RAB 1's step 5, "Prioritization – statutory/legal mandates"; 12z Part
// D), on Plan A. HR or the Administrator marks a title from this year's plan with the law or rule behind
// it; it then applies to every year, and its unmet needs come first in Monitoring, in planning and in the
// participant picker. Nothing is marked to start with: the office decides which trainings are required.
interface Props {
  fiscalYear: string;
  /** After a change, so the plan below reloads with its badges. */
  onChanged: () => void;
}

const INPUT = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
const BUTTON = "rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
const LINK = "rounded font-semibold hover:underline focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";
const ALERT = "mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800";

// Where focus goes once an action is done, so a keyboard or screen-reader user isn't left on the page
// when the control they used goes away: the training list after a mark, the row's Change button after a
// save or a cancel, the heading after an unmark.
type FocusTarget = { to: "pick" | "heading" | "edit" } | { to: "change"; id: string };

export default function MandatedTrainingsPanel({ fiscalYear, onChanged }: Props) {
  const id = useId();
  const [mandates, setMandates] = useState<TrainingMandate[]>([]);
  const [catalog, setCatalog] = useState<TrainingNeedCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  // The list couldn't be loaded: shown, with Retry, instead of the list and the form.
  const [loadError, setLoadError] = useState("");
  // A refused action, shown beside the row being changed (`at` is its id) or under the form ("form").
  const [error, setError] = useState<{ text: string; at: string } | null>(null);
  const [title, setTitle] = useState("");
  const [basis, setBasis] = useState("");
  // The mark whose basis is being changed, and the new basis.
  const [editing, setEditing] = useState<{ id: string; basis: string } | null>(null);
  // The action in flight: "mark", "save:<id>" or "unmark:<id>".
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [focusTo, setFocusTo] = useState<FocusTarget | null>(null);
  const loads = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pickRef = useRef<HTMLSelectElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const changeRefs = useRef(new Map<string, HTMLButtonElement>());

  // `quiet`: after an action, the list and the form stay on screen while it reloads.
  async function load(quiet = false) {
    const mine = ++loads.current;
    if (!quiet) setLoading(true);
    try {
      const [m, c] = await Promise.all([
        apiCall("/api/training/mandates"),
        apiCall(`/api/training/needs/catalog${fiscalYear ? `?fiscalYear=${encodeURIComponent(fiscalYear)}` : ""}`)
      ]);
      if (mine !== loads.current) return;   // a later load answers for the screen
      setMandates(m?.data ?? []);
      setCatalog(c?.data?.needs ?? []);
      setLoadError("");
    } catch (err: any) {
      if (mine === loads.current) setLoadError(err?.message || "The mandated trainings could not be loaded.");
    } finally {
      if (mine === loads.current) setLoading(false);
    }
  }
  useEffect(() => { load(); }, [fiscalYear]);

  useEffect(() => {
    if (!focusTo) return;
    const el = focusTo.to === "pick" ? pickRef.current
      : focusTo.to === "edit" ? editRef.current
      : focusTo.to === "change" ? changeRefs.current.get(focusTo.id)
      : null;
    // A control that is gone or switched off (every training marked) can't take focus: the heading does.
    (el && !(el as HTMLInputElement).disabled ? el : headingRef.current)?.focus();
    setFocusTo(null);
  }, [focusTo, mandates, editing]);

  // This year's titles not marked yet, the most listed first.
  const unmarked = useMemo(() => (catalog ?? []).filter(c => !c.mandate), [catalog]);
  // The chosen title, while it is still unmarked (another officer may have marked it meanwhile).
  const chosen = unmarked.some(c => c.title === title) ? title : "";
  // An error about a row shows beside it while it is being changed; any other, under the form.
  const rowError = (m: TrainingMandate) => (error && error.at === m.id && editing?.id === m.id ? error.text : "");
  const formError = error && !mandates.some(m => rowError(m)) ? error.text : "";

  async function run(key: string, action: () => Promise<any>, done: string, errorAt: string) {
    setBusy(key);
    setError(null);
    setNotice("");
    try {
      const res = await action();
      setNotice(res?.message === "Nothing changed." ? "Nothing changed." : done);
      await load(true);
      onChanged();
      return true;
    } catch (err: any) {
      // Refused, e.g. another officer marked or unmarked it meanwhile: show the list and the plan as the
      // server has them, then why.
      await load(true);
      onChanged();
      setError({ text: err?.message || "That could not be saved.", at: errorAt });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function mark() {
    if (!chosen) { setError({ text: "Choose the training from this year's plan.", at: "form" }); setFocusTo({ to: "pick" }); return; }
    const read = readMandateBasis(basis);
    if ("problem" in read) { setError({ text: read.problem, at: "form" }); return; }
    if (await run("mark", () => apiCall("/api/training/mandates", { method: "POST", body: JSON.stringify({ title: chosen, basis: read.value }) }), `"${chosen}" is marked as mandated.`, "form")) {
      setTitle("");
      setBasis("");
    }
    setFocusTo({ to: "pick" });
  }

  function startEdit(m: TrainingMandate) {
    setEditing({ id: m.id, basis: m.basis });
    setError(null);
    setNotice("");
    setFocusTo({ to: "edit" });
  }

  function cancelEdit(m: TrainingMandate) {
    setEditing(null);
    setError(null);
    setFocusTo({ to: "change", id: m.id });
  }

  async function saveBasis(m: TrainingMandate) {
    if (!editing) return;
    const read = readMandateBasis(editing.basis);
    if ("problem" in read) { setError({ text: read.problem, at: m.id }); setFocusTo({ to: "edit" }); return; }
    const saved = await run(`save:${m.id}`, () => apiCall(`/api/training/mandates/${encodeURIComponent(m.id)}`, { method: "PUT", body: JSON.stringify({ basis: read.value }) }), "Saved.", m.id);
    if (saved) {
      setEditing(null);
      setFocusTo({ to: "change", id: m.id });
    } else setFocusTo({ to: "edit" });
  }

  async function unmark(m: TrainingMandate) {
    if (!window.confirm(`Unmark "${m.title}"? Its needs will no longer be listed first.`)) return;
    await run(`unmark:${m.id}`, () => apiCall(`/api/training/mandates/${encodeURIComponent(m.id)}`, { method: "DELETE" }), `"${m.title}" is no longer marked.`, "form");
    setFocusTo({ to: "heading" });
  }

  return (
    <section aria-labelledby={`${id}-title`} className="mb-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs">
      <h3 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 focus:outline-none">
        <Scale size={13} aria-hidden="true" /> Mandated trainings{!loading && !loadError ? ` (${mandates.length})` : ""}
      </h3>
      <p className="mt-1 text-[11px] text-slate-500">
        Trainings the law or a rule requires. Their unmet needs come first in Monitoring, when planning seminars, and in the
        participant picker. A mark applies to every year; the plan may word one law several ways, so mark each wording.
      </p>
      <datalist id={`${id}-bases`}>
        {MANDATE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
      </datalist>
      {loading ? (
        <p className="mt-2 flex items-center gap-2 text-slate-500"><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Loading…</p>
      ) : loadError ? (
        <div role="alert" className={`${ALERT} flex items-start justify-between gap-3`}>
          <span>{loadError}</span>
          <button type="button" onClick={() => load()} className="shrink-0 font-semibold underline">Retry</button>
        </div>
      ) : (
        <>
          {mandates.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {mandates.map(m => (
                <li key={m.id} className="px-3 py-2">
                  {editing?.id === m.id ? (
                    <>
                      <form onSubmit={e => { e.preventDefault(); saveBasis(m); }} className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">{m.title}</span>
                        <label htmlFor={`${id}-edit`} className="sr-only">Law or rule that requires {m.title}</label>
                        <input id={`${id}-edit`} ref={editRef} list={`${id}-bases`} className={`${INPUT} max-w-xs`} value={editing.basis} maxLength={MANDATE_BASIS_MAX}
                          disabled={!!busy} aria-describedby={`${id}-hint`}
                          onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); cancelEdit(m); } }}
                          onChange={e => setEditing({ id: m.id, basis: e.target.value })} />
                        <button type="submit" disabled={!!busy} className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`}>
                          {busy === `save:${m.id}` ? "Saving…" : "Save"}
                        </button>
                        <button type="button" onClick={() => cancelEdit(m)} disabled={!!busy} className={`${BUTTON} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>Cancel</button>
                      </form>
                      {rowError(m) && <p role="alert" className={ALERT}>{rowError(m)}</p>}
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="font-semibold text-slate-800">{m.title}</span>
                        <span className="text-slate-500"> · {m.basis}</span>
                        {typeof m.markedBy?.name === "string" && typeof m.markedAt === "string" && (
                          <span className="block text-[10px] text-slate-500">Marked by {m.markedBy.name} on {formatDate(m.markedAt)}</span>
                        )}
                      </span>
                      <span className="flex shrink-0 gap-3">
                        <button type="button" onClick={() => startEdit(m)} disabled={!!busy}
                          ref={el => { if (el) changeRefs.current.set(m.id, el); else changeRefs.current.delete(m.id); }}
                          className={`${LINK} text-blue-700 focus-visible:ring-blue-500`}>
                          Change<span className="sr-only">: {m.title}</span>
                        </button>
                        <button type="button" onClick={() => unmark(m)} disabled={!!busy} className={`${LINK} text-rose-700 focus-visible:ring-rose-500`}>
                          {busy === `unmark:${m.id}` ? "Unmarking…" : "Unmark"}<span className="sr-only">: {m.title}</span>
                        </button>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* Side by side only on a wide screen: the sidebar takes about 270 px of the width. */}
          <form onSubmit={e => { e.preventDefault(); mark(); }} className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto] lg:items-end">
            <div>
              <label htmlFor={`${id}-pick`} className="mb-0.5 block text-[11px] font-semibold text-slate-700">Training in the FY {fiscalYear} plan</label>
              <select id={`${id}-pick`} ref={pickRef} className={INPUT} value={chosen} disabled={!!busy || unmarked.length === 0} onChange={e => { setTitle(e.target.value); setError(null); }}>
                <option value="">
                  {catalog.length === 0 ? `No trainings in the FY ${fiscalYear} plan yet` : unmarked.length === 0 ? "Every training in the plan is marked" : "Choose a training…"}
                </option>
                {unmarked.map(c => (
                  <option key={c.title} value={c.title}>{c.title} ({c.employeeCount} employee{c.employeeCount === 1 ? "" : "s"})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-basis`} className="mb-0.5 block text-[11px] font-semibold text-slate-700">Law or rule that requires it</label>
              <input id={`${id}-basis`} list={`${id}-bases`} className={INPUT} value={basis} maxLength={MANDATE_BASIS_MAX} disabled={!!busy}
                aria-describedby={`${id}-hint`} placeholder="e.g. R.A. 6713 (Code of Conduct and Ethical Standards)"
                onChange={e => { setBasis(e.target.value); setError(null); }} />
            </div>
            <button type="submit" disabled={!!busy || !chosen} className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`}>
              {busy === "mark" ? "Saving…" : "Mark as mandated"}
            </button>
          </form>
          <p id={`${id}-hint`} className="mt-1 text-[10px] text-slate-500">
            Name the law or rule only: it shows wherever the training is listed. Leave personal details out.
          </p>
        </>
      )}
      <div role="status" aria-live="polite">
        {notice && <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">{notice}</p>}
      </div>
      {formError && <p role="alert" className={ALERT}>{formError}</p>}
    </section>
  );
}
