/**
 * Normalized conditions tests.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeDependencyConditions,
  mergeNormalizedIntoAnswers,
} from './normalize_conditions';
import { fullAssessmentForExport } from 'engine';
import type { Assessment } from 'schema';

describe('normalizeDependencyConditions', () => {
  it('produces conditions for each sector with data', () => {
    const { normalized } = normalizeDependencyConditions(fullAssessmentForExport);
    expect(normalized.ELECTRIC_POWER).toBeDefined();
    expect(normalized.COMMUNICATIONS).toBeDefined();
    expect(normalized.INFORMATION_TECHNOLOGY).toBeDefined();
    expect(normalized.WATER).toBeDefined();
    expect(normalized.WASTEWATER).toBeDefined();
  });

  it('requires_service reflects category', () => {
    const { normalized } = normalizeDependencyConditions(fullAssessmentForExport);
    expect(normalized.ELECTRIC_POWER?.requires_service).toBe(true);
    expect(normalized.INFORMATION_TECHNOLOGY?.requires_service).toBe(false);
  });

  it('alternate_present when has_backup is false', () => {
    const { normalized } = normalizeDependencyConditions(fullAssessmentForExport);
    expect(normalized.ELECTRIC_POWER?.alternate_present).toBe(false);
    expect(normalized.COMMUNICATIONS?.alternate_present).toBe(true);
  });

  it('electric alternate_present resolves true when generator evidence exists even if legacy backup flags are false', () => {
    const fixture: Assessment = {
      ...fullAssessmentForExport,
      categories: {
        ...fullAssessmentForExport.categories,
        ELECTRIC_POWER: {
          requires_service: true,
          has_backup_any: false, // stale legacy flag
          has_backup: false, // stale legacy flag
          curve_backup_available: 'no', // stale curve toggle
          has_backup_generator: true, // explicit evidence
          'E-8_backup_power_available': 'yes', // explicit evidence
          'E-8_backup_assets': [{ asset_type: 'generator' }], // explicit evidence
          backup_duration_hours: 48,
          curve_time_to_impact_hours: 1,
          curve_loss_fraction_no_backup: 0.95,
          curve_recovery_time_hours: 1,
        } as any,
      },
    } as Assessment;

    const { normalized } = normalizeDependencyConditions(fixture);
    expect(normalized.ELECTRIC_POWER?.alternate_present).toBe(true);
  });

  it('pace_depth is NONE when no PACE layers', () => {
    const { normalized } = normalizeDependencyConditions(fullAssessmentForExport);
    expect(normalized.COMMUNICATIONS?.pace_depth).toBe('NONE');
  });

  it('returns accounting with mappedKeys', () => {
    const { accounting } = normalizeDependencyConditions(fullAssessmentForExport);
    expect(Array.isArray(accounting.mappedKeys)).toBe(true);
    expect(Array.isArray(accounting.unmappedKeys)).toBe(true);
    expect(Array.isArray(accounting.missingRequiredKeys)).toBe(true);
  });

  it('A) Mapping completeness: unmappedKeys empty for fixture with mapped keys only', () => {
    const fixture: Assessment = {
      ...fullAssessmentForExport,
      categories: {
        ...fullAssessmentForExport.categories,
        ELECTRIC_POWER: {
          requires_service: true,
          time_to_impact_hours: 2,
          loss_fraction_no_backup: 0.6,
          has_backup_any: false,
          has_backup_generator: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 48,
        },
      } as any,
    } as Assessment;
    const { accounting } = normalizeDependencyConditions(fixture);
    expect(accounting.unmappedKeys).toEqual([]);
  });

  it('IT it_hosted_resilience is mapped and does not appear in unmappedKeys', () => {
    const fixture: Assessment = {
      ...fullAssessmentForExport,
      categories: {
        ...fullAssessmentForExport.categories,
        INFORMATION_TECHNOLOGY: {
          requires_service: true,
          it_hosted_resilience: { some_dep: { survivability: 'NO_CONTINUITY' } },
        },
      } as any,
    } as Assessment;
    const { accounting } = normalizeDependencyConditions(fixture);
    const itUnmapped = accounting.unmappedKeys.filter((k) => k === 'INFORMATION_TECHNOLOGY:it_hosted_resilience');
    expect(itUnmapped).toEqual([]);
  });

  it('PRA/SLA overlay keys (pra_sla, it_pra_sla_providers) are non-reporting and do not appear in unmappedKeys', () => {
    const fixture: Assessment = {
      ...fullAssessmentForExport,
      categories: {
        ...fullAssessmentForExport.categories,
        INFORMATION_TECHNOLOGY: {
          requires_service: true,
          pra_sla: { providers: [{ restoration_coordination: 'Yes' }] },
          it_pra_sla_providers: [{ name: 'ISP A' }],
        },
      } as any,
    } as Assessment;
    const { accounting } = normalizeDependencyConditions(fixture);
    const praSlaUnmapped = accounting.unmappedKeys.filter(
      (k) => k === 'INFORMATION_TECHNOLOGY:pra_sla' || k === 'INFORMATION_TECHNOLOGY:it_pra_sla_providers'
    );
    expect(praSlaUnmapped).toEqual([]);
  });

  it('report_themed_findings is report-only legacy; does not appear in unmappedKeys (tolerant for one release)', () => {
    const fixture: Assessment = {
      ...fullAssessmentForExport,
      categories: {
        ...fullAssessmentForExport.categories,
        INFORMATION_TECHNOLOGY: {
          requires_service: true,
          report_themed_findings: [{ id: 'v1', title: 'Transport', narrative: 'Same conduit.', ofcText: '' }],
        },
      } as any,
    } as Assessment;
    const { accounting } = normalizeDependencyConditions(fixture);
    const reportThemedUnmapped = accounting.unmappedKeys.filter((k) => k === 'INFORMATION_TECHNOLOGY:report_themed_findings');
    expect(reportThemedUnmapped).toEqual([]);
  });

  it('showcase-style maintenance and monitoring fields do not appear in unmappedKeys', () => {
    const fixture: Assessment = {
      ...fullAssessmentForExport,
      categories: {
        ...fullAssessmentForExport.categories,
        ELECTRIC_POWER: {
          requires_service: true,
          maintenance_schedule: { preventive_maintenance_established: 'Yes' },
          monitoring_capabilities: { real_time_monitoring_exists: 'Yes' },
        },
        COMMUNICATIONS: {
          requires_service: true,
          comms_single_provider_restoration: 'No',
          comms_restoration_constraints: ['specialized_equipment'],
          maintenance_schedule: { preventive_maintenance_established: 'Yes' },
          monitoring_capabilities: { real_time_monitoring_exists: 'Yes' },
        },
        INFORMATION_TECHNOLOGY: {
          requires_service: true,
          equipment_suppliers: [{ component_or_service: 'Firewall', alternatives_available: 'Yes' }],
          alternative_providers: { available: 'Yes' },
          maintenance_schedule: { preventive_maintenance_established: 'Yes' },
          monitoring_capabilities: { real_time_monitoring_exists: 'Yes' },
        },
        WATER: {
          requires_service: true,
          maintenance_schedule: { preventive_maintenance_established: 'Yes' },
          monitoring_capabilities: { real_time_monitoring_exists: 'Yes' },
        },
        WASTEWATER: {
          requires_service: true,
          maintenance_schedule: { preventive_maintenance_established: 'Yes' },
          monitoring_capabilities: { real_time_monitoring_exists: 'Yes' },
        },
      } as any,
    } as Assessment;
    const { accounting } = normalizeDependencyConditions(fixture);
    const unexpected = accounting.unmappedKeys.filter((k) =>
      [
        'ELECTRIC_POWER:maintenance_schedule',
        'ELECTRIC_POWER:monitoring_capabilities',
        'COMMUNICATIONS:comms_single_provider_restoration',
        'COMMUNICATIONS:comms_restoration_constraints',
        'COMMUNICATIONS:maintenance_schedule',
        'COMMUNICATIONS:monitoring_capabilities',
        'INFORMATION_TECHNOLOGY:equipment_suppliers',
        'INFORMATION_TECHNOLOGY:alternative_providers',
        'INFORMATION_TECHNOLOGY:maintenance_schedule',
        'INFORMATION_TECHNOLOGY:monitoring_capabilities',
        'WATER:maintenance_schedule',
        'WATER:monitoring_capabilities',
        'WASTEWATER:maintenance_schedule',
        'WASTEWATER:monitoring_capabilities',
      ].includes(k)
    );
    expect(unexpected).toEqual([]);
  });

  describe('hosted continuity: no default NONE; vulnerability only on explicit NONE', () => {
    const baseIT = {
      requires_service: true,
      'IT-2_upstream_assets': [{ service_id: 'aws', service_provider: 'AWS' }],
    };

    it('survivability undefined → hosted_continuity_weakness false, hosted_continuity_unevaluated true', () => {
      const fixture: Assessment = {
        ...fullAssessmentForExport,
        categories: {
          ...fullAssessmentForExport.categories,
          INFORMATION_TECHNOLOGY: {
            ...baseIT,
            it_hosted_resilience: { aws: {} },
          },
        } as any,
      } as Assessment;
      const { normalized } = normalizeDependencyConditions(fixture);
      expect(normalized.INFORMATION_TECHNOLOGY?.hosted_continuity_weakness).toBe(false);
      expect(normalized.INFORMATION_TECHNOLOGY?.hosted_continuity_unevaluated).toBe(true);
    });

    it('survivability NO_CONTINUITY or NONE → hosted_continuity_weakness true', () => {
      const fixture: Assessment = {
        ...fullAssessmentForExport,
        categories: {
          ...fullAssessmentForExport.categories,
          INFORMATION_TECHNOLOGY: {
            ...baseIT,
            it_hosted_resilience: { aws: { survivability: 'NO_CONTINUITY' } },
          },
        } as any,
      } as Assessment;
      const { normalized } = normalizeDependencyConditions(fixture);
      expect(normalized.INFORMATION_TECHNOLOGY?.hosted_continuity_weakness).toBe(true);
    });

    it('survivability ALTERNATE_PLATFORM_OR_PROVIDER → hosted_continuity_weakness false', () => {
      const fixture: Assessment = {
        ...fullAssessmentForExport,
        categories: {
          ...fullAssessmentForExport.categories,
          INFORMATION_TECHNOLOGY: {
            ...baseIT,
            it_hosted_resilience: { aws: { survivability: 'MANUAL_FALLBACK' } },
          },
        } as any,
      } as Assessment;
      const { normalized } = normalizeDependencyConditions(fixture);
      expect(normalized.INFORMATION_TECHNOLOGY?.hosted_continuity_weakness).toBe(false);
    });

    it('survivability LOCAL_MIRROR → hosted_continuity_weakness false', () => {
      const fixture: Assessment = {
        ...fullAssessmentForExport,
        categories: {
          ...fullAssessmentForExport.categories,
          INFORMATION_TECHNOLOGY: {
            ...baseIT,
            it_hosted_resilience: { aws: { survivability: 'LOCAL_MIRROR' } },
          },
        } as any,
      } as Assessment;
      const { normalized } = normalizeDependencyConditions(fixture);
      expect(normalized.INFORMATION_TECHNOLOGY?.hosted_continuity_weakness).toBe(false);
    });

    it('survivability UNKNOWN → hosted_continuity_unknown true, hosted_continuity_weakness false', () => {
      const fixture: Assessment = {
        ...fullAssessmentForExport,
        categories: {
          ...fullAssessmentForExport.categories,
          INFORMATION_TECHNOLOGY: {
            ...baseIT,
            it_hosted_resilience: { aws: { survivability: 'UNKNOWN' } },
          },
        } as any,
      } as Assessment;
      const { normalized } = normalizeDependencyConditions(fixture);
      expect(normalized.INFORMATION_TECHNOLOGY?.hosted_continuity_weakness).toBe(false);
      expect(normalized.INFORMATION_TECHNOLOGY?.hosted_continuity_unknown).toBe(true);
    });
  });

  describe('IT transport: physical fields only; provider count must NOT infer path', () => {
    const baseIT = { requires_service: true };

    it('connection_count=2, entry SAME_ENTRY → it_transport_single_path_exposure true', () => {
      const fixture: Assessment = {
        ...fullAssessmentForExport,
        categories: {
          ...fullAssessmentForExport.categories,
          INFORMATION_TECHNOLOGY: {
            ...baseIT,
            it_transport_resilience: {
              circuit_count: 'TWO',
              transport_connection_count: 2,
              transport_building_entry_diversity: 'SAME_ENTRY',
              transport_route_independence: 'UNKNOWN',
            },
          },
        } as any,
      } as Assessment;
      const { normalized } = normalizeDependencyConditions(fixture);
      expect(normalized.INFORMATION_TECHNOLOGY?.it_transport_single_path_exposure).toBe(true);
    });

    it('connection_count=2, entry SEPARATE_ENTRY, independence CONFIRMED → no concentration', () => {
      const fixture: Assessment = {
        ...fullAssessmentForExport,
        categories: {
          ...fullAssessmentForExport.categories,
          INFORMATION_TECHNOLOGY: {
            ...baseIT,
            it_transport_resilience: {
              circuit_count: 'TWO',
              transport_connection_count: 2,
              transport_building_entry_diversity: 'SEPARATE_ENTRY',
              transport_route_independence: 'CONFIRMED',
            },
          },
        } as any,
      } as Assessment;
      const { normalized } = normalizeDependencyConditions(fixture);
      expect(normalized.INFORMATION_TECHNOLOGY?.it_transport_single_path_exposure).toBe(false);
    });

    it('connection_count=1 → it_transport_single_path_exposure true', () => {
      const fixture: Assessment = {
        ...fullAssessmentForExport,
        categories: {
          ...fullAssessmentForExport.categories,
          INFORMATION_TECHNOLOGY: {
            ...baseIT,
            it_transport_resilience: { circuit_count: 'ONE', transport_connection_count: 1 },
          },
        } as any,
      } as Assessment;
      const { normalized } = normalizeDependencyConditions(fixture);
      expect(normalized.INFORMATION_TECHNOLOGY?.it_transport_single_path_exposure).toBe(true);
    });
  });
});

describe('mergeNormalizedIntoAnswers', () => {
  it('merges without overwriting curve keys', () => {
    const { normalized } = normalizeDependencyConditions(fullAssessmentForExport);
    const raw = {
      curve_time_to_impact_hours: 12,
      curve_loss_fraction_no_backup: 0.5,
    };
    const merged = mergeNormalizedIntoAnswers(
      raw,
      normalized.ELECTRIC_POWER,
      'ELECTRIC_POWER'
    );
    expect(merged.curve_time_to_impact_hours).toBe(12);
    expect(merged.curve_loss_fraction_no_backup).toBe(0.5);
  });

  it('adds provider keys when provider_confirmed is UNCONFIRMED', () => {
    const { normalized } = normalizeDependencyConditions(fullAssessmentForExport);
    const raw: Record<string, unknown> = {};
    const merged = mergeNormalizedIntoAnswers(
      raw,
      { ...normalized.ELECTRIC_POWER!, provider_confirmed: 'UNCONFIRMED' as const },
      'ELECTRIC_POWER'
    );
    expect(merged['E-2']).toBe('no');
  });
});
