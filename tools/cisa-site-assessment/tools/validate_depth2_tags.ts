/**
 * Validate Depth-2 Question Tags
 * 
 * Validates that depth-2 questions are properly tagged.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Depth2QuestionTagsFile } from '../app/lib/types/checklist';
import { getChecklistTemplate } from './generate_subtype_checklists';

const TAGS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'depth2_question_tags.v1.json');
const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');

/**
 * Main validation function
 */
function main(): void {
  console.log('[INFO] Validating depth-2 question tags...\n');

  if (!fs.existsSync(TAGS_FILE)) {
    console.error(`[ERROR] Tags file not found: ${TAGS_FILE}`);
    console.error('[ERROR] Run "npm run generate:depth2-tags" first');
    process.exit(1);
  }

  const content = fs.readFileSync(TAGS_FILE, 'utf-8');
  let data: Depth2QuestionTagsFile;

  try {
    data = JSON.parse(content);
  } catch (error) {
    console.error(`[ERROR] Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Validate version
  if (data.version !== '1.0') {
    console.error(`[ERROR] Invalid version: ${data.version} (expected 1.0)`);
    process.exit(1);
  }

  if (!Array.isArray(data.questions)) {
    console.error('[ERROR] questions must be an array');
    process.exit(1);
  }

  console.log(`[INFO] Validating ${data.questions.length} tagged questions...`);

  // Load taxonomy to determine which subtypes have checklists
  const taxonomyContent = fs.readFileSync(TAXONOMY_FILE, 'utf-8');
  const taxonomyData: any = JSON.parse(taxonomyContent);
  const subtypes = taxonomyData.subtypes || [];

  const subtypesWithChecklists = new Set<string>();
  for (const subtype of subtypes) {
    const items = getChecklistTemplate(subtype.subtype_code, subtype.name);
    if (items.length > 0) {
      subtypesWithChecklists.add(subtype.subtype_code);
    }
  }

  console.log(`[INFO] Found ${subtypesWithChecklists.size} subtypes with checklists`);

  const errors: string[] = [];
  const canonIds = new Set<string>();

  // Validate each question
  for (let i = 0; i < data.questions.length; i++) {
    const question = data.questions[i];

    // Check for duplicate canon_id
    if (canonIds.has(question.canon_id)) {
      errors.push(`[Question ${i}] Duplicate canon_id: ${question.canon_id}`);
    } else {
      canonIds.add(question.canon_id);
    }

    // Validate canon_id
    if (!question.canon_id || typeof question.canon_id !== 'string') {
      errors.push(`[Question ${i}] Missing or invalid canon_id`);
    }

    // Validate subtype_code
    if (!question.subtype_code || typeof question.subtype_code !== 'string') {
      errors.push(`[Question ${i}] Missing or invalid subtype_code`);
    }

    // Validate tags array
    if (!Array.isArray(question.tags)) {
      errors.push(`[Question ${i}] tags must be an array`);
    } else {
      // Check for duplicate tags
      const uniqueTags = new Set(question.tags);
      if (uniqueTags.size !== question.tags.length) {
        errors.push(`[Question ${i}] Duplicate tags found: ${question.tags.join(', ')}`);
      }

      // If subtype has checklist, question must have at least 1 tag
      if (subtypesWithChecklists.has(question.subtype_code) && question.tags.length === 0) {
        errors.push(`[Question ${i}] canon_id ${question.canon_id} (subtype ${question.subtype_code}) has no tags but subtype has checklist`);
      }
    }
  }

  // Print results
  console.log('');
  console.log('=== Validation Results ===');
  console.log(`Status: ${errors.length === 0 ? 'PASSED' : 'FAILED'}`);
  console.log(`Total Questions: ${data.questions.length}`);
  console.log(`Unique Canon IDs: ${canonIds.size}`);
  console.log(`Subtypes with checklists: ${subtypesWithChecklists.size}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const error of errors) {
      console.log(`  - ${error}`);
    }
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log('[INFO] Depth-2 tag validation passed!');
}

// Run if executed directly
if (require.main === module) {
  main();
}
