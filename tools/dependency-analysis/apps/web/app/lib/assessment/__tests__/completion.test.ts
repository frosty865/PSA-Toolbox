import { describe, it, expect } from 'vitest';
import type { Assessment } from 'schema';
import {
  computeCompletion,
  computeExportPreflight,
  getFirstMissingInfo,
  type CompletionResult,
} from '../completion';

function buildBaseAssessment(): Assessment {
  return {
    meta: {
      tool_version: 'test',
      template_version: 'test',
      created_at_iso: '2026-02-12T00:00:00.000Z',
    },
    asset: {
      asset_name: 'Test Asset',
      visit_date_iso: '2026-02-12',
      location: '',
      assessor: '',
    },
    categories: {
      ELECTRIC_POWER: {},
      COMMUNICATIONS: {},
      INFORMATION_TECHNOLOGY: {},
      WATER: {},
      WASTEWATER: {},
      CRITICAL_PRODUCTS: { critical_products: [] },
    } as Assessment['categories'],
  };
}

describe('computeCompletion', () => {
  it('counts only visible required questions (E-4 gated when E-3 is no)', () => {
    const assessment = buildBaseAssessment();
    assessment.categories!.ELECTRIC_POWER = {
      curve_requires_service: true,
      curve_primary_provider: 'Test Utility',
      curve_time_to_impact_hours: 6,
      curve_loss_fraction_no_backup: 0.5,
      curve_backup_available: 'no',
      curve_recovery_time_hours: 24,
    } as Record<string, unknown>;
    assessment.categories!.ELECTRIC_POWER['E-3_more_than_one_connection'] = 'no';

    const result = computeCompletion(assessment);
    expect(result.bySector.ELECTRIC_POWER.requiredTotal).toBeGreaterThan(0);
    expect(result.bySector.ELECTRIC_POWER.missing).not.toContain('E-4');
  });

  it('returns 100% for Energy sector when all visible required questions are answered', () => {
    const assessment = buildBaseAssessment();
    assessment.categories!.ELECTRIC_POWER = {
      curve_requires_service: true,
      curve_primary_provider: 'Utility',
      curve_time_to_impact_hours: 6,
      curve_loss_fraction_no_backup: 0.5,
      curve_backup_available: 'yes',
      curve_backup_duration_hours: 12,
      curve_loss_fraction_with_backup: 0.2,
      curve_recovery_time_hours: 24,
      'E-2_can_identify_substations': 'yes',
      'E-3_more_than_one_connection': 'yes',
      'E-4_physically_separated': 'yes',
      'E-5_single_supports_core_ops': 'yes',
      'E-6_exterior_protected': 'yes',
      'E-7_vehicle_impact_exposure': 'no',
      'E-8_backup_power_available': 'yes',
      'E-9_refuel_sustainment_established': 'yes',
      'E-10_tested_under_load': 'yes',
      'E-11_provider_restoration_coordination': 'yes',
    } as Record<string, unknown>;
    assessment.categories!.COMMUNICATIONS = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.INFORMATION_TECHNOLOGY = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.WATER = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.WASTEWATER = { curve_requires_service: false } as Record<string, unknown>;

    const result = computeCompletion(assessment);
    expect(result.bySector.ELECTRIC_POWER.pct).toBe(100);
    expect(result.bySector.ELECTRIC_POWER.missing).toHaveLength(0);
  });

  it('uses question IDs in missing list, not normalized field names like provider_confirmed', () => {
    const assessment = buildBaseAssessment();
    assessment.categories!.ELECTRIC_POWER = {
      curve_requires_service: true,
      curve_primary_provider: 'Utility',
      curve_time_to_impact_hours: 6,
      curve_loss_fraction_no_backup: 0.5,
      curve_backup_available: 'no',
      curve_recovery_time_hours: 24,
    } as Record<string, unknown>;

    const result = computeCompletion(assessment);
    expect(result.bySector.ELECTRIC_POWER.missing.length).toBeGreaterThan(0);
    expect(result.bySector.ELECTRIC_POWER.missing.some((id) => id.startsWith('E-') || id.startsWith('curve_'))).toBe(true);
  });

  it('sectors with curve_requires_service false have fewer required questions', () => {
    const assessment = buildBaseAssessment();
    assessment.categories!.ELECTRIC_POWER = {
      curve_requires_service: true,
      curve_primary_provider: 'U',
      curve_time_to_impact_hours: 6,
      curve_loss_fraction_no_backup: 0.5,
      curve_backup_available: 'no',
      curve_recovery_time_hours: 24,
    } as Record<string, unknown>;

    const resultWhenReliance = computeCompletion(assessment);
    assessment.categories!.ELECTRIC_POWER = { curve_requires_service: false } as Record<string, unknown>;
    const resultWhenNoReliance = computeCompletion(assessment);

    expect(resultWhenReliance.bySector.ELECTRIC_POWER.requiredTotal).toBeGreaterThan(
      resultWhenNoReliance.bySector.ELECTRIC_POWER.requiredTotal
    );
  });
});

