/**
 * Generate Intent Objects for Baseline Questions
 * 
 * Generates deterministic "intent objects" for baseline questions (Depth-1 spines + Depth-2 follow-ons)
 * using subtype guidance. Intent objects are read-only UI aids that explain WHAT the question is
 * asking, what counts as YES, what does not, and what evidence typically supports an answer.
 * 
 * DO NOT modify any questions - this is read-only generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables
dotenv.config({ path: '.env.local' });

const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
const BASELINE_SPINES_FILE = path.join(process.cwd(), 'baseline_spines_runtime_rows.json');
// Try multiple possible paths for depth2 questions
const DEPTH2_QUESTIONS_CANDIDATES = [
  path.join(process.cwd(), 'tools', 'outputs', 'baseline_depth2_questions.json'),
  path.join(process.cwd(), 'baseline_depth2_questions.json'),
  '/mnt/data/baseline_depth2_questions.json'
];

const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'intent_objects.v1.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'intent_objects.v1.md');

// Forbidden words for validation
const FORBIDDEN_WORDS = [
  'regulatory', 'cyber', 'data governance', 'vendor', 'product', 'cost', 'timeline',
  'regularly', 'adequate', 'effective', 'aligned', 'compliance', 'framework'
];

interface SubtypeGuidance {
  overview?: string;
  indicators_of_risk?: string[];
  common_failures?: string[];
  mitigation_guidance?: string[];
  standards_references?: string[];
  psa_notes?: string;
}

interface TaxonomySubtype {
  id: string;
  name: string;
  subtype_code: string;
  discipline_code: string;
  discipline_name: string;
  is_active: boolean;
  guidance?: SubtypeGuidance;
}

interface BaselineSpine {
  canon_id: string;
  discipline_code: string;
  subtype_code?: string | null;
  question_text: string;
  response_enum: ["YES", "NO", "N_A"];
  canon_version?: string;
  active?: boolean;
}

interface Depth2Question {
  question_code: string;
  parent_spine_canon_id: string;
  discipline_code: string;
  subtype_code: string;
  question_text: string;
  response_enum: ["YES", "NO", "N_A"];
  layer: string;
  depth: number;
  order_index: number;
}

interface IntentObject {
  canon_id: string;
  layer: string;
  depth: number;
  discipline_code: string;
  subtype_code: string;
  question_text: string;
  intent: string;
  what_counts_as_yes: string[];
  what_does_not_count: string[];
  typical_evidence: string[];
  field_tip: string;
  references: string[];
  source: {
    subtype_guidance_used: boolean;
    guidance_fields_used: string[];
  };
}

interface IntentObjectsOutput {
  version: string;
  generated_at: string;
  counts: {
    depth1: number;
    depth2: number;
    total: number;
  };
  questions: IntentObject[];
}

/**
 * Sanitize text to remove forbidden words/phrases
 */
function sanitizeText(text: string): string {
  let sanitized = text;
  
  // Replace forbidden words/phrases with alternatives
  // Use word boundaries and handle variations including plurals
  const replacements: [RegExp, string][] = [
    [/\binadequate(ly)?\b/gi, 'insufficient'],
    [/\badequate(ly)?\b/gi, 'sufficient'],
    [/\bineffectiveness\b/gi, 'non-functionality'],
    [/\bineffective(ly)?\b/gi, 'non-functional'],
    [/\beffectiveness\b/gi, 'functionality'],
    [/\beffective(ly)?\b/gi, 'functional'],
    [/\bmisaligned\b/gi, 'inconsistent'],
    [/\baligned\b/gi, 'consistent'],
    [/\bregularly\b/gi, 'periodically'],
    [/\bregulatory\b/gi, ''],
    [/\bcyber\b/gi, ''],
    [/\bdata governance\b/gi, ''],
    [/\bvendor\b/gi, ''],
    [/\bproduct\b/gi, ''],
    [/\bcost\b/gi, ''],
    [/\btimeline\b/gi, ''],
    [/\bnon-compliance\b/gi, 'non-conformance'],
    [/\bcompliance\b/gi, ''],
    [/\bframework\b/gi, ''],
    [/\bgovernance\b/gi, ''],
    [/\bprograms?\b/gi, 'systems'], // Handle both program and programs
    [/\bcapabilities\b/gi, ''],
    [/\bprocesses\b/gi, 'operations'], // Replace processes with operations
  ];
  
  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  
  // Clean up extra spaces and remove empty phrases
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  sanitized = sanitized.replace(/\s+,\s+/g, ', '); // Fix spacing around commas
  sanitized = sanitized.replace(/\s+\./g, '.'); // Fix spacing before periods
  
  return sanitized;
}

/**
 * Normalize whitespace in strings
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize array items (trim, dedupe case-insensitive, cap length)
 */
function normalizeArray(items: string[], maxLength: number): string[] {
  const normalized = items
    .map(item => normalizeWhitespace(item))
    .filter(item => item.length > 0)
    .map(item => item.toLowerCase())
    .filter((item, index, arr) => arr.indexOf(item) === index) // dedupe case-insensitive
    .slice(0, maxLength)
    .map(item => {
      // Restore original capitalization for first letter
      return item.charAt(0).toUpperCase() + item.slice(1);
    });
  return normalized;
}

/**
 * Convert mitigation guidance to condition statements
 */
function convertMitigationToConditions(mitigation: string[]): string[] {
  return mitigation
    .map(item => {
      let condition = sanitizeText(item.trim());
      
      // Skip if starts with question words
      if (/^(how|when|where|who|what|which)\s+/i.test(condition)) {
        return null;
      }
      
      // Convert action verbs to passive conditions
      // "Define X" -> "X is defined"
      // "Assign responsibility for X" -> "Responsibility for X is assigned"
      // "Implement X" -> "X is implemented"
      // "Maintain X" -> "X is maintained"
      // "Establish X" -> "X is established"
      // "Document X" -> "X is documented"
      // "Identify X" -> "X is identified"
      // "Provide X" -> "X is provided"
      
      const actionPatterns = [
        { pattern: /^Define\s+(.+)$/i, replacement: '$1 is defined' },
        { pattern: /^Assign\s+(.+)$/i, replacement: '$1 is assigned' },
        { pattern: /^Implement\s+(.+)$/i, replacement: '$1 is implemented' },
        { pattern: /^Maintain\s+(.+)$/i, replacement: '$1 is maintained' },
        { pattern: /^Establish\s+(.+)$/i, replacement: '$1 is established' },
        { pattern: /^Document\s+(.+)$/i, replacement: '$1 is documented' },
        { pattern: /^Identify\s+(.+)$/i, replacement: '$1 is identified' },
        { pattern: /^Provide\s+(.+)$/i, replacement: '$1 is provided' },
        { pattern: /^Develop\s+(.+)$/i, replacement: '$1 is developed' },
        { pattern: /^Create\s+(.+)$/i, replacement: '$1 is created' },
        { pattern: /^Ensure\s+(.+)$/i, replacement: '$1 is ensured' },
        { pattern: /^Set up\s+(.+)$/i, replacement: '$1 is set up' },
      ];
      
      let converted = false;
      for (const { pattern, replacement } of actionPatterns) {
        if (pattern.test(condition)) {
          condition = condition.replace(pattern, replacement);
          converted = true;
          break;
        }
      }
      
      // If not converted and doesn't already describe a condition, add "is present"
      if (!converted && !/\b(is|are|exists|present|available|supported)\b/i.test(condition)) {
        condition = condition.replace(/\.$/, '') + ' is present';
      } else {
        condition = condition.replace(/\.$/, '');
      }
      
      return condition.length > 0 ? condition : null;
    })
    .filter((item): item is string => item !== null && item.length > 0)
    .slice(0, 5);
}

