import { CheckCircle2, FileSearch } from "lucide-react";
import type { ReportView } from "./reportView";

// A report's contents, on screen or on the printed sheet: the same model, so they can't disagree. On screen the table
// scrolls inside its own area with its heading in view; on paper it runs on, its heading repeating on each page.

const STYLE = {
  screen: {
    table: "w-full table-fixed border-separate border-spacing-0 text-left text-xs",
    head: "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-2.5 align-bottom font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500",
    cell: "break-words border-b border-slate-100 bg-white px-2 py-2.5 align-top text-slate-700",
    foot: "sticky bottom-0 z-10 border-t border-slate-300 bg-slate-100 px-2 py-2.5 align-top font-bold text-slate-800"
  },
  // As the official sheets print: dark rules, and shaded headings kept by the print stylesheet.
  print: {
    table: "w-full table-fixed border-collapse text-left text-[9px] leading-snug",
    head: "border border-slate-600 bg-slate-100 px-1.5 py-1.5 align-middle text-[8px] font-bold uppercase tracking-wide",
    cell: "break-words border border-slate-600 px-1.5 py-1 align-top",
    foot: "border border-slate-600 bg-slate-100 px-1.5 py-1 align-top font-bold"
  }
} as const;

function ReportTable({ view, variant }: { view: ReportView; variant: "screen" | "print" }) {
  const style = STYLE[variant];
  const alignOf = (align?: "right") => (align === "right" ? "text-right" : "text-left");
  const table = (
    <table data-report-table="" className={style.table} style={variant === "screen" ? { minWidth: view.minWidth } : undefined}>
      <caption className="sr-only">{view.caption}</caption>
      <colgroup>
        {view.columns.map(column => <col key={column.key} style={{ width: column.width }} />)}
      </colgroup>
      <thead>
        <tr>
          {view.columns.map(column => (
            <th key={column.key} scope="col" className={`${style.head} ${alignOf(column.align)}`}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {view.rows.map(row => {
          const id = view.rowKey(row);
          return (
            <tr key={id} data-report-row={id}>
              {view.columns.map(column => (
                <td key={column.key} data-column={column.key} className={`${style.cell} ${alignOf(column.align)}`}>{column.cell(row)}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
      {view.footer && (
        <tfoot>
          <tr data-report-totals="">
            {view.footer.map(cell => (
              <td key={cell.key} data-column={cell.key} colSpan={cell.colSpan} className={`${style.foot} ${alignOf(cell.align)}`}>{cell.content}</td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
  if (variant === "print") return table;
  return (
    // Its own height, so the heading stays in view over a long list, with the sideways scrollbar. It takes the keyboard
    // focus so the arrow keys can scroll it.
    <div
      role="region"
      aria-label={view.caption}
      tabIndex={0}
      className="custom-scrollbar relative max-h-[65vh] overflow-auto rounded-lg border border-slate-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
    >
      {table}
    </div>
  );
}

function ReportEmptyState({ view, variant }: { view: ReportView; variant: "screen" | "print" }) {
  const { title, detail, good, action } = view.empty;
  if (variant === "print") return <p className="border border-slate-600 p-3 text-center text-[10px] italic text-slate-600">{title}</p>;
  const Icon = good ? CheckCircle2 : FileSearch;
  return (
    <div
      data-report-state="empty"
      className={`flex flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-8 text-center ${good ? "border-emerald-200 bg-emerald-50" : "border-slate-300 bg-slate-50"}`}
    >
      <Icon size={22} className={good ? "text-emerald-600" : "text-slate-400"} aria-hidden="true" />
      <p className={`break-words text-sm font-medium ${good ? "text-emerald-800" : "text-slate-700"}`}>{title}</p>
      {detail && <p className="max-w-md break-words text-xs text-slate-500">{detail}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 cursor-pointer rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default function ReportSheet({ view, variant }: { view: ReportView; variant: "screen" | "print" }) {
  return (
    <div className="space-y-3">
      {view.details}
      {view.rows.length > 0 ? <ReportTable view={view} variant={variant} /> : <ReportEmptyState view={view} variant={variant} />}
      {view.totals && <div data-report-totals="" className="break-inside-avoid">{view.totals}</div>}
    </div>
  );
}
