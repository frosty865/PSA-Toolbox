#!/usr/bin/env tsx
/**
 * Generate seed SQL for RUNTIME taxonomy tables from taxonomy/discipline_subtypes.json
 * 
 * Outputs INSERT statements for disciplines and discipline_subtypes tables
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface SubtypeData {
  id: string;
  name: string;
  subtype_code: string;
  description: string | null;
  discipline_id: string;
  discipline_code: string;
  discipline_name: string;
  is_active: boolean;
  guidance?: {
    overview?: string;
    indicators_of_risk?: string[];
    common_failures?: string[];
    assessment_questions?: string[];
    mitigation_guidance?: string[];
    standards_references?: string[];
    psa_notes?: string;
  };
}

interface ArchiveData {
  metadata: {
    version: string;
    total_subtypes: number;
    generated_at: string;
    authority: string;
  };
  subtypes: SubtypeData[];
}

function escapeSqlString(str: string | null | undefined): string {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

function escapeSqlArray(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return 'NULL';
  return `ARRAY[${arr.map(s => escapeSqlString(s)).join(', ')}]`;
}

function main() {
  const jsonPath = join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
  const data: ArchiveData = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  // Extract unique disciplines
  const disciplineMap = new Map<string, { id: string; name: string; code: string }>();
  data.subtypes.forEach(subtype => {
    if (!disciplineMap.has(subtype.discipline_id)) {
      disciplineMap.set(subtype.discipline_id, {
        id: subtype.discipline_id,
        name: subtype.discipline_name,
        code: subtype.discipline_code
      });
    }
  });

  const disciplines = Array.from(disciplineMap.values()).sort((a, b) => a.code.localeCompare(b.code));

  console.log('-- Seed: disciplines');
  console.log('INSERT INTO public.disciplines (id, name, description, category, is_active, created_at, updated_at, code) VALUES');
  
  const disciplineValues = disciplines.map((d, idx) => {
    const description = d.name.includes('&') ? `${d.name} capabilities` : null;
    return `(${escapeSqlString(d.id)}, ${escapeSqlString(d.name)}, ${escapeSqlString(description)}, 'Physical', true, now(), now(), ${escapeSqlString(d.code)})`;
  });
  
  console.log(disciplineValues.join(',\n'));
  console.log('ON CONFLICT (id) DO NOTHING;');
  console.log('');

  console.log('-- Seed: discipline_subtypes');
  console.log('INSERT INTO public.discipline_subtypes (');
  console.log('  id, discipline_id, name, description, code, is_active, created_at, updated_at,');
  console.log('  overview, indicators_of_risk, common_failures, assessment_questions,');
  console.log('  mitigation_guidance, standards_references, psa_notes');
  console.log(') VALUES');

  const subtypeValues = data.subtypes.map((subtype, idx) => {
    const guidance = subtype.guidance || {};
    const values = [
      escapeSqlString(subtype.id),
      escapeSqlString(subtype.discipline_id),
      escapeSqlString(subtype.name),
      escapeSqlString(subtype.description),
      escapeSqlString(subtype.subtype_code),
      subtype.is_active ? 'true' : 'false',
      'now()',
      'now()',
      escapeSqlString(guidance.overview),
      escapeSqlArray(guidance.indicators_of_risk),
      escapeSqlArray(guidance.common_failures),
      escapeSqlArray(guidance.assessment_questions),
      escapeSqlArray(guidance.mitigation_guidance),
      escapeSqlArray(guidance.standards_references),
      escapeSqlString(guidance.psa_notes)
    ];
    return `(${values.join(', ')})`;
  });

  console.log(subtypeValues.join(',\n'));
  console.log('ON CONFLICT (id) DO NOTHING;');
}

main();
