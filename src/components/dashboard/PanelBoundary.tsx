import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface PanelBoundaryProps {
  /** What the panel is, for the message: "The training calendar". */
  name: string;
  /** The fallback box's classes, so it takes the panel's place in a grid (e.g. "xl:col-span-2"). */
  className?: string;
  children: ReactNode;
}

/**
 * One dashboard panel that fails on its own (12ag; the security review of 2026-11-11). A stored record of a shape the
 * panel can't draw makes React throw while rendering, and the app has no other boundary, so without this the whole
 * page (the sidebar included) would go blank, on the landing page, at every sign-in. Here only this box shows, and the
 * rest of the dashboard keeps working. React itself logs the error to the console. "Try again" draws the panel afresh,
 * which helps when what it read has since changed.
 */
export default class PanelBoundary extends Component<PanelBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div data-panel-failed role="alert" className={`min-w-0 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 shadow-sm ${this.props.className ?? ""}`}>
        <p className="flex items-start gap-1.5 font-semibold">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{this.props.name} couldn&rsquo;t be shown.</span>
        </p>
        <p className="mt-1 text-[11px] leading-snug">
          The rest of the dashboard still works. If it happens again, a record it reads may be damaged: report it, with the time it happened.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded text-[11px] font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <RefreshCcw size={11} aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }
}
