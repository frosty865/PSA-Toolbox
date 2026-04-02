/**
 * Domain trust classification: Tier-1 (.gov, .mil, national labs), Tier-2 (.edu, nonprofits), Blocked (vendors, link shorteners).
 */

export type DomainTier = 1 | 2 | 'blocked' | 'unknown';

export function classifyDomain(host: string): { tier: DomainTier; reasons: string[] } {
  const reasons: string[] = [];
  const hostLower = host.toLowerCase();

  if (BLOCKED_LINK_SHORTENERS.some((d) => hostLower === d || hostLower.endsWith('.' + d))) {
    reasons.push('Link shortener domain');
    return { tier: 'blocked', reasons };
  }
  if (BLOCKED_VENDOR_DOMAINS.some((d) => hostLower === d || hostLower.endsWith('.' + d))) {
    reasons.push('Vendor/marketing domain');
    return { tier: 'blocked', reasons };
  }

  for (const pattern of TIER1_PATTERNS) {
    if (pattern.test(hostLower)) {
      reasons.push(`Tier-1: ${pattern.source}`);
      return { tier: 1, reasons };
    }
  }
  for (const pattern of TIER2_PATTERNS) {
    if (pattern.test(hostLower)) {
      reasons.push(`Tier-2: ${pattern.source}`);
      return { tier: 2, reasons };
    }
  }

  reasons.push('Domain not in allowlist');
  return { tier: 'unknown', reasons };
}

export function getHostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const TIER1_PATTERNS: RegExp[] = [
  /\.gov$/i,
  /\.mil$/i,
  /\.gov\./i,
  /\.mil\./i,
  /cisa\.gov/i,
  /fema\.gov/i,
  /nist\.gov/i,
  /nfpa\.org/i,
  /dhs\.gov/i,
  /gpo\.gov/i,
  /nrc\.gov/i,
  /energy\.gov/i,
  /osti\.gov/i,
  /sandia\.gov/i,
  /lanl\.gov/i,
  /llnl\.gov/i,
  /anl\.gov/i,
  /bnl\.gov/i,
  /ornl\.gov/i,
  /pnnl\.gov/i,
  /iso\.org/i,
  /iec\.ch/i,
  /ansi\.org/i,
  /astm\.org/i,
  /osha\.gov/i,
  /fbi\.gov/i,
  /dod\.gov/i,
  /state\.gov/i,
];

const TIER2_PATTERNS: RegExp[] = [
  /\.edu$/i,
  /\.edu\./i,
  /asis\.org/i,
  /asisonline\.org/i,
  /nfpa\.org/i,
  /iccsafe\.org/i,
  /nsc\.org/i,
];

const BLOCKED_LINK_SHORTENERS = ['bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'ow.ly', 'is.gd', 'buff.ly', 'adf.ly'];

const BLOCKED_VENDOR_DOMAINS = [
  'salesforce.com',
  'hubspot.com',
  'marketo.com',
  'pardot.com',
  'demandbase.com',
];
