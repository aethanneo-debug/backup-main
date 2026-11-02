import { useEffect } from "react";

// Waits up to about 4 seconds for the first element on screen that one of `selectors` finds (best first): a
// screen's lists load on their own. It outlines the element for a moment (index.css, [data-highlight]). When
// `control` picks a control in it, that control is brought to the middle and takes the keyboard focus (R7): on
// a narrow screen a part can be taller than the window, and the control is what is needed. Otherwise the element
// itself is brought into view, as before. Returns what stops the wait and takes the outline off.
function outlineWhenShown(selectors: string[], control?: (el: HTMLElement) => HTMLElement | null): () => void {
  let timer: number | undefined;
  let shown: HTMLElement | null = null;
  let release: (() => void) | undefined;
  let tries = 0;
  const find = () => {
    for (const selector of selectors) {
      // The first one actually on screen: a record can also sit in a closed list (Programs &
      // Budget's Archived Seminars), which opens a moment later, and outlining it there shows nothing.
      const el = [...document.querySelectorAll<HTMLElement>(selector)].find(e => e.getClientRects().length > 0);
      if (el) {
        shown = el;
        const focused = control?.(el) ?? null;
        if (focused) centre(focused);
        else el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.setAttribute("data-highlight", "true");
        timer = window.setTimeout(() => el.removeAttribute("data-highlight"), 2600);
        if (focused) {
          focused.focus({ preventScroll: true });
          release = keepInView(focused);
        }
        return;
      }
    }
    if (++tries < 40) timer = window.setTimeout(find, 100);
  };
  find();
  return () => {
    if (timer) window.clearTimeout(timer);
    release?.();
    shown?.removeAttribute("data-highlight");
  };
}

// The nearest box that really scrolls an element up and down (the portal's <main>), or the page.
function scrollingBox(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === "auto" || overflowY === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

// What "in view" means for an element: the part of that box the window shows.
function visibleBox(el: HTMLElement): { top: number; bottom: number } {
  const box = scrollingBox(el);
  if (box === document.scrollingElement || box === document.documentElement) return { top: 0, bottom: window.innerHeight };
  const r = box.getBoundingClientRect();
  return { top: Math.max(r.top, 0), bottom: Math.min(r.bottom, window.innerHeight) };
}

// The nearest box that really scrolls it sideways, if any. The sheet has its own, so in a narrower window a box on
// it can be clipped with nothing else to scroll.
function sidewaysBox(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowX } = getComputedStyle(p);
    if ((overflowX === "auto" || overflowX === "scroll") && p.scrollWidth > p.clientWidth) return p;
  }
  return null;
}

// How far a box has to scroll sideways to show a control whole, or 0. A control wider than the box shows its
// start. The margin has to fit on both sides, or a control almost as wide as the box swings from side to side.
export function sidewaysOffset(control: { left: number; width: number }, box: { left: number; width: number }): number {
  if (control.width > box.width) return control.left - box.left - 8;
  const margin = Math.max(0, Math.min(8, (box.width - control.width) / 2));
  if (control.left < box.left) return control.left - box.left - margin;
  const over = control.left + control.width - (box.left + box.width);
  return over > 0 ? over + margin : 0;
}

function sideways(control: HTMLElement, box: HTMLElement): number {
  return sidewaysOffset(control.getBoundingClientRect(), { left: box.getBoundingClientRect().left, width: box.clientWidth });
}

// A table scrolls inside the desk's own scrolling area: a box inside another has to come into view itself.
function showBox(box: HTMLElement) {
  const outer = scrollingBox(box);
  if (outer === document.scrollingElement || outer === document.documentElement) return;
  const r = box.getBoundingClientRect();
  const o = outer.getBoundingClientRect();
  if (r.top >= o.top && r.bottom <= o.bottom) return;
  outer.scrollBy({ top: r.top - o.top - (outer.clientHeight - r.height) / 2, behavior: "smooth" });
}

// Brings a control to the middle of the box that scrolls it, and sideways only as far as needed. Not
// scrollIntoView: the form's parts sit in cards that clip their rounded corners with overflow:hidden, which makes
// each card a scroll box of its own, and the browser then centres the whole card. On a narrow screen a card is
// taller than the window, and the control ended up far out of view.
function centre(control: HTMLElement) {
  const box = scrollingBox(control);
  const page = box === document.scrollingElement || box === document.documentElement;
  if (!page) showBox(box);
  const r = control.getBoundingClientRect();
  const top = r.top - (page ? 0 : box.getBoundingClientRect().top) - ((page ? window.innerHeight : box.clientHeight) - r.height) / 2;
  const across = sidewaysBox(control);
  const left = across ? sideways(control, across) : 0;
  // (One call when one box does both: a second smooth scroll on a box stops the first.)
  if (across === box) {
    box.scrollBy({ top, left, behavior: "smooth" });
    return;
  }
  (page ? window : box).scrollBy({ top, behavior: "smooth" });
  if (across && left) across.scrollBy({ left, behavior: "smooth" });
}

function outOfView(control: HTMLElement): boolean {
  const r = control.getBoundingClientRect();
  const box = visibleBox(control);
  if (r.top < box.top || r.bottom > box.bottom) return true;
  const across = sidewaysBox(control);
  return !!across && Math.abs(sideways(control, across)) > 1;
}

// For about three seconds after landing, content still arriving above a control (a narrow screen wraps a lot)
// can push it out of view while it holds the keyboard focus: it is brought back. It stops as soon as the person
// scrolls, types, clicks or moves the focus, so it never fights them. Returns what stops it early.
function keepInView(control: HTMLElement): () => void {
  const events = ["wheel", "touchstart", "keydown", "pointerdown"];
  let timer: number | undefined;
  let looks = 0;
  const stop = () => {
    if (timer) window.clearTimeout(timer);
    events.forEach(type => window.removeEventListener(type, stop, true));
  };
  events.forEach(type => window.addEventListener(type, stop, { capture: true, passive: true }));
  const look = () => {
    if (document.activeElement !== control || ++looks > 8) return stop();
    if (outOfView(control)) centre(control);
    timer = window.setTimeout(look, 350);
  };
  timer = window.setTimeout(look, 500);
  return stop;
}

// Brings the record a notification is about into view and outlines it for a moment. Screens mark each
// record's element with data-record-id. It does nothing if the record never appears (e.g. it was filtered out
// or removed). `key` (the notice's nonce) lets the same record be shown again from a second notice. `focus`,
// a selector inside the record, is the control that takes the keyboard focus (R7), when it is there.
export function useRecordHighlight(id: string | null | undefined, key?: number, focus?: string) {
  useEffect(() => {
    if (!id) return;
    return outlineWhenShown([`[data-record-id="${CSS.escape(id)}"]`], focus ? el => el.querySelector<HTMLElement>(focus) : undefined);
  }, [id, key, focus]);
}

// The part of a form a notice is about (a returned report's first reopened part, R7): brought into view,
// outlined, and the keyboard focus on its control, the element marked data-correction-control in it (or the
// part itself). Runs once for each `key`, with the selectors of that render.
export function useFocusTarget(selectors: string[] | null | undefined, key?: number | null) {
  useEffect(() => {
    if (!key || !selectors?.length) return;
    return outlineWhenShown(selectors, el =>
      el.matches("[data-correction-control]") ? el : el.querySelector<HTMLElement>("[data-correction-control]") ?? el);
  }, [key]);
}
