/**
 * Build Subtype Interaction Map and Discipline Capability Manifests
 * 
 * Deterministically tags subtypes with interaction types and builds capability manifests.
 * 
 * OUTPUTS:
 * - tools/outputs/subtype_interaction_map.v1.json
 * - tools/outputs/discipline_capability_manifests.v1.json
 * - tools/outputs/subtype_interaction_review.v1.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables
dotenv.config();

// Input file paths
const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
const BASELINE_SPINES_FILE = path.join(process.cwd(), 'baseline_spines_runtime_rows.json');
const BASELINE_SPINES_FALLBACK_1 = path.join(process.cwd(), 'tools', 'outputs', 'baseline_subtype_v1.json');
const BASELINE_SPINES_FALLBACK_2 = path.join(process.cwd(), 'psa_engine', 'doctrine', 'baseline_canon', 'baseline_spines.v1.json');
const DEPTH2_QUESTIONS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'baseline_depth2_questions.json');

// Output file paths
const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const INTERACTION_MAP_FILE = path.join(OUTPUT_DIR, 'subtype_interaction_map.v1.json');
const CAPABILITY_MANIFESTS_FILE = path.join(OUTPUT_DIR, 'discipline_capability_manifests.v1.json');
const REVIEW_FILE = path.join(OUTPUT_DIR, 'subtype_interaction_review.v1.md');

// Capability selector disciplines (from config)
const CAPABILITY_SELECTOR_DISCIPLINES = new Set(['ACS', 'VSS', 'IDS', 'COM']);

interface TaxonomySubtype {
  subtype_code: string;
  name: string;
  discipline_code: string;
  discipline_name: string;
}

interface BaselineSpine {
  canon_id: string;
  discipline_code: string;
  subtype_code: string | null;
  question_text: string;
}

interface Depth2Question {
  subtype_code: string;
  discipline_code: string;
  parent_spine_canon_id?: string;
}

interface SubtypeInteraction {
  subtype_code: string;
  discipline_code: string;
  subtype_name: string;
  has_spine: boolean;
  spine_canon_id: string | null;
  spine_question_text: string | null;
  interaction_type: 'CAPABILITY_SELECTOR' | 'BASELINE_SPINE' | 'NONE';
  conditional_evaluation: boolean;
  depth2_count: number;
}

interface CapabilityManifest {
  capability_id: string;
  subtype_code: string;
  label: string;
  description: string | null;
  spine_canon_id: string;
  conditional_evaluation: boolean;
}

interface DisciplineManifest {
  discipline_code: string;
  title: string;
  capabilities: CapabilityManifest[];
}

/**
 * Load taxonomy subtypes
 */
function loadTaxonomy(): Map<string, TaxonomySubtype> {
  if (!fs.existsSync(TAXONOMY_FILE)) {
    throw new Error(`Taxonomy file not found: ${TAXONOMY_FILE}`);
  }

  const content = fs.readFileSync(TAXONOMY_FILE, 'utf-8');
  const data = JSON.parse(content);
  const subtypes = data.subtypes || [];

  const map = new Map<string, TaxonomySubtype>();
  const seenCodes = new Set<string>();

  for (const subtype of subtypes) {
    if (!subtype.subtype_code) continue;

    // Hard fail on duplicate subtype_code
    if (seenCodes.has(subtype.subtype_code)) {
      throw new Error(`Duplicate subtype_code in taxonomy: ${subtype.subtype_code}`);
    }
    seenCodes.add(subtype.subtype_code);

    map.set(subtype.subtype_code, {
      subtype_code: subtype.subtype_code,
      name: subtype.name || subtype.subtype_code.replace(/_/g, ' '),
      discipline_code: subtype.discipline_code || '',
      discipline_name: subtype.discipline_name || subtype.discipline_code || '',
    });
  }

  return map;
}

/**
 * Load baseline spines from file or database
 */
