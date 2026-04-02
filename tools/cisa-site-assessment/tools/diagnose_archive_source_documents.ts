/**
 * Diagnose archive_source_documents for broken location references
 * 
 * This script checks archive_source_documents for file paths that no longer exist
 * and reports broken references.
 */

import * as dotenv from 'dotenv';
import { getRuntimePool } from '../app/lib/db/runtime_client';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

dotenv.config({ path: '.env.local' });

interface ArchiveSourceDocument {
  id: string;
  file_path: string | null;
  local_path: string | null;
  canonical_path: string | null;
  source_id: string | null;
  title: string | null;
  [key: string]: any;
}

async function checkFileExists(filePath: string | null): Promise<boolean> {
  if (!filePath) return false;
  try {
    return existsSync(filePath);
  } catch {
    return false;
  }
}

async function main() {
  console.log('[INFO] Checking archive_source_documents for broken location references...\n');

  const pool = getRuntimePool();

  try {
    // First, get the table schema
    const schemaResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE (table_schema = 'archive' OR table_schema = 'public') AND table_name = 'archive_source_documents'
      ORDER BY ordinal_position
    `);

    if (schemaResult.rows.length === 0) {
      console.log('[WARN] archive_source_documents table does not exist');
      return;
    }

    console.log('[INFO] Table columns:');
    schemaResult.rows.forEach((r: any) => {
      console.log(`  - ${r.column_name} (${r.data_type})`);
    });
    console.log('');

    // Get all rows
    const allRows = await pool.query<ArchiveSourceDocument>(`
      SELECT * FROM archive.archive_source_documents
      ORDER BY id
    `);

    console.log(`[INFO] Total rows: ${allRows.rows.length}\n`);

    if (allRows.rows.length === 0) {
      console.log('[INFO] Table is empty - no broken references to check');
      return;
    }

    // Identify path columns (exclude filename - it's just metadata, not a file path)
    const pathColumns = schemaResult.rows
      .filter((r: any) => 
        (r.column_name.toLowerCase().includes('path') || 
         r.column_name.toLowerCase().includes('location'))
        && r.column_name.toLowerCase() !== 'filename'
      )
      .map((r: any) => r.column_name);

    console.log(`[INFO] Path-related columns found: ${pathColumns.join(', ') || 'none'}\n`);

    if (pathColumns.length === 0) {
      console.log('[WARN] No path columns found - cannot check for broken references');
      return;
    }

    // Check each row for broken paths
    const broken: Array<{
      id: string;
      title: string | null;
      brokenPaths: Array<{ column: string; path: string }>;
    }> = [];

    let checked = 0;
    for (const row of allRows.rows) {
      checked++;
      const brokenPaths: Array<{ column: string; path: string }> = [];

      for (const col of pathColumns) {
        const path = row[col];
        if (path && typeof path === 'string' && path.trim()) {
          const exists = await checkFileExists(path);
          if (!exists) {
            brokenPaths.push({ column: col, path });
          }
        }
      }

      if (brokenPaths.length > 0) {
        broken.push({
          id: row.id,
          title: row.title || null,
          brokenPaths,
        });
      }

      if (checked % 100 === 0) {
        console.log(`[INFO] Checked ${checked}/${allRows.rows.length} rows...`);
      }
    }

    console.log(`\n[INFO] Checked ${checked} rows\n`);

    // Report results
    if (broken.length === 0) {
      console.log('[OK] No broken location references found');
    } else {
      console.log(`[WARN] Found ${broken.length} rows with broken location references:\n`);
      
      for (const item of broken.slice(0, 20)) { // Show first 20
        console.log(`  ID: ${item.id}`);
        if (item.title) console.log(`  Title: ${item.title}`);
        item.brokenPaths.forEach(bp => {
          console.log(`    ✗ ${bp.column}: ${bp.path}`);
        });
        console.log('');
      }

      if (broken.length > 20) {
        console.log(`  ... and ${broken.length - 20} more rows with broken references\n`);
      }

      // Generate SQL to fix (set paths to NULL or update to new location)
      console.log('\n[INFO] Suggested SQL to fix (review before running):\n');
      console.log('-- Option 1: Set broken paths to NULL');
      for (const item of broken) {
        for (const bp of item.brokenPaths) {
          console.log(`UPDATE archive.archive_source_documents SET ${bp.column} = NULL WHERE id = '${item.id}';`);
        }
      }

      console.log('\n-- Option 2: If files moved, update paths (customize as needed)');
      console.log('-- Example:');
      console.log('-- UPDATE archive.archive_source_documents');
      console.log('-- SET file_path = REPLACE(file_path, \'old/path\', \'new/path\')');
      console.log('-- WHERE file_path LIKE \'old/path%\';');
    }

    // Summary by column
    if (broken.length > 0) {
      const byColumn: Record<string, number> = {};
      broken.forEach(item => {
        item.brokenPaths.forEach(bp => {
          byColumn[bp.column] = (byColumn[bp.column] || 0) + 1;
        });
      });

      console.log('\n[INFO] Broken references by column:');
      Object.entries(byColumn).forEach(([col, count]) => {
        console.log(`  ${col}: ${count} broken references`);
      });
    }

  } catch (error) {
    console.error('[ERROR] Diagnosis failed:', error);
    if (error instanceof Error) {
      console.error('[ERROR]', error.message);
      if (error.stack) {
        console.error('[ERROR]', error.stack);
      }
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[FATAL]', error);
    process.exit(1);
  });
}

export { main as diagnoseArchiveSourceDocuments };
