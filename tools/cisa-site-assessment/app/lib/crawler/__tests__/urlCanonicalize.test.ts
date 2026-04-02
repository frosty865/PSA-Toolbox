/**
 * Unit tests for URL canonicalization.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { canonicalizeUrl, isHttpOrHttps } from '../urlCanonicalize';

describe('urlCanonicalize', () => {
  it('strips fragment', () => {
    const out = canonicalizeUrl('https://example.gov/doc.pdf#page=1');
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.ok && out.canonicalUrl, 'https://example.gov/doc.pdf');
  });

  it('strips tracking params (utm_*, source)', () => {
    const out = canonicalizeUrl('https://example.gov/doc.pdf?utm_source=foo&id=1');
    assert.strictEqual(out.ok, true);
    if (out.ok) {
      assert.strictEqual(out.canonicalUrl.includes('utm_source'), false);
      assert.strictEqual(out.canonicalUrl.includes('id=1'), true);
    }
  });

  it('lowercases host', () => {
    const out = canonicalizeUrl('https://CISA.GOV/guide.pdf');
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.ok && out.canonicalUrl, 'https://cisa.gov/guide.pdf');
  });

  it('preserves path and non-tracking params', () => {
    const out = canonicalizeUrl('https://example.gov/path/to/file.pdf?section=2');
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.ok && out.canonicalUrl, 'https://example.gov/path/to/file.pdf?section=2');
  });

  it('rejects non-http(s)', () => {
    const out = canonicalizeUrl('file:///local/doc.pdf');
    assert.strictEqual(out.ok, false);
    if (!out.ok) assert.ok(out.reason.length > 0);
  });

  it('isHttpOrHttps returns true for http and https', () => {
    assert.strictEqual(isHttpOrHttps('https://cisa.gov/x.pdf'), true);
    assert.strictEqual(isHttpOrHttps('http://example.com/y.pdf'), true);
  });

  it('isHttpOrHttps returns false for file and other protocols', () => {
    assert.strictEqual(isHttpOrHttps('file:///local/doc.pdf'), false);
    assert.strictEqual(isHttpOrHttps('ftp://host/file.pdf'), false);
  });
});
