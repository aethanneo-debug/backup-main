// The TDP, uploaded once a year (the instructor's review, R9). Plan A comes from the RAB-1 workbook HR uploads for a
// fiscal year; its TDP needs change only when an amended one replaces it, and HR can add one of its trainings to someone
// it doesn't list (12ad). This works out what a replacement does to the plan, which upload is in force, the TDP's own
// list of trainings, and the record of a year imported before uploads were recorded. Used by the server; tested.
import { TRAINING_NEED_CATEGORIES, type TdpUpload, type TrainingNeedCategory } from "./types";
import { normalizeTitle } from "./tdpRules";
import { cleanText } from "./inputText";

/** The fields a need is compared by: one title, per person, per column (the import's own dedupe key). */
export interface TdpNeedFields {
  employeeId: string;
  category: string;
  title: string;
}

/** A need of the year's plan, as a replacement sees it. `addedAfterTdp` marks one HR added after the TDP (12ad), and
 * `outsideTdp` one for a training the TDP doesn't list (12ae): a replacement treats both alike. */
export interface TdpPlanNeed extends TdpNeedFields {
  carriedFromFiscalYear?: string;
  addedAfterTdp?: unknown;
  outsideTdp?: unknown;
}

/** Added by HR, not the TDP's: one of its trainings after it (12ad), or a training outside it (12ae). */
const addedByHr = (need: Partial<TdpPlanNeed>) => !!(need.addedAfterTdp || need.outsideTdp);

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
  /** Added by HR, after the TDP (12ad) or for a training outside it (12ae), and not in the amended TDP: always kept, as
   * carried ones are (the user's decisions of 2026-11-08 and 2026-11-09). */
  addedKept: N[];
  /** Added by HR (either way) and listed by the amended TDP for the same person, in place (in `unchanged`) or under
   * another column (in `moved`), or carried in still marked outside the TDP and listed under its own column: the TDP's
   * from then on, so the caller clears their mark. Adopting one outside the TDP makes the TDP identify its person. */
  adopted: N[];
}

/**
 * What replacing the year's TDP does. `current` is the year's plan; `incoming` the amended TDP's needs, with each row
 * already mapped to an employee (the same ids `current` uses). `inUse` says whether a need the amended TDP leaves out is
 * still in use, and why. A need listed twice in the file is counted once, and one already carried isn't added again.
 * A need the amended TDP lists for the same person under another column is moved there, whether in use or not.
 * One HR added after the TDP is compared like the TDP's own (kept in place, or moved), and adopted when listed; only
 * where the TDP's own would be removed is it kept instead.
 */
export function planTdpReplace<N extends TdpPlanNeed>(
  current: N[],
  incoming: TdpNeedFields[],
  inUse: (need: N) => TdpNeedUse | null
): TdpReplacePlan<N> {
  const plan: TdpReplacePlan<N> = { unchanged: [], added: [], moved: [], removed: [], kept: [], carried: [], addedKept: [], adopted: [] };
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
  // The trainings each person still has after it, in some column: the amended TDP's, those carried in, and those HR
  // added (all stay). A copy left out of its own column isn't kept for a seat while its person keeps the training
  // elsewhere: they stay identified for it (12z) without it, and keeping it would list the training twice. One
  // accomplished still stays (Monitoring's record). A need outside the TDP (12ae) identifies nobody, so it doesn't count
  // here: the seat would be left with nothing in the TDP under it.
  const keepsTraining = new Set<string>([
    ...incoming.map(personTitle),
    ...current.filter(n => (n.carriedFromFiscalYear || addedByHr(n)) && !n.outsideTdp).map(personTitle)
  ]);
  const movedTo = new Set<TdpNeedFields>();
  for (const need of current) {
    if (need.carriedFromFiscalYear) {
      // Carried in still marked outside the TDP (12ae), and now listed by it for the same person and column: the TDP's
      // from then on, as an addition is.
      if (addedByHr(need) && wanted.has(tdpNeedKey(need))) plan.adopted.push(need);
      continue;
    }
    if (wanted.has(tdpNeedKey(need))) {
      plan.unchanged.push(need);
      if (addedByHr(need)) plan.adopted.push(need);
      continue;
    }
    const target = addedFor.get(personTitle(need))?.find(n => !movedTo.has(n));
    if (target) {
      movedTo.add(target);
      plan.moved.push({ need, category: target.category });
      if (addedByHr(need)) plan.adopted.push(need);
      continue;
    }
    if (addedByHr(need)) {
      plan.addedKept.push(need);
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
const isCategory = (v: unknown): v is TrainingNeedCategory => (TRAINING_NEED_CATEGORIES as readonly unknown[]).includes(v);

/** At most this many trainings on a record (the commit takes at most 5,000 needs), so a damaged list stays bounded. */
const MAX_RECORDED_TRAININGS = 5000;

/**
 * The TDP's own trainings for its upload record (12ad): one per title and column, in the sheet's order and its first
 * spelling (trimmed, as needs are stored), from every row of the sheet: rows assigned to nobody (a vacant post, someone
 * not on file) and rows the import skipped as already in the plan included, since a post left vacant is often the one a
 * new hire fills.
 */
export function tdpTrainings(rows: { title: unknown; category: unknown }[]): { title: string; category: TrainingNeedCategory }[] {
  const seen = new Set<string>();
  const out: { title: string; category: TrainingNeedCategory }[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row.title !== "string" || !isCategory(row.category)) continue;
    const title = row.title.trim();
    const key = normalizeTitle(title);
    if (!key || title.length > 300 || seen.has(`${row.category}|${key}`)) continue;
    seen.add(`${row.category}|${key}`);
    out.push({ title, category: row.category });
    if (out.length >= MAX_RECORDED_TRAININGS) break;
  }
  return out;
}

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
      ...(c ? {
        changes: {
          added: whole(c.added), removed: whole(c.removed), kept: whole(c.kept), moved: whole(c.moved),
          ...(whole(c.addedKept) ? { addedKept: whole(c.addedKept) } : {}),
          ...(whole(c.adopted) ? { adopted: whole(c.adopted) } : {}),
          // Needs for trainings outside the TDP (12ae), which the bar words apart.
          ...(whole(c.outsideKept) ? { outsideKept: whole(c.outsideKept) } : {}),
          ...(whole(c.outsideAdopted) ? { outsideAdopted: whole(c.outsideAdopted) } : {})
        }
      } : {}),
      ...(Array.isArray(r.keptNeedIds) ? { keptNeedIds: r.keptNeedIds.filter((id: unknown): id is string => typeof id === "string") } : {}),
      ...(Array.isArray(r.trainings) ? { trainings: tdpTrainings(r.trainings) } : {})
    };
  }
  return null;
}

