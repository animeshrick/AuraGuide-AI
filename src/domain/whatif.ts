import { dailyCommuteEmissionsKg, roundKg } from "./emissions";
import { calculateMemberExposure } from "./exposure";
import { staysAtHome } from "./modes";
import {
  CommuteMode,
  HourlyAirQuality,
  HouseholdMember,
  HouseholdProfile,
  WhatIfOutcome,
} from "./types";

/**
 * Words that name each commute mode, in English, Hindi and Bengali.
 * `ascii` words must stand alone ("car" must not match "scarf"). `native`
 * words are matched at the start of a word only, because Hindi and Bengali
 * attach endings to nouns (for example the Bengali word for metro plus "-te").
 */
const MODE_KEYWORDS: Record<CommuteMode, { ascii: string[]; native: string[] }> = {
  work_from_home: {
    ascii: [
      "wfh",
      "work(?:ing)?[ -]from[ -]home",
      "work remotely",
      "remote work",
      "stay(?:ing)? (?:at )?home",
    ],
    native: ["घर से काम", "वर्क फ्रॉम होम", "বাড়ি থেকে কাজ", "ওয়ার্ক ফ্রম হোম"],
  },
  // Nobody asks "what if I became a homemaker" as a commute change, so this has no words.
  homemaker: { ascii: [], native: [] },
  bicycle: {
    ascii: ["bicycle", "bicycling", "cycle", "cycles", "cycled", "cycling", "pedal(?:ling)?"],
    native: ["साइकिल", "সাইকেল"],
  },
  walk: {
    ascii: ["walk", "walks", "walked", "walking", "on foot"],
    native: ["पैदल", "হেঁটে", "পায়ে হেঁটে"],
  },
  metro: {
    ascii: ["metro", "subway", "train", "local train", "tube"],
    native: ["मेट्रो", "ट्रेन", "মেট্রো", "ট্রেন"],
  },
  bus: { ascii: ["bus", "buses"], native: ["बस", "বাস"] },
  car_ev: {
    ascii: ["ev", "electric (?:car|vehicle)", "e-car"],
    native: ["इलेक्ट्रिक कार", "ইলেকট্রিক গাড়ি"],
  },
  auto_rickshaw: {
    ascii: ["auto", "autos", "rickshaw", "rickshaws", "e-rickshaw", "tuk-tuk"],
    native: ["ऑटो", "रिक्शा", "অটো", "রিকশা"],
  },
  car_ice: {
    ascii: ["car", "cab", "taxi", "uber", "drive", "driving", "drove"],
    native: ["कार", "गाड़ी", "टैक्सी", "গাড়ি", "কার", "ট্যাক্সি"],
  },
  two_wheeler: {
    ascii: ["two[- ]?wheeler", "scooter", "scooty", "motorbike", "motorcycle", "bike"],
    native: ["बाइक", "स्कूटर", "বাইক", "স্কুটার"],
  },
};

const NOT_AFTER = "(?<![\\p{L}\\p{M}\\p{N}_-])";
const NOT_BEFORE = "(?![\\p{L}\\p{M}\\p{N}_])";

/** A mode with no words is skipped: an empty alternation would match every question. */
const MODE_PATTERNS: { mode: CommuteMode; pattern: RegExp }[] = (
  Object.entries(MODE_KEYWORDS) as [CommuteMode, { ascii: string[]; native: string[] }][]
)
  .filter(([, words]) => words.ascii.length > 0 || words.native.length > 0)
  .map(([mode, words]) => ({
    mode,
    pattern: new RegExp(
      `${NOT_AFTER}(?:${words.ascii.join("|")})${NOT_BEFORE}|(?<![\\p{L}\\p{M}])(?:${words.native.join("|")})`,
      "iu"
    ),
  }));

/**
 * Words meaning "instead of". In English the new mode comes before the marker
 * ("cycle instead of the auto"). In Hindi and Bengali it comes after ("auto
 * ki jagah cycle"), so the part that names the mode being left differs.
 */
const REPLACEMENT_MARKERS: { pattern: RegExp; newModeFirst: boolean }[] = [
  { pattern: /\b(?:instead of|rather than|in place of|replacing)\b/i, newModeFirst: true },
  { pattern: /की जगह|के बजाय|की बजाय|बजाय/u, newModeFirst: false },
  { pattern: /এর বদলে|এর পরিবর্তে|বদলে|পরিবর্তে/u, newModeFirst: false },
];

