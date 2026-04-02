/**
 * Tag Depth-2 Questions
 * 
 * Tags depth-2 questions with capability tags based on deterministic keyword matching.
 * Tags determine which questions appear when checklist items are selected.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Depth2QuestionTagsFile } from '../app/lib/types/checklist';
import { getChecklistTemplate, TECHNOLOGY_HEAVY_DISCIPLINES, TECHNOLOGY_HEAVY_SUBTYPES } from './generate_subtype_checklists';

const DEPTH2_QUESTIONS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'baseline_depth2_questions.json');
const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'depth2_question_tags.v1.json');

interface Depth2Question {
  question_code: string;
  canon_id?: string;
  subtype_code: string;
  discipline_code: string;
  question_text: string;
}

interface Depth2QuestionsFile {
  questions: Depth2Question[];
}

/**
 * Keyword-to-tag mapping (deterministic, case-insensitive)
 */
const KEYWORD_TAG_MAP: Array<{ keywords: string[]; tag: string }> = [
  {
    keywords: ['modality', 'modalities', 'fingerprint', 'facial', 'iris', 'voice', 'biometric type'],
    tag: 'BIOMETRIC_MODALITIES',
  },
  {
    keywords: ['enroll', 'enrollment', 'enrolling', 'enrolled'],
    tag: 'BIOMETRIC_ENROLLMENT',
  },
  {
    keywords: ['backup', 'override', 'outage', 'failure', 'fail', 'alternative', 'fallback'],
    tag: 'BACKUP_METHOD',
  },
  {
    keywords: ['store', 'stored', 'retain', 'retention', 'privacy', 'data handling', 'biometric data'],
    tag: 'HANDLING_POLICY',
  },
  {
    keywords: ['reader', 'sensor', 'clean', 'calibrate', 'calibration', 'maintenance', 'upkeep', 'device'],
    tag: 'DEVICE_USABILITY_METHOD',
  },
  {
    keywords: ['paging', 'override', 'emergency', 'priority'],
    tag: 'COM_OVERRIDE_PRIORITY',
  },
  {
    keywords: ['radio', 'radios', 'channel', 'channels', 'interoperable', 'interoperability', 'frequency'],
    tag: 'COM_INTEROP_METHOD',
  },
  // COM discipline-level tags (for discipline checklist)
  {
    keywords: ['radio', 'radios', 'two-way', 'two way', 'interoperable', 'interoperability', 'protocol', 'protocols', 'backup', 'communication'],
    tag: 'OPERATIONAL_COMMS',
  },
  {
    keywords: ['pa system', 'public address', 'paging', 'paging system', 'occupant', 'notification', 'alert', 'announcement'],
    tag: 'OCCUPANT_NOTIFICATION',
  },
  {
    keywords: ['recording', 'record', 'retain', 'retention', 'export', 'retrieval', 'footage', 'video'],
    tag: 'VSS_RECORDING_HANDLING',
  },
  {
    keywords: ['storage', 'capacity', 'planning', 'nvr', 'dvr'],
    tag: 'VSS_STORAGE_PLANNING',
  },
  {
    keywords: ['alarm', 'monitor', 'monitoring', 'dispatch', 'notify', 'notification', 'escalation', 'response'],
    tag: 'IDS_MONITORING_ESCALATION',
  },
  {
    keywords: ['credential', 'issuance', 'issue', 'terminate', 'termination', 'badge'],
    tag: 'CREDENTIAL_ISSUANCE',
  },
  {
    keywords: ['door', 'hardware', 'strike', 'mag lock', 'integration'],
    tag: 'DOOR_INTEGRATION',
  },
  {
    keywords: ['visitor', 'temporary', 'guest'],
    tag: 'VISITOR_HANDLING',
  },
  {
    keywords: ['perimeter', 'fence', 'fencing', 'gate', 'barrier', 'lighting'],
    tag: 'PER_MAINTENANCE',
  },
  {
    keywords: ['key', 'keys', 'issuance', 'return', 'assignment'],
    tag: 'KEY_ISSUANCE',
  },
  {
    keywords: ['track', 'tracking', 'location', 'assignment'],
    tag: 'KEY_TRACKING',
  },
];

/**
 * Extract tags from question text
 */
function extractTags(questionText: string): string[] {
  const text = questionText.toLowerCase();
  const tags = new Set<string>();

  for (const mapping of KEYWORD_TAG_MAP) {
    for (const keyword of mapping.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        tags.add(mapping.tag);
        break; // Only add tag once per mapping
      }
    }
  }

  return Array.from(tags).sort();
}

/**
 * Main function
 */
