/**
 * Shared guards for dependency VOFC: forbidden verbs, blocked keywords, validation.
 * Prevents scope creep (baseline/CCTV/cyber governance) and prescriptive language.
 */

export const FORBIDDEN_VERBS = [
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

export const BLOCKED_KEYWORDS = [
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

const FORBIDDEN_PATTERN = new RegExp(
  `\\b(${FORBIDDEN_VERBS.join('|')})\\b`,
  'gi'
);

/** Lowercase, trim, collapse whitespace, remove punctuation runs. */
export function normalizeKey(s: string): string {
  if (!s || typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

export function hasForbiddenVerb(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return FORBIDDEN_PATTERN.test(text);
}

export function hasBlockedKeyword(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return BLOCKED_KEYWORDS.some((kw) => lower.includes(kw));
}

export interface DependencyVofcRowInput {
  condition_code?: string;
  infrastructure?: string;
  vulnerability_text?: string;
  ofc_1?: string;
  ofc_2?: string;
  ofc_3?: string;
  ofc_4?: string;
}

export function validateDependencyRow(row: DependencyVofcRowInput): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!row.condition_code?.trim()) {
    errors.push('condition_code is required');
  }
  if (!row.vulnerability_text?.trim()) {
    errors.push('vulnerability_text is required');
  }
  const ofcs = [row.ofc_1, row.ofc_2, row.ofc_3, row.ofc_4].filter((o): o is string => typeof o === 'string' && o.trim().length > 0);
  for (const ofc of ofcs) {
    if (hasForbiddenVerb(ofc)) {
      errors.push(`OFC contains forbidden verb: ${ofc.slice(0, 50)}...`);
    }
  }
  if (row.vulnerability_text && hasBlockedKeyword(row.vulnerability_text)) {
    errors.push('vulnerability_text contains blocked keyword');
  }
  for (const ofc of ofcs) {
    if (hasBlockedKeyword(ofc)) {
      errors.push('OFC contains blocked keyword');
      break;
    }
  }
  return {
    ok: errors.length === 0,
    errors,
  };
}
