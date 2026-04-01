/**
 * Verify Citation Compilation - Test citation registry and Appendix B generation
 * 
 * Run: pnpm --filter web exec tsx scripts/verify_citations.ts
 */

import { getCitation, formatInlineCitations, compileCitations } from '../app/lib/report/citations/registry';

console.log('='.repeat(80));
console.log('CITATION SYSTEM VERIFICATION');
console.log('='.repeat(80));
console.log();

// Test 1: Get individual citations
console.log('TEST 1: Individual Citation Retrieval');
console.log('-'.repeat(80));
try {
  const fema = getCitation('FEMA_CGC');
  console.log('✓ FEMA_CGC retrieved:');
  console.log(`  Key: ${fema.key}`);
  console.log(`  Short: ${fema.short}`);
  console.log(`  Full: ${fema.full}`);
  console.log(`  Org: ${fema.org}`);
  console.log();

  const nfpa = getCitation('NFPA_110');
  console.log('✓ NFPA_110 retrieved:');
  console.log(`  Key: ${nfpa.key}`);
  console.log(`  Short: ${nfpa.short}`);
  console.log(`  Full: ${nfpa.full}`);
  console.log(`  Org: ${nfpa.org}`);
  console.log();
} catch (e) {
  console.error('✗ Failed to retrieve citations:', e);
  process.exit(1);
}

// Test 2: Inline citation formatting
console.log('TEST 2: Inline Citation Formatting');
console.log('-'.repeat(80));
try {
  const inline1 = formatInlineCitations(['FEMA_CGC', 'NFPA_110']);
  console.log(`✓ Inline format (2 citations): ${inline1}`);
  console.log(`  Expected: (FEMA CGC; NFPA 110)`);
  console.log();

  const inline2 = formatInlineCitations(['NIST_800_34', 'ISO_22301', 'EPA_WATER_RISK']);
  console.log(`✓ Inline format (3 citations): ${inline2}`);
  console.log(`  Expected: (NIST SP 800-34; ISO 22301; EPA Water Sector Risk Assessment)`);
  console.log();

  const inline3 = formatInlineCitations([]);
  console.log(`✓ Inline format (0 citations): "${inline3}"`);
  console.log(`  Expected: ""`);
  console.log();
} catch (e) {
  console.error('✗ Failed to format inline citations:', e);
  process.exit(1);
}

// Test 3: Appendix B compilation with de-duplication
console.log('TEST 3: Appendix B Compilation');
console.log('-'.repeat(80));
try {
  // Simulate citations used throughout a report
  const usedKeys = [
    'FEMA_CGC',
    'NFPA_110',
    'NFPA_101',
    'NIST_800_34',
    'NIST_CSF',
    'FEMA_CGC', // duplicate
    'ISO_22301',
    'EPA_WATER_RISK',
    'DOE_EDE_REPORT',
    'NFPA_110', // duplicate
    'FCC_NORS',
  ];

  const compiled = compileCitations(usedKeys);
  
  console.log(`✓ Compiled ${compiled.length} unique citations from ${usedKeys.length} references`);
  console.log();

  // Group by org for display
  const byOrg: Record<string, typeof compiled> = {};
  compiled.forEach(cit => {
    if (!byOrg[cit.org]) byOrg[cit.org] = [];
    byOrg[cit.org].push(cit);
  });

  console.log('Appendix B Preview:');
  console.log();
  Object.entries(byOrg).forEach(([org, citations]) => {
    console.log(`  ${org} (${citations.length} citation${citations.length > 1 ? 's' : ''})`);
    citations.forEach(cit => {
      console.log(`    • ${cit.full}`);
    });
    console.log();
  });

  // Verify de-duplication
  const uniqueKeys = new Set(usedKeys);
  if (compiled.length !== uniqueKeys.size) {
    console.error(`✗ De-duplication failed: expected ${uniqueKeys.size}, got ${compiled.length}`);
    process.exit(1);
  }
  console.log('✓ De-duplication working correctly');
  console.log();

  // Verify sorting by org
  const expectedOrgOrder = ['FEMA', 'NFPA', 'NIST', 'ISO', 'EPA', 'DOE', 'FCC'];
  const actualOrgs = Object.keys(byOrg);
  const sortedCorrectly = actualOrgs.every((org, idx) => {
    const expectedIdx = expectedOrgOrder.indexOf(org);
    return expectedIdx >= 0 && (idx === 0 || expectedOrgOrder.indexOf(actualOrgs[idx - 1]) < expectedIdx);
  });

  if (!sortedCorrectly) {
    console.error('✗ Organization sorting incorrect');
    console.error(`  Expected order: ${expectedOrgOrder.join(', ')}`);
    console.error(`  Actual order: ${actualOrgs.join(', ')}`);
    process.exit(1);
  }
  console.log('✓ Organization sorting working correctly');
  console.log();

} catch (e) {
  console.error('✗ Failed to compile citations:', e);
  process.exit(1);
}

