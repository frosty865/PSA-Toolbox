/**
 * Pool Identity Check Tool
 * 
 * Proves whether getCorpusPool() and getRuntimePool() connect to the same or different databases.
 * 
 * Usage:
 *   npx tsx tools/db/pool_identity_check.ts
 */

import { getCorpusPool } from '../../app/lib/db/corpus_client';
import { getRuntimePool } from '../../app/lib/db/runtime_client';

// Backend fingerprint + existence + privilege probe query
const FINGERPRINT_QUERY = `
  SELECT
    current_database() as db,
    current_user as usr,
    inet_server_addr() as server_ip,
    inet_server_port() as server_port,
    version() as server_version,
    pg_postmaster_start_time() as postmaster_start_time,
    (SELECT setting FROM pg_settings WHERE name='data_directory') as data_directory,
    (SELECT setting FROM pg_settings WHERE name='listen_addresses') as listen_addresses,
    to_regclass('public.source_registry') as sr_regclass,
    CASE 
      WHEN to_regclass('public.source_registry') IS NOT NULL 
      THEN has_table_privilege(current_user, 'public.source_registry', 'SELECT')
      ELSE NULL
    END as sr_select,
    to_regclass('public.ofc_library_citations') as olc_regclass,
    CASE 
      WHEN to_regclass('public.ofc_library_citations') IS NOT NULL 
      THEN has_table_privilege(current_user, 'public.ofc_library_citations', 'SELECT')
      ELSE NULL
    END as olc_select
`;

const SYSTEM_ID_QUERY = `SELECT system_identifier FROM pg_control_system()`;

