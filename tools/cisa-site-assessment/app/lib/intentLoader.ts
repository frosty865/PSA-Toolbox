/**
 * Intent Loader
 * 
 * Loads intent objects from generated JSON file (server-side only).
 * Provides in-memory caching with mtime check in dev mode.
 * Enriches intent objects with RAG-derived meanings from question_meaning table.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IntentObject, IntentObjectsFile } from './types/intent';
import { getRuntimePool } from './db/runtime_client';

const INTENT_OBJECTS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'intent_objects.v1.json');

// In-memory cache
let cachedIntentObjects: IntentObjectsFile | null = null;
let cachedMtime: number | null = null;

/**
 * Load intent objects from file system
 */
function loadIntentObjectsFromFile(): IntentObjectsFile {
  if (!fs.existsSync(INTENT_OBJECTS_FILE)) {
    throw new Error(`Intent objects file not found: ${INTENT_OBJECTS_FILE}`);
  }

  const content = fs.readFileSync(INTENT_OBJECTS_FILE, 'utf-8');
  const data: IntentObjectsFile = JSON.parse(content);

  // Validate structure
  if (!data.version || !data.questions || !Array.isArray(data.questions)) {
    throw new Error('Invalid intent objects file structure');
  }

  return data;
}

/**
 * Get intent objects (with caching in dev)
 */
function getIntentObjects(): IntentObjectsFile {
  // In production, always load fresh
  // In dev, check mtime and reload if changed
  if (process.env.NODE_ENV === 'development') {
    const stats = fs.statSync(INTENT_OBJECTS_FILE);
    const currentMtime = stats.mtimeMs;

    if (cachedIntentObjects === null || cachedMtime !== currentMtime) {
      cachedIntentObjects = loadIntentObjectsFromFile();
      cachedMtime = currentMtime;
    }

    return cachedIntentObjects;
  }

  // Production: always load fresh (or use cached if already loaded in this process)
  if (cachedIntentObjects === null) {
    cachedIntentObjects = loadIntentObjectsFromFile();
  }

  return cachedIntentObjects;
}

/**
 * Enrich intent object with question meaning from database
 */
export async function enrichIntentWithMeaning(intent: IntentObject): Promise<IntentObject> {
  try {
    const pool = getRuntimePool();
    const result = await pool.query(`
      SELECT meaning_text
      FROM public.question_meaning
      WHERE canon_id = $1
      LIMIT 1
    `, [intent.canon_id]);

    if (result.rows.length > 0 && result.rows[0].meaning_text) {
      return {
        ...intent,
        meaning_text: result.rows[0].meaning_text
      };
    }
  } catch (error) {
    // Silently fail - meaning is optional
    console.debug(`[intentLoader] Could not load meaning for ${intent.canon_id}:`, error);
  }
  return intent;
}

/**
 * Get intent object by canon_id (with meaning enrichment)
 */
export async function getIntentByCanonId(canonId: string): Promise<IntentObject | null> {
  try {
    const data = getIntentObjects();
    const intent = data.questions.find(q => q.canon_id === canonId) || null;
    if (intent) {
      return await enrichIntentWithMeaning(intent);
    }
    return null;
  } catch (error) {
    console.error('[intentLoader] Error loading intent objects:', error);
    return null;
  }
}

/**
 * Get intent object by canon_id (synchronous, no meaning enrichment)
 * Use this when you need synchronous access and meaning is not critical
 */
export function getIntentByCanonIdSync(canonId: string): IntentObject | null {
  try {
    const data = getIntentObjects();
    return data.questions.find(q => q.canon_id === canonId) || null;
  } catch (error) {
    console.error('[intentLoader] Error loading intent objects:', error);
    return null;
  }
}

/**
 * Get intent index as Map<canon_id, IntentObject>
 */
export function getIntentIndex(): Map<string, IntentObject> {
  try {
    const data = getIntentObjects();
    const index = new Map<string, IntentObject>();
    
    for (const intent of data.questions) {
      index.set(intent.canon_id, intent);
    }
    
    return index;
  } catch (error) {
    console.error('[intentLoader] Error building intent index:', error);
    return new Map();
  }
}

/**
 * Get all intent objects
 */
export function getAllIntentObjects(): IntentObject[] {
  try {
    const data = getIntentObjects();
    return data.questions;
  } catch (error) {
    console.error('[intentLoader] Error loading intent objects:', error);
    return [];
  }
}

