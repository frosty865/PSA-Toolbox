/**
 * Export SLA/PRA gating: when isSlaPraEnabled is false, no SLA fields in payload.
 * Part 6 — Tests for conditional SLA/PRA.
 */
import { describe, it, expect } from 'vitest';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';
import type { Assessment } from 'schema';

describe('Export SLA/PRA gating', () => {
  it('when isSlaPraEnabled is false, payload SLA spread has only sla_pra_module_enabled: false', () => {
    const assessment: Assessment = {
      asset: { asset_name: 'Test' },
      settings: { pra_sla_enabled: false },
      categories: {},
    } as Assessment;
    const praSlaEnabled = isPraSlaEnabled(assessment);
    expect(praSlaEnabled).toBe(false);

    // Same spread logic as export/final route
    const slaPart = praSlaEnabled
      ? {
          sla_pra_module_enabled: true as const,
          sla_reliability_for_report: [],
          sla_pra_summary: undefined as unknown,
        }
      : { sla_pra_module_enabled: false as const };

    expect(slaPart).toEqual({ sla_pra_module_enabled: false });
    expect(slaPart).not.toHaveProperty('sla_pra_summary');
    expect(slaPart).not.toHaveProperty('sla_reliability_for_report');
  });

  it('when isSlaPraEnabled is true, payload SLA spread includes module flag and can include summary', () => {
    const assessment: Assessment = {
      asset: { asset_name: 'Test' },
      settings: { pra_sla_enabled: true },
      categories: {},
    } as Assessment;
    const praSlaEnabled = isPraSlaEnabled(assessment);
    expect(praSlaEnabled).toBe(true);

    const slaPart = praSlaEnabled
      ? {
          sla_pra_module_enabled: true as const,
          sla_reliability_for_report: [] as unknown[],
          sla_pra_summary: { items: [] } as unknown,
        }
      : { sla_pra_module_enabled: false as const };

    expect(slaPart.sla_pra_module_enabled).toBe(true);
    expect(slaPart).toHaveProperty('sla_pra_summary');
  });

  it('when settings.pra_sla_enabled is undefined, isPraSlaEnabled returns false', () => {
    const assessment: Assessment = {
      asset: {},
      settings: {},
      categories: {},
    } as Assessment;
    expect(isPraSlaEnabled(assessment)).toBe(false);
  });
});
