/**
 * Backfill Script: Generate default help_text for baseline spines
 * 
 * Purpose: Auto-generate help_text for baseline spines that don't have it,
 * using deterministic rules based on whether the question is discipline-level
 * or subtype-anchored.
 * 
 * RUNBOOK:
 * 1. Run migration: tools/migrations/20260116_add_help_text_to_baseline_spines_runtime.sql
 * 2. Preview changes:
 *    node tools/backfill_baseline_help_text.ts --dry-run
 * 3. Review: tools/outputs/baseline_help_backfill_preview.md
 * 4. Apply changes:
 *    node tools/backfill_baseline_help_text.ts
 * 
 * RULES FOR DEFAULT HELP_TEXT:
 * A) If subtype_code IS NULL (discipline-level questions):
 *    help_text = "Confirm whether this capability exists in any form at the facility. Answer YES if the capability is in place; NO if it is not; N/A if not applicable to the facility."
 * 
 * B) If subtype_code IS NOT NULL (subtype questions):
 *    help_text = "Confirm whether the facility has implemented the following capability: <subtype_name>. Answer YES if the capability is present and used for its intended security purpose; NO if it is not present; N/A if not applicable."
 *    Where <subtype_name> is derived from taxonomy (discipline_subtypes.json) matching subtype_code.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

interface BaselineSpine {
  canon_id: string;
  discipline_code: string;
  subtype_code: string | null;
  question_text: string;
  help_text: string | null;
}

interface SubtypeTaxonomy {
  subtype_code: string;
  name: string;
}

const DRY_RUN = process.argv.includes('--dry-run');

async function loadTaxonomy(): Promise<Map<string, string>> {
  const taxonomyPath = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
  
  if (!fs.existsSync(taxonomyPath)) {
    console.warn(`[WARN] Taxonomy file not found: ${taxonomyPath}`);
    return new Map();
  }
  
  const taxonomyData = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));
  const subtypeMap = new Map<string, string>();
  
  if (taxonomyData.subtypes && Array.isArray(taxonomyData.subtypes)) {
    for (const subtype of taxonomyData.subtypes) {
      if (subtype.subtype_code && subtype.name) {
        subtypeMap.set(subtype.subtype_code, subtype.name);
      }
    }
  }
  
  console.log(`[INFO] Loaded ${subtypeMap.size} subtypes from taxonomy`);
  return subtypeMap;
}

function generateHelpText(spine: BaselineSpine, subtypeMap: Map<string, string>): string {
  if (spine.subtype_code === null || spine.subtype_code === '') {
    // Discipline-level question
    return "Confirm whether this capability exists in any form at the facility. Answer YES if the capability is in place; NO if it is not; N/A if not applicable to the facility.";
  } else {
    // Subtype-anchored question
    const subtypeName = subtypeMap.get(spine.subtype_code) || spine.subtype_code;
    return `Confirm whether the facility has implemented the following capability: ${subtypeName}. Answer YES if the capability is present and used for its intended security purpose; NO if it is not present; N/A if not applicable.`;
  }
}

async function main() {
  console.log(`[INFO] Starting baseline help_text backfill${DRY_RUN ? ' (DRY-RUN)' : ''}...\n`);
  
  const pool = await ensureRuntimePoolConnected();
  const subtypeMap = await loadTaxonomy();
  
  // Load all active baseline spines
  const result = await pool.query<BaselineSpine>(`
    SELECT 
      canon_id,
      discipline_code,
      subtype_code,
      question_text,
      help_text
    FROM public.baseline_spines_runtime
    WHERE active = true
    ORDER BY discipline_code, canon_id
  `);
  
  const spines = result.rows;
  console.log(`[INFO] Loaded ${spines.length} active baseline spines\n`);
  
  // Find spines that need help_text
  const spinesNeedingHelp = spines.filter(s => !s.help_text || s.help_text.trim() === '');
  console.log(`[INFO] Found ${spinesNeedingHelp.length} spines needing help_text\n`);
  
  if (spinesNeedingHelp.length === 0) {
    console.log(`[OK] All active spines already have help_text. Nothing to do.`);
    return;
  }
  
  // Generate help_text for each spine
  const updates: Array<{ spine: BaselineSpine; help_text: string }> = [];
  for (const spine of spinesNeedingHelp) {
    const helpText = generateHelpText(spine, subtypeMap);
    updates.push({ spine, help_text: helpText });
  }
  
  if (DRY_RUN) {
    console.log(`[DRY-RUN] Would update ${updates.length} rows\n`);
    
    // Generate preview markdown
    const previewPath = path.join(process.cwd(), 'tools', 'outputs', 'baseline_help_backfill_preview.md');
    const previewLines: string[] = [
      '# Baseline Help Text Backfill Preview',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Total rows to update: ${updates.length}`,
      '',
      '## Sample (First 25 rows)',
      '',
      '| canon_id | subtype_code | question_text | help_text |',
      '|----------|--------------|---------------|-----------|'
    ];
    
    const sampleSize = Math.min(25, updates.length);
    for (let i = 0; i < sampleSize; i++) {
      const { spine, help_text } = updates[i];
      const questionPreview = spine.question_text.length > 60 
        ? spine.question_text.substring(0, 57) + '...'
        : spine.question_text;
      const helpPreview = help_text.length > 80
        ? help_text.substring(0, 77) + '...'
        : help_text;
      
      previewLines.push(
        `| ${spine.canon_id} | ${spine.subtype_code || 'NULL'} | ${questionPreview} | ${helpPreview} |`
      );
    }
    
    if (updates.length > sampleSize) {
      previewLines.push('');
      previewLines.push(`_... and ${updates.length - sampleSize} more rows_`);
    }
    
    previewLines.push('');
    previewLines.push('## Breakdown by Type');
    previewLines.push('');
    
    const disciplineLevel = updates.filter(u => !u.spine.subtype_code || u.spine.subtype_code === '').length;
    const subtypeAnchored = updates.length - disciplineLevel;
    
    previewLines.push(`- Discipline-level questions: ${disciplineLevel}`);
    previewLines.push(`- Subtype-anchored questions: ${subtypeAnchored}`);
    
    fs.writeFileSync(previewPath, previewLines.join('\n'), 'utf-8');
    console.log(`[OK] Preview written to: ${previewPath}\n`);
    
    console.log(`[DRY-RUN] Preview complete. Review the markdown file before running without --dry-run.`);
  } else {
    // Apply updates
    console.log(`[INFO] Applying updates to ${updates.length} rows...\n`);
    
    let updatedCount = 0;
    for (const { spine, help_text } of updates) {
      await pool.query(
        `UPDATE public.baseline_spines_runtime SET help_text = $1 WHERE canon_id = $2`,
        [help_text, spine.canon_id]
      );
      updatedCount++;
      
      if (updatedCount % 10 === 0) {
        process.stdout.write(`\r[INFO] Updated ${updatedCount}/${updates.length} rows...`);
      }
    }
    
    console.log(`\n[OK] Successfully updated ${updatedCount} rows\n`);
    
    // Verify
    // Cast to text to avoid INT32 serialization issues with large counts
    const verifyResult = await pool.query(`
      SELECT COUNT(*)::text as total, 
             SUM(CASE WHEN help_text IS NOT NULL AND help_text <> '' THEN 1 ELSE 0 END)::text as with_help
      FROM public.baseline_spines_runtime
      WHERE active = true
    `);
    
    const totalValue = verifyResult.rows[0].total;
    const withHelpValue = verifyResult.rows[0].with_help;
    const total = parseInt(String(totalValue), 10);
    const with_help = parseInt(String(withHelpValue), 10);
    console.log(`[VERIFY] Active spines: ${total}, with help_text: ${with_help}`);
    
    if (parseInt(with_help) === parseInt(total)) {
      console.log(`[OK] All active spines now have help_text`);
    } else {
      console.warn(`[WARN] ${parseInt(total) - parseInt(with_help)} active spines still missing help_text`);
    }
  }
}

main().catch((error) => {
  console.error('[ERROR]', error);
  process.exit(1);
});
