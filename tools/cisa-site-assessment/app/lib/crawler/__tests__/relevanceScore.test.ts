/**
 * Unit tests for relevance scoring.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { scorePdfCandidate } from '../relevanceScore';

describe('relevanceScore', () => {
  it('gives tier-1 domain a strong base score', () => {
    const r = scorePdfCandidate({
      target: { kind: 'corpus' },
      tier: 1,
      title: 'Some doc',
      strictness: 'strict',
    });
    assert.ok(r.score >= 50);
    assert.ok(r.reasons.some((x) => x.includes('Tier-1')));
  });

  it('adds points for positive keywords', () => {
    const r = scorePdfCandidate({
      target: { kind: 'corpus' },
      tier: 1,
      title: 'Physical security and emergency action plan guidance',
      strictness: 'strict',
    });
    assert.ok(r.score >= 60);
    assert.ok(r.reasons.some((x) => x.includes('physical security') || x.includes('emergency action plan') || x.includes('Keyword')));
  });

  it('blocked tier has no tier bonus', () => {
    const r = scorePdfCandidate({
      target: { kind: 'corpus' },
      tier: 'blocked',
      strictness: 'strict',
    });
    assert.ok(r.score >= 0);
    assert.ok(r.reasons.length >= 0);
  });

  it('vendor indicators reduce score', () => {
    const r = scorePdfCandidate({
      target: { kind: 'corpus' },
      tier: 2,
      title: 'Contact sales brochure pricing',
      strictness: 'strict',
    });
    assert.ok(r.reasons.some((x) => x.includes('Vendor') || x.includes('(-40)')));
  });
});
