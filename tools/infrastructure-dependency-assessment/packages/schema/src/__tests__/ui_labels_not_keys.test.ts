/**
 * Regression: UI must never show schema keys as user-facing labels.
 * Every label must be non-empty, not equal to the field key, and not key-like (e.g. snake_case only).
 * CI fails if labels regress to keys.
 */
import { describe, it, expect } from 'vitest';
import { UI_CONFIG } from '../ui_config.generated';

const KEY_ONLY_PATTERN = /^[a-z0-9_]+$/i;

describe('UI labels are not keys', () => {
  it('every category field has a non-empty label that is not the key', () => {
    for (const cat of UI_CONFIG) {
      if (cat.table) {
        for (const col of cat.table.columns) {
          expect(col.label, `${cat.category}.table.${col.key} label`).toBeTruthy();
          expect(String(col.label).trim(), `${cat.category}.table.${col.key} label non-empty`).not.toBe('');
          expect(col.label, `${cat.category}.table.${col.key} label must not equal key`).not.toBe(col.key);
          expect(
            KEY_ONLY_PATTERN.test(String(col.label).trim()),
            `${cat.category}.table.${col.key} label must not look like a key (snake_case only)`
          ).toBe(false);
        }
        continue;
      }
      for (const field of cat.fields) {
        expect(field.label, `${cat.category}.${field.key} label`).toBeTruthy();
        expect(String(field.label).trim(), `${cat.category}.${field.key} label non-empty`).not.toBe('');
        expect(field.label, `${cat.category}.${field.key} label must not equal key`).not.toBe(field.key);
        expect(
          KEY_ONLY_PATTERN.test(String(field.label).trim()),
          `${cat.category}.${field.key} label must not look like a key (snake_case only)`
        ).toBe(false);
      }
    }
  });

  it('each category has at least one field or table column with a label', () => {
    for (const cat of UI_CONFIG) {
      if (cat.table && cat.table.columns.length > 0) {
        expect(cat.table.columns.length).toBeGreaterThan(0);
        continue;
      }
      if (cat.fields.length > 0) {
        expect(cat.fields.length).toBeGreaterThan(0);
        continue;
      }
      expect.fail(`Category ${cat.category} has no fields and no table columns`);
    }
  });
});
