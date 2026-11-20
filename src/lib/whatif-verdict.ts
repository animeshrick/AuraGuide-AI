export type WhatIfVerdict = "better" | "mixed" | "same" | "worse";

/**
 * One plain verdict for a what-if result.
 *
 * Breathing less polluted air and making fewer travel fumes are both good.
 * A change that helps one and harms the other is "mixed". Changes too small
 * to show on screen (under 1% for the air, under 0.01 kg for fumes) count as none.
 */
export function whatIfVerdict(
  exposureChangePercentage: number,
  savedEmissionsKg: number
): WhatIfVerdict {
  const air = Math.round(exposureChangePercentage); // negative means cleaner air to breathe
  const fumes = Math.round(savedEmissionsKg * 100) / 100; // positive means fewer fumes

  const helps = (air < 0 ? 1 : 0) + (fumes > 0 ? 1 : 0);
  const harms = (air > 0 ? 1 : 0) + (fumes < 0 ? 1 : 0);

  if (helps > 0 && harms > 0) return "mixed";
  if (helps > 0) return "better";
  if (harms > 0) return "worse";
  return "same";
}

/** Bar lengths from 0 to 100 for a "now" and an "after" value, scaled to the larger one. */
export function barWidths(now: number, after: number): { now: number; after: number } {
  const largest = Math.max(now, after, 0);
  if (!(largest > 0)) return { now: 0, after: 0 };
  const percent = (value: number) => Math.round((Math.max(value, 0) / largest) * 100);
  return { now: percent(now), after: percent(after) };
}
