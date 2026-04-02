#!/usr/bin/env tsx
/**
 * Baseline Coverage Report
 * 
 * Produces a deterministic baseline coverage report showing:
 * - How many baseline questions exist today
 * - Which canonical subtypes have zero questions
 * - Which subtype/component buckets are missing (People/Process/Systems)
 * 
 * Outputs:
 * - tools/reports/baseline_coverage_report.json (machine-readable)
 * - tools/reports/baseline_coverage_report.md (human-readable)
 * 
 * Usage:
 *   npx tsx tools/baseline_coverage_report.ts
 */

import * as dotenv from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Clean up environment variables
if (process.env.SUPABASE_RUNTIME_URL) {
  process.env.SUPABASE_RUNTIME_URL = process.env.SUPABASE_RUNTIME_URL.trim().replace(/^\\+|\/+$/, '');
}
if (process.env.SUPABASE_RUNTIME_DB_PASSWORD) {
  process.env.SUPABASE_RUNTIME_DB_PASSWORD = process.env.SUPABASE_RUNTIME_DB_PASSWORD.trim().replace(/^\\+|\/+$/, '');
}

interface SubtypeData {
  id: string;
  name: string;
  subtype_code: string;
  description: string | null;
  discipline_id: string;
  discipline_code: string;
  discipline_name: string;
  is_active: boolean;
  baseline_eligible?: boolean;
}

interface ArchiveData {
  metadata: {
    version: string;
    total_subtypes: number;
    generated_at: string;
    authority: string;
  };
  subtypes: SubtypeData[];
}

interface BaselineSpine {
  canon_id: string;
  discipline_code: string;
  subtype_code: string | null;
  question_text: string;
  component?: string | null;
  active: boolean;
}

interface ComponentCounts {
  [key: string]: number;
}

interface SubtypeCoverage {
  subtype_code: string;
  subtype_name: string;
  discipline_code: string;
  discipline_name: string;
  count_total: number;
  counts_by_component: ComponentCounts;
  sample_questions: string[];
}

interface CoverageReport {
  generated_at: string;
  totals: {
    total_active_questions: number;
    distinct_subtypes_with_questions: number;
    distinct_disciplines_with_questions: number;
    total_canonical_subtypes: number;
    baseline_eligible_subtypes: number;
    excluded_subtypes: number;
    subtypes_missing_all_questions: number;
  };
  excluded_subtypes: Array<{
    subtype_code: string;
    subtype_name: string;
    discipline_code: string;
    reason: string;
  }>;
  per_subtype: SubtypeCoverage[];
  gaps: {
    subtypes_missing_all_questions: string[];
    subtypes_missing_component: Array<{
      subtype_code: string;
      missing_components: string[];
    }>;
  };
  by_discipline: {
    [disciplineCode: string]: {
      discipline_name: string;
      subtypes_covered: number;
      total_subtypes: number;
      coverage_percentage: number;
    };
  };
}

function normalizeComponent(component: string | null | undefined): string {
  if (!component || typeof component !== 'string') {
    return 'UNSPECIFIED';
  }
  return component.trim().toUpperCase();
}

function loadTaxonomy(): SubtypeData[] {
  const taxonomyPath = join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
  console.log(`Loading taxonomy from: ${taxonomyPath}`);
  
  const content = readFileSync(taxonomyPath, 'utf-8');
  const archive: ArchiveData = JSON.parse(content);
  
  // Note: Subtype count may vary as taxonomy evolves
  // The important check is that we filter by baseline_eligible correctly
  if (archive.subtypes.length < 100) {
    throw new Error(
      `Expected at least 100 canonical subtypes, found ${archive.subtypes.length}. ` +
      `Taxonomy file may be incomplete or corrupted.`
    );
  }
  
  console.log(`✓ Loaded ${archive.subtypes.length} canonical subtypes`);
  
  // Filter out subtypes excluded from baseline (baseline_eligible === false)
  const baselineEligibleSubtypes = archive.subtypes.filter(
    (st: SubtypeData) => st.baseline_eligible !== false
  );
  const excludedCount = archive.subtypes.length - baselineEligibleSubtypes.length;
  
  if (excludedCount > 0) {
    console.log(`  ⚠ Excluded ${excludedCount} subtypes from baseline (baseline_eligible=false)`);
    archive.subtypes
      .filter((st: SubtypeData) => st.baseline_eligible === false)
      .forEach((st: SubtypeData) => {
        console.log(`    - ${st.subtype_code}: ${st.name}`);
      });
  }
  
  return baselineEligibleSubtypes;
}

