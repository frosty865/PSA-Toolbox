#!/usr/bin/env tsx
/**
 * Guard: Validate Standard Seed Files
 * 
 * Validates that standard seed SQL files do not contain forbidden terms
 * in criteria questions or OFC templates.
 * 
 * Usage:
 *   npx tsx scripts/guards/validate_standard_seed.ts <path-to-seed.sql>
 */

import { readFileSync } from "fs";
import { validateStandardText, validateStandardTexts } from "../../app/lib/modules/standard_text_validation";

function extractTextFromSQL(sql: string): Array<{ field: string; text: string }> {
  const fields: Array<{ field: string; text: string }> = [];

  // Pattern 1: UPDATE/INSERT with question_text = '...'
  const criteriaUpdateRegex = /question_text\s*=\s*['"]([^'"]*(?:''[^'"]*)*)['"]/gi;
  let match;
  let criterionIndex = 0;
  while ((match = criteriaUpdateRegex.exec(sql)) !== null) {
    criterionIndex++;
    const text = match[1].replace(/''/g, "'");
    fields.push({
      field: `criteria[UPDATE_${criterionIndex}].question_text`,
      text: text,
    });
  }

  // Pattern 2: SELECT id, 'key', 'title', 'question_text?', ... FROM ... WHERE ... question_text
  // Match: SELECT ... 'text' ... question_text (the text is the 4th string literal in SELECT)
  const criteriaSelectRegex = /SELECT\s+[^,]+,\s*['"]([^'"]*(?:''[^'"]*)*)['"],\s*['"]([^'"]*(?:''[^'"]*)*)['"],\s*['"]([^'"]*(?:''[^'"]*)*)['"][^F]*FROM[^W]*WHERE[^q]*question_text/gi;
  while ((match = criteriaSelectRegex.exec(sql)) !== null) {
    const text = match[3].replace(/''/g, "'");
    if (text.trim().length > 0) {
      fields.push({
        field: `criteria[SELECT].question_text`,
        text: text,
      });
    }
  }

  // Pattern 3: More flexible - find SELECT statements that contain question_text in column list
  // SELECT id, 'EVP_001', 'Title', 'Question?', NULL, ... FROM module_standards
  const flexibleCriteriaRegex = /SELECT\s+[^,]+,\s*['"]([^'"]*(?:''[^'"]*)*)['"],\s*['"]([^'"]*(?:''[^'"]*)*)['"],\s*['"]([^'"]*(?:''[^'"]*)*)['"][^F]*FROM\s+public\.module_standards/gi;
  while ((match = flexibleCriteriaRegex.exec(sql)) !== null) {
    const text = match[3].replace(/''/g, "'");
    // Check if this looks like a question (contains '?' or starts with question words)
    if (text.includes('?') || /^(Is|Are|Does|Do|Has|Have|Where|When|What|Who|Which)\s/i.test(text.trim())) {
      fields.push({
        field: `criteria[SELECT_FLEX].question_text`,
        text: text,
      });
    }
  }

  // Extract ofc_text_template
  const ofcUpdateRegex = /ofc_text_template\s*=\s*['"]([^'"]*(?:''[^'"]*)*)['"]/gi;
  let ofcIndex = 0;
  while ((match = ofcUpdateRegex.exec(sql)) !== null) {
    ofcIndex++;
    const text = match[1].replace(/''/g, "'");
    fields.push({
      field: `ofcs[UPDATE_${ofcIndex}].ofc_text_template`,
      text: text,
    });
  }

  // SELECT pattern for OFCs: SELECT c.id, 'OFC_EVP_001', ..., 'ofc text', ...
  const ofcSelectRegex = /SELECT\s+[^,]+,\s*['"]([^'"]*(?:''[^'"]*)*)['"],\s*[^,]+,\s*['"]([^'"]*(?:''[^'"]*)*)['"][^F]*FROM\s+public\.module_standard_criteria/gi;
  while ((match = ofcSelectRegex.exec(sql)) !== null) {
    const text = match[2].replace(/''/g, "'");
    if (text.trim().length > 0) {
      fields.push({
        field: `ofcs[SELECT].ofc_text_template`,
        text: text,
      });
    }
  }

  return fields;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx tsx scripts/guards/validate_standard_seed.ts <path-to-seed.sql>");
    process.exit(1);
  }

  const filePath = args[0];
  let sql: string;
  try {
    sql = readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`[ERROR] Failed to read file: ${filePath}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const fields = extractTextFromSQL(sql);
  if (fields.length === 0) {
    console.log("[WARN] No criteria or OFC text found in SQL file");
    process.exit(0);
  }

  const errors = validateStandardTexts(fields);

  if (errors.length === 0) {
    console.log(`[OK] Standard seed file validated: ${fields.length} fields checked, no forbidden terms found`);
    process.exit(0);
  } else {
    console.error(`[ERROR] Standard seed file contains forbidden terms:`);
    for (const err of errors) {
      console.error(`  ${err.field}: ${err.message}`);
    }
    console.error(`\n[ERROR] Found ${errors.length} validation error(s) in ${filePath}`);
    console.error(`[ERROR] Standards must describe WHAT capability should exist (PSA-scope), not HOW to implement or what codes require.`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { extractTextFromSQL, validateStandardTexts };
