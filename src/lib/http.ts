import { NextResponse } from "next/server";
import { checkRateLimit } from "./rate-limiter";

const MAX_BODY_BYTES = 32 * 1024;

export type ApiErrorCode =
  | "rate_limited"
  | "invalid_json"
  | "payload_too_large"
  | "invalid_request"
  | "city_not_found"
  | "ai_unavailable"
  | "internal_error";

export function apiJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
  headers?: HeadersInit
): NextResponse {
  return apiJson({ error: message, code, ...extra }, { status, headers });
}

/**
 * Who is calling. Uses the first address in x-forwarded-for, which hosting
 * platforms such as Vercel and Cloud Run set. Behind a proxy that does not
 * overwrite this header, a caller could vary it to dodge the limit.
 */
export function getClientId(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "anonymous";
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export function enforceRateLimit(req: Request): NextResponse | null {
  const result = checkRateLimit(getClientId(req));
  if (result.success) return null;
  return apiError(
    "rate_limited",
    "Too many requests. Please wait a moment and try again.",
    429,
    {},
    { "Retry-After": String(Math.max(1, Math.ceil(result.resetMs / 1000))) }
  );
}

export type JsonBodyResult = { ok: true; data: unknown } | { ok: false; response: NextResponse };

/** Read a small JSON body. Larger bodies and invalid JSON get a clear error. */
export async function readJsonBody(req: Request): Promise<JsonBodyResult> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: apiError("payload_too_large", "The request is too large.", 413),
    };
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return {
      ok: false,
      response: apiError("invalid_json", "The request body could not be read.", 400),
    };
  }

  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: apiError("payload_too_large", "The request is too large.", 413),
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      response: apiError("invalid_json", "The request body must be valid JSON.", 400),
    };
  }
}
