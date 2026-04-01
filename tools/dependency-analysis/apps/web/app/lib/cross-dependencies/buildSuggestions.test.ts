import { describe, it, expect } from 'vitest';
import type { Assessment } from 'schema';
import {
  buildCrossDependencySuggestions,
  buildDownstreamFailureIndicators,
} from './buildSuggestions';

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
      COMMUNICATIONS: {},
      INFORMATION_TECHNOLOGY: {},
      WATER: {},
      WASTEWATER: {},
      CRITICAL_PRODUCTS: {},
    },
  } as unknown as Assessment;
}

describe('buildDownstreamFailureIndicators', () => {
  it('lists downstream failures for command/control, hosted services, and pumps', () => {
    const assessment = makeAssessment();
    const cats = assessment.categories as Record<string, Record<string, unknown>>;

    cats.COMMUNICATIONS = {
      requires_service: true,
      comm_voice_functions: ['DISPATCH_OPERATIONS', 'EMERGENCY_RESPONSE'],
    };
    cats.INFORMATION_TECHNOLOGY = {
      requires_service: true,
      'IT-2_upstream_assets': [
        { service_id: 'm365' },
        { service_id: 'other', service_other: 'Building Access SaaS' },
      ],
      it_hosted_resilience: {
        m365: { survivability: 'NO_CONTINUITY' },
      },
    };
    cats.WATER = {
      W_Q14_onsite_pumping: 'yes',
      W_Q15_backup_power_pumps: 'no',
    };
    cats.WASTEWATER = {
      WW_Q8_onsite_pumping: 'yes',
      WW_Q9_backup_power_pumps: 'no',
    };

    const indicators = buildDownstreamFailureIndicators(assessment);

    const comm = indicators.find((x) => x.category === 'COMMUNICATIONS');
    expect(comm).toBeDefined();
    expect(comm?.failures.join(' ')).toContain('dispatch operations');

    const it = indicators.find((x) => x.category === 'INFORMATION_TECHNOLOGY');
    expect(it).toBeDefined();
    expect(it?.failures.join(' ')).toContain('Critical hosted services become unreachable');
    expect(it?.failures.join(' ')).toContain('No continuity documented');

    const water = indicators.find((x) => x.category === 'WATER');
    expect(water).toBeDefined();
    expect(water?.failures.join(' ')).toContain('Water pumps/boosters');

    const wastewater = indicators.find((x) => x.category === 'WASTEWATER');
    expect(wastewater).toBeDefined();
    expect(wastewater?.failures.join(' ')).toContain('Wastewater lift/ejector pumps');
  });
});

describe('buildCrossDependencySuggestions', () => {
  it('injects downstream failure details into suggested edge reasoning', () => {
    const assessment = makeAssessment();
    const cats = assessment.categories as Record<string, Record<string, unknown>>;

    cats.INFORMATION_TECHNOLOGY = {
      requires_service: true,
      time_to_impact_hours: 4,
      'IT-2_upstream_assets': [{ service_id: 'm365' }],
      it_hosted_resilience: {
        m365: { survivability: 'NO_CONTINUITY' },
      },
      it_transport_resilience: {
        circuit_count: 'ONE',
      },
    };

    const suggestions = buildCrossDependencySuggestions(assessment, new Set());
    const powerToIt = suggestions.find(
      (s) => s.from_category === 'ELECTRIC_POWER' && s.to_category === 'INFORMATION_TECHNOLOGY'
    );

    expect(powerToIt).toBeDefined();
    expect(powerToIt?.reason.downstream_failures?.length).toBeGreaterThan(0);
    expect((powerToIt?.reason.downstream_failures ?? []).join(' ')).toContain('Critical hosted services become unreachable');
    expect(powerToIt?.reason.sources).toContain('INFORMATION_TECHNOLOGY.IT-2_upstream_assets');
  });
});

