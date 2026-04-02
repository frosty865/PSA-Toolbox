/**
 * Generate Baseline Candidate Questions
 * 
 * OBJECTIVE: Generate ONE baseline candidate question per discipline subtype
 * - Source only from discipline_subtypes_rows.json
 * - Output candidates for human review before seeding
 * - Do NOT write directly to baseline_spines_runtime
 * 
 * RULES (NON-NEGOTIABLE):
 * - One candidate per subtype_code
 * - Existence-based only (YES / NO / N_A)
 * - No sector or subsector language
 * - No enumerations (fingerprint/facial/etc.)
 * - No "which / how / what"
 * - PSA physical security scope only
 * - Assign exactly ONE component (default to PROCESS if ambiguous)
 */

import * as fs from 'fs';
import * as path from 'path';

// Check multiple possible locations for input file
const INPUT_FILE_CANDIDATES = [
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'discipline_subtypes_rows.json'),
  path.join(process.cwd(), 'discipline_subtypes_rows.json'),
  path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json'),
  process.env.DISCIPLINE_SUBTYPES_INPUT_FILE || ''
].filter(Boolean);

const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'baseline_candidates.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'baseline_candidates.md');

interface SubtypeRow {
  id?: string;
  discipline_id?: string;
  discipline_code?: string; // May be missing, extract from code
  discipline_name?: string;
  code?: string; // Full subtype code (e.g., "EMR_BUSINESS_CONTINUITY")
  subtype_code?: string; // Alias for code
  name?: string; // Subtype name
  subtype_name?: string; // Alias for name
  description?: string | null;
  assessment_questions?: string[] | string; // May be string (JSON) or array
  suggested_questions?: string[] | string;
  [key: string]: any;
}

interface BaselineCandidate {
  discipline_code: string;
  subtype_code: string;
  subtype_name: string;
  component: string;
  proposed_question_text: string;
  source: 'suggested_questions' | 'generated_fallback';
  review_status: 'PENDING';
}

/**
 * Check if question contains forbidden words/phrases
 */
function containsForbiddenContent(question: string): boolean {
  // Check for forbidden question words
  if (/\b(which|how|what)\b/i.test(question)) {
    return true;
  }
  
  // Check for enumerations in parentheses (e.g., "(fingerprint, facial, iris)")
  // Look for parentheses containing commas or slashes
  if (/\([^)]*[,/]/.test(question)) {
    return true;
  }
  
  // Check for comma-separated lists (more than 2 commas suggests enumeration)
  // But allow commas in normal sentences (e.g., "Is a system, which is...")
  // Count commas that are likely list separators (followed by space and word)
  const listCommas = (question.match(/,\s+\w+/g) || []).length;
  if (listCommas > 2) {
    return true;
  }
  
  // Check for sector/subsector language (common patterns)
  if (/\b(sector|subsector|industry|vertical|commercial|industrial|retail|healthcare|education)\b/i.test(question)) {
    return true;
  }
  
  // Check for enumeration keywords
  if (/\b(such as|including|examples?|types?|kinds?|varieties?)\b/i.test(question)) {
    return true;
  }
  
  return false;
}

/**
 * Normalize question to "Is/Are" existence format
 */
