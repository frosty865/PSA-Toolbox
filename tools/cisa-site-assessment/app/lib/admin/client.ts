import { ADMIN_API_TOKEN_HEADER, ADMIN_COOKIE_NAME } from "./constants";

/** Read PSA admin token from `document.cookie` (non-HttpOnly cookie set by AdminAccessGate). */
export function readAdminCookieFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${ADMIN_COOKIE_NAME}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

export function isLocalhostHostname(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

/**
 * Admin API calls are allowed without a cookie on localhost (proxy bypass).
 * In production, wait until the user has submitted the admin gate cookie.
 */
export function shouldSendAdminApiRequests(): boolean {
  return isLocalhostHostname() || !!readAdminCookieFromDocument();
}

/**
 * Headers for same-origin admin API calls: duplicate cookie into `x-admin-api-token`
 * so proxies cannot strip cookies without breaking auth.
 */
export function adminAuthHeaders(): Headers {
  const headers = new Headers();
  const token = readAdminCookieFromDocument();
  if (token) {
    headers.set(ADMIN_API_TOKEN_HEADER, token);
  }
  return headers;
}
