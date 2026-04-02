/**
 * Validate Subtype Checklists
 * 
 * Validates generated checklists against schema and business rules.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SubtypeChecklistsFile, ChecklistItem } from '../app/lib/types/checklist';

const CHECKLISTS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'subtype_checklists.v1.json');

// Forbidden words
const FORBIDDEN_WORDS = [
  'adequate', 'effective', 'regularly', 'aligned', 'tested', 'by whom', 'shall', 'must',
  'ensure', 'implement', 'install'
];

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
 * Validate a checklist item
 */
function validateChecklistItem(item: ChecklistItem, checklistIndex: number, itemIndex: number): string[] {
  const errors: string[] = [];
  const prefix = `[Checklist ${checklistIndex}, Item ${itemIndex}]`;

  // Required fields
  if (!item.id || typeof item.id !== 'string' || item.id.trim().length === 0) {
    errors.push(`${prefix} Missing or empty id`);
  }

  if (!item.label || typeof item.label !== 'string' || item.label.trim().length < 8) {
    errors.push(`${prefix} Label must be at least 8 characters (got: ${item.label?.length || 0})`);
  }

  if (!item.description || typeof item.description !== 'string' || item.description.trim().length < 20) {
    errors.push(`${prefix} Description must be at least 20 characters (got: ${item.description?.length || 0})`);
  }

  if (!Array.isArray(item.tags) || item.tags.length === 0) {
    errors.push(`${prefix} Tags must be a non-empty array`);
  } else {
    // Check for duplicate tags
    const uniqueTags = new Set(item.tags);
    if (uniqueTags.size !== item.tags.length) {
      errors.push(`${prefix} Duplicate tags found: ${item.tags.join(', ')}`);
    }
  }

  // Check for forbidden words
  const allText = `${item.label} ${item.description}`;
  const forbidden = containsForbiddenWords(allText);
  if (forbidden.length > 0) {
    errors.push(`${prefix} Contains forbidden words: ${forbidden.join(', ')}`);
  }

  return errors;
}

/**
 * Main validation function
 */
function main(): void {
  console.log('[INFO] Validating subtype checklists...\n');

  if (!fs.existsSync(CHECKLISTS_FILE)) {
    console.error(`[ERROR] Checklists file not found: ${CHECKLISTS_FILE}`);
    console.error('[ERROR] Run "npm run generate:checklists" first');
    process.exit(1);
  }

  const content = fs.readFileSync(CHECKLISTS_FILE, 'utf-8');
  let data: SubtypeChecklistsFile;

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

  if (!Array.isArray(data.checklists)) {
    console.error('[ERROR] checklists must be an array');
    process.exit(1);
  }

  console.log(`[INFO] Validating ${data.checklists.length} checklists...`);

  const errors: string[] = [];
  const itemIdsBySubtype = new Map<string, Set<string>>();

  // Validate each checklist
  for (let i = 0; i < data.checklists.length; i++) {
    const checklist = data.checklists[i];

    // Validate checklist structure
    if (!checklist.subtype_code || typeof checklist.subtype_code !== 'string') {
      errors.push(`[Checklist ${i}] Missing or invalid subtype_code`);
    }

    if (!checklist.discipline_code || typeof checklist.discipline_code !== 'string') {
      errors.push(`[Checklist ${i}] Missing or invalid discipline_code`);
    }

    if (!checklist.title || typeof checklist.title !== 'string') {
      errors.push(`[Checklist ${i}] Missing or invalid title`);
    }

    if (!Array.isArray(checklist.items)) {
      errors.push(`[Checklist ${i}] items must be an array`);
      continue;
    }

    // Track item IDs per subtype for uniqueness check
    const itemIds = new Set<string>();
    if (!itemIdsBySubtype.has(checklist.subtype_code)) {
      itemIdsBySubtype.set(checklist.subtype_code, new Set());
    }

    // Validate each item
    for (let j = 0; j < checklist.items.length; j++) {
      const item = checklist.items[j];
      const itemErrors = validateChecklistItem(item, i, j);
      errors.push(...itemErrors);

      // Check for duplicate IDs within subtype
      if (item.id) {
        if (itemIdsBySubtype.get(checklist.subtype_code)!.has(item.id)) {
          errors.push(`[Checklist ${i}, Item ${j}] Duplicate item id "${item.id}" in subtype ${checklist.subtype_code}`);
        } else {
          itemIdsBySubtype.get(checklist.subtype_code)!.add(item.id);
        }
      }
    }
  }

  // Print results
  console.log('');
  console.log('=== Validation Results ===');
  console.log(`Status: ${errors.length === 0 ? 'PASSED' : 'FAILED'}`);
  console.log(`Total Checklists: ${data.checklists.length}`);
  console.log(`Total Items: ${data.checklists.reduce((sum, c) => sum + c.items.length, 0)}`);
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
  console.log('[INFO] Checklist validation passed!');
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { validateChecklistItem, containsForbiddenWords };
