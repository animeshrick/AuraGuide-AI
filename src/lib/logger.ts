/** The message of an error, or "unknown" for anything else. Never the stack or the whole object. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown";
}

/** The values to print. The detail is kept as a separate value so it is easy to filter, and left out when there is none. */
function parts(message: string, detail?: string): string[] {
  return detail === undefined ? [message] : [message, detail];
}

/**
 * The server's only way to log. Callers pass short messages and reasons, never
 * prompts, API keys or household details.
 */
export const logger = {
  /** Something went wrong, but the request was still answered another way. */
  warn: (message: string, detail?: string): void => console.warn(...parts(message, detail)),
  /** Something failed and the request could not be answered as asked. */
  error: (message: string, detail?: string): void => console.error(...parts(message, detail)),
};
