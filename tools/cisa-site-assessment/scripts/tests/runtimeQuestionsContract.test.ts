#!/usr/bin/env node
/**
 * Runtime Questions Contract regression tests.
 * Run: npx tsx scripts/tests/runtimeQuestionsContract.test.ts
 * Exit 1 on any failure.
 */

import { assertRuntimeQuestionList } from "../../app/lib/contracts/runtimeQuestion";

let failed = 0;

function ok(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  OK: ${name}`);
  } catch (e) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

function mustFail(name: string, fn: () => void) {
  try {
    fn();
    console.error(`  FAIL: ${name} (expected to throw)`);
    failed++;
  } catch {
    console.log(`  OK: ${name} (correctly threw)`);
  }
}

const minimal = {
  canon_id: "BASE-X-Y",
  question_text: "Question?",
  response_enum: ["YES", "NO", "N_A"] as const,
  discipline_subtype_id: "927444d9-3cc2-4b89-8c7d-c9a1744b731b",
};

const withNullSubtype = {
  canon_id: "BASE-A-B",
  question_text: "Other?",
  response_enum: ["YES", "NO", "N_A"] as const,
  discipline_subtype_id: null as string | null,
};

console.log("runtimeQuestionsContract tests\n");

ok("PASS: minimal object with discipline_subtype_id", () => {
  assertRuntimeQuestionList([minimal]);
});

ok("PASS: discipline_subtype_id null, no help fields", () => {
  assertRuntimeQuestionList([withNullSubtype]);
});

ok("PASS: { questions: [] } shape", () => {
  assertRuntimeQuestionList({ questions: [] });
});

mustFail("FAIL: intent_object", () => {
  assertRuntimeQuestionList([{ ...minimal, intent_object: null }]);
});

mustFail("FAIL: what_counts_as_yes", () => {
  assertRuntimeQuestionList([{ ...minimal, what_counts_as_yes: [] }]);
});

mustFail("FAIL: extra unknown key evidence_tips", () => {
  assertRuntimeQuestionList([{ ...minimal, evidence_tips: "x" }]);
});

mustFail("FAIL: forbidden field_tip", () => {
  assertRuntimeQuestionList([{ ...minimal, field_tip: "y" }]);
});

mustFail("FAIL: extra key foo", () => {
  assertRuntimeQuestionList([{ ...minimal, foo: 1 }]);
});

mustFail("FAIL: missing canon_id", () => {
  const { canon_id: _, ...rest } = minimal;
  assertRuntimeQuestionList([rest]);
});

mustFail("FAIL: missing discipline_subtype_id (must be present, null ok)", () => {
  const { discipline_subtype_id: _, ...rest } = minimal;
  assertRuntimeQuestionList([rest]);
});

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}
console.log("\nAll tests passed.");
process.exit(0);
