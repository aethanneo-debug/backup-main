import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { viewableFile, type ViewableFile } from "../../fileRules";
import { apiCall, downloadBase64File } from "../../utils";
import ModalDialog from "./ModalDialog";

/** A file attached to a report, as the lists name it. */
export interface ReportFile {
  reportId: string;
  docId: string;
  name: string;
}

type Loaded =
  | { stage: "loading" }
  | { stage: "failed"; message: string }
  | { stage: "ready"; name: string; content: string; view: ViewableFile["view"] | null; url: string };

function blobOf(file: ViewableFile): Blob {
  const text = atob(file.base64);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return new Blob([bytes], { type: file.type });
}

/**
 * Shows a report's file on screen, with Print and Download (the instructor's review, R6).
 *
 * A preview is a Blob URL made with a type from the allow-list, and only for a file that passes the
 * same check as an upload (src/fileRules.ts): a blob: page runs in the app's own origin, where the
 * sign-in token sits, so nothing else is ever rendered here. Images go in <img>, PDFs in the browser's
 * PDF viewer. The frame has no `sandbox` attribute because that blocks the viewer; the check is what
 * keeps it safe. Anything else can only be downloaded.
 */
export default function FileViewer({ file, onClose }: { file: ReportFile | null; onClose: () => void }) {
  if (!file) return null;
  return <Viewer key={`${file.reportId}/${file.docId}`} file={file} onClose={onClose} />;
}

function Viewer({ file, onClose }: { file: ReportFile; onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded>({ stage: "loading" });
  const frame = useRef<HTMLIFrameElement>(null);
  const printFrame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let alive = true;
    let url = "";
    // On the next tick: StrictMode mounts twice in development, and each officer's fetch is an audit entry.
    const start = setTimeout(async () => {
      try {
        const res = await apiCall(`/api/liquidation-submissions/${encodeURIComponent(file.reportId)}/documents/${encodeURIComponent(file.docId)}`);
        if (!alive) return;
        const name: string = res?.data?.name || file.name;
        const content = res?.data?.content;
        if (typeof content !== "string") throw new Error("This file can't be opened.");
        const checked = viewableFile(name, content);
        if (checked) url = URL.createObjectURL(blobOf(checked));
        setLoaded({ stage: "ready", name, content, view: checked?.view ?? null, url });
      } catch (err: any) {
        if (alive) setLoaded({ stage: "failed", message: err?.message || "This file couldn't be opened." });
      }
    }, 0);
    return () => {
      alive = false;
      clearTimeout(start);
      printFrame.current?.remove();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  function print() {
    if (loaded.stage !== "ready") return;
    if (loaded.view === "pdf") {
      try {
        frame.current?.contentWindow?.focus();
        frame.current?.contentWindow?.print();
      } catch {
        // A browser may keep its PDF viewer out of the page's reach: it opens in a tab with its own Print.
        window.open(loaded.url, "_blank", "noopener");
      }
      return;
    }
    // An image prints alone, from a page holding nothing else.
    printFrame.current?.remove();
    const sheet = document.createElement("iframe");
    sheet.title = "Print preview";
    sheet.style.cssText = "position:fixed;width:0;height:0;border:0;";
    document.body.appendChild(sheet);
    printFrame.current = sheet;
    const page = sheet.contentDocument;
    if (!page) return;
    page.title = loaded.name;
    const image = page.createElement("img");
    image.style.maxWidth = "100%";
    image.onload = () => {
      sheet.contentWindow?.focus();
      sheet.contentWindow?.print();
    };
    image.src = loaded.url;
    page.body.appendChild(image);
  }

  const name = loaded.stage === "ready" ? loaded.name : file.name;
  return (
    <ModalDialog
      title={name}
      subtitle="Attached to the liquidation report"
      icon={<FileText size={16} aria-hidden="true" />}
      onClose={onClose}
      size="xl"
      footer={
        <>
          {loaded.stage === "ready" && loaded.view && (
            <button type="button" onClick={print} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Printer size={13} aria-hidden="true" /> Print
            </button>
          )}
          {loaded.stage === "ready" && (
            <button type="button" onClick={() => downloadBase64File(loaded.name, loaded.content)} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Download size={13} aria-hidden="true" /> Download
            </button>
          )}
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Close
          </button>
        </>
      }
    >
      {loaded.stage === "loading" && (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Opening the file…
        </p>
      )}
      {loaded.stage === "failed" && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loaded.message}</p>
      )}
      {loaded.stage === "ready" && loaded.view === "image" && (
        <img
          src={loaded.url}
          alt={loaded.name}
          onError={() => setLoaded({ ...loaded, view: null })}
          className="mx-auto max-h-[68vh] max-w-full rounded-lg border border-slate-200"
        />
      )}
      {loaded.stage === "ready" && loaded.view === "pdf" && (
        <iframe ref={frame} src={loaded.url} title={loaded.name} className="h-[68vh] w-full rounded-lg border border-slate-200" />
      )}
      {loaded.stage === "ready" && !loaded.view && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This kind of file can&rsquo;t be shown here. Download it to open it on your device.
        </p>
      )}
    </ModalDialog>
  );
}