async function loadBaselineSpines(pool: any): Promise<BaselineSpine[]> {
  console.log('Querying baseline_spines_runtime...');
  
  // Check if component column exists
  const columnCheck = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'baseline_spines_runtime'
    AND column_name = 'component'
  `);
  
  const hasComponentColumn = columnCheck.rows.length > 0;
  
  let query: string;
  if (hasComponentColumn) {
    query = `
      SELECT 
        canon_id,
        discipline_code,
        subtype_code,
        question_text,
        component,
        active
      FROM public.baseline_spines_runtime
      WHERE active = true
      ORDER BY discipline_code, subtype_code, canon_id
    `;
  } else {
    query = `
      SELECT 
        canon_id,
        discipline_code,
        subtype_code,
        question_text,
        NULL as component,
        active
      FROM public.baseline_spines_runtime
      WHERE active = true
      ORDER BY discipline_code, subtype_code, canon_id
    `;
  }
  
  const result = await pool.query(query);
  const spines: BaselineSpine[] = result.rows;
  
  console.log(`✓ Loaded ${spines.length} active baseline spines`);
  if (!hasComponentColumn) {
    console.log(`  ⚠ Component column not found - all questions will be marked as UNSPECIFIED`);
  }
  
  return spines;
}

function computeCoverage(
  subtypes: SubtypeData[],
  spines: BaselineSpine[],
  allSubtypes: SubtypeData[]
): CoverageReport {
  console.log('\nComputing coverage...');
  
  // Find excluded subtypes (baseline_eligible === false)
  const excludedSubtypes = allSubtypes.filter(
    (st: SubtypeData) => st.baseline_eligible === false
  ).map((st: SubtypeData) => ({
    subtype_code: st.subtype_code,
    subtype_name: st.name,
    discipline_code: st.discipline_code,
    reason: 'baseline_eligible=false'
  }));
  
  // Create subtype lookup by subtype_code (only baseline-eligible subtypes)
  const subtypeMap = new Map<string, SubtypeData>();
  subtypes.forEach(st => {
    if (st.subtype_code) {
      subtypeMap.set(st.subtype_code, st);
    }
  });
  
  // Group spines by subtype_code
  const spinesBySubtype = new Map<string, BaselineSpine[]>();
  const componentCountsBySubtype = new Map<string, ComponentCounts>();
  
  spines.forEach(spine => {
    const subtypeCode = spine.subtype_code || 'UNSPECIFIED_SUBTYPE';
    if (!spinesBySubtype.has(subtypeCode)) {
      spinesBySubtype.set(subtypeCode, []);
      componentCountsBySubtype.set(subtypeCode, {});
    }
    spinesBySubtype.get(subtypeCode)!.push(spine);
    
    const componentNorm = normalizeComponent(spine.component);
    const counts = componentCountsBySubtype.get(subtypeCode)!;
    counts[componentNorm] = (counts[componentNorm] || 0) + 1;
  });
  
  // Build per-subtype coverage
  const perSubtype: SubtypeCoverage[] = [];
  const subtypesWithQuestions = new Set<string>();
  const disciplinesWithQuestions = new Set<string>();
  
  subtypes.forEach(subtype => {
    const subtypeCode = subtype.subtype_code;
    const spinesForSubtype = spinesBySubtype.get(subtypeCode) || [];
    const componentCounts = componentCountsBySubtype.get(subtypeCode) || {};
    
    if (spinesForSubtype.length > 0) {
      subtypesWithQuestions.add(subtypeCode);
      disciplinesWithQuestions.add(subtype.discipline_code);
    }
    
    perSubtype.push({
      subtype_code: subtypeCode,
      subtype_name: subtype.name,
      discipline_code: subtype.discipline_code,
      discipline_name: subtype.discipline_name,
      count_total: spinesForSubtype.length,
      counts_by_component: componentCounts,
      sample_questions: spinesForSubtype
        .slice(0, 3)
        .map(s => s.question_text.substring(0, 100) + (s.question_text.length > 100 ? '...' : ''))
    });
  });
  
  // Find gaps
  const subtypesMissingAllQuestions = perSubtype
    .filter(s => s.count_total === 0)
    .map(s => s.subtype_code);
  
  // Find subtypes missing specific components
  // Expected components: PEOPLE, PROCESS, SYSTEMS
  const expectedComponents = ['PEOPLE', 'PROCESS', 'SYSTEMS'];
  const subtypesMissingComponent: Array<{ subtype_code: string; missing_components: string[] }> = [];
  
  perSubtype.forEach(subtype => {
    if (subtype.count_total > 0) {
      const presentComponents = Object.keys(subtype.counts_by_component);
      const missingComponents = expectedComponents.filter(
        comp => !presentComponents.includes(comp)
      );
      if (missingComponents.length > 0) {
        subtypesMissingComponent.push({
          subtype_code: subtype.subtype_code,
          missing_components: missingComponents
        });
      }
    }
  });
  
  // Build by-discipline summary
  const byDiscipline: { [key: string]: { discipline_name: string; subtypes_covered: number; total_subtypes: number; coverage_percentage: number } } = {};
  
  subtypes.forEach(subtype => {
    const discCode = subtype.discipline_code;
    if (!byDiscipline[discCode]) {
      byDiscipline[discCode] = {
        discipline_name: subtype.discipline_name,
        subtypes_covered: 0,
        total_subtypes: 0,
        coverage_percentage: 0
      };
    }
    byDiscipline[discCode].total_subtypes++;
    if (subtypesWithQuestions.has(subtype.subtype_code)) {
      byDiscipline[discCode].subtypes_covered++;
    }
  });
  
  // Calculate coverage percentages
  Object.keys(byDiscipline).forEach(discCode => {
    const disc = byDiscipline[discCode];
    disc.coverage_percentage = disc.total_subtypes > 0
      ? Math.round((disc.subtypes_covered / disc.total_subtypes) * 100)
      : 0;
  });
  
  const report: CoverageReport = {
    generated_at: new Date().toISOString(),
    totals: {
      total_active_questions: spines.length,
      distinct_subtypes_with_questions: subtypesWithQuestions.size,
      distinct_disciplines_with_questions: disciplinesWithQuestions.size,
      total_canonical_subtypes: allSubtypes.length,
      baseline_eligible_subtypes: subtypes.length,
      excluded_subtypes: excludedSubtypes.length,
      subtypes_missing_all_questions: subtypesMissingAllQuestions.length
    },
    excluded_subtypes: excludedSubtypes,
    per_subtype: perSubtype.sort((a, b) => {
      // Sort by discipline_code, then by subtype_code
      if (a.discipline_code !== b.discipline_code) {
        return a.discipline_code.localeCompare(b.discipline_code);
      }
      return a.subtype_code.localeCompare(b.subtype_code);
    }),
    gaps: {
      subtypes_missing_all_questions: subtypesMissingAllQuestions.sort(),
      subtypes_missing_component: subtypesMissingComponent.sort((a, b) =>
        a.subtype_code.localeCompare(b.subtype_code)
      )
    },
    by_discipline: byDiscipline
  };
  
  return report;
}

function writeJSONReport(report: CoverageReport): void {
  const reportsDir = join(process.cwd(), 'tools', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  
  const jsonPath = join(reportsDir, 'baseline_coverage_report.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`✓ Wrote JSON report: ${jsonPath}`);
}

function writeMarkdownReport(report: CoverageReport): void {
  const reportsDir = join(process.cwd(), 'tools', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  
  const mdPath = join(reportsDir, 'baseline_coverage_report.md');
  
  let md = `# Baseline Coverage Report\n\n`;
  md += `**Generated:** ${new Date(report.generated_at).toLocaleString()}\n\n`;
  md += `---\n\n`;
  
  // Headline counts
  md += `## Headline Counts\n\n`;
  md += `- **Total Active Baseline Questions:** ${report.totals.total_active_questions}\n`;
  md += `- **Subtypes with Questions:** ${report.totals.distinct_subtypes_with_questions} / ${report.totals.baseline_eligible_subtypes}\n`;
  md += `- **Disciplines with Questions:** ${report.totals.distinct_disciplines_with_questions}\n`;
  md += `- **Subtypes Missing All Questions:** ${report.totals.subtypes_missing_all_questions}\n`;
  md += `- **Baseline-Eligible Subtypes:** ${report.totals.baseline_eligible_subtypes} / ${report.totals.total_canonical_subtypes}\n`;
  md += `- **Excluded from Baseline:** ${report.totals.excluded_subtypes}\n\n`;
  
  // Excluded subtypes section
  if (report.excluded_subtypes.length > 0) {
    md += `## Excluded Subtypes (baseline_eligible=false)\n\n`;
    md += `These subtypes are excluded from baseline coverage requirements:\n\n`;
    md += `| Subtype Code | Subtype Name | Discipline | Reason |\n`;
    md += `|--------------|--------------|-----------|--------|\n`;
    report.excluded_subtypes.forEach(excluded => {
      md += `| ${excluded.subtype_code} | ${excluded.subtype_name} | ${excluded.discipline_code} | ${excluded.reason} |\n`;
    });
    md += `\n`;
  }
  
  // Discipline coverage table
  md += `## Coverage by Discipline\n\n`;
  md += `| Discipline | Name | Covered | Total | Coverage % |\n`;
  md += `|------------|------|---------|-------|------------|\n`;
  
  const disciplineCodes = Object.keys(report.by_discipline).sort();
  disciplineCodes.forEach(discCode => {
    const disc = report.by_discipline[discCode];
    md += `| ${discCode} | ${disc.discipline_name} | ${disc.subtypes_covered} | ${disc.total_subtypes} | ${disc.coverage_percentage}% |\n`;
  });
  
  md += `\n`;
  
  // Top missing subtypes
  md += `## Top Missing Subtypes (No Questions)\n\n`;
  const missingSubtypes = report.gaps.subtypes_missing_all_questions.slice(0, 30);
  if (missingSubtypes.length > 0) {
    md += `| Subtype Code | Subtype Name | Discipline |\n`;
    md += `|--------------|--------------|------------|\n`;
    
    missingSubtypes.forEach(subtypeCode => {
      const subtype = report.per_subtype.find(s => s.subtype_code === subtypeCode);
      if (subtype) {
        md += `| ${subtypeCode} | ${subtype.subtype_name} | ${subtype.discipline_code} |\n`;
      }
    });
  } else {
    md += `*All subtypes have at least one question.*\n`;
  }
  
  md += `\n`;
  
  // Component gaps
  md += `## Component Gap Hot Spots\n\n`;
  if (report.gaps.subtypes_missing_component.length > 0) {
    md += `Subtypes with questions but missing component buckets:\n\n`;
    md += `| Subtype Code | Missing Components |\n`;
    md += `|--------------|---------------------|\n`;
    
    report.gaps.subtypes_missing_component.forEach(gap => {
      md += `| ${gap.subtype_code} | ${gap.missing_components.join(', ')} |\n`;
    });
  } else {
    md += `*No component gaps detected.*\n`;
  }
  
  md += `\n`;
  
  // Detailed per-subtype breakdown (summary)
  md += `## Detailed Per-Subtype Breakdown\n\n`;
  md += `| Subtype Code | Discipline | Questions | Components |\n`;
  md += `|--------------|------------|-----------|------------|\n`;
  
  report.per_subtype.forEach(subtype => {
    const componentSummary = Object.keys(subtype.counts_by_component)
      .map(comp => `${comp}:${subtype.counts_by_component[comp]}`)
      .join(', ') || 'UNSPECIFIED';
    
    md += `| ${subtype.subtype_code} | ${subtype.discipline_code} | ${subtype.count_total} | ${componentSummary} |\n`;
  });
  
  writeFileSync(mdPath, md, 'utf-8');
  console.log(`✓ Wrote Markdown report: ${mdPath}`);
}

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('Baseline Coverage Report');
    console.log('='.repeat(80));
    console.log();
    
    // Load taxonomy (returns only baseline-eligible subtypes)
    const subtypes = loadTaxonomy();
    
    // Load full taxonomy to get excluded subtypes
    const taxonomyPath = join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
    const fullTaxonomyContent = readFileSync(taxonomyPath, 'utf-8');
    const fullArchive: ArchiveData = JSON.parse(fullTaxonomyContent);
    const allSubtypes = fullArchive.subtypes;
    
    // Connect to database
    console.log('\nConnecting to database...');
    const pool = await ensureRuntimePoolConnected();
    console.log('✓ Database connected');
    
    // Load baseline spines
    const spines = await loadBaselineSpines(pool);
    
    // Compute coverage
    const report = computeCoverage(subtypes, spines, allSubtypes);
    
    // Write reports
    console.log('\nWriting reports...');
    writeJSONReport(report);
    writeMarkdownReport(report);
    
    console.log('\n' + '='.repeat(80));
    console.log('✓ Baseline coverage report complete!');
    console.log('='.repeat(80));
    console.log(`\nSummary:`);
    console.log(`  - Active questions: ${report.totals.total_active_questions}`);
    console.log(`  - Subtypes covered: ${report.totals.distinct_subtypes_with_questions} / ${report.totals.baseline_eligible_subtypes}`);
    console.log(`  - Subtypes missing: ${report.totals.subtypes_missing_all_questions}`);
    console.log(`  - Baseline-eligible: ${report.totals.baseline_eligible_subtypes} / ${report.totals.total_canonical_subtypes}`);
    console.log(`  - Excluded from baseline: ${report.totals.excluded_subtypes}`);
    console.log(`  - Component gaps: ${report.gaps.subtypes_missing_component.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  }
}

main();
