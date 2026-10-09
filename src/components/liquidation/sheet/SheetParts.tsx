import React from "react";
import { longDate } from "./sheetFormat";

// A value written on the form, or a blank rule to be filled in by hand.
export function Fill({ value, className = "", minWidth = "6rem" }: { value?: string | null; className?: string; minWidth?: string }) {
  const text = (value ?? "").toString().trim();
  if (text) return <span className={className}>{text}</span>;
  return <span className="inline-block border-b border-black align-bottom" style={{ minWidth }}>&nbsp;</span>;
}

// One line of the totals block: the label, then an arrow and the amount (text on the
// printed report, sometimes an input on the filing form).
export function SheetTotalRow({ label, amount }: { label: React.ReactNode; amount: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={2} className="border-r-2 border-b-2 border-black px-2 py-1.5 align-middle">
        {label}
      </td>
      <td className="border-b-2 border-black px-2 py-1.5 align-middle">
        <div className="flex items-center justify-between gap-2">
          <span aria-hidden="true" className="text-[15px] leading-none">&rarr;</span>
          {amount}
        </div>
      </td>
    </tr>
  );
}

// One of the three certification boxes. Every box keeps the same rows, so the signature
// rules, captions and dates line up across all three.
export function CertificationCell({
  letter,
  statement,
  name,
  nameSlot,
  caption,
  signedAt,
  jevNo,
  className = "",
}: {
  letter: string;
  statement: string;
  name?: string;
  /** Replaces the printed name with a control, e.g. the filing form's Box B dropdown. */
  nameSlot?: React.ReactNode;
  caption: string;
  signedAt?: string;
  /** Only box C carries the JEV No. line; undefined leaves the row empty. */
  jevNo?: string | null;
  className?: string;
}) {
  const date = longDate(signedAt);
  return (
    <td className={`p-0 align-top text-[12px] leading-tight ${className}`}>
      <p className="min-h-[40px] px-1.5 pt-1">
        <span className="mr-1.5 inline-block border border-black px-[3px] leading-tight">{letter}</span>
        Certified: {statement}
      </p>
      {/* The signature goes above the rule; the system prints the name it knows. */}
      {nameSlot ? (
        <div className="flex h-[38px] items-end justify-center px-1 pb-0.5">{nameSlot}</div>
      ) : (
        <div className="flex h-[38px] items-end justify-center px-2 pb-0.5 text-[12px] font-bold uppercase">
          {(name || "").trim()}
        </div>
      )}
      <div className="border-t border-black" />
      <p className="pt-1 text-center">{caption}</p>
      <div className="h-[34px] px-1.5 pt-3">
        {jevNo !== undefined ? (
          <>
            JEV No.: <Fill value={jevNo} minWidth="9rem" />
          </>
        ) : null}
      </div>
      <p className="px-1.5 pb-1.5 pt-1">
        Date: {date ? date : <Fill minWidth="8rem" />}
      </p>
    </td>
  );
}
