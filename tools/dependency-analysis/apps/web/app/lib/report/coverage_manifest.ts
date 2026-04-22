/**
 * Report Coverage Audit
 *
 * Proves every captured input is either represented in the report or intentionally suppressed.
 * Export fails if captured-but-unaccounted-for exists.
 */

import type { Assessment } from 'schema';

export type CoverageCapturedEntry = {
  value: unknown;
  sector?: string;
  sourceQuestionId?: string;
};

export type CoverageRepresentedEntry = {
  sections: string[];
  renderPath: string;
};

export type CoverageSuppressedEntry = {
  reasonCode: string;
  reason: string;
};

export type CoverageManifest = {
  captured: Record<string, CoverageCapturedEntry>;
  represented: Record<string, CoverageRepresentedEntry>;
  suppressed: Record<string, CoverageSuppressedEntry>;
};

/** Keys we track per sector. Only keys with values are "captured". */
const TRACKED_KEYS_BY_SECTOR: Record<string, string[]> = {
  ELECTRIC_POWER: [
    'requires_service',
    'curve_requires_service',
    'time_to_impact_hours',
    'curve_time_to_impact_hours',
    'loss_fraction_no_backup',
    'curve_loss_fraction_no_backup',
    'has_backup_any',
    'has_backup',
    'curve_backup_available',
    'backup_duration_hours',
    'curve_backup_duration_hours',
    'loss_fraction_with_backup',
    'curve_loss_fraction_with_backup',
    'recovery_time_hours',
    'curve_recovery_time_hours',
    'supply',
    'has_backup_generator',
    'maintenance_schedule',
    'monitoring_capabilities',
    'vehicle_impact_exposure',
    'vehicle_impact_protection',
    'E-2',
    'E-3',
    'E-4',
    'E-5',
    'E-6',
    'E-7',
    'E-7a',
    'E-8',
    'E-9',
    'E-10',
    'E-11',
    'E-2_can_identify_substations',
    'E-3_more_than_one_connection',
    'E-8_backup_available',
    'E-9_refueling_plan',
    'E-11_priority_restoration',
    'E-7_protected_vehicle_impact',
  ],
  COMMUNICATIONS: [
    'requires_service',
    'curve_requires_service',
    'time_to_impact_hours',
    'curve_time_to_impact_hours',
    'loss_fraction_no_backup',
    'curve_loss_fraction_no_backup',
    'has_backup_any',
    'has_backup',
    'curve_backup_available',
    'backup_duration_hours',
    'curve_backup_duration_hours',
    'loss_fraction_with_backup',
    'curve_loss_fraction_with_backup',
    'recovery_time_hours',
    'curve_recovery_time_hours',
    'curve_primary_provider',
    'comm_pace_P',
    'comm_pace_A',
    'comm_pace_C',
    'comm_pace_E',
    'comm_single_point_voice_failure',
    'comms_single_provider_restoration',
    'comms_restoration_constraints',
    'maintenance_schedule',
    'monitoring_capabilities',
    'comm_interoperability',
    'comm_restoration_coordination',
    'comm_voice_functions',
  ],
  INFORMATION_TECHNOLOGY: [
    'requires_service',
    'curve_requires_service',
    'time_to_impact_hours',
    'curve_time_to_impact_hours',
    'loss_fraction_no_backup',
    'curve_loss_fraction_no_backup',
    'has_backup_any',
    'has_backup',
    'curve_backup_available',
    'backup_duration_hours',
    'curve_backup_duration_hours',
    'loss_fraction_with_backup',
    'curve_loss_fraction_with_backup',
    'recovery_time_hours',
    'curve_recovery_time_hours',
    'IT-1',
    'IT-3',
    'IT-8',
    'IT-11',
    'IT-1_can_identify_providers',
    'IT-3_redundancy_present',
    'IT-8_backup_available',
    'IT-11_priority_restoration',
    'IT-3_multiple_connections',
    'IT-4_geographically_separated',
    'IT-7_protected_vehicle_impact',
    'equipment_suppliers',
    'alternative_providers',
    'maintenance_schedule',
    'monitoring_capabilities',
  ],
  WATER: [
    'requires_service',
    'curve_requires_service',
    'time_to_impact_hours',
    'curve_time_to_impact_hours',
    'loss_fraction_no_backup',
    'curve_loss_fraction_no_backup',
    'has_backup_any',
    'has_backup',
    'curve_backup_available',
    'backup_duration_hours',
    'curve_backup_duration_hours',
    'loss_fraction_with_backup',
    'curve_loss_fraction_with_backup',
    'recovery_time_hours',
    'curve_recovery_time_hours',
    'W_Q2',
    'W_Q3',
    'W_Q6',
    'W_Q8',
    'W_Q2_connection_count',
    'W_Q3_same_geographic_location',
    'W_Q6_priority_restoration',
    'W_Q8_backup_available',
    'maintenance_schedule',
    'monitoring_capabilities',
  ],
  WASTEWATER: [
    'requires_service',
    'curve_requires_service',
    'time_to_impact_hours',
    'curve_time_to_impact_hours',
    'loss_fraction_no_backup',
    'curve_loss_fraction_no_backup',
    'has_backup_any',
    'has_backup',
    'curve_backup_available',
    'backup_duration_hours',
    'curve_backup_duration_hours',
    'loss_fraction_with_backup',
    'curve_loss_fraction_with_backup',
    'recovery_time_hours',
    'curve_recovery_time_hours',
    'WW_Q2',
    'WW_Q6',
    'WW_Q7',
    'WW_Q2_connection_count',
    'WW_Q6_priority_restoration',
    'WW_Q7_backup_available',
    'maintenance_schedule',
    'monitoring_capabilities',
  ],
  CRITICAL_PRODUCTS: ['critical_products'],
};

