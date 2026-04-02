#!/usr/bin/env npx tsx
/**
 * Export baseline questions from DB (intent only; no source excerpts).
 *
 * Intent authority order (same as rewrite_baseline_questions.ts):
 * 1) question_meaning.meaning_text
 * 2) discipline_subtype_reference_impl.reference_impl.section1.baseline_existence_question.clarification
 * 3) discipline_subtype_reference_impl.reference_impl.section2.what_right_looks_like
 * 4) fallback: current question_text
 *
 * Output: JSON array with question_code, current_question_text, help_text, intent_text,
 * source_excerpts (always []), discipline, subtype.
 *
 * For in-repo rewrites and SQL patch, use: npx tsx tools/rewrite_baseline_questions.ts
 *
 * Usage:
 *   npx tsx tools/export_baseline_for_rewrite.ts
 *   npx tsx tools/export_baseline_for_rewrite.ts --out tools/outputs/baseline_for_rewrite.json
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface Row {
  canon_id: string;
  question_text: string;
  discipline_code: string;
  subtype_code: string | null;
  discipline_subtype_id: string | null;
  meaning_text: string | null;
  reference_impl: unknown;
}

export interface BaselineForRewrite {
  question_code: string;
  current_question_text: string;
  help_text: string;
  intent_text: string;
  source_excerpts: string[];
  discipline: string;
  subtype: string;
}

function intentFromRefImpl(ref: unknown): {
  help_text: string;
  clarification_intent: string;
  what_right_looks_like_intent: string;
} {
  const helpParts: string[] = [];
  let clarification_intent = '';
  let what_right_looks_like_intent = '';

  if (!ref || typeof ref !== 'object') {
    return { help_text: '', clarification_intent: '', what_right_looks_like_intent: '' };
  }

  const o = ref as Record<string, unknown>;

  const section1 = o.section1 as Record<string, unknown> | undefined;
  const baseQ = section1?.baseline_existence_question as Record<string, unknown> | undefined;
  const clarification = baseQ?.clarification as Record<string, string> | undefined;
  if (clarification) {
    const parts: string[] = [];
    const yes = clarification.YES ?? clarification.yes_means ?? '';
    const no = clarification.NO ?? clarification.no_means ?? '';
    const na = clarification.N_A ?? clarification.na_applies_only_if ?? '';
    if (yes) {
      helpParts.push(`YES: ${yes}`);
      parts.push(yes);
    }
    if (no) {
      helpParts.push(`NO: ${no}`);
      parts.push(no);
    }
    if (na) {
      helpParts.push(`N/A: ${na}`);
      parts.push(na);
    }
    clarification_intent = parts.join(' ');
  }

  const section2 = o.section2 as Record<string, unknown> | undefined;
  const list =
    (section2?.what_right_looks_like as string[] | undefined) ??
    (o.section_2_right_looks_like_authoritative as string[] | undefined);
  if (Array.isArray(list) && list.length > 0) {
    what_right_looks_like_intent = list.join(' ');
  }

  return {
    help_text: helpParts.join('\n'),
    clarification_intent: clarification_intent.trim(),
    what_right_looks_like_intent: what_right_looks_like_intent.trim(),
  };
}

async function main(): Promise<void> {
  const outArg = process.argv.indexOf('--out');
  const outPath =
    outArg >= 0 && process.argv[outArg + 1]
      ? process.argv[outArg + 1]
      : path.join(process.cwd(), 'tools', 'outputs', 'baseline_for_rewrite.json');

  console.log('[export_baseline_for_rewrite] Loading baseline from RUNTIME...');

  const pool = await ensureRuntimePoolConnected();

  // Load active baseline questions with optional question_meaning and reference_impl (via subtype)
  const query = `
    SELECT
      b.canon_id,
      b.question_text,
      b.discipline_code,
      b.subtype_code,
      b.discipline_subtype_id,
      qm.meaning_text,
      ri.reference_impl
    FROM public.baseline_spines_runtime b
    LEFT JOIN public.question_meaning qm ON qm.canon_id = b.canon_id
    LEFT JOIN public.discipline_subtype_reference_impl ri ON ri.discipline_subtype_id = b.discipline_subtype_id
    WHERE b.active = true
    ORDER BY b.discipline_code ASC, b.canon_id ASC
  `;

  let rows: Row[];
  try {
    const result = await pool.query(query);
    rows = result.rows as Row[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('question_meaning') && msg.includes('does not exist')) {
      // Run without question_meaning
      const fallback = await pool.query(`
        SELECT
          b.canon_id,
          b.question_text,
          b.discipline_code,
          b.subtype_code,
          b.discipline_subtype_id,
          NULL::text AS meaning_text,
          ri.reference_impl
        FROM public.baseline_spines_runtime b
        LEFT JOIN public.discipline_subtype_reference_impl ri ON ri.discipline_subtype_id = b.discipline_subtype_id
        WHERE b.active = true
        ORDER BY b.discipline_code ASC, b.canon_id ASC
      `);
      rows = fallback.rows as Row[];
    } else if (msg.includes('discipline_subtype_reference_impl') && msg.includes('does not exist')) {
      const fallback = await pool.query(`
        SELECT
          b.canon_id,
          b.question_text,
          b.discipline_code,
          b.subtype_code,
          b.discipline_subtype_id,
          qm.meaning_text,
          NULL::jsonb AS reference_impl
        FROM public.baseline_spines_runtime b
        LEFT JOIN public.question_meaning qm ON qm.canon_id = b.canon_id
        WHERE b.active = true
        ORDER BY b.discipline_code ASC, b.canon_id ASC
      `);
      rows = fallback.rows as Row[];
    } else {
      throw e;
    }
  }

  const out: BaselineForRewrite[] = rows.map((r) => {
    const { help_text: refHelp, clarification_intent, what_right_looks_like_intent } =
      intentFromRefImpl(r.reference_impl);
    const intent_text =
      (r.meaning_text && r.meaning_text.trim()) ||
      clarification_intent ||
      what_right_looks_like_intent ||
      r.question_text;

    return {
      question_code: r.canon_id,
      current_question_text: r.question_text,
      help_text: refHelp,
      intent_text,
      source_excerpts: [],
      discipline: r.discipline_code,
      subtype: r.subtype_code ?? '',
    };
  });

  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`[export_baseline_for_rewrite] Wrote ${out.length} questions to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
