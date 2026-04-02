/**
 * Validate Intent Objects
 * 
 * Validates generated intent objects against schema and business rules.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables
dotenv.config({ path: '.env.local' });

const INTENT_OBJECTS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'intent_objects.v1.json');
const BASELINE_SPINES_FILE = path.join(process.cwd(), 'baseline_spines_runtime_rows.json');
const DEPTH2_QUESTIONS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'baseline_depth2_questions.json');

// Forbidden words list (judgement/prescription language)
const FORBIDDEN_WORDS = [
  'regulatory', 'cyber', 'data governance', 'vendor', 'product', 'cost', 'timeline',
  'regularly', 'adequate', 'effective', 'aligned', 'compliance', 'framework',
  'governance', 'program', 'capabilities', 'processes',
  // Additional forbidden judgement/prescription language
  'adequate', 'effective', 'regularly', 'aligned', 'tested', 'by whom', 'shall', 'must',
  'ensure', 'implement', 'install'
];

// Allowed typical_evidence values
const ALLOWED_EVIDENCE_BUCKETS = [
  'Documented procedures or plans',
  'Diagrams or layouts',
  'Inventories or logs',
  'Records demonstrating use',
  'Demonstration by responsible personnel',
  'Configuration listings or inventories'
];

interface IntentObject {
  canon_id: string;
  layer: string;
  depth: number;
  discipline_code: string;
  subtype_code: string;
  question_text: string;
  intent: string;
  what_counts_as_yes: string[];
  what_does_not_count: string[];
  typical_evidence: string[];
  field_tip: string;
  references: string[];
  source: {
    subtype_guidance_used: boolean;
    guidance_fields_used: string[];
  };
}

interface IntentObjectsOutput {
  version: string;
  generated_at: string;
  questions: IntentObject[];
}

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    total_questions: number;
    depth1_count: number;
    depth2_count: number;
    expected_depth1_count: number;
    expected_depth2_count: number;
    unique_canon_ids: number;
  };
}

/**
 * Check if text contains forbidden words
 */
function containsForbiddenWords(text: string): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const word of FORBIDDEN_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      found.push(word);
    }
  }
  
  return found;
}

/**
 * Validate a single intent object
 */
