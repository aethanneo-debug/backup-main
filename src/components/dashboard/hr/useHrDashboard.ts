import { apiCall } from "../../../utils";
import type { HrDashboard } from "../../../types";
import { useApiLoad, type ApiLoad } from "../useApiLoad";

/** A fiscal year the chooser offers (`GET /api/fiscal-years`, which answers with the list itself). */
export interface FiscalYearOption {
  label: string;
  active: boolean;
}

const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** The parts every panel reads are lists: an answer without them is refused, so no panel draws half a dashboard. */
function readHrDashboard(data: unknown): HrDashboard {
  const d = isRecord(data) ? data : null;
  const ok = !!d && typeof d.fiscalYear === "string" && typeof d.asOf === "string"
    && isRecord(d.headcount) && Array.isArray(d.headcount.byDivision) && Array.isArray(d.headcount.byStatus)
    && Array.isArray(d.trainingsPerEmployee) && Array.isArray(d.attendeesByMonth)
    && isRecord(d.attendance) && Array.isArray(d.attendance.seminars)
    && isRecord(d.followUp) && Array.isArray(d.followUp.rows) && Array.isArray(d.followUp.noClaim);
  if (!ok) throw new Error("The dashboard's answer couldn't be read.");
  return d as unknown as HrDashboard;
}

/** HR's dashboard for a fiscal year (its label), or the active one when `fiscalYear` is null (12ag Part B). */
export function useHrDashboard(fiscalYear: string | null): ApiLoad<HrDashboard> {
  return useApiLoad(async () => {
    const res = await apiCall(`/api/dashboard/hr${fiscalYear ? `?fiscalYear=${encodeURIComponent(fiscalYear)}` : ""}`);
    if (res?.status !== "success") throw new Error(res?.message || "");
    return readHrDashboard(res.data);
  }, [fiscalYear]);
}

/** The fiscal years for the chooser, newest first, the active one marked. */
export function useFiscalYears(): ApiLoad<FiscalYearOption[]> {
  return useApiLoad(async () => {
    const res = await apiCall("/api/fiscal-years");
    if (!Array.isArray(res)) throw new Error(res?.message || "");
    return res
      .filter((f): f is Record<string, unknown> => isRecord(f) && (typeof f.label === "string" || typeof f.label === "number"))
      .map(f => ({ label: String(f.label).slice(0, 20), active: f.status === "Active" }))
      .sort((a, b) => b.label.localeCompare(a.label));
  });
}
