/**
 * Generate Questions by Discipline and Subtype Document
 * 
 * Creates a comprehensive markdown document listing all questions
 * organized by discipline and subtype.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables
dotenv.config({ path: '.env.local' });

const DEPTH2_QUESTIONS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'baseline_depth2_questions.json');
const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'questions_by_discipline_subtype.md');

interface BaselineSpine {
  canon_id: string;
  question_text: string;
  discipline_code: string;
  subtype_code: string | null;
  depth?: number;
}

interface Depth2Question {
  question_code: string;
  canon_id?: string;
  question_text: string;
  discipline_code: string;
  subtype_code: string;
  parent_spine_canon_id: string;
  depth?: number;
}

interface TaxonomySubtype {
  subtype_code: string;
  name: string;
  discipline_code: string;
  discipline_name: string;
}

interface TaxonomyData {
  subtypes?: TaxonomySubtype[];
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('[INFO] Generating questions by discipline and subtype document...\n');

  // Load taxonomy for discipline/subtype names
  if (!fs.existsSync(TAXONOMY_FILE)) {
    console.error(`[ERROR] Taxonomy file not found: ${TAXONOMY_FILE}`);
    process.exit(1);
  }
  const taxonomyContent = fs.readFileSync(TAXONOMY_FILE, 'utf-8');
  const taxonomyData: TaxonomyData = JSON.parse(taxonomyContent);
  const subtypes = taxonomyData.subtypes || [];

  // Build lookup maps
  const subtypeMap = new Map<string, TaxonomySubtype>();
  const disciplineMap = new Map<string, string>();
  for (const subtype of subtypes) {
    subtypeMap.set(subtype.subtype_code, subtype);
    if (!disciplineMap.has(subtype.discipline_code)) {
      disciplineMap.set(subtype.discipline_code, subtype.discipline_name);
    }
  }

  // Load baseline spines (depth-1) from database
  console.log('[INFO] Loading baseline spines from database...');
  let baselineSpines: BaselineSpine[] = [];
  try {
    const pool = await ensureRuntimePoolConnected();
    const query = `
      SELECT 
        canon_id, 
        discipline_code, 
        subtype_code, 
        question_text, 
        response_enum, 
        canon_version, 
        canon_hash
      FROM baseline_spines_runtime
      WHERE active = true
      ORDER BY discipline_code ASC, canon_id ASC
    `;
    const result = await pool.query(query);
    
    // Normalize response_enum
    baselineSpines = result.rows.map((row: any) => {
      let responseEnum = row.response_enum;
      if (typeof responseEnum === 'string') {
        try {
          responseEnum = JSON.parse(responseEnum);
        } catch {
          responseEnum = ["YES", "NO", "N_A"];
        }
      }
      if (!Array.isArray(responseEnum) || responseEnum.length !== 3) {
        responseEnum = ["YES", "NO", "N_A"];
      }
      
      return {
        canon_id: row.canon_id,
        question_text: row.question_text,
        discipline_code: row.discipline_code,
        subtype_code: row.subtype_code,
        depth: 1,
      };
    });
    
    await pool.end();
  } catch (error) {
    console.error(`[ERROR] Failed to load baseline spines from database: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Load depth-2 questions
  let depth2Questions: Depth2Question[] = [];
  if (fs.existsSync(DEPTH2_QUESTIONS_FILE)) {
    const depth2Content = fs.readFileSync(DEPTH2_QUESTIONS_FILE, 'utf-8');
    const depth2Data: any = JSON.parse(depth2Content);
    depth2Questions = depth2Data.questions || [];
  }

  console.log(`[INFO] Loaded ${baselineSpines.length} baseline spines`);
  console.log(`[INFO] Loaded ${depth2Questions.length} depth-2 questions`);

  // Group questions by discipline -> subtype
  const questionsByDiscipline = new Map<string, Map<string, {
    spine: BaselineSpine | null;
    depth2: Depth2Question[];
  }>>();

  // Process baseline spines (depth-1)
  for (const spine of baselineSpines) {
    const disciplineCode = spine.discipline_code || 'UNKNOWN';
    const subtypeCode = spine.subtype_code || 'DIScipline_LEVEL';
    
    if (!questionsByDiscipline.has(disciplineCode)) {
      questionsByDiscipline.set(disciplineCode, new Map());
    }
    const subtypeMap = questionsByDiscipline.get(disciplineCode)!;
    
    if (!subtypeMap.has(subtypeCode)) {
      subtypeMap.set(subtypeCode, { spine: null, depth2: [] });
    }
    
    subtypeMap.get(subtypeCode)!.spine = spine;
  }

  // Process depth-2 questions
  for (const d2q of depth2Questions) {
    const disciplineCode = d2q.discipline_code || 'UNKNOWN';
    const subtypeCode = d2q.subtype_code || 'UNKNOWN';
    
    if (!questionsByDiscipline.has(disciplineCode)) {
      questionsByDiscipline.set(disciplineCode, new Map());
    }
    const subtypeMap = questionsByDiscipline.get(disciplineCode)!;
    
    if (!subtypeMap.has(subtypeCode)) {
      subtypeMap.set(subtypeCode, { spine: null, depth2: [] });
    }
    
    subtypeMap.get(subtypeCode)!.depth2.push(d2q);
  }

  // Generate markdown document
  let md = '# Questions by Discipline and Subtype\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `Total Disciplines: ${questionsByDiscipline.size}\n`;
  md += `Total Baseline Questions (Depth-1): ${baselineSpines.length}\n`;
  md += `Total Depth-2 Questions: ${depth2Questions.length}\n\n`;
  md += '---\n\n';

  // Sort disciplines alphabetically
  const sortedDisciplines = Array.from(questionsByDiscipline.entries())
    .sort((a, b) => {
      const nameA = disciplineMap.get(a[0]) || a[0];
      const nameB = disciplineMap.get(b[0]) || b[0];
      return nameA.localeCompare(nameB);
    });

  for (const [disciplineCode, subtypeMap] of sortedDisciplines) {
    const disciplineName = disciplineMap.get(disciplineCode) || disciplineCode;
    
    md += `## ${disciplineName} (${disciplineCode})\n\n`;

    // Sort subtypes alphabetically
    const sortedSubtypes = Array.from(subtypeMap.entries())
      .sort((a, b) => {
        const nameA = subtypeMap.get(a[0])?.name || a[0];
        const nameB = subtypeMap.get(b[0])?.name || b[0];
        return nameA.localeCompare(nameB);
      });

    for (const [subtypeCode, questions] of sortedSubtypes) {
      const subtype = subtypeMap.get(subtypeCode);
      const subtypeName = subtype?.name || (subtypeCode === 'DIScipline_LEVEL' ? 'Discipline-Level' : subtypeCode);
      
      md += `### ${subtypeName} (${subtypeCode})\n\n`;

      // Depth-1 Spine Question
      if (questions.spine) {
        md += `#### Depth-1: Spine Question\n\n`;
        md += `**Canon ID:** \`${questions.spine.canon_id}\`\n\n`;
        md += `${questions.spine.question_text}\n\n`;
      } else {
        md += `*No spine question found for this subtype*\n\n`;
      }

      // Depth-2 Questions
      if (questions.depth2.length > 0) {
        md += `#### Depth-2: Follow-on Questions (${questions.depth2.length})\n\n`;
        
        // Sort depth-2 questions by canon_id
        const sortedDepth2 = [...questions.depth2].sort((a, b) => {
          const idA = a.question_code || a.canon_id || '';
          const idB = b.question_code || b.canon_id || '';
          return idA.localeCompare(idB);
        });

        for (let i = 0; i < sortedDepth2.length; i++) {
          const d2q = sortedDepth2[i];
          const canonId = d2q.question_code || d2q.canon_id || `D2-${i + 1}`;
          md += `${i + 1}. **\`${canonId}\`**\n`;
          md += `   ${d2q.question_text}\n\n`;
        }
      } else {
        md += `*No depth-2 questions for this subtype*\n\n`;
      }

      md += '---\n\n';
    }
  }

  // Summary statistics
  md += '## Summary Statistics\n\n';
  md += '### By Discipline\n\n';
  md += '| Discipline | Discipline Code | Subtypes | Depth-1 Questions | Depth-2 Questions | Total Questions |\n';
  md += '|------------|-----------------|----------|-------------------|-------------------|-----------------|\n';

  for (const [disciplineCode, subtypeMap] of sortedDisciplines) {
    const disciplineName = disciplineMap.get(disciplineCode) || disciplineCode;
    let totalDepth1 = 0;
    let totalDepth2 = 0;
    
    for (const questions of subtypeMap.values()) {
      if (questions.spine) totalDepth1++;
      totalDepth2 += questions.depth2.length;
    }
    
    md += `| ${disciplineName} | ${disciplineCode} | ${subtypeMap.size} | ${totalDepth1} | ${totalDepth2} | ${totalDepth1 + totalDepth2} |\n`;
  }

  md += '\n### By Subtype\n\n';
  md += '| Subtype | Subtype Code | Discipline | Depth-1 | Depth-2 | Total |\n';
  md += '|---------|--------------|------------|---------|---------|-------|\n';

  for (const [disciplineCode, subtypeMap] of sortedDisciplines) {
    const disciplineName = disciplineMap.get(disciplineCode) || disciplineCode;
    const sortedSubtypes = Array.from(subtypeMap.entries())
      .sort((a, b) => {
        const nameA = subtypeMap.get(a[0])?.name || a[0];
        const nameB = subtypeMap.get(b[0])?.name || b[0];
        return nameA.localeCompare(nameB);
      });

    for (const [subtypeCode, questions] of sortedSubtypes) {
      const subtype = subtypeMap.get(subtypeCode);
      const subtypeName = subtype?.name || (subtypeCode === 'DIScipline_LEVEL' ? 'Discipline-Level' : subtypeCode);
      const depth1Count = questions.spine ? 1 : 0;
      const depth2Count = questions.depth2.length;
      
      md += `| ${subtypeName} | ${subtypeCode} | ${disciplineName} | ${depth1Count} | ${depth2Count} | ${depth1Count + depth2Count} |\n`;
    }
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write markdown file
  fs.writeFileSync(OUTPUT_MD, md);
  console.log(`[INFO] Wrote document to ${OUTPUT_MD}`);

  console.log('');
  console.log('[INFO] Document generation complete!');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('[ERROR] Fatal error:', error);
    process.exit(1);
  });
}
