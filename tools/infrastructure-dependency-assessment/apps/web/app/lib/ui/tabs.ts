/**
 * Single source of truth for assessment wizard tabs (workbook sheet parity).
 * Do not add tabs unless the workbook has a corresponding sheet.
 */
export const SECTION_TABS = [
  { id: 'ASSET_INFORMATION', title: 'Asset Information' },
  { id: 'ELECTRIC_POWER', title: 'Electric Power' },
  { id: 'COMMUNICATIONS', title: 'Communications' },
  { id: 'INFORMATION_TECHNOLOGY', title: 'Information Technology' },
  { id: 'WATER', title: 'Water' },
  { id: 'WASTEWATER', title: 'Wastewater' },
  { id: 'CRITICAL_PRODUCTS', title: 'Critical Products' },
  { id: 'SUMMARY', title: 'Summary' },
  { id: 'CROSS_DEPENDENCIES', title: 'Cross-Dependency & Cascading Risk' },
  { id: 'REVIEW_EXPORT', title: 'Review & Export' },
] as const;

export type SectionTabId = (typeof SECTION_TABS)[number]['id'];
