/**
 * Drop Unused Empty Tables
 * 
 * This script drops empty tables that are confirmed unused in the codebase.
 * It verifies tables are empty before dropping them.
 * 
 * Usage:
 *   npx tsx tools/drop_unused_empty_tables.ts
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

// Tables to drop (confirmed empty and unused)
const TABLES_TO_DROP = [
  'compliance_report',  // Remaining empty unused table
];

async function checkTableExists(pool: any, tableName: string): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) as exists
    `, [tableName]);
    return result.rows[0]?.exists || false;
  } catch (error) {
    return false;
  }
}

async function checkViewExists(pool: any, viewName: string): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = $1
      ) as exists
    `, [viewName]);
    return result.rows[0]?.exists || false;
  } catch (error) {
    return false;
  }
}

async function getObjectType(pool: any, objectName: string): Promise<'table' | 'view' | 'none'> {
  const isTable = await checkTableExists(pool, objectName);
  if (isTable) return 'table';
  
  const isView = await checkViewExists(pool, objectName);
  if (isView) return 'view';
  
  return 'none';
}

async function getTableRowCount(pool: any, tableName: string): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM public.${tableName}`);
    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    return -1; // Error getting count
  }
}

async function main() {
  console.log('[INFO] Preparing to drop unused empty tables...\n');
  console.log(`[INFO] Tables to drop: ${TABLES_TO_DROP.length}\n`);

  const pool = await ensureRuntimePoolConnected();

  try {
    // Pre-flight check: verify all objects are empty
    console.log('[INFO] Verifying objects are empty...\n');
    const verificationResults: Array<{
      name: string;
      exists: boolean;
      objectType: 'table' | 'view' | 'none';
      rowCount: number;
      safeToDrop: boolean;
    }> = [];

    for (const objectName of TABLES_TO_DROP) {
      const objectType = await getObjectType(pool, objectName);
      const exists = objectType !== 'none';
      let rowCount = 0;
      
      if (exists && objectType === 'table') {
        try {
          rowCount = await getTableRowCount(pool, objectName);
        } catch (error) {
          // If we can't get row count, assume it's not safe to drop
          rowCount = -1;
        }
      }
      
      const safeToDrop = exists && (objectType === 'view' || (objectType === 'table' && rowCount === 0));

      verificationResults.push({
        name: objectName,
        exists,
        objectType: objectType as 'table' | 'view' | 'none',
        rowCount,
        safeToDrop,
      });

      if (exists) {
        if (objectType === 'view') {
          console.log(`✓ ${objectName}: view (safe to drop)`);
        } else if (rowCount === 0) {
          console.log(`✓ ${objectName}: 0 rows (safe to drop)`);
        } else if (rowCount > 0) {
          console.log(`⚠️  ${objectName}: ${rowCount} rows (NOT EMPTY - will skip)`);
        } else {
          console.log(`⚠️  ${objectName}: could not verify row count (will skip)`);
        }
      } else {
        console.log(`✗ ${objectName}: does not exist (already dropped)`);
      }
    }

    // Check if any tables have data
    const tablesWithData = verificationResults.filter(r => r.exists && r.objectType === 'table' && r.rowCount > 0);
    if (tablesWithData.length > 0) {
      console.error(`\n[ERROR] Found ${tablesWithData.length} table(s) with data. Aborting.`);
      console.error('[ERROR] Tables with data:');
      tablesWithData.forEach(r => {
        console.error(`  - ${r.name}: ${r.rowCount} rows`);
      });
      process.exit(1);
    }

    // Get list of tables that exist and are safe to drop
    const tablesToDrop = verificationResults.filter(r => r.safeToDrop);
    
    if (tablesToDrop.length === 0) {
      console.log('\n[INFO] No tables to drop (all either already dropped or have data).');
      return;
    }

    console.log(`\n[INFO] Ready to drop ${tablesToDrop.length} empty table(s).`);
    console.log('[WARNING] This will permanently delete these tables!');
    console.log('[WARNING] Press Ctrl+C within 5 seconds to cancel...\n');

    // Give user a chance to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Drop tables in a transaction
    console.log('[INFO] Dropping tables...\n');
    
    await pool.query('BEGIN');

    try {
      for (const obj of tablesToDrop) {
        // Check if it's a view first (views can appear in both tables and views metadata)
        const isView = await checkViewExists(pool, obj.name);
        const isTable = await checkTableExists(pool, obj.name);
        
        if (isView) {
          console.log(`[INFO] Dropping view ${obj.name}...`);
          await pool.query(`DROP VIEW IF EXISTS public.${obj.name} CASCADE`);
          console.log(`[OK] Dropped view ${obj.name}`);
        } else if (isTable) {
          console.log(`[INFO] Dropping table ${obj.name}...`);
          await pool.query(`DROP TABLE IF EXISTS public.${obj.name} CASCADE`);
          console.log(`[OK] Dropped table ${obj.name}`);
        } else {
          console.log(`⚠️  ${obj.name}: not found as table or view, skipping`);
          continue;
        }
      }

      await pool.query('COMMIT');
      console.log('\n[OK] All tables dropped successfully!');

      // Verify objects are gone
      console.log('\n[INFO] Verifying objects are dropped...');
      let stillExists = 0;
      for (const obj of tablesToDrop) {
        const exists = await getObjectType(pool, obj.name) !== 'none';
        if (exists) {
          console.log(`⚠️  ${obj.name} still exists`);
          stillExists++;
        } else {
          console.log(`✓ ${obj.name} successfully dropped`);
        }
      }

      if (stillExists === 0) {
        console.log('\n[OK] Verification complete - all tables successfully dropped.');
      } else {
        console.log(`\n[WARNING] ${stillExists} table(s) still exist. Check for errors above.`);
      }

    } catch (dropError) {
      await pool.query('ROLLBACK');
      throw dropError;
    }

  } catch (error) {
    console.error('[ERROR] Drop operation failed:', error);
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

export { main as dropUnusedEmptyTables };
