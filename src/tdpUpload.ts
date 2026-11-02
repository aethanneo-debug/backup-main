// The TDP, uploaded once a year (the instructor's review, R9). Plan A comes from the RAB-1 workbook HR uploads for a
// fiscal year, and changes only when an amended one replaces it. This works out what a replacement does to the plan,
// which upload is in force, and the record of a year imported before uploads were recorded. Used by the server; tested.
import type { TdpUpload } from "./types";
import { normalizeTitle } from "./tdpRules";
import { cleanText } from "./inputText";

/** The fields a need is compared by: one title, per person, per column (the import's own dedupe key). */
export interface TdpNeedFields {
  employeeId: string;
  category: string;
  title: string;
}

/** A need of the year's plan, as a replacement sees it. */
export interface TdpPlanNeed extends TdpNeedFields {
  carriedFromFiscalYear?: string;
}

export const tdpNeedKey = (need: TdpNeedFields) => `${need.employeeId}|${need.category}|${normalizeTitle(need.title)}`;

/** A seminar, and a seat on one, as a replacement reads them (damaged entries are passed over). */
export interface TdpSeminar {
  id: string;
  title?: unknown;
  fulfillsNeedTitles?: unknown;
  archivedAt?: unknown;
  tdpException?: unknown;
}
export interface TdpSeat {
  trainingProgramId?: unknown;
  employeeId?: unknown;
  status?: unknown;
}

/**
 * Who is seated for which training: `<person>|<normalised title>` → the seminar's title, for every seat that isn't
 * Cancelled or Archived on one of `seminars` (the year's, those archived before use left out by the caller). A need the
 * amended TDP leaves out stays for the seminar only when its own person is seated for it (the user's decision of
 * 2026-11-02): a colleague's seat can't keep someone the amended TDP dropped "identified" for the training (12z).
 * `personKey` reads a seat's employee as the plan's needs are read (internal id first, 7j).
 */
export function seatedFor(seats: unknown, seminars: TdpSeminar[], personKey: (employeeId: string) => string): Map<string, string> {
  const byId = new Map(seminars.filter(s => s && typeof s === "object").map(s => [s.id, s] as [string, TdpSeminar]));
  const out = new Map<string, string>();
  for (const seat of (Array.isArray(seats) ? seats : []) as TdpSeat[]) {
    if (!seat || typeof seat !== "object" || seat.status === "Cancelled" || seat.status === "Archived") continue;
    const seminar = byId.get(String(seat.trainingProgramId));
    if (!seminar || typeof seat.employeeId !== "string") continue;
    const who = personKey(seat.employeeId);
    for (const title of Array.isArray(seminar.fulfillsNeedTitles) ? seminar.fulfillsNeedTitles : []) {
      const key = normalizeTitle(title);
      if (key && !out.has(`${who}|${key}`)) out.set(`${who}|${key}`, typeof seminar.title === "string" ? seminar.title : "");
    }
  }
  return out;
}

/**
 * The seminars a replacement would leave covering nothing in the plan: in the TDP now (a training they cover is in the
 * year's plan, anyone's, as `seminarCoversPlan` reads it), with none of their trainings left after it. They would read
 * "Not in the TDP" and need their own justification (12z Part C), so the summary names them. Archived seminars, and
 * those already holding a justification of their own, are left out. `before` and `after` hold normalised titles.
 */
export function seminarsLeavingTdp(seminars: TdpSeminar[], before: Set<string>, after: Set<string>): { id: string; title: string }[] {
  return seminars
    .filter(s => s && typeof s === "object" && !s.archivedAt && !s.tdpException)
    .filter(s => {
      const titles = (Array.isArray(s.fulfillsNeedTitles) ? s.fulfillsNeedTitles : []).map(normalizeTitle).filter(Boolean);
      return titles.some(t => before.has(t)) && !titles.some(t => after.has(t));
    })
    .map(s => ({ id: String(s.id), title: typeof s.title === "string" ? s.title : "" }));
}

/** Why a need the amended TDP leaves out stays: its person is seated for it on a seminar, or it was already accomplished. */
export interface TdpNeedUse {
  reason: "seminar" | "accomplished";
  /** The seminar's title, or what showed it accomplished. */
  detail: string;
}