async function loadBaselineSpines(): Promise<BaselineSpine[]> {
  // Try primary file first
  if (fs.existsSync(BASELINE_SPINES_FILE)) {
    console.log(`[INFO] Loading baseline spines from file: ${BASELINE_SPINES_FILE}`);
    const content = fs.readFileSync(BASELINE_SPINES_FILE, 'utf-8');
    const data = JSON.parse(content);
    
    let spines: any[] = [];
    if (Array.isArray(data)) {
      spines = data;
    } else if (data.rows && Array.isArray(data.rows)) {
      spines = data.rows;
    } else if (data.spines && Array.isArray(data.spines)) {
      spines = data.spines;
    }

    return spines.map((s: any) => ({
      canon_id: s.canon_id,
      discipline_code: s.discipline_code || '',
      subtype_code: s.subtype_code || null,
      question_text: s.question_text || '',
    }));
  }

  // Try fallback file 1 (baseline_subtype_v1.json - has subtype spines)
  if (fs.existsSync(BASELINE_SPINES_FALLBACK_1)) {
    console.log(`[INFO] Loading baseline spines from fallback file: ${BASELINE_SPINES_FALLBACK_1}`);
    const content = fs.readFileSync(BASELINE_SPINES_FALLBACK_1, 'utf-8');
    const data = JSON.parse(content);
    
    let spines: any[] = [];
    if (Array.isArray(data)) {
      spines = data;
    } else if (data.spines && Array.isArray(data.spines)) {
      spines = data.spines;
    }

    return spines.map((s: any) => ({
      canon_id: s.canon_id,
      discipline_code: s.discipline_code || '',
      subtype_code: s.subtype_code || null,
      question_text: s.question_text || '',
    }));
  }

  // Try fallback file 2 (baseline_spines.v1.json - discipline-level only)
  if (fs.existsSync(BASELINE_SPINES_FALLBACK_2)) {
    console.log(`[INFO] Loading baseline spines from fallback file: ${BASELINE_SPINES_FALLBACK_2}`);
    const content = fs.readFileSync(BASELINE_SPINES_FALLBACK_2, 'utf-8');
    const data = JSON.parse(content);
    
    let spines: any[] = [];
    if (Array.isArray(data)) {
      spines = data;
    } else if (data.spines && Array.isArray(data.spines)) {
      spines = data.spines;
    }

    return spines.map((s: any) => ({
      canon_id: s.canon_id,
      discipline_code: s.discipline_code || '',
      subtype_code: s.subtype_code || null,
      question_text: s.question_text || '',
    }));
  }

  // Fall back to database
  console.log(`[INFO] Baseline spine files not found, loading from database...`);
  try {
    const pool = await ensureRuntimePoolConnected();
    
    const query = `
      SELECT 
        canon_id,
        discipline_code,
        subtype_code,
        question_text
      FROM baseline_spines_runtime
      WHERE active = true
      ORDER BY discipline_code ASC, canon_id ASC
    `;

    const result = await pool.query(query);
    await pool.end();

    return result.rows.map((row: any) => ({
      canon_id: row.canon_id,
      discipline_code: row.discipline_code || '',
      subtype_code: row.subtype_code || null,
      question_text: row.question_text || '',
    }));
  } catch (dbError) {
    throw new Error(
      `Cannot load baseline spines: files not found (${BASELINE_SPINES_FILE}, ${BASELINE_SPINES_FALLBACK_1}, ${BASELINE_SPINES_FALLBACK_2}) ` +
      `and database connection failed. Error: ${dbError instanceof Error ? dbError.message : String(dbError)}`
    );
  }
}

/**
 * Load depth-2 questions
 */
function loadDepth2Questions(): Depth2Question[] {
  if (!fs.existsSync(DEPTH2_QUESTIONS_FILE)) {
    return [];
  }

  const content = fs.readFileSync(DEPTH2_QUESTIONS_FILE, 'utf-8');
  const data = JSON.parse(content);
  const questions = data.questions || [];

  return questions.map((q: any) => ({
    subtype_code: q.subtype_code || '',
    discipline_code: q.discipline_code || '',
    parent_spine_canon_id: q.parent_spine_canon_id,
  }));
}

/**
 * Determine if a spine matches CAPABILITY_SELECTOR pattern
 */
