import { describe, it, expect } from 'vitest';
import {
  CANONICAL_DEPENDENCY,
  DEPENDENCY_ROLE_MAP,
  ALL_ROLE_KEYS,
  getRoleCoverage,
  getAllRoleCoverage,
  assertParityWithCanonical,
  type DependencyKey,
  type RoleKey,
} from '../dependency_role_map';

describe('dependency_role_map', () => {
  it('canonical dependency is energy', () => {
    expect(CANONICAL_DEPENDENCY).toBe('energy');
  });

  it('every dependency has all role keys', () => {
    const keys = Object.keys(DEPENDENCY_ROLE_MAP) as DependencyKey[];
    for (const dep of keys) {
      const mapping = DEPENDENCY_ROLE_MAP[dep];
      for (const role of ALL_ROLE_KEYS) {
        expect(mapping).toHaveProperty(role);
        expect(Array.isArray(mapping[role as RoleKey])).toBe(true);
      }
    }
  });

  it('energy has every role satisfied (non-empty qid arrays)', () => {
    const coverage = getRoleCoverage('energy');
    expect(coverage.missingRoles).toEqual([]);
    expect(coverage.rolesSatisfied).toBe(coverage.totalRoles);
    expect(coverage.totalRoles).toBe(ALL_ROLE_KEYS.length);
  });

  it('getAllRoleCoverage returns coverage for all dependencies', () => {
    const all = getAllRoleCoverage();
    const deps: DependencyKey[] = ['energy', 'communications', 'information_technology', 'water', 'wastewater'];
    for (const dep of deps) {
      expect(all[dep]).toBeDefined();
      expect(all[dep].dependency).toBe(dep);
      expect(all[dep].totalRoles).toBe(ALL_ROLE_KEYS.length);
    }
  });

  it('assertParityWithCanonical does not throw (all deps have same role shape as energy)', () => {
    expect(() => assertParityWithCanonical()).not.toThrow();
  });

  it('energy uses real question IDs (curve_* and E-*)', () => {
    const energy = DEPENDENCY_ROLE_MAP.energy;
    expect(energy.dependency_gate).toContain('curve_requires_service');
    expect(energy.time_to_impact_hours).toContain('curve_time_to_impact');
    expect(energy.provider_identified).toContain('curve_primary_provider');
    expect(energy.upstream_assets_enumerated).toContain('E-2');
    expect(energy.has_backup).toContain('E-8');
    expect(energy.contingency_plan_with_provider).toContain('E-11');
  });
});
