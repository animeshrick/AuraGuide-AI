import type {
  AdvisoryAudience,
  AirQualitySource,
  AQICategory,
  CommuteMode,
  DailyPlanResponse,
  HouseholdProfile,
  WhatIfOutcome,
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

/** Server error codes, grouped into the smaller set of messages the page shows. */
const KNOWN_CODES: Record<string, ClientErrorCode> = {
  rate_limited: "rate_limited",
  invalid_request: "invalid_request",
  invalid_json: "invalid_request",
  payload_too_large: "invalid_request",
  city_not_found: "city_not_found",
  ai_unavailable: "ai_unavailable",
  internal_error: "internal_error",
};

/** Send the request. A cancelled request is passed on; anything else is a network error. */
async function send(url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiClientError("network", "Could not reach the server.");
  }
}

/** The JSON body, or null when the body is not JSON. */
async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** The error code the server put in a failed response, mapped to one the page can show. */
function errorCodeOf(data: unknown): ClientErrorCode {
  const code =
    data !== null && typeof data === "object" && "code" in data && typeof data.code === "string"
      ? data.code
      : "";
  return KNOWN_CODES[code] ?? "internal_error";
}

/** POST a JSON body and return the JSON answer. Throws ApiClientError for any failure except a cancelled request. */
async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await send(url, body, signal);
  const data = await readBody(response);
  if (!response.ok) {
    throw new ApiClientError(errorCodeOf(data), `Request failed (${response.status}).`);
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

/** A what-if answer: the engine's numbers plus Gemini's explanation. */
interface WhatIfMatchedResult extends Extract<WhatIfOutcome, { matched: true }> {
  question: string;
  currentAQI: number;
  explanation: string;
  explanationSource: "gemini";
}

/** A what-if question the engine could not answer, with the reason. */
interface WhatIfUnmatchedResult extends Extract<WhatIfOutcome, { matched: false }> {
  question: string;
}

/** What the what-if route returns. */
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

/** What the advisory route returns. */
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
