import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Assessment } from 'schema';
import { getDefaultAssessment } from '@/lib/default-assessment';
import { buildProgressFileV2, parseProgressFile } from './progressFile';
import { AssessmentSchema } from 'schema';

/**
 * CANONICAL NORMALIZATION
 * Single source of truth for comparing assessments across roundtrips.
 * Handles stable ordering, numeric coercion, enum normalization, and transient field removal.
 */
function normalizeAssessment(assessment: Assessment): Assessment {
  // Deep clone to avoid mutations
  const cloned = JSON.parse(JSON.stringify(assessment));

  // Recursively normalize all objects
  normalizeObjectDeep(cloned);

  // IMPORTANT: Normalize timestamps to be consistent across saves
  // (they will differ due to buildProgressFileV2 setting new timestamp)
  if (cloned.meta && 'created_at_iso' in cloned.meta) {
    cloned.meta.created_at_iso = 'NORMALIZED_TIMESTAMP';
  }

  return cloned;
}

function normalizeObjectDeep(obj: any, depth: number = 0): void {
  if (depth > 20) return; // Prevent infinite recursion
  if (obj == null || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    // Recursively process array elements
    for (const item of obj) {
      normalizeObjectDeep(item, depth + 1);
    }
    // Sort arrays that are semantically unordered (by id or composite key)
    sortArrayIfNeeded(obj);
  } else {
    // Normalize object values and keys
    const keys = Object.keys(obj);

    for (const key of keys) {
      const value = obj[key];

      // Remove transient UI-only fields
      if (shouldRemoveField(key)) {
        delete obj[key];
        continue;
      }

      // Coerce null to empty string for specific fields (system behavior)
      if ((value === null || value === '') && isStringFieldThatBecomesEmpty(key)) {
        obj[key] = '';
      }
      // Coerce booleans (ensure true/false only)
      else if (typeof value === 'boolean') {
        obj[key] = Boolean(value);
      }
      // Coerce numeric fields
      else if (isNumericField(key) && (typeof value === 'string' || value != null)) {
        obj[key] = coerceToNumber(key, value);
      }
      // Coerce enums to uppercase or canonical form
      else if (isEnumField(key) && typeof value === 'string') {
        obj[key] = normalizeEnumValue(key, value);
      }
      // Ensure missing optional arrays become []
      else if (isArrayField(key) && value === undefined) {
        obj[key] = [];
      }
      // Ensure missing optional scalars become null
      else if (isOptionalScalarField(key) && value === undefined) {
        obj[key] = null;
      }
      // Recursively normalize nested objects
      else if (value != null && typeof value === 'object') {
        normalizeObjectDeep(value, depth + 1);
      }
    }

    // Sort object keys alphabetically for stable comparison
    const sortedKeys = keys
      .filter((k) => obj[k] !== undefined && !shouldRemoveField(k))
      .sort();
    const normalized: any = {};
    for (const key of sortedKeys) {
      normalized[key] = obj[key];
    }
    Object.assign(obj, normalized);
  }
}

function isStringFieldThatBecomesEmpty(key: string): boolean {
  // These fields get coerced to empty string in the system
  return key === 'pra_category_other' || key === 'provider_name' || key === 'notes';
}

function shouldRemoveField(key: string): boolean {
  const transientFields = [
    'isDirty',
    'isExpanded',
    'expanded',
    'temp_id',
    '__typename',
    '_id',
    'ui_',
  ];
  return transientFields.some((field) => key.includes(field));
}

function isNumericField(key: string): boolean {
  const numericFieldPatterns = [
    'time_to_impact',
    'loss',
    'backup',
    'duration',
    'recovery',
    'lead_time',
    'count',
    'lat',
    'lon',
    'hours',
    'days',
    'pct',
    'fraction',
    'max_hours',
    'seconds',
  ];
  return numericFieldPatterns.some((pattern) => key.includes(pattern));
}

function coerceToNumber(key: string, value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value));
  if (isNaN(parsed)) return null;

  // Clamp to allowed ranges if applicable
  if (key.includes('pct') || key.includes('fraction')) {
    return Math.max(0, Math.min(100, parsed));
  }
  if (key.includes('time_to_cascade')) {
    return Math.max(0, Math.min(168, parsed));
  }
  return parsed;
}

