/**
 * Apply Guidance Required Flags
 * 
 * Applies guidance_required=true flags to abstract subtypes based on heuristic keyword matching.
 * Uses the same logic as the validator to ensure consistency.
 * 
 * Usage:
 *   npx tsx tools/apply_guidance_required_flags.ts
 * 
 * Outputs:
 *   - tools/outputs/guidance_required_flags_report.json
 *   - tools/outputs/guidance_required_flags_report.md
 *   - taxonomy/discipline_subtypes.json (updated in-place)
 */

import * as fs from 'fs';
import * as path from 'path';

const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const REPORT_JSON = path.join(OUTPUT_DIR, 'guidance_required_flags_report.json');
const REPORT_MD = path.join(OUTPUT_DIR, 'guidance_required_flags_report.md');

// Heuristic keywords for name matching (case-insensitive) - same as validator
const HEURISTIC_NAME_KEYWORDS = [
  'architecture', 'governance', 'oversight', 'policy', 'procedure', 'planning',
  'resilience', 'integration', 'coordination', 'management', 'continuity', 'crisis',
  'risk', 'assessment', 'documentation', 'compliance', 'interoperable'
];

// Heuristic keywords for subtype_code matching (case-insensitive) - same as validator
const HEURISTIC_CODE_KEYWORDS = [
  'ARCH', 'GOV', 'PLAN', 'RESILIENCE', 'INTEGRATION', 'COORD', 'RISK',
  'CONTINUITY', 'CRISIS', 'POLICY', 'PROCEDURE', 'DOC', 'COMPLIANCE', 'INTEROPERABLE'
];

interface TaxonomySubtype {
  id: string;
  name: string;
  subtype_code: string;
  description: string | null;
  discipline_id: string;
  discipline_code: string;
  discipline_name: string;
  is_active: boolean;
  guidance_required?: boolean;
  guidance?: any;
}

interface TaxonomyData {
  metadata: {
    version: string;
    total_subtypes: number;
    generated_at: string;
    authority: string;
  };
  subtypes: TaxonomySubtype[];
}

interface FlaggedSubtype {
  discipline_code: string;
  subtype_code: string;
  name: string;
}

interface Report {
  applied_at: string;
  taxonomy_total: number;
  required_set_count: number;
  newly_flagged_count: number;
  already_flagged_count: number;
  newly_flagged_subtypes: FlaggedSubtype[];
  already_flagged_subtypes: FlaggedSubtype[];
  duplicate_subtype_codes: string[];
}

/**
 * Check if subtype should require guidance based on heuristic keywords
 * (Same logic as validator)
 */
