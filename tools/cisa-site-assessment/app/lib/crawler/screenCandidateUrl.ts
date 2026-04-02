/**
 * Single entrypoint for URL screening. Every URL-based ingestion path MUST call this.
 */

import { canonicalizeUrl } from './urlCanonicalize';
import { verifyPdfUrl } from './pdfVerify';
import { getCached, setCached, TTL_OK_MS, TTL_NON_OK_MS, TTL_RATE_LIMITED_MS } from './screenCache';
import { withLimiter } from './concurrency';
import { getHostFromUrl, classifyDomain, type DomainTier } from './domainTrust';
import { extractQuickTextFromPdfUrl } from './extractQuickText';
import { scorePdfCandidate } from './relevanceScore';
import { resolveLandingToPdf } from './resolveLandingToPdf';
import type { CrawlTarget, Strictness } from './types';

export type { CrawlTarget, Strictness } from './types';

export type ScreenVerdict =
  | {
      ok: true;
      canonicalUrl: string;
      finalUrl: string;
      pdfMeta: { contentType: string; contentLength: number };
      score: number;
      reasons: string[];
      timing?: ScreenTiming;
    }
  | {
      ok: false;
      canonicalUrl: string;
      rejectCode: string;
      score?: number;
      reasons: string[];
      timing?: ScreenTiming;
    };

type CachedVerdict = ScreenVerdict;

export interface ScreenOptions {
  target: CrawlTarget;
  strictness?: Strictness;
  resolveLandingToPdf?: boolean;
}

/** Timing fields for operator/debug (optional). */
export interface ScreenTiming {
  verifyMs?: number;
  resolveMs?: number;
  scoreMs?: number;
  totalMs?: number;
}

function bestTier(a: DomainTier, b: DomainTier): DomainTier {
  if (a === 1 || b === 1) return 1;
  if (a === 2 || b === 2) return 2;
  return 'unknown';
}

function thresholdForStrictness(strictness: Strictness): { minScore: number; tier1Only: boolean; allowTier2: boolean } {
  switch (strictness) {
    case 'strict':
      return { minScore: 60, tier1Only: true, allowTier2: false };
    case 'balanced':
      return { minScore: 70, tier1Only: false, allowTier2: true };
    case 'exploratory':
      return { minScore: 80, tier1Only: false, allowTier2: true };
    default:
      return { minScore: 60, tier1Only: true, allowTier2: false };
  }
}

/**
 * Screen a candidate URL. Uses cache keyed by canonicalUrl.
 * On NOT_PDF/HTML_MASQUERADE and resolveLandingToPdf=true, tries resolveLandingToPdf then verifies candidates.
 * Optionally includes timing (verifyMs, resolveMs, scoreMs, totalMs) for debugging.
 */
