/**
 * Generate Baseline Subtype v1
 * 
 * OBJECTIVE: Expand baseline coverage to all subtypes with existence-only, subtype-anchored baseline spines.
 * - Preserve existing discipline-level baseline questions
 * - Seed only vetted subtype baseline questions
 * 
 * RULES (BASELINE-SAFE):
 * - Exactly one subtype baseline question per subtype_code (matches taxonomy count)
 * - Question MUST be existence-only (forbid: "tested", "regularly", "adequate", "effective", etc.)
 * - response_enum fixed to ["YES","NO","N_A"]
 * - component default PROCESS
 * - active=true
 * - canon_version="v1"
 * 
 * SEED MODE POLICY:
 * - BASELINE_SUBTYPE_SEED_MODE environment variable:
 *   - PRESERVE_EXISTING (default): Skip subtypes already covered, do not overwrite existing question_text
 *   - OVERWRITE_EXISTING: Generate all taxonomy subtypes, overwrite existing question_text on conflict
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Seed mode policy
type SeedMode = 'PRESERVE_EXISTING' | 'OVERWRITE_EXISTING';

function getSeedMode(): SeedMode {
  const mode = (process.env.BASELINE_SUBTYPE_SEED_MODE || 'PRESERVE_EXISTING').toUpperCase();
  if (mode !== 'PRESERVE_EXISTING' && mode !== 'OVERWRITE_EXISTING') {
    console.warn(`[WARN] Invalid BASELINE_SUBTYPE_SEED_MODE: ${mode}, defaulting to PRESERVE_EXISTING`);
    return 'PRESERVE_EXISTING';
  }
  return mode as SeedMode;
}

// Check multiple locations for existing spines file
const EXISTING_SPINES_FILE_CANDIDATES = [
  path.join(process.cwd(), 'baseline_spines_runtime_rows.json'),
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'baseline_spines_runtime_rows.json'),
  process.env.BASELINE_SPINES_RUNTIME_ROWS_FILE || ''
].filter(Boolean);
const CANDIDATES_FILE = path.join(process.cwd(), 'tools', 'outputs', 'baseline_candidates.json');
const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'baseline_subtype_v1.json');
const OUTPUT_SQL = path.join(OUTPUT_DIR, 'baseline_subtype_v1_seed.sql');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'baseline_subtype_v1_review.md');

interface ExistingSpine {
  canon_id: string;
  discipline_code: string;
  subtype_code?: string | null;
  question_text: string;
  response_enum: ["YES", "NO", "N_A"] | string;
  canon_version?: string;
  active?: boolean;
  [key: string]: any;
}

interface Candidate {
  discipline_code: string;
  subtype_code: string;
  subtype_name: string;
  component: string;
  proposed_question_text: string;
  source: 'suggested_questions' | 'generated_fallback';
  review_status: string;
}

interface BaselineSubtypeSpine {
  canon_id: string;
  discipline_code: string;
  subtype_code: string;
  question_text: string;
  response_enum: ["YES", "NO", "N_A"];
  canon_version: string;
  active: boolean;
}

/**
 * Check if question contains forbidden existence-violating words
 */
function containsForbiddenExistenceWords(question: string): boolean {
  const forbidden = [
    'tested',
    'regularly',
    'adequate',
    'effective',
    'aligned',
    'by whom',
    'how often',
    'according to',
    'rated',
    'provide facial',
    'verify step'
  ];
  
  const lower = question.toLowerCase();
  return forbidden.some(word => lower.includes(word));
}

/**
 * Sanitize question text according to baseline-safe rules
 */
function sanitizeQuestion(question: string, subtypeName: string): string {
  let sanitized = question.trim();
  
  // Remove trailing "By whom?" / "and by whom?" clauses
  sanitized = sanitized.replace(/\s*(,?\s*and\s*)?by\s+whom\??\s*$/i, '');
  sanitized = sanitized.replace(/\s*\?+\s*$/, '').trim();
  
  // Grammar fixes
  sanitized = sanitized.replace(/^Is\s+you\s+have\s+/i, 'Is there ');
  sanitized = sanitized.replace(/^Are\s+you\s+maintain\s+/i, 'Are there ');
  
  // Fix "Is readers" -> "Are readers"
  sanitized = sanitized.replace(/^Is\s+(readers|systems|controls|measures|procedures|policies|devices|technologies|mechanisms|processes|tools|methods)\s+/i, 'Are $1 ');
  
  // Fix "Is a" -> "Is an" for vowels
  sanitized = sanitized.replace(/^Is\s+a\s+([aeiouAEIOU])/i, 'Is an $1');
  
  // If contains forbidden words, replace with fallback
  if (containsForbiddenExistenceWords(sanitized)) {
    return generateFallbackQuestion(subtypeName);
  }
  
  // Check for complex questions that aren't simple existence
  // Questions like "Is there ever a time when..." are not simple existence
  if (/ever\s+a\s+time\s+when/i.test(sanitized) || 
      /how\s+(quickly|often|many)/i.test(sanitized) ||
      /what\s+are/i.test(sanitized) ||
      /where\s+.*\s+(can|are|is)/i.test(sanitized) ||
      /separate\s+guidance\s+for/i.test(sanitized) ||
      /areas\s+where\s+people\s+can/i.test(sanitized) ||
      /locations\s+where/i.test(sanitized)) {
    return generateFallbackQuestion(subtypeName);
  }
  
  // Check for enumerations in questions (comma-separated lists with 2+ items)
  // Pattern: word, word, and word OR word, word, word
  const enumerationPattern = /,\s+\w+(\s+and\s+\w+)?,|\w+,\s+\w+,\s+\w+/i;
  if (enumerationPattern.test(sanitized)) {
    return generateFallbackQuestion(subtypeName);
  }
  
  // Check for multiple commas (more than 1 suggests enumeration)
  const commaMatches = sanitized.match(/,\s+\w+/g);
  if (commaMatches && commaMatches.length > 1) {
    return generateFallbackQuestion(subtypeName);
  }
  
  // Ensure it ends with ?
  if (!sanitized.endsWith('?')) {
    sanitized += '?';
  }
  
  return sanitized;
}

