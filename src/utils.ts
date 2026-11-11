import { RequestType, UserRole } from "./types";

// Formatting utility for Philippine Peso (PHP) currency values
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

// Formatting utility for human-readable dates. Always text: a stored value that is neither text nor a number (a
// crafted resubmit can store an object, known-issues 12w) is "N/A", never handed back, since React can't draw an
// object and, with no error boundary, the whole app would go blank (the security review of 12ag, 2026-11-11).
export function formatDate(dateString: unknown): string {
  if (!dateString || (typeof dateString !== "string" && typeof dateString !== "number" && !(dateString instanceof Date))) return "N/A";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
}

/**
 * One CSV cell. Excel starts a formula at a leading = + - @ even inside quotes, and names and titles can come from
 * an uploaded PDS or a typed form: a leading apostrophe keeps such a cell as text. Some spreadsheets read past leading
 * spaces, and full-width signs ("＝") are the same signs to them, so those count too. A plain negative amount is no
 * formula, and stays a number.
 */
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const lead = text.normalize("NFKC").trimStart();
  const formulaLike = /^[\t\r\n]/.test(text) || /^[=+\-@]/.test(lead);
  const safe = formulaLike && !/^-?\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * A table as a CSV file: every cell through `csvCell`, so typed text can't start a formula, and a byte-order mark, without
 * which Excel opens the file as ANSI and "Niño" arrives as "NiÃ±o". `filename` comes without its extension.
 */
export function downloadCsvTable(rows: unknown[][], filename: string) {
  const text = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff), text], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Convert JSON arrays to CSV format and prompt browser download
export function downloadCSV(data: any[], headers: string[], filename: string) {
  const rows = data.map(row => headers.map(header => {
    const value = row[header] !== undefined ? row[header] : "";
    return typeof value === "object" ? JSON.stringify(value) : value;
  }));
  downloadCsvTable([headers, ...rows], `${filename}_${new Date().toISOString().split("T")[0]}`);
}

// What an uploaded file's stored content must look like: the base64 data URL the upload screens
// make (FileReader.readAsDataURL). Anything else, such as a "javascript:" URL sent straight to
// the API, would run as a script in the session of whoever clicked it.
export const SAFE_FILE_URL = /^data:(?:[\w.+-]+\/[\w.+-]+)?(?:;[\w.+-]+=[^;,]*)*;base64,/i;

// Saves a file attached to a record (a liquidation report's receipts, say), stored as a data
// URL. Returns false when the record has no file content to save, or content that isn't one.
export function downloadBase64File(name: string, content: string | undefined): boolean {
  if (typeof content !== "string" || !SAFE_FILE_URL.test(content)) return false;
  const link = document.createElement("a");
  link.href = content;
  link.download = name || "attachment";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

/** What apiCall throws on a refusal: the server's message, with the status and the reply's data. */
export type ApiError = Error & { status?: number; data?: unknown };

/** The `data.code` of a refusal apiCall threw, if any (e.g. "DIVISION_GAP"). */
export function apiErrorCode(err: unknown): string | undefined {
  const data = (err as ApiError | null | undefined)?.data;
  const code = data && typeof data === "object" ? (data as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : undefined;
}

// Secure Fetch API wrapper
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("ipfms_token");
  
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: token } : {}),
    ...(options.headers || {}),
  };

  const fullUrl = endpoint.startsWith("http") ? endpoint : endpoint;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json;
  try {
    if (text.trim().toLowerCase().startsWith("<!doctype")) {
      throw new Error("Server returned an HTML response instead of JSON (Possible 404 or Server Crash)");
    }
    json = text ? JSON.parse(text) : {};
  } catch (err: any) {
    if (!response.ok) {
      throw new Error(`API error occurred (Status: ${response.status}) - ${err.message || "Invalid JSON"}`);
    }
    throw new Error(`Invalid response format from server: ${err.message}`);
  }

  if (!response.ok) {
    // The status and the reply's data go with the message, for a screen that acts on one particular
    // refusal (a division left with nobody at the office, which HR may confirm).
    const error: ApiError = new Error(json.message || `API error occurred (Status: ${response.status})`);
    error.status = response.status;
    error.data = json.data;
    throw error;
  }
  return json;
}

// Icon mapper helper for various request types
export function getRequestTypeColor(type: RequestType): string {
  switch (type) {
    case RequestType.LEAVE:
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case RequestType.SERVICE_RECORD:
      return "border-blue-200 bg-blue-50 text-blue-800";
    case RequestType.VEHICLE:
      return "border-amber-200 bg-amber-50 text-amber-800";
    case RequestType.ZOOM:
      return "border-indigo-200 bg-indigo-50 text-indigo-800";
    case RequestType.SUPPLY:
      return "border-purple-200 bg-purple-50 text-purple-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-800";
  }
}

// Get the current local date formatted as YYYY-MM-DD
export function getLocalTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Whole calendar days from today until a YYYY-MM-DD date; negative once it has passed.
export function daysUntil(dateString: string): number {
  const [y, m, d] = dateString.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = getLocalTodayString().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

/**
 * First usable timestamp among candidate date fields, or 0 — never NaN.
 *
 * The unified request lists merge sources that name their date differently: personnel
 * requests carry `dateRequested`, liquidation submissions `dateSubmitted`, and only
 * newer records have `createdAt`. `new Date(undefined).getTime()` is NaN, and a NaN
 * comparator makes Array.sort behave unpredictably — so a single dateless row does not
 * merely sort itself last, it scrambles the ordering of everything around it.
 */
export function firstTimestamp(...candidates: (string | undefined | null)[]): number {
  for (const c of candidates) {
    // Only text: a stored date that is a number or an object (an older or tampered record) is passed over.
    if (typeof c !== "string" || !c) continue;
    const t = new Date(c).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

/** The first candidate that parses as a date, for display. Empty string when none do. Only text counts: the lists
 * call `.split` on what this returns, and a number stored as a request's date would take the screen down. */
export function firstDateString(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    if (typeof c !== "string" || !c) continue;
    if (!isNaN(new Date(c).getTime())) return c;
  }
  return "";
}