function validateIntentObject(obj: IntentObject, index: number): string[] {
  const errors: string[] = [];
  
  // Required fields
  if (!obj.canon_id || typeof obj.canon_id !== 'string' || obj.canon_id.trim().length === 0) {
    errors.push(`[${index}] Missing or empty canon_id`);
  }
  
  if (obj.depth !== 1 && obj.depth !== 2) {
    errors.push(`[${index}] Invalid depth: ${obj.depth} (must be 1 or 2)`);
  }
  
  if (!obj.question_text || typeof obj.question_text !== 'string' || obj.question_text.trim().length === 0) {
    errors.push(`[${index}] Missing or empty question_text`);
  }
  
  if (!obj.intent || typeof obj.intent !== 'string' || obj.intent.trim().length === 0) {
    errors.push(`[${index}] Missing or empty intent`);
  }
  
  // Arrays present and within caps
  if (!Array.isArray(obj.what_counts_as_yes)) {
    errors.push(`[${index}] what_counts_as_yes must be an array`);
  } else {
    if (obj.what_counts_as_yes.length === 0) {
      errors.push(`[${index}] what_counts_as_yes is empty (must have at least 2 items)`);
    } else if (obj.what_counts_as_yes.length > 5) {
      errors.push(`[${index}] what_counts_as_yes has ${obj.what_counts_as_yes.length} items (max 5)`);
    }
    // Check for empty strings
    for (let i = 0; i < obj.what_counts_as_yes.length; i++) {
      if (typeof obj.what_counts_as_yes[i] !== 'string' || obj.what_counts_as_yes[i].trim().length === 0) {
        errors.push(`[${index}] what_counts_as_yes[${i}] is empty`);
      }
    }
  }
  
  if (!Array.isArray(obj.what_does_not_count)) {
    errors.push(`[${index}] what_does_not_count must be an array`);
  } else {
    if (obj.what_does_not_count.length === 0) {
      errors.push(`[${index}] what_does_not_count is empty (must have at least 2 items)`);
    } else if (obj.what_does_not_count.length > 5) {
      errors.push(`[${index}] what_does_not_count has ${obj.what_does_not_count.length} items (max 5)`);
    }
    for (let i = 0; i < obj.what_does_not_count.length; i++) {
      if (typeof obj.what_does_not_count[i] !== 'string' || obj.what_does_not_count[i].trim().length === 0) {
        errors.push(`[${index}] what_does_not_count[${i}] is empty`);
      }
    }
  }
  
  if (!Array.isArray(obj.typical_evidence)) {
    errors.push(`[${index}] typical_evidence must be an array`);
  } else {
    if (obj.typical_evidence.length === 0) {
      errors.push(`[${index}] typical_evidence is empty (must have at least 2 items)`);
    } else if (obj.typical_evidence.length > 5) {
      errors.push(`[${index}] typical_evidence has ${obj.typical_evidence.length} items (max 5)`);
    }
    for (let i = 0; i < obj.typical_evidence.length; i++) {
      if (typeof obj.typical_evidence[i] !== 'string' || obj.typical_evidence[i].trim().length === 0) {
        errors.push(`[${index}] typical_evidence[${i}] is empty`);
      }
    }
  }
  
  if (!Array.isArray(obj.references)) {
    errors.push(`[${index}] references must be an array`);
  } else {
    if (obj.references.length > 5) {
      errors.push(`[${index}] references has ${obj.references.length} items (max 5)`);
    }
    for (let i = 0; i < obj.references.length; i++) {
      if (typeof obj.references[i] !== 'string' || obj.references[i].trim().length === 0) {
        errors.push(`[${index}] references[${i}] is empty`);
      }
    }
  }
  
  // Check for forbidden words
  const allText = [
    obj.intent,
    obj.field_tip,
    ...obj.what_counts_as_yes,
    ...obj.what_does_not_count,
    ...obj.typical_evidence
  ].join(' ');
  
  const forbidden = containsForbiddenWords(allText);
  if (forbidden.length > 0) {
    errors.push(`[${index}] Contains forbidden words: ${forbidden.join(', ')}`);
  }

  // Validate typical_evidence buckets are from allow-list
  if (Array.isArray(obj.typical_evidence)) {
    for (let i = 0; i < obj.typical_evidence.length; i++) {
      const evidence = obj.typical_evidence[i];
      if (typeof evidence === 'string' && evidence.trim().length > 0) {
        const trimmed = evidence.trim();
        if (!ALLOWED_EVIDENCE_BUCKETS.includes(trimmed)) {
          errors.push(`[${index}] typical_evidence[${i}] "${trimmed}" is not in allowed list. Allowed: ${ALLOWED_EVIDENCE_BUCKETS.join(', ')}`);
        }
      }
    }
  }
  
  // Check field_tip
  if (!obj.field_tip || typeof obj.field_tip !== 'string' || obj.field_tip.trim().length === 0) {
    errors.push(`[${index}] Missing or empty field_tip`);
  }
  
  // Check source object
  if (!obj.source || typeof obj.source !== 'object') {
    errors.push(`[${index}] Missing or invalid source object`);
  } else {
    if (typeof obj.source.subtype_guidance_used !== 'boolean') {
      errors.push(`[${index}] source.subtype_guidance_used must be boolean`);
    }
    if (!Array.isArray(obj.source.guidance_fields_used)) {
      errors.push(`[${index}] source.guidance_fields_used must be an array`);
    }
  }
  
  return errors;
}

/**
 * Load baseline spines count
 */