function isCapabilitySelectorSpine(canonId: string, questionText: string): boolean {
  // Pattern 1: canon_id matches BASE-[DISCIPLINE]-[SUBTYPE_CODE] pattern
  // Example: BASE-ACS-ACS_BIOMETRIC_ACCESS
  const canonPattern = /^BASE-[A-Z]+-[A-Z]+_.+$/;
  if (canonPattern.test(canonId)) {
    return true;
  }

  // Pattern 2: question_text matches "Is a/an/the ... capability implemented?"
  // Example: "Is a biometric access capability implemented?"
  const questionPattern = /^Is (an?|the) .+ capability implemented\?$/i;
  if (questionPattern.test(questionText.trim())) {
    return true;
  }

  return false;
}

/**
 * Build subtype interaction map
 */
async function buildInteractionMap(
  taxonomy: Map<string, TaxonomySubtype>,
  spines: BaselineSpine[],
  depth2Questions: Depth2Question[]
): Promise<Map<string, SubtypeInteraction>> {
  // Index spines by subtype_code
  const spinesBySubtype = new Map<string, BaselineSpine>();
  const disciplineLevelSpines: BaselineSpine[] = [];

  for (const spine of spines) {
    if (!spine.subtype_code) {
      disciplineLevelSpines.push(spine);
      continue;
    }
    
    // If multiple spines for same subtype, keep the first (deterministic)
    if (!spinesBySubtype.has(spine.subtype_code)) {
      spinesBySubtype.set(spine.subtype_code, spine);
    }
  }

  // Count depth-2 questions per subtype
  const depth2CountBySubtype = new Map<string, number>();
  for (const d2q of depth2Questions) {
    if (d2q.subtype_code) {
      const count = depth2CountBySubtype.get(d2q.subtype_code) || 0;
      depth2CountBySubtype.set(d2q.subtype_code, count + 1);
    }
  }

  // Build interaction map for all subtypes in taxonomy
  const interactionMap = new Map<string, SubtypeInteraction>();
  const seenCodes = new Set<string>();

  for (const [subtypeCode, subtypeInfo] of taxonomy.entries()) {
    // Hard fail on duplicate in output
    if (seenCodes.has(subtypeCode)) {
      throw new Error(`Duplicate subtype_code in output: ${subtypeCode}`);
    }
    seenCodes.add(subtypeCode);

    const spine = spinesBySubtype.get(subtypeCode);
    const hasSpine = !!spine;
    const depth2Count = depth2CountBySubtype.get(subtypeCode) || 0;
    const hasDepth2 = depth2Count > 0;

    let interactionType: 'CAPABILITY_SELECTOR' | 'BASELINE_SPINE' | 'NONE';
    
    if (!hasSpine) {
      interactionType = 'NONE';
    } else if (isCapabilitySelectorSpine(spine.canon_id, spine.question_text)) {
      interactionType = 'CAPABILITY_SELECTOR';
    } else {
      interactionType = 'BASELINE_SPINE';
    }

    // Hard fail if CAPABILITY_SELECTOR but no spine
    if (interactionType === 'CAPABILITY_SELECTOR' && !hasSpine) {
      throw new Error(`Subtype ${subtypeCode} tagged CAPABILITY_SELECTOR but has_spine=false`);
    }

    interactionMap.set(subtypeCode, {
      subtype_code: subtypeCode,
      discipline_code: subtypeInfo.discipline_code,
      subtype_name: subtypeInfo.name,
      has_spine: hasSpine,
      spine_canon_id: spine?.canon_id || null,
      spine_question_text: spine?.question_text || null,
      interaction_type: interactionType,
      conditional_evaluation: hasDepth2,
      depth2_count: depth2Count,
    });
  }

  return interactionMap;
}

/**
 * Build discipline capability manifests
 */
