#!/usr/bin/env npx tsx
/**
 * Rewrite baseline existence questions using intent from runtime DB only.
 *
 * - Reads active baseline_spines_runtime; joins question_meaning and discipline_subtype_reference_impl.
 * - Computes intent per row using authority order: meaning_text → clarification → what_right_looks_like → fallback "".
 * - Runs deterministic rewrite (app/lib/baseline/rewrite/rewrite_baseline_question.ts).
 * - Writes JSONL report (one line per row, including skipped) + SQL patch; optional --apply to update DB.
 *
 * Usage:
 *   npx tsx tools/rewrite_baseline_questions.ts [--dry-run] [--limit N] [--out-report path] [--out-sql path]
 *   npx tsx tools/rewrite_baseline_questions.ts --apply [--limit N] [--out-report path] [--out-sql path]
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { ensureRuntimePoolConnected } from "../app/lib/db/runtime_client";
import {
  rewriteBaselineQuestion,
  type SkipReason,
} from "../app/lib/baseline/rewrite/rewrite_baseline_question";
import { assertBaselineQuestionLanguage } from "../app/lib/baseline/rewrite/baseline_question_validation";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const DEFAULT_REPORT = path.join(process.cwd(), "tools", "outputs", "baseline_rewrite_report.jsonl");
const DEFAULT_SQL = path.join(process.cwd(), "tools", "outputs", "baseline_rewrite_patch.sql");

type IntentSource = "meaning_text" | "clarification" | "what_right_looks_like" | "fallback";

interface DbRow {
  canon_id: string;
  question_text: string;
  discipline_code: string;
  subtype_code: string | null;
  discipline_subtype_id: string | null;
  meaning_text: string | null;
  reference_impl: unknown;
}

interface ReportLine {
  canon_id: string;
  discipline_code: string;
  subtype_code: string | null;
  status: "UPDATED" | "SKIPPED";
  skip_reason: SkipReason | null;
  intent_source: IntentSource;
  intent_snippet: string;
  before: string;
  after: string;
}

interface SummaryCounts {
  total_rows: number;
  updated_count: number;
  skipped_same_text: number;
  skipped_empty_intent: number;
  skipped_forbidden_terms: number;
  skipped_too_long: number;
  skipped_invalid_output: number;
  skipped_missing_baseline_row: number;
}

function parseArgs(): {
  apply: boolean;
  dryRun: boolean;
  limit: number | null;
  outReport: string;
  outSql: string;
} {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const dryRun = !apply || argv.includes("--dry-run");
  let limit: number | null = null;
  let outReport = DEFAULT_REPORT;
  let outSql = DEFAULT_SQL;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) {
      limit = parseInt(argv[i + 1], 10);
      if (Number.isNaN(limit)) limit = null;
    }
    if (argv[i] === "--out-report" && argv[i + 1]) outReport = argv[i + 1];
    if (argv[i] === "--out-sql" && argv[i + 1]) outSql = argv[i + 1];
  }

  return { apply, dryRun: apply ? false : true, limit, outReport, outSql };
}

function getIntentFromRefImpl(ref: unknown): {
  clarification: string;
  whatRightLooksLike: string;
} {
  let clarification = "";
  let whatRightLooksLike = "";
  if (!ref || typeof ref !== "object") return { clarification, whatRightLooksLike };
  const o = ref as Record<string, unknown>;
  const section1 = o.section1 as Record<string, unknown> | undefined;
  const baseQ = section1?.baseline_existence_question as Record<string, unknown> | undefined;
  const clar = baseQ?.clarification as Record<string, string> | undefined;
  if (clar) {
    const parts: string[] = [];
    const yes = clar.YES ?? clar.yes_means ?? "";
    if (yes) parts.push(yes);
    const no = clar.NO ?? clar.no_means ?? "";
    if (no) parts.push(no);
    const na = clar.N_A ?? clar.na_applies_only_if ?? "";
    if (na) parts.push(na);
    clarification = parts.join(" ");
  }
  const section2 = o.section2 as Record<string, unknown> | undefined;
  const list =
    (section2?.what_right_looks_like as string[] | undefined) ??
    (o.section_2_right_looks_like_authoritative as string[] | undefined);
  if (Array.isArray(list) && list.length > 0) {
    whatRightLooksLike = list.join(" ");
  }
  return { clarification, whatRightLooksLike };
}

/**
 * Intent authority order:
 * 1) question_meaning.meaning_text (non-empty)
 * 2) ref_impl.section1.baseline_existence_question.clarification (non-empty)
 * 3) ref_impl.section2.what_right_looks_like (non-empty)
 * 4) fallback: ""
 */
function resolveIntent(row: DbRow): {
  intentText: string;
  intentSource: IntentSource;
  intentSnippet: string;
} {
  const snippet = (s: string) => s.trim().slice(0, 160);

  if (row.meaning_text && row.meaning_text.trim()) {
    return {
      intentText: row.meaning_text.trim(),
      intentSource: "meaning_text",
      intentSnippet: snippet(row.meaning_text),
    };
  }

  const { clarification, whatRightLooksLike } = getIntentFromRefImpl(row.reference_impl);
  if (clarification.trim()) {
    return {
      intentText: clarification.trim(),
      intentSource: "clarification",
      intentSnippet: snippet(clarification),
    };
  }
  if (whatRightLooksLike.trim()) {
    return {
      intentText: whatRightLooksLike.trim(),
      intentSource: "what_right_looks_like",
      intentSnippet: snippet(whatRightLooksLike),
    };
  }

  return {
    intentText: "",
    intentSource: "fallback",
    intentSnippet: snippet(row.question_text),
  };
}

