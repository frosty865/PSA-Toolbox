/**
 * Subtype Guidance Validator
 * 
 * Validates completeness and quality of subtype guidance in taxonomy/discipline_subtypes.json.
 * 
 * Usage:
 *   node tools/validate_subtype_guidance.ts
 *   node tools/validate_subtype_guidance.ts --mode=heuristic (default)
 *   node tools/validate_subtype_guidance.ts --mode=explicit (CI gate when explicit_required_count > 0)
 *   node tools/validate_subtype_guidance.ts --mode=threshold --threshold=0.95
 *   node tools/validate_subtype_guidance.ts --all
 *   node tools/validate_subtype_guidance.ts --only-required=false
 *   node tools/validate_subtype_guidance.ts --fail-on-warn=false
 * 
 * CI Commands:
 *   npm run validate:guidance:explicit    - Validate only guidance_required=true subtypes
 *   npm run validate:guidance:threshold    - Check 95% coverage threshold
 *   npm run validate:guidance:strict      - Check 98% coverage threshold
 * 
 * Exit codes:
 *   - 0: All validations passed (ok=true)
 *   - 1: Validation failures detected (ok=false)
 * 
 * Reports:
 *   - tools/outputs/subtype_guidance_validation.json
 *   - tools/outputs/subtype_guidance_validation.md
 */

import * as fs from 'fs';
import * as path from 'path';

const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const REPORT_JSON = path.join(OUTPUT_DIR, 'subtype_guidance_validation.json');
const REPORT_MD = path.join(OUTPUT_DIR, 'subtype_guidance_validation.md');
const REPORT_DETAILED_JSON = path.join(OUTPUT_DIR, 'subtype_guidance_detailed.json');
const REPORT_DETAILED_CSV = path.join(OUTPUT_DIR, 'subtype_guidance_detailed.csv');

// Parse CLI args
const args = process.argv.slice(2);
const FAIL_ON_WARN = !args.includes('--fail-on-warn=false');
const ONLY_REQUIRED = !args.includes('--all') && !args.includes('--only-required=false');
const VALIDATE_ALL = args.includes('--all');

// Parse mode flag
const modeArg = args.find(arg => arg.startsWith('--mode='));
const MODE = (modeArg?.split('=')[1] || 'heuristic') as 'explicit' | 'heuristic' | 'threshold';

// Parse threshold flag
const thresholdArg = args.find(arg => arg.startsWith('--threshold='));
const THRESHOLD = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : 0.95;

// Heuristic keywords for name matching (case-insensitive)
const HEURISTIC_NAME_KEYWORDS = [
  'architecture', 'governance', 'oversight', 'policy', 'procedure', 'planning',
  'resilience', 'integration', 'coordination', 'management', 'continuity', 'crisis',
  'risk', 'assessment', 'documentation', 'compliance', 'interoperable'
];

// Heuristic keywords for subtype_code matching (case-insensitive)
const HEURISTIC_CODE_KEYWORDS = [
  'ARCH', 'GOV', 'PLAN', 'RESILIENCE', 'INTEGRATION', 'COORD', 'RISK',
  'CONTINUITY', 'CRISIS', 'POLICY', 'PROCEDURE', 'DOC', 'COMPLIANCE'
];

