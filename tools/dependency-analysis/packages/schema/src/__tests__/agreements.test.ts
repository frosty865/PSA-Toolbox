import { describe, it, expect } from 'vitest';
import { AgreementsSchema } from '../assessment';

describe('AgreementsSchema', () => {
  it('accepts valid agreements with has_sla=true and sla_hours set', () => {
    const result = AgreementsSchema.safeParse({
      has_sla: true,
      sla_hours: 24,
      has_pra: false,
      pra_category: null,
      pra_category_other: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid agreements with has_pra=true and pra_category set', () => {
    const result = AgreementsSchema.safeParse({
      has_sla: false,
      sla_hours: null,
      has_pra: true,
      pra_category: 'TIER_1',
      pra_category_other: null,
    });
    expect(result.success).toBe(true);
  });

  it('has_sla=false requires sla_hours to be null', () => {
    const result = AgreementsSchema.safeParse({
      has_sla: false,
      sla_hours: 48,
      has_pra: false,
      pra_category: null,
      pra_category_other: null,
    });
    expect(result.success).toBe(false);
  });

  it('has_pra=false requires pra_category and pra_category_other to be null', () => {
    const result = AgreementsSchema.safeParse({
      has_sla: false,
      sla_hours: null,
      has_pra: false,
      pra_category: 'TIER_1',
      pra_category_other: null,
    });
    expect(result.success).toBe(false);
  });

  it('has_sla=true requires sla_hours to be set', () => {
    const result = AgreementsSchema.safeParse({
      has_sla: true,
      sla_hours: null,
      has_pra: false,
      pra_category: null,
      pra_category_other: null,
    });
    expect(result.success).toBe(false);
  });

  it('OTHER requires pra_category_other to be non-empty', () => {
    const result = AgreementsSchema.safeParse({
      has_sla: false,
      sla_hours: null,
      has_pra: true,
      pra_category: 'OTHER',
      pra_category_other: null,
    });
    expect(result.success).toBe(false);
  });

  it('OTHER with non-empty pra_category_other passes', () => {
    const result = AgreementsSchema.safeParse({
      has_sla: false,
      sla_hours: null,
      has_pra: true,
      pra_category: 'OTHER',
      pra_category_other: 'Custom tier',
    });
    expect(result.success).toBe(true);
  });

  it('sla_hours must be within 0..168', () => {
    expect(AgreementsSchema.safeParse({ has_sla: true, sla_hours: -1, has_pra: false, pra_category: null, pra_category_other: null }).success).toBe(false);
    expect(AgreementsSchema.safeParse({ has_sla: true, sla_hours: 169, has_pra: false, pra_category: null, pra_category_other: null }).success).toBe(false);
    expect(AgreementsSchema.safeParse({ has_sla: true, sla_hours: 0, has_pra: false, pra_category: null, pra_category_other: null }).success).toBe(true);
    expect(AgreementsSchema.safeParse({ has_sla: true, sla_hours: 168, has_pra: false, pra_category: null, pra_category_other: null }).success).toBe(true);
  });
});
