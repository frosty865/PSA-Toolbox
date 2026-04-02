#!/usr/bin/env tsx

/**
 * Build Candidate Targets for Baseline Questions
 * 
 * Populates CORPUS.ofc_candidate_targets by linking candidates to baseline questions.
 * 
 * Matching rules:
 * - Strict subtype isolation: only match candidates with same discipline_subtype_id
 * - Score by keyword overlap (simple token matching)
 * - Store top 4 candidates per question
 * - Uses UPSERT semantics (overwrites existing scores)
 * 
 * Usage:
 *   npm run targets:baseline
 */

import * as dotenv from 'dotenv';
import { getRuntimePool } from '../../app/lib/db/runtime_client';
import { getCorpusPool } from '../../app/lib/db/corpus_client';
import { assertTablesOnOwnerPools } from '../../app/lib/db/pool_guard';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

interface BaselineQuestion {
  canon_id: string;
  question_text: string;
  discipline_subtype_id: string | null;
}

interface Candidate {
  candidate_id: string;
  title: string | null;
  snippet_text: string;
  discipline_subtype_id: string | null;
  status: string;
  approved: boolean;
}

interface CandidateMatch {
  candidate_id: string;
  question_canon_id: string;
  match_score: number;
}

/**
 * Simple keyword overlap scoring
 * Returns score 0.0-1.0 based on token overlap
 * 
 * Scoring method: "SUBTYPE+KEYWORD"
 * - Requires discipline_subtype_id match (enforced before calling this)
 * - Scores by token overlap between candidate text and question text
 * - Returns normalized score 0.0-1.0
 */
