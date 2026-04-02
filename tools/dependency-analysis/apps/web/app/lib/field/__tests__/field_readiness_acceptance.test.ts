/**
 * Field static bundle: build script and next.config must enable static export.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const WEB_DIR = path.join(REPO_ROOT, 'apps', 'web');
const BUILD_FIELD_SCRIPT = path.join(WEB_DIR, 'scripts', 'build-field-static.cjs');
const NEXT_CONFIG = path.join(WEB_DIR, 'next.config.js');

describe('field readiness', () => {
  it('field static build script and next.config gate exist', () => {
    expect(existsSync(BUILD_FIELD_SCRIPT)).toBe(true);
    expect(existsSync(NEXT_CONFIG)).toBe(true);
    const cfg = readFileSync(NEXT_CONFIG, 'utf8');
    expect(cfg).toMatch(/FIELD_STATIC_EXPORT/);
    expect(cfg).toMatch(/output:\s*['"]export['"]/);
  });
});
