import { HouseholdProfileSchema } from "@/ai/schemas";
import { DEFAULT_PROFILE, DEMO_HOUSEHOLDS } from "@/domain/demo-households";
import {
  cleanProfile,
  newActivity,
  newMember,
  nextMemberId,
  toggleSensitivity,
  updateMemberById,
  withActivityAdded,
  withActivityRemoved,
  withActivityUpdated,
} from "@/domain/household-edit";
import { LIMITS } from "@/domain/limits";
import type { HouseholdProfile } from "@/domain/types";
import { makeMember, makeProfile } from "./helpers/fixtures";

function withoutLanguage(profile: HouseholdProfile): Omit<HouseholdProfile, "language"> {
  const copy: Partial<HouseholdProfile> = { ...profile };
  delete copy.language;
  return copy as Omit<HouseholdProfile, "language">;
}

describe("nextMemberId", () => {
  it("skips ids that are already taken", () => {
    const members = [makeMember({ id: "mem_2" }), makeMember({ id: "mem_3" })];
    expect(nextMemberId(members)).toBe("mem_4");
  });

  it("starts from the next number when nothing clashes", () => {
    expect(nextMemberId([makeMember({ id: "a" })])).toBe("mem_2");
  });
});

describe("toggleSensitivity", () => {
  it("replaces 'none' when a condition is chosen", () => {
    expect(toggleSensitivity(["none"], "asthma")).toEqual(["asthma"]);
  });

  it("adds and removes conditions", () => {
    expect(toggleSensitivity(["asthma"], "elderly")).toEqual(["asthma", "elderly"]);
    expect(toggleSensitivity(["asthma", "elderly"], "asthma")).toEqual(["elderly"]);
  });

  it("goes back to 'none' when the last condition is removed", () => {
    expect(toggleSensitivity(["asthma"], "asthma")).toEqual(["none"]);
  });

  it("clears every condition when 'none' is chosen", () => {
    expect(toggleSensitivity(["asthma", "cardiac"], "none")).toEqual(["none"]);
  });
});

describe("cleanProfile", () => {
  it("trims text and zeroes the commute of people who stay at home", () => {
    const draft = withoutLanguage(
      makeProfile({
        city: "  Patna ",
        members: [
          makeMember({
            name: " Meena ",
            commuteMode: "homemaker",
            commuteDistanceKm: 12,
            commuteTimeMinutes: 40,
            outdoorActivities: [{ description: " walk ", preferredHour: 7, durationMinutes: 30 }],
          }),
        ],
      })
    );
    const cleaned = cleanProfile(draft, "hi");
    expect(cleaned.city).toBe("Patna");
    expect(cleaned.language).toBe("hi");
    expect(cleaned.members[0]).toMatchObject({
      name: "Meena",
      commuteDistanceKm: 0,
      commuteTimeMinutes: 0,
    });
    expect(cleaned.members[0].outdoorActivities[0].description).toBe("walk");
  });

  it("keeps the commute of people who travel", () => {
    const draft = withoutLanguage(
      makeProfile({
        members: [makeMember({ commuteMode: "bus", commuteDistanceKm: 8 })],
      })
    );
    expect(cleanProfile(draft, "en").members[0].commuteDistanceKm).toBe(8);
  });
});

describe("starting values and samples", () => {
  it("gives new members and activities values the server accepts", () => {
    const profile = makeProfile({
      members: [{ ...newMember("mem_1"), name: "New", outdoorActivities: [newActivity()] }],
    });
    profile.members[0].outdoorActivities[0].description = "Walk";
    expect(HouseholdProfileSchema.safeParse(profile).success).toBe(true);
  });

  it("only ships sample households that pass validation", () => {
    for (const profile of [DEFAULT_PROFILE, ...DEMO_HOUSEHOLDS.map((d) => d.profile)]) {
      expect(HouseholdProfileSchema.safeParse(profile).success).toBe(true);
    }
  });
});

describe("shared limits", () => {
  it("are the limits the server enforces", () => {
    const members = Array.from({ length: LIMITS.maxMembers + 1 }, (_, i) =>
      makeMember({ id: `m${i}` })
    );
    expect(HouseholdProfileSchema.safeParse(makeProfile({ members })).success).toBe(false);
    const tooOld = makeProfile({ members: [makeMember({ age: LIMITS.maxAge + 1 })] });
    expect(HouseholdProfileSchema.safeParse(tooOld).success).toBe(false);
  });
});

describe("activity edits", () => {
  const walk = { description: "Walk", preferredHour: 7, durationMinutes: 30 };
  const yoga = { description: "Yoga", preferredHour: 17, durationMinutes: 60 };

  it("adds a blank activity only below the limit", () => {
    const member = makeMember({ outdoorActivities: [walk] });
    expect(withActivityAdded(member, 2).outdoorActivities).toHaveLength(2);
    expect(withActivityAdded(member, 1)).toBe(member);
  });

  it("updates and removes one activity by position", () => {
    const member = makeMember({ outdoorActivities: [walk, yoga] });
    expect(withActivityUpdated(member, 1, { durationMinutes: 45 }).outdoorActivities[1]).toEqual({
      ...yoga,
      durationMinutes: 45,
    });
    expect(withActivityRemoved(member, 0).outdoorActivities).toEqual([yoga]);
  });

  it("changes only the member with the given id", () => {
    const members = [makeMember({ id: "a", age: 30 }), makeMember({ id: "b", age: 40 })];
    const next = updateMemberById(members, "b", (m) => ({ ...m, age: 41 }));
    expect(next.map((m) => m.age)).toEqual([30, 41]);
    expect(next[0]).toBe(members[0]);
  });
});
