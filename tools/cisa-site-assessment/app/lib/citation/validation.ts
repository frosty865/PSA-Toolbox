/**
 * Citation Validation
 * 
 * Validates citations against source registry and enforces citation requirements.
 */

import * as fs from 'fs';
import * as path from 'path';

const SOURCE_POLICY_FILE = path.join(process.cwd(), 'model', 'policy', 'source_policy.v1.json');

export interface Citation {
  source_key: string; // Required: must exist in source_registry
  locator_type: 'page' | 'section' | 'paragraph' | 'url_fragment';
  locator: string; // e.g., "p.12", "Section 3.2", "para-4", "#heading-id"
  excerpt: string; // short supporting excerpt
  retrieved_at?: string; // ISO date string, optional
}

export interface SourcePolicy {
  version: string;
  generated_at: string;
  tiers: {
    [key: string]: string[];
  };
  tier_descriptions?: {
    [key: string]: string;
  };
  disallowed_publishers: string[];
  disallowed_scope_terms: string[];
  scope_tags_allowed?: string[];
  notes?: string;
}

let cachedPolicy: SourcePolicy | null = null;

/**
 * Load source policy from file
 */
function loadSourcePolicy(): SourcePolicy {
  if (cachedPolicy) {
    return cachedPolicy;
  }

  if (!fs.existsSync(SOURCE_POLICY_FILE)) {
    throw new Error(`Source policy file not found: ${SOURCE_POLICY_FILE}`);
  }

  const content = fs.readFileSync(SOURCE_POLICY_FILE, 'utf-8');
  cachedPolicy = JSON.parse(content) as SourcePolicy;
  return cachedPolicy;
}

/**
 * Validate citation structure
 */
export function validateCitation(citation: unknown): { valid: boolean; error?: string } {
  if (!citation || typeof citation !== 'object' || Array.isArray(citation)) {
    return { valid: false, error: 'Citation must be an object' };
  }

  const c = citation as Record<string, unknown>;
  // Required fields
  if (!c.source_key || typeof c.source_key !== 'string') {
    return { valid: false, error: 'Citation must have source_key (string)' };
  }

  if (!c.locator_type || typeof c.locator_type !== 'string') {
    return { valid: false, error: 'Citation must have locator_type (string)' };
  }

  if (!['page', 'section', 'paragraph', 'url_fragment'].includes(c.locator_type as string)) {
    return { valid: false, error: 'locator_type must be one of: page, section, paragraph, url_fragment' };
  }

  if (!c.locator || typeof c.locator !== 'string') {
    return { valid: false, error: 'Citation must have locator (string)' };
  }

  if (!c.excerpt || typeof c.excerpt !== 'string') {
    return { valid: false, error: 'Citation must have excerpt (string)' };
  }

  // Optional retrieved_at validation
  if (c.retrieved_at && typeof c.retrieved_at !== 'string') {
    return { valid: false, error: 'retrieved_at must be a string (ISO date)' };
  }

  return { valid: true };
}

/**
 * Validate that source_key exists in source_registry (requires DB check)
 * This is a type guard - actual DB validation happens in API routes
 */
export function validateSourceKeyExists(sourceKey: string, sourceRegistry: Array<{ source_key: string }>): boolean {
  return sourceRegistry.some(s => s.source_key === sourceKey);
}

/**
 * Validate citations array
 */
export function validateCitations(citations: unknown[]): { valid: boolean; error?: string } {
  if (!Array.isArray(citations)) {
    return { valid: false, error: 'Citations must be an array' };
  }

  if (citations.length === 0) {
    return { valid: false, error: 'OFC must have at least one citation' };
  }

  for (let i = 0; i < citations.length; i++) {
    const result = validateCitation(citations[i]);
    if (!result.valid) {
      return { valid: false, error: `Citation ${i + 1}: ${result.error}` };
    }
  }

  return { valid: true };
}

/**
 * Check if publisher is disallowed
 */
export function isPublisherDisallowed(publisher: string): boolean {
  const policy = loadSourcePolicy();
  return policy.disallowed_publishers.some(
    disallowed => publisher.toUpperCase().includes(disallowed.toUpperCase())
  );
}

/**
 * Check if scope tags contain disallowed terms
 */
export function hasDisallowedScopeTerms(scopeTags: string[]): string[] {
  const policy = loadSourcePolicy();
  const disallowed: string[] = [];

  for (const tag of scopeTags) {
    if (policy.disallowed_scope_terms.some(
      term => tag.toLowerCase().includes(term.toLowerCase())
    )) {
      disallowed.push(tag);
    }
  }

  return disallowed;
}

/**
 * Get tier for publisher
 */
export function getPublisherTier(publisher: string): number | null {
  const policy = loadSourcePolicy();
  
  const publisherUpper = publisher.toUpperCase();
  
  // Check for National Laboratories (tier 1)
  // Match "National Laboratory" or "National Laboratories" in publisher name
  if (publisherUpper.includes('NATIONAL LABORATOR') || publisherUpper.includes('NATIONAL LAB')) {
    return 1;
  }
  
  // Check exact matches in tier lists
  for (const [tierStr, publishers] of Object.entries(policy.tiers)) {
    if (publishers.some(p => publisherUpper === p.toUpperCase())) {
      return parseInt(tierStr, 10);
    }
  }
  
  return null;
}
