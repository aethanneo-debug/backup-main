import { useEffect, useState } from "react";
import type { TrainingCandidate } from "../../types";
import { apiCall } from "../../utils";
import type { PickerProgram } from "./ParticipantPickerModal";

/**
 * The participant picker's data: the server's ranking for the seminar as drafted (GET /api/training/recommendations),
 * loaded again when the draft or `reloadKey` changes. `serverCovers`: whether the seminar's own justification will cover
 * everyone on it (12z Part C), null until the server answers (the row's guess stands in meanwhile). Moved out of
 * ParticipantPickerModal.tsx as it was, when that file passed 400 lines (12ae).
 */
export function useRecommendations(program: PickerProgram, max: number, reloadKey: number) {
  const [candidates, setCandidates] = useState<TrainingCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [serverCovers, setServerCovers] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      title: program.title || "",
      fiscalYear: program.fiscalYear || "",
      targetDivision: program.targetDivision || "",
      targetSpecialization: program.targetSpecialization || "",
      maxParticipants: String(max),
      startDate: program.startDate || "",
      endDate: program.endDate || ""
    });
    if (!program.isNew) params.set("programId", program.id);
    // Repeatable needTitle, so an unsaved draft row ranks by the plan too. A row with no needs sends
    // one empty needTitle: with none at all, the server would go by the saved seminar's needs.
    const needTitles = program.fulfillsNeedTitles ?? [];
    if (needTitles.length === 0) params.append("needTitle", "");
    for (const title of needTitles) params.append("needTitle", title);

    setLoading(true);
    setError("");
    apiCall(`/api/training/recommendations?${params.toString()}`)
      .then(res => {
        if (cancelled) return;
        if (res.status === "success") {
          setCandidates(res.data?.candidates ?? []);
          if (typeof res.data?.seminarCovers === "boolean") setServerCovers(res.data.seminarCovers);
        } else setError(res.message || "Unable to load recommendations.");
      })
      .catch(err => { if (!cancelled) setError(err.message || "Unable to load recommendations."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [program.id, program.isNew, program.title, program.fiscalYear, program.targetDivision, program.targetSpecialization,
      (program.fulfillsNeedTitles ?? []).join("|"), max, program.startDate, program.endDate, reloadKey]);

  return { candidates, loading, error, serverCovers };
}
