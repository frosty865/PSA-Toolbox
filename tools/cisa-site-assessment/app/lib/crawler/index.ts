/**
 * Crawler URL screening – single entrypoint for PSA.
 * Use screenCandidateUrl for all URL ingestion paths.
 */
export {
  screenCandidateUrl,
  type CrawlTarget,
  type Strictness,
  type ScreenVerdict,
  type ScreenOptions,
} from './screenCandidateUrl';
export { verifyPdfUrl, verifyPdfBuffer, MIN_PDF_BYTES, MAX_PDF_BYTES } from './pdfVerify';
export { canonicalizeUrl, isHttpOrHttps } from './urlCanonicalize';
export { classifyDomain, getHostFromUrl, type DomainTier } from './domainTrust';
export { scorePdfCandidate } from './relevanceScore';
export type { RejectCode } from './types';
export { REJECT_CODES } from './types';
export { getCached, setCached, TTL_OK_MS, TTL_NON_OK_MS, TTL_RATE_LIMITED_MS } from './screenCache';
export type { CachedScreen } from './screenCache';
