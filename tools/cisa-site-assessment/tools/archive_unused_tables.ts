/**
 * Archive Unused Tables with Data
 * 
 * This script moves unused tables that contain data to an archive schema.
 * This preserves historical data while cleaning up the public schema.
 * 
 * Usage:
 *   npx tsx tools/archive_unused_tables.ts
 */

import * as dotenv from 'dotenv';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Clean up environment variables
if (process.env.SUPABASE_RUNTIME_URL) {
  process.env.SUPABASE_RUNTIME_URL = process.env.SUPABASE_RUNTIME_URL.trim().replace(/^\\+|\/+$/, '');
}
if (process.env.SUPABASE_RUNTIME_DB_PASSWORD) {
  process.env.SUPABASE_RUNTIME_DB_PASSWORD = process.env.SUPABASE_RUNTIME_DB_PASSWORD.trim().replace(/^\\+|\/+$/, '');
}

// Unused/deprecated tables to move to archive (aligned with config/db_schema_status.json archive_candidates.RUNTIME)
const TABLES_TO_ARCHIVE = [
  'assessment_questions', 'assessment_templates', 'assessment_vulnerability_sectors',
  'baseline_questions', 'baseline_questions_legacy', 'baseline_responses',
  'canonical_disciplines', 'canonical_manifest', 'canonical_ofc_patterns',
  'canonical_question_no_map', 'canonical_question_templates', 'canonical_subtypes',
  'canonical_vulnerability_patterns', 'citation_bindings', 'citation_requests',
  'compliance_report', 'discipline_subtypes', 'document_subtype_relevance',
  'drift_scan', 'normalized_findings', 'normalized_ofcs', 'observed_vulnerabilities',
  'ofc_nomination_decisions', 'ofc_wipe_log', 'phase6_reviews', 'report_snapshots',
  'sector_metrics', 'subdiscipline_sector_filter', 'subsector_discipline_map',
  'subsector_discipline_weight_history', 'subsector_metrics',
  'technology_maturity_definitions', 'technology_maturity_lookup', 'user_profiles',
];

const ARCHIVE_SCHEMA = 'archive';

async function checkTableExists(pool: any, tableName: string, schema: string = 'public'): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) as exists
    `, [schema, tableName]);
    return result.rows[0]?.exists || false;
  } catch (error) {
    return false;
  }
}

async function getTableRowCount(pool: any, tableName: string, schema: string = 'public'): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${schema}.${tableName}`);
    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    return -1; // Error getting count
  }
}

async function checkSchemaExists(pool: any, schemaName: string): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata
        WHERE schema_name = $1
      ) as exists
    `, [schemaName]);
    return result.rows[0]?.exists || false;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('[INFO] Preparing to archive unused tables with data...\n');
  console.log(`[INFO] Tables to archive: ${TABLES_TO_ARCHIVE.length}\n`);

  const pool = await ensureRuntimePoolConnected();

  try {
    // Ensure archive schema exists
    console.log(`[INFO] Checking for ${ARCHIVE_SCHEMA} schema...`);
    const schemaExists = await checkSchemaExists(pool, ARCHIVE_SCHEMA);
    
    if (!schemaExists) {
      console.log(`[INFO] Creating ${ARCHIVE_SCHEMA} schema...`);
      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${ARCHIVE_SCHEMA}`);
      console.log(`[OK] Created ${ARCHIVE_SCHEMA} schema`);
    } else {
      console.log(`[OK] ${ARCHIVE_SCHEMA} schema already exists`);
    }

    // Pre-flight check: verify tables exist and have data
    console.log('\n[INFO] Verifying tables to archive...\n');
    const verificationResults: Array<{
      name: string;
      exists: boolean;
      rowCount: number;
      alreadyArchived: boolean;
      safeToArchive: boolean;
    }> = [];

    for (const tableName of TABLES_TO_ARCHIVE) {
      const exists = await checkTableExists(pool, tableName, 'public');
      const alreadyArchived = await checkTableExists(pool, tableName, ARCHIVE_SCHEMA);
      const rowCount = exists ? await getTableRowCount(pool, tableName, 'public') : 0;
      const safeToArchive = exists && rowCount > 0 && !alreadyArchived;

      verificationResults.push({
        name: tableName,
        exists,
        rowCount,
        alreadyArchived,
        safeToArchive,
      });

      if (alreadyArchived) {
        console.log(`⚠️  ${tableName}: already in archive schema (skipping)`);
      } else if (exists) {
        if (rowCount > 0) {
          console.log(`✓ ${tableName}: ${rowCount} rows (safe to archive)`);
        } else {
          console.log(`⚠️  ${tableName}: 0 rows (empty, consider dropping instead)`);
        }
      } else {
        console.log(`✗ ${tableName}: does not exist (skipping)`);
      }
    }

    // Get list of tables that are safe to archive
    const tablesToArchive = verificationResults.filter(r => r.safeToArchive);
    
    if (tablesToArchive.length === 0) {
      console.log('\n[INFO] No tables to archive (all either already archived, empty, or missing).');
      return;
    }

    console.log(`\n[INFO] Ready to archive ${tablesToArchive.length} table(s).`);
    console.log('[INFO] Tables will be moved to archive schema (data preserved).');
    console.log('[WARNING] Press Ctrl+C within 5 seconds to cancel...\n');

    // Give user a chance to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Archive tables in a transaction
    console.log('[INFO] Archiving tables...\n');
    
    await pool.query('BEGIN');

    try {
      for (const table of tablesToArchive) {
        console.log(`[INFO] Archiving ${table.name} (${table.rowCount} rows)...`);
        
        // Move table to archive schema
        await pool.query(`ALTER TABLE public.${table.name} SET SCHEMA ${ARCHIVE_SCHEMA}`);
        
        console.log(`[OK] Archived ${table.name} -> ${ARCHIVE_SCHEMA}.${table.name}`);
      }

      await pool.query('COMMIT');
      console.log('\n[OK] All tables archived successfully!');

      // Verify tables are archived
      console.log('\n[INFO] Verifying tables are archived...');
      let notArchived = 0;
      for (const table of tablesToArchive) {
        const inPublic = await checkTableExists(pool, table.name, 'public');
        const inArchive = await checkTableExists(pool, table.name, ARCHIVE_SCHEMA);
        
        if (inPublic) {
          console.log(`⚠️  ${table.name} still in public schema`);
          notArchived++;
        } else if (inArchive) {
          const rowCount = await getTableRowCount(pool, table.name, ARCHIVE_SCHEMA);
          console.log(`✓ ${table.name} archived (${rowCount} rows in ${ARCHIVE_SCHEMA})`);
        } else {
          console.log(`⚠️  ${table.name} not found in public or archive`);
          notArchived++;
        }
      }

      if (notArchived === 0) {
        console.log('\n[OK] Verification complete - all tables successfully archived.');
        console.log(`[INFO] Tables are now in ${ARCHIVE_SCHEMA} schema and can be dropped later if needed.`);
      } else {
        console.log(`\n[WARNING] ${notArchived} table(s) may not have been archived correctly. Check for errors above.`);
      }

    } catch (archiveError) {
      await pool.query('ROLLBACK');
      throw archiveError;
    }

  } catch (error) {
    console.error('[ERROR] Archive operation failed:', error);
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

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('[FATAL]', error);
    process.exit(1);
  });
}

export { main as archiveUnusedTables };
