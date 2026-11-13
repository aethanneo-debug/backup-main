import { useRef, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronRight, ClipboardCheck, Upload } from "lucide-react";
import type { DocumentKind, LiquidationDocument, TravelDeclaration } from "../../types";
import { MAX_REPORT_FILES, FILE_INPUT_ACCEPT } from "../../fileRules";
import { DOCUMENT_SLOTS, FINANCE_KINDS, TRAVEL_DECLARATIONS, readDeclarations, type DocumentSlot, type RequiredDocument } from "../../reportDocuments";

interface RequiredDocumentsProps {
  required: RequiredDocument[];
  /** A Reimbursement isn't asked about the trip. */
  reimbursement: boolean;
  declarations: TravelDeclaration[];
  /** False on a correction: what was ticked stays as filed. */
  declarationsOpen: boolean;
  onDeclarations: (next: TravelDeclaration[]) => void;
  /** Why "No travel" can't be ticked on this report (a vehicle request, a Transportation line), or "". */
  noTravelBlocked?: string;
  /** Whether a file can be added to this slot now (a correction opens only some). */
  canAdd: (kind: DocumentKind) => boolean;
  /** What a reviewer named as missing. */
  asked: DocumentKind[];
  /** The reviewer's note on it, shown in each slot asked for (R7). */
  askedNote?: string;
  onAddFiles: (kind: DocumentKind, files: File[]) => void;
  /** Everything on the form, certificates included. */
  files: LiquidationDocument[];
  renderFile: (file: LiquidationDocument) => ReactNode;
  /** The certificate's own lines: it comes from the attendee's upload, not from this form. */
  certificate: ReactNode;
  /** Whether the certificate slot is filled. */
  certificateOnFile: boolean;
  /** The reviewer's notes and any file refused, under the list. */
  children?: ReactNode;
}

const ROW = "rounded-lg border px-2.5 py-2";

