#!/usr/bin/env tsx
/**
 * Test runner for standard scope filter and output validator.
 * Prints PASS/FAIL; exits non-zero on failure.
 *
 * Usage: npx tsx tools/test_standard_scope_validator.ts
 */

import {
  containsDeepNetworkCyber,
  containsConvergenceOnly,
  containsForbiddenPlanElementPrefix,
} from "../app/lib/scope/psa_scope_filter";
import { validateStandardCriteriaOrThrow } from "../app/lib/modules/standard/validators/standard_output_validator";

const BAD_EXAMPLES = [
  "Is the purpose of the WAN interface for enforcing access control?",
  "Is network segregation used to limit impacts?",
  "Does the facility use digital signatures to verify firmware updates?",
  "Is the role of the firewall to segment the VLAN?",
  "What TLS certificates are used for the API endpoint?",
  "Plan element exists: The CPO central system shall enforce zero trust.",
];

const GOOD_CONVERGENCE_EXAMPLES = [
  "Are roles and responsibilities defined between physical security and IT for incident coordination affecting EV charging areas?",
  "Is there a documented escalation path between physical security and IT for issues that could affect charging station operations?",
  "Does the facility have a defined interface between physical security and IT for change management?",
];

function main(): number {
  let failed = 0;

  console.log("--- Scope filter: deep network cyber (must be true) ---");
  for (const text of BAD_EXAMPLES) {
    const got = containsDeepNetworkCyber(text);
    if (!got) {
      console.log(`  FAIL: expected true: "${text.slice(0, 60)}..."`);
      failed++;
    } else {
      console.log(`  PASS: "${text.slice(0, 50)}..."`);
    }
  }

  console.log("\n--- Scope filter: convergence-only (allowed; detector should not reject) ---");
  for (const text of GOOD_CONVERGENCE_EXAMPLES) {
    const deep = containsDeepNetworkCyber(text);
    const conv = containsConvergenceOnly(text);
    if (deep) {
      console.log(`  FAIL: convergence example flagged as deep cyber: "${text.slice(0, 50)}..."`);
      failed++;
    } else {
      console.log(`  PASS: "${text.slice(0, 50)}..." (convergence=${conv})`);
    }
  }

  console.log("\n--- Forbidden prefix: Plan element exists ---");
  const prefixOk = containsForbiddenPlanElementPrefix("Plan element exists: Something");
  const prefixNo = !containsForbiddenPlanElementPrefix("Does the facility have a plan?");
  if (!prefixOk || !prefixNo) {
    console.log(`  FAIL: prefixOk=${prefixOk} prefixNo=${prefixNo}`);
    failed++;
  } else {
    console.log("  PASS");
  }

  console.log("\n--- Output validator: bad examples must be rejected ---");
  for (const text of BAD_EXAMPLES) {
    try {
      validateStandardCriteriaOrThrow([text]);
      console.log(`  FAIL: should have rejected: "${text.slice(0, 50)}..."`);
      failed++;
    } catch {
      console.log(`  PASS: rejected "${text.slice(0, 40)}..."`);
    }
  }

  console.log("\n--- Output validator: convergence examples must pass ---");
  try {
    validateStandardCriteriaOrThrow(GOOD_CONVERGENCE_EXAMPLES);
    console.log("  PASS: all 3 convergence examples accepted");
  } catch (e) {
    console.log("  FAIL:", (e as Error).message);
    failed++;
  }

  if (failed > 0) {
    console.log(`\n*** ${failed} test(s) failed ***`);
    return 1;
  }
  console.log("\n*** All tests passed ***");
  return 0;
}

process.exit(main());
