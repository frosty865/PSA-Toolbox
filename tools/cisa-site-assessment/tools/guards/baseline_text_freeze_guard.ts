/**
 * Baseline Text Freeze Guard
 * 
 * Ensures baseline question text remains stable unless explicitly overridden.
 * This guard is about stability, not correctness.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const BASELINE_SPINES_FILE = path.join(process.cwd(), 'baseline_spines_runtime_rows.json');
const DEPTH2_QUESTIONS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'baseline_depth2_questions.json');
const SNAPSHOT_DEPTH1_FILE = path.join(process.cwd(), 'tools', 'outputs', 'baseline_text_snapshot.depth1.json');
const SNAPSHOT_DEPTH2_FILE = path.join(process.cwd(), 'tools', 'outputs', 'baseline_text_snapshot.depth2.json');

interface QuestionSnapshot {
  canon_id: string;
  question_text: string;
  hash: string;
}

interface SnapshotFile {
  version: string;
  generated_at: string;
  questions: QuestionSnapshot[];
}

/**
 * Compute hash for question text
 */
function hashQuestionText(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex').substring(0, 16);
}

/**
 * Load baseline spines and create snapshot
 */
function loadDepth1Snapshot(): Map<string, QuestionSnapshot> {
  if (!fs.existsSync(BASELINE_SPINES_FILE)) {
    console.error(`[ERROR] Baseline spines file not found: ${BASELINE_SPINES_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(BASELINE_SPINES_FILE, 'utf-8');
  const data = JSON.parse(content);

  // Handle different file formats
  let spines: any[] = [];
  if (Array.isArray(data)) {
    spines = data;
  } else if (data.rows && Array.isArray(data.rows)) {
    spines = data.rows;
  } else if (data.spines && Array.isArray(data.spines)) {
    spines = data.spines;
  } else {
    console.error('[ERROR] Invalid baseline spines file format');
    process.exit(1);
  }

  const snapshot = new Map<string, QuestionSnapshot>();

  for (const spine of spines) {
    // Only include active spines
    if (spine.active === false) {
      continue;
    }

    const canonId = spine.canon_id || spine.question_code || spine.element_code;
    const questionText = spine.question_text || spine.text || '';

    if (!canonId) {
      console.error(`[ERROR] Spine missing canon_id: ${JSON.stringify(spine)}`);
      process.exit(1);
    }

    if (!questionText || questionText.trim().length === 0) {
      console.error(`[ERROR] Empty question_text for canon_id: ${canonId}`);
      process.exit(1);
    }

    if (snapshot.has(canonId)) {
      console.error(`[ERROR] Duplicate canon_id found: ${canonId}`);
      process.exit(1);
    }

    snapshot.set(canonId, {
      canon_id: canonId,
      question_text: questionText.trim(),
      hash: hashQuestionText(questionText),
    });
  }

  return snapshot;
}

/**
 * Load depth-2 questions and create snapshot
 */
function loadDepth2Snapshot(): Map<string, QuestionSnapshot> {
  if (!fs.existsSync(DEPTH2_QUESTIONS_FILE)) {
    console.error(`[ERROR] Depth-2 questions file not found: ${DEPTH2_QUESTIONS_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(DEPTH2_QUESTIONS_FILE, 'utf-8');
  const data = JSON.parse(content);

  const questions = data.questions || [];
  const snapshot = new Map<string, QuestionSnapshot>();

  for (const question of questions) {
    const canonId = question.question_code || question.canon_id;
    const questionText = question.question_text || question.text || '';

    if (!canonId) {
      console.error(`[ERROR] Depth-2 question missing canon_id: ${JSON.stringify(question)}`);
      process.exit(1);
    }

    if (!questionText || questionText.trim().length === 0) {
      console.error(`[ERROR] Empty question_text for canon_id: ${canonId}`);
      process.exit(1);
    }

    if (snapshot.has(canonId)) {
      console.error(`[ERROR] Duplicate canon_id found: ${canonId}`);
      process.exit(1);
    }

    snapshot.set(canonId, {
      canon_id: canonId,
      question_text: questionText.trim(),
      hash: hashQuestionText(questionText),
    });
  }

  return snapshot;
}

/**
 * Load saved snapshot from file
 */
function loadSavedSnapshot(filePath: string): Map<string, QuestionSnapshot> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const data: SnapshotFile = JSON.parse(content);

  const snapshot = new Map<string, QuestionSnapshot>();
  for (const q of data.questions) {
    snapshot.set(q.canon_id, q);
  }

  return snapshot;
}

/**
 * Save snapshot to file
 */
function saveSnapshot(filePath: string, snapshot: Map<string, QuestionSnapshot>, depth: 1 | 2): void {
  const snapshotData: SnapshotFile = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    questions: Array.from(snapshot.values()).sort((a, b) => a.canon_id.localeCompare(b.canon_id)),
  };

  // Ensure output directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(snapshotData, null, 2) + '\n');
  console.log(`[INFO] Saved ${snapshot.size} ${depth === 1 ? 'Depth-1' : 'Depth-2'} question snapshots to ${filePath}`);
}

/**
 * Compare snapshots and report differences
 */
function compareSnapshots(
  current: Map<string, QuestionSnapshot>,
  saved: Map<string, QuestionSnapshot>,
  depth: 1 | 2
): { changed: Array<{ canon_id: string; old: string; new: string }>; new: string[]; removed: string[] } {
  const changed: Array<{ canon_id: string; old: string; new: string }> = [];
  const newIds: string[] = [];
  const removedIds: string[] = [];

  // Check for changes and new entries
  for (const [canonId, currentQ] of current.entries()) {
    const savedQ = saved.get(canonId);
    if (!savedQ) {
      newIds.push(canonId);
    } else if (savedQ.hash !== currentQ.hash) {
      changed.push({
        canon_id: canonId,
        old: savedQ.question_text,
        new: currentQ.question_text,
      });
    }
  }

  // Check for removed entries
  for (const canonId of saved.keys()) {
    if (!current.has(canonId)) {
      removedIds.push(canonId);
    }
  }

  return { changed, new: newIds, removed: removedIds };
}

/**
 * Main function
 */
function main(): void {
  const args = process.argv.slice(2);
  const writeSnapshot = args.includes('--write-snapshot');
  const override = process.env.BASELINE_TEXT_OVERRIDE === 'true';

  console.log('[INFO] Baseline Text Freeze Guard');
  console.log(`[INFO] Override mode: ${override ? 'ENABLED (warnings only)' : 'DISABLED (fail on changes)'}`);
  console.log('');

  // Load current snapshots
  console.log('[INFO] Loading current Depth-1 questions...');
  const currentDepth1 = loadDepth1Snapshot();
  console.log(`[INFO] Found ${currentDepth1.size} active Depth-1 questions`);

  console.log('[INFO] Loading current Depth-2 questions...');
  const currentDepth2 = loadDepth2Snapshot();
  console.log(`[INFO] Found ${currentDepth2.size} Depth-2 questions`);

  // If writing snapshot, save and exit
  if (writeSnapshot) {
    console.log('');
    console.log('[INFO] Writing snapshots...');
    saveSnapshot(SNAPSHOT_DEPTH1_FILE, currentDepth1, 1);
    saveSnapshot(SNAPSHOT_DEPTH2_FILE, currentDepth2, 2);
    console.log('');
    console.log('[INFO] Snapshots written successfully!');
    return;
  }

  // Load saved snapshots
  console.log('');
  console.log('[INFO] Loading saved snapshots...');
  const savedDepth1 = loadSavedSnapshot(SNAPSHOT_DEPTH1_FILE);
  const savedDepth2 = loadSavedSnapshot(SNAPSHOT_DEPTH2_FILE);

  if (!savedDepth1 || !savedDepth2) {
    console.error('[ERROR] Saved snapshots not found. Run "npm run snapshot:baseline-text" first.');
    process.exit(1);
  }

  console.log(`[INFO] Loaded ${savedDepth1.size} saved Depth-1 snapshots`);
  console.log(`[INFO] Loaded ${savedDepth2.size} saved Depth-2 snapshots`);

  // Compare snapshots
  console.log('');
  console.log('[INFO] Comparing snapshots...');
  const depth1Diff = compareSnapshots(currentDepth1, savedDepth1, 1);
  const depth2Diff = compareSnapshots(currentDepth2, savedDepth2, 2);

  // Report results
  let hasIssues = false;

  if (depth1Diff.changed.length > 0) {
    console.log('');
    console.log(`[${override ? 'WARN' : 'ERROR'}] Depth-1: ${depth1Diff.changed.length} question text(s) changed:`);
    for (const change of depth1Diff.changed) {
      console.log(`  ${change.canon_id}:`);
      console.log(`    OLD: ${change.old}`);
      console.log(`    NEW: ${change.new}`);
    }
    if (!override) {
      hasIssues = true;
    }
  }

  if (depth2Diff.changed.length > 0) {
    console.log('');
    console.log(`[${override ? 'WARN' : 'ERROR'}] Depth-2: ${depth2Diff.changed.length} question text(s) changed:`);
    for (const change of depth2Diff.changed) {
      console.log(`  ${change.canon_id}:`);
      console.log(`    OLD: ${change.old}`);
      console.log(`    NEW: ${change.new}`);
    }
    if (!override) {
      hasIssues = true;
    }
  }

  if (depth1Diff.new.length > 0) {
    console.log('');
    console.log(`[INFO] Depth-1: ${depth1Diff.new.length} new question(s) (acceptable): ${depth1Diff.new.slice(0, 5).join(', ')}${depth1Diff.new.length > 5 ? '...' : ''}`);
  }

  if (depth2Diff.new.length > 0) {
    console.log('');
    console.log(`[INFO] Depth-2: ${depth2Diff.new.length} new question(s) (acceptable): ${depth2Diff.new.slice(0, 5).join(', ')}${depth2Diff.new.length > 5 ? '...' : ''}`);
  }

  if (depth1Diff.removed.length > 0) {
    console.log('');
    console.log(`[WARN] Depth-1: ${depth1Diff.removed.length} question(s) removed: ${depth1Diff.removed.slice(0, 5).join(', ')}${depth1Diff.removed.length > 5 ? '...' : ''}`);
  }

  if (depth2Diff.removed.length > 0) {
    console.log('');
    console.log(`[WARN] Depth-2: ${depth2Diff.removed.length} question(s) removed: ${depth2Diff.removed.slice(0, 5).join(', ')}${depth2Diff.removed.length > 5 ? '...' : ''}`);
  }

  console.log('');

  if (hasIssues) {
    console.error('[ERROR] Baseline text changes detected. Set BASELINE_TEXT_OVERRIDE=true to allow changes.');
    process.exit(1);
  }

  console.log('[INFO] Baseline text freeze guard passed!');
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { loadDepth1Snapshot, loadDepth2Snapshot, compareSnapshots };
