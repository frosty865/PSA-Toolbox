import { describe, it, expect } from 'vitest';
import { AssessmentSchema } from '../assessment';

const minimalMeta = {
  tool_version: '1',
  template_version: '1',
  created_at_iso: '2020-01-01T00:00:00Z',
};
const minimalAsset = { asset_name: 'Test', visit_date_iso: '2020-01-01' };

function supplySource(overrides: { provider_name: string; independence?: string; source_id?: string }) {
  return {
    source_id: overrides.source_id ?? `src-${Math.random().toString(36).slice(2, 9)}`,
    provider_name: overrides.provider_name,
    source_label: null,
    demarcation_lat: null,
    demarcation_lon: null,
    demarcation_description: null,
    independence: (overrides.independence ?? 'UNKNOWN') as 'UNKNOWN' | 'SAME_DEMARCATION' | 'DIFFERENT_DEMARCATION_SAME_UPSTREAM' | 'DIFFERENT_LOOP_OR_PATH',
    notes: null,
  };
}

describe('AssessmentSchema supply validation (IT vs other categories)', () => {
  it('IT: has_alternate_source true with both sources independence UNKNOWN passes', () => {
    const result = AssessmentSchema.safeParse({
      meta: minimalMeta,
      asset: minimalAsset,
      categories: {
        INFORMATION_TECHNOLOGY: {
          supply: {
            has_alternate_source: true,
            sources: [
              supplySource({ provider_name: 'ISP A', independence: 'UNKNOWN' }),
              supplySource({ provider_name: 'ISP B', independence: 'UNKNOWN' }),
            ],
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('IT: has_alternate_source true but only one source fails with clear message', () => {
    const result = AssessmentSchema.safeParse({
      meta: minimalMeta,
      asset: minimalAsset,
      categories: {
        INFORMATION_TECHNOLOGY: {
          supply: {
            has_alternate_source: true,
            sources: [supplySource({ provider_name: 'ISP A' })],
          },
        },
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(' ');
      expect(msg).toMatch(/sources must have at least 2 rows when has_alternate_source is true/);
    }
  });

  it('ELECTRIC_POWER: has_alternate_source true with UNKNOWN independence fails', () => {
    const result = AssessmentSchema.safeParse({
      meta: minimalMeta,
      asset: minimalAsset,
      categories: {
        ELECTRIC_POWER: {
          supply: {
            has_alternate_source: true,
            sources: [
              supplySource({ provider_name: 'Utility A', independence: 'DIFFERENT_LOOP_OR_PATH' }),
              supplySource({ provider_name: 'Utility B', independence: 'UNKNOWN' }),
            ],
          },
        },
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(' ');
      expect(msg).toMatch(/independence must be set \(not UNKNOWN\) when has_alternate_source is true/);
    }
  });

  it('WATER: has_alternate_source true with both sources set (non-UNKNOWN) passes', () => {
    const result = AssessmentSchema.safeParse({
      meta: minimalMeta,
      asset: minimalAsset,
      categories: {
        WATER: {
          supply: {
            has_alternate_source: true,
            sources: [
              supplySource({ provider_name: 'Water A', independence: 'DIFFERENT_LOOP_OR_PATH' }),
              supplySource({ provider_name: 'Water B', independence: 'SAME_DEMARCATION' }),
            ],
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

function categoryWithBackup(overrides: {
  has_backup_any?: boolean;
  backup_type?: string;
  backup_duration_hours?: number | null;
  loss_fraction_with_backup?: number | null;
}) {
  return {
    requires_service: true,
    has_backup_any: overrides.has_backup_any ?? true,
    backup_type: overrides.backup_type,
    backup_duration_hours: overrides.backup_duration_hours,
    loss_fraction_with_backup: overrides.loss_fraction_with_backup ?? 0.5,
  };
}

describe('AssessmentSchema backup_duration_hours and backup_type', () => {
  it('VALID: has_backup_any true, backup_type missing (default PERMANENT), backup_duration_hours null', () => {
    const result = AssessmentSchema.safeParse({
      meta: minimalMeta,
      asset: minimalAsset,
      categories: {
        INFORMATION_TECHNOLOGY: categoryWithBackup({
          has_backup_any: true,
          backup_duration_hours: null,
          // backup_type omitted → treated as PERMANENT
        }),
      },
    });
    expect(result.success).toBe(true);
  });

  it('VALID: has_backup_any true, backup_type PERMANENT, backup_duration_hours null', () => {
    const result = AssessmentSchema.safeParse({
      meta: minimalMeta,
      asset: minimalAsset,
      categories: {
        INFORMATION_TECHNOLOGY: categoryWithBackup({
          has_backup_any: true,
          backup_type: 'PERMANENT',
          backup_duration_hours: null,
        }),
      },
    });
    expect(result.success).toBe(true);
  });

  it('VALID: has_backup_any true, backup_type WORKFLOW, backup_duration_hours null', () => {
    const result = AssessmentSchema.safeParse({
      meta: minimalMeta,
      asset: minimalAsset,
      categories: {
        INFORMATION_TECHNOLOGY: categoryWithBackup({
          has_backup_any: true,
          backup_type: 'WORKFLOW',
          backup_duration_hours: null,
        }),
      },
    });
    expect(result.success).toBe(true);
  });

  it('INVALID: has_backup_any true, backup_type TEMPORARY, backup_duration_hours null', () => {
    const result = AssessmentSchema.safeParse({
      meta: minimalMeta,
      asset: minimalAsset,
      categories: {
        INFORMATION_TECHNOLOGY: categoryWithBackup({
          has_backup_any: true,
          backup_type: 'TEMPORARY',
          backup_duration_hours: null,
        }),
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(' ');
      expect(msg).toMatch(/backup_duration_hours must be set when backup type is TEMPORARY/);
    }
  });
});
