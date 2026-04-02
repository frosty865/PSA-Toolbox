#!/usr/bin/env npx tsx
/**
 * Diagnose reprocess queue and stuck documents.
 * 
 * Shows:
 * - Queue status (pending, in progress, failed)
 * - Stuck PROCESSING documents
 * - Recent processing activity
 * 
 * Usage:
 *   npx tsx tools/corpus/diagnose_reprocess_queue.ts
 */

import * as dotenv from 'dotenv';
import { getCorpusPool } from '../../app/lib/db/corpus_client';

dotenv.config({ path: '.local.env' });
dotenv.config({ path: '.env.local' });

async function main() {
  const pool = getCorpusPool();
  const client = await pool.connect();

  try {
    console.log('[diagnose_reprocess_queue] Gathering diagnostics...\n');

    // 1. Overall status counts
    const statusCounts = await client.query(`
      SELECT 
        processing_status,
        COUNT(*)::int as count,
        SUM(chunk_count)::int as total_chunks
      FROM public.corpus_documents
      GROUP BY processing_status
      ORDER BY processing_status
    `);

    console.log('📊 Document Status Summary:');
    for (const row of statusCounts.rows) {
      console.log(`  ${row.processing_status || 'NULL'}: ${row.count} documents (${row.total_chunks} total chunks)`);
    }
    console.log('');

    // 2. Queue status
    const queueStats = await client.query(`
      SELECT 
        COUNT(*)::int as total_queued,
        COUNT(*) FILTER (WHERE last_attempt_at IS NULL)::int as never_attempted,
        COUNT(*) FILTER (WHERE last_attempt_at < now() - interval '1 hour')::int as stale_attempts,
        COUNT(*) FILTER (WHERE attempts > 0)::int as has_attempts,
        MAX(attempts)::int as max_attempts,
        COUNT(*) FILTER (WHERE last_attempt_error IS NOT NULL)::int as has_errors
      FROM public.corpus_reprocess_queue
    `);

    const qs = queueStats.rows[0];
    console.log('📋 Reprocess Queue Status:');
    console.log(`  Total Queued: ${qs.total_queued}`);
    console.log(`  Never Attempted: ${qs.never_attempted}`);
    console.log(`  Stale Attempts (>1h old): ${qs.stale_attempts}`);
    console.log(`  Has Attempts: ${qs.has_attempts}`);
    console.log(`  Max Attempts: ${qs.max_attempts || 0}`);
    console.log(`  Has Errors: ${qs.has_errors}`);
    console.log('');

    // 3. Stuck PROCESSING documents
    const stuckDocs = await client.query(`
      SELECT 
        cd.id,
        cd.processing_status,
        cd.chunk_count,
        cd.created_at,
        cd.processed_at,
        cd.last_error,
        COALESCE(cd.inferred_title, cd.file_stem, cd.original_filename) as doc_name,
        q.requested_at as queued_at,
        q.last_attempt_at,
        q.attempts,
        q.last_attempt_error,
        EXTRACT(EPOCH FROM (now() - COALESCE(q.requested_at, cd.created_at))) / 3600 as age_hours
      FROM public.corpus_documents cd
      LEFT JOIN public.corpus_reprocess_queue q ON q.corpus_document_id = cd.id
      WHERE cd.processing_status = 'PROCESSING'
      ORDER BY COALESCE(q.requested_at, cd.created_at) ASC
      LIMIT 50
    `);

    console.log(`🔄 PROCESSING Documents (showing up to 50):`);
    if (stuckDocs.rows.length === 0) {
      console.log('  ✓ No documents in PROCESSING state');
    } else {
      for (const doc of stuckDocs.rows) {
        const ageHours = Math.round(Number(doc.age_hours) * 10) / 10;
        const lastAttempt = doc.last_attempt_at 
          ? new Date(doc.last_attempt_at).toISOString().replace('T', ' ').substring(0, 19)
          : 'Never';
        
        console.log(`  ${doc.id.substring(0, 8)}... | ${doc.doc_name || 'Unknown'}`);
        console.log(`    Age: ${ageHours}h | Attempts: ${doc.attempts || 0} | Last: ${lastAttempt}`);
        if (doc.last_attempt_error) {
          const errorPreview = doc.last_attempt_error.substring(0, 100);
          console.log(`    Error: ${errorPreview}${doc.last_attempt_error.length > 100 ? '...' : ''}`);
        }
      }
    }
    console.log('');

    // 4. Recent queue activity
    const recentActivity = await client.query(`
      SELECT 
        q.corpus_document_id,
        q.requested_at,
        q.last_attempt_at,
        q.attempts,
        q.last_attempt_error,
        cd.processing_status,
        COALESCE(cd.inferred_title, cd.file_stem, cd.original_filename) as doc_name
      FROM public.corpus_reprocess_queue q
      JOIN public.corpus_documents cd ON cd.id = q.corpus_document_id
      ORDER BY q.last_attempt_at DESC NULLS LAST, q.requested_at DESC
      LIMIT 20
    `);

    console.log('📈 Recent Queue Activity (last 20):');
    if (recentActivity.rows.length === 0) {
      console.log('  No recent activity');
    } else {
      for (const item of recentActivity.rows) {
        const requested = new Date(item.requested_at).toISOString().replace('T', ' ').substring(0, 19);
        const lastAttempt = item.last_attempt_at 
          ? new Date(item.last_attempt_at).toISOString().replace('T', ' ').substring(0, 19)
          : 'Never';
        
        console.log(`  ${item.corpus_document_id.substring(0, 8)}... | ${item.doc_name || 'Unknown'}`);
        console.log(`    Status: ${item.processing_status} | Queued: ${requested} | Last Attempt: ${lastAttempt} | Attempts: ${item.attempts || 0}`);
        if (item.last_attempt_error) {
          const errorPreview = item.last_attempt_error.substring(0, 80);
          console.log(`    Error: ${errorPreview}${item.last_attempt_error.length > 80 ? '...' : ''}`);
        }
      }
    }
    console.log('');

    // 5. Failed documents analysis
    const failedDocs = await client.query(`
      SELECT 
        cd.id,
        cd.processing_status,
        cd.chunk_count,
        cd.processed_at,
        cd.last_error,
        COALESCE(cd.inferred_title, cd.file_stem, cd.original_filename) as doc_name,
        q.requested_at as queued_at,
        q.last_attempt_at,
        q.attempts,
        q.last_attempt_error,
        EXTRACT(EPOCH FROM (now() - COALESCE(cd.processed_at, cd.created_at))) / 3600 as age_hours
      FROM public.corpus_documents cd
      LEFT JOIN public.corpus_reprocess_queue q ON q.corpus_document_id = cd.id
      WHERE cd.processing_status = 'FAILED'
      ORDER BY cd.processed_at DESC NULLS LAST, cd.created_at DESC
      LIMIT 30
    `);

    console.log(`❌ FAILED Documents (showing up to 30):`);
    if (failedDocs.rows.length === 0) {
      console.log('  ✓ No failed documents');
    } else {
      // Group errors by type
      const errorGroups: Record<string, number> = {};
      for (const doc of failedDocs.rows) {
        const error = doc.last_error || doc.last_attempt_error || 'Unknown error';
        // Extract error type (first line or key phrase)
        const errorType = error.split('\n')[0].substring(0, 100);
        errorGroups[errorType] = (errorGroups[errorType] || 0) + 1;
      }

      console.log(`\n  Error Summary (${failedDocs.rows.length} total failures):`);
      const sortedErrors = Object.entries(errorGroups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      for (const [errorType, count] of sortedErrors) {
        console.log(`    ${count}x: ${errorType}${errorType.length > 80 ? '...' : ''}`);
      }

      console.log(`\n  Recent Failures:`);
      for (const doc of failedDocs.rows.slice(0, 10)) {
        const ageHours = doc.processed_at 
          ? Math.round(Number(doc.age_hours) * 10) / 10
          : 'Unknown';
        const failedAt = doc.processed_at 
          ? new Date(doc.processed_at).toISOString().replace('T', ' ').substring(0, 19)
          : 'Unknown';
        
        console.log(`  ${doc.id.substring(0, 8)}... | ${doc.doc_name || 'Unknown'}`);
        console.log(`    Failed: ${failedAt} (${ageHours}h ago) | Attempts: ${doc.attempts || 0}`);
        const error = doc.last_error || doc.last_attempt_error || 'No error message';
        const errorPreview = error.substring(0, 150);
        console.log(`    Error: ${errorPreview}${error.length > 150 ? '...' : ''}`);
      }
    }
    console.log('');

    // 6. Recommendations
    console.log('💡 Recommendations:');
    
    if (stuckDocs.rows.length > 0) {
      const stuckCount = stuckDocs.rows.length;
      const oldStuck = stuckDocs.rows.filter((d: any) => Number(d.age_hours) > 24).length;
      
      if (oldStuck > 0) {
        console.log(`  ⚠️  ${oldStuck} document(s) stuck in PROCESSING for >24 hours`);
        console.log(`     Run: npx tsx tools/corpus/reset_stuck_processing.ts --threshold-hours=24`);
      }
      
      if (qs.stale_attempts > 0) {
        console.log(`  ⚠️  ${qs.stale_attempts} queue item(s) with stale attempts (>1h old)`);
        console.log(`     Worker may not be running or may have crashed`);
      }
    }
    
    if (qs.total_queued > 0 && qs.never_attempted === qs.total_queued) {
      console.log(`  ⚠️  ${qs.total_queued} item(s) in queue but never attempted`);
      console.log(`     Worker may not be running. Check if reprocess_worker is active.`);
    }
    
    if (qs.has_errors > 0) {
      console.log(`  ⚠️  ${qs.has_errors} queue item(s) have errors`);
      console.log(`     Review errors above and consider resetting failed items`);
    }
    
    if (failedDocs.rows.length > 0) {
      const recentFailures = failedDocs.rows.filter((d: any) => 
        d.processed_at && new Date(d.processed_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
      ).length;
      
      if (recentFailures > 0) {
        console.log(`  ⚠️  ${recentFailures} document(s) failed in the last 24 hours`);
        console.log(`     Review error patterns above to identify root cause`);
        console.log(`     Common issues: missing files, Python errors, timeout, database issues`);
      }
      
      // Check for common error patterns
      const timeoutErrors = failedDocs.rows.filter((d: any) => 
        (d.last_error || d.last_attempt_error || '').toLowerCase().includes('timeout')
      ).length;
      if (timeoutErrors > 0) {
        console.log(`  ⚠️  ${timeoutErrors} failure(s) appear to be timeout-related`);
        console.log(`     Consider increasing REPROCESS_TIMEOUT_MS or checking file sizes`);
      }
      
      const missingFileErrors = failedDocs.rows.filter((d: any) => 
        (d.last_error || d.last_attempt_error || '').toLowerCase().includes('not found') ||
        (d.last_error || d.last_attempt_error || '').toLowerCase().includes('missing')
      ).length;
      if (missingFileErrors > 0) {
        console.log(`  ⚠️  ${missingFileErrors} failure(s) appear to be missing file errors`);
        console.log(`     Check source_registry paths and file storage locations`);
      }
    }
    
    if (stuckDocs.rows.length === 0 && qs.total_queued === 0 && failedDocs.rows.length === 0) {
      console.log(`  ✓ No stuck documents, queue items, or failures found`);
    }

  } catch (error) {
    console.error('[diagnose_reprocess_queue] Error:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error('[diagnose_reprocess_queue] Fatal error:', error);
  process.exit(1);
});