function requiresGuidanceHeuristic(subtype: TaxonomySubtype): boolean {
  const nameLower = (subtype.name || '').toLowerCase();
  const codeUpper = (subtype.subtype_code || '').toUpperCase();

  // Check name keywords
  for (const keyword of HEURISTIC_NAME_KEYWORDS) {
    if (nameLower.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  // Check subtype_code keywords
  for (const keyword of HEURISTIC_CODE_KEYWORDS) {
    if (codeUpper.includes(keyword.toUpperCase())) {
      return true;
    }
  }

  return false;
}

function main() {
  console.log('=== Apply Guidance Required Flags ===\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load taxonomy
  console.log(`Loading taxonomy from: ${TAXONOMY_FILE}`);
  if (!fs.existsSync(TAXONOMY_FILE)) {
    console.error(`❌ Taxonomy file not found: ${TAXONOMY_FILE}`);
    process.exit(1);
  }

  const taxonomyData: TaxonomyData = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf-8'));
  console.log(`✓ Loaded ${taxonomyData.subtypes.length} subtypes\n`);

  // Check for duplicate subtype_codes
  const subtypeCodeMap = new Map<string, number>();
  for (const subtype of taxonomyData.subtypes) {
    const count = subtypeCodeMap.get(subtype.subtype_code) || 0;
    subtypeCodeMap.set(subtype.subtype_code, count + 1);
  }

  const duplicateCodes: string[] = [];
  for (const [code, count] of subtypeCodeMap.entries()) {
    if (count > 1) {
      duplicateCodes.push(code);
    }
  }

  if (duplicateCodes.length > 0) {
    console.error(`❌ Found duplicate subtype_codes: ${duplicateCodes.join(', ')}`);
    process.exit(1);
  }

  // Initialize report
  const report: Report = {
    applied_at: new Date().toISOString(),
    taxonomy_total: taxonomyData.subtypes.length,
    required_set_count: 0,
    newly_flagged_count: 0,
    already_flagged_count: 0,
    newly_flagged_subtypes: [],
    already_flagged_subtypes: [],
    duplicate_subtype_codes: duplicateCodes,
  };

  // Apply flags
  console.log('Applying guidance_required flags...\n');

  for (const subtype of taxonomyData.subtypes) {
    const shouldRequire = requiresGuidanceHeuristic(subtype);

    if (shouldRequire) {
      report.required_set_count++;

      const alreadyFlagged = subtype.guidance_required === true;

      if (alreadyFlagged) {
        report.already_flagged_count++;
        report.already_flagged_subtypes.push({
          discipline_code: subtype.discipline_code,
          subtype_code: subtype.subtype_code,
          name: subtype.name,
        });
      } else {
        // Set flag
        subtype.guidance_required = true;
        report.newly_flagged_count++;
        report.newly_flagged_subtypes.push({
          discipline_code: subtype.discipline_code,
          subtype_code: subtype.subtype_code,
          name: subtype.name,
        });
        console.log(`✓ Flagged: ${subtype.subtype_code} (${subtype.name})`);
      }
    }
    // If not in required set, leave guidance_required as-is (don't force false)
  }

  console.log(`\n✓ Applied ${report.newly_flagged_count} new flags`);
  console.log(`✓ ${report.already_flagged_count} subtypes already flagged\n`);

  // Write updated taxonomy (preserve order, deterministic formatting)
  fs.writeFileSync(TAXONOMY_FILE, JSON.stringify(taxonomyData, null, 2) + '\n', 'utf-8');
  console.log(`✓ Taxonomy file updated: ${TAXONOMY_FILE}`);

  // Sort flagged subtypes by discipline_code then subtype_code
  report.newly_flagged_subtypes.sort((a, b) => {
    const discCompare = a.discipline_code.localeCompare(b.discipline_code);
    if (discCompare !== 0) return discCompare;
    return a.subtype_code.localeCompare(b.subtype_code);
  });

  report.already_flagged_subtypes.sort((a, b) => {
    const discCompare = a.discipline_code.localeCompare(b.discipline_code);
    if (discCompare !== 0) return discCompare;
    return a.subtype_code.localeCompare(b.subtype_code);
  });

  // Write JSON report
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`✓ Report JSON written: ${REPORT_JSON}`);

  // Generate markdown report
  const mdLines: string[] = [
    '# Guidance Required Flags Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- **Taxonomy Total:** ${report.taxonomy_total}`,
    `- **Required Set Count:** ${report.required_set_count}`,
    `- **Newly Flagged:** ${report.newly_flagged_count}`,
    `- **Already Flagged:** ${report.already_flagged_count}`,
    `- **Duplicate Subtype Codes:** ${report.duplicate_subtype_codes.length}`,
    '',
  ];

  if (report.newly_flagged_subtypes.length > 0) {
    mdLines.push('## Newly Flagged Subtypes', '');
    mdLines.push(`The following ${report.newly_flagged_subtypes.length} subtypes were flagged with \`guidance_required=true\`:`);
    mdLines.push('');
    mdLines.push('| Discipline Code | Subtype Code | Name |');
    mdLines.push('|----------------|--------------|------|');
    for (const subtype of report.newly_flagged_subtypes) {
      mdLines.push(`| \`${subtype.discipline_code}\` | \`${subtype.subtype_code}\` | ${subtype.name} |`);
    }
    mdLines.push('');
  }

  if (report.already_flagged_subtypes.length > 0) {
    mdLines.push('## Already Flagged Subtypes', '');
    mdLines.push(`The following ${report.already_flagged_subtypes.length} subtypes were already flagged:`);
    mdLines.push('');
    mdLines.push('| Discipline Code | Subtype Code | Name |');
    mdLines.push('|----------------|--------------|------|');
    for (const subtype of report.already_flagged_subtypes) {
      mdLines.push(`| \`${subtype.discipline_code}\` | \`${subtype.subtype_code}\` | ${subtype.name} |`);
    }
    mdLines.push('');
  }

  if (report.duplicate_subtype_codes.length > 0) {
    mdLines.push('## ⚠️ Duplicate Subtype Codes', '');
    mdLines.push('**Error:** The following subtype codes appear multiple times:');
    mdLines.push('');
    for (const code of report.duplicate_subtype_codes) {
      mdLines.push(`- \`${code}\``);
    }
    mdLines.push('');
  }

  fs.writeFileSync(REPORT_MD, mdLines.join('\n'), 'utf-8');
  console.log(`✓ Report Markdown written: ${REPORT_MD}\n`);

  // Print summary
  console.log('=== Summary ===');
  console.log(`Taxonomy Total: ${report.taxonomy_total}`);
  console.log(`Required Set Count: ${report.required_set_count}`);
  console.log(`Newly Flagged: ${report.newly_flagged_count}`);
  console.log(`Already Flagged: ${report.already_flagged_count}`);
  console.log(`Duplicate Subtype Codes: ${report.duplicate_subtype_codes.length}`);

  // Print runbook
  console.log('\n=== Next Steps (CI Runbook) ===');
  console.log('1) npm run validate:guidance:explicit');
  console.log('2) npm run validate:guidance:threshold');
  console.log('3) npm run validate:guidance:strict (optional)');

  console.log('\n✅ Flags applied successfully!');
}

main();