export interface TdpReplacePlan<N> {
  /** In the amended TDP and already in the plan: left exactly as they are, Monitoring's override and remarks too. */
  unchanged: N[];
  /** In the amended TDP and not in the plan yet. */
  added: TdpNeedFields[];
  /** In the plan for the same person under another column than the amended TDP's: moved to it in place, so its id,
   * Monitoring's override and its remarks stay (HSAC answer 6: the column says why the person needs it). Removing it and
   * adding a copy would lose them, and keeping it while a seminar covers it would list the training twice. */
  moved: { need: N; category: string }[];
  /** Not in the amended TDP, and nothing uses them. */
  removed: N[];
  /** Not in the amended TDP, but in use: kept, with why. Removing them would leave a seminar pointing at nothing, or
   * take an accomplished training off Monitoring. */
  kept: { need: N; use: TdpNeedUse }[];
  /** Carried from an earlier year by the rollover: not part of any TDP, so always kept. */
  carried: N[];
}

/**
 * What replacing the year's TDP does. `current` is the year's plan; `incoming` the amended TDP's needs, with each row
 * already mapped to an employee (the same ids `current` uses). `inUse` says whether a need the amended TDP leaves out is
 * still in use, and why. A need listed twice in the file is counted once, and one already carried isn't added again.
 * A need the amended TDP lists for the same person under another column is moved there, whether in use or not.
 */
export function planTdpReplace<N extends TdpPlanNeed>(
  current: N[],
  incoming: TdpNeedFields[],
  inUse: (need: N) => TdpNeedUse | null
): TdpReplacePlan<N> {
  const plan: TdpReplacePlan<N> = { unchanged: [], added: [], moved: [], removed: [], kept: [], carried: [] };
  const inPlan = new Set<string>();
  for (const need of current) {
    if (need.carriedFromFiscalYear) plan.carried.push(need);
    inPlan.add(tdpNeedKey(need));
  }
  const wanted = new Set<string>();
  for (const need of incoming) {
    const key = tdpNeedKey(need);
    if (wanted.has(key)) continue;
    wanted.add(key);
    if (!inPlan.has(key)) plan.added.push(need);
  }
  // The added needs by person and title, to find where a need left out of its own column went.
  const personTitle = (n: TdpNeedFields) => `${n.employeeId}|${normalizeTitle(n.title)}`;
  const addedFor = new Map<string, TdpNeedFields[]>();
  for (const need of plan.added) {
    const list = addedFor.get(personTitle(need));
    if (list) list.push(need);
    else addedFor.set(personTitle(need), [need]);
  }
  // The trainings each person still has after it, in some column: the amended TDP's, and those carried in. A copy left
  // out of its own column isn't kept for a seat while its person keeps the training elsewhere: they stay identified for
  // it (12z) without it, and keeping it would list the training twice. One accomplished still stays (Monitoring's record).
  const keepsTraining = new Set<string>([...incoming.map(personTitle), ...current.filter(n => n.carriedFromFiscalYear).map(personTitle)]);
  const movedTo = new Set<TdpNeedFields>();
  for (const need of current) {
    if (need.carriedFromFiscalYear) continue;
    if (wanted.has(tdpNeedKey(need))) {
      plan.unchanged.push(need);
      continue;
    }
    const target = addedFor.get(personTitle(need))?.find(n => !movedTo.has(n));
    if (target) {
      movedTo.add(target);
      plan.moved.push({ need, category: target.category });
      continue;
    }
    const use = inUse(need);
    if (use && !(use.reason === "seminar" && keepsTraining.has(personTitle(need)))) plan.kept.push({ need, use });
    else plan.removed.push(need);
  }
  if (movedTo.size > 0) plan.added = plan.added.filter(n => !movedTo.has(n));
  return plan;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");
const whole = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/**
 * The TDP in force for a year: the latest record for it, uploads being kept in the order they came. Returned as a
 * clean copy, so a damaged entry (a hand edit, a bad restore) can't put an object where the screens expect text; it
 * still counts as uploaded, so it can't reopen a first upload.
 */
export function currentTdp(records: unknown, fiscalYear: string): TdpUpload | null {
  const list: any[] = Array.isArray(records) ? records : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (!r || typeof r !== "object" || r.fiscalYear !== fiscalYear) continue;
    const kind = r.kind === "replace" || r.kind === "before-records" ? r.kind : "upload";
    const c = r.changes && typeof r.changes === "object" ? r.changes : null;
    return {
      id: text(r.id),
      fiscalYear,
      kind,
      filename: text(r.filename),
      sheetName: text(r.sheetName),
      uploadedAt: text(r.uploadedAt),
      uploadedBy: text(r.uploadedBy),
      uploadedByName: text(r.uploadedByName),
      needs: whole(r.needs),
      employees: whole(r.employees),
      ...(c ? { changes: { added: whole(c.added), removed: whole(c.removed), kept: whole(c.kept), moved: whole(c.moved) } } : {}),
      ...(Array.isArray(r.keptNeedIds) ? { keptNeedIds: r.keptNeedIds.filter((id: unknown): id is string => typeof id === "string") } : {})
    };
  }
  return null;
}

