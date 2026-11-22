import { staysAtHome } from "./modes";
import type {
  HealthSensitivity,
  HouseholdMember,
  HouseholdProfile,
  OutdoorActivity,
  SupportedLanguageCode,
} from "./types";

/** A member id that is not already used in this household. */
export function nextMemberId(members: readonly HouseholdMember[]): string {
  const used = new Set(members.map((m) => m.id));
  let n = members.length + 1;
  while (used.has(`mem_${n}`)) n += 1;
  return `mem_${n}`;
}

/** The values a newly added member starts with. */
export function newMember(id: string): HouseholdMember {
  return {
    id,
    name: "",
    age: 30,
    sensitivities: ["none"],
    commuteMode: "metro",
    commuteDistanceKm: 10,
    commuteTimeMinutes: 30,
    outdoorActivities: [],
  };
}

/** The values a newly added outdoor activity starts with. */
export function newActivity(): OutdoorActivity {
  return { description: "", preferredHour: 7, durationMinutes: 30 };
}

/**
 * Turn one health sensitivity on or off. "none" clears the others, and an
 * empty list goes back to "none", so the list is never empty or contradictory.
 */
export function toggleSensitivity(
  current: readonly HealthSensitivity[],
  sensitivity: HealthSensitivity
): HealthSensitivity[] {
  if (sensitivity === "none") return ["none"];
  const without = current.filter((s) => s !== "none");
  const next = without.includes(sensitivity)
    ? without.filter((s) => s !== sensitivity)
    : [...without, sensitivity];
  return next.length === 0 ? ["none"] : next;
}

/**
 * Tidy what the person typed before it is sent: trim text, and zero the
 * commute for anyone who stays at home, since those numbers mean nothing for them.
 */
export function cleanProfile(
  draft: Omit<HouseholdProfile, "language">,
  language: SupportedLanguageCode
): HouseholdProfile {
  return {
    ...draft,
    city: draft.city.trim(),
    members: draft.members.map((m) => ({
      ...m,
      name: m.name.trim(),
      commuteDistanceKm: staysAtHome(m.commuteMode) ? 0 : m.commuteDistanceKm,
      commuteTimeMinutes: staysAtHome(m.commuteMode) ? 0 : m.commuteTimeMinutes,
      outdoorActivities: m.outdoorActivities.map((a) => ({
        ...a,
        description: a.description.trim(),
      })),
    })),
    language,
  };
}

/** Apply `change` to the member with this id and leave the others alone. */
export function updateMemberById(
  members: readonly HouseholdMember[],
  id: string,
  change: (member: HouseholdMember) => HouseholdMember
): HouseholdMember[] {
  return members.map((m) => (m.id === id ? change(m) : m));
}

/** Add a blank activity, unless the member already has the most allowed. */
export function withActivityAdded(member: HouseholdMember, max: number): HouseholdMember {
  if (member.outdoorActivities.length >= max) return member;
  return { ...member, outdoorActivities: [...member.outdoorActivities, newActivity()] };
}

/** Change some fields of one activity. */
export function withActivityUpdated(
  member: HouseholdMember,
  index: number,
  updates: Partial<OutdoorActivity>
): HouseholdMember {
  return {
    ...member,
    outdoorActivities: member.outdoorActivities.map((a, i) =>
      i === index ? { ...a, ...updates } : a
    ),
  };
}

/** Remove one activity. */
export function withActivityRemoved(member: HouseholdMember, index: number): HouseholdMember {
  return {
    ...member,
    outdoorActivities: member.outdoorActivities.filter((_, i) => i !== index),
  };
}
