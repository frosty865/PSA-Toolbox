/**
 * Merge Subtype Guidance into Taxonomy
 * 
 * Bulk-merge subtype narrative guidance from discipline_subtypes_rows.json
 * into taxonomy/discipline_subtypes.json by subtype_code.
 * 
 * Only updates the optional "guidance" object; never modifies identity fields.
 * 
 * Usage:
 *   node tools/merge_subtype_guidance.ts --dry-run
 *   node tools/merge_subtype_guidance.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
const SOURCE_FILE = path.join(process.cwd(), 'src', 'data', 'discipline_subtypes_rows.json');
const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const REPORT_JSON = path.join(OUTPUT_DIR, 'subtype_guidance_merge_report.json');
const REPORT_MD = path.join(OUTPUT_DIR, 'subtype_guidance_merge_report.md');

const DRY_RUN = process.argv.includes('--dry-run');

interface SubtypeGuidance {
  overview?: string;
  indicators_of_risk?: string[];
  common_failures?: string[];
  mitigation_guidance?: string[];
  standards_references?: string[];
  psa_notes?: string;
}

interface SourceRow {
  code?: string;
  subtype_code?: string;
  overview?: string | null;
  indicators_of_risk?: string[] | null;
  common_failures?: string[] | null;
  mitigation_guidance?: string[] | null;
  standards_references?: string[] | null;
  psa_notes?: string | null;
  [key: string]: any;
}

interface TaxonomySubtype {
  id: string;
  name: string;
  subtype_code: string;
  description: string | null;
  discipline_id: string;
  discipline_code: string;
  discipline_name: string;
  is_active: boolean;
  guidance?: SubtypeGuidance;
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

interface MergeReport {
  taxonomy_total: number;
  source_total: number;
  updated_count: number;
  already_had_guidance_count: number;
  missing_in_source: string[];
  orphan_source_not_in_taxonomy: string[];
  examples: {
    updated: Array<{
      subtype_code: string;
      fields_written: string[];
    }>;
    skipped_existing: string[];
  };
}

/**
 * Normalize guidance fields from source row
 */
function normalizeGuidance(row: SourceRow): SubtypeGuidance | null {
  const guidance: SubtypeGuidance = {};
  let hasAnyField = false;

  if (row.overview && typeof row.overview === 'string' && row.overview.trim()) {
    guidance.overview = row.overview.trim();
    hasAnyField = true;
  }

  if (Array.isArray(row.indicators_of_risk) && row.indicators_of_risk.length > 0) {
    guidance.indicators_of_risk = row.indicators_of_risk.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    );
    if (guidance.indicators_of_risk.length > 0) {
      hasAnyField = true;
    }
  }

  if (Array.isArray(row.common_failures) && row.common_failures.length > 0) {
    guidance.common_failures = row.common_failures.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    );
    if (guidance.common_failures.length > 0) {
      hasAnyField = true;
    }
  }

  if (Array.isArray(row.mitigation_guidance) && row.mitigation_guidance.length > 0) {
    guidance.mitigation_guidance = row.mitigation_guidance.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    );
    if (guidance.mitigation_guidance.length > 0) {
      hasAnyField = true;
    }
  }

  if (Array.isArray(row.standards_references) && row.standards_references.length > 0) {
    guidance.standards_references = row.standards_references.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    );
    if (guidance.standards_references.length > 0) {
      hasAnyField = true;
    }
  }

  if (row.psa_notes && typeof row.psa_notes === 'string' && row.psa_notes.trim()) {
    guidance.psa_notes = row.psa_notes.trim();
    hasAnyField = true;
  }

  return hasAnyField ? guidance : null;
}

/**
 * Get subtype_code from source row (supports both 'code' and 'subtype_code' fields)
 */
function getSubtypeCode(row: SourceRow): string | null {
  return row.subtype_code || row.code || null;
}

/**
 * Get list of fields written in guidance object
 */
function getFieldsWritten(guidance: SubtypeGuidance): string[] {
  const fields: string[] = [];
  if (guidance.overview) fields.push('overview');
  if (guidance.indicators_of_risk) fields.push('indicators_of_risk');
  if (guidance.common_failures) fields.push('common_failures');
  if (guidance.mitigation_guidance) fields.push('mitigation_guidance');
  if (guidance.standards_references) fields.push('standards_references');
  if (guidance.psa_notes) fields.push('psa_notes');
  return fields;
}