function buildCapabilityManifests(
  taxonomy: Map<string, TaxonomySubtype>,
  interactionMap: Map<string, SubtypeInteraction>
): DisciplineManifest[] {
  // Group subtypes by discipline
  const subtypesByDiscipline = new Map<string, SubtypeInteraction[]>();

  for (const interaction of interactionMap.values()) {
    if (interaction.interaction_type !== 'CAPABILITY_SELECTOR') {
      continue;
    }

    const disciplineCode = interaction.discipline_code;
    if (!subtypesByDiscipline.has(disciplineCode)) {
      subtypesByDiscipline.set(disciplineCode, []);
    }
    subtypesByDiscipline.get(disciplineCode)!.push(interaction);
  }

  // Build manifests
  const manifests: DisciplineManifest[] = [];

  for (const [disciplineCode, interactions] of subtypesByDiscipline.entries()) {
    // Get discipline name from first subtype
    const firstSubtype = taxonomy.get(interactions[0].subtype_code);
    const disciplineName = firstSubtype?.discipline_name || disciplineCode;

    // Build capabilities
    const capabilities: CapabilityManifest[] = interactions
      .map((interaction) => {
        const capabilityId = `CAP-${interaction.discipline_code}-${interaction.subtype_code}`;
        
        return {
          capability_id: capabilityId,
          subtype_code: interaction.subtype_code,
          label: interaction.subtype_name,
          description: null, // Can be enhanced later
          spine_canon_id: interaction.spine_canon_id!,
          conditional_evaluation: interaction.conditional_evaluation,
        };
      })
      .sort((a, b) => {
        // Sort by subtype_name, then subtype_code
        const nameCompare = a.label.localeCompare(b.label);
        if (nameCompare !== 0) return nameCompare;
        return a.subtype_code.localeCompare(b.subtype_code);
      });

    manifests.push({
      discipline_code: disciplineCode,
      title: disciplineName,
      capabilities,
    });
  }

  // Sort disciplines by discipline_code
  manifests.sort((a, b) => a.discipline_code.localeCompare(b.discipline_code));

  // Validate: ensure all capability manifest subtypes exist in taxonomy
  for (const manifest of manifests) {
    for (const capability of manifest.capabilities) {
      if (!taxonomy.has(capability.subtype_code)) {
        throw new Error(
          `Capability manifest references subtype_code not in taxonomy: ${capability.subtype_code}`
        );
      }
    }
  }

  return manifests;
}

/**
 * Generate review markdown
 */
