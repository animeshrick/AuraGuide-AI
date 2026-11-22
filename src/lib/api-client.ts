import type { AdvisoryAudience } from "@/domain/types";
import type {
  AQICategory,
  CommuteMode,
  DailyPlanResponse,
  HouseholdProfile,
  WhatIfOutcome,
  AirQualitySource,
} from "@/domain/types";
import type { SupportedLanguage } from "@/i18n";

/** Error codes the API can return, plus one for a failed connection. */
export type ClientErrorCode =
  | "rate_limited"
  | "invalid_request"
  | "city_not_found"
  | "ai_unavailable"
  | "internal_error"
  | "network";

/** An API failure with a code the page can show in the chosen language. */
export class ApiClientError extends Error {
  constructor(
    public readonly code: ClientErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const KNOWN_CODES: Record<string, ClientErrorCode> = {
  rate_limited: "rate_limited",
  invalid_request: "invalid_request",
  invalid_json: "invalid_request",
  payload_too_large: "invalid_request",
  city_not_found: "city_not_found",
  ai_unavailable: "ai_unavailable",
  internal_error: "internal_error",
};

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiClientError("network", "Could not reach the server.");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // A non-JSON body is handled below.
  }

  if (!response.ok) {
    const code =
      data && typeof data === "object" && "code" in data && typeof data.code === "string"
        ? data.code
        : "";
    throw new ApiClientError(
      KNOWN_CODES[code] ?? "internal_error",
      `Request failed (${response.status}).`
    );
  }
  if (data === null || typeof data !== "object") {
    throw new ApiClientError("internal_error", "The server sent an unreadable answer.");
  }
  return data as T;
}

/** Ask the server for a plan for this household. */
export function requestPlan(
  profile: HouseholdProfile,
  signal?: AbortSignal
): Promise<DailyPlanResponse> {
  return postJson<DailyPlanResponse>("/api/plan", profile, signal);
}

interface WhatIfMatchedResult extends Extract<WhatIfOutcome, { matched: true }> {
  question: string;
  currentAQI: number;
  explanation: string;
  explanationSource: "gemini";
}

interface WhatIfUnmatchedResult extends Extract<WhatIfOutcome, { matched: false }> {
  question: string;
}

export type WhatIfResult = WhatIfMatchedResult | WhatIfUnmatchedResult;

/** Ask the server what changes if one member travels another way. */
export function requestWhatIf(
  args: {
    profile: HouseholdProfile;
    question: string;
    memberId?: string;
    toMode?: CommuteMode;
    language: SupportedLanguage;
  },
  signal?: AbortSignal
): Promise<WhatIfResult> {
  return postJson<WhatIfResult>("/api/whatif", args, signal);
}

export interface AdvisoryResult {
  city: string;
  currentAQI: number;
  category: AQICategory;
  audience: AdvisoryAudience;
  dataSource: AirQualitySource;
  advisoryText: string;
  advisorySource: "gemini";
}

/** Ask the server for a community advisory. */
export function requestAdvisory(
  args: { city: string; audience: AdvisoryAudience; language: SupportedLanguage },
  signal?: AbortSignal
): Promise<AdvisoryResult> {
  return postJson<AdvisoryResult>("/api/advisory", args, signal);
}

export type { CommuteMode };
