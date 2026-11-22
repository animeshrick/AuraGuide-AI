import { HouseholdProfileSchema } from "@/ai/schemas";
import type { HouseholdProfile } from "@/domain/types";
import { isSupportedLanguage, SupportedLanguage } from "@/i18n";

const PROFILE_KEY = "auraguide:profile";
const LANGUAGE_KEY = "auraguide:language";

/** Session storage can be blocked or full. The app works the same without it. */
function safely<T>(action: () => T): T | undefined {
  try {
    return action();
  } catch {
    return undefined;
  }
}

/**
 * The household and language kept for this browser tab only. Values are
 * checked when read back, so a damaged entry is ignored.
 */
export const sessionStore = {
  readLanguage(): SupportedLanguage | undefined {
    const stored = safely(() => sessionStorage.getItem(LANGUAGE_KEY));
    return isSupportedLanguage(stored) ? stored : undefined;
  },
  saveLanguage(language: SupportedLanguage): void {
    safely(() => sessionStorage.setItem(LANGUAGE_KEY, language));
  },
  readProfile(): HouseholdProfile | undefined {
    const raw = safely(() => sessionStorage.getItem(PROFILE_KEY));
    if (!raw) return undefined;
    const parsed = safely(() => HouseholdProfileSchema.safeParse(JSON.parse(raw)));
    return parsed?.success ? parsed.data : undefined;
  },
  saveProfile(profile: HouseholdProfile): void {
    safely(() => sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile)));
  },
};
