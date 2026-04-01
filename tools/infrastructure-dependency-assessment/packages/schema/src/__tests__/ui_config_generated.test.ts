/**
 * Integrity test: checked-in ui_config.generated.ts must match XLSM extraction output.
 * No snapshots. Strict mode (ADA_STRICT_INTEGRITY=1): XLSM required; only exit 0 from check-generated passes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { UI_CONFIG } from '../ui_config.generated';

const STRICT = process.env.ADA_STRICT_INTEGRITY === '1' || process.env.ADA_STRICT_INTEGRITY?.toLowerCase() === 'true';

describe('ui_config.generated', () => {
  it('UI_CONFIG has expected structure', () => {
    expect(UI_CONFIG).toBeDefined();
    expect(Array.isArray(UI_CONFIG)).toBe(true);
    expect(UI_CONFIG.length).toBe(6);
    const categories = new Set(UI_CONFIG.map((c) => c.category));
    expect(categories.has('ELECTRIC_POWER')).toBe(true);
    expect(categories.has('COMMUNICATIONS')).toBe(true);
    expect(categories.has('INFORMATION_TECHNOLOGY')).toBe(true);
    expect(categories.has('WATER')).toBe(true);
    expect(categories.has('WASTEWATER')).toBe(true);
    expect(categories.has('CRITICAL_PRODUCTS')).toBe(true);
  });

  it('checked-in generated file matches current XLSM extraction when workbook exists', () => {
    const repoRoot = path.resolve(__dirname, '../../../../');
    const xlsmPath = path.join(repoRoot, 'assets', 'workbooks', 'Asset Dependency Visualization.xlsm');
    const xlsmExists = fs.existsSync(xlsmPath);

    if (STRICT && !xlsmExists) {
      expect.fail(
        `Strict mode (ADA_STRICT_INTEGRITY=1): XLSM required but not found at ${xlsmPath}. Add workbook or run without strict mode.`
      );
    }
    if (!xlsmExists) {
      // Non-strict: skip when XLSM is not present (e.g. local dev without workbook).
      return;
    }

    let status: number | null = null;
    try {
      execSync('pnpm run check-generated', { cwd: repoRoot, encoding: 'utf-8', stdio: 'pipe' });
      status = 0;
    } catch (err: unknown) {
      status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : null;
    }

    if (STRICT) {
      // Strict: only exit 0 passes; exit 1 or 2 fails.
      if (status !== 0) {
        const msg =
          status === 1
            ? 'Generated file is out of date or was hand-edited. Run from repo root: pnpm run extract-xlsm, then commit packages/schema/src/ui_config.generated.ts'
            : 'check-generated failed (XLSM missing or extraction error). Fix workbook or extraction and re-run.';
        expect.fail(msg);
      }
      return;
    }

    // Non-strict: exit 1 = fail (out of date); exit 0 or 2 = pass (2 = extraction not runnable, skip).
    if (status === 1) {
      expect.fail(
        'Generated file is out of date or was hand-edited. Run from repo root: pnpm run extract-xlsm, then commit packages/schema/src/ui_config.generated.ts'
      );
    }
  });
});
