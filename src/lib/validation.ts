import { z } from "zod";

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  errors: { field: string; message: string }[];
}

/**
 * Check untrusted input against a schema. On failure only the field path and
 * the rule message are returned, never the submitted value.
 * The result type is the schema's output, so defaults are already applied.
 */
export function validatePayload<S extends z.ZodType>(
  schema: S,
  data: unknown
): ValidationSuccess<z.output<S>> | ValidationFailure {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return { success: false, errors };
}
