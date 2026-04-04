/**
 * Vulnerability Catalog & Key Risk Driver Integrity Verification Script
 * 
 * Validates:
 * 1. All vulnerabilities declare driverCategory
 * 2. Key risk drivers respect count limits (3-6 max, >= 1 if vulns triggered)
 * 3. No duplicate driverCategory in extracted drivers
 * 4. No forbidden prescriptive verbs in driver narratives
 * 5. Deterministic output (snapshot test)
 * 6. Trigger density thresholds (noise gates)
 * 
 * Run: pnpm --filter web exec tsx scripts/verify_vuln_integrity.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractKeyRiskDrivers,
  evaluateVulnerabilities,
  evaluateCrossDependencyVulnerabilities,
  type KeyRiskDriverVM,
  computeTriggerDensitySummary,
  formatTriggerDensitySummary,
  type TriggeredVulnerability,
  type InfraId,
} from '../app/lib/report/vulnerability';
import type { CurveSummary } from '../app/lib/report/view_model';
import type { Assessment, CategoryCode } from 'schema';
import { validateCatalog, validateQuestionVulnMap } from '../app/lib/vuln';
import { isPraSlaEnabled } from '../lib/pra-sla-enabled';
import { isCrossDependencyEnabled } from '../lib/cross-dependency-enabled';

// Forbidden prescriptive verbs
const FORBIDDEN_VERBS = [
  'should',
  'must',
  'recommend',
  'install',
  'upgrade',
  'implement',
  'deploy',
  'configure',
  'establish',
  'ensure',
];

/**
 * Test case: empty vulnerabilities should return empty drivers.
 */
function testEmptyCase() {
  const drivers = extractKeyRiskDrivers([], []);
  
  if (drivers.length !== 0) {
    throw new Error(`FAIL: Empty case should return 0 drivers, got ${drivers.length}`);
  }
  
  console.log('✓ Empty case: returns 0 drivers');
}

/**
 * Test case: drivers respect max count of 3.
 */
function testMaxDriverCount() {
  console.log('✓ Max driver count: 3 (enforced in fixture tests)');
}

/**
 * Test case: no duplicate driver categories.
 */
function testNoDuplicateCategories(drivers: KeyRiskDriverVM[]) {
  const categories = drivers.map((d) => d._category).filter((c) => c !== undefined);
  const uniqueCategories = new Set(categories);
  
  if (categories.length !== uniqueCategories.size) {
    const duplicates = categories.filter((c, i) => categories.indexOf(c) !== i);
    throw new Error(`FAIL: Duplicate driver categories found: ${duplicates.join(', ')}`);
  }
  
  console.log(`✓ No duplicate categories: ${categories.length} unique`);
}

/**
 * Test case: no duplicate normalized labels in final drivers.
 * Enforces max 3 and throws with listing if duplicates detected.
 */
function testNoDuplicateDriverLabels(drivers: KeyRiskDriverVM[]) {
  if (drivers.length > 3) {
    throw new Error(`FAIL: Driver count ${drivers.length} exceeds max 3. Drivers: ${drivers.map((d) => d.title).join('; ')}`);
  }
  const normalizeLabel = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim().replace(/\s+/g, ' ');
  const labels = drivers.map((d) => d.title);
  const normalized = labels.map(normalizeLabel);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const n of normalized) {
    if (seen.has(n)) duplicates.push(n);
    else seen.add(n);
  }
  if (duplicates.length > 0) {
    throw new Error(`FAIL: Duplicate driver labels (normalized): ${[...new Set(duplicates)].join(', ')}. Full list: ${labels.join(' | ')}`);
  }
  console.log(`✓ No duplicate labels: ${drivers.length} unique drivers (max 3)`);
}

/**
 * Test case: no forbidden verbs in driver narratives.
 */
function testNoForbiddenVerbs(drivers: KeyRiskDriverVM[]) {
  for (const driver of drivers) {
    const narrative = driver.narrative.toLowerCase();
    
    for (const verb of FORBIDDEN_VERBS) {
      if (narrative.includes(verb)) {
        throw new Error(
          `FAIL: Forbidden verb "${verb}" found in driver narrative: ${driver.title}`
        );
      }
    }
  }
  
  console.log(`✓ No forbidden verbs: checked ${drivers.length} drivers`);
}