/** How many of a year's needs are its TDP's, and for how many employees; and how many were carried in. */
export function tdpCounts(needs: Array<Partial<TdpPlanNeed> & { fiscalYear?: string }> | null | undefined, fiscalYear: string) {
  const people = new Set<string>();
  let tdp = 0;
  let carried = 0;
  for (const need of Array.isArray(needs) ? needs : []) {
    if (!need || need.fiscalYear !== fiscalYear) continue;
    if (need.carriedFromFiscalYear) {
      carried++;
      continue;
    }
    tdp++;
    if (typeof need.employeeId === "string") people.add(need.employeeId);
  }
  return { needs: tdp, employees: people.size, carried };
}

// The import's audit entry, as server.ts writes it:
// `Imported 456 training need(s) from "<file>" sheet "<sheet>" into the 2027 plan for 17 employee(s); …`
const IMPORT_ACTION = "Import Plan A Workbook";
const IMPORT_DETAILS = /from "(.*)" sheet "(.*)" into the (\S+) plan/;
const MAX_IMPORT_DETAILS = 2000;

interface AuditEntry {
  action?: unknown;
  details?: unknown;
  timestamp?: unknown;
  username?: unknown;
}

/**
 * The records for years imported before uploads were recorded: each year with needs that weren't carried in (the
 * team's decision: carried needs alone aren't an upload) and no record yet. The file, who and when come from the year's
 * latest import in the audit log, when it has one, else they are left blank. Damaged entries are passed over: this runs
 * as the server loads, where an error would stop it starting.
 */
export function recordsBeforeUploads(input: {
  needs: unknown;
  records: unknown;
  auditLogs: unknown;
  fullNameOf: (username: string) => string;
}): TdpUpload[] {
  const needs = (Array.isArray(input.needs) ? input.needs : []).filter((n): n is TdpPlanNeed & { fiscalYear: string } =>
    !!n && typeof n === "object" && typeof (n as any).fiscalYear === "string");
  const recorded = new Set((Array.isArray(input.records) ? input.records : []).filter(Boolean).map((r: any) => r.fiscalYear));
  const years = [...new Set(needs.filter(n => !n.carriedFromFiscalYear).map(n => n.fiscalYear))].filter(fy => !recorded.has(fy));
  // Every start reads this, and the audit log is never trimmed: nothing to do, nothing read.
  if (years.length === 0) return [];
  // The entries the import wrote are short. A long one (a raw sheet name from before the names were cleaned) is passed
  // over rather than matched, since the pattern's backtracking grows with its length.
  const imports = (Array.isArray(input.auditLogs) ? input.auditLogs : [])
    .filter((e: AuditEntry): e is { action: string; details: string; timestamp: string; username: string } =>
      !!e && e.action === IMPORT_ACTION && typeof e.details === "string" && e.details.length <= MAX_IMPORT_DETAILS &&
      typeof e.timestamp === "string" && !Number.isNaN(Date.parse(e.timestamp)))
    .map(e => ({ entry: e, match: IMPORT_DETAILS.exec(e.details) }))
    .filter(x => x.match);

  return years.sort().map(fiscalYear => {
    const latest = imports
      .filter(x => x.match![3] === fiscalYear)
      .sort((a, b) => Date.parse(b.entry.timestamp) - Date.parse(a.entry.timestamp))[0];
    const counts = tdpCounts(needs, fiscalYear);
    const username = latest && typeof latest.entry.username === "string" ? latest.entry.username : "";
    return {
      id: `tdp-${fiscalYear}-before-records`,
      fiscalYear,
      kind: "before-records" as const,
      // Written raw by the import before this change: cleaned as the new records are.
      filename: latest ? cleanText(latest.match![1]).slice(0, 200) : "",
      sheetName: latest ? cleanText(latest.match![2]).slice(0, 200) : "",
      uploadedAt: latest ? latest.entry.timestamp : "",
      uploadedBy: username,
      uploadedByName: username ? cleanText(input.fullNameOf(username)).slice(0, 200) : "",
      needs: counts.needs,
      employees: counts.employees
    };
  });
}
