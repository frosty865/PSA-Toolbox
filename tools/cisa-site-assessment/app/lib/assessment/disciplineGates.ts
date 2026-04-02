/**
 * Discipline Gate Configuration
 * 
 * Defines the single gate question for each discipline that must be answered YES
 * before any other questions in that discipline can be shown.
 * 
 * Universal rule: Each discipline has exactly ONE gate question (depth=1, subtype_code=null).
 */

export interface GateDef {
  discipline_code: string;
  gate_canon_id: string;
  gate_label: string; // Optional UI label, not used for scoring
}

/**
 * Explicit mapping of discipline codes to their gate questions.
 * 
 * Gate questions are depth=1, discipline-level (subtype_code == null) baseline spines.
 * These MUST exist in baseline_spines_runtime; missing gates will cause dev-only hard fails.
 */
export const DISCIPLINE_GATES: Record<string, GateDef> = {
  "ACS": {
    discipline_code: "ACS",
    gate_canon_id: "BASE-ACS-001",
    gate_label: "Access control applicability",
  },
  "COM": {
    discipline_code: "COM",
    gate_canon_id: "BASE-COM-001",
    gate_label: "Communications applicability",
  },
  "CPTED": {
    discipline_code: "CPTED",
    gate_canon_id: "BASE-CPTED-001",
    gate_label: "CPTED applicability",
  },
  "EAP": {
    discipline_code: "EAP",
    gate_canon_id: "BASE-EAP-001",
    gate_label: "Emergency action planning applicability",
  },
  "EMR": {
    discipline_code: "EMR",
    gate_canon_id: "BASE-EMR-001",
    gate_label: "Emergency management applicability",
  },
  "FAC": {
    discipline_code: "FAC",
    gate_canon_id: "BASE-FAC-001",
    gate_label: "Facility hardening applicability",
  },
  "IDS": {
    discipline_code: "IDS",
    gate_canon_id: "BASE-IDS-001",
    gate_label: "Intrusion detection applicability",
  },
  "INT": {
    discipline_code: "INT",
    gate_canon_id: "INT-001",
    gate_label: "Interior security applicability",
  },
  "ISC": {
    discipline_code: "ISC",
    gate_canon_id: "BASE-ISC-001",
    gate_label: "Information sharing applicability",
  },
  "KEY": {
    discipline_code: "KEY",
    gate_canon_id: "BASE-KEY-001",
    gate_label: "Key control applicability",
  },
  "PER": {
    discipline_code: "PER",
    gate_canon_id: "BASE-PER-001",
    gate_label: "Perimeter security applicability",
  },
  "SFO": {
    discipline_code: "SFO",
    gate_canon_id: "BASE-SFO-001",
    gate_label: "Security force applicability",
  },
  "SMG": {
    discipline_code: "SMG",
    gate_canon_id: "BASE-SMG-001",
    gate_label: "Security management applicability",
  },
  "VSS": {
    discipline_code: "VSS",
    gate_canon_id: "BASE-VSS-001",
    gate_label: "Video surveillance applicability",
  },
};

/**
 * Get the gate definition for a discipline.
 * 
 * @param disciplineCode - The discipline code (e.g., "ACS", "EAP")
 * @returns GateDef if discipline has a gate, null otherwise
 */
export function getDisciplineGate(disciplineCode: string | null | undefined): GateDef | null {
  if (!disciplineCode) {
    return null;
  }
  return DISCIPLINE_GATES[disciplineCode.toUpperCase()] || null;
}

/**
 * Check if the discipline gate is satisfied (answered YES).
 * 
 * Rules:
 * - Gate is satisfied if and only if the gate question has response "YES"
 * - NO, N_A, N/A, or unanswered all count as NOT satisfied
 * 
 * @param disciplineCode - The discipline code
 * @param responsesByCanonId - Map of canon_id to response value
 * @returns true if gate is satisfied (YES), false otherwise
 */
export function isGateSatisfied(
  disciplineCode: string | null | undefined,
  responsesByCanonId: Map<string, "YES" | "NO" | "N/A" | "N_A"> | ReadonlyMap<string, "YES" | "NO" | "N/A" | "N_A">
): boolean {
  const gate = getDisciplineGate(disciplineCode);
  if (!gate) {
    // No gate defined = always satisfied (backward compatibility)
    return true;
  }

  const response = responsesByCanonId.get(gate.gate_canon_id);
  // Normalize N/A to N_A for comparison
  const normalizedResponse = response === 'N/A' || response === 'N_A' ? 'N_A' : response;
  
  // Gate is satisfied only if response is exactly "YES"
  return normalizedResponse === 'YES';
}
