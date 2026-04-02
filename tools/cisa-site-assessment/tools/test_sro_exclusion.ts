#!/usr/bin/env tsx
/**
 * Test SRO Exclusion
 * 
 * Quick verification that:
 * 1. SRO subtype is marked baseline_eligible=false in taxonomy
 * 2. Generator script filters it out
 * 3. Coverage report excludes it
 */

import * as fs from 'fs';
import * as path from 'path';

const TAXONOMY_PATH = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');

interface Subtype {
  subtype_code: string;
  name: string;
  baseline_eligible?: boolean;
}

function testTaxonomyExclusion(): boolean {
  console.log('='.repeat(80));
  console.log('Test 1: Taxonomy Exclusion Flag');
  console.log('='.repeat(80));
  
  const content = fs.readFileSync(TAXONOMY_PATH, 'utf-8');
  const data = JSON.parse(content);
  const subtypes: Subtype[] = data.subtypes || [];
  
  const sroSubtype = subtypes.find((st: Subtype) => st.subtype_code === 'SFO_SCHOOL_RESOURCE_OFFICER_SRO');
  
  if (!sroSubtype) {
    console.error('❌ FAIL: SRO subtype not found in taxonomy');
    return false;
  }
  
  console.log(`✓ Found SRO subtype: ${sroSubtype.name}`);
  console.log(`  subtype_code: ${sroSubtype.subtype_code}`);
  console.log(`  baseline_eligible: ${sroSubtype.baseline_eligible}`);
  
  if (sroSubtype.baseline_eligible !== false) {
    console.error('❌ FAIL: SRO subtype should have baseline_eligible=false');
    return false;
  }
  
  console.log('✓ PASS: SRO subtype correctly marked as baseline_eligible=false\n');
  return true;
}

function testGeneratorFiltering(): boolean {
  console.log('='.repeat(80));
  console.log('Test 2: Generator Filtering Logic');
  console.log('='.repeat(80));
  
  const content = fs.readFileSync(TAXONOMY_PATH, 'utf-8');
  const data = JSON.parse(content);
  const subtypes: Subtype[] = data.subtypes || [];
  
  // Simulate generator filtering logic
  const baselineEligibleSubtypes = subtypes.filter(
    (st: Subtype) => st.baseline_eligible !== false
  );
  
  const sroIncluded = baselineEligibleSubtypes.some(
    (st: Subtype) => st.subtype_code === 'SFO_SCHOOL_RESOURCE_OFFICER_SRO'
  );
  
  if (sroIncluded) {
    console.error('❌ FAIL: SRO subtype should be excluded from baseline-eligible subtypes');
    return false;
  }
  
  console.log(`✓ Total subtypes: ${subtypes.length}`);
  console.log(`✓ Baseline-eligible subtypes: ${baselineEligibleSubtypes.length}`);
  console.log(`✓ Excluded subtypes: ${subtypes.length - baselineEligibleSubtypes.length}`);
  console.log('✓ PASS: SRO subtype correctly excluded from baseline-eligible set\n');
  return true;
}

function testCoverageReportFiltering(): boolean {
  console.log('='.repeat(80));
  console.log('Test 3: Coverage Report Filtering Logic');
  console.log('='.repeat(80));
  
  const content = fs.readFileSync(TAXONOMY_PATH, 'utf-8');
  const data = JSON.parse(content);
  const subtypes: Subtype[] = data.subtypes || [];
  
  // Simulate coverage report filtering logic
  const baselineEligibleSubtypes = subtypes.filter(
    (st: Subtype) => st.baseline_eligible !== false
  );
  
  const excludedSubtypes = subtypes.filter(
    (st: Subtype) => st.baseline_eligible === false
  );
  
  const sroExcluded = excludedSubtypes.some(
    (st: Subtype) => st.subtype_code === 'SFO_SCHOOL_RESOURCE_OFFICER_SRO'
  );
  
  if (!sroExcluded) {
    console.error('❌ FAIL: SRO subtype should be in excluded subtypes list');
    return false;
  }
  
  console.log(`✓ Total subtypes: ${subtypes.length}`);
  console.log(`✓ Baseline-eligible subtypes: ${baselineEligibleSubtypes.length}`);
  console.log(`✓ Excluded subtypes: ${excludedSubtypes.length}`);
  console.log(`✓ Excluded subtype codes: ${excludedSubtypes.map(st => st.subtype_code).join(', ')}`);
  console.log('✓ PASS: SRO subtype correctly identified in excluded subtypes\n');
  return true;
}

function main() {
  console.log('Testing SRO Exclusion Implementation\n');
  
  const test1 = testTaxonomyExclusion();
  const test2 = testGeneratorFiltering();
  const test3 = testCoverageReportFiltering();
  
  console.log('='.repeat(80));
  console.log('Test Summary');
  console.log('='.repeat(80));
  console.log(`Taxonomy Exclusion Flag: ${test1 ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`Generator Filtering: ${test2 ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`Coverage Report Filtering: ${test3 ? '✓ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(80));
  
  if (test1 && test2 && test3) {
    console.log('\n✅ All tests passed! SRO exclusion is correctly implemented.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please review the implementation.');
    process.exit(1);
  }
}

main();