function modesIn(text: string): { mode: CommuteMode; index: number }[] {
  return MODE_PATTERNS.map(({ mode, pattern }) => ({ mode, index: text.search(pattern) }))
    .filter((m) => m.index >= 0)
    .sort((a, b) => a.index - b.index);
}

/**
 * Read which commute mode a what-if question is about.
 *
 * "Cycle instead of taking an auto" means cycling. The mode being left (the
 * part after "instead of", or the person's current mode) is ignored when
 * another mode is named. Returns null when no mode is named.
 */
export function detectModeFromQuestion(
  question: string,
  currentMode: CommuteMode
): CommuteMode | null {
  const found = modesIn(question);
  if (found.length === 0) return null;

  let candidates = found;
  for (const { pattern, newModeFirst } of REPLACEMENT_MARKERS) {
    const match = pattern.exec(question);
    if (!match) continue;
    const before = question.slice(0, match.index);
    const after = question.slice(match.index + match[0].length);
    const leaving = new Set(modesIn(newModeFirst ? after : before).map((m) => m.mode));
    const remaining = candidates.filter((m) => !leaving.has(m.mode));
    if (remaining.length > 0) candidates = remaining;
    break;
  }

  const others = candidates.filter((m) => m.mode !== currentMode);
  return (others[0] ?? candidates[0]).mode;
}

function firstName(name: string): string {
  return name.split(/[\s(]/)[0] ?? "";
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Who the question is about: the chosen member, a member named in the question, or the first commuter. */
export function pickMember(
  profile: HouseholdProfile,
  question: string,
  memberId?: string
): HouseholdMember {
  if (memberId) {
    const chosen = profile.members.find((m) => m.id === memberId);
    if (chosen) return chosen;
  }

  const named = profile.members.find((m) => {
    const token = firstName(m.name);
    return (
      token.length >= 2 &&
      new RegExp(
        `(?<![\\p{L}\\p{M}\\p{N}])${escapeRegExp(token)}(?![\\p{L}\\p{M}\\p{N}])`,
        "iu"
      ).test(question)
    );
  });
  if (named) return named;

  return (
    profile.members.find((m) => !staysAtHome(m.commuteMode) && m.commuteDistanceKm > 0) ??
    profile.members[0]
  );
}

/**
 * Recalculate emissions and exposure for a "what if I change my commute" question.
 * All numbers come from the engine. The language model only explains them.
 */
export function runWhatIf(
  profile: HouseholdProfile,
  hourly: HourlyAirQuality[],
  question: string,
  memberId?: string,
  chosenMode?: CommuteMode
): WhatIfOutcome {
  const member = pickMember(profile, question, memberId);
  const base = {
    memberId: member.id,
    memberName: member.name,
    fromMode: member.commuteMode,
  };

  // A mode picked with a button is used as it is. Typed questions are read for a mode.
  const toMode = chosenMode ?? detectModeFromQuestion(question, member.commuteMode);
  if (!toMode) return { matched: false, reason: "no_mode", ...base };
  if (toMode === member.commuteMode) return { matched: false, reason: "same_mode", ...base };
  if (!(member.commuteDistanceKm > 0)) return { matched: false, reason: "no_commute", ...base };

  const householdBaseline = profile.members.reduce(
    (sum, m) => sum + dailyCommuteEmissionsKg(m.commuteDistanceKm, m.commuteMode),
    0
  );
  const before = dailyCommuteEmissionsKg(member.commuteDistanceKm, member.commuteMode);
  const after = dailyCommuteEmissionsKg(member.commuteDistanceKm, toMode);
  const householdRecalculated = householdBaseline - before + after;

  const baselineDose = calculateMemberExposure(member, profile, hourly, false);
  const recalculatedDose = calculateMemberExposure(
    { ...member, commuteMode: toMode },
    profile,
    hourly,
    false
  );
  const changePct =
    baselineDose > 0 ? Math.round(((recalculatedDose - baselineDose) / baselineDose) * 100) : 0;

  return {
    matched: true,
    ...base,
    toMode,
    householdBaselineEmissionsKg: roundKg(householdBaseline),
    householdRecalculatedEmissionsKg: roundKg(householdRecalculated),
    savedEmissionsKg: roundKg(householdBaseline - householdRecalculated),
    baselineExposureDose: baselineDose,
    recalculatedExposureDose: recalculatedDose,
    exposureChangePercentage: changePct,
  };
}
