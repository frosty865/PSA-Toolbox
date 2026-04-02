import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import {
  syncChunkCounts,
  queueZeroChunk,
  countZeroChunkWithSource,
} from '@/app/lib/corpus/sync_and_queue_zero_chunk';

export const dynamic = 'force-dynamic';

const MAX_ROUNDS = 20;
const QUEUE_LIMIT_PER_ROUND = 500;

/**
 * Recursively sync chunk counts and queue zero-chunk CORPUS docs for reprocessing.
 * Use when many module/source documents show 0 chunks and you want to queue all of them
 * in one call (not just the first 500).
 *
 * Each round: (1) sync chunk_count from document_chunks where drift exists,
 * (2) queue up to QUEUE_LIMIT_PER_ROUND docs with chunk_count=0 and source_registry_id.
 * Repeats until no queueable zero-chunk docs remain or max rounds reached.
 * Then run the reprocess worker to actually chunk the queued documents.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const maxRounds = Math.min(
    Math.max(1, Number(url.searchParams.get('maxRounds')) || MAX_ROUNDS),
    50
  );

  const pool = getCorpusPool();
  let rounds = 0;
  let totalQueued = 0;
  let totalSyncUpdated = 0;
  let finalZeroChunkCount = 0;

  try {
    while (rounds < maxRounds) {
      rounds++;

      const { updated } = await syncChunkCounts(pool);
      totalSyncUpdated += updated;

      const remaining = await countZeroChunkWithSource(pool);
      if (remaining === 0) {
        finalZeroChunkCount = 0;
        break;
      }

      const { queued } = await queueZeroChunk(pool, QUEUE_LIMIT_PER_ROUND);
      totalQueued += queued;

      if (queued === 0) break;

      finalZeroChunkCount = await countZeroChunkWithSource(pool);
      if (finalZeroChunkCount === 0) break;
    }

    finalZeroChunkCount = await countZeroChunkWithSource(pool);

    return NextResponse.json({
      ok: true,
      rounds,
      total_queued: totalQueued,
      total_sync_updated: totalSyncUpdated,
      final_zero_chunk_count: finalZeroChunkCount,
      message:
        totalQueued > 0
          ? `Queued ${totalQueued} document(s) over ${rounds} round(s). Run the reprocess worker to chunk them.`
          : finalZeroChunkCount === 0
            ? 'No zero-chunk documents to queue (sync may have fixed drift).'
            : `No additional documents queued this run. ${finalZeroChunkCount} zero-chunk doc(s) may remain (check source_registry_id).`,
    });
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: err, rounds, total_queued: totalQueued },
      { status: 500 }
    );
  }
}
