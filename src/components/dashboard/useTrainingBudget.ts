import { apiCall } from "../../utils";
import { budgetFigures, type TrainingBudgetFigures } from "./budgetRows";
import { useApiLoad } from "./useApiLoad";

export interface TrainingBudgetLoad {
  /** The active fiscal year, once loaded. */
  fiscalYear: { id: string; label: string } | null;
  /** Its training budget; null when none has been set for the year (or until it loads). */
  figures: TrainingBudgetFigures | null;
  loading: boolean;
  failed: boolean;
  message: string;
  retry: () => void;
}

interface Loaded {
  fiscalYear: { id: string; label: string };
  figures: TrainingBudgetFigures | null;
}

async function loadBudget(): Promise<Loaded> {
  // The active year's route answers with the record itself, not an envelope.
  const [fy, budgets] = await Promise.all([apiCall("/api/fiscal-years/active"), apiCall("/api/training/budgets")]);
  if (!fy || typeof fy.id !== "string" || fy.label === undefined || fy.label === null) throw new Error("No fiscal year is active.");
  if (budgets?.status !== "success") throw new Error(budgets?.message || "");
  const fiscalYear = { id: fy.id, label: String(fy.label) };
  const row = (Array.isArray(budgets.data) ? budgets.data : []).find(
    (b: unknown): b is Record<string, unknown> => !!b && typeof b === "object" && (b as Record<string, unknown>).fiscalYearId === fiscalYear.id
  );
  return { fiscalYear, figures: row ? budgetFigures(row) : null };
}

/** The active fiscal year and its training budget, for the Administrator's dashboard (12ag). */
export function useTrainingBudget(): TrainingBudgetLoad {
  const load = useApiLoad(loadBudget);
  return {
    fiscalYear: load.data?.fiscalYear ?? null,
    figures: load.data?.figures ?? null,
    loading: load.loading,
    failed: load.failed,
    message: load.message,
    retry: load.retry
  };
}
