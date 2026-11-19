/** Kilograms with at most two decimals and no trailing zeros, for example 2.35 or 4. */
export function formatKg(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 100) / 100);
}

/** Exposure index: whole numbers from 10 up, one decimal below that. */
export function formatDose(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

/** Clock part ("18:00") of a local ISO time such as "2026-11-19T18:00". Empty when the format is unexpected. */
export function localClock(iso: string | undefined): string {
  if (!iso) return "";
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : "";
}
