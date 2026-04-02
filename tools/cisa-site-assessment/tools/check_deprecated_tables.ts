/**
 * Check Runtime DB for Deprecated Tables
 * 
 * This script queries the runtime database to identify potentially deprecated tables
 * and reports their row counts and usage status.
 * 
 * Usage:
 *   npx tsx tools/check_deprecated_tables.ts
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

// All tables from runtime database (82 total)
const ALL_TABLES = [
  'archive_normalized_evidence_links',
  'archive_normalized_vulnerabilities',
  'archive_source_documents',
  'archive_source_statements',
  'assessment_applied_ofcs',
  'assessment_applied_vulnerabilities',
  'assessment_definitions',
  'assessment_expansion_profiles',
  'assessment_expansion_responses',
  'assessment_instances',
  'assessment_question_responses',
  'assessment_question_universe',
  'assessment_required_elements',
  'assessment_responses',
  'assessment_status',
  'assessment_technology_profiles',
  'assessment_templates',
  'assessment_vulnerability_sectors',
  'assessments',
  'audit_log',
  'baseline_questions',
  'baseline_questions_legacy',
  'baseline_responses',
  'baseline_spines_runtime',
  'canonical_disciplines',
  'canonical_manifest',
  'canonical_ofc_citations',
  'canonical_ofc_patterns',
  'canonical_ofcs',
  'canonical_question_no_map',
  'canonical_question_templates',
  'canonical_sources',
  'canonical_subtypes',
  'canonical_vulnerability_patterns',
  'citation_bindings',
  'citation_requests',
  'compliance_report',
  'coverage_runs',
  'discipline_subtypes',
  'disciplines',
  'document_subtype_relevance',
  'drift_scan',
  'expansion_questions',
  'facilities',
  'normalized_evidence_links',
  'normalized_findings',
  'normalized_ofcs',
  'normalized_vulnerabilities',
  'observed_vulnerabilities',
  'ofc_candidate_queue',
  'ofc_candidate_targets',
  'ofc_library',
  'ofc_library_citations',
  'ofc_nomination_decisions',
  'ofc_nominations',
  'ofc_wipe_log',
  'phase6_reviews',
  'report_snapshots',
  'rls_verification',
  'sector_expansion_profiles',
  'sector_metrics',
  'sectors',
  'subdiscipline_sector_filter',
  'subsector_discipline_map',
  'subsector_discipline_weight_history',
  'subsector_metrics',
  'subsectors',
  'system_settings',
  'tech_question_responses',
  'tech_question_templates',
  'technology_maturity_definitions',
  'technology_maturity_lookup',
  'test_assessment_purge_log',
  'user_profiles',
  'v_active_baseline_questions',
  'v_candidate_targets_with_details',
  'v_canonical_ofcs_publish_ready',
  'v_eligible_ofc_library',
  'v_normalized_summary',
  'v_question_coverage',
];

// Tables actively used in codebase (based on grep analysis)
const ACTIVELY_USED_TABLES = [
  'assessments',
  'assessment_instances',
  'assessment_question_responses',
  'assessment_question_universe',
  'assessment_expansion_responses',
  'assessment_expansion_profiles',
  'assessment_required_elements',
  'assessment_status',
  'assessment_technology_profiles',
  'assessment_applied_ofcs',
  'assessment_applied_vulnerabilities',
  'assessment_definitions',
  'baseline_spines_runtime',
  'expansion_questions',
  'sectors',
  'subsectors',
  'disciplines',
  'facilities',
  'ofc_nominations',
  'ofc_library',
  'ofc_library_citations',
  'ofc_candidate_queue',
  'ofc_candidate_targets',
  'canonical_ofcs',
  'canonical_ofc_citations',
  'normalized_vulnerabilities',
  'normalized_evidence_links',
  'sector_expansion_profiles',
  'tech_question_responses',
  'tech_question_templates',
  'coverage_runs',
  'system_settings',
  'v_eligible_ofc_library',
  'v_question_coverage',
];

// Archive tables (clearly marked as archive)
const ARCHIVE_TABLES = [
  'archive_normalized_evidence_links',
  'archive_normalized_vulnerabilities',
  'archive_source_documents',
  'archive_source_statements',
];

// Views (v_* prefix)
const VIEWS = [
  'v_active_baseline_questions',
  'v_candidate_targets_with_details',
  'v_canonical_ofcs_publish_ready',
  'v_eligible_ofc_library',
  'v_normalized_summary',
  'v_question_coverage',
];

// Test/debug tables
const TEST_DEBUG_TABLES = [
  'test_assessment_purge_log',
  'rls_verification',
  'audit_log',
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

async function getTableRowCount(pool: any, tableName: string): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM public.${tableName}`);
    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    return -1; // Error getting count
  }
}

async function getTableInfo(pool: any, tableName: string): Promise<{
  exists: boolean;
  rowCount: number;
  columns: string[];
  hasDeprecatedFlag: boolean;
}> {
  const exists = await checkTableExists(pool, tableName);
  if (!exists) {
    return { exists: false, rowCount: 0, columns: [], hasDeprecatedFlag: false };
  }

  const rowCount = await getTableRowCount(pool, tableName);

  // Get column names
  let columns: string[] = [];
  let hasDeprecatedFlag = false;
  try {
    const colsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    columns = colsResult.rows.map((r: any) => r.column_name);
    hasDeprecatedFlag = columns.some((col: string) => 
      col.toLowerCase().includes('deprecated') || 
      col.toLowerCase().includes('is_active') ||
      col.toLowerCase() === 'status'
    );
  } catch (error) {
    // Ignore column fetch errors
  }

  return { exists, rowCount, columns, hasDeprecatedFlag };
}

function categorizeTable(tableName: string): {
  category: string;
  isUsed: boolean;
} {
  if (ARCHIVE_TABLES.includes(tableName)) {
    return { category: 'ARCHIVE', isUsed: false };
  }
  if (VIEWS.includes(tableName)) {
    return { category: 'VIEW', isUsed: ACTIVELY_USED_TABLES.includes(tableName) };
  }
  if (TEST_DEBUG_TABLES.includes(tableName)) {
    return { category: 'TEST/DEBUG', isUsed: false };
  }
  if (ACTIVELY_USED_TABLES.includes(tableName)) {
    return { category: 'ACTIVE', isUsed: true };
  }
  return { category: 'POTENTIALLY_UNUSED', isUsed: false };
}

async function main() {
  console.log('[INFO] Checking runtime database for all tables...\n');
  console.log(`[INFO] Analyzing ${ALL_TABLES.length} tables from schema probe\n`);

  const pool = await ensureRuntimePoolConnected();

  try {
    const results: Array<{
      name: string;
      category: string;
      exists: boolean;
      rowCount: number;
      hasData: boolean;
      hasDeprecatedFlag: boolean;
      isUsed: boolean;
    }> = [];

    // Check all tables
    for (const tableName of ALL_TABLES) {
      const info = await getTableInfo(pool, tableName);
      const categorization = categorizeTable(tableName);
      
      results.push({
        name: tableName,
        category: categorization.category,
        exists: info.exists,
        rowCount: info.rowCount,
        hasData: info.rowCount > 0,
        hasDeprecatedFlag: info.hasDeprecatedFlag,
        isUsed: categorization.isUsed,
      });
    }

    // Group by category
    const byCategory: Record<string, typeof results> = {};
    results.forEach(r => {
      if (!byCategory[r.category]) {
        byCategory[r.category] = [];
      }
      byCategory[r.category].push(r);
    });

    // Report by category
    console.log('=== ACTIVE TABLES (Used in codebase) ===\n');
    const activeTables = results.filter(r => r.category === 'ACTIVE');
    activeTables.forEach(r => {
      if (r.exists) {
        console.log(`✓ ${r.name}: ${r.rowCount} rows`);
      } else {
        console.log(`✗ ${r.name} (does not exist)`);
      }
    });

    console.log('\n=== VIEWS ===\n');
    const views = results.filter(r => r.category === 'VIEW');
    views.forEach(r => {
      if (r.exists) {
        const used = r.isUsed ? ' (USED)' : ' (UNUSED)';
        console.log(`${r.isUsed ? '✓' : '⚠'} ${r.name}: ${r.rowCount} rows${used}`);
      } else {
        console.log(`✗ ${r.name} (does not exist)`);
      }
    });

    console.log('\n=== ARCHIVE TABLES ===\n');
    const archiveTables = results.filter(r => r.category === 'ARCHIVE');
    archiveTables.forEach(r => {
      if (r.exists) {
        console.log(`📦 ${r.name}: ${r.rowCount} rows`);
      } else {
        console.log(`✗ ${r.name} (does not exist)`);
      }
    });

    console.log('\n=== TEST/DEBUG TABLES ===\n');
    const testTables = results.filter(r => r.category === 'TEST/DEBUG');
    testTables.forEach(r => {
      if (r.exists) {
        console.log(`🧪 ${r.name}: ${r.rowCount} rows`);
      } else {
        console.log(`✗ ${r.name} (does not exist)`);
      }
    });

    console.log('\n=== POTENTIALLY UNUSED/DEPRECATED TABLES ===\n');
    const unusedTables = results.filter(r => r.category === 'POTENTIALLY_UNUSED');
    const unusedWithData = unusedTables.filter(r => r.exists && r.hasData);
    const unusedEmpty = unusedTables.filter(r => r.exists && !r.hasData);
    const unusedMissing = unusedTables.filter(r => !r.exists);

    if (unusedWithData.length > 0) {
      console.log('⚠️  Tables with data (may need migration/cleanup):');
      unusedWithData.forEach(r => {
        const flag = r.hasDeprecatedFlag ? ' [has deprecated flag]' : '';
        console.log(`  ⚠️  ${r.name}: ${r.rowCount} rows${flag}`);
      });
      console.log('');
    }

    if (unusedEmpty.length > 0) {
      console.log('📋 Empty tables (safe to drop):');
      unusedEmpty.forEach(r => {
        console.log(`  📋 ${r.name}: 0 rows`);
      });
      console.log('');
    }

    if (unusedMissing.length > 0) {
      console.log('✓ Tables that do not exist (already cleaned up):');
      unusedMissing.forEach(r => {
        console.log(`  ✓ ${r.name}`);
      });
      console.log('');
    }

    // Summary
    console.log('\n=== SUMMARY ===\n');
    console.log(`Total tables analyzed: ${ALL_TABLES.length}`);
    console.log(`Active tables: ${activeTables.filter(r => r.exists).length}`);
    console.log(`Views: ${views.filter(r => r.exists).length} (${views.filter(r => r.exists && r.isUsed).length} used)`);
    console.log(`Archive tables: ${archiveTables.filter(r => r.exists).length}`);
    console.log(`Test/debug tables: ${testTables.filter(r => r.exists).length}`);
    console.log(`Potentially unused tables: ${unusedTables.filter(r => r.exists).length}`);
    console.log(`  - With data: ${unusedWithData.length}`);
    console.log(`  - Empty: ${unusedEmpty.length}`);
    console.log(`  - Missing: ${unusedMissing.length}`);

    // Migration status checks
    const baselineQuestionsInfo = await getTableInfo(pool, 'baseline_questions');
    const baselineSpinesInfo = await getTableInfo(pool, 'baseline_spines_runtime');
    
    if (baselineQuestionsInfo.exists && baselineSpinesInfo.exists) {
      console.log('\n=== BASELINE QUESTIONS MIGRATION STATUS ===\n');
      console.log(`baseline_questions: ${baselineQuestionsInfo.rowCount} rows`);
      console.log(`baseline_spines_runtime: ${baselineSpinesInfo.rowCount} rows`);
      if (baselineQuestionsInfo.rowCount > 0 && baselineSpinesInfo.rowCount > 0) {
        console.log('\n⚠️  Both tables have data. baseline_spines_runtime is the current authoritative source.');
      }
    }

    const assessmentResponsesInfo = await getTableInfo(pool, 'assessment_responses');
    const assessmentQuestionResponsesInfo = await getTableInfo(pool, 'assessment_question_responses');
    
    if (assessmentResponsesInfo.exists && assessmentQuestionResponsesInfo.exists) {
      console.log('\n=== ASSESSMENT RESPONSES MIGRATION STATUS ===\n');
      console.log(`assessment_responses: ${assessmentResponsesInfo.rowCount} rows`);
      console.log(`assessment_question_responses: ${assessmentQuestionResponsesInfo.rowCount} rows`);
      if (assessmentResponsesInfo.rowCount > 0 && assessmentQuestionResponsesInfo.rowCount > 0) {
        console.log('\n⚠️  Both tables have data. assessment_question_responses is the current table.');
      }
    }

  } catch (error) {
    console.error('[ERROR] Check failed:', error);
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

export { main as checkDeprecatedTables };
