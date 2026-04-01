/**
 * Report rendering: Energy dependency data and vulnerabilities/OFCs.
 * Data source: client calls loadEnergyAnswers() (persistence.ts) and passes
 * derived.reportBlocks/vulnerabilities/ofcs/knowledgeGaps to export API — same source as Energy UI.
 */
import type { EnergyReportBlock, EnergyVulnerability, EnergyOfc } from '@/app/lib/dependencies/derive_energy_findings';
import type { KnowledgeGap } from '@/app/lib/dependencies/knowledge_gaps/gapTypes';

export type EnergyReportSection = {
  dataBlocks: EnergyReportBlock[];
  vulnerabilities: EnergyVulnerability[];
  ofcs: EnergyOfc[];
  knowledgeGaps?: KnowledgeGap[];
};

/** Build pre-renderable content for the Energy section. Tables and lists in stable order. */
export function buildEnergyReportSection(payload: {
  reportBlocks: EnergyReportBlock[];
  vulnerabilities: EnergyVulnerability[];
  ofcs: EnergyOfc[];
  knowledgeGaps?: KnowledgeGap[];
}): EnergyReportSection {
  return {
    dataBlocks: payload.reportBlocks,
    vulnerabilities: payload.vulnerabilities,
    ofcs: payload.ofcs,
    knowledgeGaps: payload.knowledgeGaps ?? [],
  };
}

/** Format a single report block as plain text (for plain-text or line-based export). */
export function formatEnergyBlockAsText(block: EnergyReportBlock): string[] {
  const lines: string[] = [];
  lines.push(block.title);
  if (block.type === 'narrative') {
    lines.push(block.text);
  } else if (block.type === 'list') {
    block.items.forEach((item) => lines.push(`• ${item}`));
  } else if (block.type === 'table') {
    lines.push(block.headers.join('\t'));
    block.rows.forEach((row) => lines.push(row.join('\t')));
  }
  return lines;
}

/** Format full Energy section as text lines. */
export function formatEnergySectionAsText(section: EnergyReportSection): string[] {
  const lines: string[] = [];
  lines.push('--- Energy — Dependency Data ---');
  for (const block of section.dataBlocks) {
    lines.push('');
    lines.push(...formatEnergyBlockAsText(block));
  }
  lines.push('');
  lines.push('--- Energy — Findings and Options for Consideration ---');
  const ofcsByVuln = new Map<string, EnergyOfc>();
  for (const ofc of section.ofcs) {
    ofcsByVuln.set(ofc.vulnerability_id, ofc);
  }
  for (const v of section.vulnerabilities) {
    lines.push('');
    lines.push(`Finding: ${v.text}`);
    const ev = (v as { evidence?: Array<{ question_id: string }> }).evidence;
    if (ev?.length) {
      lines.push(`  Evidence: ${ev.map((e) => e.question_id).join(', ')}`);
    }
    const ofc = ofcsByVuln.get(v.id);
    if (ofc) lines.push(`Option for consideration: ${ofc.text}`);
  }
  const gaps = section.knowledgeGaps ?? [];
  if (gaps.length > 0) {
    lines.push('');
    lines.push('--- Knowledge gaps ---');
    for (const g of gaps.slice(0, 6)) {
      lines.push(`• ${g.title} — ${g.description}`);
    }
  }
  return lines;
}
