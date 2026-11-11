import { useMemo } from "react";
import { apiCall } from "../../utils";
import { isCalendarDate } from "../../inputText";
import { calendarSeminars, type CalendarSeminar } from "../../trainingCalendar";
import { readSchedule, type ScheduleSeminar } from "../../trainingSchedule";
import { scheduleDetails, type SeminarDetails } from "./schedule";
import { useApiLoad } from "./useApiLoad";

export interface TrainingSchedule {
  /** The seminars a calendar shows (real dates only; none archived before use; those archived once finished, marked). */
  seminars: CalendarSeminar[];
  /** Each seminar's time, venue and seats, by id. */
  details: Record<string, SeminarDetails>;
  /** The schedule's rows as the server priced them, for the budget chart. Empty until they load. */
  rows: ScheduleSeminar[];
  /** The server's day in Manila (YYYY-MM-DD), so "upcoming" and "ongoing" don't follow a PC's wrong clock; null until
   * it loads. */
  asOf: string | null;
  /** The active fiscal year's label ("2029"): Programs & Budget lists only its seminars, so only they can be opened
   * there. null when there is none (then every seminar is offered). */
  activeFiscalYear: string | null;
  loading: boolean;
  failed: boolean;
  /** The server's reason when it gave one, else "". */
  message: string;
  retry: () => void;
}

interface Loaded {
  rows: ScheduleSeminar[];
  asOf: string | null;
  activeFiscalYear: string | null;
}

const NONE: ScheduleSeminar[] = [];

async function loadSchedule(): Promise<Loaded> {
  const res = await apiCall("/api/training/schedule");
  if (res?.status !== "success" || !res.data || typeof res.data !== "object") throw new Error(res?.message || "");
  const d = res.data as Record<string, unknown>;
  return {
    rows: readSchedule(d.seminars),
    asOf: isCalendarDate(d.asOf) ? d.asOf : null,
    activeFiscalYear: typeof d.activeFiscalYear === "string" && d.activeFiscalYear ? d.activeFiscalYear.slice(0, 20) : null
  };
}

/**
 * The training schedule, for the training calendar, the upcoming list and the budget chart (12ag; HR's dashboard too).
 * One narrow route (`GET /api/training/schedule`, HR's and the Administrator's): each seminar's dates, time, venue,
 * seats and budget figures, and no enrolment's details (the security review of 12ag Part A).
 */
export function useTrainingSchedule(): TrainingSchedule {
  const load = useApiLoad(loadSchedule);
  const rows = load.data?.rows ?? NONE;
  const seminars = useMemo(() => calendarSeminars(rows), [rows]);
  const details = useMemo(() => scheduleDetails(rows), [rows]);
  return {
    seminars, details, rows, asOf: load.data?.asOf ?? null, activeFiscalYear: load.data?.activeFiscalYear ?? null,
    loading: load.loading, failed: load.failed, message: load.message, retry: load.retry
  };
}