/**
 * Get evidence buckets based on subtype keywords
 */
function getEvidenceBuckets(subtypeCode: string, subtypeName: string): string[] {
  const codeUpper = subtypeCode.toUpperCase();
  const nameUpper = subtypeName.toUpperCase();
  const combined = `${codeUpper} ${nameUpper}`;
  
  const buckets: string[] = [];
  
  // Plan/EAP/Procedure/Policy/Doc patterns
  if (/\b(PLAN|EAP|PROCEDURE|POLICY|DOC|GUIDE|FLIP|CHART)\b/.test(combined)) {
    buckets.push('Documented procedures or plans');
    buckets.push('Records demonstrating use');
  }
  
  // Architecture/Integration/Coordination patterns
  if (/\b(ARCH|INTEGRATION|COORD|SYSTEM|PROTOCOL)\b/.test(combined)) {
    buckets.push('Diagrams or layouts');
    buckets.push('Demonstration by responsible personnel');
  }
  
  // Key/Access patterns
  if (/\b(KEY|ACCESS|CREDENTIAL|BADGE|CABINET|LOG)\b/.test(combined)) {
    buckets.push('Configuration listings or inventories');
    buckets.push('Records demonstrating use');
  }
  
  // Default buckets if none matched
  if (buckets.length === 0) {
    buckets.push('Demonstration by responsible personnel');
    buckets.push('Documented procedures or plans');
  }
  
  // Always include at least one demonstration bucket
  if (!buckets.some(b => b.toLowerCase().includes('demonstration'))) {
    buckets.push('Demonstration by responsible personnel');
  }
  
  return normalizeArray(buckets, 5);
}

/**
 * Load taxonomy subtypes with guidance
 */
function loadTaxonomy(): Map<string, TaxonomySubtype> {
  if (!fs.existsSync(TAXONOMY_FILE)) {
    throw new Error(`Taxonomy file not found: ${TAXONOMY_FILE}`);
  }
  
  const content = fs.readFileSync(TAXONOMY_FILE, 'utf-8');
  const data = JSON.parse(content);
  
  if (!data.subtypes || !Array.isArray(data.subtypes)) {
    throw new Error('Taxonomy file must contain a "subtypes" array');
  }
  
  const subtypeMap = new Map<string, TaxonomySubtype>();
  for (const subtype of data.subtypes) {
    if (subtype.is_active !== false && subtype.subtype_code) {
      subtypeMap.set(subtype.subtype_code, subtype);
    }
  }
  
  return subtypeMap;
}

/**
 * Load baseline spines (Depth-1) from database or file
 */