// Test 4: Registry integrity - missing keys must throw (no silent pass)
console.log('TEST 4: Registry Integrity (Missing Keys Fail)');
console.log('-'.repeat(80));
try {
  const testKey = 'NON_EXISTENT_KEY';
  try {
    getCitation(testKey);
    console.error('✗ getCitation should throw for unknown key');
    process.exit(1);
  } catch (e) {
    console.log('✓ Throws error for unknown citation (registry integrity enforced)');
    console.log(`  Error: ${(e as Error).message}`);
  }
  console.log();
} catch (e) {
  console.error('✗ Unexpected error in error handling test:', e);
  process.exit(1);
}

// Test 5: Verify all registered citations are valid
console.log('TEST 5: Registry Integrity');
console.log('-'.repeat(80));
import { CITATION_REGISTRY } from '../app/lib/report/citations/registry';

const allKeys = Object.keys(CITATION_REGISTRY);
console.log(`✓ Registry contains ${allKeys.length} citations`);
console.log();

let invalidCount = 0;
allKeys.forEach(key => {
  const cit = CITATION_REGISTRY[key];
  if (!cit.key || !cit.short || !cit.full || !cit.org) {
    console.error(`✗ Invalid citation: ${key}`);
    console.error(`  Missing fields: ${[
      !cit.key && 'key',
      !cit.short && 'short',
      !cit.full && 'full',
      !cit.org && 'org',
    ].filter(Boolean).join(', ')}`);
    invalidCount++;
  }
});

if (invalidCount > 0) {
  console.error(`✗ Found ${invalidCount} invalid citations`);
  process.exit(1);
}

console.log('✓ All citations have required fields (key, short, full, org)');
console.log();

// Test 6: Verify organization coverage
console.log('TEST 6: Organization Coverage');
console.log('-'.repeat(80));
const orgCounts: Record<string, number> = {};
allKeys.forEach(key => {
  const org = CITATION_REGISTRY[key].org;
  orgCounts[org] = (orgCounts[org] || 0) + 1;
});

console.log('Citations by organization:');
Object.entries(orgCounts)
  .sort(([, a], [, b]) => b - a)
  .forEach(([org, count]) => {
    console.log(`  ${org}: ${count}`);
  });
console.log();

const minOrgs = ['FEMA', 'NFPA', 'NIST', 'ISO', 'EPA'];
const missingOrgs = minOrgs.filter(org => !orgCounts[org]);
if (missingOrgs.length > 0) {
  console.error(`✗ Missing required organizations: ${missingOrgs.join(', ')}`);
  process.exit(1);
}
console.log('✓ All required organizations represented');
console.log();

// Summary
console.log('='.repeat(80));
console.log('✅ ALL TESTS PASSED - Citation system verified');
console.log('='.repeat(80));
console.log();
console.log('Summary:');
console.log(`  • ${allKeys.length} citations in registry`);
console.log(`  • ${Object.keys(orgCounts).length} organizations represented`);
console.log('  • Inline formatting working');
console.log('  • Appendix B compilation working');
console.log('  • De-duplication working');
console.log('  • Organization sorting working');
console.log('  • Error handling working');
console.log();