/**
 * Generate fallback question
 */
function generateFallbackQuestion(subtypeName: string): string {
  // Clean subtype name
  let cleanName = subtypeName.trim();
  cleanName = cleanName.replace(/^(the|a|an)\s+/i, '');
  
  // Use "an" for vowels, "a" for consonants
  const article = /^[aeiouAEIOU]/.test(cleanName) ? 'an' : 'a';
  
  return `Is ${article} ${cleanName} capability implemented?`;
}

const QUESTION_TEXT_OVERRIDES: Record<string, string> = {
  ACS_BIOMETRIC_ACCESS: 'Is biometric authentication used to grant entry at controlled points?',
  ACS_CREDENTIAL_BADGE_SYSTEMS: 'Are credentials or badges used to grant entry at controlled points?',
  ACS_DOOR_MONITORING: 'Are doors monitored for forced or unauthorized opening at controlled entry points?',
  ACS_DOOR_READERS: 'Are door readers installed at controlled entry points?',
  ACS_ELECTRIC_STRIKES_MAG_LOCKS: 'Are electric strikes or mag locks installed on controlled doors?',
  ACS_ELECTRONIC_ACCESS_CONTROL: 'Is an electronic access control system in use at controlled entry points?',
  ACS_KEYPADS_PIN_ENTRY: 'Are keypads or PIN entry devices used at controlled entry points?',
  ACS_LOCKING_HARDWARE: 'Is mechanical locking hardware installed on controlled doors?',
  ACS_SECURED_VESTIBULES: 'Are secured vestibules used to separate public and controlled space?',
  ACS_VISITOR_MANAGEMENT_SYSTEMS: 'Are visitor management systems used to manage facility entry?',
  COM_BACKUP_COMMUNICATIONS: 'Is there a backup communication method available during outages or incidents?',
  COM_COMMUNICATION_PROTOCOLS: 'Are communication protocols defined for incident coordination?',
  COM_INTEROPERABLE_COMMUNICATIONS: 'Can communications interoperate with external responders or partner systems?',
  COM_PA_SYSTEMS: 'Are public address systems available to broadcast announcements?',
  COM_PAGING_SYSTEMS: 'Are paging systems available to broadcast alerts?',
  COM_RADIOS_TWO_WAY: 'Are two-way radios available for staff coordination?',
  EAP_EMERGENCY_DRILLS: 'Are emergency drills planned or conducted for the facility?',
  EAP_EMERGENCY_GUIDES_FLIP_CHARTS: 'Are emergency guides or flip charts available for staff use?',
  EAP_EVACUATION_PROCEDURES: 'Are evacuation routes and assembly steps documented for the facility?',
  EAP_LOCKDOWN_LOCKOUT_PROCEDURES: 'Are lockdown or lockout steps documented for threats requiring restricted access?',
  EAP_MUSTER_POINTS_RALLY_AREAS: 'Are muster points or rally areas designated for evacuees after departure?',
  EAP_REUNIFICATION_PROCEDURES: 'Are reunification steps documented for reuniting occupants after an incident?',
  EAP_SHELTER_IN_PLACE: 'Are shelter-in-place steps documented for threats that require occupants to stay inside?',
  EAP_STAFF_EMERGENCY_ROLES: 'Are staff responsibilities assigned for emergency response?',
  EMR_BUSINESS_CONTINUITY: 'Is continuity of operations planned for facility disruptions?',
  EMR_CRISIS_MANAGEMENT: 'Is crisis management defined for major incidents affecting the facility?',
  EMR_EMERGENCY_COMMUNICATIONS: 'Is there a defined method to notify occupants during emergencies?',
  EMR_ICS_NIMS_INTEGRATION: 'Is incident command or NIMS integration defined for the facility?',
  EMR_MASS_NOTIFICATION: 'Is mass notification available for urgent protective actions?',
  EMR_REDUNDANCY_BACKUP_SYSTEMS: 'Are backup systems defined for critical operations?',
  EMR_RESILIENCE_PLANNING: 'Is resilience planning defined for the facility?',
  IDS_ALARM_MONITORING: 'Are alarms monitored by staff or a central service?',
  IDS_ALARM_PANELS: 'Are alarm panels installed to receive detection signals?',
  IDS_DOOR_CONTACTS: 'Are door contacts installed to detect opening events?',
  IDS_GLASS_BREAK_SENSORS: 'Are glass break sensors installed to detect forced entry?',
  IDS_MOTION_DETECTORS: 'Are motion detectors installed to detect movement in protected areas?',
  IDS_PANIC_DURESS_BUTTONS: 'Are panic or duress buttons installed for silent alerting?',
  IDS_PERIMETER_IDS: 'Is intrusion detection deployed along the perimeter?',
  INT_HARD_INTERIOR_BARRIERS: 'Are hard interior barriers used to separate protected spaces?',
  INT_ACCESS_RESTRICTED_AREAS: 'Are restricted areas controlled at their entry points?',
  INT_INTERIOR_DOORS: 'Are interior doors used to control movement between spaces?',
  INT_INTERIOR_LIGHTING: 'Is interior lighting used to support protected spaces or visibility?',
  INT_SAFE_ROOMS: 'Are safe rooms designated for temporary protective shelter?',
  INT_SECURE_ROOMS: 'Are secure rooms designated for protected occupancy?',
  INT_SENSITIVE_ITEM_STORAGE: 'Is protected storage provided for sensitive items?',
  KEY_KEY_CABINETS: 'Are key cabinets used to secure stored keys?',
  KEY_KEY_LOGS_ACCOUNTABILITY: 'Are key issuance and return logs maintained?',
  KEY_MASTER_KEY_MANAGEMENT: 'Are master keys controlled separately from standard keys?',
  KEY_REKEYING_PROCEDURES: 'Are rekeying procedures documented after key loss or turnover?',
  KEY_RESTRICTED_KEYS: 'Are restricted keys issued only to authorized personnel?',
  PER_BOLLARDS_BARRIERS: 'Are bollards or vehicle barriers installed to deter vehicle access?',
  PER_BOUNDARY_DEMARCATION: 'Is the site boundary clearly marked or demarcated?',
  PER_CLEAR_ZONES: 'Are clear zones maintained along the perimeter?',
  PER_FENCING: 'Is fencing present along the site boundary?',
  PER_GATES: 'Are gates installed at perimeter entry points?',
  PER_PEDESTRIAN_ACCESS_CONTROL_POINTS: 'Are pedestrian entry points controlled with staff, turnstiles, or checkpoints?',
  PER_VEHICLE_ACCESS_CONTROL_POINTS: 'Are vehicle entry points controlled with gates, barriers, or checkpoints?',
  PER_PERIMETER_LIGHTING: 'Is perimeter lighting installed to illuminate the site boundary?',
  PER_PERIMETER_SIGNAGE: 'Is perimeter signage posted to mark restricted areas?',
  SMG_SECURITY_DOCUMENTATION: 'Is security documentation maintained as the governing record set for the facility?',
  SMG_SECURITY_POLICIES: 'Are security policies documented to govern facility security decisions?',
  SMG_SECURITY_PROCEDURES: 'Are step-by-step security procedures documented for operations and incidents?',
  SMG_SECURITY_TRAINING_PROGRAMS: 'Are security training programs provided to staff and contractors?',
  SFO_SECURITY_OFFICER_TRAINING: 'Are security officers trained for assigned duties and response roles?',
  SFO_RESPONSE_PROCEDURES: 'Are security response playbooks documented for incidents?',
  SFO_SECURITY_OPERATIONS_CENTER_SOC: 'Is a security operations center available for live monitoring and coordination?',
  SFO_GUARD_POSTS: 'Are guard posts assigned to protect key areas of the facility?',
  SFO_PATROL_ROUTES: 'Are patrol routes defined for security rounds and inspections?',
  SFO_RADIO_COMMUNICATIONS: 'Are radios available for security team communications?',
  SFO_INCIDENT_REPORTING: 'Are incident logging and escalation steps defined for security staff?',
  ISC_COORDINATION_PROTOCOLS: 'Are coordination protocols defined for partner response and escalation?',
  ISC_EXTERNAL_REPORTING: 'Is external reporting defined for incidents or threats?',
  ISC_FUSION_CENTER_INTERFACE: 'Is there an interface for sharing information with a fusion center?',
  ISC_ISAC_ISAOS: 'Is there participation in ISAC or ISAO information sharing?',
  ISC_JTTF_ENGAGEMENT: 'Is JTTF engagement defined for relevant incidents?',
  ISC_LAW_ENFORCEMENT_LIAISON: 'Is law enforcement liaison defined for the facility?',
  ISC_THREAT_INFORMATION_SHARING: 'Is threat information shared with outside partners?',
  VSS_ANALYTICS_BEHAVIOR_DETECTION: 'Are analytics used to detect unusual behavior on camera feeds?',
  VSS_CAMERA_COVERAGE_LINE_OF_SIGHT: 'Are camera views unobstructed across required areas?',
  VSS_EXTERIOR_CAMERAS: 'Are cameras deployed to observe exterior and perimeter areas?',
  VSS_FIXED_CAMERAS: 'Are fixed cameras used where a constant field of view is needed?',
  VSS_IP_CAMERAS: 'Are networked IP cameras used in the video system?',
  VSS_INTERIOR_CAMERAS: 'Are cameras deployed to observe interior public or restricted spaces?',
  VSS_MONITORING_WORKSTATIONS: 'Are operator workstations available to view live camera feeds?',
  VSS_PTZ_CAMERAS: 'Are pan-tilt-zoom cameras deployed where adjustable coverage is needed?',
  VSS_SYSTEM_ARCHITECTURE: 'Is the video system architecture documented for the facility?',
  VSS_VIDEO_WALL_DISPLAY_SYSTEMS: 'Are display systems used to show live camera feeds?',
};