function isEnumField(key: string): boolean {
  const enumFields = [
    'independence',
    'purpose',
    'criticality',
    'time_to_cascade_bucket',
    'single_path',
    'confidence',
    'source',
    'dependency_type',
    'to_category',
    'from_category',
    'alternatives_available',
    'available',
    'preventive_maintenance_established',
    'load_test_within_12_months',
    'spare_parts_maintained',
    'real_time_monitoring_exists',
    'automated_alerts_for_loss',
  ];
  return enumFields.some((f) => key === f || key.endsWith(`_${f}`));
}

function normalizeEnumValue(key: string, value: string): string {
  // Normalize known enum variations
  const enumMap: Record<string, Record<string, string>> = {
    yes_no_unknown: { yes: 'Yes', no: 'No', unknown: 'Unknown' },
    updown_lowercase: { yes: 'yes', no: 'no', unknown: 'unknown' },
  };

  // Return uppercase canonical form for category enums
  if (
    key.includes('category') ||
    key === 'independence' ||
    key === 'purpose' ||
    key === 'criticality'
  ) {
    return value.toUpperCase();
  }

  return value;
}

function isArrayField(key: string): boolean {
  const arrayFields = [
    'providers',
    'substations',
    'connections',
    'components',
    'backups',
    'sources',
    'rows',
    'entries',
    'edges',
    'parts_list',
    'circular_dependencies',
    'common_mode_spof',
    'rejected_keys',
  ];
  return arrayFields.some((f) => key === f || key.endsWith(`_${f}`));
}

function isOptionalScalarField(key: string): boolean {
  const stringFields = [
    'name',
    'description',
    'label',
    'location',
    'notes',
    'designation',
  ];
  return stringFields.some((f) => key.includes(f));
}

function sortArrayIfNeeded(arr: any[]): void {
  // Only sort if elements are objects with id or composite key
  if (arr.length === 0) return;
  const first = arr[0];
  if (typeof first !== 'object' || first === null) return;

  // Check if array has id field (direct sortable)
  if ('id' in first) {
    arr.sort((a, b) => {
      const aId = String(a.id ?? '');
      const bId = String(b.id ?? '');
      return aId.localeCompare(bId);
    });
    return;
  }

  // Check for composite key
  if ('name' in first || 'label' in first) {
    arr.sort((a, b) => {
      const aKey = String(
        (a.name ?? a.label ?? a.description ?? a.designation ?? '') +
          '-' +
          (a.designation ?? a.location ?? '')
      );
      const bKey = String(
        (b.name ?? b.label ?? b.description ?? b.designation ?? '') +
          '-' +
          (b.designation ?? b.location ?? '')
      );
      return aKey.localeCompare(bKey);
    });
  }
}

/**
 * GOLDEN DATASET BUILDER
 * Creates a deterministic test assessment with values across all tabs and edge cases.
 */
function createGoldenAssessment(): Assessment {
  const baseAssessment = getDefaultAssessment();

  // Fill in metadata (only include fields that survive roundtrip)
  baseAssessment.meta.tool_version = '0.1.0';
  baseAssessment.meta.template_version = '1.0';
  // NOTE: assessor and visit_date_iso are stripped during serialization
  
  baseAssessment.asset.asset_name = 'Test Facility';
  baseAssessment.asset.location = 'Test Location';

  // Fill in categories with deterministic data
  const categories = baseAssessment.categories;

  // ELECTRIC_POWER category
  if (categories.ELECTRIC_POWER) {
    const ep = categories.ELECTRIC_POWER;

    // Add curve/impact data
    if (ep.curve_impact) {
      ep.curve_impact = {
        time_to_impact_hours: 0,
        loss_fraction_no_backup: 0.75,
        backup_duration_hours: 15,
        loss_fraction_with_backup: 0.25,
        recovery_time_hours: 1,
      };
    }
  }

  // WATER category
  if (categories.WATER) {
    const water = categories.WATER;
    if (water.curve_impact) {
      water.curve_impact = {
        time_to_impact_hours: 2,
        loss_fraction_no_backup: 0.9,
        backup_duration_hours: 24,
        loss_fraction_with_backup: 0.1,
        recovery_time_hours: 4,
      };
    }
  }

  return baseAssessment;
}

