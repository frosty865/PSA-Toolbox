#!/usr/bin/env npx tsx
/**
 * Fix documents that failed with "Cannot resolve PDF path" errors.
 * 
 * This tool helps diagnose and optionally fix path resolution issues for failed documents.
 * 
 * Usage:
 *   npx tsx tools/corpus/fix_failed_paths.ts [--dry-run] [--fix]
 */

import * as dotenv from 'dotenv';
import { getCorpusPool } from '../../app/lib/db/corpus_client';

dotenv.config({ path: '.local.env' });
dotenv.config({ path: '.env.local' });

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fix = args.includes('--fix');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx tools/corpus/fix_failed_paths.ts [options]

Options:
  --dry-run    Show what would be fixed without making changes
  --fix        Actually reset failed documents with path errors (requires --dry-run to be omitted)
  --help, -h   Show this help message

Examples:
  # Preview documents with path errors
  npx tsx tools/corpus/fix_failed_paths.ts --dry-run

  # Reset failed documents with path errors so they can be re-queued
  npx tsx tools/corpus/fix_failed_paths.ts --fix
`);
    process.exit(0);
  }

  const pool = getCorpusPool();
  const client = await pool.connect();

  try {
    console.log('[fix_failed_paths] Finding documents with path resolution errors...\n');

    // Find failed documents with path errors
    const failedDocs = await client.query(`
      SELECT 
        cd.id,
        cd.processing_status,
        cd.last_error,
        cd.source_registry_id,
        COALESCE(cd.inferred_title, cd.file_stem, cd.original_filename) as doc_name,
        sr.source_key,
        sr.storage_relpath,
        sr.local_path,
        cd.canonical_path
      FROM public.corpus_documents cd
      LEFT JOIN public.source_registry sr ON sr.id = cd.source_registry_id
      WHERE cd.processing_status = 'FAILED'
        AND (
          cd.last_error LIKE '%Cannot resolve PDF path%'
          OR cd.last_error LIKE '%not found%'
          OR cd.last_error LIKE '%missing%'
        )
      ORDER BY cd.processed_at DESC NULLS LAST
    `);

    if (failedDocs.rows.length === 0) {
      console.log('[fix_failed_paths] ✓ No documents with path errors found.');
      return;
    }

    console.log(`[fix_failed_paths] Found ${failedDocs.rows.length} document(s) with path errors:\n`);

    // Analyze each document
    const toReset: string[] = [];
    const pathIssues: Array<{ id: string; issue: string }> = [];

    for (const doc of failedDocs.rows) {
      console.log(`  ID: ${doc.id}`);
      console.log(`  Name: ${doc.doc_name || 'Unknown'}`);
      console.log(`  Source Registry ID: ${doc.source_registry_id || 'NULL'}`);
      console.log(`  Source Key: ${doc.source_key || 'NULL'}`);
      console.log(`  Storage Relpath: ${doc.storage_relpath || 'NULL'}`);
      console.log(`  Local Path: ${doc.local_path || 'NULL'}`);
      console.log(`  Canonical Path: ${doc.canonical_path || 'NULL'}`);
      
      // Diagnose the issue
      let issue = '';
      if (!doc.source_registry_id) {
        issue = 'Missing source_registry_id';
      } else if (!doc.storage_relpath && !doc.local_path && !doc.canonical_path) {
        issue = 'No path information available';
      } else if (doc.storage_relpath && !doc.local_path && !doc.canonical_path) {
        issue = 'Has storage_relpath but no resolved path';
      } else {
        issue = 'Path exists but file may be missing';
      }
      
      console.log(`  Issue: ${issue}`);
      console.log(`  Error: ${(doc.last_error || '').substring(0, 200)}...`);
      console.log('');

      pathIssues.push({ id: doc.id, issue });
      
      // Only reset if we can't determine the path issue is fixable
      // Documents with missing source_registry_id should be investigated manually
      if (doc.source_registry_id && (doc.storage_relpath || doc.local_path || doc.canonical_path)) {
        toReset.push(doc.id);
      }
    }

    console.log(`\n[fix_failed_paths] Summary:`);
    console.log(`  Total with path errors: ${failedDocs.rows.length}`);
    console.log(`  Can be reset (have source_registry_id and some path): ${toReset.length}`);
    console.log(`  Need manual investigation: ${failedDocs.rows.length - toReset.length}`);

    if (toReset.length === 0) {
      console.log('\n[fix_failed_paths] No documents can be automatically reset.');
      console.log('[fix_failed_paths] All documents need manual investigation of source_registry paths.');
      return;
    }

    if (dryRun) {
      console.log(`\n[fix_failed_paths] DRY RUN: Would reset ${toReset.length} document(s) to REGISTERED.`);
      console.log('[fix_failed_paths] Run with --fix to actually reset them.');
      return;
    }

    if (!fix) {
      console.log(`\n[fix_failed_paths] Use --fix to reset these documents to REGISTERED.`);
      return;
    }

    // Reset documents
    await client.query('BEGIN');

    const resetResult = await client.query(
      `
      UPDATE public.corpus_documents
      SET processing_status = 'REGISTERED',
          last_error = CASE 
            WHEN last_error IS NULL THEN 'Reset from FAILED state - path may need investigation'
            ELSE last_error || '; Reset from FAILED state - path may need investigation'
          END
      WHERE id = ANY($1::uuid[])
        AND processing_status = 'FAILED'
      `,
      [toReset]
    );

    // Remove from queue if present
    const queueResult = await client.query(
      `
      DELETE FROM public.corpus_reprocess_queue
      WHERE corpus_document_id = ANY($1::uuid[])
      `,
      [toReset]
    );

    await client.query('COMMIT');

    console.log(`\n[fix_failed_paths] ✓ Reset ${resetResult.rowCount} document(s) to REGISTERED`);
    console.log(`[fix_failed_paths] ✓ Removed ${queueResult.rowCount} item(s) from reprocess queue`);
    console.log(`[fix_failed_paths] Note: These documents may still fail if the underlying path issue isn't fixed.`);
    console.log(`[fix_failed_paths] Investigate source_registry paths before re-queuing.`);

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[fix_failed_paths] Error:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error('[fix_failed_paths] Fatal error:', error);
  process.exit(1);
});