async function loadBaselineSpines(): Promise<BaselineSpine[]> {
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
        active
      FROM public.baseline_spines_runtime
      WHERE active = true
      ORDER BY discipline_code, subtype_code NULLS LAST, canon_id
    `;
    
    const result = await pool.query(query);
    await pool.end();
    
    return result.rows.map((row: any) => ({
      canon_id: row.canon_id,
      discipline_code: row.discipline_code,
      subtype_code: row.subtype_code || null,
      question_text: row.question_text,
      response_enum: row.response_enum || ["YES", "NO", "N_A"],
      canon_version: row.canon_version || 'v1',
      active: row.active !== false
    }));
  } catch (error) {
    console.warn(`[WARN] Database query failed: ${error instanceof Error ? error.message : String(error)}`);
    console.warn(`[WARN] Attempting to load from file: ${BASELINE_SPINES_FILE}`);
    
    if (fs.existsSync(BASELINE_SPINES_FILE)) {
      const content = fs.readFileSync(BASELINE_SPINES_FILE, 'utf-8');
      const data = JSON.parse(content);
      
      let spines: BaselineSpine[] = [];
      if (Array.isArray(data)) {
        spines = data;
      } else if (data.rows && Array.isArray(data.rows)) {
        spines = data.rows;
      } else if (data.spines && Array.isArray(data.spines)) {
        spines = data.spines;
      }
      
      return spines.filter((s: BaselineSpine) => s.active !== false);
    }
    
    throw new Error(`Cannot load baseline spines from database or file: ${BASELINE_SPINES_FILE}`);
  }
}

/**
 * Load Depth-2 questions
 */
function loadDepth2Questions(): Depth2Question[] {
  let depth2File: string | null = null;
  
  for (const candidate of DEPTH2_QUESTIONS_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      depth2File = candidate;
      break;
    }
  }
  
  if (!depth2File) {
    throw new Error(`Depth-2 questions file not found in any of: ${DEPTH2_QUESTIONS_CANDIDATES.join(', ')}`);
  }
  
  const content = fs.readFileSync(depth2File, 'utf-8');
  const data = JSON.parse(content);
  
  if (!data.questions || !Array.isArray(data.questions)) {
    throw new Error('Depth-2 questions file must contain a "questions" array');
  }
  
  return data.questions;
}

/**
 * Generate question-specific intent for depth-2 questions
 * Analyzes the question text to create a focused intent statement
 */
function generateQuestionSpecificIntent(
  questionText: string,
  corpusText: string | undefined,
  subtypeName?: string
): string {
  const qLower = questionText.toLowerCase();
  
  // Extract key concepts from question
  const keyConcepts = extractKeyConcepts(questionText);
  
  // Pattern matching for common question types (order matters - most specific first)
  if (qLower.includes('approve') || qLower.includes('authorization') || qLower.includes('supervisor')) {
    return generateApprovalIntent(keyConcepts, corpusText);
  } else if (qLower.includes('investigate') || (qLower.includes('process') && !qLower.includes('trigger'))) {
    // Check for investigation/process questions before trigger/alarm patterns
    return generateProcessIntent(keyConcepts, corpusText);
  } else if (qLower.includes('monitor') || qLower.includes('24/7') || (qLower.includes('logged') && !qLower.includes('process'))) {
    return generateMonitoringIntent(keyConcepts, corpusText);
  } else if (qLower.includes('tamper') || (qLower.includes('installed') && qLower.includes('properly'))) {
    return generateInstallationIntent(keyConcepts, corpusText);
  } else if (qLower.includes('standardized') || (qLower.includes('verified') && qLower.includes('trained'))) {
    return generateStandardizationIntent(keyConcepts, corpusText);
  } else if (qLower.includes('trigger') || (qLower.includes('alarm') && !qLower.includes('monitor') && !qLower.includes('process') && !qLower.includes('investigate'))) {
    return generateAlertIntent(keyConcepts, corpusText);
  } else if (qLower.includes('test') || qLower.includes('drill') || qLower.includes('exercise')) {
    return generateTestingIntent(keyConcepts, corpusText);
  } else if (qLower.includes('backup') || qLower.includes('redundant') || qLower.includes('failover')) {
    return generateRedundancyIntent(keyConcepts, corpusText);
  } else if (qLower.includes('documented') || (qLower.includes('record') && !qLower.includes('monitor'))) {
    return generateDocumentationIntent(keyConcepts, corpusText);
  } else if (qLower.includes('procedure')) {
    return generateProcessIntent(keyConcepts, corpusText);
  }
  
  // Fallback to generic subtype-based intent
  return translateToPlainLanguage(corpusText, questionText, subtypeName);
}

/**
 * Extract key concepts from question text
 */
function extractKeyConcepts(questionText: string): {
  subject: string;
  action: string;
  object?: string;
} {
  const qLower = questionText.toLowerCase();
  
  // Extract subject (what the question is about) - more specific patterns first
  let subject = 'This system';
  if (qLower.includes('supervisor') && qLower.includes('approve')) subject = 'Supervisor approval of access levels';
  else if (qLower.includes('supervisor')) subject = 'Supervisor oversight';
  else if (qLower.includes('door') && qLower.includes('propped')) subject = 'Propped or forced doors';
  else if (qLower.includes('door') && qLower.includes('monitor')) subject = 'Door monitoring';
  else if (qLower.includes('door')) subject = 'Door security';
  else if (qLower.includes('alarm') && qLower.includes('repeated')) subject = 'Repeated alarms';
  else if (qLower.includes('alarm')) subject = 'Alarm systems';
  else if (qLower.includes('access') && qLower.includes('level')) subject = 'Access levels';
  else if (qLower.includes('access')) subject = 'Access control';
  else if (qLower.includes('camera') || qLower.includes('video')) subject = 'Video systems';
  else if (qLower.includes('credential') || qLower.includes('badge')) subject = 'Credential systems';
  else if (qLower.includes('communication') || qLower.includes('radio')) subject = 'Communication systems';
  else if (qLower.includes('lighting')) subject = 'Lighting systems';
  else if (qLower.includes('perimeter')) subject = 'Perimeter security';
  else if (qLower.includes('key')) subject = 'Key control';
  else if (qLower.includes('visitor')) subject = 'Visitor management';
  else if (qLower.includes('enrollment')) subject = 'Enrollment processes';
  else if (qLower.includes('reader')) subject = 'Access readers';
  else if (qLower.includes('equipment')) subject = 'Security equipment';
  
  // Extract action (what is being asked)
  let action = 'operates';
  if (qLower.includes('approve')) action = 'approves';
  else if (qLower.includes('monitor') && qLower.includes('24/7')) action = 'monitors continuously';
  else if (qLower.includes('monitor')) action = 'monitors';
  else if (qLower.includes('trigger')) action = 'triggers';
  else if (qLower.includes('investigate')) action = 'investigates';
  else if (qLower.includes('test')) action = 'tests';
  else if (qLower.includes('document')) action = 'documents';
  else if (qLower.includes('standardize')) action = 'standardizes';
  else if (qLower.includes('install')) action = 'installs';
  else if (qLower.includes('verify')) action = 'verifies';
  
  // Extract object (what the action applies to)
  let object: string | undefined;
  if (qLower.includes('access level')) object = 'access levels';
  else if (qLower.includes('alarm')) object = 'alarms';
  else if (qLower.includes('door')) object = 'doors';
  else if (qLower.includes('equipment')) object = 'equipment';
  
  return { subject, action, object };
}

/**
 * Generate intent for approval/authorization questions
 */
function generateApprovalIntent(concepts: { subject: string; action: string; object?: string }, corpusText?: string): string {
  const subject = concepts.subject || 'Access levels';
  const object = concepts.object || 'access levels';
  return `${subject} must be controlled to prevent unauthorized access. Without proper approval processes, people may get ${object} they should not have. This question checks that supervisors review and approve ${object} before they are granted.`;
}

/**
 * Generate intent for monitoring questions
 */
function generateMonitoringIntent(concepts: { subject: string; action: string; object?: string }, corpusText?: string): string {
  const subject = concepts.subject || 'Security events';
  const object = concepts.object || 'events';
  return `${subject} need to be watched continuously or recorded. If ${object} are not monitored, security problems may go unnoticed. This question checks that monitoring happens around the clock or that ${object} are logged for later review.`;
}

/**
 * Generate intent for process/procedure questions
 */
function generateProcessIntent(concepts: { subject: string; action: string; object?: string }, corpusText?: string): string {
  const subject = concepts.subject || 'Security events';
  const object = concepts.object || 'issues';
  // Avoid redundancy: if subject already includes "repeated", don't add "repeatedly"
  const subjectLower = subject.toLowerCase();
  const happensPhrase = subjectLower.includes('repeated') ? 'happen' : 'happen repeatedly';
  return `When ${subjectLower} ${happensPhrase}, there should be a clear process to investigate why. Without investigation, the same problems keep happening. This question checks that staff know how to investigate and fix recurring ${object}.`;
}

/**
 * Generate intent for installation/configuration questions
 */
function generateInstallationIntent(concepts: { subject: string; action: string; object?: string }, corpusText?: string): string {
  const subject = concepts.subject || 'Security equipment';
  const object = concepts.object || 'equipment';
  return `${subject} must be installed correctly and protected from tampering. If ${object} can be easily tampered with or was installed wrong, it may not work when needed. This question checks that ${object} is properly installed and tamper-resistant.`;
}

/**
 * Generate intent for standardization questions
 */
function generateStandardizationIntent(concepts: { subject: string; action: string; object?: string }, corpusText?: string): string {
  const subject = concepts.subject || 'Security processes';
  return `${subject} should be done the same way every time by trained people. Without standardization, mistakes happen and quality varies. This question checks that processes are standardized and that trained personnel perform them.`;
}

/**
 * Generate intent for alert/alarm questions
 */
function generateAlertIntent(concepts: { subject: string; action: string; object?: string }, corpusText?: string): string {
  const subject = concepts.subject || 'Security events';
  const object = concepts.object || 'alarms';
  return `${subject} should trigger alerts when something is wrong. If ${object} do not work, security problems may go unnoticed. This question checks that ${object} or alerts are triggered when they should be.`;
}

/**
 * Generate intent for testing questions
 */
function generateTestingIntent(concepts: { subject: string; action: string; object?: string }, corpusText?: string): string {
  const subject = concepts.subject || 'Security systems';
  return `${subject} must be tested regularly to make sure they work. Without testing, you may not know if something is broken until you need it. This question checks that systems are tested on a regular schedule.`;
}

/**
 * Generate intent for redundancy/backup questions
 */
function generateRedundancyIntent(concepts: { subject: string; action: string; object?: string }, corpusText?: string): string {
  const subject = concepts.subject || 'Critical systems';
  return `${subject} should have backups or redundancy so they keep working if something fails. Without backups, a single failure can stop everything. This question checks that backup systems or redundancy are in place.`;
}

/**
 * Generate intent for documentation questions
 */
function generateDocumentationIntent(concepts: { subject: string; action: string; object?: string }, corpusText?: string): string {
  const subject = concepts.subject || 'Security activities';
  return `${subject} should be documented or recorded so you can review what happened later. Without records, it is hard to investigate problems or prove that security measures were followed. This question checks that important activities are documented or logged.`;
}

/**
 * Translate corpus-derived meaning into plain operational language
 * Structure: "[X] does not stay reliable on its own. Over time, [Y] happens. Without [Z], [failure] can occur."
 */
function translateToPlainLanguage(
  corpusText: string | undefined,
  questionText: string,
  subtypeName?: string
): string {
  // If no corpus text, generate from question
  if (!corpusText || corpusText.trim().length === 0) {
    return generatePlainLanguageFromQuestion(questionText, subtypeName);
  }
  
  // Extract subject from corpus or question, cleaning forbidden words
  let subject = subtypeName || extractSubjectFromQuestion(questionText) || 'This system';
  
  // Remove forbidden words from subject
  subject = subject.replace(/\b(?:capability|policy|framework|controls?|assessor|OFC)\b/gi, '').trim();
  if (!subject || subject.length < 3) {
    subject = 'This system';
  }
  
  // Part 1: What does not stay reliable (always start with this pattern)
  const degradationPhrase = `${subject} does not stay reliable on its own`;
  
  // Analyze corpus text to understand what can go wrong
  const text = corpusText.toLowerCase();
  
  // Part 2: What happens over time - understand from corpus what degrades
  let overTimePhrase = '';
  
  // Check for specific failure modes mentioned in corpus
  // Check for specific failure modes mentioned in corpus (most specific first)
  if ((text.includes('visitors') && text.includes('contractors') && text.includes('indistinguishable')) || text.includes('all look alike')) {
    overTimePhrase = 'Over time, badges or cards all start to look the same';
  } else if (text.includes('false acceptance') || text.includes('false rejection') || text.includes('far') || text.includes('frr')) {
    overTimePhrase = 'Over time, the system may let the wrong people in or block the right people';
  } else if (text.includes('outdated') || (text.includes('clone') && text.includes('trivial'))) {
    overTimePhrase = 'Over time, old equipment becomes easy to copy or break into';
  } else if (text.includes('propped') || (text.includes('forced entry') && text.includes('door'))) {
    overTimePhrase = 'Over time, doors get left open or broken';
  } else if (text.includes('radio') || (text.includes('communication') && text.includes('two-way'))) {
    overTimePhrase = 'Over time, radios stop working or people forget how to use them';
  } else if (text.includes('camera') || text.includes('video') || text.includes('recording')) {
    overTimePhrase = 'Over time, cameras stop recording or break down';
  } else if (text.includes('badge') || text.includes('credential') || text.includes('card')) {
    overTimePhrase = 'Over time, badges or cards become easy to copy or fake';
  } else if (text.includes('emergency') || text.includes('evacuation') || text.includes('muster') || text.includes('rally')) {
    overTimePhrase = 'Over time, people forget where to go or how to get there';
  } else if (text.includes('training') || text.includes('drill') || (text.includes('staff') && text.includes('trained'))) {
    overTimePhrase = 'Over time, people forget what to do or how to do it';
  } else if (text.includes('lighting') || text.includes('light')) {
    overTimePhrase = 'Over time, lights burn out or stop working';
  } else if (text.includes('access') || text.includes('entry')) {
    overTimePhrase = 'Over time, access systems stop working correctly or become easy to bypass';
  } else {
    // Generic based on what the system does
    if (text.includes('detects') || text.includes('monitors') || text.includes('watches')) {
      overTimePhrase = 'Over time, sensors stop detecting things correctly';
    } else if (text.includes('controls') || text.includes('manages') || text.includes('governs')) {
      overTimePhrase = 'Over time, the system stops controlling things correctly';
    } else {
      overTimePhrase = 'Over time, parts wear out or stop working as expected';
    }
  }
  
  // Part 3: What failure occurs - understand consequence from corpus
  let failurePhrase = '';
  
  if (text.includes('unauthorized') || text.includes('breach') || text.includes('attack') || text.includes('risk increases')) {
    if (subject.toLowerCase().includes('access') || subject.toLowerCase().includes('entry')) {
      failurePhrase = 'Without regular checking and maintenance, unauthorized people can get in';
    } else if (subject.toLowerCase().includes('badge') || subject.toLowerCase().includes('credential')) {
      failurePhrase = 'Without regular checking and maintenance, anyone can make fake badges';
    } else {
      failurePhrase = 'Without regular checking and maintenance, security breaks down';
    }
  } else if (text.includes('propped') || text.includes('door')) {
    failurePhrase = 'Without regular checking and maintenance, doors can be left open or broken';
  } else if (text.includes('radio') || text.includes('communication')) {
    failurePhrase = 'Without regular checking and maintenance, people cannot communicate in emergencies';
  } else if (text.includes('camera') || text.includes('video')) {
    failurePhrase = 'Without regular checking and maintenance, cameras may not record when needed';
  } else if (text.includes('emergency') || text.includes('evacuation') || text.includes('muster') || text.includes('rally')) {
    failurePhrase = 'Without regular checking and maintenance, people may not know where to go in an emergency';
  } else if (text.includes('training') || text.includes('drill') || text.includes('staff')) {
    failurePhrase = 'Without regular checking and maintenance, people may not know what to do in an emergency';
  } else if (subject.toLowerCase().includes('access') || subject.toLowerCase().includes('entry')) {
    failurePhrase = 'Without regular checking and maintenance, people who should not get in can get in';
  } else if (subject.toLowerCase().includes('video') || subject.toLowerCase().includes('camera')) {
    failurePhrase = 'Without regular checking and maintenance, cameras may not record when needed';
  } else if (subject.toLowerCase().includes('communication') || subject.toLowerCase().includes('radio')) {
    failurePhrase = 'Without regular checking and maintenance, people cannot communicate in emergencies';
  } else {
    failurePhrase = 'Without regular checking and maintenance, problems can occur when you need the system most';
  }
  
  // Simplify all phrases to 8th grade level
  let simplifiedOverTime = simplifySentence(overTimePhrase);
  let simplifiedFailure = simplifySentence(failurePhrase);
  
  // Fix "keeping it working" -> "maintenance"
  simplifiedFailure = simplifiedFailure.replace(/keeping it working/gi, 'maintenance');
  
  // Ensure sentences are 15-20 words max
  const finalOverTime = truncateToMaxWords(simplifiedOverTime, 20);
  const finalFailure = truncateToMaxWords(simplifiedFailure, 20);
  
  return `${degradationPhrase}. ${finalOverTime}. ${finalFailure}.`;
}

/**
 * Extract subject from question text for use in plain language
 * Avoids forbidden words
 */
function extractSubjectFromQuestion(questionText: string): string {
  const text = questionText.toLowerCase().trim();
  
  // Common patterns (avoid forbidden words)
  if (text.includes('entry')) return 'Entry control';
  if (text.includes('access') && !text.includes('capability')) return 'Access control';
  if (text.includes('video') || text.includes('camera')) return 'Video systems';
  if (text.includes('communication')) return 'Communication systems';
  if (text.includes('emergency') && !text.includes('capability')) return 'Emergency systems';
  if (text.includes('lighting')) return 'Lighting';
  if (text.includes('perimeter')) return 'Perimeter security';
  if (text.includes('key')) return 'Key control';
  if (text.includes('visitor')) return 'Visitor management';
  if (text.includes('reporting') && !text.includes('capability')) return 'Reporting systems';
  if (text.includes('security force') || text.includes('security response')) return 'Security response';
  if (text.includes('compliance') && !text.includes('policy')) return 'Compliance systems';
  if (text.includes('tracking') && !text.includes('policy')) return 'Tracking systems';
  
  return 'This system';
}

/**
 * Simplify a sentence to 8th grade level
 */
function simplifySentence(sentence: string): string {
  let simplified = sentence
    // Replace complex verbs with simple ones
    .replace(/\b(?:facilitates?|enables?)\b/gi, 'helps')
    .replace(/\b(?:ensures?)\b/gi, 'makes sure')
    .replace(/\b(?:implements?|establishes?)\b/gi, 'sets up')
    .replace(/\b(?:maintains?)\b/gi, 'keeps')
    .replace(/\b(?:demonstrate|substantiate|verify)\b/gi, 'show')
    .replace(/\b(?:utilize|leverage)\b/gi, 'use')
    .replace(/\b(?:evaluate|assess)\b/gi, 'check')
    .replace(/\b(?:identifies?|detects?)\b/gi, 'finds')
    .replace(/\b(?:monitors?)\b/gi, 'watches')
    .replace(/\b(?:provides?)\b/gi, 'gives')
    .replace(/\b(?:governs?)\b/gi, 'controls')
    .replace(/\b(?:manages?)\b/gi, 'handles')
    // Replace complex nouns
    .replace(/\b(?:capabilities?|functionalities?|mechanisms?)\b/gi, 'things')
    .replace(/\b(?:degradation|deterioration|decline)\b/gi, 'wears out')
    .replace(/\b(?:malfunction|failure|breakdown)\b/gi, 'stops working')
    .replace(/\b(?:operational|functional)\b/gi, 'working')
    .replace(/\b(?:critical|essential)\b/gi, 'important')
    .replace(/\b(?:degrade|deteriorate)\b/gi, 'wear out')
    .replace(/\b(?:maintenance)\b/gi, 'keeping it working')
    .replace(/\b(?:verification|validation)\b/gi, 'checking')
    .replace(/\b(?:characteristics?)\b/gi, 'features')
    .replace(/\b(?:credentials?)\b/gi, 'badges or cards')
    .replace(/\b(?:situational awareness)\b/gi, 'knowing what is happening')
    .replace(/\b(?:unauthorized)\b/gi, 'not allowed')
    .replace(/\b(?:vulnerable|exposed)\b/gi, 'at risk')
    // Remove complex phrases
    .replace(/\b(?:in order to|so that|such that)\b/gi, 'to')
    .replace(/\b(?:as well as)\b/gi, 'and')
    .replace(/\b(?:in addition to)\b/gi, 'and')
    // Clean up
    .replace(/\s+/g, ' ')
    .trim();
  
  return simplified;
}

/**
 * Truncate sentence to max words while preserving meaning
 */
function truncateToMaxWords(sentence: string, maxWords: number): string {
  const words = sentence.split(/\s+/);
  if (words.length <= maxWords) {
    return sentence;
  }
  
  // Try to cut at a natural break (comma, conjunction)
  for (let i = maxWords; i > maxWords - 5; i--) {
    if (i < words.length && /[,;]/.test(words[i])) {
      return words.slice(0, i + 1).join(' ');
    }
  }
  
  // Cut at max words
  return words.slice(0, maxWords).join(' ') + '.';
}

/**
 * Generate plain language from question when no corpus text available
 * Uses more varied patterns based on question type
 */
function generatePlainLanguageFromQuestion(questionText: string, subtypeName?: string): string {
  // Extract subject, avoiding forbidden words
  let name = subtypeName || extractSubjectFromQuestion(questionText) || 'This system';
  
  // Remove forbidden words from subject name
  name = name.replace(/\b(?:capability|policy|framework|controls?|assessor|OFC)\b/gi, '').trim();
  if (!name || name.length < 3) {
    name = 'This system';
  }
  
  const qLower = questionText.toLowerCase();
  
  // Use more specific patterns based on question content
  if (qLower.includes('implemented') || qLower.includes('capability')) {
    return `${name} must be properly set up and working to provide security. If it is not implemented correctly, it cannot protect the facility. This question checks that the system exists and is operational.`;
  } else if (qLower.includes('operational') || qLower.includes('working')) {
    return `${name} must be working correctly to be useful. If it is not operational, it cannot perform its security function. This question checks that the system is functioning as intended.`;
  } else if (qLower.includes('installed') || qLower.includes('present')) {
    return `${name} must be installed and present to provide security. Without it, there is no protection in this area. This question checks that the system is physically present and installed.`;
  }
  
  // Default pattern with more natural language
  return `${name} needs regular attention to stay reliable. Over time, parts wear out or stop working as expected. Without regular checking and maintenance, problems can occur when you need the system most.`;
}

/**
 * Simplify text to plain language (8th grade level)
 */
function simplifyText(text: string): string {
  // Remove complex phrases
  let simplified = text
    .replace(/\b(?:facilitates?|enables?|ensures?|implements?|establishes?|maintains?)\b/gi, 'helps')
    .replace(/\b(?:capabilities?|functionalities?|mechanisms?)\b/gi, 'things')
    .replace(/\b(?:degradation|deterioration|decline)\b/gi, 'wears out')
    .replace(/\b(?:malfunction|failure|breakdown)\b/gi, 'stops working')
    .replace(/\b(?:operational|functional)\b/gi, 'working')
    .replace(/\b(?:demonstrate|substantiate|verify)\b/gi, 'show')
    .replace(/\b(?:utilize|leverage)\b/gi, 'use');
  
  // Break into shorter sentences
  const sentences = simplified.split(/[.!?]/).filter(s => s.trim().length > 0);
  const shortSentences: string[] = [];
  
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    if (words.length > 20) {
      // Split long sentences
      const mid = Math.floor(words.length / 2);
      shortSentences.push(words.slice(0, mid).join(' ') + '.');
      shortSentences.push(words.slice(mid).join(' ') + '.');
    } else {
      shortSentences.push(sentence.trim() + '.');
    }
  }
  
  return shortSentences.join(' ').substring(0, 200);
}

/**
 * Extract condition from question text for intent generation
 * Converts question form to condition form: "Is X Y?" -> "X is Y"
 */
function extractConditionFromQuestion(questionText: string): string {
  const text = questionText.trim();
  // Remove question mark
  let condition = text.replace(/\?$/, '').trim();
  
  // Handle "Is there a/an X?" -> "there is a/an X"
  if (/^is\s+there\s+/i.test(condition)) {
    condition = condition.replace(/^is\s+/i, '');
    return condition.trim();
  }
  
  // Handle "Is/Are X Y?" -> "X is/are Y"
  // For past participles: "Is X implemented?" -> "X is implemented"
  // For other cases: "Is entry controlled?" -> "entry is controlled"
  const isMatch = condition.match(/^(is|are)\s+(.+)$/i);
  if (isMatch) {
    const [, verb, rest] = isMatch;
    // Check if rest ends with a past participle
    const restLower = rest.toLowerCase();
    const pastParticiplePattern = /\b(implemented|controlled|defined|documented|identified|established|maintained|provided|created|developed|ensured|configured|installed|standardized|verified|trained|drilled|tested|monitored|recorded|stored|backed up|protected|secured|hardened|reinforced|isolated|separated|redundant|duplicated)\b/i;
    const hasPastParticiple = pastParticiplePattern.test(restLower);
    
    if (hasPastParticiple) {
      // For past participles, insert "is/are" before the participle
      // "a capability implemented" -> "a capability is implemented"
      // Find where the participle starts
      const match = rest.match(pastParticiplePattern);
      if (match && match.index !== undefined) {
        const beforeParticiple = rest.substring(0, match.index).trim();
        const participleAndAfter = rest.substring(match.index).trim();
        const capitalizedBefore = beforeParticiple.charAt(0).toUpperCase() + beforeParticiple.slice(1);
        return `${capitalizedBefore} ${verb.toLowerCase()} ${participleAndAfter}`;
      }
      // Fallback: just capitalize
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    } else {
      // Move verb to end: "entry controlled" -> "entry is controlled"
      const capitalizedRest = rest.charAt(0).toUpperCase() + rest.slice(1);
      return `${capitalizedRest} ${verb.toLowerCase()}`;
    }
  }
  
  // Handle "Do/Does X Y?" -> "X does/do Y" or "X Y" (if Y is a verb)
  const doMatch = condition.match(/^(do|does)\s+(.+)$/i);
  if (doMatch) {
    const [, verb, rest] = doMatch;
    // Check if rest starts with "you have", "they have", etc. - these are special cases
    if (/^(you|they|we|staff|personnel|operators|users)\s+have\s+/i.test(rest)) {
      // "Do you have X?" -> "you have X" (keep as-is, just capitalize)
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    }
    // For other cases, check if rest contains a verb that needs conjugation
    // "Does the coverage include X?" -> "the coverage includes X"
    const hasVerb = /\b(include|require|support|provide|maintain|operate|function|work|exist|occur)\b/i.test(rest);
    if (hasVerb) {
      // Conjugate the verb: "include" -> "includes" (for "does"), "include" -> "include" (for "do")
      const conjugatedRest = rest.replace(/\b(include|require|support|provide|maintain|operate|function|work|exist|occur)\b/i, (match) => {
        if (verb.toLowerCase() === 'does') {
          // Third person singular: add 's'
          return match + (match.endsWith('s') ? '' : 's');
        } else {
          // Plural/first person: keep as-is
          return match;
        }
      });
      return conjugatedRest.charAt(0).toUpperCase() + conjugatedRest.slice(1);
    }
    // Fallback: add "does/do" at end
    const capitalizedRest = rest.charAt(0).toUpperCase() + rest.slice(1);
    const conjugatedVerb = verb.toLowerCase() === 'does' ? 'does' : 'do';
    return `${capitalizedRest} ${conjugatedVerb}`;
  }
  
  // Handle "Can X Y?" -> "X can Y"
  const canMatch = condition.match(/^can\s+(.+)$/i);
  if (canMatch) {
    const rest = canMatch[1];
    const capitalizedRest = rest.charAt(0).toUpperCase() + rest.slice(1);
    return `${capitalizedRest} can`;
  }
  
  // Handle "Has/Have X Y?" -> "X has/have Y"
  const haveMatch = condition.match(/^(has|have)\s+(.+)$/i);
  if (haveMatch) {
    const [, verb, rest] = haveMatch;
    const capitalizedRest = rest.charAt(0).toUpperCase() + rest.slice(1);
    return `${capitalizedRest} ${verb.toLowerCase()}`;
  }
  
  // Fallback: return as-is (shouldn't happen for well-formed questions)
  return condition.trim();
}

/**
 * Generate intent object for discipline-level question (no subtype_code)
 * Uses plain operational language derived from corpus evidence
 */
function generateDisciplineLevelIntent(
  spine: BaselineSpine
): IntentObject {
  // Generate plain-language intent from question (no subtype guidance available)
  const intent = generatePlainLanguageFromQuestion(spine.question_text);
  
  // Standardized verification blocks (EXACT text)
  const whatCountsAsYes: string[] = [
    'Responsible personnel confirm the condition is supported',
    'A demonstration or record can substantiate the condition when requested'
  ];
  
  const whatDoesNotCount: string[] = [
    'Assumed capability without confirmation',
    'Condition exists only under exceptional circumstances with no identifiable method to invoke'
  ];
  
  const typicalEvidence: string[] = [
    'Demonstration by responsible personnel'
  ];
  
  const fieldTip = 'If unsure, request a brief demonstration or the document that defines this behavior.';
  
  return {
    canon_id: spine.canon_id,
    layer: 'baseline',
    depth: 1,
    discipline_code: spine.discipline_code,
    subtype_code: '', // Empty string for discipline-level questions
    question_text: normalizeWhitespace(spine.question_text),
    intent: sanitizeText(normalizeWhitespace(intent)),
    what_counts_as_yes: normalizeArray(whatCountsAsYes, 5),
    what_does_not_count: normalizeArray(whatDoesNotCount, 5),
    typical_evidence: normalizeArray(typicalEvidence, 5),
    field_tip: normalizeWhitespace(fieldTip),
    references: [],
    source: {
      subtype_guidance_used: false,
      guidance_fields_used: []
    }
  };
}

/**
 * Generate intent object for Depth-1 spine
 * Uses plain operational language derived from corpus evidence (guidance.overview or psa_notes)
 */
function generateDepth1Intent(
  spine: BaselineSpine,
  subtype: TaxonomySubtype
): IntentObject {
  const guidance = subtype.guidance || {};
  
  // Use corpus-derived meaning: prefer psa_notes, then overview
  const corpusText = guidance.psa_notes || guidance.overview;
  
  // Translate to plain operational language
  const intent = translateToPlainLanguage(corpusText, spine.question_text, subtype.name);
  
  // Standardized verification blocks (EXACT text)
  const whatCountsAsYes: string[] = [
    'Responsible personnel confirm the condition is supported',
    'A demonstration or record can substantiate the condition when requested'
  ];
  
  const whatDoesNotCount: string[] = [
    'Assumed capability without confirmation',
    'Condition exists only under exceptional circumstances with no identifiable method to invoke'
  ];
  
  const typicalEvidence: string[] = [
    'Demonstration by responsible personnel'
  ];
  
  const fieldTip = 'If unsure, request a brief demonstration or the document that defines this behavior.';
  
  // References (preserved from guidance if available)
  const references = guidance.standards_references 
    ? normalizeArray(guidance.standards_references, 5)
    : [];
  
  return {
    canon_id: spine.canon_id,
    layer: 'baseline',
    depth: 1,
    discipline_code: spine.discipline_code,
    subtype_code: spine.subtype_code!,
    question_text: normalizeWhitespace(spine.question_text),
    intent: sanitizeText(normalizeWhitespace(intent)),
    what_counts_as_yes: normalizeArray(whatCountsAsYes, 5),
    what_does_not_count: normalizeArray(whatDoesNotCount, 5),
    typical_evidence: normalizeArray(typicalEvidence, 5),
    field_tip: normalizeWhitespace(fieldTip),
    references: references,
    source: {
      subtype_guidance_used: !!corpusText,
      guidance_fields_used: [
        ...(corpusText ? (guidance.psa_notes ? ['psa_notes'] : ['overview']) : []),
        ...(references.length > 0 ? ['standards_references'] : [])
      ]
    }
  };
}

/**
 * Generate intent object for Depth-2 question
 * Uses question-specific intent generation for better clarity and relevance
 */
function generateDepth2Intent(
  question: Depth2Question,
  subtype: TaxonomySubtype | null
): IntentObject {
  const guidance = subtype?.guidance || {};
  
  // Use corpus-derived meaning: prefer psa_notes, then overview
  const corpusText = guidance.psa_notes || guidance.overview;
  
  // Generate question-specific intent for depth-2 questions
  const intent = generateQuestionSpecificIntent(question.question_text, corpusText, subtype?.name);
  
  // Standardized verification blocks (EXACT text)
  const whatCountsAsYes: string[] = [
    'Responsible personnel confirm the condition is supported',
    'A demonstration or record can substantiate the condition when requested'
  ];
  
  const whatDoesNotCount: string[] = [
    'Assumed capability without confirmation',
    'Condition exists only under exceptional circumstances with no identifiable method to invoke'
  ];
  
  const typicalEvidence: string[] = [
    'Demonstration by responsible personnel'
  ];
  
  const fieldTip = 'If unsure, request a brief demonstration or the document that defines this behavior.';
  
  // References (preserved from guidance if available)
  const references = guidance.standards_references 
    ? normalizeArray(guidance.standards_references, 5)
    : [];
  
  return {
    canon_id: question.question_code,
    layer: 'baseline',
    depth: 2,
    discipline_code: question.discipline_code,
    subtype_code: question.subtype_code,
    question_text: normalizeWhitespace(question.question_text),
    intent: sanitizeText(normalizeWhitespace(intent)),
    what_counts_as_yes: normalizeArray(whatCountsAsYes, 5),
    what_does_not_count: normalizeArray(whatDoesNotCount, 5),
    typical_evidence: normalizeArray(typicalEvidence, 5),
    field_tip: normalizeWhitespace(fieldTip),
    references: references,
    source: {
      subtype_guidance_used: !!corpusText,
      guidance_fields_used: [
        ...(corpusText ? (guidance.psa_notes ? ['psa_notes'] : ['overview']) : []),
        ...(references.length > 0 ? ['standards_references'] : [])
      ]
    }
  };
}

/**
 * Main generation function
 */
async function main(): Promise<void> {
  console.log('[INFO] Loading taxonomy subtypes...');
  const subtypeMap = loadTaxonomy();
  console.log(`[INFO] Loaded ${subtypeMap.size} active subtypes`);
  
  console.log('[INFO] Loading baseline spines (Depth-1)...');
  const spines = await loadBaselineSpines();
  console.log(`[INFO] Loaded ${spines.length} active baseline spines`);
  
  console.log('[INFO] Loading Depth-2 questions...');
  const depth2Questions = loadDepth2Questions();
  console.log(`[INFO] Loaded ${depth2Questions.length} Depth-2 questions`);
  
  console.log('[INFO] Generating intent objects...');
  const intentObjects: IntentObject[] = [];
  
  // Generate for Depth-1 spines
  for (const spine of spines) {
    if (!spine.subtype_code) {
      // Discipline-level question (no subtype_code) - generate generic intent
      const intentObj = generateDisciplineLevelIntent(spine);
      intentObjects.push(intentObj);
      continue;
    }
    
    const subtype = subtypeMap.get(spine.subtype_code);
    if (!subtype) {
      console.warn(`[WARN] Subtype not found for spine ${spine.canon_id}: ${spine.subtype_code}`);
      // Generate generic intent even if subtype not found
      const intentObj = generateDisciplineLevelIntent(spine);
      intentObjects.push(intentObj);
      continue;
    }
    
    const intentObj = generateDepth1Intent(spine, subtype);
    intentObjects.push(intentObj);
  }
  
  // Generate for Depth-2 questions
  for (const question of depth2Questions) {
    const subtype = subtypeMap.get(question.subtype_code) || null;
    const intentObj = generateDepth2Intent(question, subtype);
    intentObjects.push(intentObj);
  }
  
  // Sort: discipline_code, subtype_code (empty strings last), depth, canon_id
  intentObjects.sort((a, b) => {
    if (a.discipline_code !== b.discipline_code) {
      return a.discipline_code.localeCompare(b.discipline_code);
    }
    // Handle empty subtype_code (discipline-level questions)
    const aSubtype = a.subtype_code || '';
    const bSubtype = b.subtype_code || '';
    if (aSubtype !== bSubtype) {
      if (aSubtype === '') return 1; // Empty strings go last
      if (bSubtype === '') return -1;
      return aSubtype.localeCompare(bSubtype);
    }
    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }
    return a.canon_id.localeCompare(b.canon_id);
  });
  
  // Create output
  const depth1Count = intentObjects.filter(i => i.depth === 1).length;
  const depth2Count = intentObjects.filter(i => i.depth === 2).length;
  
  const output: IntentObjectsOutput = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    counts: {
      depth1: depth1Count,
      depth2: depth2Count,
      total: intentObjects.length
    },
    questions: intentObjects
  };
  
  // Write JSON
  console.log(`[INFO] Writing JSON output to ${OUTPUT_JSON}...`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  
  // Write Markdown
  console.log(`[INFO] Writing Markdown output to ${OUTPUT_MD}...`);
  generateMarkdown(output, OUTPUT_MD);
  
  console.log(`[INFO] Generated ${intentObjects.length} intent objects`);
  console.log(`[INFO]   - Depth-1: ${intentObjects.filter(i => i.depth === 1).length}`);
  console.log(`[INFO]   - Depth-2: ${intentObjects.filter(i => i.depth === 2).length}`);
  console.log('[INFO] Done!');
}

/**
 * Generate Markdown review document
 */
function generateMarkdown(output: IntentObjectsOutput, outputPath: string): void {
  const lines: string[] = [];
  
  lines.push('# Intent Objects v1.0');
  lines.push('');
  lines.push(`**Generated:** ${output.generated_at}`);
  lines.push(`**Total Questions:** ${output.questions.length}`);
  lines.push(`**Depth-1 Spines:** ${output.questions.filter(q => q.depth === 1).length}`);
  lines.push(`**Depth-2 Questions:** ${output.questions.filter(q => q.depth === 2).length}`);
  lines.push('');
  
  // Group by subtype
  const bySubtype = new Map<string, IntentObject[]>();
  for (const question of output.questions) {
    if (!bySubtype.has(question.subtype_code)) {
      bySubtype.set(question.subtype_code, []);
    }
    bySubtype.get(question.subtype_code)!.push(question);
  }
  
  // Sort subtypes by discipline_code, then subtype_code
  const sortedSubtypes = Array.from(bySubtype.entries()).sort((a, b) => {
    const aDisc = a[1][0].discipline_code;
    const bDisc = b[1][0].discipline_code;
    if (aDisc !== bDisc) {
      return aDisc.localeCompare(bDisc);
    }
    return a[0].localeCompare(b[0]);
  });
  
  for (const [subtypeCode, questions] of sortedSubtypes) {
    const depth1 = questions.find(q => q.depth === 1);
    const depth2 = questions.filter(q => q.depth === 2);
    
    lines.push(`## ${subtypeCode}`);
    lines.push('');
    
    if (depth1) {
      lines.push('### Depth-1: ' + depth1.question_text);
      lines.push('');
      lines.push('**Intent:** ' + depth1.intent);
      lines.push('');
      lines.push('**What counts as YES:**');
      for (const item of depth1.what_counts_as_yes) {
        lines.push(`- ${item}`);
      }
      lines.push('');
      lines.push('**What does not count:**');
      for (const item of depth1.what_does_not_count) {
        lines.push(`- ${item}`);
      }
      lines.push('');
      lines.push('**Typical evidence:**');
      for (const item of depth1.typical_evidence) {
        lines.push(`- ${item}`);
      }
      lines.push('');
      lines.push('**Field tip:** ' + depth1.field_tip);
      lines.push('');
    }
    
    if (depth2.length > 0) {
      for (const d2 of depth2) {
        lines.push(`### Depth-2: ${d2.question_text}`);
        lines.push('');
        lines.push('**Intent:** ' + d2.intent);
        lines.push('');
        lines.push('**What counts as YES:**');
        for (const item of d2.what_counts_as_yes) {
          lines.push(`- ${item}`);
        }
        lines.push('');
        lines.push('**What does not count:**');
        for (const item of d2.what_does_not_count) {
          lines.push(`- ${item}`);
        }
        lines.push('');
        lines.push('**Typical evidence:**');
        for (const item of d2.typical_evidence) {
          lines.push(`- ${item}`);
        }
        lines.push('');
        lines.push('**Field tip:** ' + d2.field_tip);
        lines.push('');
      }
    }
    
    lines.push('---');
    lines.push('');
  }
  
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('[ERROR]', error);
    process.exit(1);
  });
}

export { generateDepth1Intent, generateDepth2Intent };
