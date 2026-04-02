/**
 * Unit tests for domain trust classification.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyDomain, getHostFromUrl } from '../domainTrust';

describe('domainTrust', () => {
  it('classifies .gov as tier 1', () => {
    const r = classifyDomain('cisa.dhs.gov');
    assert.strictEqual(r.tier, 1);
    assert.ok(r.reasons.some((x) => x.includes('Tier-1')));
  });

  it('classifies .mil as tier 1', () => {
    const r = classifyDomain('www.defense.mil');
    assert.strictEqual(r.tier, 1);
  });

  it('classifies nist.gov as tier 1', () => {
    const r = classifyDomain('nist.gov');
    assert.strictEqual(r.tier, 1);
  });

  it('classifies unknown domain as unknown', () => {
    const r = classifyDomain('random-vendor.com');
    assert.strictEqual(r.tier, 'unknown');
    assert.ok(r.reasons.some((x) => x.includes('allowlist')));
  });

  it('getHostFromUrl extracts hostname', () => {
    assert.strictEqual(getHostFromUrl('https://cisa.gov/path/file.pdf'), 'cisa.gov');
    assert.strictEqual(getHostFromUrl('https://sub.example.com:443/x'), 'sub.example.com');
  });
});
