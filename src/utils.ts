import { RequestType, UserRole } from "./types";

// Formatting utility for Philippine Peso (PHP) currency values
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

// Formatting utility for human-readable dates
export function formatDate(dateString: string): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

// Convert JSON arrays to CSV format and prompt browser download
export function downloadCSV(data: any[], headers: string[], filename: string) {
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const val = row[header] !== undefined ? row[header] : "";
          const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
          // Escape quotes inside value
          const escaped = strVal.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",")
    ),
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
    throw new Error(json.message || `API error occurred (Status: ${response.status})`);
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
    if (!c) continue;
    const t = new Date(c).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

/** The first candidate that parses as a date, for display. Empty string when none do. */
export function firstDateString(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    if (!c) continue;
    if (!isNaN(new Date(c).getTime())) return c;
  }
  return "";
}
