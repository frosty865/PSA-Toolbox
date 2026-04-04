'use client';
/**
 * Client-side CSV export for analytical considerations. No server required.
 */
import type { VOFCCollection } from 'schema';

const CSV_HEADERS = [
  'vofc_id',
  'category',
  'origin',
  'title',
  'vulnerability',
  'impact',
  'option_for_consideration',
  'applicability',
  'base_severity',
  'calibrated_severity',
  'calibration_reason',
];

function escapeCsvCell(value: string | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function vofcCollectionToCsv(collection: VOFCCollection): string {
  const rows: string[] = [CSV_HEADERS.join(',')];
  for (const row of collection.items) {
    const cells = [
      escapeCsvCell(row.vofc_id),
      escapeCsvCell(row.category),
      escapeCsvCell(row.origin),
      escapeCsvCell(row.title),
      escapeCsvCell(row.vulnerability),
      escapeCsvCell(row.impact),
      escapeCsvCell(row.option_for_consideration),
      escapeCsvCell(row.applicability),
      escapeCsvCell(row.base_severity),
      escapeCsvCell(row.calibrated_severity),
      escapeCsvCell(row.calibration_reason ?? null),
    ];
    rows.push(cells.join(','));
  }
  return rows.join('\r\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
