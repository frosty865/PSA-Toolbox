import { describe, it, expect } from 'vitest';
import { migrateLegacyItSupplyToTransportResilience } from '../it_to_category_input';
import type { Supply } from 'schema';

describe('migrateLegacyItSupplyToTransportResilience', () => {
  it('returns undefined when supply is undefined', () => {
    expect(migrateLegacyItSupplyToTransportResilience(undefined)).toBeUndefined();
  });

  it('returns undefined when sources is empty', () => {
    expect(migrateLegacyItSupplyToTransportResilience({ has_alternate_source: false, sources: [] })).toBeUndefined();
  });

  it('maps one source to circuit_count ONE and physical_path_diversity unknown', () => {
    const supply: Supply = {
      has_alternate_source: false,
      sources: [
        {
          source_id: 's1',
          provider_name: 'Comcast',
          source_label: null,
          demarcation_lat: null,
          demarcation_lon: null,
          demarcation_description: null,
          independence: 'UNKNOWN',
          notes: null,
        },
      ],
    };
    const result = migrateLegacyItSupplyToTransportResilience(supply);
    expect(result).toBeDefined();
    expect(result?.circuit_count).toBe('ONE');
    expect(result?.carrier_diversity).toBe('UNKNOWN');
    expect(result?.physical_path_diversity).toEqual({ unknown: true });
    expect(result?.building_entry_diversity).toBe('UNKNOWN');
    expect(result?.upstream_pop_diversity).toBe('UNKNOWN');
  });

  it('maps two sources to circuit_count TWO', () => {
    const supply: Supply = {
      has_alternate_source: true,
      sources: [
        { source_id: 's1', provider_name: 'Comcast', source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, independence: 'DIFFERENT_LOOP_OR_PATH', notes: null },
        { source_id: 's2', provider_name: 'Verizon', source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, independence: 'DIFFERENT_LOOP_OR_PATH', notes: null },
      ],
    };
    const result = migrateLegacyItSupplyToTransportResilience(supply);
    expect(result?.circuit_count).toBe('TWO');
  });

  it('maps three or more sources to circuit_count THREE_PLUS', () => {
    const supply: Supply = {
      has_alternate_source: true,
      sources: [
        { source_id: 's1', provider_name: 'A', source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, independence: 'DIFFERENT_LOOP_OR_PATH', notes: null },
        { source_id: 's2', provider_name: 'B', source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, independence: 'DIFFERENT_LOOP_OR_PATH', notes: null },
        { source_id: 's3', provider_name: 'C', source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, independence: 'DIFFERENT_LOOP_OR_PATH', notes: null },
      ],
    };
    const result = migrateLegacyItSupplyToTransportResilience(supply);
    expect(result?.circuit_count).toBe('THREE_PLUS');
  });
});
