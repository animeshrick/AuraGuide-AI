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

/** Map an SDK or network error to one short reason. Never returns the message itself. */
export function classifyGeminiError(err: unknown): GeminiFailureReason {
  if (err instanceof GeminiUnavailableError) return err.reason;
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
    return "timeout";
  }
  const status = (err as { status?: unknown })?.status;
  const code = typeof status === "number" ? status : undefined;
  const message = err instanceof Error ? err.message : "";
  if (code === 401 || code === 403 || /API key not valid|API_KEY_INVALID/i.test(message)) {
    return "invalid_key";
  }
  if (code === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)) return "quota";
  if (code === 404) return "model_not_found";
  if (code !== undefined && code >= 500) return "service_error";
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT/i.test(message)) return "network";
  if (err instanceof SyntaxError) return "bad_output";
  return "unknown";
}