function hasValue(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  return true;
}

function getValue(data: Record<string, unknown>, keys: string[]): unknown {
  const answers = data.answers as Record<string, unknown> | undefined;
  for (const k of keys) {
    const v = data[k];
    if (hasValue(v)) return v;
    if (answers && hasValue(answers[k])) return answers[k];
  }
  return undefined;
}

/** Map captured key to sections that render it. */
function getRepresentedSections(key: string, sector: string): CoverageRepresentedEntry | null {
  const curveKeys = [
    'time_to_impact_hours',
    'curve_time_to_impact_hours',
    'loss_fraction_no_backup',
    'curve_loss_fraction_no_backup',
    'recovery_time_hours',
    'curve_recovery_time_hours',
    'backup_duration_hours',
    'curve_backup_duration_hours',
    'loss_fraction_with_backup',
    'curve_loss_fraction_with_backup',
  ];
  if (curveKeys.includes(key) || key === 'requires_service' || key === 'curve_requires_service') {
    return { sections: ['infrastructure_section', 'executive_snapshot', 'curve_chart'], renderPath: `${sector}.curve` };
  }
  if (key === 'has_backup_any' || key === 'has_backup' || key === 'curve_backup_available') {
    return { sections: ['infrastructure_section', 'executive_snapshot'], renderPath: `${sector}.curve.backup` };
  }
  if (key.startsWith('comm_pace_')) {
    return { sections: ['infrastructure_section', 'pace_chart', 'pace_summary'], renderPath: `${sector}.pace` };
  }
  if (key === 'curve_primary_provider' || key === 'comm_voice_functions') {
    return { sections: ['infrastructure_section', 'intro'], renderPath: `${sector}.intro` };
  }
  if (
    key === 'comm_single_point_voice_failure' ||
    key === 'comm_interoperability' ||
    key === 'comm_restoration_coordination'
  ) {
    return { sections: ['infrastructure_section', 'coordination_summary'], renderPath: `${sector}.coordination` };
  }
  if (key === 'critical_products') {
    return { sections: ['critical_products_section'], renderPath: 'CRITICAL_PRODUCTS.table' };
  }
  if (
    key.includes('provider') ||
    key.includes('connection') ||
    key.includes('backup') ||
    key.includes('priority') ||
    key.includes('restoration') ||
    key.includes('vehicle') ||
    key.includes('substation') ||
    key.includes('refuel') ||
    key.includes('redundancy') ||
    key.includes('geographic') ||
    key.includes('protected')
  ) {
    return { sections: ['infrastructure_section', 'vulnerabilities'], renderPath: `${sector}.vulnerabilities` };
  }
  return { sections: ['infrastructure_section'], renderPath: `${sector}.narrative` };
}

