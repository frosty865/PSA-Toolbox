/**
 * Depth-2 Requires Intent Guard
 * 
 * Ensures every Depth-2 question has a corresponding intent object.
 * Promotion rule: No Depth-2 without intent.
 */

import * as fs from 'fs';
import * as path from 'path';

const DEPTH2_QUESTIONS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'baseline_depth2_questions.json');
const INTENT_OBJECTS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'intent_objects.v1.json');

interface Depth2Question {
  question_code: string;
  canon_id?: string;
  subtype_code: string;
  question_text: string;
}

interface IntentObject {
  canon_id: string;
  depth: number;
  subtype_code: string;
}

interface IntentObjectsOutput {
  version: string;
  generated_at: string;
  questions: IntentObject[];
}

/**
 * Load Depth-2 questions
 */
function loadDepth2Questions(): Map<string, Depth2Question> {
  if (!fs.existsSync(DEPTH2_QUESTIONS_FILE)) {
    console.error(`[ERROR] Depth-2 questions file not found: ${DEPTH2_QUESTIONS_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(DEPTH2_QUESTIONS_FILE, 'utf-8');
  const data = JSON.parse(content);

  const questions = data.questions || [];
  const questionMap = new Map<string, Depth2Question>();

  for (const question of questions) {
    const canonId = question.question_code || question.canon_id;
    if (!canonId) {
      console.error(`[ERROR] Depth-2 question missing canon_id: ${JSON.stringify(question)}`);
      process.exit(1);
    }

    questionMap.set(canonId, {
      question_code: canonId,
      canon_id: canonId,
      subtype_code: question.subtype_code || 'UNKNOWN',
      question_text: question.question_text || '',
    });
  }

  return questionMap;
}

/**
 * Load intent objects
 */
function loadIntentObjects(): Map<string, IntentObject> {
  if (!fs.existsSync(INTENT_OBJECTS_FILE)) {
    console.error(`[ERROR] Intent objects file not found: ${INTENT_OBJECTS_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(INTENT_OBJECTS_FILE, 'utf-8');
  const data: IntentObjectsOutput = JSON.parse(content);

  const intentMap = new Map<string, IntentObject>();

  // Only include depth=2 intent objects
  for (const intent of data.questions || []) {
    if (intent.depth === 2) {
      intentMap.set(intent.canon_id, intent);
    }
  }

  return intentMap;
}

/**
 * Main function
 */
function main(): void {
  console.log('[INFO] Depth-2 Requires Intent Guard');
  console.log('');

  // Load Depth-2 questions
  console.log('[INFO] Loading Depth-2 questions...');
  const depth2Questions = loadDepth2Questions();
  console.log(`[INFO] Found ${depth2Questions.size} Depth-2 questions`);

  // Load intent objects
  console.log('[INFO] Loading intent objects...');
  const intentObjects = loadIntentObjects();
  console.log(`[INFO] Found ${intentObjects.size} Depth-2 intent objects`);

  // Check for missing intent objects
  console.log('');
  console.log('[INFO] Checking for missing intent objects...');
  const missing: Array<{ canon_id: string; subtype_code: string }> = [];

  for (const [canonId, question] of depth2Questions.entries()) {
    if (!intentObjects.has(canonId)) {
      missing.push({
        canon_id: canonId,
        subtype_code: question.subtype_code,
      });
    }
  }

  // Report results
  if (missing.length > 0) {
    console.error('');
    console.error(`[ERROR] ${missing.length} Depth-2 question(s) missing intent objects:`);
    console.error('');
    
    // Group by subtype for easier review
    const bySubtype = new Map<string, string[]>();
    for (const item of missing) {
      if (!bySubtype.has(item.subtype_code)) {
        bySubtype.set(item.subtype_code, []);
      }
      bySubtype.get(item.subtype_code)!.push(item.canon_id);
    }

    for (const [subtypeCode, canonIds] of Array.from(bySubtype.entries()).sort()) {
      console.error(`  Subtype: ${subtypeCode} (${canonIds.length} question(s)):`);
      for (const canonId of canonIds.sort()) {
        console.error(`    - ${canonId}`);
      }
    }

    console.error('');
    console.error('[ERROR] Promotion rule violated: No Depth-2 without intent');
    console.error('[ERROR] Generate intent objects for these questions before promoting.');
    process.exit(1);
  }

  console.log('');
  console.log(`[INFO] ✓ All ${depth2Questions.size} Depth-2 questions have intent objects`);
  console.log('[INFO] Depth-2 requires intent guard passed!');
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { loadDepth2Questions, loadIntentObjects };
