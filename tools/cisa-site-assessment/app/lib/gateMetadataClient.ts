/**
 * Gate Metadata Helper (Client-Side)
 * 
 * Client-side version for use in React components.
 * Loads gate mapping from API or local data.
 */

export type GateType = 'CONTROL_EXISTS' | 'CONTROL_OPERABLE' | 'CONTROL_RESILIENCE';

const GATE_ORDER: GateType[] = ['CONTROL_EXISTS', 'CONTROL_OPERABLE', 'CONTROL_RESILIENCE'];

let migrationLookup: Map<string, { mapped_gate: GateType | null; action: string }> | null = null;

/**
 * Load migration table (client-side)
 * This will be called once and cached
 */
async function loadMigrationTable(): Promise<Map<string, { mapped_gate: GateType | null; action: string }>> {
  if (migrationLookup) {
    return migrationLookup;
  }

  try {
    // Try to load from API or local file
    const response = await fetch('/api/gate-metadata');
    if (response.ok) {
      const data = await response.json();
      migrationLookup = new Map();
      for (const entry of data.migration_table || []) {
        if (entry.legacy_question_id) {
          migrationLookup.set(entry.legacy_question_id, {
            mapped_gate: entry.mapped_gate || null,
            action: entry.action,
          });
        }
      }
      return migrationLookup;
    }
  } catch {
    console.warn('[GateMetadataClient] Could not load from API, using empty lookup');
  }

  migrationLookup = new Map();
  return migrationLookup;
}

/**
 * Get gate for a question by canon_id
 */
export async function getGateForQuestion(canonId: string): Promise<GateType | null> {
  const lookup = await loadMigrationTable();
  const entry = lookup.get(canonId);
  return entry?.mapped_gate || null;
}

/**
 * Evaluate gate results for a subtype (for conditional rendering)
 */
export function evaluateGatesForSubtype(
  subtypeElements: Record<string, unknown>[],
  responses: Map<string, 'YES' | 'NO' | 'N_A' | 'N/A'>
): Record<GateType, 'YES' | 'NO' | 'N_A' | null> {
  const gateResults: Record<GateType, 'YES' | 'NO' | 'N_A' | null> = {
    CONTROL_EXISTS: null,
    CONTROL_OPERABLE: null,
    CONTROL_RESILIENCE: null,
  };

  // Group elements by gate
  const elementsByGate = new Map<GateType, Record<string, unknown>[]>();
  for (const element of subtypeElements) {
    const gate = element.mapped_gate as GateType | undefined;
    if (gate && GATE_ORDER.includes(gate)) {
      if (!elementsByGate.has(gate)) {
        elementsByGate.set(gate, []);
      }
      elementsByGate.get(gate)!.push(element);
    }
  }

  // Evaluate gates in order
  for (const gate of GATE_ORDER) {
    const gateElements = elementsByGate.get(gate);
    if (!gateElements || gateElements.length === 0) {
      continue;
    }

    // Check if previous gate failed (skip if so)
    if (gate === 'CONTROL_OPERABLE') {
      if (gateResults.CONTROL_EXISTS === 'NO') {
        gateResults[gate] = null; // Skipped
        continue;
      }
    } else if (gate === 'CONTROL_RESILIENCE') {
      if (gateResults.CONTROL_EXISTS === 'NO' || gateResults.CONTROL_OPERABLE === 'NO') {
        gateResults[gate] = null; // Skipped
        continue;
      }
    }

    // Get response for this gate's question (assuming one question per gate per subtype)
    const gateElement = gateElements[0];
    const canonIdRaw = gateElement.canon_id || gateElement.element_code || gateElement.element_id; // Support both during migration
    if (typeof canonIdRaw !== 'string') continue;
    const canonId = canonIdRaw;
    const response = responses.get(canonId);
    
    if (response === 'N_A' || response === 'N/A') {
      gateResults[gate] = 'N_A';
    } else if (response === 'NO') {
      gateResults[gate] = 'NO';
    } else if (response === 'YES') {
      gateResults[gate] = 'YES';
    }
  }

  return gateResults;
}

/**
 * Get gate order index (for sorting)
 */
export function getGateOrderIndex(gate: GateType | null): number {
  if (!gate) return 999;
  return GATE_ORDER.indexOf(gate);
}

