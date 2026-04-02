#!/usr/bin/env node
/**
 * Verify target coverage after building baseline targets
 */

const { Client } = require('pg');
const path = require('path');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function verifyCoverage() {
  const corpusUrl = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  const runtimeUrl = ensureNodePgTls(process.env.RUNTIME_DATABASE_URL) ?? process.env.RUNTIME_DATABASE_URL;

  const corpusClient = new Client(
    applyNodeTls({ connectionString: corpusUrl, ssl: { rejectUnauthorized: false } })
  );
  const runtimeClient = new Client(
    applyNodeTls({ connectionString: runtimeUrl, ssl: { rejectUnauthorized: false } })
  );
  
  try {
    await corpusClient.connect();
    await runtimeClient.connect();
    
    console.log('='.repeat(80));
    console.log('Target Coverage Verification');
    console.log('='.repeat(80));
    console.log('');
    
    // Total targets
    console.log('1. Total targets:');
    const totalTargetsResult = await corpusClient.query(`
      SELECT COUNT(*) AS count FROM public.ofc_candidate_targets
    `);
    const totalTargets = parseInt(totalTargetsResult.rows[0].count, 10);
    console.log(`   ${totalTargets} total targets`);
    
    // Max per question
    console.log('\n2. Max targets per question:');
    const maxPerQuestionResult = await corpusClient.query(`
      SELECT MAX(cnt) AS max_per_question
      FROM (
        SELECT target_key, COUNT(*) AS cnt
        FROM public.ofc_candidate_targets
        WHERE target_type = 'BASE_PRIMARY'
        GROUP BY target_key
      ) x
    `);
    const maxPerQuestion = parseInt(maxPerQuestionResult.rows[0].max_per_question || '0', 10);
    console.log(`   Max: ${maxPerQuestion}`);
    if (maxPerQuestion <= 4) {
      console.log('   ✅ Max per question constraint satisfied (<= 4)');
    } else {
      console.log('   ⚠️  Some questions have more than 4 targets');
    }
    
    // Coverage rate
    console.log('\n3. Coverage rate:');
    const baselineQuestionsResult = await runtimeClient.query(`
      SELECT COUNT(*) AS count FROM public.baseline_spines_runtime
    `);
    const baselineQuestions = parseInt(baselineQuestionsResult.rows[0].count, 10);
    console.log(`   Baseline questions: ${baselineQuestions}`);
    
    const questionsWithCandidatesResult = await corpusClient.query(`
      SELECT COUNT(DISTINCT target_key) AS count
      FROM public.ofc_candidate_targets
      WHERE target_type = 'BASE_PRIMARY'
    `);
    const questionsWithCandidates = parseInt(questionsWithCandidatesResult.rows[0].count, 10);
    console.log(`   Questions with candidates: ${questionsWithCandidates}`);
    
    const coveragePct = baselineQuestions > 0 
      ? (100.0 * questionsWithCandidates / baselineQuestions).toFixed(2)
      : '0.00';
    console.log(`   Coverage: ${coveragePct}%`);
    
    if (parseFloat(coveragePct) >= 50) {
      console.log('   ✅ Good coverage (>= 50%)');
    } else if (parseFloat(coveragePct) > 0) {
      console.log('   ⚠️  Low coverage (< 50%)');
    } else {
      console.log('   ⚠️  No coverage');
    }
    
    // Distribution
    console.log('\n4. Target distribution:');
    const distResult = await corpusClient.query(`
      SELECT
        COUNT(*) FILTER (WHERE cnt = 0) AS zero,
        COUNT(*) FILTER (WHERE cnt BETWEEN 1 AND 3) AS one_to_three,
        COUNT(*) FILTER (WHERE cnt >= 4) AS four_plus
      FROM (
        SELECT 
          q.question_canon_id,
          COUNT(t.candidate_id) AS cnt
        FROM (
          SELECT DISTINCT question_canon_id 
          FROM public.baseline_spines_runtime
        ) q
        LEFT JOIN public.ofc_candidate_targets t ON q.question_canon_id = t.target_key AND t.target_type = 'BASE_PRIMARY'
        GROUP BY q.question_canon_id
      ) x
    `);
    
    const dist = distResult.rows[0];
    console.log(`   Questions with 0 candidates: ${dist.zero}`);
    console.log(`   Questions with 1-3 candidates: ${dist.one_to_three}`);
    console.log(`   Questions with 4+ candidates: ${dist.four_plus}`);
    
    // Sample questions with candidates
    console.log('\n5. Sample questions with candidates:');
    const sampleResult = await corpusClient.query(`
      SELECT 
        t.target_key,
        COUNT(*) AS candidate_count
      FROM public.ofc_candidate_targets t
      WHERE t.target_type = 'BASE_PRIMARY'
      GROUP BY t.target_key
      ORDER BY candidate_count DESC
      LIMIT 5
    `);
    
    if (sampleResult.rows.length > 0) {
      for (const row of sampleResult.rows) {
        const questionResult = await runtimeClient.query(`
          SELECT question_text
          FROM public.baseline_spines_runtime
          WHERE question_canon_id = $1
          LIMIT 1
        `, [row.target_key]);
        
        const questionText = questionResult.rows[0]?.question_text || 'N/A';
        console.log(`\n   ${row.target_key}: ${row.candidate_count} candidates`);
        console.log(`      ${questionText.substring(0, 80)}...`);
      }
    } else {
      console.log('   ⚠️  No questions with candidates');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));
    console.log(`✅ Total targets: ${totalTargets}`);
    console.log(`${maxPerQuestion <= 4 ? '✅' : '⚠️'} Max per question: ${maxPerQuestion}`);
    console.log(`${parseFloat(coveragePct) >= 50 ? '✅' : '⚠️'} Coverage: ${coveragePct}%`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await corpusClient.end();
    await runtimeClient.end();
  }
}

verifyCoverage().catch(console.error);
