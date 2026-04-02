/**
 * Tests for assertSourceKeysExistInCorpus
 * 
 * These tests verify that citation source key validation:
 * - Blocks writes with missing source_keys
 * - Allows writes with valid source_keys
 * - Handles edge cases (empty arrays, duplicates, etc.)
 */

import { assertSourceKeysExistInCorpus } from '../validateSourceKeys';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

// Mock the corpus pool
jest.mock('@/app/lib/db/corpus_client', () => ({
  getCorpusPool: jest.fn()
}));

describe('assertSourceKeysExistInCorpus', () => {
  const mockPool = {
    query: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getCorpusPool as jest.Mock).mockReturnValue(mockPool);
  });

  it('should throw if source_keys array is empty', async () => {
    await expect(assertSourceKeysExistInCorpus([])).rejects.toThrow('No source_keys provided');
  });

  it('should throw if all source_keys are falsy', async () => {
    await expect(assertSourceKeysExistInCorpus(['', null as unknown as string, undefined as unknown as string])).rejects.toThrow('No valid source_keys provided');
  });

  it('should deduplicate source_keys before querying', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { source_key: 'KEY1' },
        { source_key: 'KEY2' }
      ]
    });

    await assertSourceKeysExistInCorpus(['KEY1', 'KEY2', 'KEY1', 'KEY2']);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    expect(mockPool.query).toHaveBeenCalledWith(
      `SELECT source_key FROM public.source_registry WHERE source_key = ANY($1::text[])`,
      [['KEY1', 'KEY2']]
    );
  });

  it('should throw 400 error with missing_keys if any source_key is missing', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { source_key: 'KEY1' }
      ]
    });

    try {
      await assertSourceKeysExistInCorpus(['KEY1', 'KEY2', 'KEY3']);
      fail('Should have thrown');
    } catch (error: unknown) {
      const err = error as { status?: number; missing_keys?: string[]; message?: string };
      expect(err.status).toBe(400);
      expect(err.missing_keys).toEqual(['KEY2', 'KEY3']);
      expect(err.message).toContain('KEY2');
      expect(err.message).toContain('KEY3');
    }
  });

  it('should succeed if all source_keys exist', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { source_key: 'KEY1' },
        { source_key: 'KEY2' },
        { source_key: 'KEY3' }
      ]
    });

    await expect(assertSourceKeysExistInCorpus(['KEY1', 'KEY2', 'KEY3'])).resolves.not.toThrow();
  });

  it('should query CORPUS database only', async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ source_key: 'KEY1' }]
    });

    await assertSourceKeysExistInCorpus(['KEY1']);

    expect(getCorpusPool).toHaveBeenCalledTimes(1);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('public.source_registry'),
      expect.any(Array)
    );
  });
});
