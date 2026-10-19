import { useEffect } from "react";

// Brings the record a notification is about into view and outlines it for a moment
// (index.css, [data-highlight]). Screens mark each record's element with data-record-id. Their
// lists load on their own, so this waits up to about 4 seconds for the element to appear, and
// does nothing if it never does (e.g. the record was filtered out or removed). `key` (the
// notice's nonce) lets the same record be shown again from a second notice.
export function useRecordHighlight(id: string | null | undefined, key?: number) {
  useEffect(() => {
    if (!id) return;
    let timer: number | undefined;
    let shown: HTMLElement | null = null;
    let tries = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-record-id="${CSS.escape(id)}"]`);
      if (el) {
        shown = el;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.setAttribute("data-highlight", "true");
        timer = window.setTimeout(() => el.removeAttribute("data-highlight"), 2600);
      } else if (++tries < 40) {
        timer = window.setTimeout(find, 100);
      }
    };
    find();
    return () => {
      if (timer) window.clearTimeout(timer);
      shown?.removeAttribute("data-highlight");
    };
  }, [id, key]);
}