function Slot({ slot, why, required, filled, asked, note, canAdd, onAddFiles, children }: {
  slot: DocumentSlot;
  why?: string;
  required: boolean;
  filled: boolean;
  asked: boolean;
  note?: string;
  canAdd: boolean;
  onAddFiles: (kind: DocumentKind, files: File[]) => void;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const noteId = asked && note ? `slot-note-${slot.kind}` : undefined;
  const [dragging, setDragging] = useState(false);
  const drop = canAdd ? {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      onAddFiles(slot.kind, Array.from(e.dataTransfer.files ?? []));
    }
  } : {};
  return (
    <li
      data-document-kind={slot.kind}
      data-correction-target={`addDocument:${slot.kind}`}
      {...drop}
      className={`${ROW} ${dragging ? "border-blue-500 bg-blue-50/50" : asked && !filled ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-start gap-1 text-[11px] font-semibold text-slate-800">
            {filled && <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />}
            <span className="min-w-0 break-words">
              {slot.plate}
              {required && <span className="text-rose-600" aria-hidden="true"> *</span>}
              <span className="sr-only">{required ? ", required" : ", optional"}{filled ? ", attached" : ""}</span>
            </span>
          </p>
          {why && <p className="mt-0.5 text-[10px] text-slate-500">{why}</p>}
          {asked && !filled && <p className="mt-0.5 text-[10px] font-semibold text-amber-800">The reviewer asked for this.</p>}
          {noteId && <p id={noteId} className="mt-0.5 break-words text-[10px] text-amber-800">The reviewer: &ldquo;{note}&rdquo;</p>}
        </div>
        {canAdd && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={FILE_INPUT_ACCEPT}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={e => {
                onAddFiles(slot.kind, Array.from(e.target.files ?? []));
                // So the same file can be picked again, once fixed or after a Remove.
                e.target.value = "";
              }}
            />
            <button
              type="button"
              id={`document-upload-${slot.kind}`}
              data-correction-control
              aria-describedby={noteId}
              onClick={() => input.current?.click()}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Upload size={11} aria-hidden="true" /> Upload<span className="sr-only">: {slot.plate}</span>
            </button>
          </>
        )}
      </div>
      {children && <div className="mt-1.5 space-y-1">{children}</div>}
    </li>
  );
}

/**
 * The named documents on a seminar's report (the instructor's review, R5): what this report needs, and
 * why, filled slot by slot. The rules are in src/reportDocuments.ts, the same on the server. The
 * certificate comes from the attendee's own upload (R4), so it is shown here, never asked for again.
 */
export default function RequiredDocuments({
  required, reimbursement, declarations, declarationsOpen, onDeclarations, noTravelBlocked = "", canAdd, asked, askedNote, onAddFiles, files,
  renderFile, certificate, certificateOnFile, children
}: RequiredDocumentsProps) {
  const filesOf = (kind: DocumentKind) => (files ?? []).filter(f => (f.kind ?? "receipts") === kind);
  // A document the reviewer asked for is answered only by a new copy: one already on the report isn't it.
  const filled = (kind: DocumentKind) => kind === "certificate" ? certificateOnFile
    : filesOf(kind).some(f => !f.supersededAt && (!asked.includes(kind) || !!f.content));
  const why = (kind: DocumentKind) => required.find(r => r.kind === kind)?.why;
  // What the report needs, what the reviewer asked for, what is already in a slot, and the receipts every report
  // can bring.
  const shown = DOCUMENT_SLOTS.filter(s => why(s.kind) || asked.includes(s.kind) || filesOf(s.kind).length > 0
    || (s.kind === "receipts" && canAdd(s.kind)));
  // (Never the OR for cash handed back: the Finance Officer attaches it when validating, 12ai. One already on a report
  // filed before that still shows in its slot.)
  const employeeCanAdd = (kind: DocumentKind) => kind !== "certificate" && !FINANCE_KINDS.includes(kind) && canAdd(kind);
  const more = DOCUMENT_SLOTS.filter(s => !shown.includes(s) && employeeCanAdd(s.kind));
  const declared = TRAVEL_DECLARATIONS.filter(d => declarations.includes(d.value));

  function toggle(value: TravelDeclaration, on: boolean) {
    onDeclarations(readDeclarations(on ? [...declarations, value] : declarations.filter(d => d !== value)) ?? []);
  }

  const slot = (s: DocumentSlot) => (
    <Slot
      key={s.kind}
      slot={s}
      why={why(s.kind)}
      required={!!why(s.kind) || asked.includes(s.kind)}
      filled={filled(s.kind)}
      asked={asked.includes(s.kind)}
      note={askedNote}
      canAdd={employeeCanAdd(s.kind)}
      onAddFiles={onAddFiles}
    >
      {s.kind === "certificate" ? certificate : filesOf(s.kind).map(renderFile)}
    </Slot>
  );

  return (
    <section aria-labelledby="required-documents-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-blue-600 px-3 py-2">
        <ClipboardCheck size={12} className="text-white" aria-hidden="true" />
        <h3 id="required-documents-heading" className="font-mono text-[10px] font-bold uppercase tracking-widest text-white">Required Documents</h3>
      </div>
      <div className="space-y-3 p-3">
        {!reimbursement && (declarationsOpen ? (
          <fieldset className="min-w-0">
            <legend className="mb-1 text-[11px] font-semibold text-slate-700">
              What applies to this seminar? <span className="font-normal text-slate-500">(tick any that do)</span>
            </legend>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {TRAVEL_DECLARATIONS.map(d => {
                const ticked = declarations.includes(d.value);
                // With no travel there is no itinerary to depart from; and "No travel" can't be ticked against a
                // vehicle request or a Transportation line (one already ticked stays, so it can be unticked).
                const off = (d.value === "itineraryNotFollowed" && declarations.includes("noTravel"))
                  || (d.value === "noTravel" && !!noTravelBlocked && !ticked);
                return (
                  <li key={d.value}>
                    <label className={`flex items-start gap-2 text-[11px] ${off ? "cursor-not-allowed text-slate-400" : "cursor-pointer text-slate-700"}`}>
                      <input
                        type="checkbox"
                        checked={!off && ticked}
                        disabled={off}
                        onChange={e => toggle(d.value, e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
                      />
                      <span>
                        {d.label}
                        {d.value === "noTravel" && noTravelBlocked && (
                          <span className={`block text-[10px] ${ticked ? "font-semibold text-amber-800" : "text-slate-500"}`}>{noTravelBlocked}</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : declared.length > 0 && (
          <p className="text-[11px] text-slate-600">
            <span className="font-semibold">Ticked when you filed:</span> {declared.map(d => d.label).join("; ")}.
          </p>
        ))}

        <ul className="space-y-1.5">{shown.map(slot)}</ul>

        {more.length > 0 && (
          <details className="group rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <ChevronRight size={12} className="transition-transform group-open:rotate-90" aria-hidden="true" />
              Other documents you can attach ({more.length})
            </summary>
            <ul className="mt-1.5 space-y-1.5">{more.map(slot)}</ul>
          </details>
        )}

        <p className="text-[10px] text-slate-500">PDF, JPEG or PNG, up to 5 MB each and {MAX_REPORT_FILES} files at a time. You can drop a file on a row.</p>
        {children}
      </div>
    </section>
  );
}
