import { useEffect, useRef, useState } from "react";
import { DEFAULT_PROFILE, DemoHousehold } from "@/domain/demo-households";
import {
  cleanProfile,
  newActivity,
  newMember,
  nextMemberId,
  toggleSensitivity,
} from "@/domain/household-edit";
import { LIMITS } from "@/domain/limits";
import type {
  CookingFuel,
  HealthSensitivity,
  HouseholdMember,
  HouseholdProfile,
  OutdoorActivity,
  SupportedLanguageCode,
} from "@/domain/types";

/** Apply `change` to one member and leave the others alone. */
function updateOne(
  members: HouseholdMember[],
  id: string,
  change: (member: HouseholdMember) => HouseholdMember
): HouseholdMember[] {
  return members.map((m) => (m.id === id ? change(m) : m));
}

/**
 * All state and actions behind the household form. The form components only
 * render; every change to the household goes through this hook.
 */
export function useHouseholdForm(initialProfile?: HouseholdProfile | null) {
  const start = initialProfile ?? DEFAULT_PROFILE;
  const [city, setCity] = useState(start.city);
  const [cookingFuel, setCookingFuel] = useState<CookingFuel>(start.cookingFuel);
  const [usesIncenseOrCoils, setUsesIncenseOrCoils] = useState(start.usesIncenseOrCoils);
  const [hasAirPurifier, setHasAirPurifier] = useState(start.hasAirPurifier);
  const [members, setMembers] = useState<HouseholdMember[]>(start.members);
  // Number fields are not controlled, so a new value from a sample household needs a fresh field.
  const [version, setVersion] = useState(0);

  // A new member card appears below the Add member button, often off screen, so move the cursor to it.
  const [memberToFocus, setMemberToFocus] = useState<string | null>(null);
  const nameInputs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (!memberToFocus) return;
    const input = nameInputs.current.get(memberToFocus);
    if (input) {
      input.focus();
      input.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
    setMemberToFocus(null);
  }, [memberToFocus]);

  const loadDemo = (demo: DemoHousehold) => {
    setCity(demo.profile.city);
    setCookingFuel(demo.profile.cookingFuel);
    setUsesIncenseOrCoils(demo.profile.usesIncenseOrCoils);
    setHasAirPurifier(demo.profile.hasAirPurifier);
    setMembers(demo.profile.members);
    setVersion((v) => v + 1);
  };

  const addMember = () => {
    if (members.length >= LIMITS.maxMembers) return;
    const id = nextMemberId(members);
    setMemberToFocus(id);
    setMembers((prev) => (prev.length >= LIMITS.maxMembers ? prev : [...prev, newMember(id)]));
  };

  const removeMember = (id: string) => {
    setMembers((prev) => (prev.length <= 1 ? prev : prev.filter((m) => m.id !== id)));
  };

  const updateMember = (id: string, updates: Partial<HouseholdMember>) => {
    setMembers((prev) => updateOne(prev, id, (m) => ({ ...m, ...updates })));
  };

  const toggleMemberSensitivity = (id: string, sensitivity: HealthSensitivity) => {
    setMembers((prev) =>
      updateOne(prev, id, (m) => ({
        ...m,
        sensitivities: toggleSensitivity(m.sensitivities, sensitivity),
      }))
    );
  };

  const addActivity = (id: string) => {
    setMembers((prev) =>
      updateOne(prev, id, (m) =>
        m.outdoorActivities.length >= LIMITS.maxActivitiesPerMember
          ? m
          : { ...m, outdoorActivities: [...m.outdoorActivities, newActivity()] }
      )
    );
  };

  const updateActivity = (id: string, index: number, updates: Partial<OutdoorActivity>) => {
    setMembers((prev) =>
      updateOne(prev, id, (m) => ({
        ...m,
        outdoorActivities: m.outdoorActivities.map((a, i) =>
          i === index ? { ...a, ...updates } : a
        ),
      }))
    );
  };

  const removeActivity = (id: string, index: number) => {
    setMembers((prev) =>
      updateOne(prev, id, (m) => ({
        ...m,
        outdoorActivities: m.outdoorActivities.filter((_, i) => i !== index),
      }))
    );
    // Rows are keyed by position, so refresh the uncontrolled number fields to show the right values.
    setVersion((v) => v + 1);
  };

  /** The profile to send, or null when the city is too short to look up. */
  const buildProfile = (language: SupportedLanguageCode): HouseholdProfile | null => {
    if (city.trim().length < LIMITS.cityMinLength) return null;
    return cleanProfile(
      { city, cookingFuel, usesIncenseOrCoils, hasAirPurifier, members },
      language
    );
  };

  /** Keep a reference to each member's name field so a new member can be focused. */
  const registerNameInput = (id: string, el: HTMLInputElement | null) => {
    if (el) nameInputs.current.set(id, el);
    else nameInputs.current.delete(id);
  };

  return {
    values: { city, cookingFuel, usesIncenseOrCoils, hasAirPurifier, members, version },
    setCity,
    setCookingFuel,
    setUsesIncenseOrCoils,
    setHasAirPurifier,
    loadDemo,
    addMember,
    removeMember,
    updateMember,
    toggleMemberSensitivity,
    addActivity,
    updateActivity,
    removeActivity,
    buildProfile,
    registerNameInput,
  };
}

/** Everything the form's member cards need to change a member. */
export type MemberActions = Pick<
  ReturnType<typeof useHouseholdForm>,
  | "removeMember"
  | "updateMember"
  | "toggleMemberSensitivity"
  | "addActivity"
  | "updateActivity"
  | "removeActivity"
  | "registerNameInput"
>;
