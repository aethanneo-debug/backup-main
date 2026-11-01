import { useRef, useState } from "react";
import { Eye, Loader2, Upload } from "lucide-react";
import type { AttendanceCertificateView } from "../../types";
import { FILE_INPUT_ACCEPT, fileProblem, pickedFileProblem } from "../../fileRules";
import { apiCall, formatDate } from "../../utils";
import FileViewer, { type CertificateFile } from "../ui/FileViewer";

interface CertificatePanelProps {
  participantId: string;
  certificate?: AttendanceCertificateView | null;
  /** Why it can't be uploaded now, when it can't. */
  blockedReason?: string | null;
  /** Whether the person looking at it may upload it. */
  canUpload: boolean;
  /** Whose it is, on a list of several people. */
  ownerName?: string;
  /** After an upload, with the server's own words. */
  onUploaded: (message: string) => void;
  /** While an upload is in flight, so a dialog around it stays open until it is answered. */
  onBusy?: (busy: boolean) => void;
}

const BUTTON =
  "inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * A seat's certificate of attendance (the instructor's review, R4): on the employee's seminar card, and
 * on HR's attendance list, where it is HR's basis for "Attended". The list carries only what is on
 * file; the file opens through its own route, which checks who is asking.
 */
export default function CertificatePanel({ participantId, certificate, blockedReason, canUpload, ownerName, onUploaded, onBusy }: CertificatePanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<CertificateFile | null>(null);
  // The one just uploaded, shown until the list catches up (or if its reload fails).
  const [justUploaded, setJustUploaded] = useState<AttendanceCertificateView | null>(null);
  const shown = justUploaded && (!certificate || justUploaded.uploadedAt > certificate.uploadedAt) ? justUploaded : certificate;
  const whose = ownerName ? `: ${ownerName}` : "";

  function working(on: boolean) {
    setBusy(on);
    onBusy?.(on);
  }

  function upload(file: File) {
    const picked = pickedFileProblem(file.name, file.size);
    setError(picked);
    if (picked) return;
    working(true);
    const reader = new FileReader();
    reader.onerror = () => {
      working(false);
      setError(`"${file.name}" couldn't be read. Try again.`);
    };
    reader.onload = async () => {
      const content = reader.result as string;
      const problem = fileProblem(file.name, content, file.type);
      if (problem) {
        working(false);
        setError(problem);
        return;
      }
      try {
        const res = await apiCall(`/api/training/participants/${encodeURIComponent(participantId)}/certificate`, {
          method: "POST",
          body: JSON.stringify({ name: file.name, type: file.type, content })
        });
        if (res?.data) setJustUploaded(res.data);
        onUploaded(res?.message || "Certificate of attendance uploaded.");
      } catch (err: any) {
        setError(err?.message || "The certificate could not be uploaded.");
      } finally {
        working(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className="font-mono text-[10px] uppercase text-slate-400">Certificate of attendance</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${shown ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          {shown ? "On file" : "Not on file"}
        </span>
        {shown && (
          <button type="button" onClick={() => setViewing({ participantId, name: shown.name })} className={`${BUTTON} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            <Eye size={11} aria-hidden="true" /> View<span className="sr-only"> the certificate{whose}</span>
          </button>
        )}
        {canUpload && !blockedReason && (
          <>
            <input
              ref={input}
              type="file"
              accept={FILE_INPUT_ACCEPT}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={e => {
                const chosen = e.target.files?.[0];
                if (chosen) upload(chosen);
                // So the same file can be picked again, once fixed.
                e.target.value = "";
              }}
            />
            <button
              type="button"
              id={`certificate-upload-${participantId}`}
              onClick={() => input.current?.click()}
              disabled={busy}
              className={`${BUTTON} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
            >
              {busy ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Upload size={11} aria-hidden="true" />}
              {busy ? "Uploading…" : shown ? "Replace" : "Upload"}<span className="sr-only"> the certificate{whose}</span>
            </button>
          </>
        )}
      </div>
      {shown && (
        <p className="break-words text-[10px] text-slate-500">
          {shown.name}{shown.size ? ` · ${shown.size}` : ""} · uploaded {formatDate(shown.uploadedAt)} by {shown.uploadedBy}
        </p>
      )}
      {!shown && canUpload && !blockedReason && <p className="text-[10px] text-slate-500">PDF, JPEG or PNG, up to 5 MB.</p>}
      {blockedReason && <p className="text-[10px] text-slate-500">{blockedReason}</p>}
      {error && <p role="alert" className="text-[11px] text-rose-700">{error}</p>}
      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