function generateReviewMarkdown(
  interactionMap: Map<string, SubtypeInteraction>,
  manifests: DisciplineManifest[]
): string {
  const interactions = Array.from(interactionMap.values())
    .sort((a, b) => {
      const discCompare = a.discipline_code.localeCompare(b.discipline_code);
      if (discCompare !== 0) return discCompare;
      return a.subtype_code.localeCompare(b.subtype_code);
    });

  let md = `# Subtype Interaction Review\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;

  // Summary table
  md += `## Summary by Discipline\n\n`;
  md += `| Discipline | Total Subtypes | Has Spine | Capability Selector | Conditional Eval |\n`;
  md += `|------------|----------------|-----------|---------------------|-------------------|\n`;

  const disciplineStats = new Map<string, {
    total: number;
    hasSpine: number;
    capabilitySelector: number;
    conditionalEval: number;
  }>();

  for (const interaction of interactions) {
    const disc = interaction.discipline_code;
    if (!disciplineStats.has(disc)) {
      disciplineStats.set(disc, { total: 0, hasSpine: 0, capabilitySelector: 0, conditionalEval: 0 });
    }
    const stats = disciplineStats.get(disc)!;
    stats.total++;
    if (interaction.has_spine) stats.hasSpine++;
    if (interaction.interaction_type === 'CAPABILITY_SELECTOR') stats.capabilitySelector++;
    if (interaction.conditional_evaluation) stats.conditionalEval++;
  }

  for (const [disc, stats] of Array.from(disciplineStats.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `| ${disc} | ${stats.total} | ${stats.hasSpine} | ${stats.capabilitySelector} | ${stats.conditionalEval} |\n`;
  }

  md += `\n## Detailed Subtype Map\n\n`;
  md += `| Discipline | Subtype Code | Subtype Name | Has Spine | Interaction Type | Conditional Eval | Depth2 Count | Spine Canon ID |\n`;
  md += `|------------|--------------|--------------|-----------|------------------|-------------------|-------------|----------------|\n`;

  for (const interaction of interactions) {
    md += `| ${interaction.discipline_code} | ${interaction.subtype_code} | ${interaction.subtype_name} | ${interaction.has_spine} | ${interaction.interaction_type} | ${interaction.conditional_evaluation} | ${interaction.depth2_count} | ${interaction.spine_canon_id || 'N/A'} |\n`;
  }

  md += `\n## Capability Manifests Summary\n\n`;
  for (const manifest of manifests) {
    md += `### ${manifest.title} (${manifest.discipline_code})\n\n`;
    md += `- Total capabilities: ${manifest.capabilities.length}\n`;
    md += `- Capabilities:\n`;
    for (const cap of manifest.capabilities) {
      md += `  - ${cap.label} (${cap.subtype_code}) - ${cap.capability_id}\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('[INFO] Building subtype interaction map and capability manifests...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load inputs
  console.log('[INFO] Loading taxonomy...');
  const taxonomy = loadTaxonomy();
  console.log(`[OK] Loaded ${taxonomy.size} subtypes from taxonomy`);

  console.log('[INFO] Loading baseline spines...');
  const spines = await loadBaselineSpines();
  console.log(`[OK] Loaded ${spines.length} baseline spines`);

  console.log('[INFO] Loading depth-2 questions...');
  const depth2Questions = loadDepth2Questions();
  console.log(`[OK] Loaded ${depth2Questions.length} depth-2 questions`);

  // Build interaction map
  console.log('[INFO] Building interaction map...');
  const interactionMap = await buildInteractionMap(taxonomy, spines, depth2Questions);
  console.log(`[OK] Built interaction map for ${interactionMap.size} subtypes`);

  // Build capability manifests
  console.log('[INFO] Building capability manifests...');
  const manifests = buildCapabilityManifests(taxonomy, interactionMap);
  console.log(`[OK] Built manifests for ${manifests.length} disciplines`);

  // Validation warnings
  for (const manifest of manifests) {
    if (CAPABILITY_SELECTOR_DISCIPLINES.has(manifest.discipline_code)) {
      if (manifest.capabilities.length === 0) {
        console.warn(`[WARN] Discipline ${manifest.discipline_code} is in CAPABILITY_SELECTOR_DISCIPLINES but has 0 capabilities`);
      }
    }
  }

  // Write outputs
  console.log('[INFO] Writing outputs...');

  // subtype_interaction_map.v1.json
  const interactionMapArray = Array.from(interactionMap.values())
    .sort((a, b) => {
      const discCompare = a.discipline_code.localeCompare(b.discipline_code);
      if (discCompare !== 0) return discCompare;
      return a.subtype_code.localeCompare(b.subtype_code);
    });

  const interactionMapOutput = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    total_subtypes: interactionMapArray.length,
    subtypes: interactionMapArray,
  };

  fs.writeFileSync(
    INTERACTION_MAP_FILE,
    JSON.stringify(interactionMapOutput, null, 2) + '\n',
    'utf-8'
  );
  console.log(`[OK] Wrote ${INTERACTION_MAP_FILE}`);

  // discipline_capability_manifests.v1.json
  const manifestsOutput = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    total_disciplines: manifests.length,
    disciplines: manifests,
  };

  fs.writeFileSync(
    CAPABILITY_MANIFESTS_FILE,
    JSON.stringify(manifestsOutput, null, 2) + '\n',
    'utf-8'
  );
  console.log(`[OK] Wrote ${CAPABILITY_MANIFESTS_FILE}`);

  // subtype_interaction_review.v1.md
  const reviewMarkdown = generateReviewMarkdown(interactionMap, manifests);
  fs.writeFileSync(REVIEW_FILE, reviewMarkdown, 'utf-8');
  console.log(`[OK] Wrote ${REVIEW_FILE}`);

  console.log('\n[OK] All outputs generated successfully!');
}

// Run
main().catch((error) => {
  console.error('[ERROR]', error);
  process.exit(1);
});
