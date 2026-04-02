/**
 * Publisher Name Normalization
 * 
 * Normalizes publisher names to their canonical forms:
 * - DHS (not "Dhs" or "dhs")
 * - CISA, FEMA, NIST, NFPA, ASIS, ISC, GSA
 * - Sandia National Laboratory (from "Sandia Studies", "SNL", etc.)
 * - Handles common variations and typos
 */

/**
 * Map of common publisher name variations to canonical forms
 */
const PUBLISHER_CANONICAL_MAP: Record<string, string> = {
  // DHS variations (includes components like Secret Service)
  'dhs': 'DHS',
  'Dhs': 'DHS',
  'DHS': 'DHS',
  'homeland security': 'DHS',
  'U.S. Department of Homeland Security': 'DHS',
  'US Department of Homeland Security': 'DHS',
  'Department of Homeland Security': 'DHS',
  'U.S. Secret Service': 'DHS',
  'US Secret Service': 'DHS',
  'Secret Service': 'DHS',
  
  // CISA variations
  'cisa': 'CISA',
  'Cisa': 'CISA',
  'CISA': 'CISA',
  'cybersecurity and infrastructure security agency': 'CISA',
  'Cybersecurity and Infrastructure Security Agency': 'CISA',
  
  // FEMA variations
  'fema': 'FEMA',
  'Fema': 'FEMA',
  'FEMA': 'FEMA',
  'federal emergency management agency': 'FEMA',
  'Federal Emergency Management Agency': 'FEMA',
  
  // NIST variations
  'nist': 'NIST',
  'Nist': 'NIST',
  'NIST': 'NIST',
  'national institute of standards and technology': 'NIST',
  'National Institute of Standards and Technology': 'NIST',
  
  // NFPA variations
  'nfpa': 'NFPA',
  'Nfpa': 'NFPA',
  'NFPA': 'NFPA',
  'national fire protection association': 'NFPA',
  'National Fire Protection Association': 'NFPA',
  
  // ASIS variations (Tier 2 — industry association)
  'asis': 'ASIS',
  'Asis': 'ASIS',
  'ASIS': 'ASIS',
  'american society for industrial security': 'ASIS',
  'American Society for Industrial Security': 'ASIS',
  
  // UL variations (Tier 2 — research / standards support)
  'ul': 'UL',
  'UL': 'UL',
  'underwriters laboratories': 'UL',
  'Underwriters Laboratories': 'UL',
  'UL LLC': 'UL',
  'UL Solutions': 'UL',
  
  // ISC variations
  'isc': 'ISC',
  'Isc': 'ISC',
  'ISC': 'ISC',
  'infrastructure security coalition': 'ISC',
  'Infrastructure Security Coalition': 'ISC',
  
  // GSA variations
  'gsa': 'GSA',
  'Gsa': 'GSA',
  'GSA': 'GSA',
  'general services administration': 'GSA',
  'General Services Administration': 'GSA',
  
  // DOJ variations (includes FBI, ATF as DOJ components)
  'doj': 'DOJ',
  'DOJ': 'DOJ',
  'department of justice': 'DOJ',
  'Department of Justice': 'DOJ',
  'U.S. Department of Justice': 'DOJ',
  'US Department of Justice': 'DOJ',
  'United States Department of Justice': 'DOJ',
  'FBI': 'DOJ',
  'fbi': 'DOJ',
  'Federal Bureau of Investigation': 'DOJ',
  'U.S. Federal Bureau of Investigation': 'DOJ',
  'ATF': 'DOJ',
  'atf': 'DOJ',
  'Bureau of Alcohol, Tobacco, Firearms and Explosives': 'DOJ',
  'U.S. Bureau of Alcohol, Tobacco, Firearms and Explosives': 'DOJ',
  
  // DoD variations (UFC = Unified Facilities Criteria; always DoD)
  'dod': 'DoD',
  'DoD': 'DoD',
  'DOD': 'DoD',
  'department of defense': 'DoD',
  'Department of Defense': 'DoD',
  'U.S. Department of Defense': 'DoD',
  'US Department of Defense': 'DoD',
  'unified facilities criteria': 'DoD',
  'Unified Facilities Criteria': 'DoD',
  'ufc': 'DoD',
  'UFC': 'DoD',
  'dod ufc': 'DoD',
  'DoD UFC': 'DoD',
  
  // Sandia National Laboratory variations
  'sandia': 'Sandia National Laboratory',
  'Sandia': 'Sandia National Laboratory',
  'SANDIA': 'Sandia National Laboratory',
  'sandia studies': 'Sandia National Laboratory',
  'Sandia Studies': 'Sandia National Laboratory',
  'sandia national laboratory': 'Sandia National Laboratory',
  'Sandia National Laboratory': 'Sandia National Laboratory',
  'Sandia National Laboratories': 'Sandia National Laboratory',
  'sandia national laboratories': 'Sandia National Laboratory',
  'snl': 'Sandia National Laboratory',
  'SNL': 'Sandia National Laboratory',
  
  // Other National Laboratories (normalize to "National Laboratories" for tier 1 classification)
  'oak ridge national laboratory': 'Oak Ridge National Laboratory',
  'Oak Ridge National Laboratory': 'Oak Ridge National Laboratory',
  'Oak Ridge National Laboratories': 'Oak Ridge National Laboratory',
  'ornl': 'Oak Ridge National Laboratory',
  'ORNL': 'Oak Ridge National Laboratory',
  
  'lawrence livermore national laboratory': 'Lawrence Livermore National Laboratory',
  'Lawrence Livermore National Laboratory': 'Lawrence Livermore National Laboratory',
  'Lawrence Livermore National Laboratories': 'Lawrence Livermore National Laboratory',
  'llnl': 'Lawrence Livermore National Laboratory',
  'LLNL': 'Lawrence Livermore National Laboratory',
  
  'los alamos national laboratory': 'Los Alamos National Laboratory',
  'Los Alamos National Laboratory': 'Los Alamos National Laboratory',
  'Los Alamos National Laboratories': 'Los Alamos National Laboratory',
  'lanl': 'Los Alamos National Laboratory',
  'LANL': 'Los Alamos National Laboratory',
  
  'argonne national laboratory': 'Argonne National Laboratory',
  'Argonne National Laboratory': 'Argonne National Laboratory',
  'Argonne National Laboratories': 'Argonne National Laboratory',
  'anl': 'Argonne National Laboratory',
  'ANL': 'Argonne National Laboratory',
  
  'brookhaven national laboratory': 'Brookhaven National Laboratory',
  'Brookhaven National Laboratory': 'Brookhaven National Laboratory',
  'Brookhaven National Laboratories': 'Brookhaven National Laboratory',
  'bnl': 'Brookhaven National Laboratory',
  'BNL': 'Brookhaven National Laboratory',
  
  'pacific northwest national laboratory': 'Pacific Northwest National Laboratory',
  'Pacific Northwest National Laboratory': 'Pacific Northwest National Laboratory',
  'Pacific Northwest National Laboratories': 'Pacific Northwest National Laboratory',
  'pnnl': 'Pacific Northwest National Laboratory',
  'PNNL': 'Pacific Northwest National Laboratory',
  
  'idaho national laboratory': 'Idaho National Laboratory',
  'Idaho National Laboratory': 'Idaho National Laboratory',
  'inl': 'Idaho National Laboratory',
  'INL': 'Idaho National Laboratory',
  
  'nrel': 'NREL',
  'NREL': 'NREL',
  'national renewable energy laboratory': 'NREL',
  'National Renewable Energy Laboratory': 'NREL',
  
  // Generic "National Laboratories" for tier classification
  'national laboratories': 'National Laboratories',
  'National Laboratories': 'National Laboratories',
  'national laboratory': 'National Laboratories',
  'National Laboratory': 'National Laboratories',
};

