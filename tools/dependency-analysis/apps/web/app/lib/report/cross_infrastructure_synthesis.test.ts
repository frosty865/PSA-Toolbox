/**
 * Cross-Infrastructure Synthesis – unit tests
 * Fixtures: OFF/no edges (2 paras + 2 bullets), ON/edges (3 paras + 3 bullets),
 * illusion of redundancy, shared corridor, TTI ties
 */

import { describe, it, expect } from 'vitest';
import { buildCrossInfrastructureSynthesis } from './cross_infrastructure_synthesis';
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

describe('buildCrossInfrastructureSynthesis', () => {
  it('OFF/no edges → 2 paragraphs + 2 bullets', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 35,
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
    const result = buildCrossInfrastructureSynthesis(summary, assessment(), false);
    expect(result.title).toBe('Cross-Infrastructure Synthesis');
    expect(result.paragraphs.length).toBe(2);
    expect(result.bullets.length).toBe(2);
    expect(result.paragraphs[0]).toContain('Electric Power');
    expect(result.paragraphs[0]).toContain('4');
    expect(result.bullets[0].label).toBe('Time to severe impact');
    expect(result.bullets[1].label).toBe('Functional loss');
  });

  it('ON/edges present → 3 paragraphs + 3 bullets, deterministic chain', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 35,
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
    const result = buildCrossInfrastructureSynthesis(summary, assm, true);
    expect(result.paragraphs.length).toBe(3);
    expect(result.bullets.length).toBe(3);
    expect(result.paragraphs[2]).toContain('Electric Power');
    expect(result.paragraphs[2]).toContain('Communications');
    expect(result.paragraphs[2]).toContain('pathway');
  });

  it('illusion of redundancy: ALT_PRESENT true but ALT_SUST < 12', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 35,
        has_backup: true,
        backup_duration_hours: 8,
        capacity_after_backup_exhausted: 90,
        recovery_time_hours: 12,
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
    const result = buildCrossInfrastructureSynthesis(summary, assm, true);
    expect(result.paragraphs[1]).toContain('Electric Power');
    expect(result.paragraphs[1]).toMatch(/overstated|short|alternate/);
    const redundancyBullet = result.bullets.find((b) => b.label === 'Alternate sustainment');
    expect(redundancyBullet).toBeTruthy();
    expect(redundancyBullet?.text).toContain('8');
  });

  it('shared corridor: COLOCATED true across sectors', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 35,
        has_backup: false,
        recovery_time_hours: 12,
        sources: 'Reported sources: 1',
      }),
      summaryRow('WATER', {
        requires_service: true,
        time_to_impact_hours: 8,
        capacity_after_impact_no_backup: 40,
        has_backup: false,
        recovery_time_hours: 24,
        sources: 'Reported sources: 1',
      }),
      summaryRow('COMMUNICATIONS'),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const assm = assessment({
      settings: { pra_sla_enabled: false, cross_dependency_enabled: true },
      categories: {
        ELECTRIC_POWER: { requires_service: true, 'E-4_service_connections': [{ shared_corridor_with_other_utilities: 'yes' }] },
        WATER: { requires_service: true, W_Q4_collocated_corridor: 'yes' },
      },
      cross_dependencies: {
        edges: [
          {
            from_category: 'ELECTRIC_POWER',
            to_category: 'WATER',
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
    const result = buildCrossInfrastructureSynthesis(summary, assm, true);
    expect(result.paragraphs[1]).toMatch(/single-point|corridor|co-located/);
    const sharedBullet = result.bullets.find((b) => b.label === 'Shared corridor');
    expect(sharedBullet).toBeTruthy();
  });

  it('ties: TTI and severity – fixed ordering (Power before Comms)', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 50,
        has_backup: false,
        recovery_time_hours: 12,
        sources: 'Reported sources: 1',
      }),
      summaryRow('COMMUNICATIONS', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 50,
        has_backup: false,
        recovery_time_hours: 12,
        sources: 'Reported sources: 1',
      }),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const result = buildCrossInfrastructureSynthesis(summary, assessment(), false);
    expect(result.paragraphs[0]).toContain('Electric Power');
    expect(result.bullets[0].text).toContain('Electric Power');
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
    const r1 = buildCrossInfrastructureSynthesis(summary, a, false);
    const r2 = buildCrossInfrastructureSynthesis(summary, a, false);
    expect(r1.paragraphs).toEqual(r2.paragraphs);
    expect(r1.bullets).toEqual(r2.bullets);
  });

  it('no SAFE, no cyber governance, no boilerplate', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 35,
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
    const result = buildCrossInfrastructureSynthesis(summary, assessment(), false);
    const fullText = result.paragraphs.join(' ') + result.bullets.map((b) => b.text).join(' ');
    expect(fullText).not.toContain('SAFE');
    expect(fullText).not.toMatch(/NIST|training|incident reporting|forum|policy|exercise/i);
    expect(fullText).not.toMatch(/infrastructure is the backbone/i);
  });

  it('empty/minimal data – graceful fallback', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER'),
      summaryRow('COMMUNICATIONS'),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const result = buildCrossInfrastructureSynthesis(summary, assessment(), false);
    expect(result.paragraphs.length).toBe(2);
    expect(result.paragraphs[0]).toMatch(/cannot be characterized|provided inputs|Not provided\./);
  });
});
