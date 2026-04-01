/**
 * Structural regression: CRITICAL_PRODUCTS is table-driven; UI_CONFIG table columns match workbook;
 * schema accepts a representative CP row set.
 */
import { describe, it, expect } from 'vitest';
import { UI_CONFIG } from 'schema';
import { CategoryInputSchema } from 'schema';

const EXPECTED_CP_COLUMN_KEYS = [
  'product_or_service',
  'dependency_present',
  'notes',
  'single_source',
  'alternate_supplier_identified',
];

describe('workbook_alignment_critical_products', () => {
  it('UI_CONFIG CRITICAL_PRODUCTS has table with expected workbook column keys', () => {
    const cp = UI_CONFIG.find((c) => c.category === 'CRITICAL_PRODUCTS');
    expect(cp).toBeDefined();
    expect(cp!.table).toBeDefined();
    const keys = cp!.table!.columns.map((col) => col.key);
    expect(keys).toEqual(EXPECTED_CP_COLUMN_KEYS);
  });

  it('schema accepts representative critical_products row set', () => {
    const input = {
      critical_products: [
        {
          product_or_service: 'Chemical X',
          dependency_present: true,
          notes: 'Single supplier in region',
          single_source: true,
          alternate_supplier_identified: false,
          alternate_supplier_name: null,
          multi_source_currently_used: null,
        },
        {
          product_or_service: 'Spare parts',
          dependency_present: false,
          notes: null,
          single_source: null,
          alternate_supplier_identified: null,
          alternate_supplier_name: null,
          multi_source_currently_used: null,
        },
      ],
    };
    const parsed = CategoryInputSchema.parse(input);
    expect(parsed.critical_products).toHaveLength(2);
    expect(parsed.critical_products![0].product_or_service).toBe('Chemical X');
    expect(parsed.critical_products![0].dependency_present).toBe(true);
    expect(parsed.critical_products![1].dependency_present).toBe(false);
  });
});
