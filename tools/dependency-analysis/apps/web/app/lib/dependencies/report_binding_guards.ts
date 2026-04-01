/**
 * Report binding guards (Phase 5).
 * FAIL BUILD (throw) if report content contains forbidden placeholders or structural violations.
 */
const FORBIDDEN_PHRASES = ['Choose an item', '____'] as const;

export type ReportBlock =
  | { type: 'narrative'; title: string; text: string }
  | { type: 'list'; title: string; items: string[] }
  | { type: 'table'; title: string; headers: string[]; rows: string[][] };

export type ReportBindingInput = {
  vulnerabilities: Array<{ id: string; text: string }>;
  ofcs: Array<{ id: string; text: string; vulnerability_id: string }>;
  reportBlocks?: ReportBlock[];
};

/**
 * Asserts report payload is valid for export.
 * @throws Error with all violations if any guard fails
 */
export function assertReportBindingGuards(payload: ReportBindingInput): void {
  const errors: string[] = [];
  const { vulnerabilities, ofcs, reportBlocks = [] } = payload;

  const vulnIds = new Set(vulnerabilities.map((v) => v.id));

  for (const block of reportBlocks) {
    if (block.type === 'narrative' && block.text) {
      for (const phrase of FORBIDDEN_PHRASES) {
        if (block.text.includes(phrase)) {
          errors.push(`Report narrative contains forbidden text: "${phrase}"`);
        }
      }
    }
    if (block.type === 'table' && block.rows.length === 0) {
      errors.push(`Empty table in report: ${block.title}`);
    }
  }

  for (const v of vulnerabilities) {
    if (!ofcs.some((o) => o.vulnerability_id === v.id)) {
      errors.push(`Vulnerability without OFC: ${v.id}`);
    }
    if (v.text.includes('Choose an item') || v.text.includes('____')) {
      errors.push(`Vulnerability text contains forbidden placeholder: ${v.id}`);
    }
  }

  for (const ofc of ofcs) {
    if (!vulnIds.has(ofc.vulnerability_id)) {
      errors.push(`OFC without vulnerability: ${ofc.vulnerability_id}`);
    }
    if (!ofc.text || ofc.text.trim() === '') {
      errors.push(`OFC has empty text: ${ofc.id}`);
    }
    if (ofc.text.includes('Choose an item')) {
      errors.push(`OFC contains "Choose an item": ${ofc.id}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Report binding guard failed:\n${errors.join('\n')}`);
  }
}
