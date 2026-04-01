# Test Fixtures for Vulnerability Integrity Verification

This directory contains test assessment fixtures for validating the Key Risk Driver Engine and Trigger Density Diagnostics.

## Fixtures

### `low_signal.json`
- **Purpose**: Test cases with minimal vulnerability triggers
- **Characteristics**:
  - Mostly "YES" answers (positive controls, good practices)
  - Low infrastructure loss percentages
  - Good backup availability
  - Expected to trigger 0-3 vulnerabilities when catalogs are implemented

### `typical_signal.json`
- **Purpose**: Test cases with moderate vulnerability triggers
- **Characteristics**:
  - Mix of "YES" and "NO" answers
  - Moderate infrastructure loss percentages (50-85%)
  - Some backup gaps
  - Some foundational gaps (provider identification)
  - Expected to trigger 8-15 vulnerabilities when catalogs are implemented
  - Should produce 3-6 key risk drivers

### `high_noise.json`
- **Purpose**: Test cases designed to trigger noise thresholds (should FAIL)
- **Characteristics**:
  - Mostly "NO" answers (worst-case scenario)
  - High infrastructure loss percentages (85-100%)
  - No backup capability
  - Very fast time-to-impact (< 1 hour)
  - Very long recovery times (> 96 hours)
  - Expected to trigger 20+ vulnerabilities when catalogs are implemented
  - **Should fail density threshold checks** (>24 total or >12 per infra)

## Usage

These fixtures are loaded by `scripts/verify_vuln_integrity.ts` when vulnerability catalogs are implemented.

To test manually:
```typescript
import lowSignal from './fixtures/assessments/low_signal.json';
import { buildReportVM } from '../app/lib/report/view_model';

const report = buildReportVM(lowSignal);
console.log(report.debug?.triggerDensity);
```

## Trigger Density Thresholds

**Total Vulnerabilities:**
- Warning: ≥16
- Fail: ≥24

**Per Infrastructure:**
- Warning: ≥8
- Fail: ≥12

**Per Driver Category:**
- Warning: ≥6
- Fail: ≥10

**Key Risk Drivers:**
- Min: 3 (if any vulnerabilities triggered)
- Max: 6 (hard limit)

## Expected Results

When vulnerability catalogs are implemented:

| Fixture | Total Vulns | Key Drivers | Warnings | Fails |
|---------|-------------|-------------|----------|-------|
| low_signal | 0-3 | 0 | 0 | 0 |
| typical_signal | 8-15 | 3-6 | 0-2 | 0 |
| high_noise | 20+ | 6 | 3+ | 1+ |

The `high_noise` fixture should intentionally fail density checks to validate threshold enforcement.

## Truth Diff Harness

**`sample_export.json`** is a minimal export-shaped payload (assessment + canonicalVulnBlocks) used by the Truth Diff harness to compare JSON export, canonical derived, web summary, and reporter pre-DOCX model. Regenerate it with:

```bash
pnpm exec tsx scripts/fixtures/generate_sample_export.ts
```

Run the harness from repo root: `pnpm truth:diff:fixture` (or `pnpm truth:diff -- --json <path> [--out <dir>] [--strict]`). Outputs: `truth_diff.json` (machine-readable) and `truth_diff.md` in `--out`. Exit 2 on any mismatch.
