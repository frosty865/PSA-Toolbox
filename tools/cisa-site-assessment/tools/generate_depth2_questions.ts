/**
 * Generate Depth-2 (Conditional) Baseline Questions
 * 
 * OBJECTIVE: Generate conditional baseline questions (Depth-2) for all subtypes using
 * the "Assessment Questions" field from discipline_subtypes_rows.json.
 * 
 * Depth-2 questions are conditional follow-ups that appear only when the parent
 * baseline spine (Depth-1) is answered YES.
 * 
 * RULES (PSA PHYSICAL SECURITY SCOPE):
 * - PSA physical security only
 * - NO regulatory, cyber, or compliance language
 * - NO technologies, vendors, costs, or implementation steps
 * - Questions describe WHAT condition exists, not HOW it is done
 * - response_enum defaults to ["YES","NO","N_A"]
 * - response_type may be ENUM when the source question is explicitly non-binary
 * 
 * VALIDATION:
 * - Every Depth-2 question must have a parent baseline spine
 * - No subtype may generate more than 6 Depth-2 questions
 * - Zero orphan questions allowed
 * - Hard fail if any subtype has Depth-2 questions but no Depth-1 parent
 * 
 * OUTPUTS:
 * - tools/outputs/baseline_depth2_questions.json
 * - tools/outputs/baseline_depth2_questions.sql
 * - tools/outputs/baseline_depth2_review.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
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

const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
const BASELINE_SPINES_FILE = path.join(process.cwd(), 'baseline_spines_runtime_rows.json');
const ROWS_FILE_CANDIDATES = [
  path.join(process.cwd(), 'src', 'data', 'discipline_subtypes_rows.json'),
  '/mnt/data/discipline_subtypes_rows (1).json',
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'discipline_subtypes_rows.json'),
].filter(Boolean);

const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'baseline_depth2_questions.json');
const OUTPUT_SQL = path.join(OUTPUT_DIR, 'baseline_depth2_questions.sql');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'baseline_depth2_review.md');

// Forbidden words/phrases that violate existence-only rule
const FORBIDDEN_WORDS = [
  'how', 'which', 'regularly', 'adequate', 'effective', 'aligned', 'by whom',
  'how often', 'according to', 'rated', 'provide facial', 'verify step',
  'tested', 'what', 'when', 'where', 'why', 'who'
];

// Words/phrases to remove or rewrite
const REMOVE_PATTERNS = [
  /\b(how|which|regularly|adequate|effective|aligned|by whom|how often|according to|rated)\b/gi,
  /\b(tested regularly|tested frequently|tested periodically)\b/gi,
];

interface TaxonomySubtype {
  id: string;
  name: string;
  subtype_code: string;
  discipline_code: string;
  discipline_name: string;
  is_active: boolean;
}

interface BaselineSpine {
  canon_id: string;
  discipline_code: string;
  subtype_code?: string | null;
  question_text: string;
  response_enum: ["YES", "NO", "N_A"];
  canon_version: string;
  active?: boolean;
}

interface SubtypeRow {
  id: string;
  code: string;
  name: string;
  assessment_questions?: string; // JSON string array
  [key: string]: any;
}

interface Depth2Question {
  question_code: string;
  parent_spine_canon_id: string;
  discipline_code: string;
  subtype_code: string;
  question_text: string;
  response_enum: ["YES", "NO", "N_A"];
  response_type?: "YES_NO_NA" | "ENUM";
  response_options?: Array<{ value: string; label: string }> | null;
  layer: string;
  depth: number;
  order_index: number;
  source_question: string; // Original assessment question
}

interface GenerationReport {
  total_subtypes: number;
  subtypes_with_assessment_questions: number;
  subtypes_with_parent_spines: number;
  total_depth2_questions: number;
  subtypes_with_depth2: number;
  max_questions_per_subtype: number;
  validation_errors: string[];
  warnings: string[];
  by_subtype: Array<{
    subtype_code: string;
    subtype_name: string;
    discipline_code: string;
    parent_spine_canon_id: string | null;
    parent_spine_text: string | null;
    assessment_questions_count: number;
    depth2_questions_count: number;
    depth2_questions: Depth2Question[];
  }>;
}

/**
 * Load taxonomy subtypes
 */
