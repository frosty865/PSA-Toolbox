#!/usr/bin/env npx tsx
/**
 * Verify file paths for documents with path resolution errors.
 * 
 * Checks if files exist at expected paths and optionally searches for them by SHA256.
 * 
 * Usage:
 *   npx tsx tools/corpus/verify_file_paths.ts [--search] [--update]
 */

import * as dotenv from 'dotenv';
import { getCorpusPool } from '../../app/lib/db/corpus_client';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.local.env' });
dotenv.config({ path: '.env.local' });

async function main() {
  const args = process.argv.slice(2);
  const search = args.includes('--search');
  const update = args.includes('--update');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx tools/corpus/verify_file_paths.ts [options]

Options:
  --search    Search for files by SHA256 in common locations (slow)
  --update    Update source_registry paths if files found (requires --search)
  --help, -h  Show this help message

Examples:
  # Check if files exist at expected paths
  npx tsx tools/corpus/verify_file_paths.ts

  # Search for missing files by SHA256
  npx tsx tools/corpus/verify_file_paths.ts --search

  # Search and update paths if found
  npx tsx tools/corpus/verify_file_paths.ts --search --update
`);
    process.exit(0);
  }

  const pool = getCorpusPool();
  const client = await pool.connect();

  try {
    console.log('[verify_file_paths] Checking file paths for documents with errors...\n');

    // Get CORPUS_SOURCES_ROOT
    const corpusRoot = process.env.CORPUS_SOURCES_ROOT || 'storage/corpus_sources';
    const corpusRootAbs = path.isAbsolute(corpusRoot) 
      ? corpusRoot 
      : path.resolve(process.cwd(), corpusRoot);

    console.log(`[verify_file_paths] CORPUS_SOURCES_ROOT: ${corpusRootAbs}\n`);

    // Find documents with path errors
    const failedDocs = await client.query(`
      SELECT 
        cd.id,
        cd.processing_status,
        cd.last_error,
        cd.source_registry_id,
        cd.canonical_path,
        COALESCE(cd.inferred_title, cd.file_stem, cd.original_filename) as doc_name,
        sr.source_key,
        sr.storage_relpath,
        sr.local_path,
        sr.doc_sha256
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
      console.log('[verify_file_paths] ✓ No documents with path errors found.');
      return;
    }

    console.log(`[verify_file_paths] Found ${failedDocs.rows.length} document(s) with path errors:\n`);

    const results: Array<{
      id: string;
      name: string;
      expectedPaths: string[];
      foundPath?: string;
      sha256?: string;
    }> = [];

    for (const doc of failedDocs.rows) {
      const expectedPaths: string[] = [];
      let foundPath: string | undefined;

      console.log(`  Document: ${doc.doc_name || 'Unknown'}`);
      console.log(`  ID: ${doc.id}`);

      // Check canonical_path
      if (doc.canonical_path) {
        const canonPath = path.isAbsolute(doc.canonical_path)
          ? doc.canonical_path
          : path.join(corpusRootAbs, doc.canonical_path);
        expectedPaths.push(canonPath);
        if (fs.existsSync(canonPath)) {
          foundPath = canonPath;
          console.log(`  ✓ Found at canonical_path: ${canonPath}`);
        } else {
          console.log(`  ✗ Missing at canonical_path: ${canonPath}`);
        }
      }

      // Check local_path
      if (doc.local_path && !foundPath) {
        expectedPaths.push(doc.local_path);
        if (fs.existsSync(doc.local_path)) {
          foundPath = doc.local_path;
          console.log(`  ✓ Found at local_path: ${doc.local_path}`);
        } else {
          console.log(`  ✗ Missing at local_path: ${doc.local_path}`);
        }
      }

      // Check storage_relpath
      if (doc.storage_relpath && !foundPath) {
        const relPath = path.join(corpusRootAbs, doc.storage_relpath);
        expectedPaths.push(relPath);
        if (fs.existsSync(relPath)) {
          foundPath = relPath;
          console.log(`  ✓ Found at storage_relpath: ${relPath}`);
        } else {
          console.log(`  ✗ Missing at storage_relpath: ${relPath}`);
        }
      }

      if (!foundPath) {
        console.log(`  ✗ File not found at any expected path`);
        if (doc.doc_sha256) {
          console.log(`  SHA256: ${doc.doc_sha256}`);
        }
      }

      console.log('');

      results.push({
        id: doc.id,
        name: doc.doc_name || 'Unknown',
        expectedPaths,
        foundPath,
        sha256: doc.doc_sha256,
      });
    }

    // Summary
    const found = results.filter(r => r.foundPath).length;
    const missing = results.filter(r => !r.foundPath).length;

    console.log(`\n[verify_file_paths] Summary:`);
    console.log(`  Total checked: ${results.length}`);
    console.log(`  Found: ${found}`);
    console.log(`  Missing: ${missing}`);

    if (missing > 0) {
      console.log(`\n[verify_file_paths] Missing Files Summary:`);
      console.log(`  ${missing} file(s) not found at expected paths\n`);
      
      // Common search locations to suggest
      const searchDirs = [
        corpusRootAbs,
        path.join(process.cwd(), 'data', 'incoming'),
        path.join(process.cwd(), 'data', 'download'),
        path.join(process.cwd(), 'storage'),
      ].filter(dir => fs.existsSync(dir));

      console.log(`  Suggested search locations:`);
      for (const dir of searchDirs) {
        console.log(`    - ${dir}`);
      }
      console.log('');

      if (search) {
        console.log(`[verify_file_paths] Note: Automated SHA256 search would be too slow.`);
        console.log(`[verify_file_paths] Manually check the directories above or use file search tools.\n`);
      }
    }

    // Update paths if requested
    if (update && search) {
      const toUpdate = results.filter(r => r.foundPath && !r.expectedPaths.includes(r.foundPath));
      
      if (toUpdate.length === 0) {
        console.log('[verify_file_paths] No paths need updating.');
        return;
      }

      console.log(`[verify_file_paths] Updating ${toUpdate.length} path(s)...\n`);

      await client.query('BEGIN');

      for (const result of toUpdate) {
        // Get source_registry_id
        const docInfo = await client.query(
          `SELECT source_registry_id FROM public.corpus_documents WHERE id = $1`,
          [result.id]
        );

        if (docInfo.rows.length > 0 && docInfo.rows[0].source_registry_id) {
          const srId = docInfo.rows[0].source_registry_id;
          
          // Determine if path is relative to corpus root
          const relPath = path.relative(corpusRootAbs, result.foundPath!);
          const isRelative = !path.isAbsolute(relPath) && !relPath.startsWith('..');

          if (isRelative) {
            // Update storage_relpath
            await client.query(
              `UPDATE public.source_registry SET storage_relpath = $1 WHERE id = $2`,
              [relPath.replace(/\\/g, '/'), srId]
            );
            console.log(`  ✓ Updated storage_relpath for ${result.name}: ${relPath}`);
          } else {
            // Update local_path
            await client.query(
              `UPDATE public.source_registry SET local_path = $1 WHERE id = $2`,
              [result.foundPath, srId]
            );
            console.log(`  ✓ Updated local_path for ${result.name}: ${result.foundPath}`);
          }
        }
      }

      await client.query('COMMIT');
      console.log(`\n[verify_file_paths] ✓ Updated ${toUpdate.length} path(s)`);
    }

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[verify_file_paths] Error:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function searchFileByHash(sha256: string, searchDirs: string[]): Promise<string | null> {
  console.log(`    Note: SHA256 search not implemented (would be too slow).`);
  console.log(`    Check these directories manually:`);
  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      console.log(`      - ${dir}`);
    }
  }
  return null;
}

main().catch((error) => {
  console.error('[verify_file_paths] Fatal error:', error);
  process.exit(1);
});
