import { describe, it, expect } from 'vitest';
import { storedToDisplayPercent, displayToStoredPercent } from '../percent_display';

describe('percent_display', () => {
  describe('storedToDisplayPercent', () => {
    it('converts stored 0.35 to display 35', () => {
      expect(storedToDisplayPercent(0.35)).toBe(35);
    });
    it('converts stored 0.5 to display 50', () => {
      expect(storedToDisplayPercent(0.5)).toBe(50);
    });
    it('returns empty string for null/undefined', () => {
      expect(storedToDisplayPercent(null)).toBe('');
      expect(storedToDisplayPercent(undefined)).toBe('');
    });
    it('converts 0 and 1 correctly', () => {
      expect(storedToDisplayPercent(0)).toBe(0);
      expect(storedToDisplayPercent(1)).toBe(100);
    });
  });

  describe('displayToStoredPercent', () => {
    it('converts display "50" to stored 0.5', () => {
      expect(displayToStoredPercent('50')).toBe(0.5);
    });
    it('converts display "35" to stored 0.35', () => {
      expect(displayToStoredPercent('35')).toBe(0.35);
    });
    it('returns null for empty input', () => {
      expect(displayToStoredPercent('')).toBe(null);
      expect(displayToStoredPercent('   ')).toBe(null);
    });
    it('converts "0" and "100" correctly', () => {
      expect(displayToStoredPercent('0')).toBe(0);
      expect(displayToStoredPercent('100')).toBe(1);
    });
  });

  describe('round-trip (loss_fraction_no_backup / loss_fraction_with_backup)', () => {
    it('stored 0.35 → display 35 → stored 0.35', () => {
      const display = storedToDisplayPercent(0.35);
      expect(display).toBe(35);
      const back = displayToStoredPercent(String(display));
      expect(back).toBe(0.35);
    });
    it('user enters "50" → stored 0.5 → display 50', () => {
      const stored = displayToStoredPercent('50');
      expect(stored).toBe(0.5);
      const display = storedToDisplayPercent(stored!);
      expect(display).toBe(50);
    });
  });
});
