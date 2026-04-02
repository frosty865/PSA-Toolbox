# Test Directory

This directory contains regression tests for critical UI logic.

## Current Tests

- `groupOfcsByDepth.test.ts` - Regression guard for OFC grouping logic

## Test Framework Setup

Currently, no test framework is configured. To run these tests, you'll need to:

1. Install a test framework (Jest or Vitest recommended):
   ```bash
   npm install --save-dev jest @types/jest ts-jest
   # OR
   npm install --save-dev vitest @vitest/ui
   ```

2. Configure the test framework in `package.json` or a config file

3. Add a test script to `package.json`:
   ```json
   "scripts": {
     "test": "jest"
     // OR
     "test": "vitest"
   }
   ```

## Test Purpose

These tests serve as **regression guards** to ensure critical UI logic (like OFC grouping) does not break when code is refactored or modified.