/**
 * Full hostname (and key subdomains) → canonical publisher.
 * Check this before using second-level domain so e.g. cisa.dhs.gov → CISA, not DHS.
 */
const HOSTNAME_TO_PUBLISHER: Record<string, string> = {
  'cisa.dhs.gov': 'CISA',
  'dhs.gov': 'DHS',
  'fema.gov': 'FEMA',
  'ready.gov': 'FEMA',
  'fbi.gov': 'FBI',
  'nist.gov': 'NIST',
  'isc.gov': 'ISC',
  'gsa.gov': 'GSA',
  'asisonline.org': 'ASIS',
  'nfpa.org': 'NFPA',
  'mit.edu': 'MIT',
  'ocw.mit.edu': 'MIT',
  'wbdg.org': 'DoD',  // Whole Building Design Guide hosts DoD UFC documents
  'sandia.gov': 'Sandia National Laboratory',
  'llnl.gov': 'Lawrence Livermore National Laboratory',
  'lanl.gov': 'Los Alamos National Laboratory',
  'anl.gov': 'Argonne National Laboratory',
  'ornl.gov': 'Oak Ridge National Laboratory',
  'pnnl.gov': 'Pacific Northwest National Laboratory',
  'bnl.gov': 'Brookhaven National Laboratory',
  'inl.gov': 'Idaho National Laboratory',
  'nrel.gov': 'NREL',
};

