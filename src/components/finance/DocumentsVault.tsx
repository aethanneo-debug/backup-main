import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  RefreshCcw,
  Search,
  X
} from "lucide-react";
import type { LiquidationDocumentRow } from "../../types";
import { apiCall, downloadBase64File, firstDateString, formatDate } from "../../utils";
import { reportStatusBadgeClass } from "./overviewFigures";
import { VAULT_STAGES, fileKindLabel, vaultView, type VaultStage } from "./vaultRows";

interface DocumentsVaultProps {
  /** The fiscal year in view ("" until the years load). */
  fiscalYear: string;
  /** The fiscal-year chooser, shared with Finance's other pages. */
  yearControl: React.ReactNode;
  /** The Liquidation Desk, scrolled to this report. */
  onOpenReport: (id: string) => void;
}

const rowKey = (r: LiquidationDocumentRow) => `${r.reportId}/${r.docId}`;

function FileIcon({ type, name }: { type: string; name: string }) {
  const kind = fileKindLabel(type, name);
  const Icon = kind === "Image" ? FileImage : kind === "Spreadsheet" ? FileSpreadsheet : FileText;
  return <Icon size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />;
}

/**
 * The Documents Vault: every file attached to a liquidation report, in one place, for Finance and
 * the Administrator. The list carries no file contents; a file is fetched only when someone
 * downloads it, and the server records each download in the audit log.
 */