/**
 * Normalize question to existence-only format if needed
 */
function normalizeToExistenceOnly(question: string, subtypeName: string): string {
  let normalized = question.trim();
  
  // Remove trailing question marks
  normalized = normalized.replace(/\?+\s*$/, '').trim();
  
  // Check if already in existence format
  const existencePatterns = [
    /^Is\s+there\s+/i,
    /^Are\s+there\s+/i,
    /^Is\s+(a|an)\s+.*\s+(in\s+place|implemented)/i,
    /^Are\s+.*\s+implemented/i,
    /^Is\s+.*\s+implemented/i
  ];
  
  if (existencePatterns.some(pattern => pattern.test(normalized))) {
    // Fix article if needed
    normalized = normalized.replace(/^Is\s+a\s+([aeiouAEIOU])/i, 'Is an $1');
    return normalized + '?';
  }
  
  // Try to convert to existence format
  // Remove leading "Does/Do/Is/Are" if present
  normalized = normalized.replace(/^(does|do|is|are)\s+/i, '');
  
  // Check if it's about implementation/existence
  const hasExistenceVerb = /\b(implemented|in place|exists|established|deployed|present|available|configured|installed|operational)\b/i.test(normalized);
  
  if (hasExistenceVerb) {
    // Check if plural
    const isPlural = /\b(systems|controls|measures|procedures|policies|devices|technologies|mechanisms|processes|tools|methods|readers)\b/i.test(normalized);
    if (isPlural) {
      normalized = 'Are ' + normalized + '?';
    } else {
      normalized = 'Is ' + normalized + '?';
    }
  } else {
    // Default fallback
    normalized = generateFallbackQuestion(subtypeName);
  }
  
  return normalized;
}

