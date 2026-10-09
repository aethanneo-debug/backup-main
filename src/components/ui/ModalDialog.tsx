import { ReactNode, RefObject, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Accessible modal shell: header (title, optional subtitle, close button), a scrolling
 * body and a footer for the buttons.
 *
 * - role="dialog" + aria-modal, labelled by its title.
 * - Focus moves in on open (the `initialFocusRef`, else the first control in the body)
 *   and returns to whatever opened it on close.
 * - Tab and Shift+Tab stay inside the dialog; Esc closes it.
 * - While `busy` (a save in flight) it can't be dismissed, so the outcome of the request
 *   is never lost with a dialog that is no longer on screen.
 *
 * Rendered through a portal so no ancestor's overflow or stacking context can clip it.
 * A child that uses Esc itself (e.g. to close a suggestion list) calls preventDefault()
 * on the key event; the dialog then leaves that key press alone.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

const WIDTHS = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-2xl" } as const;

interface ModalDialogProps {
  title: string;
  /** One line under the title: who or what the dialog is about. */
  subtitle?: string;
  /** A small lucide icon shown before the title. Pass aria-hidden="true". */
  icon?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  /** What to focus on open. Defaults to the first focusable control in the body. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  size?: keyof typeof WIDTHS;
  /** The action buttons, right-aligned (stacked on narrow screens). */
  footer: ReactNode;
  children: ReactNode;
}

export default function ModalDialog({
  title,
  subtitle,
  icon,
  onClose,
  busy = false,
  initialFocusRef,
  size = "md",
  footer,
  children
}: ModalDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  // The key handler is bound once; it reads the latest props through this ref.
  const latest = useRef({ onClose, busy });
  useEffect(() => {
    latest.current = { onClose, busy };
  });

  // Focus in once per opening, and give focus back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target =
      initialFocusRef?.current ??
      bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      panelRef.current;
    target?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const panel = panelRef.current;
      if (!panel || e.defaultPrevented) return;

      if (e.key === "Escape") {
        if (!latest.current.busy) {
          e.preventDefault();
          latest.current.onClose();
        }
        return;
      }
      if (e.key !== "Tab") return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.getClientRects().length > 0
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (!panel.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (current === first || current === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={`flex max-h-[90vh] w-full ${WIDTHS[size]} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-bold text-slate-800">
                {title}
              </h2>
              {subtitle && (
                <p id={subtitleId} className="mt-0.5 break-words text-xs text-slate-500">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div ref={bodyRef} className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">
          {footer}
        </div>
      </div>
    </div>,
    document.body
  );
}
