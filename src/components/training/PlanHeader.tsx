import HsacLogo from "../HsacLogo";

// The title block of the official RAB-1 Training and Development Plan, in the
// same order the workbook prints it.
export default function PlanHeader({ planTitle, subtitle }: { planTitle: string; subtitle: string }) {
  return (
    <div className="text-center border-b border-slate-200 pb-4 mb-4 space-y-0.5">
      <div className="flex justify-center mb-2">
        <HsacLogo size={44} />
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-800">Human Settlements Adjudication Commission</p>
      <p className="text-[11px] text-slate-600">Regional Adjudication Branch 1</p>
      <p className="text-[10px] text-slate-500">Dona Pepita Building, Quezon Avenue, Barangay II, San Fernando City, La Union</p>
      <p className="text-sm font-extrabold uppercase tracking-wider text-slate-900 pt-2">{planTitle}</p>
      <p className="text-[11px] text-slate-600">{subtitle}</p>
    </div>
  );
}