function loadTaxonomy(): TaxonomySubtype[] {
  if (!fs.existsSync(TAXONOMY_FILE)) {
    throw new Error(`Taxonomy file not found: ${TAXONOMY_FILE}`);
  }
  
  const content = fs.readFileSync(TAXONOMY_FILE, 'utf-8');
  const data = JSON.parse(content);
  
  if (!data.subtypes || !Array.isArray(data.subtypes)) {
    throw new Error('Taxonomy file must contain a "subtypes" array');
  }
  
  return data.subtypes.filter((s: TaxonomySubtype) => s.is_active !== false);
}

/**
 * Load baseline spines (Depth-1) from database
 */
async function loadBaselineSpines(): Promise<Map<string, BaselineSpine>> {
  const spineMap = new Map<string, BaselineSpine>();
  
  try {
    const pool = await ensureRuntimePoolConnected();
    
    const query = `
      SELECT 
        canon_id,
        discipline_code,
        subtype_code,
        question_text,
        response_enum,
        canon_version,
        active
      FROM public.baseline_spines_runtime
      WHERE active = true
        AND subtype_code IS NOT NULL
        AND subtype_code <> ''
      ORDER BY discipline_code, subtype_code, canon_id
    `;
    
    const result = await pool.query(query);
    const spines: BaselineSpine[] = result.rows;
    
    // Build map by subtype_code
    for (const spine of spines) {
      if (spine.subtype_code) {
        spineMap.set(spine.subtype_code, spine);
      }
    }
    
    await pool.end();
  } catch (error) {
    // Fallback to file if database fails
    console.warn(`[WARN] Database query failed: ${error instanceof Error ? error.message : String(error)}`);
    console.warn(`[WARN] Attempting to load from file: ${BASELINE_SPINES_FILE}`);
    
    if (fs.existsSync(BASELINE_SPINES_FILE)) {
      const content = fs.readFileSync(BASELINE_SPINES_FILE, 'utf-8');
      const data = JSON.parse(content);
      
      let spines: BaselineSpine[] = [];
      if (Array.isArray(data)) {
        spines = data;
      } else if (data.rows && Array.isArray(data.rows)) {
        spines = data.rows;
      } else if (data.spines && Array.isArray(data.spines)) {
        spines = data.spines;
      }
      
      for (const spine of spines) {
        if (spine.subtype_code && spine.active !== false) {
          spineMap.set(spine.subtype_code, spine);
        }
      }
    } else {
      console.warn(`[WARN] Baseline spines file not found: ${BASELINE_SPINES_FILE}`);
      console.warn('[WARN] Will attempt to generate Depth-2 questions without parent validation');
    }
  }
  
  return spineMap;
}

/**
 * Load subtype rows with assessment questions
 */
function loadSubtypeRows(): Map<string, SubtypeRow> {
  let rowsFile: string | null = null;
  
  for (const candidate of ROWS_FILE_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      rowsFile = candidate;
      break;
    }
  }
  
  if (!rowsFile) {
    throw new Error(`Subtype rows file not found in any of: ${ROWS_FILE_CANDIDATES.join(', ')}`);
  }
  
  const content = fs.readFileSync(rowsFile, 'utf-8');
  const data = JSON.parse(content);
  
  if (!Array.isArray(data)) {
    throw new Error('Subtype rows file must be a JSON array');
  }
  
  const rowsMap = new Map<string, SubtypeRow>();
  for (const row of data) {
    if (row.code && row.assessment_questions) {
      rowsMap.set(row.code, row);
    }
  }
  
  return rowsMap;
}

/**
 * Normalize question text for deduplication
 */
function normalizeQuestionTextForDedup(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/^(is|are|does|do)\s+/i, ''); // Remove leading question words
}

function inferDepth2ResponseSpec(questionText: string): {
  response_type: "YES_NO_NA" | "ENUM";
  response_options?: Array<{ value: string; label: string }> | null;
} {
  const normalized = questionText.toLowerCase();
  if (normalized.includes('on-site') && normalized.includes('off-site') && normalized.includes('both')) {
    return {
      response_type: 'ENUM',
      response_options: [
        { value: 'ON_SITE', label: 'On-site' },
        { value: 'OFF_SITE', label: 'Off-site' },
        { value: 'BOTH', label: 'Both' },
      ],
    };
  }
  return { response_type: 'YES_NO_NA', response_options: null };
}

