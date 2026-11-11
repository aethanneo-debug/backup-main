import { useRef, useState } from "react";
import type { NotificationLink } from "../types";
import { manilaDay } from "../trainingCalendar";
import { PanelLink } from "./dashboard/LoadStates";
import PanelBoundary from "./dashboard/PanelBoundary";
import TrainingCalendar from "./dashboard/TrainingCalendar";
import UpcomingTrainings from "./dashboard/UpcomingTrainings";
import { useTrainingSchedule } from "./dashboard/useTrainingSchedule";
import AttendancePanel from "./dashboard/hr/AttendancePanel";
import DivisionsPanel from "./dashboard/hr/DivisionsPanel";
import FollowUpPanel from "./dashboard/hr/FollowUpPanel";
import HrCards from "./dashboard/hr/HrCards";
import HrHeader from "./dashboard/hr/HrHeader";
import MonthsPanel from "./dashboard/hr/MonthsPanel";
import SeminarAttendancePanel from "./dashboard/hr/SeminarAttendancePanel";
import TrainingsPanel from "./dashboard/hr/TrainingsPanel";
import { useFiscalYears, useHrDashboard } from "./dashboard/hr/useHrDashboard";

export interface HrDashboardViewProps {
  setActiveTab: (tab: string) => void;
  /** Opens a screen the way a notification does (App's openNotificationLink). */
  onOpenLink: (link: NotificationLink) => void;
}

/**
 * HR's dashboard (the instructor's suggestions of 2026-11-11, 12ag Part B), where HR lands: for the fiscal year chosen
 * (the active one first), how many staff there are and where, how many trainings each attended and in which months,
 * who attended each seminar, the training calendar, and the attendees whose cash advance or claim is still open. The
 * figures are one reply (`GET /api/dashboard/hr`, src/hrDashboard.ts), so the panels always agree; the calendar and the
 * upcoming list are the Administrator's own (the schedule route).
 */
export default function HrDashboardView({ setActiveTab, onOpenLink }: HrDashboardViewProps) {
  const years = useFiscalYears();
  // null: the active year, as the server picks it. Choosing the active year again goes back to null, so it isn't
  // loaded twice under two names.
  const [chosen, setChosen] = useState<string | null>(null);
  const dash = useHrDashboard(chosen);
  const schedule = useTrainingSchedule();
  // The server's day once the schedule has loaded (a PC's clock can be wrong), Manila's by the browser's until then.
  const today = schedule.asOf ?? manilaDay();
  const activeLabel = years.data?.find(y => y.active)?.label ?? null;
  // The year on screen: the one chosen, else what the server answered for the active year, else the list's active one.
  const fiscalYear = chosen ?? dash.data?.fiscalYear ?? activeLabel ?? "";
  // Programs & Budget lists only the active year's seminars, so it is offered only for that year.
  const showingActive = chosen === null;

  const openSeminar = (id: string) => onOpenLink({ tab: "training_development", record: { kind: "seminar", id } });
  const openPrograms = () => onOpenLink({ tab: "training_development", subTab: "programs" });
  const openPds = () => setActiveTab("pds");
  const followUpHeading = useRef<HTMLHeadingElement>(null);
  const showFollowUp = () => {
    followUpHeading.current?.scrollIntoView({ block: "start" });
    followUpHeading.current?.focus({ preventScroll: true });
  };

  return (
    // min-w-0: as a flex item of <main> it may be narrower than its content, which then wraps instead of pushing the page
    // sideways. On a phone the sidebar leaves about 100 px, so there a word too long for its box breaks rather than
    // sticking out (overflow-wrap is inherited), and each chart and table scrolls sideways inside its own box.
    <div id="ipfms-hr-dashboard-view" className="min-w-0 flex-1 space-y-6 overflow-y-auto bg-slate-50 p-2 sm:p-6 max-sm:[overflow-wrap:anywhere]">
      {/* Each panel fails on its own (PanelBoundary): a record it can't draw shows a box in its place, and the rest of
          the page, the sidebar included, keeps working. */}
      <PanelBoundary name="The dashboard's header">
        <HrHeader
          fiscalYear={fiscalYear}
          asOf={dash.data?.asOf}
          years={years}
          showingActive={showingActive}
          onChoose={(label, active) => setChosen(active ? null : label)}
        />
      </PanelBoundary>

      <PanelBoundary name="The figures at a glance">
        <HrCards load={dash} onOpenPds={openPds} onShowFollowUp={showFollowUp} />
      </PanelBoundary>

      <section aria-label="Staff and trainings attended" className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PanelBoundary name="Headcount by division">
          <DivisionsPanel load={dash} onOpenPds={openPds} />
        </PanelBoundary>
        <PanelBoundary name="Trainings attended per employee">
          <TrainingsPanel load={dash} />
        </PanelBoundary>
        <PanelBoundary name="Attendees per month">
          <MonthsPanel load={dash} />
        </PanelBoundary>
        <PanelBoundary name="Attendance">
          <AttendancePanel load={dash} />
        </PanelBoundary>
        <PanelBoundary name="Attendance by training" className="xl:col-span-2">
          <SeminarAttendancePanel load={dash} onOpenPrograms={showingActive ? openPrograms : undefined} className="xl:col-span-2" />
        </PanelBoundary>
      </section>

      {/* THE TRAINING CALENDAR AND WHAT IS COMING UP (12ag), as on the Administrator's dashboard: side by side on a wide
          screen, one above the other below. Every year's seminars; only the active year's open in Programs & Budget. */}
      <section aria-label="Training schedule" className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PanelBoundary name="The training calendar" className="xl:col-span-2">
          <TrainingCalendar
            className="xl:col-span-2"
            seminars={schedule.seminars}
            details={schedule.details}
            today={today}
            onOpenSeminar={openSeminar}
            activeFiscalYear={schedule.activeFiscalYear}
            loading={schedule.loading}
            failed={schedule.failed}
            message={schedule.message}
            onRetry={schedule.retry}
          />
        </PanelBoundary>
        <PanelBoundary name="Upcoming trainings">
          <UpcomingTrainings
            seminars={schedule.seminars}
            details={schedule.details}
            today={today}
            loading={schedule.loading}
            failed={schedule.failed}
            message={schedule.message}
            onRetry={schedule.retry}
            quietFailure
            onOpenSeminar={openSeminar}
            activeFiscalYear={schedule.activeFiscalYear}
            emptyAction={<PanelLink onClick={openPrograms}>Plan one in Programs &amp; Budget</PanelLink>}
          />
        </PanelBoundary>
      </section>

      <PanelBoundary name="The follow-up list">
        <FollowUpPanel load={dash} onOpenLink={onOpenLink} headingRef={followUpHeading} />
      </PanelBoundary>
    </div>
  );
}
