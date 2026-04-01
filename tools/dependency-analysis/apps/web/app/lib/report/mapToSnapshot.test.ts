/**
 * Tests for mapEngineToSnapshot - Driver Deduplication
 * 
 * Validates that:
 * - Duplicate drivers (same title) are deduplicated
 * - Risk Drivers Identified count matches deduplicated count
 * - Top Risk Drivers (n) label matches rendered list
 * - First occurrence is kept, subsequent duplicates dropped
 */

import { describe, it, expect } from 'vitest';
import { mapEngineToSnapshot } from './mapToSnapshot';

describe('mapEngineToSnapshot - Driver Deduplication', () => {
  it('should deduplicate drivers with same title', () => {
    const mockEngine = {
      meta: {
        org_name: 'Test Facility',
        generated_at: '2026-02-16T00:00:00Z',
      },
      executive: {
        key_risk_drivers: [
          {
            title: 'Limited Upstream Awareness',
            severity: 'HIGH',
            infrastructures: ['ELECTRIC_POWER'],
            narrative: 'First occurrence of upstream awareness issue.',
            _category: 'FOUNDATIONAL',
          },
          {
            title: 'Fast Time-to-Impact',
            severity: 'ELEVATED',
            infrastructures: ['COMMUNICATIONS'],
            narrative: 'Communications has fast time to impact.',
            _category: 'IMMEDIATE',
          },
          {
            title: 'Limited Upstream Awareness', // Duplicate - should be removed
            severity: 'HIGH',
            infrastructures: ['WATER'],
            narrative: 'Second occurrence (duplicate) should be dropped.',
            _category: 'FOUNDATIONAL',
          },
          {
            title: 'Single-Point Dependency',
            severity: 'MODERATE',
            infrastructures: ['WATER'],
            narrative: 'Water has single-point dependency.',
            _category: 'PROVIDER_CONCENTRATION',
          },
        ],
      },
      infrastructures: [],
      toggles: {
        pra_sla: false,
        cross_dependency: false,
      },
    };

    const snapshot = mapEngineToSnapshot(mockEngine);

    // Should have 3 unique drivers (4 input - 1 duplicate)
    expect(snapshot.top_drivers.length).toBe(3);

    // Verify titles are unique
    const titles = snapshot.top_drivers.map((d) => d.title);
    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toBe(titles.length);

    // Verify first occurrence is kept
    const upstreamDriver = snapshot.top_drivers.find((d) => d.title === 'Limited Upstream Awareness');
    expect(upstreamDriver).toBeDefined();
    expect(upstreamDriver?.consequence).toContain('First occurrence');

    // Verify all expected drivers are present
    expect(titles).toContain('Limited Upstream Awareness');
    expect(titles).toContain('Fast Time-to-Impact');
    expect(titles).toContain('Single-Point Dependency');
  });

  it('should preserve order of first occurrences', () => {
    const mockEngine = {
      meta: {
        org_name: 'Test Facility',
        generated_at: '2026-02-16T00:00:00Z',
      },
      executive: {
        key_risk_drivers: [
          { title: 'Driver A', severity: 'HIGH', infrastructures: [], narrative: '', _category: 'FOUNDATIONAL' },
          { title: 'Driver B', severity: 'ELEVATED', infrastructures: [], narrative: '', _category: 'IMMEDIATE' },
          { title: 'Driver A', severity: 'MODERATE', infrastructures: [], narrative: '', _category: 'FOUNDATIONAL' }, // Duplicate
          { title: 'Driver C', severity: 'ELEVATED', infrastructures: [], narrative: '', _category: 'CASCADING' },
        ],
      },
      infrastructures: [],
      toggles: {},
    };

    const snapshot = mapEngineToSnapshot(mockEngine);

    expect(snapshot.top_drivers.length).toBe(3);
    expect(snapshot.top_drivers[0].title).toBe('Driver A');
    expect(snapshot.top_drivers[1].title).toBe('Driver B');
    expect(snapshot.top_drivers[2].title).toBe('Driver C');
  });

  it('should handle empty driver list', () => {
    const mockEngine = {
      meta: {
        org_name: 'Test Facility',
        generated_at: '2026-02-16T00:00:00Z',
      },
      executive: {
        key_risk_drivers: [],
      },
      infrastructures: [],
      toggles: {},
    };

    const snapshot = mapEngineToSnapshot(mockEngine);

    expect(snapshot.top_drivers.length).toBe(0);
  });

  it('should handle all duplicate drivers', () => {
    const mockEngine = {
      meta: {
        org_name: 'Test Facility',
        generated_at: '2026-02-16T00:00:00Z',
      },
      executive: {
        key_risk_drivers: [
          { title: 'Driver A', severity: 'HIGH', infrastructures: [], narrative: 'First', _category: 'FOUNDATIONAL' },
          { title: 'Driver A', severity: 'ELEVATED', infrastructures: [], narrative: 'Second', _category: 'FOUNDATIONAL' },
          { title: 'Driver A', severity: 'MODERATE', infrastructures: [], narrative: 'Third', _category: 'FOUNDATIONAL' },
        ],
      },
      infrastructures: [],
      toggles: {},
    };

    const snapshot = mapEngineToSnapshot(mockEngine);

    expect(snapshot.top_drivers.length).toBe(1);
    expect(snapshot.top_drivers[0].title).toBe('Driver A');
    expect(snapshot.top_drivers[0].consequence).toContain('First'); // First occurrence kept
  });

  it('should respect slice limit of 6 after deduplication', () => {
    const mockEngine = {
      meta: {
        org_name: 'Test Facility',
        generated_at: '2026-02-16T00:00:00Z',
      },
      executive: {
        key_risk_drivers: [
          { title: 'Driver 1', severity: 'HIGH', infrastructures: [], narrative: '', _category: 'FOUNDATIONAL' },
          { title: 'Driver 2', severity: 'HIGH', infrastructures: [], narrative: '', _category: 'IMMEDIATE' },
          { title: 'Driver 3', severity: 'HIGH', infrastructures: [], narrative: '', _category: 'CASCADING' },
          { title: 'Driver 1', severity: 'HIGH', infrastructures: [], narrative: '', _category: 'FOUNDATIONAL' }, // Dup
          { title: 'Driver 4', severity: 'HIGH', infrastructures: [], narrative: '', _category: 'MITIGATION_LIMIT' },
          { title: 'Driver 5', severity: 'HIGH', infrastructures: [], narrative: '', _category: 'PROVIDER_CONCENTRATION' },
          { title: 'Driver 6', severity: 'HIGH', infrastructures: [], narrative: '', _category: 'RESTORATION_REALISM' },
          { title: 'Driver 7', severity: 'HIGH', infrastructures: [], narrative: '', _category: 'HABITABILITY' },
          { title: 'Driver 8', severity: 'HIGH', infrastructures: [], narrative: '', _category: 'FOUNDATIONAL' },
        ],
      },
      infrastructures: [],
      toggles: {},
    };

    const snapshot = mapEngineToSnapshot(mockEngine);

    // Should deduplicate first (9 input - 1 dup = 8), then slice to 6
    expect(snapshot.top_drivers.length).toBe(6);

    // Verify order preservation
    expect(snapshot.top_drivers[0].title).toBe('Driver 1');
    expect(snapshot.top_drivers[1].title).toBe('Driver 2');
    expect(snapshot.top_drivers[2].title).toBe('Driver 3');
    expect(snapshot.top_drivers[3].title).toBe('Driver 4');
    expect(snapshot.top_drivers[4].title).toBe('Driver 5');
    expect(snapshot.top_drivers[5].title).toBe('Driver 6');
  });

  it('derives non-NONE cascade severity from confirmed edges when cascade payload is missing', () => {
    const mockEngine = {
      meta: {
        org_name: 'Test Facility',
        generated_at: '2026-02-16T00:00:00Z',
      },
      executive: {
        key_risk_drivers: [],
        cross_dependency_overview: {
          confirmed_edges: [
            { from: 'ELECTRIC_POWER', to: 'COMMUNICATIONS', timing_sensitivity: 'IMMEDIATE' },
            { from: 'COMMUNICATIONS', to: 'INFORMATION_TECHNOLOGY', timing_sensitivity: 'SHORT_TERM' },
          ],
        },
      },
      infrastructures: [],
      toggles: {
        cross_dependency: true,
      },
    };

    const snapshot = mapEngineToSnapshot(mockEngine);

    expect(snapshot.cascade.enabled).toBe(true);
    expect(snapshot.cascade.severity).toBe('HIGH');
    expect(snapshot.cascade.statements[0]).not.toContain('No material cross-domain cascading exposure');
    expect(snapshot.cascade.primary_path).toBeDefined();
  });

  it('uses cross-dependency findings as cascade statements when explicit cascade statements are absent', () => {
    const mockEngine = {
      meta: {
        org_name: 'Test Facility',
        generated_at: '2026-02-16T00:00:00Z',
      },
      executive: {
        key_risk_drivers: [],
      },
      cross_dependency: {
        cascading_conditions: [
          {
            title: 'Downstream Cascading Path Confirmed',
            narrative: 'Confirmed dependency chain from recorded edges: Electric Power → Communications → Information Technology.',
          },
        ],
      },
      infrastructures: [],
      toggles: {
        cross_dependency: true,
      },
    };

    const snapshot = mapEngineToSnapshot(mockEngine);

    expect(snapshot.cascade.statements[0]).toContain('Confirmed dependency chain from recorded edges');
    expect(snapshot.cascade.severity === 'LOW' || snapshot.cascade.severity === 'MED' || snapshot.cascade.severity === 'HIGH').toBe(true);
  });

  it('prefers explicit cascade payload when provided', () => {
    const mockEngine = {
      meta: {
        org_name: 'Test Facility',
        generated_at: '2026-02-16T00:00:00Z',
      },
      executive: {
        key_risk_drivers: [],
        cross_dependency_overview: {
          confirmed_edges: [
            { from: 'ELECTRIC_POWER', to: 'COMMUNICATIONS', timing_sensitivity: 'IMMEDIATE' },
          ],
        },
      },
      cascade: {
        severity: 'MED',
        statements: ['Explicit cascade statement.'],
        primary_path: 'Explicit Path',
      },
      infrastructures: [],
      toggles: {
        cross_dependency: true,
      },
    };

    const snapshot = mapEngineToSnapshot(mockEngine);

    expect(snapshot.cascade.severity).toBe('MED');
    expect(snapshot.cascade.statements).toEqual(['Explicit cascade statement.']);
    expect(snapshot.cascade.primary_path).toBe('Explicit Path');
  });

  it('deduplicates cascade statements derived from cross-dependency findings', () => {
    const mockEngine = {
      meta: {
        org_name: 'Test Facility',
        generated_at: '2026-02-16T00:00:00Z',
      },
      cross_dependency: {
        cascading_conditions: [
          {
            title: 'Fast Cascading Dependency Confirmed',
            narrative: 'Electric Power → Communications is marked critical with immediate cascade timing.',
          },
          {
            title: 'Fast Cascading Dependency Confirmed',
            narrative: 'Electric Power → Communications is marked critical with immediate cascade timing.',
          },
        ],
      },
      infrastructures: [],
      toggles: {
        cross_dependency: true,
      },
    };

    const snapshot = mapEngineToSnapshot(mockEngine);

    expect(snapshot.cascade.statements).toHaveLength(1);
    expect(snapshot.cascade.statements[0]).toContain('Electric Power → Communications');
  });
});
