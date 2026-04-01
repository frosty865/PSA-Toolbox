import { describe, it, expect } from 'vitest';
import { normalizeTransportPhysical } from '../normalize_transport_physical';
import type { Assessment } from 'schema';

function baseAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
    asset: { asset_name: 'Test', visit_date_iso: new Date().toISOString() },
    categories: {},
    ...overrides,
  } as Assessment;
}

describe('normalizeTransportPhysical', () => {
  it('returns assessment unchanged when no IT category', () => {
    const a = baseAssessment();
    expect(normalizeTransportPhysical(a)).toBe(a);
  });

  it('returns assessment unchanged when IT has no it_transport_resilience', () => {
    const a = baseAssessment({
      categories: {
        INFORMATION_TECHNOLOGY: { requires_service: true } as unknown as Assessment['categories']['INFORMATION_TECHNOLOGY'],
      } as Assessment['categories'],
    });
    expect(normalizeTransportPhysical(a)).toBe(a);
  });

  it('copies redundancy_activation.mode to transport_failover_mode when transport_failover_mode missing', () => {
    const a = baseAssessment({
      categories: {
        INFORMATION_TECHNOLOGY: {
          requires_service: true,
          redundancy_activation: { mode: 'MANUAL_ONSITE' },
          it_transport_resilience: { circuit_count: 'ONE' },
        } as unknown as Assessment['categories']['INFORMATION_TECHNOLOGY'],
      } as Assessment['categories'],
    });
    const out = normalizeTransportPhysical(a);
    const it = (out.categories as Record<string, unknown>).INFORMATION_TECHNOLOGY as Record<string, unknown>;
    const tr = it?.it_transport_resilience as Record<string, unknown>;
    expect(tr?.transport_failover_mode).toBe('MANUAL_ONSITE');
  });

  it('does not overwrite user-entered transport_failover_mode', () => {
    const a = baseAssessment({
      categories: {
        INFORMATION_TECHNOLOGY: {
          requires_service: true,
          redundancy_activation: { mode: 'MANUAL_ONSITE' },
          it_transport_resilience: { circuit_count: 'ONE', transport_failover_mode: 'AUTOMATIC' },
        } as unknown as Assessment['categories']['INFORMATION_TECHNOLOGY'],
      } as Assessment['categories'],
    });
    const out = normalizeTransportPhysical(a);
    const it = (out.categories as Record<string, unknown>).INFORMATION_TECHNOLOGY as Record<string, unknown>;
    const tr = it?.it_transport_resilience as Record<string, unknown>;
    expect(tr?.transport_failover_mode).toBe('AUTOMATIC');
  });

  it('sets transport_connection_count = 2 only when IT-3_multiple_connections explicitly yes and circuit_count not already set', () => {
    const a = baseAssessment({
      categories: {
        INFORMATION_TECHNOLOGY: {
          requires_service: true,
          'IT-3_multiple_connections': 'yes',
          it_transport_resilience: {}, // no circuit_count so normalizer can set from IT-3
        } as unknown as Assessment['categories']['INFORMATION_TECHNOLOGY'],
      } as Assessment['categories'],
    });
    const out = normalizeTransportPhysical(a);
    const it = (out.categories as Record<string, unknown>).INFORMATION_TECHNOLOGY as Record<string, unknown>;
    const tr = it?.it_transport_resilience as Record<string, unknown>;
    expect(tr?.transport_connection_count).toBe(2);
  });

  it('does not set transport_connection_count from provider count or when multiple_connections unknown', () => {
    const a = baseAssessment({
      categories: {
        INFORMATION_TECHNOLOGY: {
          requires_service: true,
          supply: { has_alternate_source: true, sources: [{ source_id: '1', provider_name: 'A', source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, independence: 'UNKNOWN', notes: null }, { source_id: '2', provider_name: 'B', source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, independence: 'UNKNOWN', notes: null }] },
          it_transport_resilience: {},
        } as unknown as Assessment['categories']['INFORMATION_TECHNOLOGY'],
      } as Assessment['categories'],
    });
    const out = normalizeTransportPhysical(a);
    const it = (out.categories as Record<string, unknown>).INFORMATION_TECHNOLOGY as Record<string, unknown>;
    const tr = it?.it_transport_resilience as Record<string, unknown>;
    expect(tr?.transport_connection_count).toBeUndefined();
  });
});
