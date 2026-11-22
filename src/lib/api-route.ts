import { NextResponse } from "next/server";
import { z } from "zod";
import { GeminiUnavailableError } from "@/ai/gemini";
import { apiError, enforceRateLimit, readJsonBody } from "./http";
import { validatePayload } from "./validation";

interface JsonRouteOptions<S extends z.ZodType> {
  /** Used in the server log, for example "POST /api/plan". */
  name: string;
  schema: S;
  /** Shown when the body does not match the schema. */
  invalidMessage: string;
  /** Shown when something unexpected fails. */
  failureMessage: string;
  /** The route's own work, given a body that has already passed the schema. */
  handle: (data: z.output<S>) => Promise<NextResponse>;
}

/**
 * Build a POST handler with the steps every API route shares: rate limit,
 * size-checked JSON body, schema validation, and one place that turns errors
 * into clear responses (503 when Gemini does not answer, 500 otherwise).
 */
export function createJsonRoute<S extends z.ZodType>(options: JsonRouteOptions<S>) {
  return async function POST(req: Request): Promise<NextResponse> {
    const limited = enforceRateLimit(req);
    if (limited) return limited;

    const body = await readJsonBody(req);
    if (!body.ok) return body.response;

    const validation = validatePayload(options.schema, body.data);
    if (!validation.success) {
      return apiError("invalid_request", options.invalidMessage, 400, {
        details: validation.errors,
      });
    }

    try {
      return await options.handle(validation.data);
    } catch (err) {
      if (err instanceof GeminiUnavailableError) {
        return apiError(
          "ai_unavailable",
          "The AI service did not answer, so nothing was written. The server log shows the reason.",
          503
        );
      }
      console.error(`${options.name} failed:`, err instanceof Error ? err.message : "unknown");
      return apiError("internal_error", options.failureMessage, 500);
    }
  };
}

/** The 404 returned when a city cannot be found. */
export function cityNotFound(message = "We could not find that city."): NextResponse {
  return apiError("city_not_found", message, 404);
}