describe('getFirstMissingInfo', () => {
  it('returns first missing question with sector and label', () => {
    const completion: CompletionResult = {
      overallPct: 50,
      bySector: {
        ELECTRIC_POWER: { pct: 50, requiredTotal: 10, requiredAnswered: 5, missing: ['curve_primary_provider', 'E-3'] },
        COMMUNICATIONS: { pct: 100, requiredTotal: 0, requiredAnswered: 0, missing: [] },
        INFORMATION_TECHNOLOGY: { pct: 100, requiredTotal: 0, requiredAnswered: 0, missing: [] },
        WATER: { pct: 100, requiredTotal: 0, requiredAnswered: 0, missing: [] },
        WASTEWATER: { pct: 100, requiredTotal: 0, requiredAnswered: 0, missing: [] },
      },
      isComplete: false,
    };
    const info = getFirstMissingInfo(completion);
    expect(info).not.toBeNull();
    expect(info!.sector).toBe('ELECTRIC_POWER');
    expect(info!.sectorLabel).toBe('Electric Power');
    expect(info!.questionId).toBe('curve_primary_provider');
    expect(info!.label.length).toBeGreaterThan(0);
  });

  it('returns null when complete', () => {
    const completion: CompletionResult = {
      overallPct: 100,
      bySector: {
        ELECTRIC_POWER: { pct: 100, requiredTotal: 10, requiredAnswered: 10, missing: [] },
        COMMUNICATIONS: { pct: 100, requiredTotal: 0, requiredAnswered: 0, missing: [] },
        INFORMATION_TECHNOLOGY: { pct: 100, requiredTotal: 0, requiredAnswered: 0, missing: [] },
        WATER: { pct: 100, requiredTotal: 0, requiredAnswered: 0, missing: [] },
        WASTEWATER: { pct: 100, requiredTotal: 0, requiredAnswered: 0, missing: [] },
      },
      isComplete: true,
    };
    expect(getFirstMissingInfo(completion)).toBeNull();
  });
});

describe('computeExportPreflight', () => {
  it('blocks export when requires_service true but curve points missing', () => {
    const assessment = buildBaseAssessment();
    assessment.categories!.ELECTRIC_POWER = {
      curve_requires_service: true,
      curve_primary_provider: 'Utility',
    } as Record<string, unknown>;
    assessment.categories!.COMMUNICATIONS = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.INFORMATION_TECHNOLOGY = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.WATER = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.WASTEWATER = { curve_requires_service: false } as Record<string, unknown>;

    const completion = computeCompletion(assessment);
    const preflight = computeExportPreflight(assessment, completion, true);

    expect(preflight.canExport).toBe(false);
    expect(preflight.errors.some((e) => e.includes('curve points') || e.includes('Electric Power'))).toBe(true);
  });

  it('allows export when template ready and curve points present even if assessment is incomplete', () => {
    const assessment = buildBaseAssessment();
    assessment.categories!.ELECTRIC_POWER = {
      curve_requires_service: true,
      curve_primary_provider: 'Utility',
      curve_time_to_impact_hours: 6,
      curve_loss_fraction_no_backup: 0.5,
      curve_backup_available: 'no',
      curve_recovery_time_hours: 24,
    } as Record<string, unknown>;
    assessment.categories!.COMMUNICATIONS = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.INFORMATION_TECHNOLOGY = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.WATER = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.WASTEWATER = { curve_requires_service: false } as Record<string, unknown>;

    const completion = computeCompletion(assessment);
    const preflight = computeExportPreflight(assessment, completion, true);

    expect(preflight.canExport).toBe(true);
    expect(preflight.errors).toHaveLength(0);
  });

  it('blocks export when template not ready', () => {
    const assessment = buildBaseAssessment();
    assessment.categories!.ELECTRIC_POWER = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.COMMUNICATIONS = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.INFORMATION_TECHNOLOGY = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.WATER = { curve_requires_service: false } as Record<string, unknown>;
    assessment.categories!.WASTEWATER = { curve_requires_service: false } as Record<string, unknown>;

    const completion = computeCompletion(assessment);
    const preflight = computeExportPreflight(assessment, completion, false);

    expect(preflight.canExport).toBe(false);
    expect(preflight.errors.some((e) => e.toLowerCase().includes('template'))).toBe(true);
  });
});
