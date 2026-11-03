import { useEffect, useState, type ReactNode } from "react";
import { apiCall } from "../../utils";

// What a training report is (the instructor's review, R11): one model per report, so what is on screen, what prints and
// what goes in the spreadsheet come from the same answer and can't disagree. Drawn by ReportPanel.tsx.

export type ReportKey = "history" | "program" | "completed" | "coverage";

export interface FiscalYearOption {
  label: string;
  active: boolean;
}

export interface ReportColumn<R> {
  key: string;
  header: string;
  align?: "right";
  /** Its share of the table. The columns are fixed, so a long word wraps inside its own and a printed sheet never runs past the page. */
  width: string;
  cell: (row: R) => ReactNode;
}

export interface ReportEmpty {
  title: string;
  detail?: string;
  /** Good news rather than a gap: everyone has a training. */
  good?: boolean;
  action?: { label: string; onClick: () => void };
}

export interface ReportView<R = any> {
  key: ReportKey;
  /** On the sheet, and in the preview's bar. */
  title: string;
  /** Under the title on the sheet. */
  subtitle: string;
  /** For the CSV and for a PDF printed from the preview: no extension, and never a person's name. */
  fileName: string;
  /** The table's name, for a screen reader. */
  caption: string;
  columns: ReportColumn<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  /** Narrower than this on screen, the table scrolls sideways. */
  minWidth: number;
  /** Read out beside the buttons. */
  status: string;
  /** Whether there is anything to print or download. */
  canExport: boolean;
  csv: () => unknown[][];
  /** Above the table. */
  details?: ReactNode;
  /** A totals row in the table's foot, one entry per cell. */
  footer?: { key: string; content: ReactNode; align?: "right"; colSpan?: number }[];
  /** Under the table. */
  totals?: ReactNode;
  /** What shows instead of the table when there are no rows. */
  empty: ReportEmpty;
}

export interface ReportLoad<T> {
  data: T | null;
  loading: boolean;
  /** Null while there is no error; "" when the server gave no reason. */
  error: string | null;
  retry: () => void;
}

/**
 * One report's answer, from a route with the usual envelope. Null asks for nothing, so nothing loads until it is chosen.
 * Only the newest answer is kept, and nothing from the last choice stays on screen (or printable) while the next loads.
 */
export function useReportData<T>(url: string | null): ReportLoad<T> {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null; loading: boolean }>({ url: null, data: null, error: null, loading: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) {
      setState({ url: null, data: null, error: null, loading: false });
      return;
    }
    let current = true;
    setState({ url, data: null, error: null, loading: true });
    apiCall(url)
      .then(res => {
        if (!current) return;
        if (res?.status === "success" && res.data) setState({ url, data: res.data, error: null, loading: false });
        else setState({ url, data: null, error: res?.message || "", loading: false });
      })
      .catch(err => {
        if (current) setState({ url, data: null, error: err?.message || "", loading: false });
      });
    return () => { current = false; };
  }, [url, attempt]);

  // Until the effect above has run for a new choice, what is held is the last choice's.
  const fresh = state.url === url;
  return {
    data: fresh ? state.data : null,
    loading: !!url && (!fresh || state.loading),
    error: fresh ? state.error : null,
    retry: () => setAttempt(n => n + 1)
  };
}
