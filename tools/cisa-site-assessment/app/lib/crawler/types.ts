/**
 * Shared crawler types for URL screening.
 */
export type CrawlTarget = { kind: 'corpus' } | { kind: 'module'; moduleCode: string };
export type Strictness = 'strict' | 'balanced' | 'exploratory';

export const REJECT_CODES = [
  'NOT_HTTP',
  'REDIRECT_LOOP',
  'NOT_PDF',
  'HTML_MASQUERADE',
  'TOO_SMALL',
  'TOO_LARGE',
  'BLOCKED_DOMAIN',
  'LOW_SCORE',
  'TIMEOUT',
  'RATE_LIMITED',
  'VERIFY_FAILED',
] as const;
export type RejectCode = (typeof REJECT_CODES)[number];
