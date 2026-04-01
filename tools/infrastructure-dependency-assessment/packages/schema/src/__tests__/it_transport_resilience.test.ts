import { describe, it, expect } from 'vitest';
import {
  ItPhysicalPathDiversitySchema,
  ItTransportResilienceSchema,
  ItHostedResilienceEntrySchema,
  ItHostedResilienceSchema,
} from '../assessment';

describe('ItPhysicalPathDiversitySchema', () => {
  it('fails when no option is true', () => {
    expect(() => ItPhysicalPathDiversitySchema.parse({})).toThrow();
    expect(() => ItPhysicalPathDiversitySchema.parse({ same_conduit: false })).toThrow();
  });

  it('passes when at least one option is true', () => {
    expect(ItPhysicalPathDiversitySchema.parse({ unknown: true })).toEqual({ unknown: true });
    expect(ItPhysicalPathDiversitySchema.parse({ same_conduit: true })).toEqual({ same_conduit: true });
    expect(ItPhysicalPathDiversitySchema.parse({ separate_conduits: true, separate_street_approach: true })).toEqual({
      separate_conduits: true,
      separate_street_approach: true,
    });
  });
});

describe('ItTransportResilienceSchema', () => {
  it('accepts valid transport resilience and strips legacy failover', () => {
    const parsed = ItTransportResilienceSchema.parse({
      circuit_count: 'ONE',
      carrier_diversity: 'UNKNOWN',
      physical_path_diversity: { unknown: true },
      failover: 'NONE',
    });
    expect(parsed).toBeDefined();
    expect(parsed.circuit_count).toBe('ONE');
    expect((parsed as Record<string, unknown>).failover).toBeUndefined();
  });

  it('strips it_transport_failover on parse', () => {
    const parsed = ItTransportResilienceSchema.parse({
      circuit_count: 'TWO',
      it_transport_failover: 'AUTOMATIC',
    });
    expect(parsed.circuit_count).toBe('TWO');
    expect((parsed as Record<string, unknown>).it_transport_failover).toBeUndefined();
  });

  it('migrates building_entry_diversity SEPARATE_ENTRIES to transport_building_entry_diversity SEPARATE_ENTRY', () => {
    const parsed = ItTransportResilienceSchema.parse({
      circuit_count: 'TWO',
      building_entry_diversity: 'SEPARATE_ENTRIES',
    });
    expect(parsed.transport_building_entry_diversity).toBe('SEPARATE_ENTRY');
  });

  it('migrates circuit_count to transport_connection_count', () => {
    expect(ItTransportResilienceSchema.parse({ circuit_count: 'ONE' }).transport_connection_count).toBe(1);
    expect(ItTransportResilienceSchema.parse({ circuit_count: 'TWO' }).transport_connection_count).toBe(2);
    expect(ItTransportResilienceSchema.parse({ circuit_count: 'THREE_PLUS' }).transport_connection_count).toBe(3);
  });

  it('defaults transport_route_independence and transport_failover_mode to UNKNOWN when missing', () => {
    const parsed = ItTransportResilienceSchema.parse({ circuit_count: 'ONE' });
    expect(parsed.transport_route_independence).toBe('UNKNOWN');
    expect(parsed.transport_failover_mode).toBe('UNKNOWN');
  });
});

describe('ItHostedResilienceEntrySchema', () => {
  it('accepts empty entry and leaves survivability undefined (no default NONE)', () => {
    const parsed = ItHostedResilienceEntrySchema.parse({});
    expect(parsed).toMatchObject({});
    expect(parsed.survivability).toBeUndefined();
  });

  it('accepts explicit survivability and notes', () => {
    expect(
      ItHostedResilienceEntrySchema.parse({
        survivability: 'LOCAL_MIRROR_OR_CACHE',
        notes: 'Test',
      })
    ).toMatchObject({ survivability: 'LOCAL_MIRROR_OR_CACHE', notes: 'Test' });
  });

  it('migrates legacy 4-control + evidence to survivability', () => {
    const parsed = ItHostedResilienceEntrySchema.parse({
      geographically_redundant: true,
      local_mirror_or_offline_fallback: true,
      evidence: 'DOCUMENTED',
      notes: 'Test',
    });
    expect(parsed).toMatchObject({ survivability: 'LOCAL_MIRROR_OR_CACHE', notes: 'Test' });
  });

  it('migrates legacy keys to survivability (new enum)', () => {
    expect(ItHostedResilienceEntrySchema.parse({ no_documented_resilience: true })).toMatchObject({
      survivability: 'NO_CONTINUITY',
    });
    expect(ItHostedResilienceEntrySchema.parse({ multi_az: true, multi_region: true })).toMatchObject({
      survivability: 'NO_CONTINUITY',
    });
    expect(ItHostedResilienceEntrySchema.parse({ continuity_mechanism_in_place: true })).toMatchObject({
      survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER',
    });
  });

  it('migrates old enum NONE/MANUAL_FALLBACK/LOCAL_MIRROR to new', () => {
    expect(ItHostedResilienceEntrySchema.parse({ survivability: 'NONE' })).toMatchObject({
      survivability: 'NO_CONTINUITY',
    });
    expect(ItHostedResilienceEntrySchema.parse({ survivability: 'LOCAL_MIRROR' })).toMatchObject({
      survivability: 'LOCAL_MIRROR_OR_CACHE',
    });
    expect(ItHostedResilienceEntrySchema.parse({ survivability: 'MANUAL_FALLBACK' })).toMatchObject({
      survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER',
    });
  });
});

describe('ItHostedResilienceSchema', () => {
  it('accepts 4-state survivability and migrates legacy entries', () => {
    const parsed = ItHostedResilienceSchema.parse({
      aws: { survivability: 'LOCAL_MIRROR_OR_CACHE', notes: 'Weekly export' },
      gcp: { survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER' },
      legacy: { continuity_mechanism_in_place: true },
      old_mirror: { local_mirror_or_offline_fallback: true },
    });
    expect(parsed.aws).toMatchObject({ survivability: 'LOCAL_MIRROR_OR_CACHE', notes: 'Weekly export' });
    expect(parsed.gcp).toMatchObject({ survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER' });
    expect(parsed.legacy).toMatchObject({ survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER' });
    expect(parsed.old_mirror).toMatchObject({ survivability: 'LOCAL_MIRROR_OR_CACHE' });
  });

  it('leaves survivability undefined when entry is empty (no default NONE)', () => {
    const parsed = ItHostedResilienceSchema.parse({ empty: {} });
    expect(parsed.empty).toMatchObject({});
    expect(parsed.empty.survivability).toBeUndefined();
  });
});
