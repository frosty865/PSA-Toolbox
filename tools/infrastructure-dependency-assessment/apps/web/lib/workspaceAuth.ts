export const DEFAULT_WORKSPACE_PORTAL_URL = 'https://www.example.com';
/** Placeholder until agency IdP is wired; local runs do not require sign-in. */
export const DEFAULT_WORKSPACE_SIGNIN_URL = 'https://www.example.com';
export const WORKSPACE_SESSION_COOKIE_PREFIX = 'psa-workspace-auth';
export const WORKSPACE_SESSION_COOKIE_NAMES = [
  'mp-auth',
  'sb-access-token',
  'sb-refresh-token',
] as const;