export async function screenCandidateUrl(
  inputUrl: string,
  opts: ScreenOptions
): Promise<ScreenVerdict> {
  const totalStart = Date.now();
  const strictness = opts.strictness ?? 'strict';
  const shouldResolveLandingToPdf = opts.resolveLandingToPdf ?? false;

  const canon = canonicalizeUrl(inputUrl);
  if (!canon.ok) {
    return {
      ok: false,
      canonicalUrl: inputUrl.trim(),
      rejectCode: 'NOT_HTTP',
      reasons: [canon.reason],
      timing: { totalMs: Date.now() - totalStart },
    };
  }
  const canonicalUrl = canon.canonicalUrl;

  const cached = getCached(canonicalUrl) as CachedVerdict | undefined;
  if (cached) {
    return { ...cached, canonicalUrl: cached.canonicalUrl };
  }

  let urlToVerify = canonicalUrl;
  const verifyStart = Date.now();
  let verifyResult = await withLimiter(canonicalUrl, () =>
    verifyPdfUrl(urlToVerify, { maxRedirects: 5, headTimeoutMs: 12_000, rangeTimeoutMs: 12_000 })
  );
  let verifyMs = Date.now() - verifyStart;
  let resolveMs = 0;

  if (!verifyResult.ok && (verifyResult.rejectCode === 'NOT_PDF' || verifyResult.rejectCode === 'HTML_MASQUERADE') && shouldResolveLandingToPdf) {
    const resolveStart = Date.now();
    const candidates = await resolveLandingToPdf(canonicalUrl, { htmlTimeoutMs: 15_000, maxBytes: 2 * 1024 * 1024 });
    resolveMs = Date.now() - resolveStart;
    for (const candidate of candidates) {
      const v = await withLimiter(candidate, () =>
        verifyPdfUrl(candidate, { maxRedirects: 5, headTimeoutMs: 12_000, rangeTimeoutMs: 12_000 })
      );
      if (v.ok) {
        verifyResult = v;
        urlToVerify = candidate;
        verifyMs += Date.now() - resolveStart - resolveMs;
        break;
      }
    }
  }

  if (!verifyResult.ok) {
    const ttlMs = verifyResult.rejectCode === 'RATE_LIMITED' ? TTL_RATE_LIMITED_MS : TTL_NON_OK_MS;
    const verdict: ScreenVerdict = {
      ok: false,
      canonicalUrl,
      rejectCode: verifyResult.rejectCode,
      reasons: [verifyResult.reason],
      timing: { verifyMs, resolveMs, totalMs: Date.now() - totalStart },
    };
    setCached(canonicalUrl, verdict, ttlMs);
    return verdict;
  }

  const finalUrl = verifyResult.finalUrl;
  const canonicalHost = getHostFromUrl(canonicalUrl) ?? '';
  const finalHost = getHostFromUrl(finalUrl) ?? '';
  const classifyCanonical = classifyDomain(canonicalHost);
  const classifyFinal = classifyDomain(finalHost);

  if (classifyCanonical.tier === 'blocked' || classifyFinal.tier === 'blocked') {
    const classify = classifyCanonical.tier === 'blocked' ? classifyCanonical : classifyFinal;
    const verdict: ScreenVerdict = {
      ok: false,
      canonicalUrl,
      rejectCode: 'BLOCKED_DOMAIN',
      reasons: classify.reasons,
      timing: { verifyMs, resolveMs, totalMs: Date.now() - totalStart },
    };
    setCached(canonicalUrl, verdict, TTL_NON_OK_MS);
    return verdict;
  }

  const tier = bestTier(classifyCanonical.tier, classifyFinal.tier);

  const scoreStart = Date.now();
  const quick = await extractQuickTextFromPdfUrl(finalUrl);
  const { score, reasons } = scorePdfCandidate({
    target: opts.target,
    tier,
    title: quick.title,
    firstPageText: quick.firstPageText,
    strictness,
  });
  const scoreMs = Date.now() - scoreStart;

  const { minScore, tier1Only, allowTier2 } = thresholdForStrictness(strictness);
  const allowedTier =
    tier === 1 || (tier === 2 && allowTier2) || (tier === 'unknown' && !tier1Only);
  if (!allowedTier || score < minScore) {
    const verdict: ScreenVerdict = {
      ok: false,
      canonicalUrl,
      rejectCode: 'LOW_SCORE',
      score,
      reasons: [...reasons, `Score ${score} below threshold ${minScore} or tier not allowed`],
      timing: { verifyMs, resolveMs, scoreMs, totalMs: Date.now() - totalStart },
    };
    setCached(canonicalUrl, verdict, TTL_NON_OK_MS);
    return verdict;
  }

  const verdict: ScreenVerdict = {
    ok: true,
    canonicalUrl,
    finalUrl,
    pdfMeta: {
      contentType: verifyResult.contentType,
      contentLength: verifyResult.contentLength,
    },
    score,
    reasons,
    timing: { verifyMs, resolveMs, scoreMs, totalMs: Date.now() - totalStart },
  };
  setCached(canonicalUrl, verdict, TTL_OK_MS);
  return verdict;
}
