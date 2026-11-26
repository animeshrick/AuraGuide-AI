/** The short reason a Gemini call failed. It is safe to log and to send to the browser. */
export type GeminiFailureReason =
  | "missing_key"
  | "invalid_key"
  | "quota"
  | "model_not_found"
  | "timeout"
  | "network"
  | "service_error"
  | "bad_output"
  | "unknown";

/**
 * Thrown whenever Gemini cannot write the text. Nothing falls back to built-in wording: the caller
 * shows the page an "AI unavailable" error, and the server log names the reason.
 */
export class GeminiUnavailableError extends Error {
  constructor(
    public readonly reason: GeminiFailureReason,
    detail = ""
  ) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = "GeminiUnavailableError";
  }
}

/** What the classifier looks at: the HTTP status (if any), the message, and the error itself. */
interface ErrorFacts {
  code: number | undefined;
  message: string;
  err: unknown;
}

/** Checked in order; the first rule that matches gives the reason. */
const FAILURE_RULES: readonly {
  reason: GeminiFailureReason;
  matches: (f: ErrorFacts) => boolean;
}[] = [
  {
    reason: "timeout",
    matches: ({ err }) =>
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"),
  },
  {
    reason: "invalid_key",
    matches: ({ code, message }) =>
      code === 401 || code === 403 || /API key not valid|API_KEY_INVALID/i.test(message),
  },
  {
    reason: "quota",
    matches: ({ code, message }) => code === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message),
  },
  { reason: "model_not_found", matches: ({ code }) => code === 404 },
  { reason: "service_error", matches: ({ code }) => code !== undefined && code >= 500 },
  {
    reason: "network",
    matches: ({ message }) =>
      /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT/i.test(message),
  },
  { reason: "bad_output", matches: ({ err }) => err instanceof SyntaxError },
];

/** Map an SDK or network error to one short reason. Never returns the message itself. */
export function classifyGeminiError(err: unknown): GeminiFailureReason {
  if (err instanceof GeminiUnavailableError) return err.reason;
  const status = (err as { status?: unknown } | null)?.status;
  const facts: ErrorFacts = {
    code: typeof status === "number" ? status : undefined,
    message: err instanceof Error ? err.message : "",
    err,
  };
  return FAILURE_RULES.find((rule) => rule.matches(facts))?.reason ?? "unknown";
}