/**
 * Build coverage manifest from assessment.
 */
export function buildCoverageManifest(assessment: Assessment): CoverageManifest {
  const captured: Record<string, CoverageCapturedEntry> = {};
  const represented: Record<string, CoverageRepresentedEntry> = {};
  const suppressed: Record<string, CoverageSuppressedEntry> = {};

  const categories = assessment.categories ?? {};
  const crossDepEnabled = (assessment as { settings?: { cross_dependency_enabled?: boolean } }).settings?.cross_dependency_enabled === true;

  for (const [sector, keys] of Object.entries(TRACKED_KEYS_BY_SECTOR)) {
    const cat = categories[sector as keyof typeof categories];
    if (!cat || typeof cat !== 'object') continue;

    const data = cat as Record<string, unknown>;
    const requiresService = data.requires_service ?? data.curve_requires_service;
    const req = requiresService === true;

    for (const key of keys) {
      const value = getValue(data, [key]);
      if (!hasValue(value)) continue;

      const fullKey = `${sector}:${key}`;
      captured[fullKey] = {
        value,
        sector,
        sourceQuestionId: key.startsWith('curve_') ? undefined : key,
      };

      if (sector !== 'CRITICAL_PRODUCTS' && !req) {
        suppressed[fullKey] = {
          reasonCode: 'REQUIRES_SERVICE_FALSE',
          reason: 'Sector does not require service; inputs gated off',
        };
        continue;
      }

      const repr = getRepresentedSections(key, sector);
      if (repr) {
        represented[fullKey] = repr;
      } else {
        represented[fullKey] = {
          sections: ['infrastructure_section'],
          renderPath: `${sector}.narrative`,
        };
      }
    }
  }

  const crossDeps = assessment.cross_dependencies;
  const edges = Array.isArray(crossDeps)
    ? crossDeps
    : (crossDeps as { edges?: unknown[] } | undefined)?.edges ?? [];
  if (!crossDepEnabled && edges.length > 0) {
    for (const edge of edges) {
      const e = edge as { from_category?: string; to_category?: string };
      const key = `CROSS_DEP:${e.from_category ?? '?'}-${e.to_category ?? '?'}`;
      captured[key] = { value: edge, sector: 'CROSS_DEPENDENCY' };
      suppressed[key] = {
        reasonCode: 'CROSS_DEPENDENCY_DISABLED',
        reason: 'Cross-dependency module is disabled',
      };
    }
  }

  return { captured, represented, suppressed };
}

/**
 * Get keys that are captured but neither represented nor suppressed.
 */
export function getUnaccountedKeys(manifest: CoverageManifest): string[] {
  const accounted = new Set([
    ...Object.keys(manifest.represented),
    ...Object.keys(manifest.suppressed),
  ]);
  return Object.keys(manifest.captured).filter((k) => !accounted.has(k));
}

/**
 * Assert all captured keys are accounted for. Throws if any are unaccounted.
 */
export function assertCoverageComplete(assessment: Assessment): void {
  const manifest = buildCoverageManifest(assessment);
  const unaccounted = getUnaccountedKeys(manifest);

  if (unaccounted.length > 0) {
    const maxShow = 25;
    const sample = unaccounted.slice(0, maxShow);
    const entries = sample.map((k) => {
      const c = manifest.captured[k];
      return `${k} (sector: ${c?.sector ?? '?'}, source: ${c?.sourceQuestionId ?? '?'})`;
    });
    const msg =
      unaccounted.length > maxShow
        ? `Coverage audit failed: ${unaccounted.length} captured inputs unaccounted. First ${maxShow}: ${entries.join('; ')}`
        : `Coverage audit failed: captured inputs not represented or suppressed: ${entries.join('; ')}`;
    throw new Error(msg);
  }
}