function normalizeToExistence(question: string): string {
  let normalized = question.trim();
  
  // Remove trailing question marks and whitespace
  normalized = normalized.replace(/\?+\s*$/, '').trim();
  
  // If it already starts with "Is" or "Are", ensure it ends with ?
  if (/^(is|are)\s+/i.test(normalized)) {
    return normalized + '?';
  }
  
  // Remove leading "Does/Do" and convert to "Is/Are"
  if (/^(does|do)\s+/i.test(normalized)) {
    normalized = normalized.replace(/^(does|do)\s+/i, '');
    
    // Check if subject is plural (common plural words)
    const isPlural = /\b(systems|controls|measures|procedures|policies|devices|technologies|mechanisms|processes|tools|methods)\b/i.test(normalized);
    
    if (isPlural) {
      normalized = 'Are ' + normalized + '?';
    } else {
      normalized = 'Is ' + normalized + '?';
    }
    
    return normalized;
  }
  
  // For questions that don't start with Is/Are/Does/Do, try to convert
  // Check if it's about existence (contains existence verbs)
  const hasExistenceVerb = /\b(implemented|in place|exists|established|deployed|present|available|configured|installed|operational)\b/i.test(normalized);
  
  if (hasExistenceVerb) {
    // Check if subject is plural
    const isPlural = /\b(systems|controls|measures|procedures|policies|devices|technologies|mechanisms|processes|tools|methods)\b/i.test(normalized);
    
    if (isPlural) {
      normalized = 'Are ' + normalized + '?';
    } else {
      normalized = 'Is ' + normalized + '?';
    }
  } else {
    // Default: prepend "Is" and add "in place?" or "implemented?"
    // Check if it contains a capability/system/control/etc pattern
    if (/\b(capability|system|control|measure|procedure|policy|device|technology|mechanism|process|tool|method)\b/i.test(normalized)) {
      normalized = 'Is ' + normalized + ' implemented?';
    } else {
      normalized = 'Is ' + normalized + ' in place?';
    }
  }
  
  return normalized;
}

/**
 * Check if question can be rewritten to "Is/Are" format
 */
function canRewriteToIsAre(question: string): boolean {
  const lower = question.toLowerCase();
  
  // Must not contain forbidden content
  if (containsForbiddenContent(question)) {
    return false;
  }
  
  // Check if it's already existence-based or can be converted
  // Accept questions that:
  // - Start with "Is/Are/Does/Do"
  // - Contain existence verbs: "implemented", "in place", "exists", "established", "deployed"
  // - Are about capabilities, systems, controls, measures
  
  const existencePatterns = [
    /^(is|are|does|do)\s+/i,
    /\b(implemented|in place|exists|established|deployed|present|available|configured|installed|operational)\b/i,
    /\b(capability|system|control|measure|procedure|policy|device|technology)\b/i
  ];
  
  return existencePatterns.some(pattern => pattern.test(question));
}

/**
 * Select best question from suggested_questions array
 */
function selectBestQuestion(suggestedQuestions: string[]): string | null {
  if (!suggestedQuestions || suggestedQuestions.length === 0) {
    return null;
  }
  
  // Iterate in order, return first suitable question
  for (const question of suggestedQuestions) {
    if (!question || typeof question !== 'string') {
      continue;
    }
    
    const trimmed = question.trim();
    if (trimmed.length === 0) {
      continue;
    }
    
    // Check if it can be rewritten to Is/Are format
    if (canRewriteToIsAre(trimmed)) {
      return normalizeToExistence(trimmed);
    }
  }
  
  return null;
}

/**
 * Generate fallback question from subtype name
 */
function generateFallbackQuestion(subtypeName: string): string {
  // Clean subtype name
  let cleanName = subtypeName.trim();
  
  // Remove common prefixes/suffixes that might interfere
  cleanName = cleanName.replace(/^(the|a|an)\s+/i, '');
  
  // Generate: "Is a <subtype_name> capability implemented?"
  return `Is a ${cleanName} capability implemented?`;
}

/**
 * Extract discipline code from subtype code (e.g., "EMR_BUSINESS_CONTINUITY" -> "EMR")
 */
function extractDisciplineCode(subtypeCode: string): string {
  if (!subtypeCode) return 'UNKNOWN';
  const parts = subtypeCode.split('_');
  return parts[0] || 'UNKNOWN';
}

/**
 * Parse assessment_questions if it's a JSON string
 */
