/**
 * Checklist Loader
 * 
 * Loads subtype checklists and depth-2 question tags from generated JSON files.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SubtypeChecklist, SubtypeChecklistsFile, Depth2QuestionTagsFile } from './types/checklist';

const CHECKLISTS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'subtype_checklists.v1.json');
const TAGS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'depth2_question_tags.v1.json');

// In-memory cache
let checklistsCache: Map<string, SubtypeChecklist> | null = null;
let tagsCache: Map<string, string[]> | null = null;
let tagsBySubtypeCache: Map<string, Map<string, string[]>> | null = null;

/**
 * Load checklists from file
 */
function loadChecklists(): Map<string, SubtypeChecklist> {
  if (checklistsCache !== null) {
    return checklistsCache;
  }

  if (!fs.existsSync(CHECKLISTS_FILE)) {
    console.warn(`[WARN] Checklists file not found: ${CHECKLISTS_FILE}`);
    checklistsCache = new Map();
    return checklistsCache;
  }

  const content = fs.readFileSync(CHECKLISTS_FILE, 'utf-8');
  const data: SubtypeChecklistsFile = JSON.parse(content);

  checklistsCache = new Map();
  for (const checklist of data.checklists || []) {
    checklistsCache.set(checklist.subtype_code, checklist);
  }

  return checklistsCache;
}

/**
 * Load tags from file
 */
function loadTags(): Map<string, string[]> {
  if (tagsCache !== null) {
    return tagsCache;
  }

  if (!fs.existsSync(TAGS_FILE)) {
    console.warn(`[WARN] Tags file not found: ${TAGS_FILE}`);
    tagsCache = new Map();
    return tagsCache;
  }

  const content = fs.readFileSync(TAGS_FILE, 'utf-8');
  const data: Depth2QuestionTagsFile = JSON.parse(content);

  tagsCache = new Map();
  for (const question of data.questions || []) {
    tagsCache.set(question.canon_id, question.tags);
  }

  return tagsCache;
}

/**
 * Load tags indexed by subtype
 */
function loadTagsBySubtype(): Map<string, Map<string, string[]>> {
  if (tagsBySubtypeCache !== null) {
    return tagsBySubtypeCache;
  }

  if (!fs.existsSync(TAGS_FILE)) {
    console.warn(`[WARN] Tags file not found: ${TAGS_FILE}`);
    tagsBySubtypeCache = new Map();
    return tagsBySubtypeCache;
  }

  const content = fs.readFileSync(TAGS_FILE, 'utf-8');
  const data: Depth2QuestionTagsFile = JSON.parse(content);

  tagsBySubtypeCache = new Map();
  for (const question of data.questions || []) {
    if (!tagsBySubtypeCache.has(question.subtype_code)) {
      tagsBySubtypeCache.set(question.subtype_code, new Map());
    }
    tagsBySubtypeCache.get(question.subtype_code)!.set(question.canon_id, question.tags);
  }

  return tagsBySubtypeCache;
}

/**
 * Get checklist for a subtype
 */
export function getChecklist(subtype_code: string | null | undefined): SubtypeChecklist | null {
  if (!subtype_code) {
    return null;
  }

  const checklists = loadChecklists();
  return checklists.get(subtype_code) || null;
}

/**
 * Get checklist by subtype (alias for getChecklist)
 */
export function getChecklistBySubtype(subtype_code: string | null | undefined): SubtypeChecklist | null {
  return getChecklist(subtype_code);
}

/**
 * Get all checklists as a map
 */
export function getChecklistIndex(): Map<string, SubtypeChecklist> {
  return loadChecklists();
}

/**
 * Get tags for a depth-2 question
 */
export function getDepth2Tags(canon_id: string | null | undefined): string[] {
  if (!canon_id) {
    return [];
  }

  const tags = loadTags();
  return tags.get(canon_id) || [];
}

/**
 * Get all tags for questions in a subtype
 */
export function getDepth2TagsIndex(): Map<string, string[]> {
  return loadTags();
}

/**
 * Get tags for all depth-2 questions in a subtype
 */
export function getDepth2TagsBySubtype(subtype_code: string | null | undefined): Map<string, string[]> {
  if (!subtype_code) {
    return new Map();
  }

  const tagsBySubtype = loadTagsBySubtype();
  return tagsBySubtype.get(subtype_code) || new Map();
}

/**
 * Clear cache (useful for testing)
 */
export function clearCache(): void {
  checklistsCache = null;
  tagsCache = null;
  tagsBySubtypeCache = null;
}
