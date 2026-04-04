/**
 * Priority Actions – unit tests
 *
 * Grouped by driver type; one action per category; sectors in paragraph. Cap 4–6.
 * 1) Returns 1–6 actions (no sector suffix in titles)
 * 2) No alternates anywhere -> at least one kind == "ALTERNATE_CAPABILITY_CREATION"
 * 3) All alternates > 48 hrs -> no kind == "SUSTAINMENT_EXTENSION"
 * 4) Cross-dependency ON with SRC -> includes kind == "CASCADE_MITIGATION"
 * 5) Determinism: same input twice -> deepEqual outputs
 * 6) No duplicate action kinds (one per driver category)
 * 7) No forbidden terms; no "— SectorName" in titles
 */

import { describe, it, expect } from 'vitest';
import { buildPriorityActions } from '../priority_actions';
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

function vm(summary: SummaryRow[], assm: Assessment, crossEnabled: boolean) {
  return { summary, assessment: assm, crossDependencyEnabled: crossEnabled };
}

const FORBIDDEN_TERMS = [
  'safe',
  'security assessment at first entry',
  'nist',
  'training',
  'incident',
  'policy',
  'exercise',
];

describe('buildPriorityActions', () => {
  it('returns between 1 and 6 actions with no sector suffix in titles', () => {
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
    const result = buildPriorityActions(vm(summary, assessment(), false));
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(6);
    for (const a of result) {
      expect(a.title).not.toMatch(/\s—\s/);
    }
  });

  it('no alternates anywhere -> at least one kind == ALTERNATE_CAPABILITY_CREATION', () => {
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
    const result = buildPriorityActions(vm(summary, assessment(), false));
    const altCap = result.find((a) => a.kind === 'ALTERNATE_CAPABILITY_CREATION');
    expect(altCap).toBeTruthy();
    expect(altCap?.text).toMatch(/Develop alternate capability|Electric Power/);
  });

  it('all alternates > 48 hrs -> no kind == SUSTAINMENT_EXTENSION', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 35,
        has_backup: true,
        backup_duration_hours: 72,
        capacity_after_backup_exhausted: 50,
        recovery_time_hours: 12,
        sources: 'Reported sources: 1',
      }),
      summaryRow('COMMUNICATIONS'),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const result = buildPriorityActions(vm(summary, assessment(), false));
    const sustainExt = result.find((a) => a.kind === 'SUSTAINMENT_EXTENSION');
    expect(sustainExt).toBeFalsy();
  });

  it('cross-dependency ON with SRC -> includes kind == CASCADE_MITIGATION', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 4,
        capacity_after_impact_no_backup: 35,
        has_backup: false,
        recovery_time_hours: 12,
        sources: 'Reported sources: 1',
      }),
      summaryRow('COMMUNICATIONS', {
        requires_service: true,
        time_to_impact_hours: 12,
        capacity_after_impact_no_backup: 25,
        has_backup: true,
        backup_duration_hours: 72,
        capacity_after_backup_exhausted: 10,
        recovery_time_hours: 8,
        sources: '2+ independent',
      }),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const assm = assessment({
      settings: { pra_sla_enabled: false, cross_dependency_enabled: true },
      categories: {
        COMMUNICATIONS: {
          requires_service: true,
          agreements: { has_sla: true, sla_hours: null, has_pra: false, pra_category: null, pra_category_other: null },
        },
      },
      cross_dependencies: {
        edges: [
          {
            from_category: 'COMMUNICATIONS',
            to_category: 'ELECTRIC_POWER',
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
    const result = buildPriorityActions(vm(summary, assm, true));
    const cascade = result.find((a) => a.kind === 'CASCADE_MITIGATION');
    expect(cascade).toBeTruthy();
    expect(cascade?.text).toMatch(/Communications|cascade/);
  });

  it('returns at most 6 actions with one per driver category', () => {
    const summary: SummaryRow[] = [
      summaryRow('ELECTRIC_POWER', {
        requires_service: true,
        time_to_impact_hours: 2,
        capacity_after_impact_no_backup: 20,
        has_backup: false,
        recovery_time_hours: 24,
        sources: 'Reported sources: 1',
      }),
      summaryRow('COMMUNICATIONS', {
        requires_service: true,
        time_to_impact_hours: 6,
        capacity_after_impact_no_backup: 30,
        has_backup: false,
        recovery_time_hours: 12,
        sources: 'Reported sources: 1',
      }),
      summaryRow('INFORMATION_TECHNOLOGY'),
      summaryRow('WATER'),
      summaryRow('WASTEWATER'),
      summaryRow('CRITICAL_PRODUCTS'),
    ];
    const result = buildPriorityActions(vm(summary, assessment(), false));
    expect(result.length).toBeLessThanOrEqual(6);
    const kinds = result.map((a) => a.kind);
    const uniqueKinds = new Set(kinds);
    expect(uniqueKinds.size).toBe(kinds.length);
  });

  it('determinism: same input twice -> deepEqual outputs', () => {
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
    const assm = assessment();
    const r1 = buildPriorityActions(vm(summary, assm, false));
    const r2 = buildPriorityActions(vm(summary, assm, false));
    expect(r1).toEqual(r2);
  });

  it('no duplicate action kinds (one per driver category)', () => {
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
    const result = buildPriorityActions(vm(summary, assessment(), false));
    const kinds = result.map((a) => a.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('no forbidden terms in any title/text', () => {
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
    const result = buildPriorityActions(vm(summary, assessment(), false));
    const allText = result.flatMap((a) => [a.title, a.text]).join(' ').toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      expect(allText).not.toContain(term);
    }
  });
});
