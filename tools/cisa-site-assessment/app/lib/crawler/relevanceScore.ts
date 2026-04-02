/**
 * Relevance scoring: +50 tier1, +20 tier2, +15 per keyword group (cap +45), −40 vendor, −30 press.
 */

import type { CrawlTarget, Strictness } from './types';
import type { DomainTier } from './domainTrust';

const KEYWORD_GROUPS: { name: string; patterns: RegExp[] }[] = [
  {
    name: 'physical security',
    patterns: [
      /protective\s+measures/i,
      /access\s+control/i,
      /perimeter/i,
      /\bbarrier/i,
      /\bbollard/i,
      /\bfence/i,
      /\bgate\b/i,
    ],
  },
  {
    name: 'surveillance/guard',
    patterns: [/cctv/i, /surveillance/i, /guard\s+force/i, /patrol/i, /post\s+orders/i],
  },
  {
    name: 'planning',
    patterns: [
      /emergency\s+action\s+plan/i,
      /\beap\b/i,
      /evacuation/i,
      /shelter-in-place/i,
      /shelter\s+in\s+place/i,
      /communications/i,
      /accountability/i,
      /reunification/i,
    ],
  },
  {
    name: 'assessment',
    patterns: [
      /vulnerability\s+assessment/i,
      /risk\s+assessment/i,
      /mitigation/i,
      /protective\s+security/i,
      /facility\s+security\s+plan/i,
    ],
  },
  {
    name: 'life safety',
    patterns: [
      /fire\s+suppression/i,
      /sprinkler/i,
      /standpipe/i,
      /smoke\s+control/i,
      /\bahj\b/i,
      /hazard\s+mitigation/i,
    ],
  },
];

const VENDOR_INDICATORS: RegExp[] = [
  /contact\s*sales/i,
  /pricing/i,
  /\bbrochure\b/i,
  /solution\s*overview/i,
  /\bwebinar\b/i,
  /\bdemo\b/i,
  /\bdatasheet\b/i,
  /\bcase\s+study\b/i,
];

const PRESS_INDICATORS: RegExp[] = [
  /press\s*release/i,
  /newsroom/i,
  /media\s+advisory/i,
  /investor\s+relations/i,
];

export function scorePdfCandidate(input: {
  target: CrawlTarget;
  tier: DomainTier;
  title?: string;
  snippet?: string;
  firstPageText?: string;
  strictness: Strictness;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (input.tier === 1) {
    score += 50;
    reasons.push('Tier-1 domain (+50)');
  } else if (input.tier === 2) {
    score += 20;
    reasons.push('Tier-2 domain (+20)');
  }

  const text = [input.title ?? '', input.snippet ?? '', input.firstPageText ?? ''].join(' ');

  let keywordHits = 0;
  for (const group of KEYWORD_GROUPS) {
    const hit = group.patterns.some((re) => re.test(text));
    if (hit) {
      keywordHits++;
      reasons.push(`Keyword group: ${group.name} (+15)`);
    }
  }
  const keywordBonus = Math.min(keywordHits * 15, 45);
  score += keywordBonus;

  for (const re of VENDOR_INDICATORS) {
    if (re.test(text)) {
      score -= 40;
      reasons.push(`Vendor indicator (-40): ${re.source}`);
      break;
    }
  }

  for (const re of PRESS_INDICATORS) {
    if (re.test(text)) {
      score -= 30;
      reasons.push(`Press indicator (-30): ${re.source}`);
      break;
    }
  }

  const final = Math.max(0, Math.min(100, score));
  return { score: final, reasons };
}
