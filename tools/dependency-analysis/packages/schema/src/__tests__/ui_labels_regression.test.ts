/**
 * Label drift regression: snapshot only the label surface (key, label, label_source).
 * Workbook wording changes must be reviewed and accepted via snapshot updates.
 * Deduplication by normalized key so curve alias keys (e.g. curve_time_to_impact_hours)
 * do not duplicate canonical keys (curve_time_to_impact) in the surface.
 */
import { describe, it, expect } from 'vitest';
import type { UICategoryConfig } from '../ui_config';
import { UI_CONFIG } from '../ui_config.generated';

/** Alias -> canonical key for label surface deduplication only. Schema-local; no web import. */
const CURVE_KEY_ALIASES: Record<string, string> = {
  curve_time_to_impact_hours: 'curve_time_to_impact',
  curve_loss_fraction_no_backup: 'curve_loss_no_backup',
  curve_backup_duration_hours: 'curve_backup_duration',
  curve_loss_fraction_with_backup: 'curve_loss_with_backup',
  curve_recovery_time_hours: 'curve_recovery_time',
};

function normalizeKey(key: string): string {
  return CURVE_KEY_ALIASES[key] ?? key;
}

function stableStringify(obj: unknown): string {
  function visit(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(visit);
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) {
      sorted[k] = visit((value as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  const out = JSON.stringify(visit(obj), null, 2);
  return out.endsWith('\n') ? out : out + '\n';
}

type FieldSurface = { key: string; label: string; label_source: { sheet: string; cell: string } };

/** Human-reviewable label surface per category: title + per field key, label, label_source. Deduped by normalized key per section; stable sort. */
function getLabelSurface(config: UICategoryConfig[]): unknown {
  const categories = [...config].sort((a, b) => a.title.localeCompare(b.title));

  return categories.map((cat) => {
    const seen = new Set<string>();
    const fieldsDeduped: FieldSurface[] = [];
    for (const f of cat.fields) {
      const nk = normalizeKey(f.key);
      if (seen.has(nk)) continue;
      seen.add(nk);
      fieldsDeduped.push({
        key: f.key,
        label: f.label,
        label_source: f.label_source,
      });
    }
    const fieldsSorted = fieldsDeduped.sort((a, b) => {
      const nkA = normalizeKey(a.key);
      const nkB = normalizeKey(b.key);
      if (nkA !== nkB) return nkA.localeCompare(nkB);
      const sheetA = a.label_source?.sheet ?? '';
      const sheetB = b.label_source?.sheet ?? '';
      if (sheetA !== sheetB) return sheetA.localeCompare(sheetB);
      const cellA = a.label_source?.cell ?? '';
      const cellB = b.label_source?.cell ?? '';
      return cellA.localeCompare(cellB);
    });
    return {
      category: cat.category,
      title: cat.title,
      fields: fieldsSorted,
    };
  });
}

describe('ui_labels_regression', () => {
  it('label surface (key, label, label_source) is deterministic and matches snapshot', () => {
    const surface = getLabelSurface(UI_CONFIG);
    expect(stableStringify(surface)).toMatchSnapshot();
  });
});
