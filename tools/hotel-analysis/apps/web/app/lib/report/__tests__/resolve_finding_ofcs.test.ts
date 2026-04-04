import { describe, it, expect } from 'vitest';
import { resolveFindingOfcs } from '../resolve_finding_ofcs';
import { getStandardVulnerability } from '../standards/vofc_standard_registry';

describe('resolveFindingOfcs', () => {
  it('returns curated OFCs when inline ofcText is present (inline ignored as non-source-of-truth)', () => {
    const domainDerived = {
      themedFindings: [{ id: 'W_NO_ALTERNATE_SOURCE', title: 'No alternate', narrative: 'N', ofcText: 'Consider evaluating an alternate water source.' }],
      ofcs: [
        { id: 'OFC-W_Q8_1', text: 'Different OFC from list', vulnerability_id: 'W_NO_ALTERNATE_SOURCE' },
      ],
    };
    const finding = { id: 'W_NO_ALTERNATE_SOURCE', title: 'No alternate', ofcText: 'Consider evaluating an alternate water source.' };
    const result = resolveFindingOfcs(domainDerived, 'W_NO_ALTERNATE_SOURCE', finding);
    const expected = getStandardVulnerability('W_NO_ALTERNATE_SOURCE').ofcs.map((o) => o.text.trim());
    expect(result).toEqual(expected);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('returns curated OFCs when finding.ofcText is empty', () => {
    const domainDerived = {
      themedFindings: [{ id: 'IT_TRANSPORT_SINGLE_PATH', title: 'Single path', narrative: 'N' }],
      ofcs: [
        { id: 'o1', text: 'First OFC text.', vulnerability_id: 'IT_TRANSPORT_SINGLE_PATH' },
        { id: 'o2', text: 'Second OFC text.', vulnerability_id: 'IT_TRANSPORT_SINGLE_PATH' },
      ],
    };
    const finding = { id: 'IT_TRANSPORT_SINGLE_PATH', title: 'Single path', ofcText: '' };
    const result = resolveFindingOfcs(domainDerived, 'IT_TRANSPORT_SINGLE_PATH', finding);
    const expected = getStandardVulnerability('IT_TRANSPORT_SINGLE_PATH').ofcs.map((o) => o.text.trim());
    expect(result).toEqual(expected);
  });

  it('throws when vulnerability id is not curated', () => {
    const domainDerived = {
      themedFindings: [{ id: 'V1', title: 'V1', narrative: 'N' }],
      ofcs: [{ id: 'o1', text: 'Other vuln OFC', vulnerability_id: 'OTHER' }],
    };
    expect(() => resolveFindingOfcs(domainDerived, 'V1', { id: 'V1' })).toThrow(/Uncurated vulnerability rejected/);
  });

  it('throws when domainDerived is undefined and vulnerability is not curated', () => {
    expect(() => resolveFindingOfcs(undefined, 'V1', { id: 'V1', ofcText: '' })).toThrow(/Uncurated vulnerability rejected/);
  });

  it('does not parse bulleted inline OFC text; returns curated OFCs', () => {
    const finding = { id: 'IT_PROVIDER_CONCENTRATION', ofcText: '1. First action\n2. Second action' };
    const result = resolveFindingOfcs({ ofcs: [] }, 'IT_PROVIDER_CONCENTRATION', finding);
    const expected = getStandardVulnerability('IT_PROVIDER_CONCENTRATION').ofcs.map((o) => o.text.trim());
    expect(result).toEqual(expected);
  });
});
