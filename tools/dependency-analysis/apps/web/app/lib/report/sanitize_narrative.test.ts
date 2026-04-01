import { describe, it, expect } from 'vitest';
import { findRawKeyLeak, collectRawKeyLeaks } from './sanitize_narrative';

describe('sanitize_narrative', () => {
  it('findRawKeyLeak returns null for plain language', () => {
    expect(findRawKeyLeak('Time to severe impact is 4 hours.')).toBeNull();
    expect(findRawKeyLeak('Not documented.')).toBeNull();
  });

  it('findRawKeyLeak detects key-like pattern W_Q8_alternate_source', () => {
    expect(findRawKeyLeak('W_Q8_alternate_source = yes')).toBeTruthy();
    expect(collectRawKeyLeaks('W_Q8_alternate_source = yes').length).toBeGreaterThan(0);
  });

  it('collectRawKeyLeaks detects E-3 and IT-1 style keys', () => {
    const leaks = collectRawKeyLeaks('Assessment shows E-3_more_than_one_connection = no.');
    expect(leaks.length).toBeGreaterThan(0);
  });

  it('rendered report text must not contain internal keys', () => {
    const safe = 'Multiple service connections documented. Time to severe impact: 6 hours.';
    expect(collectRawKeyLeaks(safe)).toHaveLength(0);
  });
});