/** How many of a year's needs are its TDP's, and for how many employees; and how many were carried in, added by HR
 * after the TDP (12ad), or added for trainings outside it (12ae): none of them is part of it. A carried need counts as
 * carried, whatever it was. */
export function tdpCounts(needs: Array<Partial<TdpPlanNeed> & { fiscalYear?: string }> | null | undefined, fiscalYear: string) {
  const people = new Set<string>();
  let tdp = 0;
  let carried = 0;
  let added = 0;
  let outside = 0;
  for (const need of Array.isArray(needs) ? needs : []) {
    if (!need || need.fiscalYear !== fiscalYear) continue;
    if (need.carriedFromFiscalYear) {
      carried++;
      continue;
    }
    if (need.outsideTdp) {
      outside++;
      continue;
    }
    if (need.addedAfterTdp) {
      added++;
      continue;
    }
    tdp++;
    if (typeof need.employeeId === "string") people.add(need.employeeId);
  }
  return { needs: tdp, employees: people.size, carried, added, outside };
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
  // (Needs HR added after the TDP aren't an upload either.)
  const years = [...new Set(needs.filter(n => !n.carriedFromFiscalYear && !addedByHr(n)).map(n => n.fiscalYear))].filter(fy => !recorded.has(fy));
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

/** The seminars a change brings into the TDP (12ad): one of the needs they cover is in the plan after it, none before.
 * The other side of `seminarsLeavingTdp`. One held with its own justification (12z Part C) is named too, since it no
 * longer needs it. */
export function seminarsEnteringTdp(seminars: TdpSeminar[], before: Set<string>, after: Set<string>): { id: string; title: string }[] {
  return (Array.isArray(seminars) ? seminars : [])
    .filter(s => s && typeof s === "object" && !s.archivedAt)
    .filter(s => {
      const titles = (Array.isArray(s.fulfillsNeedTitles) ? s.fulfillsNeedTitles : []).map(normalizeTitle).filter(Boolean);
      return titles.some(t => after.has(t)) && !titles.some(t => before.has(t));
    })
    .map(s => ({ id: String(s.id), title: typeof s.title === "string" ? s.title : "" }));
}

export type TdpTraining = { title: string; category: TrainingNeedCategory };

/** What a new upload record changes in the trainings "Add Training Need" offers (12ad): those it lists that the record
 * before it didn't, and those it no longer lists, each by column (a training moved to another column is offered under
 * the new one and withdrawn from the old). `null` when the record before kept no list (uploaded before lists were
 * kept), so there is nothing to compare it with. */
export function trainingListChanges(before: unknown, after: unknown): { offered: TdpTraining[]; withdrawn: TdpTraining[] } | null {
  const prior = tdpTrainings(before as { title: unknown; category: unknown }[]);
  if (prior.length === 0) return null;
  const next = tdpTrainings(after as { title: unknown; category: unknown }[]);
  const key = (t: TdpTraining) => `${t.category}|${normalizeTitle(t.title)}`;
  const priorKeys = new Set(prior.map(key));
  const nextKeys = new Set(next.map(key));
  return { offered: next.filter(t => !priorKeys.has(key(t))), withdrawn: prior.filter(t => !nextKeys.has(key(t))) };
}