/**
 * Get intent objects by subtype_code
 */
export function getIntentObjectsBySubtype(subtypeCode: string): IntentObject[] {
  try {
    const data = getIntentObjects();
    return data.questions.filter(q => q.subtype_code === subtypeCode);
  } catch (error) {
    console.error('[intentLoader] Error loading intent objects by subtype:', error);
    return [];
  }
}

/**
 * Intent Payload Types
 * Represents the different types of content that can be shown in "What this question means"
 * 
 * LEGACY INTENT REMOVED: Only Reference Implementation and Subtype Overview are supported.
 * Legacy intent blocks (Intent, What counts as YES, etc.) are no longer rendered.
 */
export type IntentPayload =
  | { kind: "reference_impl"; discipline_subtype_id: string; reference_impl: unknown }
  | { kind: "subtype_overview"; discipline_subtype_id: string; overview: string; references?: string[] }
  | { kind: "no_subtype" };

/**
 * Fetch Reference Implementation from API
 */
async function fetchReferenceImpl(disciplineSubtypeId: string): Promise<unknown | null> {
  try {
    // Server-side: query database directly
    if (typeof window === 'undefined') {
      const pool = getRuntimePool();
      const result = await pool.query(`
        SELECT reference_impl
        FROM public.discipline_subtype_reference_impl
        WHERE discipline_subtype_id = $1
        LIMIT 1
      `, [disciplineSubtypeId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      return result.rows[0].reference_impl;
    }
    
    // Client-side: use API route
    const res = await fetch(`/api/reference/discipline-subtypes/${encodeURIComponent(disciplineSubtypeId)}/reference-impl`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(`[fetchReferenceImpl] API returned ${res.status}`);
      return null;
    }
    
    const json = await res.json();
    return json?.reference_impl ?? json;
  } catch (error) {
    console.error('[fetchReferenceImpl] Error:', error);
    return null;
  }
}

/**
 * Load subtype overview only (Overview + References, no risk/failure/mitigation)
 * 
 * DB-BACKED: Queries public.discipline_subtypes table via getSubtypeGuidanceById.
 * This is the authoritative source - no static file fallbacks.
 * 
 * Returns only Overview and References for baseline UI.
 * No Indicators of Risk, Common Failures, or Mitigation Guidance.
 */
async function loadSubtypeOverviewOnly(disciplineSubtypeId: string): Promise<{ overview: string; references?: string[] } | null> {
  try {
    const { getSubtypeGuidanceById } = await import('./taxonomy/subtype_guidance');
    // getSubtypeGuidanceById queries database directly - fully DB-backed
    return await getSubtypeGuidanceById(disciplineSubtypeId);
  } catch (error) {
    console.error('[loadSubtypeOverviewOnly] Error:', error);
    return null;
  }
}

/**
 * Authoritative intent loader - NO LEGACY INTENT PATHWAY
 * 
 * Returns ONLY:
 * - Reference Implementation (if discipline_subtype_id exists and ref impl found)
 * - Subtype Overview (if discipline_subtype_id exists but no ref impl)
 * - No subtype message (if discipline_subtype_id is missing)
 * 
 * Legacy intent blocks are REMOVED from the product path entirely.
 */
export async function loadIntentForQuestion(opts: {
  discipline_subtype_id: string | null;
  canon_id?: string;
  question_code?: string;
}): Promise<IntentPayload> {
  const subtypeId = opts.discipline_subtype_id?.trim();
  
  if (subtypeId) {
    // Try Reference Implementation first
    const refImpl = await fetchReferenceImpl(subtypeId);
    if (refImpl) {
      return { kind: "reference_impl", discipline_subtype_id: subtypeId, reference_impl: refImpl };
    }
    
    // Fall back to subtype overview
    const overview = await loadSubtypeOverviewOnly(subtypeId);
    if (overview && overview.overview) {
      return { kind: "subtype_overview", discipline_subtype_id: subtypeId, overview: overview.overview, references: overview.references };
    }
    
    // No reference impl and no overview - return minimal message
    return { kind: "subtype_overview", discipline_subtype_id: subtypeId, overview: "Subtype guidance is available for this question, but no reference implementation has been authored yet." };
  }
  
  // No subtype assigned: return no_subtype (legacy intent REMOVED)
  return { kind: "no_subtype" };
}
