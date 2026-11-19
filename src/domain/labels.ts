import { CommuteMode } from "./types";

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
};

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function formatHourRange(startHour: number, endHour: number): string {
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
}
