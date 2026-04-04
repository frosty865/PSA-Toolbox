import { describe, it, expect } from 'vitest';
import { getFieldHelp } from '../ui_help';

describe('getFieldHelp', () => {
  it('returns override when present (override wins over base)', () => {
    const result = getFieldHelp(
      'ELECTRIC_POWER',
      'time_to_impact_hours',
      'Base help from config',
      undefined
    );
    expect(result.help).toBe('Override: hours until impact (0–72).');
    expect(result.examples).toEqual(['24 = one day', '72 = three days']);
  });

  it('returns baseHelp when no override', () => {
    const result = getFieldHelp(
      'WATER',
      'recovery_time_hours',
      'Time to recover in hours.',
      ['Example: 48']
    );
    expect(result.help).toBe('Time to recover in hours.');
    expect(result.examples).toEqual(['Example: 48']);
  });

  it('returns null help when baseHelp is null and no override', () => {
    const result = getFieldHelp('COMMUNICATIONS', 'has_backup', null, undefined);
    expect(result.help).toBeNull();
    expect(result.examples).toBeUndefined();
  });

  it('caps examples at 3', () => {
    const result = getFieldHelp('WATER', 'recovery_time_hours', 'Help', [
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(result.examples).toEqual(['a', 'b', 'c']);
  });
});
