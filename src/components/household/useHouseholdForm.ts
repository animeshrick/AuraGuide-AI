import { useState } from "react";
import type { DemoHousehold } from "@/domain/demo-households";
import { DEFAULT_PROFILE } from "@/domain/demo-households";
import { cleanProfile } from "@/domain/household-edit";
import { LIMITS } from "@/domain/limits";
import type { CookingFuel, HouseholdProfile, SupportedLanguageCode } from "@/domain/types";
import { useMemberList } from "./useMemberList";

export type { MemberActions } from "./useMemberList";

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
  const memberList = useMemberList(start.members);
  const { members, version } = memberList;

  const loadDemo = (demo: DemoHousehold) => {
    setCity(demo.profile.city);
    setCookingFuel(demo.profile.cookingFuel);
    setUsesIncenseOrCoils(demo.profile.usesIncenseOrCoils);
    setHasAirPurifier(demo.profile.hasAirPurifier);
    memberList.replaceMembers(demo.profile.members);
  };

  /** The profile to send, or null when the city is too short to look up. */
  const buildProfile = (language: SupportedLanguageCode): HouseholdProfile | null => {
    if (city.trim().length < LIMITS.cityMinLength) return null;
    return cleanProfile(
      { city, cookingFuel, usesIncenseOrCoils, hasAirPurifier, members },
      language
    );
  };

  return {
    ...memberList,
    values: { city, cookingFuel, usesIncenseOrCoils, hasAirPurifier, members, version },
    setCity,
    setCookingFuel,
    setUsesIncenseOrCoils,
    setHasAirPurifier,
    loadDemo,
    buildProfile,
  };
}
