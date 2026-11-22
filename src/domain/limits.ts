/**
 * Input limits shared by the form (browser) and the request schemas (server),
 * so both sides always agree on what a valid household looks like.
 */
export const LIMITS = {
  cityMinLength: 2,
  cityMaxLength: 100,
  memberNameMaxLength: 50,
  maxAge: 120,
  maxCommuteDistanceKm: 200,
  maxCommuteMinutes: 300,
  activityDescriptionMaxLength: 100,
  minActivityMinutes: 5,
  maxActivityMinutes: 360,
  maxMembers: 10,
  maxActivitiesPerMember: 5,
  questionMinLength: 3,
  questionMaxLength: 300,
} as const;
