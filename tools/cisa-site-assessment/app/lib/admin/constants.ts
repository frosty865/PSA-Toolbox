/**
 * Admin API auth — single source of truth for cookie/header names.
 * Must stay in sync with proxy.ts gate (server) and client fetch behavior.
 */
export const ADMIN_API_TOKEN_HEADER = "x-admin-api-token";
export const ADMIN_COOKIE_NAME = "psa_admin_api_token";
export const ADMIN_ACTOR_HEADER = "x-admin-actor";
export const ADMIN_AUTH_MODE_HEADER = "x-admin-auth-mode";
export const ADMIN_REQUEST_ID_HEADER = "x-admin-request-id";
