/**
 * Strict guards for dependency VOFC rows.
 * Prevents scope creep (baseline physical/cyber controls) and prescriptive language.
 * Used at seed time and via admin upsert API.
 */

const VALID_INFRA = new Set<string>([
  'ENERGY',
  'COMMUNICATIONS',
  'INFORMATION_TRANSPORT',
  'WATER',
  'WASTEWATER',
]);

const VALID_SOURCE_TYPE = new Set<string>(['VOFC_XLS', 'CISA_GUIDE', 'NIST', 'OTHER', 'LIBRARY_RAG']);

const FORBIDDEN_VERBS = [
  'install',
  'issue',
  'implement',
  'deploy',
  'procure',
  'purchase',
  'must',
  'require',
  'mandate',
  'enforce',
];

const BLOCKLIST_KEYWORDS = [
  'badge',
  'badging',
  'photo id',
  'keycard',
  'access level',
  'access control',
  'cctv',
  'camera',
  'video surveillance',
  'intrusion detection',
  'ids',
  'cybersecurity plan',
  'us-cert',
  'ics-cert',
  'training',
  'forums',
  'nist 800',
];

/** Lowercase, trim, collapse whitespace. */
export function normalize(s: string): string {
  if (!s || typeof s !== 'string') return '';
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .trim();
}

function hasWholeWord(hay: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(hay);
}

function containsForbiddenVerb(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  for (const v of FORBIDDEN_VERBS) {
    if (hasWholeWord(text, v)) return v;
  }
  return null;
}

/** Check if text contains any forbidden verb (whole-word). */
export function hasForbiddenVerb(text: string): boolean {
  return containsForbiddenVerb(text) !== null;
}

function containsBlocklistKeyword(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  for (const kw of BLOCKLIST_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

/** Check if text contains any blocklist keyword. */
export function hasBlockedKeyword(text: string): boolean {
  return containsBlocklistKeyword(text) !== null;
}

export interface DependencyVofcRowInput {
  condition_code?: string;
  infrastructure?: string;
  vulnerability?: string;
  vulnerability_text?: string;
  ofc_1?: string;
  ofc_2?: string;
  ofc_3?: string;
  ofc_4?: string;
  source_type?: string;
  source_reference?: string;
  approved?: boolean;
  version?: string;
}

export interface ValidateResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validate a dependency row. Rejects blocklist keywords, forbidden verbs,
 * and missing/invalid required fields.
 */
export function validateDependencyRow(row: DependencyVofcRowInput): ValidateResult {
  const errors: string[] = [];

  const vulnText = (row.vulnerability ?? row.vulnerability_text ?? '').trim();
  if (!vulnText) {
    errors.push('missing vulnerability (or vulnerability_text)');
  }

  if (!row.condition_code?.trim()) {
    errors.push('missing condition_code');
  }

  const infra = (row.infrastructure ?? '').trim();
  if (!VALID_INFRA.has(infra)) {
    errors.push(`invalid infrastructure: ${infra || '(empty)'}. Must be one of: ENERGY, COMMUNICATIONS, INFORMATION_TRANSPORT, WATER, WASTEWATER`);
  }

  const sourceType = (row.source_type ?? '').trim();
  if (!VALID_SOURCE_TYPE.has(sourceType)) {
    errors.push(`invalid source_type: ${sourceType || '(empty)'}. Must be one of: VOFC_XLS, CISA_GUIDE, NIST, OTHER`);
  }

  if (!row.source_reference?.trim()) {
    errors.push('missing source_reference');
  }

  if (typeof row.approved !== 'boolean') {
    errors.push('approved must be boolean');
  }

  const version = (row.version ?? '').trim();
  if (!version) {
    errors.push('missing version (default dep_v1 allowed)');
  }

  // Blocklist in vulnerability
  if (vulnText) {
    const blocked = containsBlocklistKeyword(vulnText);
    if (blocked) {
      errors.push(`blocked keyword in vulnerability: ${blocked}`);
    }
  }

  // Blocklist and forbidden verbs in OFCs
  for (const k of ['ofc_1', 'ofc_2', 'ofc_3', 'ofc_4']) {
    const val = (row as Record<string, unknown>)[k];
    if (!val || typeof val !== 'string') continue;
    const t = (val as string).trim();
    if (!t) continue;

    const blocked = containsBlocklistKeyword(t);
    if (blocked) {
      errors.push(`blocked keyword in ${k}: ${blocked}`);
    }
    const fv = containsForbiddenVerb(t);
    if (fv) {
      errors.push(`forbidden verb in ${k}: ${fv}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
