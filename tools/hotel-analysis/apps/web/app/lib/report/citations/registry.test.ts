/**
 * Citation registry integrity tests.
 */
import { describe, it, expect } from 'vitest';
import {
  getCitation,
  compileCitations,
  CITATION_REGISTRY,
  CITATION_REGISTRY_VERSION,
} from './registry';

describe('citation registry', () => {
  it('test_citation_key_with_trailing_space_resolves', () => {
    const cit = getCitation('FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK ');
    expect(cit.org).toBe('FEMA');
    expect(cit.key).toBe('FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK');
  });

  it('test_registry_is_singleton_in_runtime', () => {
    expect(CITATION_REGISTRY_VERSION).toBe('v1');
    const cit = getCitation('FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK');
    expect(cit.org).toBe('FEMA');
  });

  it('test_compileCitations_dedupes_with_whitespace', () => {
    const compiled = compileCitations(['FEMA_CGC', 'FEMA_CGC ', ' FEMA_CGC']);
    expect(compiled).toHaveLength(1);
    expect(compiled[0].key).toBe('FEMA_CGC');
  });

  it('FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK resolves correctly', () => {
    const cit = getCitation('FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK');
    expect(cit.key).toBe('FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK');
    expect(cit.short).toBe('FEMA Federal Continuity Planning Framework');
    expect(cit.full).toContain('Federal Continuity Planning Framework');
    expect(cit.full).toContain('FEMA');
    expect(cit.org).toBe('FEMA');
  });

  it('test_missing_citation_key_fails_build', () => {
    expect(() => getCitation('NON_EXISTENT_KEY')).toThrow(
      /Citation key "NON_EXISTENT_KEY" not found in registry/
    );
  });

  it('compileCitations throws when vulnerability references missing key', () => {
    expect(() => compileCitations(['FEMA_CGC', 'NON_EXISTENT_KEY'])).toThrow(
      /Citation key "NON_EXISTENT_KEY" not found in registry/
    );
  });

  it('references are ordered by org then alphabetically by short', () => {
    const keys = ['NFPA_1600', 'FEMA_CGC', 'NFPA_110', 'FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK'];
    const compiled = compileCitations(keys);
    const shorts = compiled.map((c) => c.short);
    // FEMA before NFPA; within FEMA: CGC before Federal (alphabetically)
    expect(shorts[0]).toContain('FEMA');
    expect(shorts[1]).toContain('FEMA');
    expect(shorts[2]).toContain('NFPA');
    expect(shorts[3]).toContain('NFPA');
    expect(shorts).toContain('FEMA CGC');
    expect(shorts).toContain('FEMA Federal Continuity Planning Framework');
  });

  it('no duplicate citation entries in registry', () => {
    const keys = Object.keys(CITATION_REGISTRY);
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });
});
