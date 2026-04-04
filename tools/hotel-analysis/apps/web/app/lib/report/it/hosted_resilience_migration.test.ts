/**
 * Tests for hosted continuity: 4-state survivability migration and report formatting.
 */
import { describe, it, expect } from 'vitest';
import {
  migrateHostedResilienceEntry,
  formatHostedResilienceForReport,
} from './hosted_resilience_migration';

describe('migrateHostedResilienceEntry', () => {
  it('returns undefined survivability for empty (no default)', () => {
    expect(migrateHostedResilienceEntry(undefined)).toEqual({});
    expect(migrateHostedResilienceEntry({})).toEqual({});
  });

  it('passes through explicit new enum survivability', () => {
    expect(migrateHostedResilienceEntry({ survivability: 'NO_CONTINUITY' })).toEqual({
      survivability: 'NO_CONTINUITY',
    });
    expect(migrateHostedResilienceEntry({ survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER', notes: 'x' })).toEqual({
      survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER',
      notes: 'x',
    });
    expect(migrateHostedResilienceEntry({ survivability: 'LOCAL_MIRROR_OR_CACHE' })).toEqual({
      survivability: 'LOCAL_MIRROR_OR_CACHE',
    });
    expect(migrateHostedResilienceEntry({ survivability: 'UNKNOWN' })).toEqual({
      survivability: 'UNKNOWN',
    });
  });

  it('migrates old enum NONE/MANUAL_FALLBACK/LOCAL_MIRROR to new', () => {
    expect(migrateHostedResilienceEntry({ survivability: 'NONE' })).toEqual({
      survivability: 'NO_CONTINUITY',
    });
    expect(migrateHostedResilienceEntry({ survivability: 'MANUAL_FALLBACK' })).toEqual({
      survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER',
    });
    expect(migrateHostedResilienceEntry({ survivability: 'LOCAL_MIRROR' })).toEqual({
      survivability: 'LOCAL_MIRROR_OR_CACHE',
    });
  });

  it('migrates local_mirror_or_offline_fallback / local_data_export to LOCAL_MIRROR_OR_CACHE', () => {
    expect(migrateHostedResilienceEntry({ local_mirror_or_offline_fallback: true })).toEqual({
      survivability: 'LOCAL_MIRROR_OR_CACHE',
    });
    expect(migrateHostedResilienceEntry({ local_data_export: true })).toEqual({
      survivability: 'LOCAL_MIRROR_OR_CACHE',
    });
  });

  it('migrates continuity_mechanism / offline_fallback / origin_failover / multi_pop / secondary_dns to ALTERNATE_PLATFORM_OR_PROVIDER', () => {
    expect(migrateHostedResilienceEntry({ continuity_mechanism_in_place: true })).toEqual({
      survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER',
    });
    expect(migrateHostedResilienceEntry({ origin_failover: true })).toEqual({
      survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER',
    });
  });

  it('prefers LOCAL_MIRROR_OR_CACHE over ALTERNATE when both present', () => {
    expect(
      migrateHostedResilienceEntry({
        continuity_mechanism_in_place: true,
        local_mirror_or_offline_fallback: true,
      })
    ).toEqual({ survivability: 'LOCAL_MIRROR_OR_CACHE' });
  });

  it('preserves notes', () => {
    expect(migrateHostedResilienceEntry({ survivability: 'NO_CONTINUITY', notes: 'No alternate' })).toEqual({
      survivability: 'NO_CONTINUITY',
      notes: 'No alternate',
    });
  });
});

describe('formatHostedResilienceForReport', () => {
  it('returns Not assessed when survivability undefined', () => {
    expect(formatHostedResilienceForReport(undefined)).toBe('Not assessed');
    expect(formatHostedResilienceForReport({})).toBe('Not assessed');
  });

  it('returns continuity labels for each explicit state', () => {
    expect(formatHostedResilienceForReport({ survivability: 'NO_CONTINUITY' })).toBe('No continuity');
    expect(formatHostedResilienceForReport({ survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER' })).toBe(
      'Alternate platform/provider'
    );
    expect(formatHostedResilienceForReport({ survivability: 'LOCAL_MIRROR_OR_CACHE' })).toBe(
      'Local mirror/cache'
    );
    expect(formatHostedResilienceForReport({ survivability: 'UNKNOWN' })).toBe('Unknown');
  });

  it('migrates legacy entry and returns corresponding label', () => {
    expect(formatHostedResilienceForReport({ local_mirror_or_offline_fallback: true })).toBe(
      'Local mirror/cache'
    );
    expect(formatHostedResilienceForReport({ continuity_mechanism_in_place: true })).toBe(
      'Alternate platform/provider'
    );
  });
});