/** Display label when publisher is missing: blank (do not store "—"; use null in DB). */
export const DISPLAY_MISSING_PUBLISHER = '';

/** Query param value for "filter by no publisher" (API only; not stored). */
export const FILTER_NO_PUBLISHER = '__no_publisher__';

/** Unacceptable publisher values (case-insensitive); must not be stored. Keep parsing until a real value is found. */
const UNACCEPTABLE_PUBLISHERS = new Set([
  'unknown',
  'local file',
  'module source',
  'module upload',  // scope/category label — show in Scope column, not Publisher
  'unspecified',
  '(no publisher)',
  'no publisher',
  'source',  // fallback placeholder — store null instead
  'general corpus',  // ingestion stream placeholder — never store; use null and backfill from PDF
  '—',       // em dash (U+2014) — never store; leave cell blank
  '\u2014',  // same
  // PDF software metadata (not a real publisher)
  'pscript5.dll',
  'pscript5.dll version',
  'pscript5.dll version 5.2.2',
]);

/** Reject publisher strings that look like PDF/driver software (e.g. "PScript5.dll Version 5.2.2"). */
function looksLikeSoftwarePublisher(publisher: string): boolean {
  const key = publisher.trim().toLowerCase();
  if (key.includes('pscript5') || key.includes('pscript5.dll')) return true;
  if (/\.dll\s+version\b/i.test(key)) return true;
  if (/^ghostscript\b/i.test(key) || /^adobe pdf\s*library/i.test(key)) return true;
  return false;
}

/**
 * Returns true if the publisher value is unacceptable: missing (null/blank) or a placeholder.
 * Blank is never acceptable — we must not store or treat it as valid.
 */
export function isUnacceptablePublisher(publisher: string | null | undefined): boolean {
  if (publisher == null) return true;
  const key = publisher.trim().toLowerCase();
  if (key.length === 0) return true;
  if (UNACCEPTABLE_PUBLISHERS.has(key)) return true;
  if (looksLikeSoftwarePublisher(publisher)) return true;
  return false;
}

/**
 * Normalize a publisher name to its canonical form
 * 
 * @param publisher Raw publisher name (may be from URL, form, or metadata)
 * @returns Canonical publisher name or null if unknown
 */
