import type { CommuteMode } from "./types";

/** English labels used inside engine-generated text. */
export const COMMUTE_MODE_LABELS: Record<CommuteMode, string> = {
  walk: "walking",
  bicycle: "cycling",
  two_wheeler: "two-wheeler",
  auto_rickshaw: "auto-rickshaw",
  bus: "bus",
  metro: "metro",
  car_ice: "petrol or diesel car",
  car_ev: "electric car",
  work_from_home: "working from home",
  homemaker: "running the home",
};

/** An hour of the day as "HH:00". */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Two hours as "HH:00 - HH:00". */
export function formatHourRange(startHour: number, endHour: number): string {
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
}