/**
 * Test case: deterministic output (same inputs produce same outputs).
 */
function testDeterminism(
  vulns: Parameters<typeof extractKeyRiskDrivers>[0],
  curves: CurveSummary[]
) {
  const run1 = extractKeyRiskDrivers(vulns, curves);
  const run2 = extractKeyRiskDrivers(vulns, curves);
  
  if (JSON.stringify(run1) !== JSON.stringify(run2)) {
    throw new Error('FAIL: Non-deterministic output detected');
  }
  
  console.log('✓ Determinism: identical inputs produce identical outputs');
}

/**
 * Test case: driver count constraints.
 */
function testDriverCountConstraints(drivers: KeyRiskDriverVM[], vulnCount: number) {
  if (drivers.length > 3) {
    throw new Error(`FAIL: Driver count ${drivers.length} exceeds maximum of 3`);
  }
  
  if (vulnCount > 0 && drivers.length === 0) {
    throw new Error('FAIL: No drivers extracted when vulnerabilities exist');
  }
  
  console.log(`✓ Driver count constraints: ${drivers.length} drivers (${vulnCount} vulns)`);
}

/**
 * Test case: scoring cap enforcement.
 */
function testScoringCap(drivers: KeyRiskDriverVM[]) {
  for (const driver of drivers) {
    if (driver._score && driver._score > 7) {
      throw new Error(`FAIL: Driver score ${driver._score} exceeds cap of 7`);
    }
  }
  
  console.log(`✓ Scoring cap: all scores <= 7`);
}

/**
 * Test case: trigger density thresholds.
 */
function testTriggerDensity(
  vulns: TriggeredVulnerability[],
  drivers: KeyRiskDriverVM[]
) {
  const summary = computeTriggerDensitySummary({
    triggeredVulns: vulns,
    keyRiskDrivers: drivers,
  });

  console.log('');
  console.log(formatTriggerDensitySummary(summary));
  console.log('');

  // Fail if any fails detected
  if (summary.fails.length > 0) {
    throw new Error(`FAIL: Trigger density thresholds exceeded. See FAILS above.`);
  }

  console.log(`✓ Trigger density: ${summary.warnings.length} warnings, ${summary.fails.length} fails`);
}

/**
 * Load JSON fixture assessment.
 */
function loadFixture(fileName: string): Assessment {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fixturePath = path.join(__dirname, 'fixtures', 'assessments', fileName);
  const raw = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(raw) as Assessment;
}

/**
 * Build curve summaries from assessment answers.
 * Uses infra ID in the summary to align with driver scoring.
 */
function buildCurveSummaries(assessment: Assessment): CurveSummary[] {
  const summaries: CurveSummary[] = [];

  for (const [infraId, data] of Object.entries(assessment.dependencies ?? {})) {
    const answers = data as Record<string, unknown>;
    summaries.push({
      infra: infraId,
      severity: 'DELAYED',
      time_to_impact_hr: (answers.curve_time_to_impact_hours as number) ?? 24,
      loss_no_backup_pct: ((answers.curve_loss_fraction_no_backup as number) ?? 0) * 100,
      backup_available: (answers.curve_backup_available as boolean) ?? false,
      backup_duration_hr: answers.curve_backup_duration_hours as number,
      loss_with_backup_pct: ((answers.curve_loss_fraction_with_backup as number) ?? 0) * 100,
      recovery_hr: (answers.curve_recovery_time_hours as number) ?? 48,
    });
  }

  return summaries;
}

/**
 * Evaluate vulnerabilities for an assessment.
 */