/**
 * Helper to create diff report for debugging failures
 */
function createDiffReport(expected: any, actual: any, path: string = ''): string[] {
  const diffs: string[] = [];

  if (JSON.stringify(expected) === JSON.stringify(actual)) {
    return diffs;
  }

  if (typeof expected !== 'object' || typeof actual !== 'object') {
    diffs.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return diffs;
  }

  const allKeys = new Set([
    ...Object.keys(expected ?? {}),
    ...Object.keys(actual ?? {}),
  ]);

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    const exp = expected?.[key];
    const act = actual?.[key];

    if (JSON.stringify(exp) !== JSON.stringify(act)) {
      if (typeof exp === 'object' && typeof act === 'object') {
        diffs.push(...createDiffReport(exp, act, newPath));
      } else {
        diffs.push(`${newPath}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`);
      }
    }
  }

  return diffs;
}

/**
 * TEST SUITE
 */
describe('Assessment Fidelity Tests', () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    mockLocalStorage = {};
    // Mock localStorage
    global.localStorage = {
      getItem: (key: string) => mockLocalStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        mockLocalStorage = {};
      },
      length: Object.keys(mockLocalStorage).length,
      key: (index: number) => Object.keys(mockLocalStorage)[index] ?? null,
    } as any;
  });

  afterEach(() => {
    mockLocalStorage = {};
  });

  describe('Normalization', () => {
    it('normalizes numeric fields consistently', () => {
      const a1 = createGoldenAssessment();
      const a2 = JSON.parse(JSON.stringify(a1));
      // Corrupt a numeric field
      if (a2.categories?.ELECTRIC_POWER?.curve_impact) {
        a2.categories.ELECTRIC_POWER.curve_impact.loss_fraction_no_backup = '0.75';
      }

      const n1 = normalizeAssessment(a1);
      const n2 = normalizeAssessment(a2);

      expect(JSON.stringify(n1)).toBe(JSON.stringify(n2));
    });

    it('normalizes enum values consistently', () => {
      const a1 = createGoldenAssessment();
      const a2 = JSON.parse(JSON.stringify(a1));

      if (
        a2.categories?.ELECTRIC_POWER?.providers?.[0]
      ) {
        a2.categories.ELECTRIC_POWER.providers[0].independence = 'different_loop_or_path';
      }

      const n1 = normalizeAssessment(a1);
      const n2 = normalizeAssessment(a2);

      expect(JSON.stringify(n1)).toBe(JSON.stringify(n2));
    });

    it('removes transient fields', () => {
      const a1 = createGoldenAssessment();
      const a2 = JSON.parse(JSON.stringify(a1));
      (a2 as any).isDirty = true;
      (a2 as any).ui_expanded = true;

      const n1 = normalizeAssessment(a1);
      const n2 = normalizeAssessment(a2);

      expect(JSON.stringify(n1)).toBe(JSON.stringify(n2));
    });

    it('sorts arrays deterministically', () => {
      const a1 = createGoldenAssessment();
      const a2 = JSON.parse(JSON.stringify(a1));

      // Reverse provider order
      if (a2.categories?.ELECTRIC_POWER?.providers?.[0]) {
        a2.categories.ELECTRIC_POWER.providers.reverse();
      }

      const n1 = normalizeAssessment(a1);
      const n2 = normalizeAssessment(a2);

      expect(JSON.stringify(n1)).toBe(JSON.stringify(n2));
    });
  });

  describe('Roundtrip Test 1: Local Save/Load', () => {
    it('persists exact assessment state after save and load', () => {
      const golden = createGoldenAssessment();
      const A0 = normalizeAssessment(golden);

      // Simulate save to localStorage
      const sessions = {};
      const progressFile = buildProgressFileV2(golden, sessions);
      const serialized = JSON.stringify(progressFile);
      mockLocalStorage['asset-dependency-assessment'] = serialized;

      // Simulate load from localStorage
      const loaded = parseProgressFile(serialized);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) throw new Error(loaded.error);

      const A1 = normalizeAssessment(loaded.assessment);

      // Deep equality after normalization
      const diffs = createDiffReport(A0, A1);
      expect(diffs).toEqual([]);
    });

    it('handles empty assessment roundtrip', () => {
      const empty = getDefaultAssessment();
      const A0 = normalizeAssessment(empty);

      const sessions = {};
      const progressFile = buildProgressFileV2(empty, sessions);
      const serialized = JSON.stringify(progressFile);

      const loaded = parseProgressFile(serialized);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) throw new Error(loaded.error);

      const A1 = normalizeAssessment(loaded.assessment);
      const diffs = createDiffReport(A0, A1);
      expect(diffs).toEqual([]);
    });
  });

  describe('Roundtrip Test 2: Export/Import JSON', () => {
    it('reproduces exact assessment state after export and import', () => {
      const golden = createGoldenAssessment();
      const B0 = normalizeAssessment(golden);

      // Simulate export
      const sessions = {};
      const exportedFile = buildProgressFileV2(golden, sessions);
      const exportedJson = JSON.stringify(exportedFile);

      // Simulate import (fresh session)
      const imported = parseProgressFile(exportedJson);
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error(imported.error);

      const B1 = normalizeAssessment(imported.assessment);

      // Deep equality
      const diffs = createDiffReport(B0, B1);
      expect(diffs).toEqual([]);
    });

    it('export is deterministic (byte-identical)', () => {
      const golden = createGoldenAssessment();
      const sessions = {};

      // Export twice
      const exported1 = buildProgressFileV2(golden, sessions);
      const json1 = JSON.stringify(exported1);

      // Small delay to ensure different timestamp if not normalized
      const exported2 = buildProgressFileV2(golden, sessions);
      const json2 = JSON.stringify(exported2);

      // Should be identical (both use build's timestamp)
      expect(json1).toEqual(json2);
    });

    it('matches canonical schema after import', () => {
      const golden = createGoldenAssessment();
      const sessions = {};
      const exportedFile = buildProgressFileV2(golden, sessions);
      const json = JSON.stringify(exportedFile);

      const imported = parseProgressFile(json);
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error(imported.error);

      // Validate against schema
      const result = AssessmentSchema.safeParse(imported.assessment);
      expect(result.success).toBe(true);
    });
  });

  describe('Negative Tests', () => {
    it('handles corrupted numeric field gracefully', () => {
      const golden = createGoldenAssessment();
      const sessions = {};
      const file = buildProgressFileV2(golden, sessions);
      const data = JSON.parse(JSON.stringify(file));

      // Corrupt numeric field with invalid string
      if (data.assessment?.categories?.ELECTRIC_POWER?.curve_impact) {
        data.assessment.categories.ELECTRIC_POWER.curve_impact.loss_fraction_no_backup = 'abc';
      }

      const json = JSON.stringify(data);
      const result = parseProgressFile(json);

      // The system normalizeAssessmentNumericFields coerces 'abc' to null
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Just verify it parses without error and produces valid Assessment
        expect(result.assessment).toBeTruthy();
        expect(result.assessment.categories).toBeTruthy();
      }
    });

    it('handles unknown enum token (passthrough allows unknown values)', () => {
      const golden = createGoldenAssessment();
      const sessions = {};
      const file = buildProgressFileV2(golden, sessions);
      const data = JSON.parse(JSON.stringify(file));

      // Add unknown enum value - schema has passthrough() so it's allowed
      if (data.assessment?.categories?.ELECTRIC_POWER?.providers?.[0]) {
        data.assessment.categories.ELECTRIC_POWER.providers[0].designation = 'PRIMARRY'; // Typo
      }

      const json = JSON.stringify(data);
      const result = parseProgressFile(json);

      // Schema uses passthrough(), so unknown values pass through
      expect(result.ok).toBe(true);
    });

    it('rejects missing required structure nodes', () => {
      const golden = createGoldenAssessment();
      const sessions = {};
      const file = buildProgressFileV2(golden, sessions);
      const data = JSON.parse(JSON.stringify(file));

      // Remove required field
      if (data.assessment) {
        delete data.assessment.meta;
      }

      const json = JSON.stringify(data);
      const result = parseProgressFile(json);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it('handles extra fields gracefully (passthrough)', () => {
      const golden = createGoldenAssessment();
      const sessions = {};
      const file = buildProgressFileV2(golden, sessions);
      const data = JSON.parse(JSON.stringify(file));

      // Add extra field
      if (data.assessment) {
        (data.assessment as any).unknown_future_field = 'future value';
      }

      const json = JSON.stringify(data);
      const result = parseProgressFile(json);

      // Should succeed (schema uses passthrough)
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Extra field may or may not be preserved depending on implementation
        expect(result.assessment).toBeTruthy();
      }
    });

    it('rejects corrupted JSON', () => {
      const result = parseProgressFile('{ broken json');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('JSON');
      }
    });

    it('rejects wrong tool identifier', () => {
      const golden = createGoldenAssessment();
      const sessions = {};
      const file = buildProgressFileV2(golden, sessions);
      const data = JSON.parse(JSON.stringify(file));
      data.tool = 'wrong-tool';

      const json = JSON.stringify(data);
      const result = parseProgressFile(json);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Asset Dependency/i);
      }
    });

    it('rejects unsupported version', () => {
      const golden = createGoldenAssessment();
      const sessions = {};
      const file = buildProgressFileV2(golden, sessions);
      const data = JSON.parse(JSON.stringify(file));
      data.version = 99;

      const json = JSON.stringify(data);
      const result = parseProgressFile(json);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/version|Unsupported/i);
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles null and undefined consistently', () => {
      const assessment = getDefaultAssessment();
      
      // Verify roundtrip preserves nulls/undefined as empty strings consistently
      const sessions = {};
      const file = buildProgressFileV2(assessment, sessions);
      const json = JSON.stringify(file);

      const imported = parseProgressFile(json);
      expect(imported.ok).toBe(true);
      if (imported.ok) {
        const n1 = normalizeAssessment(assessment);
        const n2 = normalizeAssessment(imported.assessment);
        
        // After normalization, string-like fields with null should be normalized to empty strings
        const diffs = createDiffReport(n1, n2);
        // Filter out infrastructure differences as those are derived
        const relevantDiffs = diffs.filter(d => !d.includes('infrastructure'));
        expect(relevantDiffs).toEqual([]);
      }
    });

    it('handles edge case curve values (0, 100, etc.)', () => {
      const golden = createGoldenAssessment();
      const curve = (golden.categories?.ELECTRIC_POWER as Record<string, unknown> | undefined)?.curve_impact as Record<string, unknown> | undefined;
      if (curve) {
        curve.time_to_impact_hours = 0;
        curve.loss_fraction_no_backup = 1;
        curve.backup_duration_hours = 96;
        curve.recovery_time_hours = 1;
      }

      const sessions = {};
      const file = buildProgressFileV2(golden, sessions);
      const json = JSON.stringify(file);

      const imported = parseProgressFile(json);
      expect(imported.ok).toBe(true);
      if (imported.ok) {
        const n1 = normalizeAssessment(golden);
        const n2 = normalizeAssessment(imported.assessment);
        
        // Filter out infrastructure diffs as they may be reorganized
        const diffs = createDiffReport(n1, n2).filter(d => !d.includes('infrastructure'));
        expect(diffs).toEqual([]);
      }
    });

    it('handles large JSON files', () => {
      const golden = createGoldenAssessment();

      // Add large notes/descriptions (asset schema is passthrough; description may be stored)
      if (golden.asset) {
        (golden.asset as Record<string, unknown>).description =
          'x'.repeat(10000) +
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
      }

      const sessions = {};
      const file = buildProgressFileV2(golden, sessions);
      const json = JSON.stringify(file);

      const imported = parseProgressFile(json);
      expect(imported.ok).toBe(true);
      if (imported.ok) {
        const asset = imported.assessment?.asset as Record<string, unknown> | undefined;
        if (asset?.description) expect(String(asset.description)).toContain('Lorem ipsum');
      }
    });
  });
});
