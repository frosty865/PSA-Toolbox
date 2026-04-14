/**
 * Canonical report section order and labels.
 * Single source of truth for TOC and body rendering; no manual letters/numbers.
 * TOC count must equal body section count; no skipped labels.
 */

export type ReportSectionId =
  | 'executive'
  | 'electric_power'
  | 'communications'
  | 'information_technology'
  | 'water'
  | 'wastewater'
  | 'cross_dependency'
  | 'synthesis'
  | 'methodology'
  | 'appendices';

export type ReportSectionDef = {
  id: ReportSectionId;
  title: string;
};

/** Canonical order: used for TOC and body rendering. */
export const REPORT_SECTIONS: ReportSectionDef[] = [
  { id: 'executive', title: 'Hotel Fact Sheet' },
  { id: 'electric_power', title: 'Electric Power' },
  { id: 'communications', title: 'Communications' },
  { id: 'information_technology', title: 'Information Technology' },
  { id: 'water', title: 'Water' },
  { id: 'wastewater', title: 'Wastewater' },
  { id: 'cross_dependency', title: 'Cross-Dependency & Cascading Risk' },
  { id: 'synthesis', title: 'Risk Posture Synthesis' },
  { id: 'methodology', title: 'Methodology' },
  { id: 'appendices', title: 'Appendices' },
];

/** Number label from index (1-based). Use for top-level section numbers. */
export function getSectionNumber(index: number): string {
  return (index + 1).toString();
}

/** Letter label from index (A, B, C, ...). Use for appendix sub-sections. */
export function getSectionLabelLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Appendix sub-label: "10.A", "10.B", ... when appendix is section index 9 (10th section). */
export function getAppendixSubLabel(appendixIndex: number): string {
  return `10.${getSectionLabelLetter(appendixIndex)}`;
}

/** Return TOC entries (title + number) for QC: count and titles must match body. */
export function getTocEntries(): Array<{ number: string; title: string }> {
  return REPORT_SECTIONS.map((s, i) => ({
    number: getSectionNumber(i),
    title: s.title,
  }));
}
