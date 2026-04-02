# End-to-End Tests

This directory contains end-to-end smoke tests for critical UI functionality.

## Current Tests

- `ofc-depth-rendering.spec.ts` - Smoke test for OFC depth hierarchy rendering

## Prerequisites

These tests require Playwright to be installed:

```bash
npm install --save-dev @playwright/test
npx playwright install
```

## Environment Variables

- `TEST_ASSESSMENT_ID` - Assessment ID to use for testing. Must be an assessment that produces:
  - Baseline OFCs (NO response)
  - Baseline Depth OFCs (NO response + parent YES)
  - Sector Depth OFCs (NO response + parent YES + sector match)
  - Subsector Depth OFCs (NO response + parent YES + sector + subsector match)

## Running Tests

```bash
# Run all e2e tests
npx playwright test

# Run specific test file
npx playwright test e2e/ofc-depth-rendering.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed
```

## Test Purpose

These tests serve as **guardrails** to ensure critical UI logic (like OFC grouping and rendering) does not break when code is refactored or modified.

They verify:
- OFCs returned by the API
- Correct grouping by depth
- Correct render order
- Correct labels
- No flattening regressions

They do NOT test:
- Styling fidelity
- PDF export
- Performance

