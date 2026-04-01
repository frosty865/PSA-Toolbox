/**
 * Executive Snapshot Engine – unit tests
 * Fixtures: immediate failure, no alternates, strong redundancy + slow recovery, cross-dependency cascade
 */

import { describe, it, expect } from 'vitest';
import { buildExecutiveSnapshotContent } from './executive_snapshot_engine';
import type { SummaryRow } from 'engine';
import type { Assessment } from 'schema';

function summaryRow(
  category: SummaryRow['category'],
  overrides: Partial<SummaryRow> = {}
): SummaryRow {
  return {
    category,
    requires_service: false,
    time_to_impact_hours: 72,
    capacity_after_impact_no_backup: 100,
    has_backup: false,
    backup_duration_hours: null,
    capacity_after_backup_exhausted: null,
    recovery_time_hours: 0,
    sources: null,
    sla: null,
    pra: null,
    ...overrides,
  };
}

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  const settings = {
    pra_sla_enabled: false,
    cross_dependency_enabled: false,
    ...(overrides.settings ?? {}),
  };
  return {
    meta: { tool_version: '1', template_version: '1', created_at_iso: '2024-01-01T00:00:00Z' },
    asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
    categories: {},
    settings,
    ...overrides,
  };
}

describe('buildExecutiveSnapshotContent', () => {
  it('fixture 1: immediate failure (TTI=0)', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 0,
        capacity_after_impact_no_backup: 30,
        has_backup: false,
        backup_duration_hours: null,
        capacity_after_backup_exhausted: null,
        recovery_time_hours: 24,
        sources: 'Reported sources: 1',
        sla: 'No',
        pra: 'No',
      }),
      summaryRow('COMMUNICATIONS'),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const result = buildExecutiveSnapshotContent(summary, assessment(), false);
    expect(result.posture).toContain('Electric Power');
    expect(result.posture).toMatch(/0 hours?/);
    expect(result.posture).toMatch(/~70%|70%/);
    expect(result.drivers.length).toBeGreaterThanOrEqual(1);
    expect(result.matrixRows.length).toBeGreaterThan(0);
    expect(result.cascade).toBeNull();
  });

  it('fixture 2: no alternates present across all sectors', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 20,
        has_backup: false,
        recovery_time_hours: 12,
        sources: 'Reported sources: 1',
      }),
      summaryRow('COMMUNICATIONS', {
        requires_service: true,
        time_to_impact_hours: 8,
        capacity_after_impact_no_backup: 50,
        has_backup: false,
        recovery_time_hours: 24,
        sources: 'Reported sources: 1',
      }),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const result = buildExecutiveSnapshotContent(summary, assessment(), false);
    expect(result.summary).toContain('No alternate capability');
  });

  it('fixture 3: strong redundancy but slow recovery', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 24,
        capacity_after_impact_no_backup: 40,
        has_backup: true,
        backup_duration_hours: 48,
        capacity_after_backup_exhausted: 90,
        recovery_time_hours: 72,
        sources: '2+ (independent)',
        sla: 'Yes (24h)',
      }),
      summaryRow('COMMUNICATIONS'),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const result = buildExecutiveSnapshotContent(summary, assessment(), false);
    expect(result.posture).toMatch(/LOW|MODERATE/);
    expect(result.summary).toContain('recovery bottleneck');
    expect(result.matrixRows[0].structuralPosture).toContain('STRONG');
  });

  it('fixture 4: cross-dependency ON with edges – cascade paragraph deterministic', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 60,
        has_backup: false,
        recovery_time_hours: 24,
        sources: 'Reported sources: 1',
      }),
      summaryRow('COMMUNICATIONS'),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const assm = assessment({
      settings: { pra_sla_enabled: false, cross_dependency_enabled: true },
      cross_dependencies: {
        edges: [
          {
            from_category: 'ELECTRIC_POWER',
            to_category: 'COMMUNICATIONS',
            purpose: 'primary_operations',
            criticality: 'critical',
            time_to_cascade_bucket: 'immediate',
            single_path: 'yes',
            confidence: 'documented',
            source: 'user',
          } as const,
        ],
      },
    });
    const result = buildExecutiveSnapshotContent(summary, assm, true);
    expect(result.cascade).toBeTruthy();
    expect(result.cascade).toContain('Electric Power');
    expect(result.cascade).toContain('Communications');
    expect(result.cascade).toContain('disrupted');
  });

  it('deterministic: same inputs produce same output', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 65,
        has_backup: false,
        recovery_time_hours: 12,
        sources: 'Reported sources: 1',
      }),
      summaryRow('COMMUNICATIONS'),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const a = assessment();
    const r1 = buildExecutiveSnapshotContent(summary, a, false);
    const r2 = buildExecutiveSnapshotContent(summary, a, false);
    expect(r1.posture).toBe(r2.posture);
    expect(r1.summary).toBe(r2.summary);
    expect(r1.drivers).toEqual(r2.drivers);
  });

  it('cascade is null when cross-dependency disabled', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', { requires_service: true, time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 50, recovery_time_hours: 12 }),
      summaryRow('COMMUNICATIONS'),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const result = buildExecutiveSnapshotContent(summary, assessment(), false);
    expect(result.cascade).toBeNull();
  });

  it('never outputs "~0 hours" – uses "0 hours"', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 0,
        capacity_after_impact_no_backup: 80,
        recovery_time_hours: 0,
        sources: 'Reported sources: 1',
      }),
      summaryRow('COMMUNICATIONS'),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const result = buildExecutiveSnapshotContent(summary, assessment(), false);
    expect(result.posture).not.toContain('~0 hours');
    expect(result.posture).toMatch(/0 hours?/);
  });

  it('Provider Identified = transport only: upstream table has entries but transport missing => UNCONFIRMED', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER'),
      summaryRow('COMMUNICATIONS'),
      summaryRow('INFORMATION_TECHNOLOGY', { requires_service: true, sources: 'Reported sources: 1' }),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const assm = assessment({
      categories: {
        INFORMATION_TECHNOLOGY: {
          requires_service: true,
          'IT-2_upstream_assets': [{ service_id: 'aws', service_provider: 'AWS' }],
          'IT-1_can_identify_providers': 'no',
          supply: { has_alternate_source: false, sources: [] },
        },
      },
    });
    const result = buildExecutiveSnapshotContent(summary, assm, false);
    const itRow = result.matrixRows.find((r) => r.sector === 'Information Technology');
    expect(itRow).toBeDefined();
    expect(itRow!.structuralPosture).toContain('UNCONFIRMED');
  });
});

