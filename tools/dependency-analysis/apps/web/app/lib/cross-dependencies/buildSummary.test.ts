import { describe, it, expect } from 'vitest';
import type { Assessment } from 'schema';
import { buildCrossDependencySummary } from './buildSummary';

function makeAssessment(): Assessment {
  return {
    meta: {
      tool_version: 'test',
      template_version: 'test',
      created_at_iso: '2026-03-09T00:00:00Z',
    },
    asset: {
      asset_name: 'Test Facility',
      visit_date_iso: '2026-03-09',
    },
    categories: {
      ELECTRIC_POWER: { requires_service: true },
      COMMUNICATIONS: {
        requires_service: true,
        comm_voice_functions: ['DISPATCH_OPERATIONS'],
      },
      INFORMATION_TECHNOLOGY: {
        requires_service: true,
        'IT-2_upstream_assets': [{ service_id: 'm365' }],
        it_hosted_resilience: { m365: { survivability: 'NO_CONTINUITY' } },
      },
      WATER: { W_Q14_onsite_pumping: 'yes' },
      WASTEWATER: { WW_Q8_onsite_pumping: 'yes' },
      CRITICAL_PRODUCTS: {},
    },
    cross_dependencies: {
      edges: [
        {
          from_category: 'ELECTRIC_POWER',
          to_category: 'INFORMATION_TECHNOLOGY',
          purpose: 'primary_operations',
          criticality: 'critical',
          time_to_cascade_bucket: 'short',
          single_path: 'yes',
          confidence: 'confirmed',
          source: 'user',
        },
      ],
      derived: { circular_dependencies: [], common_mode_spof: [] },
    },
  } as unknown as Assessment;
}

describe('buildCrossDependencySummary', () => {
  it('includes downstream failure indicators in flags for export narrative payload', () => {
    const summary = buildCrossDependencySummary(makeAssessment());
    expect(summary).toBeTruthy();
    expect(summary?.flags.some((f) => f.includes('Information Technology downstream failures'))).toBe(true);
    expect(summary?.flags.some((f) => f.includes('Critical hosted services become unreachable'))).toBe(true);
  });

  it('does not inflate confirmed edge count when semantic duplicates exist', () => {
    const assessment = makeAssessment();
    const crossDependencies = assessment.cross_dependencies as {
      edges: Array<Record<string, unknown>>;
      derived: { circular_dependencies: unknown[]; common_mode_spof: unknown[] };
    };
    crossDependencies.edges.push({
      from_category: 'ELECTRIC_POWER',
      to_category: 'INFORMATION_TECHNOLOGY',
      purpose: 'primary_operations',
      criticality: 'critical',
      time_to_cascade_bucket: 'short',
      single_path: 'yes',
      confidence: 'confirmed',
      source: 'user',
    });

    const summary = buildCrossDependencySummary(assessment);
    expect(summary).toBeTruthy();
    expect(summary?.confirmed_count).toBe(1);
    expect(summary?.top_edges).toHaveLength(1);
  });
});
