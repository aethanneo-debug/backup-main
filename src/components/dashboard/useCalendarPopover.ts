import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";

/**
 * What the calendar's popover shows, and from which control (`anchor`, `key`): one seminar's details, or a day's
 * seminars ("+N more"). `pinned`: opened by a click or Enter, so it stays until Esc, a click outside, Close, or the
 * focus leaving it; otherwise it is a preview, on hover or focus, gone when the pointer or the focus leaves.
 */
export type CalendarPop =
  | { kind: "seminar"; id: string; anchor: HTMLElement; key: string; pinned: boolean; fromDay?: string }
  | { kind: "day"; date: string; anchor: HTMLElement; key: string; pinned: true };

/** Hover intent: a pointer that only passes over a bar doesn't open (or switch) the preview. */
const OPEN_DELAY = 200;
/** Time to move the pointer from a bar to its preview. */
const CLOSE_DELAY = 150;
const GAP = 6;
const MAX_WIDTH = 288;

/** The part of the screen `el` can be seen in: the viewport, cut by every ancestor that clips or scrolls. */
function visibleBand(el: HTMLElement): { top: number; bottom: number } {
  let top = 0, bottom = window.innerHeight;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflow = getComputedStyle(p).overflowY;
    if (overflow === "visible") continue;
    const r = p.getBoundingClientRect();
    top = Math.max(top, r.top);
    bottom = Math.min(bottom, r.bottom);
  }
  return { top, bottom };
}

/**
 * The calendar's popover: one at a time, placed under its control (above it when only there is room), inside the
 * calendar (`host`), never wider than it. Esc closes it and gives the focus back to the control, where no preview opens
 * again. A pinned one takes the focus, so a keyboard user can reach its button, and is scrolled into view.
 */
