#!/usr/bin/env npx tsx
/**
 * Consumes corpus_reprocess_queue: for each queued corpus_document_id, calls
 * reprocessCorpusDocumentById (corpus_ingest_pdf.py --reprocess-corpus-document-id).
 * On success, deletes from queue. On failure, updates queue and corpus_documents; does NOT delete.
 *
 * Run: npm run corpus:reprocess-worker
 * Env: CORPUS_DATABASE_URL, CORPUS_SOURCES_ROOT (optional). Load .local.env / .env.local.
 * REPROCESS_RUN_UNTIL_EMPTY: run until queue empty (default true).
 * REPROCESS_RECURSIVE_CHUNK=1: after queue is empty, sync chunk counts and re-queue zero-chunk docs; repeat until none left or 10 rounds (recursively chunk all zero-chunk docs in one run).
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'dotenv';
import { getCorpusPool } from '../../app/lib/db/corpus_client';
import { loadEnvLocal } from '../../app/lib/db/load_env_local';
import { reprocessCorpusDocumentById } from '../../app/lib/corpus/reprocess_document';
import {
  syncChunkCounts,
  queueZeroChunk,
  countZeroChunkWithSource,
} from '../../app/lib/corpus/sync_and_queue_zero_chunk';

const cwd = process.cwd();
if (existsSync(resolve(cwd, '.local.env'))) {
  const parsed = parse(readFileSync(resolve(cwd, '.local.env'), 'utf-8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (k === 'NODE_TLS_REJECT_UNAUTHORIZED') continue;
    if (process.env[k] === undefined) process.env[k] = v;
  }
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
}
loadEnvLocal(cwd);

const RECURSIVE_CHUNK_MAX_ROUNDS = 10;
const RECURSIVE_QUEUE_LIMIT = 500;

async function main() {
  const batchSize = Number(process.env.REPROCESS_BATCH_SIZE ?? 10);
  const runUntilEmpty = process.env.REPROCESS_RUN_UNTIL_EMPTY !== '0' && process.env.REPROCESS_RUN_UNTIL_EMPTY !== 'false';
  const recursiveChunk = process.env.REPROCESS_RECURSIVE_CHUNK === '1' || process.env.REPROCESS_RECURSIVE_CHUNK === 'true';
  const pool = getCorpusPool();
  let totalOk = 0;
  let totalFail = 0;
  let recursiveRound = 0;

  while (true) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `
        SELECT q.corpus_document_id
        FROM public.corpus_reprocess_queue q
        ORDER BY q.requested_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
        `,
        [batchSize]
      );

      if (rows.length === 0) {
        await client.query('COMMIT');

        if (recursiveChunk && recursiveRound < RECURSIVE_CHUNK_MAX_ROUNDS) {
          const { updated } = await syncChunkCounts(pool);
          if (updated > 0) console.log(`[reprocess_worker] recursive: sync updated ${updated} chunk_count(s)`);
          const remaining = await countZeroChunkWithSource(pool);
          if (remaining === 0) {
            if (recursiveRound > 0) console.log(`[reprocess_worker] recursive: no zero-chunk docs left`);
            break;
          }
          const { queued } = await queueZeroChunk(pool, RECURSIVE_QUEUE_LIMIT);
          if (queued === 0) break;
          recursiveRound++;
          console.log(`[reprocess_worker] recursive round ${recursiveRound}: queued ${queued} zero-chunk doc(s), continuing`);
          continue;
        }

        if (totalOk === 0 && totalFail === 0) console.log('[reprocess_worker] no work');
        else console.log(`[reprocess_worker] done. OK=${totalOk} FAIL=${totalFail}`);
        break;
      }

      for (const r of rows) {
        const id = r.corpus_document_id as string;
        await client.query(
          `UPDATE public.corpus_reprocess_queue SET last_attempt_at = now() WHERE corpus_document_id = $1`,
          [id]
        );

        try {
          await reprocessCorpusDocumentById(id);
          await client.query(`DELETE FROM public.corpus_reprocess_queue WHERE corpus_document_id = $1`, [id]);
          totalOk++;
          console.log(`[reprocess_worker] OK ${id}`);
        } catch (e) {
          const err = (e instanceof Error ? e.message : String(e)).slice(0, 500);
          await client.query(
            `UPDATE public.corpus_reprocess_queue SET last_attempt_error = $2, attempts = attempts + 1 WHERE corpus_document_id = $1`,
            [id, err]
          );
          await client.query(
            `UPDATE public.corpus_documents SET processing_status = 'FAILED', last_error = COALESCE(last_error, $2), processed_at = now() WHERE id = $1 AND chunk_count = 0`,
            [id, err]
          );
          totalFail++;
          console.warn(`[reprocess_worker] FAIL ${id}: ${err}`);
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(e);
      process.exit(1);
    } finally {
      client.release();
    }

    if (!runUntilEmpty) break;
  }
}

main();
