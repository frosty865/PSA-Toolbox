#!/usr/bin/env node
/**
 * Run corpus mining and build candidate targets
 * 
 * Steps:
 * 1. Run corpus mining to create CORPUS candidates
 * 2. Build candidate targets linking to baseline questions
 */

const { execSync } = require('child_process');
const path = require('path');
const { Client } = require('pg');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function checkCandidates() {
  const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  const client = new Client(
    applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })
  );
  
  try {
    await client.connect();
    const result = await client.query(`
      SELECT ofc_origin, count(*) as count
      FROM public.ofc_candidate_queue
      GROUP BY ofc_origin
      ORDER BY ofc_origin
    `);
    await client.end();
    return result.rows;
  } catch (error) {
    console.error('Error checking candidates:', error.message);
    throw error;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('CORPUS Mining and Target Building');
  console.log('='.repeat(80));
  console.log('');
  
  // Step 1: Check current state
  console.log('📊 Checking current candidate counts...');
  const beforeCounts = await checkCandidates();
  beforeCounts.forEach(row => {
    console.log(`   ${row.ofc_origin}: ${row.count}`);
  });
  console.log('');
  
  // Step 2: Run mining (if Python is available)
  console.log('⛏️  Step 1: Running corpus mining...');
  console.log('   (This requires Python and ALLOW_MINER_APPLY=YES)');
  console.log('');
  
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const miningScript = path.join(__dirname, 'corpus/mine_ofc_candidates_from_chunks_v3.py');
  
  try {
    // Set environment variable for mining
    process.env.ALLOW_MINER_APPLY = 'YES';
    
    console.log(`   Running: ${pythonCmd} ${miningScript} --apply --max-chunks 500`);
    const miningOutput = execSync(
      `${pythonCmd} "${miningScript}" --apply --max-chunks 500`,
      { 
        encoding: 'utf-8',
        env: { ...process.env, ALLOW_MINER_APPLY: 'YES' },
        cwd: path.join(__dirname, '..')
      }
    );
    console.log(miningOutput);
    console.log('   ✅ Mining completed');
  } catch (error) {
    console.log('   ⚠️  Mining failed or Python not available:');
    console.log(`   ${error.message}`);
    console.log('');
    console.log('   You can run mining manually with:');
    console.log(`   ${pythonCmd} tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply --max-chunks 500`);
    console.log('   (Set ALLOW_MINER_APPLY=YES environment variable first)');
    console.log('');
  }
  
  // Step 3: Check mining results
  console.log('📊 Checking candidate counts after mining...');
  const afterCounts = await checkCandidates();
  afterCounts.forEach(row => {
    console.log(`   ${row.ofc_origin}: ${row.count}`);
  });
  
  const corpusBefore = parseInt(beforeCounts.find(r => r.ofc_origin === 'CORPUS')?.count || '0');
  const corpusAfter = parseInt(afterCounts.find(r => r.ofc_origin === 'CORPUS')?.count || '0');
  const corpusAdded = corpusAfter - corpusBefore;
  
  if (corpusAdded > 0) {
    console.log(`   ✅ Added ${corpusAdded} CORPUS candidates`);
  } else if (corpusAfter === 0) {
    console.log('   ⚠️  No CORPUS candidates found - mining may have failed');
  }
  console.log('');
  
  // Step 4: Build candidate targets
  console.log('🔗 Step 2: Building candidate targets for baseline questions...');
  try {
    const targetsOutput = execSync(
      'npm run targets:baseline',
      { 
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..')
      }
    );
    console.log(targetsOutput);
    console.log('   ✅ Target building completed');
  } catch (error) {
    console.log('   ❌ Target building failed:');
    console.log(error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);
    process.exit(1);
  }
  
  // Step 5: Verify targets
  console.log('');
  console.log('📊 Verifying target coverage...');
  const corpusUrl = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  const client = new Client(
    applyNodeTls({ connectionString: corpusUrl, ssl: { rejectUnauthorized: false } })
  );
  await client.connect();

  const targetsResult = await client.query('SELECT count(*) as count FROM public.ofc_candidate_targets');
  const targetsCount = parseInt(targetsResult.rows[0].count);
  console.log(`   Total targets: ${targetsCount}`);

  const runtimeUrl = ensureNodePgTls(process.env.RUNTIME_DATABASE_URL) ?? process.env.RUNTIME_DATABASE_URL;
  const runtimeClient = new Client(
    applyNodeTls({ connectionString: runtimeUrl, ssl: { rejectUnauthorized: false } })
  );
  await runtimeClient.connect();
  
  const questionsResult = await runtimeClient.query(`
    SELECT count(*) as count 
    FROM public.baseline_spines_runtime 
    WHERE active = true AND discipline_subtype_id IS NOT NULL
  `);
  const questionsCount = parseInt(questionsResult.rows[0].count);
  
  const coveredResult = await client.query(`
    SELECT count(DISTINCT target_key) as count
    FROM public.ofc_candidate_targets
    WHERE target_type = 'BASE_PRIMARY'
  `);
  const coveredCount = parseInt(coveredResult.rows[0].count);
  const coveragePct = questionsCount > 0 ? ((coveredCount / questionsCount) * 100).toFixed(1) : 0;
  
  console.log(`   Baseline questions: ${questionsCount}`);
  console.log(`   Questions with candidates: ${coveredCount}`);
  console.log(`   Coverage: ${coveragePct}%`);
  
  await client.end();
  await runtimeClient.end();
  
  console.log('');
  console.log('='.repeat(80));
  console.log('✅ Complete!');
  console.log('='.repeat(80));
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
