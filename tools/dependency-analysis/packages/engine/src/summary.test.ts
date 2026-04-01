import { describe, it, expect } from 'vitest';
import { buildSummary } from './summary';
import type { Assessment } from 'schema';

describe('buildSummary', () => {
  it('requires_service=false: row has correct capacities', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: '2024-01-01T00:00:00Z' },
      asset: { asset_name: 'A', visit_date_iso: '2024-01-01' },
      categories: {
        ELECTRIC_POWER: {
          requires_service: false,
          time_to_impact_hours: 12,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 24,
        },
      },
    };
    const rows = buildSummary(assessment);
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('ELECTRIC_POWER');
    expect(rows[0].requires_service).toBe(false);
    expect(rows[0].capacity_after_impact_no_backup).toBe(50); // (1-0.5)*100
    expect(rows[0].has_backup).toBe(false);
    expect(rows[0].backup_duration_hours).toBeNull();
    expect(rows[0].capacity_after_backup_exhausted).toBeNull();
    expect(rows[0].recovery_time_hours).toBe(24);
  });

  it('has_backup: capacity_after_backup_exhausted computed', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: '2024-01-01T00:00:00Z' },
      asset: { asset_name: 'A', visit_date_iso: '2024-01-01' },
      categories: {
        WATER: {
          requires_service: true,
          time_to_impact_hours: 6,
          loss_fraction_no_backup: 0.7,
          has_backup: true,
          backup_duration_hours: 24,
          loss_fraction_with_backup: 0.2,
          recovery_time_hours: 48,
        },
      },
    };
    const rows = buildSummary(assessment);
    expect(rows[0].capacity_after_impact_no_backup).toBe(30); // (1-0.7)*100
    expect(rows[0].capacity_after_backup_exhausted).toBe(80); // (1-0.2)*100
    expect(rows[0].backup_duration_hours).toBe(24);
  });

  it('null rules: has_backup=false yields null backup fields', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: '2024-01-01T00:00:00Z' },
      asset: { asset_name: 'A', visit_date_iso: '2024-01-01' },
      categories: {
        COMMUNICATIONS: {
          requires_service: true,
          time_to_impact_hours: 12,
          loss_fraction_no_backup: 0.4,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 24,
        },
      },
    };
    const rows = buildSummary(assessment);
    expect(rows[0].backup_duration_hours).toBeNull();
    expect(rows[0].capacity_after_backup_exhausted).toBeNull();
  });

  it('CRITICAL_PRODUCTS table-only: placeholder summary row', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: '2024-01-01T00:00:00Z' },
      asset: { asset_name: 'A', visit_date_iso: '2024-01-01' },
      categories: {
        CRITICAL_PRODUCTS: {
          critical_products: [
            { product_or_service: 'X', dependency_present: true, notes: null, single_source: true, alternate_supplier_identified: false, alternate_supplier_name: null, multi_source_currently_used: null },
          ],
        },
      },
    };
    const rows = buildSummary(assessment);
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('CRITICAL_PRODUCTS');
    expect(rows[0].requires_service).toBe(false);
    expect(rows[0].time_to_impact_hours).toBeNull();
    expect(rows[0].capacity_after_impact_no_backup).toBe(100);
    expect(rows[0].has_backup).toBe(false);
    expect(rows[0].recovery_time_hours).toBeNull();
  });

  it('sla and pra: non-CP row has sla/pra from agreements; CRITICAL_PRODUCTS has null', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: '2024-01-01T00:00:00Z' },
      asset: { asset_name: 'A', visit_date_iso: '2024-01-01' },
      categories: {
        ELECTRIC_POWER: {
          requires_service: true,
          time_to_impact_hours: 12,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 24,
          agreements: {
            has_sla: true,
            sla_hours: 48,
            has_pra: true,
            pra_category: 'TIER_2',
            pra_category_other: null,
          },
        },
        CRITICAL_PRODUCTS: {
          critical_products: [],
        },
      },
    };
    const rows = buildSummary(assessment);
    const electric = rows.find((r) => r.category === 'ELECTRIC_POWER');
    const cp = rows.find((r) => r.category === 'CRITICAL_PRODUCTS');
    expect(electric?.sla).toBe('Yes (48h)');
    expect(electric?.pra).toBe('Yes (TIER_2)');
    expect(cp?.sla).toBeNull();
    expect(cp?.pra).toBeNull();
  });

  it('missing tti and recovery: returns null so report can show N/A', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: '2024-01-01T00:00:00Z' },
      asset: { asset_name: 'A', visit_date_iso: '2024-01-01' },
      categories: {
        ELECTRIC_POWER: {
          requires_service: true,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
        },
      },
    };
    const rows = buildSummary(assessment);
    expect(rows).toHaveLength(1);
    expect(rows[0].time_to_impact_hours).toBeNull();
    expect(rows[0].recovery_time_hours).toBeNull();
  });

  it('multiple categories: one row per category', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: '2024-01-01T00:00:00Z' },
      asset: { asset_name: 'A', visit_date_iso: '2024-01-01' },
      categories: {
        ELECTRIC_POWER: {
          requires_service: true,
          time_to_impact_hours: 0,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 48,
        },
        WATER: {
          requires_service: true,
          time_to_impact_hours: 24,
          loss_fraction_no_backup: 0.2,
          has_backup: true,
          backup_duration_hours: 12,
          loss_fraction_with_backup: 0.1,
          recovery_time_hours: 24,
        },
      },
    };
    const rows = buildSummary(assessment);
    expect(rows).toHaveLength(2);
    const codes = rows.map((r) => r.category).sort();
    expect(codes).toEqual(['ELECTRIC_POWER', 'WATER']);
  });
});
