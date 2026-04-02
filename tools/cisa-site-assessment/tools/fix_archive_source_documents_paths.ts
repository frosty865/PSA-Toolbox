/**
 * Fix broken location references in archive_source_documents
 * 
 * Sets source_path and pdf_path to NULL for all rows with paths pointing to
 * D:\psa-workspace which no longer exists.
 */

import * as dotenv from 'dotenv';
import { getRuntimePool } from '../app/lib/db/runtime_client';

dotenv.config({ path: '.env.local' });

async function main() {
  console.log('[INFO] Fixing broken location references in archive_source_documents...\n');

  const pool = getRuntimePool();

  try {
    // Check current state
    const before = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(source_path) as has_source_path,
        COUNT(pdf_path) as has_pdf_path
      FROM archive.archive_source_documents
    `);

    console.log('[INFO] Before:');
    console.log(`  Total rows: ${before.rows[0].total}`);
    console.log(`  Rows with source_path: ${before.rows[0].has_source_path}`);
    console.log(`  Rows with pdf_path: ${before.rows[0].has_pdf_path}\n`);

    // Update all rows that have paths starting with D:\psa-workspace or D:/psa-workspace
    // Use regex to match both forward and backslash variants
    const result = await pool.query(`
      UPDATE archive.archive_source_documents
      SET 
        source_path = CASE 
          WHEN source_path ~ '^D:[/\\\\]psa-workspace' THEN NULL 
          ELSE source_path 
        END,
        pdf_path = CASE 
          WHEN pdf_path ~ '^D:[/\\\\]psa-workspace' THEN NULL 
          ELSE pdf_path 
        END
      WHERE 
        source_path ~ '^D:[/\\\\]psa-workspace'
        OR pdf_path ~ '^D:[/\\\\]psa-workspace'
    `);

    const updatedCount = result.rowCount || 0;
    console.log(`[INFO] Updated ${updatedCount} rows\n`);

    // Check after state
    const after = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(source_path) as has_source_path,
        COUNT(pdf_path) as has_pdf_path
      FROM archive.archive_source_documents
    `);

    console.log('[INFO] After:');
    console.log(`  Total rows: ${after.rows[0].total}`);
    console.log(`  Rows with source_path: ${after.rows[0].has_source_path}`);
    console.log(`  Rows with pdf_path: ${after.rows[0].has_pdf_path}\n`);

    // Verify no broken paths remain
    const broken = await pool.query(`
      SELECT COUNT(*) as count
      FROM archive.archive_source_documents
      WHERE 
        (source_path ~ '^D:[/\\\\]psa-workspace' OR source_path IS NOT NULL)
        OR (pdf_path ~ '^D:[/\\\\]psa-workspace' OR pdf_path IS NOT NULL)
    `);

    if (parseInt(broken.rows[0].count, 10) === 0) {
      console.log('[OK] All broken paths have been cleaned up');
    } else {
      console.log(`[WARN] ${broken.rows[0].count} rows may still have broken paths`);
    }

  } catch (error) {
    console.error('[ERROR] Fix failed:', error);
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

export { main as fixArchiveSourceDocumentsPaths };
