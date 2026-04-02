/**
 * Capability Selector Configuration
 * 
 * Defines which disciplines use the capability selector model instead of
 * showing individual subtype spine questions.
 */

/**
 * Technology disciplines that use capability selector (checkbox list) instead of
 * individual subtype spine questions.
 * These disciplines show the selector regardless of prerequisite answers.
 */
export const TECH_SELECTOR_DISCIPLINES = new Set<string>([
  'ACS',  // Access Control Systems
  'VSS',  // Video Surveillance Systems
  'IDS',  // Intrusion Detection Systems
  'COM',  // Communications
]);

/**
 * Legacy alias for backward compatibility
 */
export const CAPABILITY_SELECTOR_DISCIPLINES = TECH_SELECTOR_DISCIPLINES;

/**
 * Prerequisite gate configuration for non-technology disciplines.
 * 
 * Defines which core baseline questions must be answered YES before
 * subtype capability spines can be shown.
 */
export interface PrerequisiteGate {
  mode: 'ALL' | 'ANY';
  canon_ids: string[];
}

export const PREREQUISITE_GATES: Record<string, PrerequisiteGate> = {
  'EAP': {
    mode: 'ALL',
    canon_ids: ['BASE-EAP-001'],
  },
  'EMR': {
    mode: 'ALL',
    canon_ids: ['BASE-EMR-001'],
  },
  'SMG': {
    mode: 'ALL',
    canon_ids: ['BASE-SMG-001'],
  },
  'SFO': {
    mode: 'ALL',
    canon_ids: ['BASE-SFO-001'],
  },
  'PER': {
    mode: 'ANY',
    canon_ids: ['BASE-PER-001', 'BASE-PER-002'],
  },
  'VSS': {
    mode: 'ANY',
    canon_ids: ['BASE-VSS-001', 'BASE-VSS-002'],
  },
  'IDS': {
    mode: 'ALL',
    canon_ids: ['BASE-IDS-001'],
  },
};

/**
 * Check if a discipline uses the technology capability selector model
 * (shows selector regardless of prerequisites)
 */
export function isTechSelectorDiscipline(disciplineCode: string | null | undefined): boolean {
  if (!disciplineCode) {
    return false;
  }
  return TECH_SELECTOR_DISCIPLINES.has(disciplineCode.toUpperCase());
}

/**
 * Legacy alias for backward compatibility
 */
export function isCapabilitySelectorDiscipline(disciplineCode: string | null | undefined): boolean {
  return isTechSelectorDiscipline(disciplineCode);
}

/**
 * Check if prerequisite gates are satisfied for a discipline.
 * 
 * Rules:
 * - If discipline has no prerequisite gate -> return null (indicates no gate exists)
 * - For mode "ALL": every gate canon_id must have response "YES"
 * - For mode "ANY": at least one gate canon_id must have response "YES"
 * - Any missing response counts as NOT satisfied (return false)
 * 
 * Returns:
 * - null: No prerequisite gate exists for this discipline
 * - true: Prerequisite gate exists and is satisfied
 * - false: Prerequisite gate exists but is not satisfied
 */
export function isPrerequisiteSatisfied(
  disciplineCode: string | null | undefined,
  responsesByCanonId: Map<string, "YES" | "NO" | "N/A" | "N_A"> | ReadonlyMap<string, "YES" | "NO" | "N/A" | "N_A">
): boolean | null {
  if (!disciplineCode) {
    return null; // No discipline code = no gate
  }

  const gate = PREREQUISITE_GATES[disciplineCode.toUpperCase()];
  if (!gate) {
    return null; // No gate defined = no prerequisite
  }

  // Check responses for gate canon_ids
  const responses = gate.canon_ids.map(canonId => {
    const response = responsesByCanonId.get(canonId);
    // Normalize N/A to N_A for comparison
    if (response === 'N/A' || response === 'N_A') {
      return 'N_A';
    }
    return response;
  });

  if (gate.mode === 'ALL') {
    // All must be YES
    return responses.every(r => r === 'YES');
  } else if (gate.mode === 'ANY') {
    // At least one must be YES
    return responses.some(r => r === 'YES');
  }

  return false; // Unknown mode
}
