import type { LiquidationSubmission } from "../../types";
import { DOCUMENT_SLOTS, documentPlate } from "../../reportDocuments";

/**
 * The attachments of a liquidation report, on a page of its own after the official form, which stays as
 * COA prints it (the instructor's review, R4 and R5). It names what is attached; each file prints from the
 * file viewer. A copy a correction replaced isn't listed.
 */
export default function ReportAttachments({ report }: { report: LiquidationSubmission }) {
  const docs = (Array.isArray(report.supportingDocs) ? report.supportingDocs : []).filter(d => d && !d.supersededAt);
  if (docs.length === 0) return null;
  // In the slots' order; a file from before the named documents has none, and comes last.
  const order = (kind?: string) => {
    const at = DOCUMENT_SLOTS.findIndex(s => s.kind === kind);
    return at < 0 ? DOCUMENT_SLOTS.length : at;
  };
  const listed = [...docs].sort((a, b) => order(a.kind) - order(b.kind));
  return (
    <section
      aria-labelledby="lr-attachments-heading"
      className="mx-auto mt-4 w-full min-w-[680px] max-w-[800px] bg-white p-6 text-[11px] text-black print:mt-0 print:min-w-0 print:max-w-none print:break-before-page print:p-0"
    >
      <h3 id="lr-attachments-heading" className="text-sm font-bold">Attachments</h3>
      <p className="mt-0.5">
        Liquidation Report {report.serialNo || report.submissionNo}, {report.employeeName}
        {report.activityTitle ? `, ${report.activityTitle}` : ""}
      </p>
      <table className="mt-3 w-full border-collapse text-left">
        <thead>
          <tr>
            <th scope="col" className="w-8 border border-black px-2 py-1 font-semibold">No.</th>
            <th scope="col" className="border border-black px-2 py-1 font-semibold">Document</th>
            <th scope="col" className="border border-black px-2 py-1 font-semibold">File</th>
          </tr>
        </thead>
        <tbody>
          {listed.map((doc, i) => (
            <tr key={doc.id || i}>
              <td className="border border-black px-2 py-1 align-top">{i + 1}</td>
              <td className="border border-black px-2 py-1 align-top">{documentPlate(doc.kind) || "Supporting document"}</td>
              <td className="break-all border border-black px-2 py-1 align-top">{doc.name || doc.filename || "Unnamed file"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
