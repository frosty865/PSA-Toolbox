/**
 * Request correlation id and structured error responses for admin module APIs.
 * - x-request-id: use if present, else generate a short id
 * - All error responses: { message, code, details?, request_id }
 */

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getOrCreateRequestId(request: Request): string {
  const h = request.headers.get("x-request-id");
  if (h && typeof h === "string" && h.trim().length > 0) return h.trim().slice(0, 64);
  return "req_" + Math.random().toString(36).slice(2, 12);
}

export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_V4_RE.test(s);
}

/** 400 validation error */
export function err400(message: string, code: string, details?: Record<string, unknown>) {
  return { message, code, details: details ?? undefined };
}

/** 500 server error */
export function err500(message: string, code: string, details?: Record<string, unknown>) {
  return { message, code, details: details ?? undefined };
}

export type StructuredError = { message: string; code: string; details?: Record<string, unknown> };
