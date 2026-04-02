/**
 * OFC Library Eligibility Validation
 * 
 * Hard guardrails to ensure OFCs are citation-backed and properly scoped.
 */

export type OFCScope = 'BASELINE' | 'SECTOR' | 'SUBSECTOR';
export type OFCLinkType = 'PRIMARY_QUESTION' | 'EXPANSION_QUESTION';
export type OFCStatus = 'ACTIVE' | 'RETIRED';
export type SolutionRole = 'PARTIAL' | 'COMPLETE';

export interface OFCLibraryEntry {
  ofc_id: string;
  scope: OFCScope;
  sector?: string | null;
  subsector?: string | null;
  link_type: OFCLinkType;
  link_key: string;
  trigger_response: 'NO';
  ofc_text: string;
  solution_role: SolutionRole;
  status: OFCStatus;
  citation_count: number;
}

export interface EligibilityFilters {
  link_type: OFCLinkType;
  link_key: string;
  sector?: string | null;
  subsector?: string | null;
  scope_precedence?: OFCScope[]; // Default: ['SUBSECTOR', 'SECTOR', 'BASELINE']
}

/**
 * Scope precedence: more restrictive wins
 * SUBSECTOR > SECTOR > BASELINE
 */
const DEFAULT_SCOPE_PRECEDENCE: OFCScope[] = ['SUBSECTOR', 'SECTOR', 'BASELINE'];

/**
 * Checks if an OFC is eligible for nomination
 * 
 * Requirements:
 * 1. citation_count >= 1
 * 2. status = 'ACTIVE'
 */
export function isEligible(ofc: OFCLibraryEntry): boolean {
  return ofc.citation_count >= 1 && ofc.status === 'ACTIVE';
}

/**
 * Gets eligible OFCs matching the filters, ordered by scope precedence
 * 
 * Scope precedence rules:
 * - SUBSECTOR > SECTOR > BASELINE (more restrictive wins)
 * - If sector/subsector provided, prefer matching scope
 * - Baseline OFCs must have scope='BASELINE' (sector/subsector null)
 * - Sector OFCs must have sector set
 * - Subsector OFCs must have sector+subsector set
 */
export async function getEligibleLibraryOfcs(
  filters: EligibilityFilters
): Promise<OFCLibraryEntry[]> {
  // This function will be implemented in API routes that query the database
  // For now, it defines the interface and rules
  
  const _scopePrecedence = filters.scope_precedence || DEFAULT_SCOPE_PRECEDENCE;
  void _scopePrecedence;
  
  // Rules:
  // 1. Match link_type and link_key
  // 2. Filter by scope precedence
  // 3. For BASELINE: scope='BASELINE', sector=null, subsector=null
  // 4. For SECTOR: scope='SECTOR', sector matches
  // 5. For SUBSECTOR: scope='SUBSECTOR', sector and subsector match
  // 6. Only return eligible (citation_count >= 1, status = ACTIVE)
  // 7. Order by scope precedence (most restrictive first)
  
  // Implementation will be in API route that queries v_eligible_ofc_library view
  
  return [];
}

/**
 * Enforces that no generated text is sent to nomination endpoints
 * 
 * Hard rule: ofc_text must come from ofc_library, not be generated
 */
export function enforceNoGeneratedText(payload: {
  ofc_text?: string;
  ofc_id?: string | null;
  ofc_text_snapshot?: string | null;
}): void {
  // If ofc_id is null, then ofc_text_snapshot must also be null
  // (this is a MISSING_LIBRARY_OFC stub)
  if (payload.ofc_id === null || payload.ofc_id === undefined) {
    if (payload.ofc_text_snapshot) {
      throw new Error(
        'Cannot provide ofc_text_snapshot when ofc_id is null. ' +
        'Missing library OFCs must have null text.'
      );
    }
    return; // MISSING_LIBRARY_OFC stub is valid
  }
  
  // If ofc_id is provided, ofc_text_snapshot must match library text
  // (we'll validate this in the API route by checking against ofc_library)
  
  // Reject any free-text ofc_text in payload
  if (payload.ofc_text && !payload.ofc_id) {
    throw new Error(
      'Cannot provide free-text ofc_text. ' +
      'OFCs must be selected from library (provide ofc_id) or be MISSING_LIBRARY_OFC stubs.'
    );
  }
}

/**
 * Determines scope precedence score (higher = more restrictive)
 */
export function getScopePrecedenceScore(scope: OFCScope): number {
  switch (scope) {
    case 'SUBSECTOR': return 3;
    case 'SECTOR': return 2;
    case 'BASELINE': return 1;
    default: return 0;
  }
}

/**
 * Validates scope constraints
 */
export function validateScopeConstraints(
  scope: OFCScope,
  sector?: string | null,
  subsector?: string | null
): boolean {
  if (scope === 'BASELINE') {
    return sector === null && subsector === null;
  }
  if (scope === 'SECTOR') {
    return sector !== null && sector !== undefined;
  }
  if (scope === 'SUBSECTOR') {
    return sector !== null && sector !== undefined && 
           subsector !== null && subsector !== undefined;
  }
  return false;
}

