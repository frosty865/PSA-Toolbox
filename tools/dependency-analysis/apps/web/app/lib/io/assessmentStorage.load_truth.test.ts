import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { Assessment } from 'schema';
import { getDefaultAssessment } from '@/lib/default-assessment';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

function makeAssessmentWithItProvider(provider: string): Assessment {
  const base = getDefaultAssessment();
  const it = (base.categories.INFORMATION_TECHNOLOGY ?? {}) as Record<string, unknown>;
  base.categories.INFORMATION_TECHNOLOGY = {
    ...it,
    curve_primary_provider: provider,
    supply: {
      has_alternate_source: false,
      sources: [
        {
          source_id: 'it-source-1',
          provider_name: provider,
          source_label: null,
          demarcation_lat: null,
          demarcation_lon: null,
          demarcation_description: null,
          independence: 'UNKNOWN',
          notes: null,
        },
      ],
    },
  };
  return base;
}

describe('loadAssessmentFromLocal', () => {
  const mem = new MemoryStorage();

  beforeEach(() => {
    mem.clear();
    (globalThis as unknown as { window: unknown }).window = { localStorage: mem };
    (globalThis as unknown as { localStorage: unknown }).localStorage = mem;
    vi.resetModules();
  });

  it('keeps assessment truth when sessions conflict', async () => {
    const { buildProgressFileV2 } = await import('./progressFile');
    const { loadAssessmentFromLocal } = await import('./assessmentStorage');
    const { loadItSession } = await import('./it_storage');

    const assessment = makeAssessmentWithItProvider('Verizon');
    const progress = buildProgressFileV2(assessment, {
      INFORMATION_TECHNOLOGY: {
        answers: {
          curve_primary_provider: 'Comcast',
        },
        saved_at_iso: new Date().toISOString(),
      },
    });
    mem.setItem('asset-dependency-assessment', JSON.stringify(progress));

    const loaded = loadAssessmentFromLocal();
    expect(loaded).not.toBeNull();
    const loadedIt = (loaded!.categories.INFORMATION_TECHNOLOGY ?? {}) as Record<string, unknown>;
    expect(loadedIt.curve_primary_provider).toBe('Verizon');

    const itSession = loadItSession();
    expect((itSession?.answers as Record<string, unknown>)?.curve_primary_provider).toBe('Verizon');
  });
});
