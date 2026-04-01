import fs from 'node:fs/promises';
import path from 'node:path';
import { STANDARD_VOFC_BY_VULN } from '@/app/lib/report/standards/vofc_standard_registry';
import { CITATIONS } from '@/app/lib/vuln/citations_registry';
import { QUESTION_VULN_MAP, type Trigger, type VulnTemplate } from '@/app/lib/vuln/question_vuln_map';
import { ENERGY_VULNERABILITY_TEXTS } from '@/app/lib/dependencies/derive_energy_findings';
import { COMMS_VULNERABILITY_TEXTS } from '@/app/lib/dependencies/derive_comms_findings';
import { IT_VULNERABILITY_TEXTS } from '@/app/lib/dependencies/derive_it_findings';
import { WATER_VULNERABILITY_TEXTS } from '@/app/lib/dependencies/derive_water_findings';
import { WASTEWATER_VULNERABILITY_TEXTS } from '@/app/lib/dependencies/derive_wastewater_findings';

const TITLE_BY_ID: Record<string, string> = {
  ...ENERGY_VULNERABILITY_TEXTS,
  ...COMMS_VULNERABILITY_TEXTS,
  ...IT_VULNERABILITY_TEXTS,
  ...WATER_VULNERABILITY_TEXTS,
  ...WASTEWATER_VULNERABILITY_TEXTS,
};

function domainFor(vulnId: string): string {
  if (vulnId.startsWith('ENERGY_')) return 'ELECTRIC_POWER';
  if (vulnId.startsWith('COMMS_')) return 'COMMUNICATIONS';
  if (vulnId.startsWith('IT_')) return 'INFORMATION_TECHNOLOGY';
  if (vulnId.startsWith('W_')) return 'WATER';
  if (vulnId.startsWith('WW_')) return 'WASTEWATER';
  return 'UNKNOWN';
}

function formatTrigger(trigger: Trigger): string {
  switch (trigger.op) {
    case 'eq':
      return `${trigger.questionId} == ${String(trigger.value)}`;
    case 'neq':
      return `${trigger.questionId} != ${String(trigger.value)}`;
    case 'in':
      return `${trigger.questionId} in (${trigger.values.map((v) => String(v)).join(', ')})`;
    case 'present':
      return `${trigger.questionId} is present`;
    case 'empty':
      return `${trigger.questionId} is empty`;
    case 'and':
      return `(${trigger.all.map(formatTrigger).join(' AND ')})`;
    case 'or':
      return `(${trigger.any.map(formatTrigger).join(' OR ')})`;
    case 'not':
      return `NOT (${formatTrigger(trigger.inner)})`;
    default:
      return 'unknown-trigger';
  }
}

function listSources(citationIds: string[]): string[] {
  return citationIds.map((citationId) => {
    const citation = CITATIONS[citationId];
    if (!citation) throw new Error(`Missing citation id in registry: ${citationId}`);
    return `${citation.title} (${citation.publisher}) — ${citation.url}`;
  });
}

function curatedOfcsFor(template: VulnTemplate): Array<{ text: string; citationId?: string }> {
  const curated = STANDARD_VOFC_BY_VULN[template.id]?.ofcs;
  if (curated?.length) {
    return curated.map((item) => ({ text: item.text, citationId: item.citation_id }));
  }
  return (template.ofcs ?? []).map((item) => ({ text: item.text }));
}

async function main() {
  const topLevelRows = Object.entries(STANDARD_VOFC_BY_VULN)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([vulnId, spec]) => {
      if (spec.ofcs.length < 2 || spec.ofcs.length > 3) {
        throw new Error(`${vulnId}: must have 2-3 OFCs, got ${spec.ofcs.length}`);
      }
      const title = TITLE_BY_ID[vulnId] ?? vulnId;
      const domain = domainFor(vulnId);
      const ofcLines = spec.ofcs.map((o, i) => {
        const c = CITATIONS[o.citation_id];
        if (!c) throw new Error(`${vulnId}: missing citation ${o.citation_id}`);
        return `${i + 1}. ${o.text}\n   Source: ${c.title} (${c.publisher}) — ${c.url}\n   Mode: ${o.mode}`;
      });
      return { vulnId, title, domain, ofcLines };
    });

  const questionRows = Object.entries(QUESTION_VULN_MAP)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([questionId, templates]) => ({ questionId, templates }));

  const lines: string[] = [];
  lines.push('# Curated Vulnerabilities and OFCs (Project-Wide)');
  lines.push('');
  lines.push('This catalog includes both runtime top-level vulnerabilities and full question-mapped vulnerability coverage.');
  lines.push('All source references resolve to real documents in `citations_registry.ts`.');
  lines.push('');
  lines.push('## Runtime Top-Level Vulnerabilities (VOFC Output)');
  lines.push('');
  lines.push('These are the enforced top-level runtime vulnerabilities used by `build_vofc_collection.ts`.');
  lines.push('Each runtime vulnerability has 2-3 curated OFCs.');
  lines.push('');

  let currentDomain = '';
  for (const row of topLevelRows.sort((a, b) => (a.domain + a.vulnId).localeCompare(b.domain + b.vulnId))) {
    if (row.domain !== currentDomain) {
      currentDomain = row.domain;
      lines.push(`## ${currentDomain}`);
      lines.push('');
    }
    lines.push(`### ${row.title}`);
    lines.push(`- Vulnerability ID: \`${row.vulnId}\``);
    lines.push('- Curated OFCs:');
    for (const ofcLine of row.ofcLines) {
      lines.push(`  ${ofcLine}`);
    }
    lines.push('');
  }

  lines.push('## Full Assessment Question Coverage');
  lines.push('');
  lines.push('This section lists all vulnerability templates mapped to assessment questions in `question_vuln_map.ts`.');
  lines.push('');

  for (const row of questionRows) {
    lines.push(`### Question ${row.questionId}`);
    lines.push('');
    if (!row.templates.length) {
      lines.push('- No vulnerability templates mapped.');
      lines.push('');
      continue;
    }

    for (const template of row.templates) {
      const ofcs = curatedOfcsFor(template);
      const sources = listSources(template.citations);
      lines.push(`- Vulnerability: ${template.title}`);
      lines.push(`- Vulnerability ID: \`${template.id}\``);
      lines.push(`- Domain: ${template.category}`);
      lines.push(`- PRA/SLA required: ${template.requiresPRA === true ? 'Yes' : 'No'}`);
      lines.push(`- Context: ${template.summary}`);
      lines.push(`- Trigger logic: ${template.triggers.map(formatTrigger).join(' OR ')}`);
      lines.push('- Source references:');
      for (const source of sources) {
        lines.push(`  - ${source}`);
      }
      lines.push('- OFCs:');
      for (let i = 0; i < ofcs.length; i++) {
        const item = ofcs[i];
        if (item.citationId) {
          const citation = CITATIONS[item.citationId];
          if (!citation) throw new Error(`Missing curated citation id in registry: ${item.citationId}`);
          lines.push(`  ${i + 1}. ${item.text}`);
          lines.push(`     Source: ${citation.title} (${citation.publisher}) — ${citation.url}`);
        } else {
          lines.push(`  ${i + 1}. ${item.text}`);
          lines.push(`     Sources: ${sources.join(' | ')}`);
        }
      }
      lines.push('');
    }
  }

  const outPath = path.resolve(process.cwd(), '..', '..', 'docs', 'CURATED_TOP_LEVEL_VULNS_AND_OFCS.md');
  await fs.writeFile(outPath, `${lines.join('\n')}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
