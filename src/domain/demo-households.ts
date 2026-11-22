import type { HouseholdProfile } from "./types";

/** Dictionary keys for the sample household buttons. */
type DemoKey = "demoDelhi" | "demoKolkata" | "demoPatna";

export interface DemoHousehold {
  key: DemoKey;
  profile: HouseholdProfile;
}

/** The household the form shows before the person changes anything. */
export const DEFAULT_PROFILE: HouseholdProfile = {
  city: "New Delhi",
  cookingFuel: "lpg",
  usesIncenseOrCoils: true,
  hasAirPurifier: false,
  members: [
    {
      id: "mem_1",
      name: "Rajesh",
      age: 40,
      sensitivities: ["none"],
      commuteMode: "two_wheeler",
      commuteDistanceKm: 12,
      commuteTimeMinutes: 40,
      outdoorActivities: [],
    },
    {
      id: "mem_2",
      name: "Meera",
      age: 38,
      sensitivities: ["asthma"],
      commuteMode: "metro",
      commuteDistanceKm: 8,
      commuteTimeMinutes: 30,
      outdoorActivities: [{ description: "Morning walk", preferredHour: 7, durationMinutes: 30 }],
    },
  ],
};

/** Sample households that fill the form in one tap, so the full flow can be tried quickly. */
export const DEMO_HOUSEHOLDS: readonly DemoHousehold[] = [
  {
    key: "demoDelhi",
    profile: {
      city: "New Delhi",
      cookingFuel: "lpg",
      usesIncenseOrCoils: true,
      hasAirPurifier: false,
      members: [
        {
          id: "m1",
          name: "Rajesh (Father)",
          age: 42,
          sensitivities: ["none"],
          commuteMode: "two_wheeler",
          commuteDistanceKm: 14,
          commuteTimeMinutes: 45,
          outdoorActivities: [],
        },
        {
          id: "m2",
          name: "Sunita (Mother)",
          age: 38,
          sensitivities: ["asthma"],
          commuteMode: "auto_rickshaw",
          commuteDistanceKm: 6,
          commuteTimeMinutes: 25,
          outdoorActivities: [
            {
              description: "Morning yoga in balcony",
              preferredHour: 7,
              durationMinutes: 30,
            },
          ],
        },
        {
          id: "m3",
          name: "Aarav (Toddler)",
          age: 2,
          sensitivities: ["infant"],
          commuteMode: "work_from_home",
          commuteDistanceKm: 0,
          commuteTimeMinutes: 0,
          outdoorActivities: [
            {
              description: "Park play time",
              preferredHour: 10,
              durationMinutes: 45,
            },
          ],
        },
        {
          id: "m4",
          name: "Dada Ji (Grandfather)",
          age: 72,
          sensitivities: ["elderly", "cardiac"],
          commuteMode: "work_from_home",
          commuteDistanceKm: 0,
          commuteTimeMinutes: 0,
          outdoorActivities: [
            {
              description: "Morning park walk",
              preferredHour: 6,
              durationMinutes: 45,
            },
          ],
        },
      ],
    },
  },
  {
    key: "demoKolkata",
    profile: {
      city: "Kolkata",
      cookingFuel: "lpg",
      usesIncenseOrCoils: true,
      hasAirPurifier: true,
      members: [
        {
          id: "m1",
          name: "Ananya (Working Parent)",
          age: 36,
          sensitivities: ["none"],
          commuteMode: "car_ice",
          commuteDistanceKm: 18,
          commuteTimeMinutes: 50,
          outdoorActivities: [],
        },
        {
          id: "m2",
          name: "Rishi (School Student)",
          age: 10,
          sensitivities: ["asthma"],
          commuteMode: "bus",
          commuteDistanceKm: 8,
          commuteTimeMinutes: 35,
          outdoorActivities: [
            {
              description: "Afternoon football",
              preferredHour: 16,
              durationMinutes: 60,
            },
          ],
        },
      ],
    },
  },
  {
    key: "demoPatna",
    profile: {
      city: "Patna",
      cookingFuel: "biomass",
      usesIncenseOrCoils: true,
      hasAirPurifier: false,
      members: [
        {
          id: "m1",
          name: "Manoj (Vendor / Field Worker)",
          age: 45,
          sensitivities: ["outdoor_worker"],
          commuteMode: "bicycle",
          commuteDistanceKm: 10,
          commuteTimeMinutes: 40,
          outdoorActivities: [
            {
              description: "Morning roadside stall setup",
              preferredHour: 6,
              durationMinutes: 90,
            },
          ],
        },
        {
          id: "m2",
          name: "Pooja (Expecting Mother)",
          age: 26,
          sensitivities: ["pregnant"],
          commuteMode: "work_from_home",
          commuteDistanceKm: 0,
          commuteTimeMinutes: 0,
          outdoorActivities: [],
        },
      ],
    },
  },
];
