import { describe, it, expect } from 'vitest';
import type { Assessment, CategoryInput } from 'schema';
import { normalizeCurveStorage } from '../normalize_curve_storage';

function buildBaseAssessment(): Assessment {
  const categories: Record<string, CategoryInput> = {
    ELECTRIC_POWER: {} as CategoryInput,
    COMMUNICATIONS: {} as CategoryInput,
    INFORMATION_TECHNOLOGY: {} as CategoryInput,
    WATER: {} as CategoryInput,
    WASTEWATER: {} as CategoryInput,
    CRITICAL_PRODUCTS: { critical_products: [] } as CategoryInput,
  };

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
    categories: categories as Assessment['categories'],
  };
}

describe('normalizeCurveStorage', () => {
  it('does not add infrastructure when no curve data exists', () => {
    const assessment = buildBaseAssessment();
    const normalized = normalizeCurveStorage(assessment);
    expect(normalized.infrastructure).toBeUndefined();
  });

  it('migrates legacy curve_* fields into energy namespace and strips roots', () => {
    const assessment = buildBaseAssessment() as Assessment & Record<string, unknown>;
    assessment.curve_requires_service = true;
    assessment.curve_time_to_impact_hours = 6;
    assessment.curve_loss_fraction_no_backup = 0.4;
    assessment.curve_backup_duration_hours = 12;
    assessment.curve_loss_fraction_with_backup = 0.2;
    assessment.curve_recovery_time_hours = 36;

    const normalized = normalizeCurveStorage(assessment as Assessment);

    expect('curve_requires_service' in normalized).toBe(false);
    expect(normalized.infrastructure).toBeDefined();
    expect(normalized.infrastructure?.energy?.curve).toEqual({
      requires_service: true,
      time_to_impact: 6,
      loss_no_backup: 0.4,
      backup_duration: 12,
      loss_with_backup: 0.2,
      recovery_time: 36,
    });
  });

  it('derives curve namespace from category inputs when no existing curve is stored', () => {
    const assessment = buildBaseAssessment();
    assessment.categories.ELECTRIC_POWER = {
      requires_service: true,
      time_to_impact_hours: 4,
      loss_fraction_no_backup: 0.5,
      has_backup_any: true,
      backup_duration_hours: 8,
      loss_fraction_with_backup: 0.25,
      recovery_time_hours: 20,
    } as CategoryInput;

    const normalized = normalizeCurveStorage(assessment);
    expect(normalized.infrastructure?.energy?.curve).toEqual({
      requires_service: true,
      time_to_impact: 4,
      loss_no_backup: 0.5,
      backup_duration: 8,
      loss_with_backup: 0.25,
      recovery_time: 20,
    });
  });

  it('removes empty curve nodes and leaves custom infrastructure data untouched', () => {
    const assessment = buildBaseAssessment();
    assessment.infrastructure = {
      communications: { curve: {}, custom: 'keep-me' },
      water: { curve: {} },
    } as Assessment['infrastructure'];

    const normalized = normalizeCurveStorage(assessment);
    expect(normalized.infrastructure?.communications?.custom).toBe('keep-me');
    expect(normalized.infrastructure?.communications?.curve).toBeUndefined();
    expect(normalized.infrastructure?.water).toBeUndefined();
  });
});