async function getExpectedDepth1Count(): Promise<number> {
  try {
    const pool = await ensureRuntimePoolConnected();
    
    const query = `
      SELECT COUNT(*)::text as count
      FROM public.baseline_spines_runtime
      WHERE active = true
        AND subtype_code IS NOT NULL
        AND subtype_code <> ''
    `;
    
    const result = await pool.query(query);
    await pool.end();
    
    return parseInt(String(result.rows[0].count), 10);
  } catch (error) {
    console.warn(`[WARN] Database query failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // Try file fallback
    if (fs.existsSync(BASELINE_SPINES_FILE)) {
      const content = fs.readFileSync(BASELINE_SPINES_FILE, 'utf-8');
      const data = JSON.parse(content);
      
      let spines: any[] = [];
      if (Array.isArray(data)) {
        spines = data;
      } else if (data.rows && Array.isArray(data.rows)) {
        spines = data.rows;
      } else if (data.spines && Array.isArray(data.spines)) {
        spines = data.spines;
      }
      
      return spines.filter((s: any) => s.subtype_code && s.active !== false).length;
    }
    
    return -1; // Unknown
  }
}

/**
 * Get expected Depth-2 count
 */
function getExpectedDepth2Count(): number {
  if (!fs.existsSync(DEPTH2_QUESTIONS_FILE)) {
    return -1; // Unknown
  }
  
  const content = fs.readFileSync(DEPTH2_QUESTIONS_FILE, 'utf-8');
  const data = JSON.parse(content);
  
  if (data.questions && Array.isArray(data.questions)) {
    return data.questions.length;
  }
  
  return -1; // Unknown
}

/**
 * Main validation function
 */
async function main(): Promise<void> {
  console.log('[INFO] Loading intent objects...');
  
  if (!fs.existsSync(INTENT_OBJECTS_FILE)) {
    console.error(`[ERROR] Intent objects file not found: ${INTENT_OBJECTS_FILE}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(INTENT_OBJECTS_FILE, 'utf-8');
  let output: IntentObjectsOutput;
  
  try {
    output = JSON.parse(content);
  } catch (error) {
    console.error(`[ERROR] Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  
  if (!output.questions || !Array.isArray(output.questions)) {
    console.error('[ERROR] Invalid format: questions must be an array');
    process.exit(1);
  }
  
  console.log(`[INFO] Validating ${output.questions.length} intent objects...`);
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate each object
  for (let i = 0; i < output.questions.length; i++) {
    const objErrors = validateIntentObject(output.questions[i], i);
    errors.push(...objErrors);
  }
  
  // Check for unique canon_ids
  const canonIds = new Set<string>();
  const duplicates: string[] = [];
  for (const obj of output.questions) {
    if (canonIds.has(obj.canon_id)) {
      duplicates.push(obj.canon_id);
    }
    canonIds.add(obj.canon_id);
  }
  
  if (duplicates.length > 0) {
    errors.push(`Duplicate canon_ids found: ${duplicates.join(', ')}`);
  }
  
  // Count statistics
  const depth1Count = output.questions.filter(q => q.depth === 1).length;
  const depth2Count = output.questions.filter(q => q.depth === 2).length;
  
  const expectedDepth1 = await getExpectedDepth1Count();
  const expectedDepth2 = getExpectedDepth2Count();
  
  if (expectedDepth1 >= 0 && depth1Count !== expectedDepth1) {
    errors.push(`Depth-1 count mismatch: expected ${expectedDepth1}, got ${depth1Count}`);
  }
  
  if (expectedDepth2 >= 0 && depth2Count !== expectedDepth2) {
    errors.push(`Depth-2 count mismatch: expected ${expectedDepth2}, got ${depth2Count}`);
  }
  
  // Create validation result
  const result: ValidationResult = {
    passed: errors.length === 0,
    errors: errors,
    warnings: warnings,
    stats: {
      total_questions: output.questions.length,
      depth1_count: depth1Count,
      depth2_count: depth2Count,
      expected_depth1_count: expectedDepth1,
      expected_depth2_count: expectedDepth2,
      unique_canon_ids: canonIds.size
    }
  };
  
  // Print results
  console.log('');
  console.log('=== Validation Results ===');
  console.log(`Status: ${result.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Total Questions: ${result.stats.total_questions}`);
  console.log(`Depth-1: ${result.stats.depth1_count}${result.stats.expected_depth1_count >= 0 ? ` (expected: ${result.stats.expected_depth1_count})` : ''}`);
  console.log(`Depth-2: ${result.stats.depth2_count}${result.stats.expected_depth2_count >= 0 ? ` (expected: ${result.stats.expected_depth2_count})` : ''}`);
  console.log(`Unique Canon IDs: ${result.stats.unique_canon_ids}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  
  // Summary
  if (result.passed) {
    console.log('');
    console.log('Summary:');
    console.log(`  ✓ All ${result.stats.total_questions} intent objects validated`);
    if (result.stats.expected_depth1_count >= 0 && result.stats.depth1_count === result.stats.expected_depth1_count) {
      console.log(`  ✓ Depth-1 count matches expected (${result.stats.depth1_count})`);
    }
    if (result.stats.expected_depth2_count >= 0 && result.stats.depth2_count === result.stats.expected_depth2_count) {
      console.log(`  ✓ Depth-2 count matches expected (${result.stats.depth2_count})`);
    }
    console.log(`  ✓ No forbidden words detected`);
    console.log(`  ✓ All typical_evidence values are from allowed list`);
  }
  
  if (result.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }
  
  if (result.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }
  
  if (!result.passed) {
    process.exit(1);
  }
  
  console.log('');
  console.log('[INFO] Validation passed!');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('[ERROR]', error);
    process.exit(1);
  });
}

export { validateIntentObject, ValidationResult };
