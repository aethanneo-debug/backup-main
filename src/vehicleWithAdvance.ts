// "Also request a vehicle" on a seminar's cash advance request. HSAC RAB 1 (2026-10-26,
// .claude/context/hsac-answers.md): the vehicle request may be filed together with the cash advance.
// What it needs and how it is checked, the same on the seminar card and on the server
// (POST /api/cash-advances/request). The general request form keeps its own, looser rules.
import { cleanText, isCalendarDate } from "./inputText";

export interface VehicleWithAdvanceFields {
  destination: string;
  purpose: string;
  passengers: string;
  departureDate: string;   // YYYY-MM-DD
  departureTime: string;   // HH:mm
  arrivalDate: string;     // YYYY-MM-DD
  arrivalTime: string;     // HH:mm
  /** The slip's "Reservation date": the day of departure. */
  dateNeeded: string;
}

export type VehicleDraft = Omit<VehicleWithAdvanceFields, "dateNeeded">;

/** The seminar a request is for: the trip is prefilled from it, and has to fit its dates. */
export interface SeminarForVehicle {
  title?: string;
  venue?: string;
  startDate?: string;
  endDate?: string;
}

/** Days of travel allowed on each side of a seminar: the trip leaves no earlier, and is back no later. */
export const TRAVEL_DAYS = 2;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateText(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * The vehicle request's fields, cleaned, or why it can't be filed. `today` is YYYY-MM-DD (the server
 * passes Manila's date): a trip can't leave in the past, and it has to arrive after it leaves. With the
 * seminar's dates, the trip has to be for it: leaving by its last day (at most TRAVEL_DAYS before it
 * starts) and back from its first day on (at most TRAVEL_DAYS after it ends).
 */
export function vehicleWithAdvanceFields(raw: unknown, today: string, seminar?: SeminarForVehicle): { fields: VehicleWithAdvanceFields } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Fill in the vehicle request, or untick it." };
  const r = raw as Record<string, unknown>;
  const destination = cleanText(r.destination);
  const purpose = cleanText(r.purpose);
  const passengers = cleanText(r.passengers);
  if (!destination || destination.length > 200) return { error: "Enter where the vehicle goes, up to 200 characters." };
  if (!purpose || purpose.length > 300) return { error: "Enter the purpose of the trip, up to 300 characters." };
  if (!passengers || passengers.length > 500) return { error: "Enter the passengers, up to 500 characters." };
  const { departureDate, departureTime, arrivalDate, arrivalTime } = r;
  if (!isCalendarDate(departureDate) || !isCalendarDate(arrivalDate)) return { error: "Enter the departure and arrival dates." };
  if (typeof departureTime !== "string" || !HHMM.test(departureTime) || typeof arrivalTime !== "string" || !HHMM.test(arrivalTime)) {
    return { error: "Enter the departure and arrival times." };
  }
  if (departureDate < today) return { error: "The departure can't be in the past." };
  if (`${arrivalDate}T${arrivalTime}` <= `${departureDate}T${departureTime}`) return { error: "The arrival has to be after the departure." };
  const start = seminar?.startDate;
  const end = seminar?.endDate || start;
  if (isCalendarDate(start) && isCalendarDate(end)
      && (departureDate < addDays(start, -TRAVEL_DAYS) || departureDate > end || arrivalDate < start || arrivalDate > addDays(end, TRAVEL_DAYS))) {
    const when = start === end ? dateText(start) : `${dateText(start)} to ${dateText(end)}`;
    return { error: `The trip has to be for the seminar (${when}): leave no more than ${TRAVEL_DAYS} days before it starts, and be back no more than ${TRAVEL_DAYS} days after it ends.` };
  }
  return { fields: { destination, purpose, passengers, departureDate, departureTime, arrivalDate, arrivalTime, dateNeeded: departureDate } };
}

/**
 * The vehicle request prefilled from the seminar: its venue, its first and last days, and who travels.
 * The times are left for the employee: a trip leaves before the seminar starts and is back after it ends.
 */
export function vehicleDraftFor(seminar: SeminarForVehicle, passengers: string[]): VehicleDraft {
  const title = cleanText(seminar.title);
  return {
    destination: cleanText(seminar.venue),
    purpose: title ? `To attend the seminar "${title}"` : "To attend a seminar",
    passengers: passengers.map(cleanText).filter(Boolean).join(", "),
    departureDate: seminar.startDate || "",
    departureTime: "",
    arrivalDate: seminar.endDate || seminar.startDate || "",
    arrivalTime: ""
  };
}