/**
 * Generate canon_id in format: BASE-<DISCIPLINE_CODE>-<SUBTYPE_CODE>
 */
function generateCanonId(disciplineCode: string, subtypeCode: string): string {
  const canonId = `BASE-${disciplineCode}-${subtypeCode}`;
  
  // Validate length (PostgreSQL TEXT can be very long, but we'll cap at 255 for safety)
  if (canonId.length > 255) {
    throw new Error(`Canon ID too long: ${canonId} (${canonId.length} chars, max 255)`);
  }
  
  return canonId;
}

/**
 * Load existing spines from JSON file
 */
function loadExistingSpines(filePath: string): ExistingSpine[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] Existing spines file not found: ${filePath}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // Handle different formats
  if (Array.isArray(data)) {
    return data;
  } else if (data.rows && Array.isArray(data.rows)) {
    return data.rows;
  } else if (data.spines && Array.isArray(data.spines)) {
    return data.spines;
  }
  
  return [];
}

/**
 * Load candidates from JSON file
 */
function loadCandidates(filePath: string): Candidate[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Candidates file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  if (data.candidates && Array.isArray(data.candidates)) {
    return data.candidates;
  }
  
  throw new Error('Candidates file must contain a "candidates" array');
}

/**
 * Load all subtype codes from taxonomy (for validation)
 */
function loadAllSubtypeCodes(): Set<string> {
  // Try multiple locations for taxonomy file
  const taxonomyFileCandidates = [
    path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'discipline_subtypes_rows.json'),
    path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json'),
    path.join(process.cwd(), 'discipline_subtypes_rows.json')
  ];
  
  let taxonomyFile: string | null = null;
  for (const candidate of taxonomyFileCandidates) {
    if (fs.existsSync(candidate)) {
      taxonomyFile = candidate;
      break;
    }
  }
  
  if (!taxonomyFile) {
    console.warn(`[WARN] Taxonomy file not found in any of: ${taxonomyFileCandidates.join(', ')}`);
    return new Set();
  }
  
  console.log(`[INFO] Loading taxonomy from: ${taxonomyFile}`);
  const content = fs.readFileSync(taxonomyFile, 'utf-8');
  const data = JSON.parse(content);
  
  // Handle both array format and nested object format
  const subtypes: any[] = Array.isArray(data) ? data : (data.rows || data.subtypes || []);
  const codes = new Set<string>();
  
  for (const subtype of subtypes) {
    const code = subtype.subtype_code || subtype.code;
    if (code) {
      // Filter: only include subtypes where baseline_eligible !== false
      // If baseline_eligible is undefined/null, treat as eligible (default true)
      const baselineEligible = subtype.baseline_eligible;
      if (baselineEligible !== false) {
        codes.add(code);
      }
    }
  }
  
  return codes;
}

/**
 * Main function
 */