function main(): void {
  console.log('[INFO] Tagging depth-2 questions...\n');

  // Load depth-2 questions
  if (!fs.existsSync(DEPTH2_QUESTIONS_FILE)) {
    console.error(`[ERROR] Depth-2 questions file not found: ${DEPTH2_QUESTIONS_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(DEPTH2_QUESTIONS_FILE, 'utf-8');
  const data: Depth2QuestionsFile = JSON.parse(content);
  const questions = data.questions || [];

  console.log(`[INFO] Loaded ${questions.length} depth-2 questions`);

  // Load checklists to determine which subtypes should have tags
  const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
  const taxonomyContent = fs.readFileSync(TAXONOMY_FILE, 'utf-8');
  const taxonomyData: any = JSON.parse(taxonomyContent);
  const subtypes = taxonomyData.subtypes || [];

  // Build map of subtypes that have checklists
  const subtypesWithChecklists = new Set<string>();
  for (const subtype of subtypes) {
    const items = getChecklistTemplate(subtype.subtype_code, subtype.name);
    if (items.length > 0) {
      subtypesWithChecklists.add(subtype.subtype_code);
    }
  }

  console.log(`[INFO] Found ${subtypesWithChecklists.size} subtypes with checklists`);

  // Tag questions
  const taggedQuestions: Array<{
    canon_id: string;
    subtype_code: string;
    discipline_code: string;
    tags: string[];
  }> = [];

  const questionsBySubtype = new Map<string, Depth2Question[]>();
  for (const question of questions) {
    const subtypeCode = question.subtype_code;
    if (!questionsBySubtype.has(subtypeCode)) {
      questionsBySubtype.set(subtypeCode, []);
    }
    questionsBySubtype.get(subtypeCode)!.push(question);
  }

  for (const question of questions) {
    const canonId = question.question_code || question.canon_id || '';
    if (!canonId) {
      console.error(`[ERROR] Question missing canon_id: ${JSON.stringify(question)}`);
      process.exit(1);
    }

    let tags = extractTags(question.question_text);

    // For COM discipline: add discipline-level tags based on subtype
    if (question.discipline_code === 'COM') {
      const subtypeCode = question.subtype_code;
      // Map COM subtypes to discipline-level tags
      if (subtypeCode === 'COM_RADIOS_TWO_WAY' || 
          subtypeCode === 'COM_INTEROPERABLE_COMMUNICATIONS' ||
          subtypeCode === 'COM_COMMUNICATION_PROTOCOLS' ||
          subtypeCode === 'COM_BACKUP_COMMUNICATIONS') {
        if (!tags.includes('OPERATIONAL_COMMS')) {
          tags.push('OPERATIONAL_COMMS');
        }
      } else if (subtypeCode === 'COM_PA_SYSTEMS' || 
                 subtypeCode === 'COM_PAGING_SYSTEMS') {
        if (!tags.includes('OCCUPANT_NOTIFICATION')) {
          tags.push('OCCUPANT_NOTIFICATION');
        }
      }
    }

    // Validation: if subtype has checklist, question must have at least 1 tag
    if (subtypesWithChecklists.has(question.subtype_code) && tags.length === 0) {
      console.error(`[ERROR] Depth-2 question ${canonId} (subtype ${question.subtype_code}) has no tags but subtype has checklist`);
      console.error(`  Question text: "${question.question_text}"`);
      process.exit(1);
    }

    taggedQuestions.push({
      canon_id: canonId,
      subtype_code: question.subtype_code,
      discipline_code: question.discipline_code,
      tags: tags,
    });
  }

  // Create output file
  const output: Depth2QuestionTagsFile = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    questions: taggedQuestions.sort((a, b) => a.canon_id.localeCompare(b.canon_id)),
  };

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2) + '\n');
  console.log(`[INFO] Wrote ${taggedQuestions.length} tagged questions to ${OUTPUT_JSON}`);

  // Summary
  const questionsWithTags = taggedQuestions.filter(q => q.tags.length > 0).length;
  const questionsWithoutTags = taggedQuestions.filter(q => q.tags.length === 0).length;
  
  console.log('');
  console.log(`[INFO] Summary:`);
  console.log(`  - Total questions: ${taggedQuestions.length}`);
  console.log(`  - Questions with tags: ${questionsWithTags}`);
  console.log(`  - Questions without tags: ${questionsWithoutTags}`);
  console.log(`  - Subtypes with checklists: ${subtypesWithChecklists.size}`);
  console.log('');
  console.log('[INFO] Depth-2 question tagging complete!');
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { extractTags, KEYWORD_TAG_MAP };
