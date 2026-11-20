import { AQICategory } from "./types";

interface Breakpoint {
  bLo: number;
  bHi: number;
  iLo: number;
  iHi: number;
}

// CPCB Breakpoints for 24-hr PM2.5 (µg/m³)
const PM25_BREAKPOINTS: Breakpoint[] = [
  { bLo: 0, bHi: 30, iLo: 0, iHi: 50 },
  { bLo: 31, bHi: 60, iLo: 51, iHi: 100 },
  { bLo: 61, bHi: 90, iLo: 101, iHi: 200 },
  { bLo: 91, bHi: 120, iLo: 201, iHi: 300 },
  { bLo: 121, bHi: 250, iLo: 301, iHi: 400 },
  { bLo: 251, bHi: 500, iLo: 401, iHi: 500 },
];

// CPCB Breakpoints for 24-hr PM10 (µg/m³)
const PM10_BREAKPOINTS: Breakpoint[] = [
  { bLo: 0, bHi: 50, iLo: 0, iHi: 50 },
  { bLo: 51, bHi: 100, iLo: 51, iHi: 100 },
  { bLo: 101, bHi: 250, iLo: 101, iHi: 200 },
  { bLo: 251, bHi: 350, iLo: 201, iHi: 300 },
  { bLo: 351, bHi: 430, iLo: 301, iHi: 400 },
  { bLo: 431, bHi: 500, iLo: 401, iHi: 500 },
];

/**
 * CPCB tables list whole-number concentrations (30, then 31 to 60), so values
 * between 30 and 31 belong to no band. Concentrations are rounded to a whole
 * number first so every reading lands in a band. Without this, a reading of
 * 60.5 would fall through the gaps and be reported as AQI 0.
 */
function calculateSubIndex(concentration: number, breakpoints: Breakpoint[]): number {
  if (!Number.isFinite(concentration) || concentration <= 0) return 0;
  const value = Math.round(concentration);

  for (const bp of breakpoints) {
    if (value >= bp.bLo && value <= bp.bHi) {
      const index = ((bp.iHi - bp.iLo) / (bp.bHi - bp.bLo)) * (value - bp.bLo) + bp.iLo;
      return Math.round(index);
    }
  }

  // Beyond the highest breakpoint (extreme smog): continue the last slope, capped at 999.
  const last = breakpoints[breakpoints.length - 1];
  if (value > last.bHi) {
    const extrapolated =
      last.iHi + ((last.iHi - last.iLo) / (last.bHi - last.bLo)) * (value - last.bHi);
    return Math.min(Math.round(extrapolated), 999);
  }

  return 0;
}

export function calculateAQI(
  pm25: number,
  pm10: number = 0
): {
  aqi: number;
  category: AQICategory;
  primaryPollutant: "PM2.5" | "PM10";
} {
  const iPm25 = calculateSubIndex(pm25, PM25_BREAKPOINTS);
  const iPm10 = calculateSubIndex(pm10, PM10_BREAKPOINTS);

  const aqi = Math.max(iPm25, iPm10);
  const primaryPollutant: "PM2.5" | "PM10" = iPm25 >= iPm10 ? "PM2.5" : "PM10";
  const category = getAQICategory(aqi);

  return { aqi, category, primaryPollutant };
}

export function getAQICategory(aqi: number): AQICategory {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}

export function getAQIColor(category: AQICategory): string {
  switch (category) {
    case "Good":
      return "#059669"; // Emerald 600
    case "Satisfactory":
      return "#65a30d"; // Lime 600
    case "Moderate":
      return "#d97706"; // Amber 600
    case "Poor":
      return "#ea580c"; // Orange 600
    case "Very Poor":
      return "#dc2626"; // Red 600
    case "Severe":
      return "#7f1d1d"; // Dark Red 900
  }
}

export function getAQIBadgeClass(category: AQICategory): string {
  switch (category) {
    case "Good":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "Satisfactory":
      return "bg-lime-100 text-lime-800 border-lime-300";
    case "Moderate":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "Poor":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "Very Poor":
      return "bg-red-100 text-red-800 border-red-300";
    case "Severe":
      return "bg-rose-950 text-rose-100 border-rose-800 font-semibold";
  }
}