function main() {
  console.log('=== Subtype Guidance Merge Tool ===\n');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

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
  console.log(`✓ Loaded ${taxonomyData.subtypes.length} subtypes from taxonomy\n`);

  // Load source data
  console.log(`Loading source data from: ${SOURCE_FILE}`);
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`❌ Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }
  const sourceData: SourceRow[] = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf-8'));
  if (!Array.isArray(sourceData)) {
    console.error(`❌ Source file must contain a JSON array`);
    process.exit(1);
  }
  console.log(`✓ Loaded ${sourceData.length} rows from source\n`);

  // Build source map by subtype_code
  const sourceMap = new Map<string, SourceRow>();
  for (const row of sourceData) {
    const code = getSubtypeCode(row);
    if (code) {
      sourceMap.set(code, row);
    }
  }

  // Initialize report
  const report: MergeReport = {
    taxonomy_total: taxonomyData.subtypes.length,
    source_total: sourceData.length,
    updated_count: 0,
    already_had_guidance_count: 0,
    missing_in_source: [],
    orphan_source_not_in_taxonomy: [],
    examples: {
      updated: [],
      skipped_existing: []
    }
  };

  // Build taxonomy map for lookup
  const taxonomyMap = new Map<string, TaxonomySubtype>();
  for (const subtype of taxonomyData.subtypes) {
    taxonomyMap.set(subtype.subtype_code, subtype);
  }

  // Find orphan source rows (not in taxonomy)
  for (const code of Array.from(sourceMap.keys())) {
    if (!taxonomyMap.has(code)) {
      report.orphan_source_not_in_taxonomy.push(code);
    }
  }

  // Process each taxonomy subtype
  const previewSamples: Array<{
    subtype_code: string;
    subtype_name: string;
    action: string;
    fields_written?: string[];
  }> = [];

  for (const subtype of taxonomyData.subtypes) {
    const sourceRow = sourceMap.get(subtype.subtype_code);
    
    if (!sourceRow) {
      report.missing_in_source.push(subtype.subtype_code);
      continue;
    }

    const normalizedGuidance = normalizeGuidance(sourceRow);
    
    if (!normalizedGuidance) {
      // Source row exists but has no guidance fields
      continue;
    }

    const hadGuidance = !!subtype.guidance;
    
    if (hadGuidance) {
      report.already_had_guidance_count++;
      if (report.examples.skipped_existing.length < 5) {
        report.examples.skipped_existing.push(subtype.subtype_code);
      }
      previewSamples.push({
        subtype_code: subtype.subtype_code,
        subtype_name: subtype.name,
        action: 'SKIPPED (already had guidance)'
      });
    } else {
      // Update guidance
      subtype.guidance = normalizedGuidance;
      report.updated_count++;
      
      const fieldsWritten = getFieldsWritten(normalizedGuidance);
      if (report.examples.updated.length < 10) {
        report.examples.updated.push({
          subtype_code: subtype.subtype_code,
          fields_written: fieldsWritten
        });
      }
      
      if (previewSamples.length < 10) {
        previewSamples.push({
          subtype_code: subtype.subtype_code,
          subtype_name: subtype.name,
          action: 'UPDATED',
          fields_written: fieldsWritten
        });
      }
    }
  }

  // Write report JSON
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`✓ Report JSON written: ${REPORT_JSON}`);

  // Generate markdown report
  const mdLines: string[] = [
    '# Subtype Guidance Merge Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Mode:** ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`,
    '',
    '## Summary',
    '',
    `- **Taxonomy Subtypes:** ${report.taxonomy_total}`,
    `- **Source Rows:** ${report.source_total}`,
    `- **Updated:** ${report.updated_count}`,
    `- **Already Had Guidance:** ${report.already_had_guidance_count}`,
    `- **Missing in Source:** ${report.missing_in_source.length}`,
    `- **Orphan Source (not in taxonomy):** ${report.orphan_source_not_in_taxonomy.length}`,
    '',
    '## Coverage',
    '',
    `**Coverage Rate:** ${((report.updated_count + report.already_had_guidance_count) / report.taxonomy_total * 100).toFixed(1)}%`,
    '',
    `- Subtypes with guidance after merge: ${report.updated_count + report.already_had_guidance_count} / ${report.taxonomy_total}`,
    '',
  ];

  if (report.missing_in_source.length > 0) {
    mdLines.push('## Missing in Source', '');
    mdLines.push(`The following ${report.missing_in_source.length} subtypes exist in taxonomy but have no corresponding source row:`);
    mdLines.push('');
    for (const code of report.missing_in_source.slice(0, 20)) {
      mdLines.push(`- \`${code}\``);
    }
    if (report.missing_in_source.length > 20) {
      mdLines.push(`- ... and ${report.missing_in_source.length - 20} more`);
    }
    mdLines.push('');
  }

  if (report.orphan_source_not_in_taxonomy.length > 0) {
    mdLines.push('## Orphan Source Rows', '');
    mdLines.push(`⚠️ **Warning:** The following ${report.orphan_source_not_in_taxonomy.length} source rows do not match any taxonomy subtype:`);
    mdLines.push('');
    for (const code of report.orphan_source_not_in_taxonomy.slice(0, 20)) {
      mdLines.push(`- \`${code}\``);
    }
    if (report.orphan_source_not_in_taxonomy.length > 20) {
      mdLines.push(`- ... and ${report.orphan_source_not_in_taxonomy.length - 20} more`);
    }
    mdLines.push('');
  }

  if (previewSamples.length > 0) {
    mdLines.push('## Preview Samples', '');
    mdLines.push('### Updated Subtypes', '');
    mdLines.push('');
    mdLines.push('| Subtype Code | Subtype Name | Fields Written |');
    mdLines.push('|--------------|--------------|----------------|');
    for (const sample of previewSamples.filter(s => s.action === 'UPDATED')) {
      mdLines.push(`| \`${sample.subtype_code}\` | ${sample.subtype_name} | ${sample.fields_written?.join(', ') || 'N/A'} |`);
    }
    mdLines.push('');
    
    if (previewSamples.some(s => s.action === 'SKIPPED (already had guidance)')) {
      mdLines.push('### Skipped (Already Had Guidance)', '');
      mdLines.push('');
      mdLines.push('| Subtype Code | Subtype Name |');
      mdLines.push('|--------------|--------------|');
      for (const sample of previewSamples.filter(s => s.action === 'SKIPPED (already had guidance)')) {
        mdLines.push(`| \`${sample.subtype_code}\` | ${sample.subtype_name} |`);
      }
      mdLines.push('');
    }
  }

  fs.writeFileSync(REPORT_MD, mdLines.join('\n'), 'utf-8');
  console.log(`✓ Report Markdown written: ${REPORT_MD}\n`);

  // Write updated taxonomy (unless dry-run)
  if (!DRY_RUN) {
    // Preserve existing order and formatting by writing with 2-space indent
    fs.writeFileSync(TAXONOMY_FILE, JSON.stringify(taxonomyData, null, 2) + '\n', 'utf-8');
    console.log(`✓ Taxonomy file updated: ${TAXONOMY_FILE}`);
  } else {
    console.log(`🔍 DRY RUN: Taxonomy file would be updated: ${TAXONOMY_FILE}`);
  }

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Taxonomy subtypes: ${report.taxonomy_total}`);
  console.log(`Source rows: ${report.source_total}`);
  console.log(`Updated: ${report.updated_count}`);
  console.log(`Already had guidance: ${report.already_had_guidance_count}`);
  console.log(`Missing in source: ${report.missing_in_source.length}`);
  console.log(`Orphan source rows: ${report.orphan_source_not_in_taxonomy.length}`);
  console.log(`\nCoverage: ${((report.updated_count + report.already_had_guidance_count) / report.taxonomy_total * 100).toFixed(1)}%`);

  if (report.orphan_source_not_in_taxonomy.length > 0) {
    console.log(`\n⚠️  Warning: ${report.orphan_source_not_in_taxonomy.length} source rows do not match taxonomy subtypes`);
  }

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN complete. Review reports and run without --dry-run to apply changes.');
  } else {
    console.log('\n✓ Merge complete!');
  }
}

main();
