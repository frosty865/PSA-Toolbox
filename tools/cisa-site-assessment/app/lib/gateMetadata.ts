/**
 * Gate Metadata Helper
 * 
 * Provides gate mapping from Baseline v2 migration table.
 * Used to enrich required_elements with gate information.
 */

import fs from 'fs';
import path from 'path';

const GATE_ORDER = ['CONTROL_EXISTS', 'CONTROL_OPERABLE', 'CONTROL_RESILIENCE'] as const;
export type GateType = typeof GATE_ORDER[number];

interface MigrationEntry {
  legacy_question_id: string;
  mapped_gate: GateType | null;
  action: 'REWRITE' | 'RETIRE';
  replacement_id: string | null;
}

let migrationLookup: Map<string, MigrationEntry> | null = null;

/**
 * Load migration table and create lookup map
 */
function loadMigrationTable(): Map<string, MigrationEntry> {
  if (migrationLookup) {
    return migrationLookup;
  }

  try {
    const migrationPath = path.join(process.cwd(), 'analytics', 'reports', 'baseline_migration_table.json');
    const migrationData = JSON.parse(fs.readFileSync(migrationPath, 'utf-8'));
    
    migrationLookup = new Map();
    for (const entry of migrationData.migration_table || []) {
      if (entry.legacy_question_id) {
        migrationLookup.set(entry.legacy_question_id, {
          legacy_question_id: entry.legacy_question_id,
          mapped_gate: entry.mapped_gate || null,
          action: entry.action,
          replacement_id: entry.replacement_id || null,
        });
      }
    }
  } catch (error) {
    console.error('[GateMetadata] Error loading migration table:', error);
    migrationLookup = new Map();
  }

  return migrationLookup;
}

/**
 * Get gate for a question by canon_id
 * 
 * NOTE: Migration table uses legacy BASE-### IDs. For new canon_id format (PER-1, ACS-1, etc.),
 * we try the migration table first, then fall back to deriving from canon_id pattern if needed.
 */
export function getGateForQuestion(canonId: string): GateType | null {
  const lookup = loadMigrationTable();
  // Try direct lookup (works for legacy BASE-### IDs)
  const entry = lookup.get(canonId);
  if (entry?.mapped_gate) {
    return entry.mapped_gate as GateType;
  }
  
  // For new canon_id format, migration table may not have entries yet
  // TODO: Update migration table to include canon_id mappings, or derive gate from spine structure
  // For now, return null if not found in migration table
  return null;
}

/**
 * Check if question is retired
 */
export function isRetiredQuestion(canonId: string): boolean {
  const lookup = loadMigrationTable();
  const entry = lookup.get(canonId);
  return entry?.action === 'RETIRE';
}

/**
 * Get gate order index (for sorting)
 */
export function getGateOrderIndex(gate: GateType | null): number {
  if (!gate) return 999;
  return GATE_ORDER.indexOf(gate);
}

/**
 * Enrich baseline spine with gate metadata
 */
export function enrichElementWithGate(element: Record<string, unknown>): Record<string, unknown> {
  const canonId = (element.canon_id ?? element.element_code) as string;
  const gate = getGateForQuestion(canonId);
  return {
    ...element,
    mapped_gate: gate,
    is_retired: isRetiredQuestion(canonId),
  };
}

/**
 * Group elements by subtype and gate
 */
export function groupElementsBySubtypeAndGate(elements: Record<string, unknown>[]): Map<string, Map<GateType | null, Record<string, unknown>[]>> {
  const grouped = new Map<string, Map<GateType | null, Record<string, unknown>[]>>();
  
  for (const element of elements) {
    const subtypeId = (element.discipline_subtype_id as string) || 'unknown';
    const canonId = (element.canon_id ?? element.element_code) as string;
    const gate = getGateForQuestion(canonId);
    
    if (!grouped.has(subtypeId)) {
      grouped.set(subtypeId, new Map());
    }
    
    const subtypeMap = grouped.get(subtypeId)!;
    if (!subtypeMap.has(gate)) {
      subtypeMap.set(gate, []);
    }
    
    subtypeMap.get(gate)!.push(element);
  }
  
  return grouped;
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
    const canonId = (element.canon_id ?? element.element_code) as string;
    const gate = getGateForQuestion(canonId);
    if (gate) {
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

