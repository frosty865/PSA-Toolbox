/**
 * Compute source_registry tier (1, 2, or 3) from publisher name and optional URL.
 * Uses model/policy/source_policy.v1.json and publisher normalization.
 * All .gov and .mil sources are tier 1.
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizePublisherName } from './publisherNormalizer';

const POLICY_PATH = path.join(process.cwd(), 'model', 'policy', 'source_policy.v1.json');

type TierPolicy = { tiers: { [key: string]: string[] } };

let cachedPolicy: TierPolicy | null = null;

function loadTierPolicy(): TierPolicy {
  if (cachedPolicy) return cachedPolicy;
  if (!fs.existsSync(POLICY_PATH)) {
    throw new Error(`Source policy not found: ${POLICY_PATH}`);
  }
  const content = fs.readFileSync(POLICY_PATH, 'utf-8');
  const parsed = JSON.parse(content) as TierPolicy;
  if (!parsed.tiers || typeof parsed.tiers !== 'object') {
    throw new Error(`Invalid source policy: missing tiers`);
  }
  cachedPolicy = parsed;
  return cachedPolicy;
}

/** True if the URL's host is .gov or .mil (any government/military). */
export function isGovOrMilUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host.endsWith('.gov') || host.endsWith('.mil') || host.includes('.gov.') || host.includes('.mil.');
  } catch {
    return false;
  }
}

/**
 * Returns tier 1, 2, or 3 for a given publisher (and optional canonical URL).
 * - Tier 1: any .gov/.mil URL, or CISA, DHS, DOJ, National Laboratories (and any publisher containing "National Laborator")
 * - Tier 2: FEMA, ISC, GSA, DoD UFC, NIST
 * - Tier 3: ASIS, NFPA and any unknown publisher (default)
 */
export function tierFromPublisher(publisher: string | null | undefined): number {
  const raw = publisher?.trim();
  if (!raw) return 3;

  const normalized = normalizePublisherName(raw) ?? raw;
  const upper = normalized.toUpperCase();

  // Tier 1: National Laboratories (any name containing "National Laborator" or "National Lab")
  if (upper.includes('NATIONAL LABORATOR') || upper.includes('NATIONAL LAB')) {
    return 1;
  }

  const policy = loadTierPolicy();
  for (const [tierStr, publishers] of Object.entries(policy.tiers)) {
    if (publishers.some((p) => upper === p.toUpperCase())) {
      return parseInt(tierStr, 10);
    }
  }

  return 3;
}

/**
 * Returns tier from publisher and optional canonical URL. All .gov and .mil URLs are tier 1.
 */
export function tierFromPublisherAndUrl(
  publisher: string | null | undefined,
  canonicalUrl: string | null | undefined
): number {
  if (isGovOrMilUrl(canonicalUrl)) return 1;
  return tierFromPublisher(publisher);
}