function parseQuestions(questions: string[] | string | null | undefined): string[] {
  if (!questions) return [];
  if (Array.isArray(questions)) return questions;
  if (typeof questions === 'string') {
    try {
      // Try parsing as JSON string
      const parsed = JSON.parse(questions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If not JSON, treat as single question
      return [questions];
    }
  }
  return [];
}

/**
 * Process a single subtype row
 */
function processSubtype(subtype: SubtypeRow): BaselineCandidate {
  // Get subtype code (check both field names)
  const subtypeCode = subtype.subtype_code || subtype.code || 'UNKNOWN';
  const subtypeName = subtype.subtype_name || subtype.name || 'Unknown';
  
  // Extract discipline code from subtype code if not provided
  let disciplineCode = subtype.discipline_code;
  if (!disciplineCode && subtypeCode) {
    disciplineCode = extractDisciplineCode(subtypeCode);
  }
  if (!disciplineCode) {
    disciplineCode = 'UNKNOWN';
  }
  
  // Get suggested questions (check both field names, handle JSON strings)
  const assessmentQuestionsRaw = subtype.suggested_questions || subtype.assessment_questions;
  const suggestedQuestions = parseQuestions(assessmentQuestionsRaw);
  
  // Try to select from suggested questions
  let proposedQuestion = selectBestQuestion(suggestedQuestions);
  let source: 'suggested_questions' | 'generated_fallback' = 'suggested_questions';
  
  // If no suitable question found, generate fallback
  if (!proposedQuestion) {
    proposedQuestion = generateFallbackQuestion(subtypeName);
    source = 'generated_fallback';
  }
  
  return {
    discipline_code: disciplineCode,
    subtype_code: subtypeCode,
    subtype_name: subtypeName,
    component: 'PROCESS', // Default to PROCESS as per requirements
    proposed_question_text: proposedQuestion,
    source,
    review_status: 'PENDING'
  };
}

/**
 * Main function
 */
async function main() {
  console.log('[INFO] Generating baseline candidate questions...\n');
  
  // Find input file in candidate locations
  let INPUT_FILE: string | null = null;
  for (const candidate of INPUT_FILE_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) {
      INPUT_FILE = candidate;
      break;
    }
  }
  
  if (!INPUT_FILE) {
    console.error(`[ERROR] Input file not found in any of these locations:`);
    INPUT_FILE_CANDIDATES.forEach(candidate => {
      if (candidate) {
        console.error(`  - ${candidate}`);
      }
    });
    console.error('\n[ERROR] Please ensure discipline_subtypes_rows.json exists in one of these locations.');
    console.error('[ERROR] Expected structure: Array of subtype objects with:');
    console.error('  - subtype_code (string)');
    console.error('  - subtype_name (string)');
    console.error('  - discipline_code (string)');
    console.error('  - suggested_questions (string[]) or assessment_questions (string[])');
    console.error('\n[INFO] You can also set DISCIPLINE_SUBTYPES_INPUT_FILE environment variable to specify a custom path.');
    process.exit(1);
  }
  
  // Read input file
  console.log(`[INFO] Reading input file: ${INPUT_FILE}`);
  let inputData: any;
  try {
    const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
    inputData = JSON.parse(fileContent);
  } catch (error: any) {
    console.error(`[ERROR] Failed to parse input file: ${error.message}`);
    process.exit(1);
  }
  
  // Handle different input formats
  let subtypes: SubtypeRow[];
  if (Array.isArray(inputData)) {
    subtypes = inputData;
  } else if (inputData.subtypes && Array.isArray(inputData.subtypes)) {
    subtypes = inputData.subtypes;
  } else if (inputData.rows && Array.isArray(inputData.rows)) {
    subtypes = inputData.rows;
  } else {
    console.error('[ERROR] Input file must contain an array of subtypes or an object with "subtypes" or "rows" property');
    process.exit(1);
  }
  
  // Guard: Check subtype count
  if (subtypes.length < 100) {
    console.error(`[ERROR] Subtype count (${subtypes.length}) is less than 100. This may indicate a partial load.`);
    console.error('[ERROR] Aborting to prevent incomplete candidate generation.');
    process.exit(1);
  }
  
  console.log(`[INFO] Processing ${subtypes.length} subtypes...\n`);
  
  // Process each subtype
  const candidates: BaselineCandidate[] = [];
  const subtypeCodesSeen = new Set<string>();
  
  for (const subtype of subtypes) {
    // Get subtype code (check both field names)
    const subtypeCode = subtype.subtype_code || subtype.code;
    if (!subtypeCode) {
      console.warn(`[WARN] Skipping subtype without subtype_code or code: ${JSON.stringify(subtype).substring(0, 100)}`);
      continue;
    }
    
    // Ensure one candidate per subtype_code
    if (subtypeCodesSeen.has(subtypeCode)) {
      console.warn(`[WARN] Duplicate subtype_code found: ${subtypeCode}. Skipping duplicate.`);
      continue;
    }
    
    subtypeCodesSeen.add(subtypeCode);
    
    try {
      const candidate = processSubtype(subtype);
      candidates.push(candidate);
    } catch (error: any) {
      const subtypeCode = subtype.subtype_code || subtype.code || 'UNKNOWN';
      console.error(`[ERROR] Failed to process subtype ${subtypeCode}: ${error.message}`);
      // Continue processing other subtypes
    }
  }
  
  console.log(`[INFO] Generated ${candidates.length} candidates\n`);
  
  // Count sources
  const fromSuggested = candidates.filter(c => c.source === 'suggested_questions').length;
  const fromFallback = candidates.filter(c => c.source === 'generated_fallback').length;
  
  console.log(`[INFO] Source breakdown:`);
  console.log(`  - From suggested_questions: ${fromSuggested}`);
  console.log(`  - From generated fallback: ${fromFallback}\n`);
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Write JSON output
  console.log(`[INFO] Writing JSON output: ${OUTPUT_JSON}`);
  const jsonOutput = {
    metadata: {
      generated_at: new Date().toISOString(),
      total_candidates: candidates.length,
      source_file: INPUT_FILE,
      from_suggested_questions: fromSuggested,
      from_generated_fallback: fromFallback
    },
    candidates
  };
  
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(jsonOutput, null, 2), 'utf-8');
  console.log(`[OK] JSON output written\n`);
  
  // Write Markdown output
  console.log(`[INFO] Writing Markdown output: ${OUTPUT_MD}`);
  let mdContent = `# Baseline Candidate Questions\n\n`;
  mdContent += `Generated: ${new Date().toISOString()}\n\n`;
  mdContent += `## Summary\n\n`;
  mdContent += `- **Total subtypes processed:** ${subtypes.length}\n`;
  mdContent += `- **Candidates generated:** ${candidates.length}\n`;
  mdContent += `- **From suggested_questions:** ${fromSuggested}\n`;
  mdContent += `- **From generated fallback:** ${fromFallback}\n\n`;
  mdContent += `---\n\n`;
  mdContent += `## Candidates\n\n`;
  mdContent += `| Discipline | Subtype | Proposed Baseline Question | Source |\n`;
  mdContent += `|------------|---------|---------------------------|--------|\n`;
  
  // Sort by discipline_code, then subtype_code
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (a.discipline_code !== b.discipline_code) {
      return a.discipline_code.localeCompare(b.discipline_code);
    }
    return a.subtype_code.localeCompare(b.subtype_code);
  });
  
  for (const candidate of sortedCandidates) {
    const questionEscaped = candidate.proposed_question_text.replace(/\|/g, '\\|');
    const sourceBadge = candidate.source === 'suggested_questions' ? '✓' : '⚠️';
    mdContent += `| ${candidate.discipline_code} | ${candidate.subtype_code} | ${questionEscaped} | ${sourceBadge} |\n`;
  }
  
  fs.writeFileSync(OUTPUT_MD, mdContent, 'utf-8');
  console.log(`[OK] Markdown output written\n`);
  
  console.log(`[OK] Generation complete!`);
  console.log(`\nOutput files:`);
  console.log(`  - ${OUTPUT_JSON}`);
  console.log(`  - ${OUTPUT_MD}`);
  console.log(`\n[INFO] Review candidates before seeding to baseline_spines_runtime.`);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('[FATAL]', error);
    process.exit(1);
  });
}

export { main as generateBaselineCandidates };