export default function DocumentsVault({ fiscalYear, yearControl, onOpenReport }: DocumentsVaultProps) {
  // undefined while loading, null when the list couldn't be loaded.
  const [files, setFiles] = useState<LiquidationDocumentRow[] | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [stage, setStage] = useState<VaultStage>("all");
  const [query, setQuery] = useState("");
  const [includeReplaced, setIncludeReplaced] = useState(false);
  // The rows being downloaded, and each row's last failure: several downloads can run at once.
  // The ref answers a second click on the same row before its button has re-rendered disabled,
  // which would otherwise save the file twice and log two downloads.
  const inFlight = useRef(new Set<string>());
  const [downloading, setDownloading] = useState<ReadonlySet<string>>(new Set());
  const [rowProblems, setRowProblems] = useState<Readonly<Record<string, string>>>({});

  async function load() {
    setFiles(undefined);
    setLoadError("");
    try {
      const res = await apiCall("/api/liquidation-documents");
      setFiles(Array.isArray(res?.data) ? res.data : []);
    } catch (err: any) {
      setFiles(null);
      setLoadError(err?.message || "");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const view = useMemo(
    () => vaultView(files ?? [], { fiscalYear, stage, query, includeReplaced }),
    [files, fiscalYear, stage, query, includeReplaced]
  );

  async function download(row: LiquidationDocumentRow) {
    const key = rowKey(row);
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setDownloading(new Set(inFlight.current));
    const fail = (message: string) => setRowProblems(p => ({ ...p, [key]: message }));
    setRowProblems(p => {
      const { [key]: _cleared, ...others } = p;
      return others;
    });
    try {
      const res = await apiCall(
        `/api/liquidation-submissions/${encodeURIComponent(row.reportId)}/documents/${encodeURIComponent(row.docId)}`
      );
      if (!downloadBase64File(res?.data?.name || row.name, res?.data?.content)) fail("This file can't be opened.");
    } catch (err: any) {
      fail(err?.message || "The file couldn't be downloaded. Try again.");
    } finally {
      inFlight.current.delete(key);
      setDownloading(new Set(inFlight.current));
    }
  }

  const fy = fiscalYear || "…";
  // Until Finance knows its fiscal year, nothing can be listed yet; that isn't "no files".
  const loading = files === undefined || !fiscalYear;
  const filtered = stage !== "all" || query.trim() !== "";
  const clearFilters = () => {
    setStage("all");
    setQuery("");
  };

  // The table's body when there is no row to show.
  let emptyNote: React.ReactNode = null;
  if (loading) emptyNote = "Loading files…";
  else if (files === null) emptyNote = "The files couldn't be loaded.";
  else if (files.length === 0) emptyNote = "No files yet. A file appears here once an employee attaches it to a liquidation report.";
  else if (view.yearTotal === 0) emptyNote = `No files for FY ${fy}. A file counts in its report's fiscal year, as on the Liquidation Desk.`;
  else if (view.rows.length === 0) {
    emptyNote = (
      <>
        {view.hiddenReplaced > 0 && !filtered
          ? "Only replaced copies are left. Tick “Include replaced copies” to see them."
          : "No files match the search or the stage chosen."}
        {filtered && " "}
        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-1 cursor-pointer font-semibold not-italic text-blue-700 underline hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Clear filters
          </button>
        )}
      </>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6 custom-scrollbar" aria-busy={loading}>
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-lg bg-blue-600 p-2 text-white" aria-hidden="true">
            <FolderArchive size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-blue-600">
              HSAC RAB 1 &middot; Finance &middot; Documents Vault
            </p>
            <h1 className="mt-0.5 text-base font-bold text-slate-900">Documents Vault</h1>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">
              Every file attached to a liquidation report in fiscal year {fy}: receipts, certificates and other proof.
              Downloads from this page are recorded in the audit log.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{yearControl}</div>
      </header>

      {files === null && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <span className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            The Documents Vault couldn't be loaded.{loadError ? ` ${loadError}` : ""}
          </span>
          <button
            type="button"
            onClick={load}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <RefreshCcw size={12} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      <section aria-labelledby="vault-files" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="vault-files" className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
              Files · FY {fy}
            </h2>
            <span className="text-[10px] text-slate-500">Newest upload first</span>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Report stage">
            {VAULT_STAGES.map(s => {
              const active = stage === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStage(s.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s.label}
                  <span
                    className={`rounded px-1 font-mono text-[10px] ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    {loading || files === null ? "…" : view.stageCounts[s.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <label htmlFor="vault-search" className="sr-only">Search files</label>
              <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
              <input
                id="vault-search"
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="File name, report number, employee or seminar"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear the search"
                  className="absolute right-2 top-1.5 cursor-pointer rounded p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={includeReplaced}
                onChange={e => setIncludeReplaced(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
              />
              Include replaced copies
              {!includeReplaced && view.hiddenReplaced > 0 && (
                <span className="rounded bg-slate-100 px-1 font-mono text-[10px] text-slate-600">{view.hiddenReplaced}</span>
              )}
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <caption className="sr-only">
              Files attached to liquidation reports in fiscal year {fy}, newest upload first
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-4 py-2.5">File</th>
                <th scope="col" className="px-4 py-2.5">Report</th>
                <th scope="col" className="px-4 py-2.5">Employee</th>
                <th scope="col" className="px-4 py-2.5">Seminar</th>
                <th scope="col" className="px-4 py-2.5">Uploaded</th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {view.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs italic text-slate-500">
                    {emptyNote}
                  </td>
                </tr>
              ) : (
                view.rows.map(row => {
                  const key = rowKey(row);
                  const busy = downloading.has(key);
                  const problem = rowProblems[key] || "";
                  const uploaded = firstDateString(row.uploadedAt, row.createdAt, row.dateSubmitted);
                  return (
                    <tr key={key} className={row.supersededAt ? "bg-slate-50/60" : "hover:bg-slate-50"}>
                      <td className="max-w-[260px] px-4 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <FileIcon type={row.type} name={row.name} />
                          <div className="min-w-0">
                            <p
                              className={`truncate font-semibold ${row.supersededAt ? "text-slate-500 line-through" : "text-slate-800"}`}
                              title={row.name}
                            >
                              {row.name}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {fileKindLabel(row.type, row.name)}
                              {row.size ? ` · ${row.size}` : ""}
                            </p>
                            {row.supersededAt && (
                              <p className="mt-1 text-[10px] text-slate-500">
                                <span className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                                  Replaced
                                </span>{" "}
                                on {formatDate(row.supersededAt)}, by a corrected copy
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-mono text-[11px] font-bold text-slate-800">{row.submissionNo || "—"}</p>
                        <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold ${reportStatusBadgeClass(row.status)}`}>
                          {row.status || "Unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-700">{row.employeeName || "—"}</td>
                      <td className="max-w-[220px] px-4 py-3 align-top text-slate-600">
                        <p className="line-clamp-2" title={row.title}>{row.title}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-slate-600">
                        {uploaded ? formatDate(uploaded) : "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col items-end gap-1.5">
                          {row.hasFile ? (
                            <button
                              type="button"
                              onClick={() => download(row)}
                              disabled={busy}
                              aria-label={busy ? `Downloading ${row.name}` : `Download ${row.name} from ${row.submissionNo || "this report"}`}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60"
                            >
                              <Download size={12} aria-hidden="true" />
                              {busy ? "Downloading…" : "Download"}
                            </button>
                          ) : (
                            <span className="text-[10px] italic text-slate-500">No file stored</span>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenReport(row.reportId)}
                            aria-label={`View ${row.submissionNo || "the report"} on the Liquidation Desk`}
                            className="inline-flex cursor-pointer items-center gap-1 rounded text-[11px] font-semibold text-blue-700 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            View report <ArrowRight size={12} aria-hidden="true" />
                          </button>
                          {problem && (
                            <p role="alert" className="max-w-[180px] text-right text-[10px] text-rose-700">{problem}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && files !== null && files.length > 0 && (
          <p className="border-t border-slate-200 px-4 py-2.5 text-[10px] text-slate-500">
            {view.rows.length} file{view.rows.length === 1 ? "" : "s"} shown of {view.yearTotal} in FY {fy}
          </p>
        )}
      </section>
    </div>
  );
}
