#!/usr/bin/env npx tsx
/**
 * Reset stuck PROCESSING documents back to REGISTERED.
 * 
 * Documents stuck in PROCESSING state for more than the threshold are reset to REGISTERED
 * so they can be re-queued for processing.
 * 
 * Usage:
 *   npx tsx tools/corpus/reset_stuck_processing.ts [--threshold-hours=24] [--dry-run]
 * 
 * Default: Reset documents stuck for more than 24 hours
 */

import * as dotenv from 'dotenv';
import { getCorpusPool } from '../../app/lib/db/corpus_client';

dotenv.config({ path: '.local.env' });
dotenv.config({ path: '.env.local' });

interface Options {
  thresholdHours: number;
  dryRun: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const options: Options = {
    thresholdHours: 24,
    dryRun: false,
  };

  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--threshold-hours=')) {
      options.thresholdHours = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx tools/corpus/reset_stuck_processing.ts [options]

Options:
  --threshold-hours=N    Reset documents stuck for more than N hours (default: 24)
  --dry-run             Show what would be reset without actually resetting
  --help, -h            Show this help message

Examples:
  # Reset documents stuck for more than 24 hours (default)
  npx tsx tools/corpus/reset_stuck_processing.ts

  # Reset documents stuck for more than 1 hour
  npx tsx tools/corpus/reset_stuck_processing.ts --threshold-hours=1

  # Preview what would be reset
  npx tsx tools/corpus/reset_stuck_processing.ts --dry-run
`);
      process.exit(0);
    }
  }

  const pool = getCorpusPool();
  const client = await pool.connect();

  try {
    console.log(`[reset_stuck_processing] Checking for documents stuck in PROCESSING for more than ${options.thresholdHours} hours...`);

    // Find stuck documents
    // A document is "stuck" if:
    // 1. It's in PROCESSING state
    // 2. It has no processed_at timestamp (or it's old)
    // 3. It's been in PROCESSING for more than threshold hours
    const stuckQuery = `
      SELECT 
        cd.id,
        cd.processing_status,
        cd.chunk_count,
        cd.processed_at,
        cd.created_at,
        cd.last_error,
        COALESCE(cd.inferred_title, cd.file_stem, cd.original_filename) as doc_name,
        q.requested_at as queued_at,
        q.last_attempt_at,
        q.attempts,
        q.last_attempt_error
      FROM public.corpus_documents cd
      LEFT JOIN public.corpus_reprocess_queue q ON q.corpus_document_id = cd.id
      WHERE cd.processing_status = 'PROCESSING'
        AND (
          cd.processed_at IS NULL 
          OR cd.processed_at < now() - interval '${options.thresholdHours} hours'
        )
      ORDER BY COALESCE(q.requested_at, cd.created_at) ASC
    `;

    const { rows: stuckDocs } = await client.query(stuckQuery);

    if (stuckDocs.length === 0) {
      console.log('[reset_stuck_processing] ✓ No stuck documents found.');
      return;
    }

    console.log(`[reset_stuck_processing] Found ${stuckDocs.length} stuck document(s):\n`);

    // Show details
    for (const doc of stuckDocs) {
      const queuedAt = doc.queued_at ? new Date(doc.queued_at).toISOString() : 'N/A';
      const lastAttempt = doc.last_attempt_at ? new Date(doc.last_attempt_at).toISOString() : 'Never';
      const ageHours = doc.queued_at 
        ? Math.round((Date.now() - new Date(doc.queued_at).getTime()) / (1000 * 60 * 60) * 10) / 10
        : 'Unknown';

      console.log(`  ID: ${doc.id}`);
      console.log(`  Name: ${doc.doc_name || 'Unknown'}`);
      console.log(`  Chunk Count: ${doc.chunk_count}`);
      console.log(`  Queued At: ${queuedAt} (${ageHours} hours ago)`);
      console.log(`  Last Attempt: ${lastAttempt}`);
      console.log(`  Attempts: ${doc.attempts || 0}`);
      if (doc.last_attempt_error) {
        console.log(`  Last Error: ${doc.last_attempt_error.substring(0, 200)}...`);
      }
      console.log('');
    }

    if (options.dryRun) {
      console.log('[reset_stuck_processing] DRY RUN: Would reset these documents to REGISTERED.');
      console.log('[reset_stuck_processing] Run without --dry-run to actually reset them.');
      return;
    }

    // Reset stuck documents
    await client.query('BEGIN');

    const stuckIds = stuckDocs.map((d: any) => d.id);

    // Reset processing status to REGISTERED
    const resetResult = await client.query(
      `
      UPDATE public.corpus_documents
      SET processing_status = 'REGISTERED',
          last_error = CASE 
            WHEN last_error IS NULL THEN 'Reset from stuck PROCESSING state'
            ELSE last_error || '; Reset from stuck PROCESSING state'
          END
      WHERE id = ANY($1::uuid[])
        AND processing_status = 'PROCESSING'
      `,
      [stuckIds]
    );

    // Remove from queue (they'll be re-queued when process-registered is called)
    const queueResult = await client.query(
      `
      DELETE FROM public.corpus_reprocess_queue
      WHERE corpus_document_id = ANY($1::uuid[])
      `,
      [stuckIds]
    );

    await client.query('COMMIT');

    console.log(`[reset_stuck_processing] ✓ Reset ${resetResult.rowCount} document(s) to REGISTERED`);
    console.log(`[reset_stuck_processing] ✓ Removed ${queueResult.rowCount} item(s) from reprocess queue`);
    console.log(`[reset_stuck_processing] Run POST /api/admin/corpus/process-registered to re-queue them for processing.`);

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[reset_stuck_processing] Error:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error('[reset_stuck_processing] Fatal error:', error);
  process.exit(1);
});
