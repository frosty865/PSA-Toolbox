import { describe, it, expect } from 'vitest';
import { buildVulnerabilityReferences, vulnerabilityCitationIds } from './vuln_citation_map';

describe('vuln_citation_map', () => {
  it('supports legacy IT fallback alias', () => {
    const ids = vulnerabilityCitationIds('IT_FALLBACK_AVAILABILITY');
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('ISO_22301');
    expect(ids).toContain('NIST_CSF');
  });

  it('builds non-empty reference lines for legacy alias', () => {
    const refs = buildVulnerabilityReferences('IT_FALLBACK_AVAILABILITY');
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((r) => typeof r === 'string' && r.includes('http'))).toBe(true);
  });
});