interface SubtypeGuidance {
  overview?: string;
  indicators_of_risk?: string[];
  common_failures?: string[];
  mitigation_guidance?: string[];
  standards_references?: string[];
  psa_notes?: string;
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
  guidance_required?: boolean;
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

interface Violation {
  subtype_code: string;
  name: string;
  discipline_code: string;
  issues: string[];
}

interface DetailedSubtypeInfo {
  subtype_code: string;
  name: string;
  discipline_code: string;
  discipline_name: string;
  is_active: boolean;
  guidance_required_explicit: boolean;
  guidance_required_effective: boolean;
  has_guidance: boolean;
  has_overview: boolean;
  has_indicators_of_risk: boolean;
  has_common_failures: boolean;
  has_mitigation_guidance: boolean;
  has_standards_references: boolean;
  has_psa_notes: boolean;
  overview_length: number;
  indicators_of_risk_count: number;
  common_failures_count: number;
  mitigation_guidance_count: number;
  standards_references_count: number;
  psa_notes_length: number;
  guidance_complete: boolean;
  guidance_issues: string[];
}

interface DetailedReport {
  metadata: {
    generated_at: string;
    mode: 'explicit' | 'heuristic' | 'threshold';
    threshold?: number;
  };
  summary: {
    total_subtypes: number;
    guidance_required_explicit: number;
    guidance_required_effective: number;
    guidance_present: number;
    guidance_complete: number;
    guidance_coverage: number;
  };
  by_discipline: Record<string, {
    discipline_code: string;
    discipline_name: string;
    total: number;
    with_guidance: number;
    complete_guidance: number;
    required_effective: number;
    missing_guidance: string[];
  }>;
  subtypes: DetailedSubtypeInfo[];
}

interface ValidationReport {
  ok: boolean;
  mode: 'explicit' | 'heuristic' | 'threshold';
  taxonomy_total: number;
  subtypes_seen: number;
  guidance_required_count: number;
  guidance_present_count: number;
  guidance_coverage: number;
  required_effective_count: number;
  required_effective_missing: string[];
  explicit_required_count: number;
  explicit_required_missing: string[];
  violations_count: number;
  violations: Violation[];
  duplicate_subtype_codes: string[];
}

/**
 * Check if string is empty or whitespace-only
 */
function isEmpty(str: string | null | undefined): boolean {
  return !str || typeof str !== 'string' || str.trim().length === 0;
}

/**
 * Check if array is empty or contains only empty strings
 */
function isEmptyArray(arr: any[] | null | undefined): boolean {
  if (!arr || !Array.isArray(arr)) return true;
  return arr.length === 0 || arr.every(item => isEmpty(item));
}

/**
 * Check for duplicate strings in array (case-insensitive, trimmed)
 */
function hasDuplicates(arr: string[]): boolean {
  const normalized = arr.map(s => s.trim().toLowerCase());
  return new Set(normalized).size !== normalized.length;
}

/**
 * Check if subtype should require guidance based on heuristic keywords
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

/**
 * Validate guidance for a subtype
 */
function validateGuidance(
  subtype: TaxonomySubtype,
  validateRequired: boolean
): string[] {
  const issues: string[] = [];
  const guidance = subtype.guidance;

  // If guidance_required=true but no guidance object exists
  if (validateRequired && !guidance) {
    issues.push('guidance_required=true but guidance object is missing');
    return issues;
  }

  // If no guidance and not required, skip validation
  if (!guidance && !VALIDATE_ALL) {
    return issues;
  }

  // If guidance exists but guidance_required=false and we're only validating required
  if (guidance && !validateRequired && ONLY_REQUIRED) {
    return issues;
  }

  // Validate required fields (if guidance_required=true or --all flag)
  if (validateRequired || (guidance && VALIDATE_ALL)) {
    // overview: string length >= 40
    if (!guidance.overview || typeof guidance.overview !== 'string') {
      issues.push('guidance.overview is missing or not a string');
    } else if (guidance.overview.trim().length < 40) {
      issues.push(`guidance.overview too short (${guidance.overview.trim().length} chars, minimum 40)`);
    }

    // indicators_of_risk: array length >= 2
    if (!Array.isArray(guidance.indicators_of_risk)) {
      issues.push('guidance.indicators_of_risk is missing or not an array');
    } else if (guidance.indicators_of_risk.length < 2) {
      issues.push(`guidance.indicators_of_risk too short (${guidance.indicators_of_risk.length} items, minimum 2)`);
    }

    // common_failures: array length >= 2
    if (!Array.isArray(guidance.common_failures)) {
      issues.push('guidance.common_failures is missing or not an array');
    } else if (guidance.common_failures.length < 2) {
      issues.push(`guidance.common_failures too short (${guidance.common_failures.length} items, minimum 2)`);
    }

    // mitigation_guidance: array length >= 2
    if (!Array.isArray(guidance.mitigation_guidance)) {
      issues.push('guidance.mitigation_guidance is missing or not an array');
    } else if (guidance.mitigation_guidance.length < 2) {
      issues.push(`guidance.mitigation_guidance too short (${guidance.mitigation_guidance.length} items, minimum 2)`);
    }
  }

  // Validate optional fields (if present)
  if (guidance) {
    // standards_references: if present, each string length >= 6
    if (guidance.standards_references !== undefined) {
      if (!Array.isArray(guidance.standards_references)) {
        issues.push('guidance.standards_references is not an array');
      } else {
        guidance.standards_references.forEach((ref, idx) => {
          if (typeof ref !== 'string') {
            issues.push(`guidance.standards_references[${idx}] is not a string`);
          } else if (ref.trim().length < 6) {
            issues.push(`guidance.standards_references[${idx}] too short (${ref.trim().length} chars, minimum 6)`);
          }
        });
      }
    }

    // psa_notes: if present, length >= 20
    if (guidance.psa_notes !== undefined) {
      if (typeof guidance.psa_notes !== 'string') {
        issues.push('guidance.psa_notes is not a string');
      } else if (guidance.psa_notes.trim().length < 20) {
        issues.push(`guidance.psa_notes too short (${guidance.psa_notes.trim().length} chars, minimum 20)`);
      }
    }
  }

  // Hygiene checks for all array fields
  if (guidance) {
    const arrayFields: Array<{ name: string; value: any }> = [
      { name: 'indicators_of_risk', value: guidance.indicators_of_risk },
      { name: 'common_failures', value: guidance.common_failures },
      { name: 'mitigation_guidance', value: guidance.mitigation_guidance },
      { name: 'standards_references', value: guidance.standards_references },
    ];

    for (const field of arrayFields) {
      if (Array.isArray(field.value) && field.value.length > 0) {
        // Check for empty strings
        const emptyIndices: number[] = [];
        field.value.forEach((item, idx) => {
          if (isEmpty(item)) {
            emptyIndices.push(idx);
          } else if (typeof item === 'string' && item.trim().length < 8) {
            issues.push(`guidance.${field.name}[${idx}] too short (${item.trim().length} chars, minimum 8)`);
          }
        });
        if (emptyIndices.length > 0) {
          issues.push(`guidance.${field.name} contains ${emptyIndices.length} empty string(s) at indices: ${emptyIndices.join(', ')}`);
        }

        // Check for duplicates (case-insensitive)
        const stringItems = field.value.filter((item): item is string => typeof item === 'string' && !isEmpty(item));
        if (stringItems.length > 1 && hasDuplicates(stringItems)) {
          issues.push(`guidance.${field.name} contains duplicate items (case-insensitive)`);
        }
      }
    }
  }

  return issues;
}

/**
 * Generate detailed report with comprehensive subtype information
 */
function generateDetailedReport(
  taxonomyData: TaxonomyData,
  validationReport: ValidationReport
): DetailedReport {
  const detailedSubtypes: DetailedSubtypeInfo[] = [];
  const byDiscipline: Record<string, {
    discipline_code: string;
    discipline_name: string;
    total: number;
    with_guidance: number;
    complete_guidance: number;
    required_effective: number;
    missing_guidance: string[];
  }> = {};

  let guidanceCompleteCount = 0;

  for (const subtype of taxonomyData.subtypes) {
    const guidance = subtype.guidance;
    const hasGuidance = !!guidance;
    const hasOverview = !!(guidance?.overview && typeof guidance.overview === 'string' && guidance.overview.trim().length >= 40);
    const hasIndicators = !!(Array.isArray(guidance?.indicators_of_risk) && guidance.indicators_of_risk.length >= 2);
    const hasFailures = !!(Array.isArray(guidance?.common_failures) && guidance.common_failures.length >= 2);
    const hasMitigation = !!(Array.isArray(guidance?.mitigation_guidance) && guidance.mitigation_guidance.length >= 2);
    const hasStandards = !!(Array.isArray(guidance?.standards_references) && guidance.standards_references.length > 0);
    const hasNotes = !!(guidance?.psa_notes && typeof guidance.psa_notes === 'string' && guidance.psa_notes.trim().length >= 20);

    const guidanceComplete = hasOverview && hasIndicators && hasFailures && hasMitigation;
    if (guidanceComplete) {
      guidanceCompleteCount++;
    }

    const guidanceRequiredEffective = validationReport.mode === 'explicit'
      ? subtype.guidance_required === true
      : validationReport.mode === 'heuristic'
      ? requiresGuidanceHeuristic(subtype)
      : false;

    // Collect guidance issues
    const guidanceIssues: string[] = [];
    if (guidanceRequiredEffective) {
      if (!hasOverview) guidanceIssues.push('Missing or insufficient overview');
      if (!hasIndicators) guidanceIssues.push('Missing or insufficient indicators_of_risk');
      if (!hasFailures) guidanceIssues.push('Missing or insufficient common_failures');
      if (!hasMitigation) guidanceIssues.push('Missing or insufficient mitigation_guidance');
    }

    const detailedInfo: DetailedSubtypeInfo = {
      subtype_code: subtype.subtype_code,
      name: subtype.name,
      discipline_code: subtype.discipline_code,
      discipline_name: subtype.discipline_name,
      is_active: subtype.is_active,
      guidance_required_explicit: subtype.guidance_required === true,
      guidance_required_effective: guidanceRequiredEffective,
      has_guidance: hasGuidance,
      has_overview: hasOverview,
      has_indicators_of_risk: hasIndicators,
      has_common_failures: hasFailures,
      has_mitigation_guidance: hasMitigation,
      has_standards_references: hasStandards,
      has_psa_notes: hasNotes,
      overview_length: guidance?.overview ? guidance.overview.trim().length : 0,
      indicators_of_risk_count: Array.isArray(guidance?.indicators_of_risk) ? guidance.indicators_of_risk.length : 0,
      common_failures_count: Array.isArray(guidance?.common_failures) ? guidance.common_failures.length : 0,
      mitigation_guidance_count: Array.isArray(guidance?.mitigation_guidance) ? guidance.mitigation_guidance.length : 0,
      standards_references_count: Array.isArray(guidance?.standards_references) ? guidance.standards_references.length : 0,
      psa_notes_length: guidance?.psa_notes ? guidance.psa_notes.trim().length : 0,
      guidance_complete: guidanceComplete,
      guidance_issues: guidanceIssues,
    };

    detailedSubtypes.push(detailedInfo);

    // Aggregate by discipline
    if (!byDiscipline[subtype.discipline_code]) {
      byDiscipline[subtype.discipline_code] = {
        discipline_code: subtype.discipline_code,
        discipline_name: subtype.discipline_name,
        total: 0,
        with_guidance: 0,
        complete_guidance: 0,
        required_effective: 0,
        missing_guidance: [],
      };
    }

    const disc = byDiscipline[subtype.discipline_code];
    disc.total++;
    if (hasGuidance) disc.with_guidance++;
    if (guidanceComplete) disc.complete_guidance++;
    if (guidanceRequiredEffective) {
      disc.required_effective++;
      if (!guidanceComplete) {
        disc.missing_guidance.push(subtype.subtype_code);
      }
    }
  }

  // Sort subtypes by discipline_code then subtype_code
  detailedSubtypes.sort((a, b) => {
    const discCompare = a.discipline_code.localeCompare(b.discipline_code);
    if (discCompare !== 0) return discCompare;
    return a.subtype_code.localeCompare(b.subtype_code);
  });

  return {
    metadata: {
      generated_at: new Date().toISOString(),
      mode: validationReport.mode,
      threshold: validationReport.mode === 'threshold' ? THRESHOLD : undefined,
    },
    summary: {
      total_subtypes: taxonomyData.subtypes.length,
      guidance_required_explicit: validationReport.explicit_required_count,
      guidance_required_effective: validationReport.required_effective_count,
      guidance_present: validationReport.guidance_present_count,
      guidance_complete: guidanceCompleteCount,
      guidance_coverage: validationReport.guidance_coverage,
    },
    by_discipline: byDiscipline,
    subtypes: detailedSubtypes,
  };
}

/**
 * Generate CSV report from detailed report
 */
function generateCSVReport(detailedReport: DetailedReport): string {
  const headers = [
    'subtype_code',
    'name',
    'discipline_code',
    'discipline_name',
    'is_active',
    'guidance_required_explicit',
    'guidance_required_effective',
    'has_guidance',
    'has_overview',
    'has_indicators_of_risk',
    'has_common_failures',
    'has_mitigation_guidance',
    'has_standards_references',
    'has_psa_notes',
    'overview_length',
    'indicators_of_risk_count',
    'common_failures_count',
    'mitigation_guidance_count',
    'standards_references_count',
    'psa_notes_length',
    'guidance_complete',
    'guidance_issues',
  ];

  const rows = detailedReport.subtypes.map(subtype => [
    subtype.subtype_code,
    `"${subtype.name.replace(/"/g, '""')}"`,
    subtype.discipline_code,
    `"${subtype.discipline_name.replace(/"/g, '""')}"`,
    subtype.is_active.toString(),
    subtype.guidance_required_explicit.toString(),
    subtype.guidance_required_effective.toString(),
    subtype.has_guidance.toString(),
    subtype.has_overview.toString(),
    subtype.has_indicators_of_risk.toString(),
    subtype.has_common_failures.toString(),
    subtype.has_mitigation_guidance.toString(),
    subtype.has_standards_references.toString(),
    subtype.has_psa_notes.toString(),
    subtype.overview_length.toString(),
    subtype.indicators_of_risk_count.toString(),
    subtype.common_failures_count.toString(),
    subtype.mitigation_guidance_count.toString(),
    subtype.standards_references_count.toString(),
    subtype.psa_notes_length.toString(),
    subtype.guidance_complete.toString(),
    `"${subtype.guidance_issues.join('; ').replace(/"/g, '""')}"`,
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
}

function main() {
  console.log('=== Subtype Guidance Validator ===\n');
  console.log(`Enforcement Mode: ${MODE}`);
  if (MODE === 'threshold') {
    console.log(`Threshold: ${(THRESHOLD * 100).toFixed(1)}%`);
  }
  console.log(`Validation Mode: ${ONLY_REQUIRED ? 'only-required' : VALIDATE_ALL ? 'all' : 'only-required'}`);
  console.log(`Fail on warn: ${FAIL_ON_WARN}\n`);

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

  let taxonomyData: TaxonomyData;
  try {
    taxonomyData = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf-8'));
  } catch (parseError) {
    console.error(`❌ Failed to parse taxonomy file: ${parseError instanceof Error ? parseError.message : parseError}`);
    process.exit(1);
  }

  // Validate taxonomy structure
  if (!taxonomyData.metadata || typeof taxonomyData.metadata.total_subtypes !== 'number') {
    console.error('❌ Taxonomy missing metadata.total_subtypes');
    process.exit(1);
  }

  if (!Array.isArray(taxonomyData.subtypes)) {
    console.error('❌ Taxonomy subtypes is not an array');
    process.exit(1);
  }

  console.log(`✓ Loaded ${taxonomyData.subtypes.length} subtypes from taxonomy\n`);

  // Initialize report
  const report: ValidationReport = {
    ok: true,
    mode: MODE,
    taxonomy_total: taxonomyData.metadata.total_subtypes,
    subtypes_seen: taxonomyData.subtypes.length,
    guidance_required_count: 0,
    guidance_present_count: 0,
    guidance_coverage: 0,
    required_effective_count: 0,
    required_effective_missing: [],
    explicit_required_count: 0,
    explicit_required_missing: [],
    violations_count: 0,
    violations: [],
    duplicate_subtype_codes: [],
  };

  // Check for duplicate subtype_codes
  const subtypeCodeMap = new Map<string, number>();
  for (const subtype of taxonomyData.subtypes) {
    const count = subtypeCodeMap.get(subtype.subtype_code) || 0;
    subtypeCodeMap.set(subtype.subtype_code, count + 1);
  }

  for (const [code, count] of subtypeCodeMap.entries()) {
    if (count > 1) {
      report.duplicate_subtype_codes.push(code);
      report.ok = false;
    }
  }

  // Compute explicit required count
  for (const subtype of taxonomyData.subtypes) {
    if (subtype.guidance_required === true) {
      report.explicit_required_count++;
    }
  }

  // Mode-specific validation
  if (MODE === 'explicit') {
    // Explicit mode: only validate subtypes with guidance_required=true
    if (report.explicit_required_count === 0) {
      report.ok = false;
      report.violations.push({
        subtype_code: '<SYSTEM>',
        name: 'System Check',
        discipline_code: '<SYSTEM>',
        issues: ['No subtypes marked guidance_required=true; explicit mode provides no enforcement.'],
      });
    }
  } else if (MODE === 'threshold') {
    // Threshold mode: check overall coverage
    let subtypesWithValidOverview = 0;
    for (const subtype of taxonomyData.subtypes) {
      if (subtype.guidance?.overview && typeof subtype.guidance.overview === 'string' && subtype.guidance.overview.trim().length >= 40) {
        subtypesWithValidOverview++;
      }
    }
    report.guidance_coverage = subtypesWithValidOverview / report.taxonomy_total;
    
    if (report.guidance_coverage < THRESHOLD) {
      report.ok = false;
      report.violations.push({
        subtype_code: '<SYSTEM>',
        name: 'Coverage Check',
        discipline_code: '<SYSTEM>',
        issues: [`Guidance coverage ${(report.guidance_coverage * 100).toFixed(1)}% is below threshold ${(THRESHOLD * 100).toFixed(1)}%`],
      });
    }
  }

  // Validate each subtype
  for (const subtype of taxonomyData.subtypes) {
    const issues: string[] = [];

    // Join sanity checks
    if (isEmpty(subtype.subtype_code)) {
      issues.push('subtype_code is empty or missing');
    }

    if (isEmpty(subtype.discipline_code)) {
      issues.push('discipline_code is empty or missing');
    }

    // Determine if guidance is required based on mode
    let guidanceRequired = false;
    if (MODE === 'explicit') {
      guidanceRequired = subtype.guidance_required === true;
    } else if (MODE === 'heuristic') {
      guidanceRequired = requiresGuidanceHeuristic(subtype);
    } else if (MODE === 'threshold') {
      // Threshold mode: validate all guidance that exists, but don't require it
      guidanceRequired = false;
    }

    // Track explicit required
    if (subtype.guidance_required === true) {
      report.guidance_required_count++;
    }

    // Track effective required (for heuristic mode)
    if (guidanceRequired) {
      report.required_effective_count++;
      
      // Check if guidance is missing
      if (!subtype.guidance || !subtype.guidance.overview || subtype.guidance.overview.trim().length < 40) {
        report.required_effective_missing.push(subtype.subtype_code);
      }
    }

    // Track explicit required missing
    if (subtype.guidance_required === true) {
      if (!subtype.guidance || !subtype.guidance.overview || subtype.guidance.overview.trim().length < 40) {
        report.explicit_required_missing.push(subtype.subtype_code);
      }
    }

    // Check if guidance exists
    if (subtype.guidance) {
      report.guidance_present_count++;
    }

    // Validate guidance
    // - In explicit/heuristic mode: validate if guidanceRequired=true
    // - In threshold mode: only validate hygiene (not minimum requirements) if guidance exists
    let guidanceIssues: string[] = [];
    if (MODE === 'threshold' && subtype.guidance) {
      // Threshold mode: only run hygiene checks, not minimum requirements
      guidanceIssues = validateGuidance(subtype, false);
    } else {
      // Explicit/heuristic mode: validate minimum requirements if required
      guidanceIssues = validateGuidance(subtype, guidanceRequired);
    }
    issues.push(...guidanceIssues);

    // Add violation if any issues found
    if (issues.length > 0) {
      report.violations.push({
        subtype_code: subtype.subtype_code || '<MISSING>',
        name: subtype.name || '<MISSING>',
        discipline_code: subtype.discipline_code || '<MISSING>',
        issues: issues,
      });
      report.ok = false;
    }
  }

  // Compute guidance coverage for all modes
  let subtypesWithValidOverview = 0;
  for (const subtype of taxonomyData.subtypes) {
    if (subtype.guidance?.overview && typeof subtype.guidance.overview === 'string' && subtype.guidance.overview.trim().length >= 40) {
      subtypesWithValidOverview++;
    }
  }
  report.guidance_coverage = subtypesWithValidOverview / report.taxonomy_total;

  report.violations_count = report.violations.length;

  // Sort violations by discipline_code then subtype_code
  report.violations.sort((a, b) => {
    const discCompare = (a.discipline_code || '').localeCompare(b.discipline_code || '');
    if (discCompare !== 0) return discCompare;
    return (a.subtype_code || '').localeCompare(b.subtype_code || '');
  });

  // Write JSON report
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`✓ Report JSON written: ${REPORT_JSON}`);

  // Generate detailed report
  const detailedReport = generateDetailedReport(taxonomyData, report);
  fs.writeFileSync(REPORT_DETAILED_JSON, JSON.stringify(detailedReport, null, 2), 'utf-8');
  console.log(`✓ Detailed JSON report written: ${REPORT_DETAILED_JSON}`);

  // Generate CSV report
  const csvReport = generateCSVReport(detailedReport);
  fs.writeFileSync(REPORT_DETAILED_CSV, csvReport, 'utf-8');
  console.log(`✓ Detailed CSV report written: ${REPORT_DETAILED_CSV}`);

  // Generate markdown report
  const mdLines: string[] = [
    '# Subtype Guidance Validation Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Enforcement Mode:** ${report.mode}`,
    `**Validation Mode:** ${ONLY_REQUIRED ? 'only-required' : VALIDATE_ALL ? 'all' : 'only-required'}`,
    '',
    '## Summary',
    '',
    `- **Status:** ${report.ok ? '✅ PASS' : '❌ FAIL'}`,
    `- **Taxonomy Total:** ${report.taxonomy_total}`,
    `- **Subtypes Seen:** ${report.subtypes_seen}`,
    `- **Guidance Coverage:** ${(report.guidance_coverage * 100).toFixed(1)}%`,
    `- **Explicit Required:** ${report.explicit_required_count}`,
    `- **Effective Required (${report.mode}):** ${report.required_effective_count}`,
    `- **Guidance Present:** ${report.guidance_present_count}`,
    `- **Violations:** ${report.violations_count}`,
    `- **Duplicate Subtype Codes:** ${report.duplicate_subtype_codes.length}`,
    '',
  ];

  if (report.mode === 'threshold') {
    mdLines.push(`- **Threshold:** ${(THRESHOLD * 100).toFixed(1)}%`);
    mdLines.push('');
  }

  if (report.explicit_required_missing.length > 0) {
    mdLines.push('## Explicit Required Missing Guidance', '');
    mdLines.push(`The following ${report.explicit_required_missing.length} subtypes are marked \`guidance_required=true\` but lack valid guidance:`);
    mdLines.push('');
    for (const code of report.explicit_required_missing.slice(0, 20)) {
      mdLines.push(`- \`${code}\``);
    }
    if (report.explicit_required_missing.length > 20) {
      mdLines.push(`- ... and ${report.explicit_required_missing.length - 20} more`);
    }
    mdLines.push('');
  }

  if (report.required_effective_missing.length > 0 && report.mode === 'heuristic') {
    mdLines.push('## Effective Required Missing Guidance', '');
    mdLines.push(`The following ${report.required_effective_missing.length} subtypes match heuristic keywords but lack valid guidance:`);
    mdLines.push('');
    for (const code of report.required_effective_missing.slice(0, 20)) {
      mdLines.push(`- \`${code}\``);
    }
    if (report.required_effective_missing.length > 20) {
      mdLines.push(`- ... and ${report.required_effective_missing.length - 20} more`);
    }
    mdLines.push('');
  }

  if (report.duplicate_subtype_codes.length > 0) {
    mdLines.push('## Duplicate Subtype Codes', '');
    mdLines.push('⚠️ **Error:** The following subtype codes appear multiple times:');
    mdLines.push('');
    for (const code of report.duplicate_subtype_codes) {
      mdLines.push(`- \`${code}\``);
    }
    mdLines.push('');
  }

  if (report.violations.length > 0) {
    mdLines.push('## Violations', '');
    mdLines.push('');
    mdLines.push('| Subtype Code | Discipline Code | Name | Issues |');
    mdLines.push('|--------------|----------------|------|--------|');
    for (const violation of report.violations) {
      const issuesText = violation.issues.length > 0
        ? violation.issues.map(issue => `- ${issue}`).join('<br>')
        : 'No issues';
      mdLines.push(`| \`${violation.subtype_code}\` | \`${violation.discipline_code}\` | ${violation.name} | ${issuesText} |`);
    }
    mdLines.push('');
  } else {
    mdLines.push('## Violations', '');
    mdLines.push('');
    mdLines.push('✅ No violations found.');
    mdLines.push('');
  }

  fs.writeFileSync(REPORT_MD, mdLines.join('\n'), 'utf-8');
  console.log(`✓ Report Markdown written: ${REPORT_MD}\n`);

  // Print summary
  console.log('=== Validation Summary ===');
  console.log(`Status: ${report.ok ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Enforcement Mode: ${report.mode}`);
  console.log(`Taxonomy Total: ${report.taxonomy_total}`);
  console.log(`Subtypes Seen: ${report.subtypes_seen}`);
  console.log(`Guidance Coverage: ${(report.guidance_coverage * 100).toFixed(1)}%`);
  console.log(`Explicit Required: ${report.explicit_required_count}`);
  console.log(`Effective Required (${report.mode}): ${report.required_effective_count}`);
  console.log(`Guidance Present: ${report.guidance_present_count}`);
  console.log(`Violations: ${report.violations_count}`);
  console.log(`Duplicate Subtype Codes: ${report.duplicate_subtype_codes.length}`);
  
  if (report.mode === 'threshold') {
    console.log(`Threshold: ${(THRESHOLD * 100).toFixed(1)}%`);
  }
  
  if (report.explicit_required_missing.length > 0) {
    console.log(`\n⚠️  ${report.explicit_required_missing.length} explicit required subtype(s) missing guidance`);
  }
  
  if (report.required_effective_missing.length > 0 && report.mode === 'heuristic') {
    console.log(`\n⚠️  ${report.required_effective_missing.length} effective required subtype(s) missing guidance`);
  }

  if (report.violations_count > 0) {
    console.log(`\n⚠️  Found ${report.violations_count} violation(s). See ${REPORT_MD} for details.`);
  }

  if (report.duplicate_subtype_codes.length > 0) {
    console.log(`\n⚠️  Found ${report.duplicate_subtype_codes.length} duplicate subtype code(s).`);
  }

  // Exit with appropriate code
  if (report.ok) {
    console.log('\n✅ Validation passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Validation failed!');
    process.exit(1);
  }
}

main();
