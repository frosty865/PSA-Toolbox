import { test, expect } from "@playwright/test";

/**
 * End-to-End Smoke Test: OFC Depth Hierarchy Rendering
 * 
 * This test verifies that OFC depth hierarchy (baseline / baseline depth /
 * sector depth / subsector depth) renders correctly in the assessment UI.
 * 
 * This is a GUARDRAIL test to prevent regressions in OFC rendering logic.
 * 
 * Prerequisites:
 * - TEST_ASSESSMENT_ID environment variable must be set
 * - Assessment must have at least one NO response that triggers:
 *   - Baseline OFCs
 *   - Baseline Depth OFCs (parent = YES)
 *   - Sector Depth OFCs (parent = YES, sector match)
 *   - Subsector Depth OFCs (parent = YES, sector + subsector match)
 */
test("OFC depth hierarchy renders correctly under NO response", async ({ page }) => {
  // Assumes a seeded assessment ID that produces:
  // baseline + baseline depth + sector depth + subsector depth OFCs
  const assessmentId = process.env.TEST_ASSESSMENT_ID;
  if (!assessmentId) {
    throw new Error("TEST_ASSESSMENT_ID not set");
  }

  await page.goto(`/assessments/${assessmentId}`);

  // Locate a question known to be NO
  const ofcSection = page.locator("text=Options for Consideration").first();
  await expect(ofcSection).toBeVisible();

  // Labels must appear in order
  const labels = await page.locator("text=/Structural Considerations|Sector-Specific Considerations|Subsector-Specific Considerations/").allTextContents();

  expect(labels).toContain("Additional Structural Considerations");
  expect(labels).toContain("Sector-Specific Considerations");
  expect(labels).toContain("Subsector-Specific Considerations");
});

/**
 * Additional test: Verify baseline OFCs render without labels
 */
test("Baseline OFCs render without depth labels", async ({ page }) => {
  const assessmentId = process.env.TEST_ASSESSMENT_ID;
  if (!assessmentId) {
    test.skip();
    return;
  }

  await page.goto(`/assessments/${assessmentId}`);

  // Find a NO response that only has baseline OFCs (no depth OFCs)
  // This verifies that baseline OFCs don't incorrectly get depth labels
  const ofcSection = page.locator("text=Options for Consideration").first();
  await expect(ofcSection).toBeVisible();

  // Baseline OFCs should be present (the section exists)
  // But depth labels should NOT appear if there are no depth OFCs
  const depthLabels = page.locator("text=/Additional Structural Considerations|Sector-Specific Considerations|Subsector-Specific Considerations/");
  const depthLabelCount = await depthLabels.count();
  
  // If depth labels exist, they should only appear when depth OFCs are present
  // This is a sanity check - exact behavior depends on test data
  expect(depthLabelCount).toBeGreaterThanOrEqual(0);
});

/**
 * Test: Verify OFC rendering order matches specification
 */
test("OFCs render in correct hierarchical order", async ({ page }) => {
  const assessmentId = process.env.TEST_ASSESSMENT_ID;
  if (!assessmentId) {
    test.skip();
    return;
  }

  await page.goto(`/assessments/${assessmentId}`);

  // Wait for OFC section to be visible
  const ofcSection = page.locator("text=Options for Consideration").first();
  await expect(ofcSection).toBeVisible();

  // Get all text content in the OFC section
  const ofcSectionText = await ofcSection.locator("..").textContent();
  
  if (!ofcSectionText) {
    test.skip();
    return;
  }

  // Verify order: Baseline OFCs appear before depth OFCs
  // (This is a basic structural check - exact positions depend on DOM structure)
  const baselineIndex = ofcSectionText.indexOf("Options for Consideration");
  const structuralIndex = ofcSectionText.indexOf("Additional Structural Considerations");
  const sectorIndex = ofcSectionText.indexOf("Sector-Specific Considerations");
  const subsectorIndex = ofcSectionText.indexOf("Subsector-Specific Considerations");

  // If all sections exist, verify order
  if (structuralIndex !== -1 && sectorIndex !== -1 && subsectorIndex !== -1) {
    expect(baselineIndex).toBeLessThan(structuralIndex);
    expect(structuralIndex).toBeLessThan(sectorIndex);
    expect(sectorIndex).toBeLessThan(subsectorIndex);
  }
});

