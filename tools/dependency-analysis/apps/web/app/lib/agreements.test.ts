import { describe, it, expect } from 'vitest';
import { normalizeAgreements } from '@/lib/agreements';

describe('normalizeAgreements', () => {
  it('toggle SLA off clears sla_hours', () => {
    const withSla = normalizeAgreements({
      has_sla: true,
      sla_hours: 48,
      has_pra: false,
      pra_category: null,
      pra_category_other: null,
    });
    expect(withSla.has_sla).toBe(true);
    expect(withSla.sla_hours).toBe(48);

    const off = normalizeAgreements({ ...withSla, has_sla: false });
    expect(off.has_sla).toBe(false);
    expect(off.sla_hours).toBeNull();
  });

  it('toggle PRA off clears pra_category and pra_category_other', () => {
    const withPra = normalizeAgreements({
      has_sla: false,
      sla_hours: null,
      has_pra: true,
      pra_category: 'TIER_2',
      pra_category_other: null,
    });
    expect(withPra.has_pra).toBe(true);
    expect(withPra.pra_category).toBe('TIER_2');

    const off = normalizeAgreements({ ...withPra, has_pra: false });
    expect(off.has_pra).toBe(false);
    expect(off.pra_category).toBeNull();
    expect(off.pra_category_other).toBeNull();
  });

  it('switching pra_category away from OTHER clears pra_category_other', () => {
    const withOther = normalizeAgreements({
      has_sla: false,
      sla_hours: null,
      has_pra: true,
      pra_category: 'OTHER',
      pra_category_other: 'Custom tier',
    });
    expect(withOther.pra_category).toBe('OTHER');
    expect(withOther.pra_category_other).toBe('Custom tier');

    const switched = normalizeAgreements({ ...withOther, pra_category: 'TIER_1' });
    expect(switched.pra_category).toBe('TIER_1');
    expect(switched.pra_category_other).toBeNull();
  });

  it('undefined input yields default no-SLA no-PRA state', () => {
    const out = normalizeAgreements(undefined);
    expect(out.has_sla).toBe(false);
    expect(out.sla_hours).toBeNull();
    expect(out.has_pra).toBe(false);
    expect(out.pra_category).toBeNull();
    expect(out.pra_category_other).toBeNull();
  });
});