function calculateKeywordScore(
  candidateText: string,
  questionText: string
): number {
  if (!candidateText || !questionText) return 0;

  // Normalize and tokenize
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2) // Filter out very short tokens
      .filter((t) => !['the', 'and', 'or', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were'].includes(t)); // Filter common stop words

  const candidateTokens = new Set(normalize(candidateText));
  const questionTokens = new Set(normalize(questionText));

  if (questionTokens.size === 0) return 0;

  // Count overlapping tokens
  let overlap = 0;
  for (const token of candidateTokens) {
    if (questionTokens.has(token)) {
      overlap++;
    }
  }

  // Score: Jaccard similarity (intersection / union)
  // This gives a normalized score that accounts for both question and candidate length
  const union = new Set([...candidateTokens, ...questionTokens]);
  const jaccard = union.size > 0 ? overlap / union.size : 0;

  // Also consider coverage: how much of the question is covered by candidate
  const coverage = questionTokens.size > 0 ? overlap / questionTokens.size : 0;

  // Combined score: weighted average favoring coverage (question understanding)
  return Math.min((jaccard * 0.4 + coverage * 0.6), 1.0);
}

async function main() {
  console.log('='.repeat(80));
  console.log('Building Candidate Targets for Baseline Questions');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Hard guard: Assert tables are on correct pools
    await assertTablesOnOwnerPools([
      'public.baseline_spines_runtime',
      'public.ofc_candidate_queue',
      'public.ofc_candidate_targets',
    ]);

    const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPool();

    // 1. Fetch all active baseline questions from RUNTIME
    console.log('[1/5] Fetching baseline questions from RUNTIME...');
    const questionsResult = await runtimePool.query(
      `
      SELECT 
        canon_id,
        question_text,
        discipline_subtype_id
      FROM public.baseline_spines_runtime
      WHERE active = true
        AND discipline_subtype_id IS NOT NULL
      ORDER BY canon_id
      `
    );

    const questions: BaselineQuestion[] = questionsResult.rows;
    console.log(`  Found ${questions.length} active baseline questions with subtype`);
    console.log('');

    // 2. Fetch eligible candidates from CORPUS
    console.log('[2/5] Fetching eligible candidates from CORPUS...');
    const candidatesResult = await corpusPool.query(
      `
      SELECT 
        candidate_id::text as candidate_id,
        title,
        snippet_text,
        discipline_subtype_id::text as discipline_subtype_id,
        status,
        COALESCE(approved, false) as approved
      FROM public.ofc_candidate_queue
      WHERE discipline_subtype_id IS NOT NULL
        AND status IN ('PENDING', 'REVIEWED')
        AND COALESCE(approved, false) = false
        AND ofc_origin IN ('CORPUS', 'MODULE')
      ORDER BY created_at DESC
      `
    );

    const candidates: Candidate[] = candidatesResult.rows;
    console.log(`  Found ${candidates.length} eligible candidates`);
    console.log('');

    // 3. Group candidates by discipline_subtype_id for efficient matching
    console.log('[3/5] Grouping candidates by subtype...');
    const candidatesBySubtype = new Map<string, Candidate[]>();
    for (const candidate of candidates) {
      if (!candidate.discipline_subtype_id) continue;
      if (!candidatesBySubtype.has(candidate.discipline_subtype_id)) {
        candidatesBySubtype.set(candidate.discipline_subtype_id, []);
      }
      candidatesBySubtype.get(candidate.discipline_subtype_id)!.push(candidate);
    }
    console.log(`  Grouped into ${candidatesBySubtype.size} subtypes`);
    console.log('');

    // 4. Match candidates to questions (strict subtype isolation)
    console.log('[4/5] Matching candidates to questions...');
    const allMatches: CandidateMatch[] = [];
    let questionsWithMatches = 0;

    for (const question of questions) {
      if (!question.discipline_subtype_id) continue;

      const subtypeCandidates =
        candidatesBySubtype.get(question.discipline_subtype_id) || [];

      if (subtypeCandidates.length === 0) continue;

      // Score all candidates for this question
      const scoredMatches: Array<CandidateMatch & { score: number }> = [];

      for (const candidate of subtypeCandidates) {
        const candidateText = [
          candidate.title || '',
          candidate.snippet_text || '',
        ]
          .join(' ')
          .trim();

        if (!candidateText) continue;

        const score = calculateKeywordScore(
          candidateText,
          question.question_text
        );

        if (score > 0) {
          scoredMatches.push({
            candidate_id: candidate.candidate_id,
            question_canon_id: question.canon_id,
            match_score: score,
            score, // For sorting
          });
        }
      }

      // Sort by score descending and take top 4
      scoredMatches.sort((a, b) => b.score - a.score);
      const topMatches = scoredMatches.slice(0, 4);

      if (topMatches.length > 0) {
        questionsWithMatches++;
        // Remove score field before adding to allMatches
        topMatches.forEach((m) => {
          const { score, ...match } = m;
          allMatches.push(match);
        });
      }
    }

    console.log(
      `  Matched ${allMatches.length} candidate-question pairs across ${questionsWithMatches} questions`
    );
    console.log('');

    // 5. UPSERT into CORPUS.ofc_candidate_targets
    console.log('[5/5] Writing targets to CORPUS...');
    const client = await corpusPool.connect();

    try {
      await client.query('BEGIN');

      // Batch UPSERT: Process in chunks to avoid parameter limit issues
      const CHUNK_SIZE = 500;
      let totalWritten = 0;

      for (let i = 0; i < allMatches.length; i += CHUNK_SIZE) {
        const chunk = allMatches.slice(i, i + CHUNK_SIZE);
        
        // Build VALUES clause for this chunk
        const values = chunk.map((match, idx) => {
          const baseIdx = idx * 5;
          return `($${baseIdx + 1}::uuid, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}::numeric)`;
        }).join(', ');

        const params: any[] = [];
        chunk.forEach(match => {
          params.push(
            match.candidate_id,
            'BASE_PRIMARY',
            match.question_canon_id,
            'UNIVERSAL',
            match.match_score.toFixed(3)
          );
        });

        await client.query(
          `
          INSERT INTO public.ofc_candidate_targets (
            candidate_id,
            target_type,
            target_key,
            match_mode,
            match_score
          ) VALUES ${values}
          ON CONFLICT (candidate_id, target_type, target_key, match_mode)
          DO UPDATE SET
            match_score = EXCLUDED.match_score
          `,
          params
        );
        
        totalWritten += chunk.length;
      }

      await client.query('COMMIT');

      console.log(`  Written: ${totalWritten} targets (UPSERT)`);
      console.log('');

      console.log('='.repeat(80));
      console.log('✅ Candidate targeting complete!');
      console.log('='.repeat(80));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('');
    console.error('❌ Error building candidate targets:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, calculateKeywordScore };
