import type { NextRequest } from "next/server";

const ADMIN_ACTOR_HEADER = "x-admin-actor";
const ADMIN_AUTH_MODE_HEADER = "x-admin-auth-mode";
const ADMIN_REQUEST_ID_HEADER = "x-admin-request-id";

export type AdminAuditContext = {
  actor: string;
  authMode: string;
  requestId: string;
  path: string;
  method: string;
  ip: string | null;
  userAgent: string | null;
};

export function getAdminAuditContext(request: NextRequest): AdminAuditContext {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor
    ?.split(",")
    .map((value) => value.trim())
    .find(Boolean) ?? null;

  return {
    actor: request.headers.get(ADMIN_ACTOR_HEADER) ?? "unknown-admin",
    authMode: request.headers.get(ADMIN_AUTH_MODE_HEADER) ?? "unknown",
    requestId: request.headers.get(ADMIN_REQUEST_ID_HEADER) ?? "missing-request-id",
    path: request.nextUrl.pathname,
    method: request.method,
    ip,
    userAgent: request.headers.get("user-agent"),
  };
}

export function writeAdminAuditLog(
  event: string,
  context: AdminAuditContext,
  details?: Record<string, unknown>
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    event,
    actor: context.actor,
    auth_mode: context.authMode,
    request_id: context.requestId,
    method: context.method,
    path: context.path,
    ip: context.ip,
    user_agent: context.userAgent,
    details: details ?? {},
  };

  console.info(`[ADMIN_AUDIT] ${JSON.stringify(payload)}`);
}