function evaluateAssessment(assessment: Assessment) {
  const infraMap: Record<string, InfraId> = {
    ELECTRIC_POWER: 'ELECTRIC_POWER',
    COMMUNICATIONS: 'COMMUNICATIONS',
    INFORMATION_TECHNOLOGY: 'INFORMATION_TECHNOLOGY',
    WATER: 'WATER',
    WASTEWATER: 'WASTEWATER',
  };

  const triggeredByInfra: Array<{ infra: InfraId; vulnerabilities: TriggeredVulnerability[] }> = [];

  const categorySource = assessment.categories ?? (assessment as { dependencies?: Record<string, unknown> }).dependencies ?? {};
  for (const [code, infraId] of Object.entries(infraMap)) {
    const data = categorySource[code as CategoryCode];
    if (!data) continue;

    const evalResult = evaluateVulnerabilities({
      infraId,
      answers: { ...(data as Record<string, unknown>) },
      featureFlags: { praEnabled: isPraSlaEnabled(assessment), crossDependencyEnabled: isCrossDependencyEnabled(assessment) },
    });

    triggeredByInfra.push({
      infra: infraId,
      vulnerabilities: evalResult.triggered_vulnerabilities,
    });
  }

  // Cross-dependency evaluation
  const mergedAnswers: Record<string, unknown> = {};
  for (const data of Object.values(assessment.dependencies ?? {})) {
    Object.assign(mergedAnswers, data);
  }

  const crossDepEval = evaluateCrossDependencyVulnerabilities({
    infraId: 'CROSS_DEPENDENCY',
    answers: mergedAnswers,
    featureFlags: { praEnabled: isPraSlaEnabled(assessment), crossDependencyEnabled: isCrossDependencyEnabled(assessment) },
  });

  triggeredByInfra.push({
    infra: 'CROSS_DEPENDENCY',
    vulnerabilities: crossDepEval.triggered_vulnerabilities,
  });

  const allTriggered = triggeredByInfra.flatMap((tv) => tv.vulnerabilities);
  const curves = buildCurveSummaries(assessment);
  const drivers = extractKeyRiskDrivers(triggeredByInfra, curves);

  return { allTriggered, triggeredByInfra, drivers, curves };
}

/**
 * Main verification runner.
 */
function main() {
  console.log('=== Vulnerability Catalog & Key Risk Driver Integrity Verification ===\n');
  
  try {
    // Catalog validation
    const validation = validateCatalog();
    if (validation.warnings.length > 0) {
      console.log('Catalog warnings:');
      validation.warnings.forEach((w) => console.log(`  - ${w}`));
      console.log('');
    }
    if (!validation.ok) {
      validation.errors.forEach((e) => console.error(`ERROR: ${e}`));
      throw new Error('FAIL: Catalog validation failed');
    }

    // Question vuln map validation (citations, OFC forbidden verbs)
    const qvResult = validateQuestionVulnMap();
    if (!qvResult.ok) {
      qvResult.errors.forEach((e) => console.error(`ERROR: ${e}`));
      throw new Error('FAIL: Question vuln map validation failed');
    }

    // Test 1: Empty case
    testEmptyCase();
    
    // Test 2: Max driver count
    testMaxDriverCount();
    
    // Test 3: Determinism (with empty input)
    testDeterminism([], []);
    
    // Load fixtures and test with real vulnerabilities
    const fixtures = [
      { name: 'low_signal.json', expectFails: false },
      { name: 'typical_signal.json', expectFails: false },
      { name: 'high_noise.json', expectFails: true },
    ];

    for (const fixture of fixtures) {
      console.log(`\n--- Fixture: ${fixture.name} ---`);
      const assessment = loadFixture(fixture.name);
      const { allTriggered, drivers } = evaluateAssessment(assessment);

      testNoDuplicateCategories(drivers);
      testNoDuplicateDriverLabels(drivers);
      testNoForbiddenVerbs(drivers);
      testDriverCountConstraints(drivers, allTriggered.length);
      testScoringCap(drivers);

      const summary = computeTriggerDensitySummary({
        triggeredVulns: allTriggered,
        keyRiskDrivers: drivers,
      });

      console.log('');
      console.log(formatTriggerDensitySummary(summary));
      console.log('');

      if (fixture.expectFails) {
        if (summary.fails.length === 0) {
          throw new Error('FAIL: High-noise fixture did not trigger density fails');
        }
        console.log('✓ High-noise fixture triggered expected fails');
      } else {
        if (summary.fails.length > 0) {
          throw new Error(`FAIL: Density fails for ${fixture.name}`);
        }
        console.log(`✓ Trigger density within thresholds for ${fixture.name}`);
      }
    }
    
    console.log('\n=== All Checks Passed ===');
    console.log('All catalog and density checks passed.');
    
  } catch (error) {
    console.error(`\n${error}`);
    process.exit(1);
  }
}

main();

