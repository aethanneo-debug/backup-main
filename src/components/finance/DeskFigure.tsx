const NOTE = "rounded-lg border p-2.5 text-[11px]";

/**
 * Who validates a report at Finance's stage, when it isn't the usual Financial Officer (financeAction, 12ai): nobody
 * records the OR for cash they hand back themselves (`own`), and the Administrator validates a report handing back a
 * Financial Officer's own cash. Nothing otherwise.
 */
export function WhoValidatesNote({ may, administrator }: { may: { act: boolean; validate: boolean; reason?: string; own?: boolean; fallback?: boolean }; administrator: boolean }) {
  // The one exception: the Administrator's own cash is in it too, and no Financial Officer free of it can validate it.
  if (may.fallback) {
    return (
      <p className={`${NOTE} border-amber-200 bg-amber-50 text-amber-900`}>
        <strong>Your own cash is in this report too.</strong> It hands back a Financial Officer&rsquo;s cash and yours, and
        nobody else free of it can validate it, so you may: it will be flagged as self-approved, and Finance and HR are told.
        A Return sends the correction to HR first.
      </p>
    );
  }
  if (may.own && may.reason) return <p className={`${NOTE} border-amber-200 bg-amber-50 text-amber-900`}>{may.reason}</p>;
  if (may.validate && administrator) {
    return (
      <p className={`${NOTE} border-blue-200 bg-blue-50 text-blue-800`}>
        This report hands back a Financial Officer&rsquo;s own cash, so they can&rsquo;t record its official receipt: you
        validate it, recording the OR, or return it.
      </p>
    );
  }
  return null;
}

/** One figure of a claim in the report's View on the Liquidation Desk (DeskReportView): a label over an amount. */
export default function DeskFigure({ label, tone = "plain", children }: { label: string; tone?: "plain" | "amber" | "rose"; children: string }) {
  const box = tone === "rose" ? "border-rose-200 bg-rose-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white";
  const word = tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : "text-slate-500";
  const figure = tone === "rose" ? "text-rose-800" : tone === "amber" ? "text-amber-800" : "text-slate-700";
  return (
    <div className={`rounded border p-2 ${box}`}>
      <span className={`block font-mono text-[9px] font-semibold ${word}`}>{label}</span>
      <strong className={`font-mono text-xs ${figure}`}>{children}</strong>
    </div>
  );
}
