import { useCallback, useEffect, useRef, useState } from "react";

/** A load in progress, done or failed. `data` is undefined until it arrives, and again while a retry runs. */
export interface ApiLoad<T> {
  data: T | undefined;
  loading: boolean;
  failed: boolean;
  /** The server's reason when it gave one (apiCall's message), else "". */
  message: string;
  retry: () => void;
}

type LoadState<T> = Omit<ApiLoad<T>, "retry">;

const isStarting = <T,>(s: LoadState<T>) => s.loading && !s.failed && s.data === undefined;

/**
 * Runs `load` once on mount, again on `retry`, and again whenever a value in `deps` changes (HR's fiscal-year chooser),
 * for the dashboards' panels. An answer that arrives after the screen has gone, or after a newer attempt started, is
 * dropped, so it can never overwrite what is shown. `load` throws (or rejects) when the data can't be had; the panel
 * then shows "—" and a Retry, never a zero it doesn't know.
 */
export function useApiLoad<T>(load: () => Promise<T>, deps: readonly unknown[] = []): ApiLoad<T> {
  const [state, setState] = useState<LoadState<T>>({ data: undefined, loading: true, failed: false, message: "" });
  const [attempt, setAttempt] = useState(0);
  // The latest `load`, read when an attempt starts (callers pass a new function on every render).
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    let live = true;
    setState(s => (isStarting(s) ? s : { data: undefined, loading: true, failed: false, message: "" }));
    latest.current().then(
      data => { if (live) setState({ data, loading: false, failed: false, message: "" }); },
      (err: unknown) => {
        if (!live) return;
        setState({ data: undefined, loading: false, failed: true, message: err instanceof Error ? err.message : "" });
      }
    );
    return () => { live = false; };
    // `load` is read through `latest`, so only a retry or a change in the caller's `deps` starts a new attempt.
  }, [attempt, ...deps]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { ...state, retry };
}