export function useCalendarPopover(host: RefObject<HTMLElement | null>) {
  const [pop, setPop] = useState<CalendarPop | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const current = useRef<CalendarPop | null>(null);
  const side = useRef<"below" | "above">("below");
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  // The focus being given back to a control: it must not open the preview again.
  const quiet = useRef(false);

  useLayoutEffect(() => {
    current.current = pop;
  });

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    openTimer.current = closeTimer.current = undefined;
  };

  const close = useCallback((giveFocusBack: boolean) => {
    clearTimers();
    const anchor = current.current?.anchor;
    current.current = null;
    setPop(null);
    if (giveFocusBack && anchor?.isConnected && document.activeElement !== anchor) {
      quiet.current = true;
      anchor.focus({ preventScroll: true });
      quiet.current = false;
    }
  }, []);

  const show = (next: CalendarPop) => {
    current.current = next;
    setPop(next);
  };

  const preview = (next: CalendarPop, delay: number) => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    const cur = current.current;
    if (cur?.pinned || (cur && cur.key === next.key)) return;
    if (delay > 0) openTimer.current = window.setTimeout(() => show(next), delay);
    else show(next);
  };

  const leave = () => {
    window.clearTimeout(openTimer.current);
    if (current.current?.pinned) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => { if (!current.current?.pinned) close(false); }, CLOSE_DELAY);
  };

  const pin = (next: CalendarPop) => {
    clearTimers();
    const cur = current.current;
    // A second click on the control that opened it closes it.
    if (cur?.pinned && cur.key === next.key && cur.kind === next.kind && !(cur.kind === "seminar" && cur.fromDay)) {
      close(true);
      return;
    }
    show(next);
  };

  /** The handlers of the bars and the "+N more" buttons. */
  const bar = {
    onEnter: (id: string, anchor: HTMLElement, key: string) => preview({ kind: "seminar", id, anchor, key, pinned: false }, OPEN_DELAY),
    onLeave: leave,
    onFocus: (id: string, anchor: HTMLElement, key: string) => {
      if (!quiet.current) preview({ kind: "seminar", id, anchor, key, pinned: false }, 0);
    },
    onBlur: (e: FocusEvent) => {
      if (!popRef.current?.contains(e.relatedTarget as Node | null)) leave();
    },
    onClick: (id: string, anchor: HTMLElement, key: string) => pin({ kind: "seminar", id, anchor, key, pinned: true }),
    onMore: (date: string, anchor: HTMLElement, key: string) => pin({ kind: "day", date, anchor, key, pinned: true })
  };

  /** From a day's list to one of its seminars, and back. */
  const showSeminar = (id: string) => {
    const cur = current.current;
    if (cur) pin({ kind: "seminar", id, anchor: cur.anchor, key: cur.key, pinned: true, fromDay: cur.kind === "day" ? cur.date : cur.fromDay });
  };
  const backToDay = () => {
    const cur = current.current;
    if (cur?.kind === "seminar" && cur.fromDay) pin({ kind: "day", date: cur.fromDay, anchor: cur.anchor, key: cur.key, pinned: true });
  };

  /**
   * The popover's own handlers: the pointer on it keeps a preview open; the focus leaving it closes it. It is drawn
   * after the grid, so Tab past its last button (or Shift+Tab before its first) closes it and gives the focus back to
   * its bar, from where Tab goes on through the calendar in order (the code review of 12ag). A preview's buttons are
   * out of the Tab order (CalendarPopover), so the keyboard reaches them by pinning it (Enter on the bar).
   */
  const panel = {
    onMouseEnter: () => window.clearTimeout(closeTimer.current),
    onMouseLeave: leave,
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
      if (e.key !== "Tab" || !popRef.current) return;
      const stops = [...popRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href]")].filter(el => el.tabIndex >= 0);
      const now = document.activeElement;
      const leaving = e.shiftKey ? now === popRef.current || now === stops[0] : now === stops[stops.length - 1] || stops.length === 0;
      if (!leaving) return;
      e.preventDefault();
      close(true);
    },
    onBlur: (e: FocusEvent) => {
      const to = e.relatedTarget as Node | null;
      if (to && (popRef.current?.contains(to) || current.current?.anchor === to)) return;
      // Checked once the focus has settled: a change of view inside the popover gives it the focus again. A preview
      // the focus was in (a click on its button) closes too, rather than staying over the calendar.
      window.setTimeout(() => {
        const cur = current.current, now = document.activeElement;
        if (!cur || popRef.current?.contains(now) || now === cur.anchor) return;
        close(false);
      }, 0);
    }
  };

  // Under its control (or above it, when only there is room), inside the calendar. `decide`: choose the side; a scroll
  // or a new size keeps it, so it doesn't jump from one side to the other.
  const place = useCallback((decide: boolean) => {
    const el = popRef.current, box = host.current, cur = current.current;
    if (!el || !box || !cur || !cur.anchor.isConnected) return;
    const hr = box.getBoundingClientRect(), ar = cur.anchor.getBoundingClientRect();
    const width = Math.max(0, Math.min(MAX_WIDTH, hr.width));
    el.style.width = `${width}px`;
    const height = el.offsetHeight;
    if (decide) {
      const band = visibleBand(box);
      const below = band.bottom - ar.bottom - GAP, above = ar.top - band.top - GAP;
      side.current = height > below && height <= above ? "above" : "below";
    }
    el.style.top = `${side.current === "above" ? ar.top - hr.top - GAP - height : ar.bottom - hr.top + GAP}px`;
    el.style.left = `${Math.min(Math.max(0, ar.left - hr.left), Math.max(0, hr.width - width))}px`;
  }, [host]);

  useLayoutEffect(() => {
    if (!pop) return;
    place(true);
    // A pinned one takes the focus (again when its view changes), so Tab reaches its buttons, and is brought into view.
    if (pop.pinned) {
      popRef.current?.focus({ preventScroll: true });
      popRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }, [pop, place]);

  // While one is open: Esc, a click outside, a new size, and a scroll (the grid scrolls sideways on a narrow screen).
  useEffect(() => {
    if (!pop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      const focusNear = popRef.current?.contains(document.activeElement) || document.activeElement === pop.anchor;
      close(pop.pinned || !!focusNear);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (popRef.current?.contains(t) || pop.anchor.contains(t))) return;
      close(false);
    };
    const onMove = (e: Event) => {
      // (A resize's target is the window, which isn't a Node.)
      if (!(e.target instanceof Node && popRef.current?.contains(e.target))) place(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [pop, close, place]);

  useEffect(() => () => clearTimers(), []);

  return { pop, popRef, close, bar, panel, showSeminar, backToDay };
}
