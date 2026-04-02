import { NextRequest, NextResponse } from "next/server";

const ADMIN_API_TOKEN_HEADER = "x-admin-api-token";
const ADMIN_ACTOR_HEADER = "x-admin-actor";
const ADMIN_AUTH_MODE_HEADER = "x-admin-auth-mode";
const ADMIN_REQUEST_ID_HEADER = "x-admin-request-id";

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isLocalDevelopmentRequest(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  if (isLoopbackHost(request.nextUrl.hostname)) {
    return true;
  }

  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  return forwardedFor
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === "127.0.0.1" || value === "::1");
}

function extractProvidedToken(request: NextRequest): string | null {
  const explicitHeader = request.headers.get(ADMIN_API_TOKEN_HEADER);
  if (explicitHeader) {
    return explicitHeader.trim();
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

/** Next.js 16+: former middleware; admin API gate for token vs local dev bypass. */
export function proxy(request: NextRequest) {
  const configuredToken = process.env.ADMIN_API_TOKEN?.trim() ?? "";
  const providedToken = extractProvidedToken(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ADMIN_REQUEST_ID_HEADER, request.headers.get(ADMIN_REQUEST_ID_HEADER) ?? crypto.randomUUID());

  if (configuredToken) {
    if (providedToken === configuredToken) {
      requestHeaders.set(ADMIN_ACTOR_HEADER, process.env.ADMIN_API_TOKEN_LABEL?.trim() || "admin-token");
      requestHeaders.set(ADMIN_AUTH_MODE_HEADER, "token");
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    return NextResponse.json(
      {
        error: "Unauthorized",
        message: `Provide a valid ${ADMIN_API_TOKEN_HEADER} header or Bearer token.`,
      },
      { status: 401 }
    );
  }

  if (isLocalDevelopmentRequest(request)) {
    requestHeaders.set(ADMIN_ACTOR_HEADER, "local-development");
    requestHeaders.set(ADMIN_AUTH_MODE_HEADER, "local-dev-bypass");
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.json(
    {
      error: "Admin API token not configured",
      message:
        "Set ADMIN_API_TOKEN for non-development environments, or call these endpoints from local development only.",
    },
    { status: 503 }
  );
}

export const config = {
  matcher: ["/api/admin/:path*", "/api/runtime/admin/:path*"],
};
