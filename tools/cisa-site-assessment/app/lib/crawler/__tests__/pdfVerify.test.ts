/**
 * Integration-style tests for pdfVerify with mocked fetch.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { verifyPdfUrl, verifyPdfBuffer } from '../pdfVerify';

const originalFetch = globalThis.fetch;

function mockResponse(overrides: Partial<Response>): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    body: null,
    text: () => Promise.resolve(''),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    json: () => Promise.resolve({}),
    url: '',
    clone: () => ({} as Response),
    type: 'basic',
    statusText: 'OK',
    redirected: false,
    ...overrides,
  } as Response;
}

describe('pdfVerify', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('verifyPdfBuffer accepts %PDF- signature', () => {
    assert.strictEqual(verifyPdfBuffer(Buffer.from('%PDF-1.4')), true);
    assert.strictEqual(verifyPdfBuffer(Buffer.from('%PDF-')), true);
  });

  it('verifyPdfBuffer rejects non-PDF buffer', () => {
    assert.strictEqual(verifyPdfBuffer(Buffer.from('<html>')), false);
    assert.strictEqual(verifyPdfBuffer(Buffer.from('PDF-')), false);
    assert.strictEqual(verifyPdfBuffer(Buffer.alloc(3)), false);
  });

  it('verifyPdfUrl returns HTML_MASQUERADE when Content-Type is text/html', async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        mockResponse({
          headers: new Headers({
            'content-type': 'text/html; charset=utf-8',
            'content-length': '1000',
          }),
        })
      );

    const result = await verifyPdfUrl('https://example.com/fake.pdf', {
      maxRedirects: 0,
      headTimeoutMs: 1000,
      rangeTimeoutMs: 1000,
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.rejectCode, 'HTML_MASQUERADE');
  });

  it('verifyPdfUrl returns ok when HEAD is pdf and range returns %PDF-', async () => {
    globalThis.fetch = (_url: string | URL | Request, init?: RequestInit) => {
      const method = (init?.method as string) || 'GET';
      if (method === 'HEAD') {
        return Promise.resolve(
          mockResponse({
            headers: new Headers({
              'content-type': 'application/pdf',
              'content-length': '60000',
            }),
          })
        );
      }
      return Promise.resolve(new Response('%PDF-1.4', {
        status: 206,
        statusText: 'Partial Content',
        headers: { 'content-type': 'application/pdf' },
      }));
    };

    const result = await verifyPdfUrl('https://cisa.gov/real.pdf', {
      maxRedirects: 0,
      headTimeoutMs: 1000,
      rangeTimeoutMs: 1000,
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.contentType, 'application/pdf');
    assert.strictEqual(result.contentLength, 60000);
  });
});