/**
 * Normalize question text: trim, collapse whitespace, ensure ends with "?"
 * Title-case NOT required; keep sentence case
 */
function normalizeQuestionText(raw: string): string {
  let normalized = raw.trim();
  
  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Ensure it ends with "?"
  if (!normalized.endsWith('?')) {
    normalized += '?';
  }
  
  return normalized;
}

/**
 * Check if question contains forbidden words
 */
function containsForbiddenWords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.some(word => lower.includes(word.toLowerCase()));
}

/**
 * Rewrite assessment question into existence/condition form
 */
function rewriteQuestion(original: string, subtypeName: string): string {
  let rewritten = original.trim();
  
  // Remove forbidden patterns
  for (const pattern of REMOVE_PATTERNS) {
    rewritten = rewritten.replace(pattern, '');
  }
  
  // Remove question words that indicate "how/which/what"
  rewritten = rewritten.replace(/^(what|how|which|when|where|why|who)\s+/i, '');
  
  // Convert multi-part questions to simplest form
  // Split on "?" and take first part if multiple questions
  const parts = rewritten.split('?').filter(p => p.trim());
  if (parts.length > 1) {
    rewritten = parts[0].trim();
  }
  
  // Remove trailing "?" if present (will be re-added by normalization)
  rewritten = rewritten.replace(/\?+$/, '').trim();
  
  // GUARD: Check if it already starts with a modal verb
  const modalVerbPattern = /^(Can|Do|Does|Are|Is|Will|Should|May|Must|Has|Have|Did)\b/i;
  const startsWithModal = modalVerbPattern.test(rewritten);
  
  if (startsWithModal) {
    // Already starts with modal verb - just normalize, don't prefix
    rewritten = normalizeQuestionText(rewritten);
    
    // Cleanup: Remove double prefixes if somehow present
    rewritten = rewritten.replace(/^Is Can /i, 'Can ');
    rewritten = rewritten.replace(/^Are Can /i, 'Can ');
    rewritten = rewritten.replace(/^Is Do /i, 'Do ');
    rewritten = rewritten.replace(/^Is Does /i, 'Does ');
    rewritten = rewritten.replace(/^Is Are /i, 'Are ');
    rewritten = rewritten.replace(/^Is Is /i, 'Is ');
    rewritten = rewritten.replace(/^Are Is /i, 'Is ');
    rewritten = rewritten.replace(/^Are Are /i, 'Are ');
    
    // Clean up multiple spaces
    rewritten = rewritten.replace(/\s+/g, ' ').trim();
    
    return rewritten;
  }
  
  // Convert to existence form if not already a question
  // If it starts with "Are/Is/Do/Does", keep it
  if (/^(are|is|does|do)\s+/i.test(rewritten)) {
    // Already in question form, normalize
    rewritten = normalizeQuestionText(rewritten);
  } else {
    // Convert statement to question
    // Check if it's about existence/implementation
    const hasExistenceVerb = /\b(exists|implemented|in place|established|deployed|present|available|configured|installed|operational|defined|documented)\b/i.test(rewritten);
    
    if (hasExistenceVerb) {
      // Check if plural
      const isPlural = /\b(systems|controls|measures|procedures|policies|devices|technologies|mechanisms|processes|tools|methods|readers|functions|resources|partners|suppliers|lessons|updates)\b/i.test(rewritten);
      if (isPlural) {
        rewritten = 'Are ' + rewritten + '?';
      } else {
        rewritten = 'Is ' + rewritten + '?';
      }
    } else {
      // Generic fallback: "Is [capability] [condition]?"
      rewritten = 'Is ' + rewritten + '?';
    }
    
    // Normalize after adding prefix
    rewritten = normalizeQuestionText(rewritten);
  }
  
  // Cleanup: Remove double prefixes if somehow present
  rewritten = rewritten.replace(/^Is Can /i, 'Can ');
  rewritten = rewritten.replace(/^Are Can /i, 'Can ');
  rewritten = rewritten.replace(/^Is Do /i, 'Do ');
  rewritten = rewritten.replace(/^Is Does /i, 'Does ');
  rewritten = rewritten.replace(/^Is Are /i, 'Are ');
  rewritten = rewritten.replace(/^Is Is /i, 'Is ');
  rewritten = rewritten.replace(/^Are Is /i, 'Is ');
  rewritten = rewritten.replace(/^Are Are /i, 'Are ');
  
  // Clean up multiple spaces
  rewritten = rewritten.replace(/\s+/g, ' ').trim();
  
  return rewritten;
}

