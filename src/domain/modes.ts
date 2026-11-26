import type { CommuteMode } from "./types";

/**
 * Modes where the person does not travel to a workplace or school, so they
 * are at home all day: working from home and running the household.
 * Their exposure includes indoor hours (cooking, incense) all day, and they
 * have no commute emissions to save.
 */
export function staysAtHome(mode: CommuteMode): boolean {
  return mode === "work_from_home" || mode === "homemaker";
}
