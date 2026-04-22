import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/platform/apiBase', () => ({
  getApiBase: () => 'https://local.example.test',
}));

vi.mock('@/lib/field/isFieldStaticMode', () => ({
  isFieldStaticMode: () => false,
}));

vi.mock('@/lib/field/apiFieldStatic', () => ({
  exportFinal: vi.fn(),
  exportDraft: vi.fn(),
  getTemplateCheck: vi.fn(),
  getVofcReady: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('exportFinal', () => {
  it('posts directly to the hosted export endpoint when a browser service URL is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORT_SERVICE_URL', 'https://railway.example.test/');

    const fetchMock = vi.fn(async (): Promise<Response> => {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { exportFinal } = await import('./api');
    await exportFinal({ categories: {} } as never, { timeoutMs: 1000 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit?];
    expect(url).toBe('https://railway.example.test/api/export/final');
  });
});