function escapeSqlLiteral(s: string): string {
  return s.replace(/'/g, "''");
}

async function main(): Promise<void> {
  const { apply, dryRun, limit, outReport, outSql } = parseArgs();

  console.log("[rewrite_baseline_questions] Loading baseline from RUNTIME...");
  const pool = await ensureRuntimePoolConnected();

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

  let rows: DbRow[];
  try {
    const result = await pool.query(query);
    rows = result.rows as DbRow[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("question_meaning") && msg.includes("does not exist")) {
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
      rows = fallback.rows as DbRow[];
    } else if (msg.includes("discipline_subtype_reference_impl") && msg.includes("does not exist")) {
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
      rows = fallback.rows as DbRow[];
    } else {
      throw e;
    }
  }

  const limited = limit != null ? rows.slice(0, limit) : rows;
  const total_rows = limited.length;
  console.log(`[rewrite_baseline_questions] Processing ${total_rows} rows (dryRun=${dryRun})...`);

  const counts: SummaryCounts = {
    total_rows,
    updated_count: 0,
    skipped_same_text: 0,
    skipped_empty_intent: 0,
    skipped_forbidden_terms: 0,
    skipped_too_long: 0,
    skipped_invalid_output: 0,
    skipped_missing_baseline_row: 0,
  };

  const reportLines: ReportLine[] = [];
  const sqlStatements: string[] = [];
  const examplesByReason: Record<SkipReason, Array<{ canon_id: string; before: string; after: string }>> = {
    same_text: [],
    empty_intent: [],
    forbidden_terms: [],
    too_long: [],
    invalid_output: [],
  };

  for (const row of limited) {
    const { intentText, intentSource, intentSnippet } = resolveIntent(row);
    const result = rewriteBaselineQuestion({
      current_question_text: row.question_text,
      intent_text: intentText,
      intent_source: intentSource,
      intent_snippet: intentSnippet,
      discipline_code: row.discipline_code,
      subtype_code: row.subtype_code,
    });

    const status: "UPDATED" | "SKIPPED" = result.status;
    const skip_reason: SkipReason | null = result.status === "SKIPPED" ? result.reason : null;

    if (status === "UPDATED") {
      assertBaselineQuestionLanguage(result.rewritten, intentSnippet);
      counts.updated_count += 1;
      sqlStatements.push(
        `UPDATE public.baseline_spines_runtime SET question_text = '${escapeSqlLiteral(result.rewritten)}' WHERE canon_id = '${escapeSqlLiteral(row.canon_id)}' AND active = true;`
      );
    } else {
      switch (result.reason) {
        case "same_text":
          counts.skipped_same_text += 1;
          break;
        case "empty_intent":
          counts.skipped_empty_intent += 1;
          break;
        case "forbidden_terms":
          counts.skipped_forbidden_terms += 1;
          break;
        case "too_long":
          counts.skipped_too_long += 1;
          break;
        case "invalid_output":
          counts.skipped_invalid_output += 1;
          break;
      }
      if (examplesByReason[result.reason].length < 5) {
        examplesByReason[result.reason].push({
          canon_id: row.canon_id,
          before: row.question_text,
          after: result.rewritten,
        });
      }
    }

    reportLines.push({
      canon_id: row.canon_id,
      discipline_code: row.discipline_code,
      subtype_code: row.subtype_code,
      status,
      skip_reason,
      intent_source: result.intentSource,
      intent_snippet: result.intentSnippet,
      before: row.question_text,
      after: result.rewritten,
    });
  }

  const outDirReport = path.dirname(outReport);
  const outDirSql = path.dirname(outSql);
  if (!fs.existsSync(outDirReport)) fs.mkdirSync(outDirReport, { recursive: true });
  if (!fs.existsSync(outDirSql)) fs.mkdirSync(outDirSql, { recursive: true });

  fs.writeFileSync(
    outReport,
    reportLines.map((l) => JSON.stringify(l)).join("\n") + (reportLines.length ? "\n" : ""),
    "utf-8"
  );
  fs.writeFileSync(
    outSql,
    sqlStatements.join("\n") + (sqlStatements.length ? "\n" : ""),
    "utf-8"
  );

  console.log(`[rewrite_baseline_questions] Report: ${outReport} (${reportLines.length} lines)`);
  console.log(`[rewrite_baseline_questions] SQL patch: ${outSql} (${sqlStatements.length} statements)`);

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(counts, null, 2));

  const reasonKeys: SkipReason[] = [
    "same_text",
    "empty_intent",
    "forbidden_terms",
    "too_long",
    "invalid_output",
  ];
  for (const reason of reasonKeys) {
    const examples = examplesByReason[reason];
    if (examples.length === 0) continue;
    console.log(`\n--- Top ${Math.min(5, examples.length)} examples: ${reason} ---`);
    for (const ex of examples) {
      console.log(`  canon_id: ${ex.canon_id}`);
      console.log(`  before: ${ex.before.slice(0, 100)}${ex.before.length > 100 ? "..." : ""}`);
      console.log(`  after:  ${ex.after.slice(0, 100)}${ex.after.length > 100 ? "..." : ""}`);
    }
  }

  if (apply && counts.updated_count > 0) {
    const toApply = reportLines.filter((l) => l.status === "UPDATED");
    for (const line of toApply) {
      await pool.query(
        `UPDATE public.baseline_spines_runtime SET question_text = $1 WHERE canon_id = $2 AND active = true`,
        [line.after, line.canon_id]
      );
    }
    console.log(`\n[rewrite_baseline_questions] Applied ${counts.updated_count} updates to runtime DB.`);
  } else if (apply) {
    console.log("\n[rewrite_baseline_questions] No rows to apply.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