export function normalizePublisherName(publisher: string | null | undefined): string | null {
  if (!publisher) {
    return null;
  }
  
  const trimmed = publisher.trim();
  if (!trimmed) {
    return null;
  }

  // Reject unacceptable placeholders and software metadata
  if (UNACCEPTABLE_PUBLISHERS.has(trimmed.toLowerCase())) {
    return null;
  }
  if (looksLikeSoftwarePublisher(trimmed)) {
    return null;
  }
  
  // Only normalize on exact match (case-insensitive). Do not use substring/contains,
  // or values like "CISA (DHS component)" would be overwritten as "DHS".
  const lowerTrimmed = trimmed.toLowerCase();
  if (PUBLISHER_CANONICAL_MAP[lowerTrimmed]) {
    return PUBLISHER_CANONICAL_MAP[lowerTrimmed];
  }

  // If it's a known acronym (2-5 uppercase letters), return as-is if already uppercase
  if (/^[A-Z]{2,5}$/.test(trimmed)) {
    return trimmed;
  }
  
  // If it looks like an acronym but isn't uppercase, try to match
  if (/^[a-zA-Z]{2,5}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    if (PUBLISHER_CANONICAL_MAP[upper.toLowerCase()]) {
      return PUBLISHER_CANONICAL_MAP[upper.toLowerCase()];
    }
  }
  
  // Return normalized version (title case for unknown publishers)
  // But don't return "Unknown Publisher" - let the caller decide
  return trimmed;
}

/**
 * Extract publisher from URL domain.
 * Uses full hostname first (e.g. cisa.dhs.gov → CISA), then first subdomain
 * when it normalizes to a known publisher, then second-level domain.
 */
export function extractPublisherFromUrl(urlOrReference: string): string | null {
  try {
    const url = new URL(urlOrReference);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    const domainParts = hostname.split(".");
    
    // 1. Exact full hostname match (e.g. cisa.dhs.gov → CISA)
    const byHost = HOSTNAME_TO_PUBLISHER[hostname];
    if (byHost) {
      return byHost;
    }
    
    // 2. Check if host ends with a known key (e.g. subdomain.cisa.dhs.gov)
    for (const [key, value] of Object.entries(HOSTNAME_TO_PUBLISHER)) {
      if (hostname === key || hostname.endsWith("." + key)) {
        return value;
      }
    }
    
    // 3. When host has 3+ parts, try first segment as agency (cisa.dhs.gov → "cisa" → CISA)
    if (domainParts.length >= 3) {
      const subdomain = domainParts[0];
      const normalized = normalizePublisherName(subdomain);
      if (normalized) {
        return normalized;
      }
    }
    
    // 4. Second-level domain (e.g. dhs.gov → DHS)
    if (domainParts.length >= 2) {
      const org = domainParts[domainParts.length - 2];
      const normalized = normalizePublisherName(org);
      if (normalized) {
        return normalized;
      }
      return org.charAt(0).toUpperCase() + org.slice(1).toLowerCase();
    }
    
    return null;
  } catch {
    // Not a URL, try to extract from reference text
    const parts = urlOrReference.split(" - ");
    if (parts.length > 1) {
      const publisher = parts[0].trim();
      return normalizePublisherName(publisher) || publisher;
    }
    return null;
  }
}

/**
 * Get publisher from multiple sources with priority:
 * 1. Explicitly provided publisher (highest priority)
 * 2. Extracted from URL
 * 3. Extracted from title/content
 * 
 * @param providedPublisher Publisher explicitly provided (e.g., from form)
 * @param url URL to extract publisher from
 * @param titleOrContent Title or content to search for publisher
 * @returns Normalized publisher name or null
 */
export function getPublisherFromSources(
  providedPublisher?: string | null,
  url?: string | null,
  titleOrContent?: string | null
): string | null {
  // Priority 1: Use provided publisher if available
  if (providedPublisher) {
    const normalized = normalizePublisherName(providedPublisher);
    if (normalized) {
      return normalized;
    }
    // If provided but not recognized, still use it (user knows best)
    return providedPublisher.trim();
  }
  
  // Priority 2: Extract from URL
  if (url) {
    const fromUrl = extractPublisherFromUrl(url);
    if (fromUrl) {
      return fromUrl;
    }
  }
  
  // Priority 3: Search in title/content
  if (titleOrContent) {
    const text = titleOrContent.toLowerCase();
    for (const [key, value] of Object.entries(PUBLISHER_CANONICAL_MAP)) {
      if (text.includes(key.toLowerCase())) {
        return value;
      }
    }
  }
  
  return null;
}