/**
 * Generate question code for Depth-2 question
 */
function generateQuestionCode(parentCanonId: string, orderIndex: number): string {
  // Format: <PARENT_CANON_ID>-D2-<ORDER>
  // e.g., BASE-ACS-ACS_BIOMETRIC_ACCESS-D2-001
  const padded = String(orderIndex).padStart(3, '0');
  return `${parentCanonId}-D2-${padded}`;
}

/**
 * Main generation function
 */
async function main(): Promise<void> {
  console.log('## Generate Depth-2 Baseline Questions\n');
  
  // Load inputs
  console.log('Loading inputs...');
  const taxonomy = loadTaxonomy();
  console.log(`  ✓ Loaded ${taxonomy.length} active subtypes from taxonomy`);
  
  const baselineSpines = await loadBaselineSpines();
  console.log(`  ✓ Loaded ${baselineSpines.size} baseline spines (Depth-1)`);
  
  const subtypeRows = loadSubtypeRows();
  console.log(`  ✓ Loaded ${subtypeRows.size} subtype rows with assessment questions`);
  
  // Build report
  const report: GenerationReport = {
    total_subtypes: taxonomy.length,
    subtypes_with_assessment_questions: 0,
    subtypes_with_parent_spines: 0,
    total_depth2_questions: 0,
    subtypes_with_depth2: 0,
    max_questions_per_subtype: 0,
    validation_errors: [],
    warnings: [],
    by_subtype: []
  };
  
  const allDepth2Questions: Depth2Question[] = [];
  
  // Process each subtype
  console.log('\nProcessing subtypes...');
  for (const subtype of taxonomy) {
    const row = subtypeRows.get(subtype.subtype_code);
    const parentSpine = baselineSpines.get(subtype.subtype_code);
    
    if (!row || !row.assessment_questions) {
      continue; // Skip if no assessment questions
    }
    
    report.subtypes_with_assessment_questions++;
    
    if (!parentSpine) {
      report.warnings.push(`Subtype ${subtype.subtype_code} has assessment questions but no parent baseline spine`);
      continue; // Skip if no parent spine
    }
    
    report.subtypes_with_parent_spines++;
    
    // Parse assessment questions
    let assessmentQuestions: string[] = [];
    try {
      assessmentQuestions = JSON.parse(row.assessment_questions);
      if (!Array.isArray(assessmentQuestions)) {
        assessmentQuestions = [];
      }
    } catch (e) {
      report.warnings.push(`Failed to parse assessment_questions for ${subtype.subtype_code}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    
    if (assessmentQuestions.length === 0) {
      continue;
    }
    
    // Rewrite and deduplicate questions
    const rewrittenQuestions = new Map<string, Depth2Question>();
    
    for (let i = 0; i < assessmentQuestions.length; i++) {
      const original = assessmentQuestions[i].trim();
      if (!original) continue;
      
      // Skip if contains forbidden words
      if (containsForbiddenWords(original)) {
        report.warnings.push(`Skipping question for ${subtype.subtype_code} (contains forbidden words): "${original.substring(0, 60)}..."`);
        continue;
      }
      
      // Rewrite question
      const rewritten = rewriteQuestion(original, subtype.name);
      
      // Normalize for deduplication
      const normalized = normalizeQuestionTextForDedup(rewritten);
      
      // Skip if duplicate
      if (rewrittenQuestions.has(normalized)) {
        continue;
      }
      
      // Create Depth-2 question
      const orderIndex = rewrittenQuestions.size + 1;
      const questionCode = generateQuestionCode(parentSpine.canon_id, orderIndex);
      
      const depth2Question: Depth2Question = {
        question_code: questionCode,
        parent_spine_canon_id: parentSpine.canon_id,
        discipline_code: subtype.discipline_code,
        subtype_code: subtype.subtype_code,
        question_text: rewritten,
        response_enum: ["YES", "NO", "N_A"],
        ...inferDepth2ResponseSpec(rewritten),
        layer: "baseline",
        depth: 2,
        order_index: orderIndex,
        source_question: original
      };
      
      rewrittenQuestions.set(normalized, depth2Question);
      
      // Enforce max 6 questions per subtype
      if (rewrittenQuestions.size >= 6) {
        break;
      }
    }
    
    const depth2Questions = Array.from(rewrittenQuestions.values());
    
    if (depth2Questions.length > 0) {
      report.subtypes_with_depth2++;
      report.total_depth2_questions += depth2Questions.length;
      report.max_questions_per_subtype = Math.max(report.max_questions_per_subtype, depth2Questions.length);
      
      allDepth2Questions.push(...depth2Questions);
      
      report.by_subtype.push({
        subtype_code: subtype.subtype_code,
        subtype_name: subtype.name,
        discipline_code: subtype.discipline_code,
        parent_spine_canon_id: parentSpine.canon_id,
        parent_spine_text: parentSpine.question_text,
        assessment_questions_count: assessmentQuestions.length,
        depth2_questions_count: depth2Questions.length,
        depth2_questions: depth2Questions
      });
    }
  }
  
  // Validation
  console.log('\nValidating...');
  
  // Check for orphans (Depth-2 questions without parent)
  const parentCanonIds = new Set(Array.from(baselineSpines.values()).map(s => s.canon_id));
  for (const q of allDepth2Questions) {
    if (!parentCanonIds.has(q.parent_spine_canon_id)) {
      report.validation_errors.push(`Orphan question: ${q.question_code} has parent ${q.parent_spine_canon_id} but parent spine not found`);
    }
    // Also check that subtype has a parent spine
    if (!baselineSpines.has(q.subtype_code)) {
      report.validation_errors.push(`Orphan question: ${q.question_code} belongs to subtype ${q.subtype_code} which has no parent baseline spine`);
    }
  }
  
  // Check max questions per subtype
  for (const subtypeData of report.by_subtype) {
    if (subtypeData.depth2_questions_count > 6) {
      report.validation_errors.push(`Subtype ${subtypeData.subtype_code} has ${subtypeData.depth2_questions_count} Depth-2 questions (max 6)`);
    }
  }
  
  // Hard fail on validation errors
  if (report.validation_errors.length > 0) {
    console.error('\n❌ VALIDATION ERRORS:');
    for (const error of report.validation_errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
  
  // Sort questions deterministically
  allDepth2Questions.sort((a, b) => {
    if (a.discipline_code !== b.discipline_code) {
      return a.discipline_code.localeCompare(b.discipline_code);
    }
    if (a.subtype_code !== b.subtype_code) {
      return a.subtype_code.localeCompare(b.subtype_code);
    }
    return a.order_index - b.order_index;
  });
  
  // Generate outputs
  console.log('\nGenerating outputs...');
  
  // JSON output
  const jsonOutput = {
    metadata: {
      generated_at: new Date().toISOString(),
      total_depth2_questions: allDepth2Questions.length,
      subtypes_with_depth2: report.subtypes_with_depth2,
      validation_passed: report.validation_errors.length === 0
    },
    questions: allDepth2Questions,
    report: report
  };
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(jsonOutput, null, 2));
  console.log(`  ✓ ${OUTPUT_JSON}`);
  
  // SQL output
  generateSQL(allDepth2Questions, report);
  console.log(`  ✓ ${OUTPUT_SQL}`);
  
  // Review markdown
  generateReviewMarkdown(report);
  console.log(`  ✓ ${OUTPUT_MD}`);
  
  // Summary
  console.log('\n## Summary');
  console.log(`  Total subtypes: ${report.total_subtypes}`);
  console.log(`  Subtypes with assessment questions: ${report.subtypes_with_assessment_questions}`);
  console.log(`  Subtypes with parent spines: ${report.subtypes_with_parent_spines}`);
  console.log(`  Subtypes with Depth-2 questions: ${report.subtypes_with_depth2}`);
  console.log(`  Total Depth-2 questions: ${report.total_depth2_questions}`);
  console.log(`  Max questions per subtype: ${report.max_questions_per_subtype}`);
  console.log(`  Validation errors: ${report.validation_errors.length}`);
  console.log(`  Warnings: ${report.warnings.length}`);
  
  if (report.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const warning of report.warnings.slice(0, 10)) {
      console.log(`  - ${warning}`);
    }
    if (report.warnings.length > 10) {
      console.log(`  ... and ${report.warnings.length - 10} more warnings`);
    }
  }
  
  const coveragePercent = (report.subtypes_with_depth2 / report.total_subtypes) * 100;
  console.log(`\n✓ Coverage: ${coveragePercent.toFixed(1)}% of subtypes have Depth-2 questions`);
  
  if (coveragePercent < 90) {
    console.warn(`\n⚠️  WARNING: Coverage is below 90% target (${coveragePercent.toFixed(1)}%)`);
  }
}

/**
 * Generate SQL output
 */
function generateSQL(questions: Depth2Question[], report: GenerationReport): void {
  const lines: string[] = [];
  
  lines.push('-- Depth-2 (Conditional) Baseline Questions');
  lines.push('-- Generated: ' + new Date().toISOString());
  lines.push('--');
  lines.push('-- PURPOSE:');
  lines.push('--   These questions are conditional follow-ups that appear only when');
  lines.push('--   the parent baseline spine (Depth-1) is answered YES.');
  lines.push('--');
  lines.push('-- CONDITIONAL LOGIC:');
  lines.push('--   Depth-2 questions are shown conditionally based on parent answer:');
  lines.push('--   - IF parent_spine.response = "YES" THEN show Depth-2 questions');
  lines.push('--   - IF parent_spine.response = "NO" OR "N_A" THEN hide Depth-2 questions');
  lines.push('--');
  lines.push('-- VALIDATION:');
  lines.push(`--   Total questions: ${questions.length}`);
  lines.push(`--   Subtypes covered: ${report.subtypes_with_depth2}`);
  lines.push(`--   Max per subtype: ${report.max_questions_per_subtype}`);
  lines.push('--');
  lines.push('');
  
  // Note: Assuming baseline_questions table exists with these columns:
  // id, question_code, parent_spine_canon_id, discipline_code, subtype_code,
  // question_text, response_enum, layer, depth, order_index, created_at, updated_at
  
  for (const q of questions) {
    const responseEnumJson = JSON.stringify(q.response_enum);
    
    lines.push(`INSERT INTO public.baseline_questions (`);
    lines.push(`  question_code,`);
    lines.push(`  parent_spine_canon_id,`);
    lines.push(`  discipline_code,`);
    lines.push(`  subtype_code,`);
    lines.push(`  question_text,`);
    lines.push(`  response_enum,`);
    lines.push(`  layer,`);
    lines.push(`  depth,`);
    lines.push(`  order_index`);
    lines.push(`) VALUES (`);
    lines.push(`  '${q.question_code.replace(/'/g, "''")}',`);
    lines.push(`  '${q.parent_spine_canon_id.replace(/'/g, "''")}',`);
    lines.push(`  '${q.discipline_code.replace(/'/g, "''")}',`);
    lines.push(`  '${q.subtype_code.replace(/'/g, "''")}',`);
    lines.push(`  '${q.question_text.replace(/'/g, "''")}',`);
    lines.push(`  '${responseEnumJson}'::jsonb,`);
    lines.push(`  '${q.layer}',`);
    lines.push(`  ${q.depth},`);
    lines.push(`  ${q.order_index}`);
    lines.push(`) ON CONFLICT (question_code) DO NOTHING;`);
    lines.push('');
  }
  
  fs.writeFileSync(OUTPUT_SQL, lines.join('\n'));
}

/**
 * Generate review markdown
 */
function generateReviewMarkdown(report: GenerationReport): void {
  const lines: string[] = [];
  
  lines.push('# Depth-2 Baseline Questions Review');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total subtypes:** ${report.total_subtypes}`);
  lines.push(`- **Subtypes with assessment questions:** ${report.subtypes_with_assessment_questions}`);
  lines.push(`- **Subtypes with parent spines:** ${report.subtypes_with_parent_spines}`);
  lines.push(`- **Subtypes with Depth-2 questions:** ${report.subtypes_with_depth2}`);
  lines.push(`- **Total Depth-2 questions:** ${report.total_depth2_questions}`);
  lines.push(`- **Max questions per subtype:** ${report.max_questions_per_subtype}`);
  lines.push('');
  
  const coveragePercent = (report.subtypes_with_depth2 / report.total_subtypes) * 100;
  lines.push(`- **Coverage:** ${coveragePercent.toFixed(1)}%`);
  lines.push('');
  
  if (report.validation_errors.length > 0) {
    lines.push('## ❌ Validation Errors');
    lines.push('');
    for (const error of report.validation_errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }
  
  if (report.warnings.length > 0) {
    lines.push('## ⚠️  Warnings');
    lines.push('');
    for (const warning of report.warnings.slice(0, 20)) {
      lines.push(`- ${warning}`);
    }
    if (report.warnings.length > 20) {
      lines.push(`- ... and ${report.warnings.length - 20} more warnings`);
    }
    lines.push('');
  }
  
  lines.push('## By Subtype');
  lines.push('');
  
  // Sort by discipline_code, then subtype_code
  report.by_subtype.sort((a, b) => {
    if (a.discipline_code !== b.discipline_code) {
      return a.discipline_code.localeCompare(b.discipline_code);
    }
    return a.subtype_code.localeCompare(b.subtype_code);
  });
  
  for (const subtypeData of report.by_subtype) {
    lines.push(`### ${subtypeData.subtype_name} (${subtypeData.subtype_code})`);
    lines.push('');
    lines.push(`**Discipline:** ${subtypeData.discipline_code}`);
    lines.push(`**Parent Spine:** ${subtypeData.parent_spine_canon_id}`);
    lines.push(`**Parent Question:** ${subtypeData.parent_spine_text}`);
    lines.push(`**Assessment Questions:** ${subtypeData.assessment_questions_count}`);
    lines.push(`**Depth-2 Questions:** ${subtypeData.depth2_questions_count}`);
    lines.push('');
    
    lines.push('#### Depth-2 Questions:');
    lines.push('');
    for (const q of subtypeData.depth2_questions) {
      lines.push(`1. **${q.question_code}**`);
      lines.push(`   - Question: ${q.question_text}`);
      lines.push(`   - Source: "${q.source_question}"`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }
  
  fs.writeFileSync(OUTPUT_MD, lines.join('\n'));
}

/**
 * Smoke test for question normalization
 */
function runSmokeTests(): void {
  const testCases: Array<{ input: string; expected: string }> = [
    {
      input: "Can emergency messages override routine paging?",
      expected: "Can emergency messages override routine paging?"
    },
    {
      input: "Is Can emergency messages override routine paging?",
      expected: "Can emergency messages override routine paging?"
    },
    {
      input: "Do paging announcements support zone selection?",
      expected: "Do paging announcements support zone selection?"
    },
    {
      input: "Is there a defined paging method for emergencies?",
      expected: "Is there a defined paging method for emergencies?"
    },
    {
      input: "Does the system support multiple zones?",
      expected: "Does the system support multiple zones?"
    },
    {
      input: "Are backup systems in place?",
      expected: "Are backup systems in place?"
    },
    {
      input: "Will the system failover automatically?",
      expected: "Will the system failover automatically?"
    },
    {
      input: "Should alarms be monitored 24/7?",
      expected: "Should alarms be monitored 24/7?"
    },
    {
      input: "May visitors access restricted areas?",
      expected: "May visitors access restricted areas?"
    },
    {
      input: "Has the system been tested?",
      expected: "Has the system been tested?"
    },
    {
      input: "Have procedures been documented?",
      expected: "Have procedures been documented?"
    },
    {
      input: "Did the assessment cover all areas?",
      expected: "Did the assessment cover all areas?"
    },
    {
      input: "Must all users be authenticated?",
      expected: "Must all users be authenticated?"
    }
  ];
  
  console.log('Running smoke tests for question normalization...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = rewriteQuestion(testCase.input, 'Test Subtype');
    if (result === testCase.expected) {
      passed++;
      console.log(`✓ PASS: "${testCase.input}" → "${result}"`);
    } else {
      failed++;
      console.error(`✗ FAIL: "${testCase.input}"`);
      console.error(`  Expected: "${testCase.expected}"`);
      console.error(`  Got:      "${result}"`);
    }
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.error('\n❌ Smoke tests failed!');
    process.exit(1);
  } else {
    console.log('\n✓ All smoke tests passed!');
  }
}

// Run
if (require.main === module) {
  // Run smoke tests if DEPTH2_TEST env var is set
  if (process.env.DEPTH2_TEST === '1') {
    runSmokeTests();
    process.exit(0);
  }
  
  (async () => {
    try {
      await main();
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  })();
}