async function checkPoolIdentity() {
  console.log('='.repeat(80));
  console.log('POOL IDENTITY CHECK');
  console.log('='.repeat(80));
  console.log('');

  let corpusIdentity: any = null;
  let runtimeIdentity: any = null;
  let corpusError: string | null = null;
  let runtimeError: string | null = null;

  // Check CORPUS pool
  console.log('Checking CORPUS pool...');
  try {
    const corpusPool = getCorpusPool();
    const result = await corpusPool.query(FINGERPRINT_QUERY);
    corpusIdentity = result.rows[0];
    
    // Try to get system_identifier
    try {
      const sysIdResult = await corpusPool.query(SYSTEM_ID_QUERY);
      corpusIdentity.system_identifier = sysIdResult.rows[0]?.system_identifier || null;
    } catch (error: any) {
      corpusIdentity.system_identifier = null;
    }
    
    console.log('✓ CORPUS pool connected');
  } catch (error: any) {
    corpusError = error.message || String(error);
    console.error('✗ CORPUS pool failed:', corpusError);
  }

  console.log('');

  // Check RUNTIME pool
  console.log('Checking RUNTIME pool...');
  try {
    const runtimePool = getRuntimePool();
    const result = await runtimePool.query(FINGERPRINT_QUERY);
    runtimeIdentity = result.rows[0];
    
    // Try to get system_identifier
    try {
      const sysIdResult = await runtimePool.query(SYSTEM_ID_QUERY);
      runtimeIdentity.system_identifier = sysIdResult.rows[0]?.system_identifier || null;
    } catch (error: any) {
      runtimeIdentity.system_identifier = null;
    }
    
    console.log('✓ RUNTIME pool connected');
  } catch (error: any) {
    runtimeError = error.message || String(error);
    console.error('✗ RUNTIME pool failed:', runtimeError);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('CORPUS POOL PROBE');
  console.log('='.repeat(80));
  if (corpusIdentity) {
    console.log(`Database:                    ${corpusIdentity.db}`);
    console.log(`User:                        ${corpusIdentity.usr}`);
    console.log(`Server IP:                   ${corpusIdentity.server_ip || 'NULL'}`);
    console.log(`Server Port:                 ${corpusIdentity.server_port || 'NULL'}`);
    console.log(`Server Version:              ${corpusIdentity.server_version || 'NULL'}`);
    console.log(`Postmaster Start:            ${corpusIdentity.postmaster_start_time || 'NULL'}`);
    console.log(`Data Directory:              ${corpusIdentity.data_directory || 'NULL'}`);
    console.log(`Listen Addresses:            ${corpusIdentity.listen_addresses || 'NULL'}`);
    console.log(`System Identifier:          ${corpusIdentity.system_identifier || 'NULL (not available)'}`);
    console.log('');
    console.log(`public.source_registry:`);
    console.log(`  exists (to_regclass):      ${corpusIdentity.sr_regclass !== null ? 'YES' : 'NO'} (${corpusIdentity.sr_regclass || 'NULL'})`);
    console.log(`  can_select (privilege):    ${corpusIdentity.sr_select === true ? 'YES' : corpusIdentity.sr_select === false ? 'NO' : 'NULL (table does not exist)'}`);
    console.log('');
    console.log(`public.ofc_library_citations:`);
    console.log(`  exists (to_regclass):      ${corpusIdentity.olc_regclass !== null ? 'YES' : 'NO'} (${corpusIdentity.olc_regclass || 'NULL'})`);
    console.log(`  can_select (privilege):    ${corpusIdentity.olc_select === true ? 'YES' : corpusIdentity.olc_select === false ? 'NO' : 'NULL (table does not exist)'}`);
  } else {
    console.log('ERROR: Could not connect to CORPUS pool');
    console.log(`Error: ${corpusError}`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('RUNTIME POOL PROBE');
  console.log('='.repeat(80));
  if (runtimeIdentity) {
    console.log(`Database:                    ${runtimeIdentity.db}`);
    console.log(`User:                        ${runtimeIdentity.usr}`);
    console.log(`Server IP:                   ${runtimeIdentity.server_ip || 'NULL'}`);
    console.log(`Server Port:                 ${runtimeIdentity.server_port || 'NULL'}`);
    console.log(`Server Version:              ${runtimeIdentity.server_version || 'NULL'}`);
    console.log(`Postmaster Start:            ${runtimeIdentity.postmaster_start_time || 'NULL'}`);
    console.log(`Data Directory:              ${runtimeIdentity.data_directory || 'NULL'}`);
    console.log(`Listen Addresses:            ${runtimeIdentity.listen_addresses || 'NULL'}`);
    console.log(`System Identifier:           ${runtimeIdentity.system_identifier || 'NULL (not available)'}`);
    console.log('');
    console.log(`public.source_registry:`);
    console.log(`  exists (to_regclass):      ${runtimeIdentity.sr_regclass !== null ? 'YES' : 'NO'} (${runtimeIdentity.sr_regclass || 'NULL'})`);
    console.log(`  can_select (privilege):    ${runtimeIdentity.sr_select === true ? 'YES' : runtimeIdentity.sr_select === false ? 'NO' : 'NULL (table does not exist)'}`);
    console.log('');
    console.log(`public.ofc_library_citations:`);
    console.log(`  exists (to_regclass):      ${runtimeIdentity.olc_regclass !== null ? 'YES' : 'NO'} (${runtimeIdentity.olc_regclass || 'NULL'})`);
    console.log(`  can_select (privilege):    ${runtimeIdentity.olc_select === true ? 'YES' : runtimeIdentity.olc_select === false ? 'NO' : 'NULL (table does not exist)'}`);
  } else {
    console.log('ERROR: Could not connect to RUNTIME pool');
    console.log(`Error: ${runtimeError}`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('ANALYSIS');
  console.log('='.repeat(80));

  if (!corpusIdentity || !runtimeIdentity) {
    console.log('⚠️  Cannot compare: One or both pools failed to connect');
    process.exit(1);
  }

  const sameDb = corpusIdentity.db === runtimeIdentity.db;
  const sameUser = corpusIdentity.usr === runtimeIdentity.usr;
  const sameBackend = 
    (corpusIdentity.system_identifier && runtimeIdentity.system_identifier && 
     corpusIdentity.system_identifier === runtimeIdentity.system_identifier) ||
    (!corpusIdentity.system_identifier && !runtimeIdentity.system_identifier &&
     corpusIdentity.server_ip === runtimeIdentity.server_ip &&
     corpusIdentity.server_port === runtimeIdentity.server_port &&
     corpusIdentity.data_directory === runtimeIdentity.data_directory &&
     corpusIdentity.postmaster_start_time === runtimeIdentity.postmaster_start_time);

  console.log(`Same Database Name:     ${sameDb ? '⚠️  YES' : '✓ NO'}`);
  console.log(`Same User:             ${sameUser ? '⚠️  YES' : '✓ NO'}`);
  console.log(`Same Backend:          ${sameBackend ? '⚠️  YES' : '✓ NO'}`);

  console.log('');

  if (sameBackend) {
    console.log('⚠️  NOTE: CORPUS and RUNTIME pools connect to the SAME backend instance.');
    console.log('In production, use different Supabase projects. In dev, verify table separation:');
    console.log(`  - CORPUS: source_registry exists=${corpusIdentity.sr_regclass !== null}, can_select=${corpusIdentity.sr_select}`);
    console.log(`  - RUNTIME: ofc_library_citations exists=${runtimeIdentity.olc_regclass !== null}, can_select=${runtimeIdentity.olc_select}`);
  } else {
    console.log('✓ CORPUS and RUNTIME pools connect to DISTINCT backend instances.');
    console.log('Configuration is correct.');
  }

  // Summary: Table existence and privilege status
  console.log('');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log('CORPUS Pool:');
  console.log(`  source_registry:        exists=${corpusIdentity.sr_regclass !== null ? 'YES' : 'NO'}, can_select=${corpusIdentity.sr_select === true ? 'YES' : corpusIdentity.sr_select === false ? 'NO' : 'NULL'}`);
  console.log(`  ofc_library_citations:  exists=${corpusIdentity.olc_regclass !== null ? 'YES' : 'NO'}, can_select=${corpusIdentity.olc_select === true ? 'YES' : corpusIdentity.olc_select === false ? 'NO' : 'NULL'}`);
  console.log('');
  console.log('RUNTIME Pool:');
  console.log(`  source_registry:        exists=${runtimeIdentity.sr_regclass !== null ? 'YES' : 'NO'}, can_select=${runtimeIdentity.sr_select === true ? 'YES' : runtimeIdentity.sr_select === false ? 'NO' : 'NULL'}`);
  console.log(`  ofc_library_citations:  exists=${runtimeIdentity.olc_regclass !== null ? 'YES' : 'NO'}, can_select=${runtimeIdentity.olc_select === true ? 'YES' : runtimeIdentity.olc_select === false ? 'NO' : 'NULL'}`);

  console.log('');
  console.log('='.repeat(80));
}

// Run the check
checkPoolIdentity()
  .then(() => {
    console.log('Identity check complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Identity check failed:', error);
    process.exit(1);
  });
