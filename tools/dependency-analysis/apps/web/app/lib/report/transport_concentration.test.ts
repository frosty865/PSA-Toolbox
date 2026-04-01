import { describe, it, expect } from 'vitest';
import { describeTransportConcentration, getTransportConcentrationInput } from './transport_concentration';

describe('describeTransportConcentration', () => {
  it('returns "unknown" when connection_count null and both diversity + independence UNKNOWN', () => {
    expect(
      describeTransportConcentration({
        transport_connection_count: null,
        transport_building_entry_diversity: 'UNKNOWN',
        transport_route_independence: 'UNKNOWN',
      })
    ).toBe('Internet transport path diversity is unknown.');
  });

  it('connection_count=1: returns single-path concentration sentence', () => {
    expect(
      describeTransportConcentration({
        transport_connection_count: 1,
        transport_building_entry_diversity: 'UNKNOWN',
        transport_route_independence: 'UNKNOWN',
      })
    ).toBe('A single transport connection is present. Single-path dependency concentrates failure exposure.');
  });

  it('connection_count=2, entry SAME_ENTRY: flags concentrated exposure (cannot be ruled out)', () => {
    const out = describeTransportConcentration({
      transport_connection_count: 2,
      transport_building_entry_diversity: 'SAME_ENTRY',
      transport_route_independence: 'UNKNOWN',
    });
    expect(out).toContain('cannot be ruled out');
    expect(out).not.toBeNull();
  });

  it('connection_count=2, entry SEPARATE_ENTRY, independence CONFIRMED: no concentration sentence', () => {
    expect(
      describeTransportConcentration({
        transport_connection_count: 2,
        transport_building_entry_diversity: 'SEPARATE_ENTRY',
        transport_route_independence: 'CONFIRMED',
      })
    ).toBeNull();
  });

  it('connection_count=2, both UNKNOWN: cannot be ruled out and route unknown', () => {
    const out = describeTransportConcentration({
      transport_connection_count: 2,
      transport_building_entry_diversity: 'UNKNOWN',
      transport_route_independence: 'UNKNOWN',
    });
    expect(out).toContain('cannot be ruled out');
    expect(out).toContain('Route independence is unknown');
  });

  it('same conduit / same entry / same POP; route independence unknown: reflects known fields, not "not provided"', () => {
    const out = describeTransportConcentration({
      transport_connection_count: 2,
      transport_building_entry_diversity: 'SAME_ENTRY',
      transport_route_independence: 'UNKNOWN',
      physical_path_diversity: { same_conduit: true },
      upstream_pop_diversity: 'SAME_POP',
    });
    expect(out).toContain('Multiple transport connections are present.');
    expect(out).toContain('Same building entry.');
    expect(out).toContain('Same conduit.');
    expect(out).toContain('Same upstream POP.');
    expect(out).toContain('Route independence is unknown.');
    expect(out).toContain('Concentrated failure exposure cannot be ruled out.');
    expect(out).not.toContain('not provided in assessment input');
  });
});

describe('getTransportConcentrationInput', () => {
  it('maps legacy building_entry_diversity SEPARATE_ENTRIES to SEPARATE_ENTRY', () => {
    const input = getTransportConcentrationInput({
      it_transport_resilience: {
        transport_connection_count: 2,
        building_entry_diversity: 'SEPARATE_ENTRIES',
        transport_route_independence: 'CONFIRMED',
      },
    });
    expect(input.transport_building_entry_diversity).toBe('SEPARATE_ENTRY');
  });

  it('maps circuit_count ONE/TWO/THREE_PLUS to transport_connection_count when transport_connection_count absent', () => {
    expect(getTransportConcentrationInput({
      it_transport_resilience: { circuit_count: 'ONE' },
    }).transport_connection_count).toBe(1);
    expect(getTransportConcentrationInput({
      it_transport_resilience: { circuit_count: 'TWO' },
    }).transport_connection_count).toBe(2);
    expect(getTransportConcentrationInput({
      it_transport_resilience: { circuit_count: 'THREE_PLUS' },
    }).transport_connection_count).toBe(3);
  });

  it('end-to-end: circuit_count=TWO, same entry/POP/conduit, route UNKNOWN yields narrative with known fields', () => {
    const input = getTransportConcentrationInput({
      it_transport_resilience: {
        circuit_count: 'TWO',
        building_entry_diversity: 'SAME_ENTRY',
        physical_path_diversity: { same_conduit: true },
        upstream_pop_diversity: 'SAME_POP',
        transport_route_independence: 'UNKNOWN',
      },
    });
    expect(input.transport_connection_count).toBe(2);
    expect(input.transport_building_entry_diversity).toBe('SAME_ENTRY');
    expect(input.physical_path_diversity?.same_conduit).toBe(true);
    expect(input.upstream_pop_diversity).toBe('SAME_POP');
    const narrative = describeTransportConcentration(input);
    expect(narrative).toContain('Same building entry.');
    expect(narrative).toContain('Same conduit.');
    expect(narrative).toContain('Same upstream POP.');
    expect(narrative).toContain('Route independence is unknown.');
    expect(narrative).not.toContain('not provided in assessment input');
  });
});
