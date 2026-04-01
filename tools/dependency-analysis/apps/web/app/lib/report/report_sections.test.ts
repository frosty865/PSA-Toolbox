import { describe, it, expect } from 'vitest';
import {
  REPORT_SECTIONS,
  getSectionNumber,
  getSectionLabelLetter,
  getAppendixSubLabel,
  getTocEntries,
} from './report_sections';

describe('report_sections', () => {
  it('REPORT_SECTIONS has 10 top-level sections', () => {
    expect(REPORT_SECTIONS).toHaveLength(10);
  });

  it('getSectionNumber returns 1-based index', () => {
    expect(getSectionNumber(0)).toBe('1');
    expect(getSectionNumber(6)).toBe('7');
    expect(getSectionNumber(9)).toBe('10');
  });

  it('getSectionLabelLetter returns A, B, C for index 0, 1, 2', () => {
    expect(getSectionLabelLetter(0)).toBe('A');
    expect(getSectionLabelLetter(1)).toBe('B');
    expect(getSectionLabelLetter(2)).toBe('C');
  });

  it('getAppendixSubLabel returns 10.A, 10.B', () => {
    expect(getAppendixSubLabel(0)).toBe('10.A');
    expect(getAppendixSubLabel(1)).toBe('10.B');
  });

  it('getTocEntries count equals REPORT_SECTIONS and no skipped labels', () => {
    const toc = getTocEntries();
    expect(toc).toHaveLength(REPORT_SECTIONS.length);
    toc.forEach((entry, i) => {
      expect(entry.number).toBe(getSectionNumber(i));
      expect(entry.title).toBe(REPORT_SECTIONS[i].title);
    });
  });
});