async function main() {
  console.log('[INFO] Generating baseline subtype v1...\n');
  
  // Get seed mode
  const seedMode = getSeedMode();
  console.log(`[INFO] Seed mode: ${seedMode}\n`);
  
  // Find existing spines file
  let existingSpinesFile: string | null = null;
  for (const candidate of EXISTING_SPINES_FILE_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) {
      existingSpinesFile = candidate;
      break;
    }
  }
  
  // Load existing spines
  if (existingSpinesFile) {
    console.log(`[INFO] Loading existing spines from: ${existingSpinesFile}`);
  } else {
    console.log(`[INFO] Existing spines file not found, treating as empty`);
    console.log(`[INFO] Checked locations:`);
    EXISTING_SPINES_FILE_CANDIDATES.forEach(c => {
      if (c) console.log(`  - ${c}`);
    });
  }
  
  const existingSpines = existingSpinesFile ? loadExistingSpines(existingSpinesFile) : [];
  console.log(`[OK] Loaded ${existingSpines.length} existing spines`);
  
  // Build set of covered subtype codes and map of existing canon_ids by subtype_code
  const coveredSubtypeCodes = new Set<string>();
  const existingCanonIds = new Set<string>();
  const existingCanonIdBySubtype = new Map<string, string>(); // subtype_code -> canon_id
  
  for (const spine of existingSpines) {
    if (spine.canon_id) {
      existingCanonIds.add(spine.canon_id);
    }
    if (spine.subtype_code && spine.subtype_code.trim() !== '' && spine.active !== false) {
      coveredSubtypeCodes.add(spine.subtype_code);
      existingCanonIdBySubtype.set(spine.subtype_code, spine.canon_id);
    }
  }
  
  console.log(`[INFO] Found ${coveredSubtypeCodes.size} subtypes already covered by existing spines\n`);
  
  // Load candidates
  console.log(`[INFO] Loading candidates from: ${CANDIDATES_FILE}`);
  const candidates = loadCandidates(CANDIDATES_FILE);
  console.log(`[OK] Loaded ${candidates.length} candidates\n`);
  
  // Load all subtype codes for validation
  const allSubtypeCodes = loadAllSubtypeCodes();
  const expectedCount = allSubtypeCodes.size || 104; // Fallback to 104 if taxonomy not found
  console.log(`[INFO] Expected subtype count: ${expectedCount}\n`);
  
  // Process candidates
  const newSpines: BaselineSubtypeSpine[] = [];
  const skippedDueToExistingCoverage: Candidate[] = [];
  const skippedDueToDuplicateWithinGenerated: Candidate[] = [];
  const skippedDueToNonTaxonomySubtype: Candidate[] = [];
  const processedSubtypeCodes = new Set<string>();
  const generatedCanonIds = new Set<string>();
  const wouldOverwriteSubtypes: string[] = []; // Track subtypes that would be overwritten
  
  for (const candidate of candidates) {
    const subtypeCode = candidate.subtype_code;
    
    // In PRESERVE_EXISTING mode, skip if already covered by existing spines
    if (seedMode === 'PRESERVE_EXISTING' && coveredSubtypeCodes.has(subtypeCode)) {
      skippedDueToExistingCoverage.push(candidate);
      continue;
    }
    
    // In OVERWRITE_EXISTING mode, track subtypes that would be overwritten
    if (seedMode === 'OVERWRITE_EXISTING' && coveredSubtypeCodes.has(subtypeCode)) {
      wouldOverwriteSubtypes.push(subtypeCode);
    }
    
    // Skip if already processed within this generation run (duplicate in candidates)
    if (processedSubtypeCodes.has(subtypeCode)) {
      skippedDueToDuplicateWithinGenerated.push(candidate);
      continue;
    }
    
    // Check if subtype is in taxonomy (if taxonomy loaded)
    if (allSubtypeCodes.size > 0 && !allSubtypeCodes.has(subtypeCode)) {
      skippedDueToNonTaxonomySubtype.push(candidate);
      console.warn(`[WARN] Subtype ${subtypeCode} not in taxonomy, skipping`);
      continue;
    }
    
    processedSubtypeCodes.add(subtypeCode);
    
    // Sanitize question
    let questionText = QUESTION_TEXT_OVERRIDES[subtypeCode] ?? sanitizeQuestion(candidate.proposed_question_text, candidate.subtype_name);
    
    // Normalize to existence-only if needed
    questionText = normalizeToExistenceOnly(questionText, candidate.subtype_name);
    if (QUESTION_TEXT_OVERRIDES[subtypeCode]) {
      questionText = QUESTION_TEXT_OVERRIDES[subtypeCode];
    }
    
    // Generate canon_id
    const canonId = generateCanonId(candidate.discipline_code, subtypeCode);
    
    // In PRESERVE_EXISTING mode, check for canon_id collision with existing (should not happen if we skipped)
    if (seedMode === 'PRESERVE_EXISTING' && existingCanonIds.has(canonId)) {
      throw new Error(`Canon ID collision: ${canonId} already exists in existing spines (PRESERVE_EXISTING mode)`);
    }
    
    // Check for canon_id collision within generated set
    if (generatedCanonIds.has(canonId)) {
      throw new Error(`Canon ID collision: ${canonId} duplicate within generated set`);
    }
    
    generatedCanonIds.add(canonId);
    
    // Create new spine
    const spine: BaselineSubtypeSpine = {
      canon_id: canonId,
      discipline_code: candidate.discipline_code,
      subtype_code: subtypeCode,
      question_text: questionText,
      response_enum: ["YES", "NO", "N_A"],
      canon_version: 'v1',
      active: true
    };
    
    newSpines.push(spine);
  }
  
  // In OVERWRITE_EXISTING mode, ensure we generate entries for ALL taxonomy subtypes
  if (seedMode === 'OVERWRITE_EXISTING' && allSubtypeCodes.size > 0) {
    const generatedSubtypeCodes = new Set(newSpines.map(s => s.subtype_code));
    const missingSubtypes: string[] = [];
    
    for (const subtypeCode of allSubtypeCodes) {
      if (!generatedSubtypeCodes.has(subtypeCode)) {
        missingSubtypes.push(subtypeCode);
      }
    }
    
    if (missingSubtypes.length > 0) {
      throw new Error(`OVERWRITE_EXISTING mode: Missing ${missingSubtypes.length} subtypes from candidates: ${missingSubtypes.join(', ')}`);
    }
  }
  
  console.log(`[INFO] Generated ${newSpines.length} new subtype spines`);
  console.log(`[INFO] Skip breakdown:`);
  console.log(`  - Skipped due to existing coverage: ${skippedDueToExistingCoverage.length}`);
  console.log(`  - Skipped due to duplicate within generated: ${skippedDueToDuplicateWithinGenerated.length}`);
  console.log(`  - Skipped due to non-taxonomy subtype: ${skippedDueToNonTaxonomySubtype.length}\n`);
  
  // STRICT SET VALIDATION
  console.log(`[INFO] Performing strict set validation...\n`);
  
  // Build sets
  const taxonomySubtypes = allSubtypeCodes.size > 0 ? allSubtypeCodes : new Set<string>();
  const existingCovered = new Set<string>();
  const existingNonTaxonomySubtypes: string[] = [];
  
  for (const spine of existingSpines) {
    if (spine.subtype_code && spine.subtype_code.trim() !== '' && spine.active !== false) {
      // Only count as "covered" if it's in the taxonomy (if taxonomy is loaded)
      if (taxonomySubtypes.size === 0 || taxonomySubtypes.has(spine.subtype_code)) {
        existingCovered.add(spine.subtype_code);
      } else {
        existingNonTaxonomySubtypes.push(spine.subtype_code);
        console.warn(`[WARN] Existing spine has non-taxonomy subtype: ${spine.subtype_code} (canon_id: ${spine.canon_id})`);
      }
    }
  }
  
  const generatedSet = new Set<string>();
  const generatedCanonIdsSet = new Set<string>();
  const generatedDuplicatesBySubtype: Array<{ subtype_code: string; canon_ids: string[] }> = [];
  const subtypeToCanonIds = new Map<string, string[]>();
  
  for (const spine of newSpines) {
    generatedSet.add(spine.subtype_code);
    generatedCanonIdsSet.add(spine.canon_id);
    
    // Track duplicates by subtype
    if (!subtypeToCanonIds.has(spine.subtype_code)) {
      subtypeToCanonIds.set(spine.subtype_code, []);
    }
    subtypeToCanonIds.get(spine.subtype_code)!.push(spine.canon_id);
  }
  
  // Find duplicates within generated set
  for (const [subtypeCode, canonIds] of subtypeToCanonIds.entries()) {
    if (canonIds.length > 1) {
      generatedDuplicatesBySubtype.push({ subtype_code: subtypeCode, canon_ids: canonIds });
    }
  }
  
  // Build final union
  const finalSet = new Set<string>();
  for (const code of existingCovered) {
    finalSet.add(code);
  }
  for (const code of generatedSet) {
    finalSet.add(code);
  }
  
  // Find extras and missing
  const extraNotInTaxonomy: string[] = [];
  const missingFromFinal: string[] = [];
  
  if (taxonomySubtypes.size > 0) {
    for (const code of finalSet) {
      if (!taxonomySubtypes.has(code)) {
        extraNotInTaxonomy.push(code);
      }
    }
    for (const code of taxonomySubtypes) {
      if (!finalSet.has(code)) {
        missingFromFinal.push(code);
      }
    }
  }
  
  // Build audit report
  const auditReport = {
    seed_mode: seedMode,
    taxonomy_count: taxonomySubtypes.size,
    existing_covered_count: existingCovered.size,
    existing_non_taxonomy_subtypes: existingNonTaxonomySubtypes.sort(),
    generated_count: generatedSet.size,
    final_union_count: finalSet.size,
    extra_not_in_taxonomy: extraNotInTaxonomy.sort(),
    missing_from_final: missingFromFinal.sort(),
    would_overwrite_count: wouldOverwriteSubtypes.length,
    would_overwrite_subtypes: wouldOverwriteSubtypes.sort(),
    generated_duplicates_by_subtype: generatedDuplicatesBySubtype,
    skip_breakdown: {
      skipped_due_to_existing_subtype_coverage: skippedDueToExistingCoverage.length,
      skipped_due_to_duplicate_within_generated: skippedDueToDuplicateWithinGenerated.length,
      skipped_due_to_non_taxonomy_subtype: skippedDueToNonTaxonomySubtype.length
    },
    existing_covered_subtypes: Array.from(existingCovered).sort(),
    generated_subtypes: Array.from(generatedSet).sort(),
    final_union_subtypes: Array.from(finalSet).sort()
  };
  
  // Write audit report
  const auditFile = path.join(OUTPUT_DIR, 'baseline_subtype_v1_audit.json');
  fs.writeFileSync(auditFile, JSON.stringify(auditReport, null, 2), 'utf-8');
  console.log(`[INFO] Audit report written: ${auditFile}\n`);
  
  // HARD FAIL conditions
  console.log(`[INFO] Validation results:`);
  console.log(`  - Seed mode: ${auditReport.seed_mode}`);
  console.log(`  - Taxonomy count: ${auditReport.taxonomy_count}`);
  console.log(`  - Existing covered: ${auditReport.existing_covered_count}`);
  console.log(`  - Generated: ${auditReport.generated_count}`);
  console.log(`  - Would overwrite: ${auditReport.would_overwrite_count}`);
  console.log(`  - Final union: ${auditReport.final_union_count}`);
  console.log(`  - Extras not in taxonomy: ${auditReport.extra_not_in_taxonomy.length}`);
  console.log(`  - Missing from final: ${auditReport.missing_from_final.length}`);
  console.log(`  - Generated duplicates by subtype: ${auditReport.generated_duplicates_by_subtype.length}\n`);
  
  // Validate seed mode expectations
  if (seedMode === 'PRESERVE_EXISTING') {
    const expectedGenerated = auditReport.taxonomy_count - auditReport.existing_covered_count;
    if (auditReport.generated_count !== expectedGenerated) {
      throw new Error(`PRESERVE_EXISTING mode: Generated count (${auditReport.generated_count}) does not match expected (${expectedGenerated} = taxonomy_count - existing_covered_count)`);
    }
  } else if (seedMode === 'OVERWRITE_EXISTING') {
    if (auditReport.generated_count !== auditReport.taxonomy_count) {
      throw new Error(`OVERWRITE_EXISTING mode: Generated count (${auditReport.generated_count}) does not match taxonomy count (${auditReport.taxonomy_count})`);
    }
  }
  
  if (taxonomySubtypes.size > 0) {
    if (auditReport.extra_not_in_taxonomy.length > 0) {
      throw new Error(`Found ${auditReport.extra_not_in_taxonomy.length} subtypes in final set not in taxonomy: ${auditReport.extra_not_in_taxonomy.join(', ')}`);
    }
    
    if (auditReport.missing_from_final.length > 0) {
      throw new Error(`Missing ${auditReport.missing_from_final.length} subtypes from final set: ${auditReport.missing_from_final.join(', ')}`);
    }
    
    if (auditReport.final_union_count !== auditReport.taxonomy_count) {
      throw new Error(`Final union count (${auditReport.final_union_count}) does not match taxonomy count (${auditReport.taxonomy_count})`);
    }
  } else {
    console.warn(`[WARN] Taxonomy not loaded, skipping strict validation`);
    if (auditReport.final_union_count !== expectedCount) {
      throw new Error(`Final union count (${auditReport.final_union_count}) does not match expected count (${expectedCount})`);
    }
  }
  
  if (auditReport.generated_duplicates_by_subtype.length > 0) {
    throw new Error(`Found ${auditReport.generated_duplicates_by_subtype.length} subtypes with multiple canon_ids: ${JSON.stringify(auditReport.generated_duplicates_by_subtype)}`);
  }
  
  console.log(`[OK] Strict validation passed\n`);
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Write JSON output
  console.log(`[INFO] Writing JSON output: ${OUTPUT_JSON}`);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(newSpines, null, 2), 'utf-8');
  console.log(`[OK] JSON written\n`);
  
  // Write SQL seed script
  console.log(`[INFO] Writing SQL seed script: ${OUTPUT_SQL}`);
  let sqlContent = `-- Baseline Subtype v1 Seed Script\n`;
  sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
  sqlContent += `-- Seed Mode: ${seedMode}\n`;
  sqlContent += `-- Total spines: ${newSpines.length}\n\n`;
  
  if (seedMode === 'PRESERVE_EXISTING') {
    sqlContent += `-- PRESERVE_EXISTING mode: Existing subtype spines are preserved.\n`;
    sqlContent += `-- This script uses INSERT ... ON CONFLICT DO UPDATE but preserves question_text.\n`;
    sqlContent += `-- Only new subtype spines will be inserted; existing question_text is not updated.\n\n`;
  } else {
    sqlContent += `-- OVERWRITE_EXISTING mode: All taxonomy subtypes will be seeded.\n`;
    sqlContent += `-- This script uses INSERT ... ON CONFLICT DO UPDATE to overwrite question_text.\n`;
    sqlContent += `-- Existing subtype spines will be updated with new question_text.\n\n`;
  }
  
  sqlContent += `BEGIN;\n\n`;
  
  for (const spine of newSpines) {
    const questionEscaped = spine.question_text.replace(/'/g, "''");
    const responseEnumJson = JSON.stringify(spine.response_enum);
    
    sqlContent += `INSERT INTO public.baseline_spines_runtime (\n`;
    sqlContent += `  canon_id,\n`;
    sqlContent += `  discipline_code,\n`;
    sqlContent += `  subtype_code,\n`;
    sqlContent += `  question_text,\n`;
    sqlContent += `  response_enum,\n`;
    sqlContent += `  canon_version,\n`;
    sqlContent += `  canon_hash,\n`;
    sqlContent += `  active\n`;
    sqlContent += `) VALUES (\n`;
    sqlContent += `  '${spine.canon_id}',\n`;
    sqlContent += `  '${spine.discipline_code}',\n`;
    sqlContent += `  '${spine.subtype_code}',\n`;
    sqlContent += `  '${questionEscaped}',\n`;
    sqlContent += `  '${responseEnumJson}'::jsonb,\n`;
    sqlContent += `  '${spine.canon_version}',\n`;
    sqlContent += `  MD5('${spine.canon_id}'),\n`;
    sqlContent += `  ${spine.active}\n`;
    sqlContent += `)\n`;
    
    if (seedMode === 'PRESERVE_EXISTING') {
      // In PRESERVE_EXISTING mode, do not update question_text for existing rows
      // Since we skip existing subtypes, conflicts should be rare, but we preserve question_text if they occur
      sqlContent += `ON CONFLICT (canon_id) DO UPDATE SET\n`;
      sqlContent += `  discipline_code = EXCLUDED.discipline_code,\n`;
      sqlContent += `  subtype_code = EXCLUDED.subtype_code,\n`;
      sqlContent += `  -- question_text preserved (not updated in PRESERVE_EXISTING mode)\n`;
      sqlContent += `  response_enum = EXCLUDED.response_enum,\n`;
      sqlContent += `  canon_version = EXCLUDED.canon_version,\n`;
      sqlContent += `  canon_hash = EXCLUDED.canon_hash,\n`;
      sqlContent += `  active = EXCLUDED.active;\n\n`;
    } else {
      // In OVERWRITE_EXISTING mode, overwrite question_text
      sqlContent += `ON CONFLICT (canon_id) DO UPDATE SET\n`;
      sqlContent += `  discipline_code = EXCLUDED.discipline_code,\n`;
      sqlContent += `  subtype_code = EXCLUDED.subtype_code,\n`;
      sqlContent += `  question_text = EXCLUDED.question_text,\n`;
      sqlContent += `  response_enum = EXCLUDED.response_enum,\n`;
      sqlContent += `  canon_version = EXCLUDED.canon_version,\n`;
      sqlContent += `  canon_hash = EXCLUDED.canon_hash,\n`;
      sqlContent += `  active = EXCLUDED.active;\n\n`;
    }
  }
  
  sqlContent += `COMMIT;\n`;
  
  fs.writeFileSync(OUTPUT_SQL, sqlContent, 'utf-8');
  console.log(`[OK] SQL written\n`);
  
  // Write review markdown
  console.log(`[INFO] Writing review markdown: ${OUTPUT_MD}`);
  let mdContent = `# Baseline Subtype v1 Review\n\n`;
  mdContent += `Generated: ${new Date().toISOString()}\n`;
  mdContent += `Seed Mode: **${seedMode}**\n\n`;
  mdContent += `## Summary\n\n`;
  mdContent += `- **Seed mode:** ${seedMode}\n`;
  mdContent += `- **Total new subtype spines:** ${newSpines.length}\n`;
  mdContent += `- **Existing subtype coverage:** ${existingCovered.size}\n`;
  if (seedMode === 'OVERWRITE_EXISTING') {
    mdContent += `- **Would overwrite existing:** ${wouldOverwriteSubtypes.length}\n`;
  }
  mdContent += `- **Skipped due to existing coverage:** ${skippedDueToExistingCoverage.length}\n`;
  mdContent += `- **Skipped due to duplicate within generated:** ${skippedDueToDuplicateWithinGenerated.length}\n`;
  mdContent += `- **Skipped due to non-taxonomy subtype:** ${skippedDueToNonTaxonomySubtype.length}\n`;
  mdContent += `- **Total coverage:** ${finalSet.size} / ${auditReport.taxonomy_count || expectedCount}\n\n`;
  
  if (seedMode === 'OVERWRITE_EXISTING' && wouldOverwriteSubtypes.length > 0) {
    mdContent += `## ⚠️ Subtypes That Will Be Overwritten\n\n`;
    mdContent += `The following ${wouldOverwriteSubtypes.length} subtypes already have active baseline spines and will be updated:\n\n`;
    mdContent += `| Subtype Code | Existing Canon ID |\n`;
    mdContent += `|--------------|-------------------|\n`;
    for (const subtypeCode of wouldOverwriteSubtypes.sort()) {
      const existingCanonId = existingCanonIdBySubtype.get(subtypeCode) || 'UNKNOWN';
      mdContent += `| ${subtypeCode} | ${existingCanonId} |\n`;
    }
    mdContent += `\n`;
  }
  mdContent += `---\n\n`;
  mdContent += `## New Subtype Spines\n\n`;
  mdContent += `| Discipline | Subtype | Final Question Text | Source |\n`;
  mdContent += `|------------|---------|---------------------|--------|\n`;
  
  // Sort by discipline_code, then subtype_code
  const sortedSpines = [...newSpines].sort((a, b) => {
    if (a.discipline_code !== b.discipline_code) {
      return a.discipline_code.localeCompare(b.discipline_code);
    }
    return a.subtype_code.localeCompare(b.subtype_code);
  });
  
  // Map candidates by subtype_code for source tracking
  const candidatesBySubtype = new Map<string, Candidate>();
  for (const candidate of candidates) {
    candidatesBySubtype.set(candidate.subtype_code, candidate);
  }
  
  for (const spine of sortedSpines) {
    const candidate = candidatesBySubtype.get(spine.subtype_code);
    const source = candidate?.source === 'suggested_questions' ? 'candidate' : 'fallback';
    const questionEscaped = spine.question_text.replace(/\|/g, '\\|');
    mdContent += `| ${spine.discipline_code} | ${spine.subtype_code} | ${questionEscaped} | ${source} |\n`;
  }
  
  if (skippedDueToExistingCoverage.length > 0 || skippedDueToDuplicateWithinGenerated.length > 0 || skippedDueToNonTaxonomySubtype.length > 0) {
    mdContent += `\n---\n\n`;
    mdContent += `## Skipped Candidates\n\n`;
    
    if (skippedDueToExistingCoverage.length > 0) {
      mdContent += `### Skipped Due to Existing Coverage (${skippedDueToExistingCoverage.length})\n\n`;
      mdContent += `| Discipline | Subtype | Reason |\n`;
      mdContent += `|------------|---------|--------|\n`;
      for (const skipped of skippedDueToExistingCoverage) {
        mdContent += `| ${skipped.discipline_code} | ${skipped.subtype_code} | Already covered by existing spine |\n`;
      }
      mdContent += `\n`;
    }
    
    if (skippedDueToDuplicateWithinGenerated.length > 0) {
      mdContent += `### Skipped Due to Duplicate Within Generated (${skippedDueToDuplicateWithinGenerated.length})\n\n`;
      mdContent += `| Discipline | Subtype | Reason |\n`;
      mdContent += `|------------|---------|--------|\n`;
      for (const skipped of skippedDueToDuplicateWithinGenerated) {
        mdContent += `| ${skipped.discipline_code} | ${skipped.subtype_code} | Duplicate candidate in input |\n`;
      }
      mdContent += `\n`;
    }
    
    if (skippedDueToNonTaxonomySubtype.length > 0) {
      mdContent += `### Skipped Due to Non-Taxonomy Subtype (${skippedDueToNonTaxonomySubtype.length})\n\n`;
      mdContent += `| Discipline | Subtype | Reason |\n`;
      mdContent += `|------------|---------|--------|\n`;
      for (const skipped of skippedDueToNonTaxonomySubtype) {
        mdContent += `| ${skipped.discipline_code} | ${skipped.subtype_code} | Not found in taxonomy |\n`;
      }
      mdContent += `\n`;
    }
  }
  
  mdContent += `\n---\n\n`;
  mdContent += `## Audit Report\n\n`;
  mdContent += `See \`baseline_subtype_v1_audit.json\` for detailed validation results.\n\n`;
  
  fs.writeFileSync(OUTPUT_MD, mdContent, 'utf-8');
  console.log(`[OK] Markdown written\n`);
  
  console.log(`[OK] Generation complete!`);
  console.log(`\nOutput files:`);
  console.log(`  - ${OUTPUT_JSON}`);
  console.log(`  - ${OUTPUT_SQL}`);
  console.log(`  - ${OUTPUT_MD}`);
  console.log(`\n[INFO] Review the markdown file before executing the SQL seed script.`);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('[FATAL]', error);
    process.exit(1);
  });
}

export { main as generateBaselineSubtypeV1 };
