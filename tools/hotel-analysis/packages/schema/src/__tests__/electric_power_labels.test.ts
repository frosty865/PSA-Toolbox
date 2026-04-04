/**
 * Regression snapshot for Electric Power wording.
 * Labels must exactly match the XLSM questions (including punctuation).
 * If this snapshot changes, the reviewer must confirm the workbook changed.
 */
import { describe, it, expect } from 'vitest';
import { UI_CONFIG } from '../ui_config.generated';

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

function getElectricPowerLabelSurface(): unknown {
  const cat = UI_CONFIG.find((c) => c.category === 'ELECTRIC_POWER');
  if (!cat) throw new Error('ELECTRIC_POWER category not found in UI_CONFIG');
  return {
    category: cat.category,
    title: cat.title,
    fields: cat.fields.map((f) => ({
      key: f.key,
      label: f.label,
      label_source: f.label_source,
    })),
  };
}

describe('electric_power_labels', () => {
  it('Electric Power labels (key, label, label_source) match XLSM wording exactly', () => {
    const surface = getElectricPowerLabelSurface();
    expect(stableStringify(surface)).toMatchSnapshot();
  });
});
