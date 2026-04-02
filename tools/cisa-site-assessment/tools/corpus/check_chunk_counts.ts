#!/usr/bin/env npx tsx
/**
 * Report corpus chunk counts: zero-chunk docs, queue size, total chunks.
 * Run from psa_rebuild: npx tsx tools/corpus/check_chunk_counts.ts
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'dotenv';
import { getCorpusPool } from '../../app/lib/db/corpus_client';
import { loadEnvLocal } from '../../app/lib/db/load_env_local';

const cwd = process.cwd();
if (existsSync(resolve(cwd, '.local.env'))) {
  const parsed = parse(readFileSync(resolve(cwd, '.local.env'), 'utf-8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (k === 'NODE_TLS_REJECT_UNAUTHORIZED') continue;
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvLocal(cwd);

async function main() {
  const pool = getCorpusPool();
  const [zeroChunk, queueSize, totalChunks, totalDocs] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM public.corpus_documents WHERE chunk_count = 0`),
    pool.query(`SELECT COUNT(*)::int AS n FROM public.corpus_reprocess_queue`),
    pool.query(`SELECT COUNT(*)::int AS n FROM public.document_chunks`),
    pool.query(`SELECT COUNT(*)::int AS n FROM public.corpus_documents`),
  ]);
  const zero = zeroChunk.rows[0]?.n ?? 0;
  const queue = queueSize.rows[0]?.n ?? 0;
  const chunks = totalChunks.rows[0]?.n ?? 0;
  const docs = totalDocs.rows[0]?.n ?? 0;
  console.log('Corpus chunk counts:');
  console.log('  corpus_documents (total):', docs);
  console.log('  corpus_documents (chunk_count = 0):', zero);
  console.log('  corpus_reprocess_queue:', queue);
  console.log('  document_chunks (total):', chunks);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
