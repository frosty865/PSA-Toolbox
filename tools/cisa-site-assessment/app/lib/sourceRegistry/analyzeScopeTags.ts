/**
 * Analyze document chunks to decide scope tags (discipline, subtype, module, sector, subsector).
 * Uses Ollama to classify excerpt; returns only allowed tags or empty (no fallback).
 *
 * Sector/subsector from document content:
 * 1. Title: deriveScopeTagsFromTitle() matches title text to sector/subsector (and keywords for education, mass gathering, EV, etc.).
 * 2. Content: analyzeScopeTagsFromExcerpt() sends a chunk excerpt to Ollama to choose 1–2 sector/subsector tags.
 * Use inferScopeTagsFromContentForSource() after ingestion to run both and update source_registry.scope_tags.
 */

import type { Pool } from 'pg';
import {
  enforceSectorSubsectorConsistency,
  getAllowedScopeTagValues,
  normalizeScopeTagsByPrecedence,
  extractScopeTagStrings,
  isGenericSectorSubsectorOnly,
  isBasicPhysicalSecurityTitle,
  getGeneralSectorSubsectorTags,
  FALLBACK_TITLE_TAG,
  type ScopeTagAllowedSets,
} from './scopeTags';
import { scopeTagsFromStrings } from './scope_tags';

const DEFAULT_MAX_CHUNKS = 30;
const DEFAULT_MAX_CHARS = 28000;
const OLLAMA_TIMEOUT_MS = 60000;

/**
 * Fetch concatenated chunk text for a source (from corpus_documents + document_chunks).
 * Used as input for scope-tag analysis. Uses admin pool (caller must pass it).
 */
export async function getChunkExcerptForSource(
  pool: Pool,
  sourceRegistryId: string,
  options: { maxChunks?: number; maxChars?: number } = {}
): Promise<string> {
  const maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;

  const rows = await pool.query<{ chunk_text: string }>(
    `SELECT dc.chunk_text
     FROM public.document_chunks dc
     JOIN public.corpus_documents cd ON cd.id = dc.document_id
     WHERE cd.source_registry_id = $1
     ORDER BY dc.document_id, dc.chunk_index
     LIMIT $2`,
    [sourceRegistryId, maxChunks]
  );

  if (!rows.rows?.length) return '';

  let out = '';
  for (const r of rows.rows) {
    if (out.length >= maxChars) break;
    const text = (r.chunk_text || '').trim();
    if (!text) continue;
    out += (out ? '\n\n' : '') + text;
    if (out.length > maxChars) out = out.slice(0, maxChars);
  }
  return out.trim();
}

/** Top-tier only: sector and subsector. All data is sector/subsector-specific; once tagged at top tier, done. */
const MAX_SCOPE_TAGS = 2;

function isNumericTag(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function getSectorSubsectorList(allowed: ScopeTagAllowedSets): string[] {
  const list: string[] = [];
  for (const id of allowed.sectorIds) if (!isNumericTag(id)) list.push(id);
  for (const id of allowed.subsectorIds) if (!isNumericTag(id)) list.push(id);
  return [...new Set(list)].sort();
}

function isSectorOrSubsector(tag: string, allowed: ScopeTagAllowedSets): boolean {
  if (!tag || typeof tag !== 'string') return false;
  const t = tag.trim();
  const upper = t.toUpperCase();
  return (
    allowed.sectorIds.has(t) ||
    allowed.sectorIds.has(upper) ||
    allowed.subsectorIds.has(t) ||
    allowed.subsectorIds.has(upper)
  );
}

/**
 * Restrict to sector/subsector only and cap at MAX_SCOPE_TAGS (2). No discipline/subtype/module.
 */
export function restrictToSectorSubsectorAndCap(tags: string[], allowed: ScopeTagAllowedSets): string[] {
  const out: string[] = [];
  for (const t of tags) {
    if (isSectorOrSubsector(t, allowed) && !out.includes(t)) out.push(t);
    if (out.length >= MAX_SCOPE_TAGS) break;
  }
  return out;
}

/** Title keywords that indicate education/school scope; match sector/subsector names containing these. */
const EDUCATION_TITLE_KEYWORDS = ['school', 'schools', 'k-12', 'k12', 'education'];
const EDUCATION_TAG_KEYWORDS = ['education', 'school', 'k-12', 'k12'];

/**
 * Derive scope tags from source title by matching sector and subsector only.
 * When title contains "school", "k-12", "education" etc., also matches sector/subsector whose name contains education/school/k-12.
 * Returns matches; caller runs normalizeScopeTagsByPrecedence to order (Sector → Subsector) and cap at 2.
 */
export function deriveScopeTagsFromTitle(title: string, allowed: ScopeTagAllowedSets): string[] {
  if (!title || typeof title !== 'string') return [];
  const titleLower = title.toLowerCase().trim();
  if (titleLower.length < 2) return [];

  const allowedList = getSectorSubsectorList(allowed);
  const matched: string[] = [];
  const seen = new Set<string>();

  for (const tag of allowedList) {
    const tagLower = tag.toLowerCase();
    if (titleLower.includes(tagLower) && !seen.has(tag)) {
      seen.add(tag);
      matched.push(tag);
      continue;
    }
    const words = tagLower.split(/[_\-]+/).filter((w) => w.length >= 4);
    for (const word of words) {
      if (titleLower.includes(word) && !seen.has(tag)) {
        seen.add(tag);
        matched.push(tag);
        break;
      }
    }
  }

  // If title mentions school/education/k-12 but no match yet, add any sector/subsector that represents education
  const hasEducationHint = EDUCATION_TITLE_KEYWORDS.some((kw) => titleLower.includes(kw));
  if (hasEducationHint) {
    for (const tag of allowedList) {
      if (seen.has(tag)) continue;
      const tagLower = tag.toLowerCase();
      if (EDUCATION_TAG_KEYWORDS.some((kw) => tagLower.includes(kw))) {
        seen.add(tag);
        matched.push(tag);
        break;
      }
    }
  }

  // Mass Gathering / Public Venue: sector = Commercial Facilities, subsector = Mass Gathering (triage_rules.json)
  const hasMassGatheringHint = /mass\s*gathering|public\s*venue|crowded\s*places|large\s*public\s*event|crowd\s*management|security\s*planning\s*tool/.test(titleLower);
  const MASS_GATHERING_TAG_KEYWORDS = ['mass', 'gathering', 'commercial', 'venue', 'crowd', 'facilities'];
  if (hasMassGatheringHint) {
    for (const tag of allowedList) {
      if (seen.has(tag)) continue;
      const tagLower = tag.toLowerCase();
      if (MASS_GATHERING_TAG_KEYWORDS.some((kw) => tagLower.includes(kw))) {
        seen.add(tag);
        matched.push(tag);
      }
    }
  }

  // IRMPE = Insider Risk Management Program -> module (MODULE_IRMPE or MODULE_INSIDER_THREAT)
  const hasIRMPEHint = /\birmpe\b|insider\s*risk\s*management\s*program|insider\s*risk\s*management/.test(titleLower);
  const IRMPE_MODULE_KEYWORDS = ['irmpe', 'insider'];
  if (hasIRMPEHint && allowed.moduleCodes) {
    for (const moduleCode of allowed.moduleCodes) {
      if (seen.has(moduleCode)) continue;
      const codeLower = moduleCode.toLowerCase();
      if (IRMPE_MODULE_KEYWORDS.some((kw) => codeLower.includes(kw))) {
        seen.add(moduleCode);
        matched.push(moduleCode);
        break;
      }
    }
  }

  // Electric Vehicle (EV) -> EV module (MODULE_EV_PARKING, MODULE_EV_CHARGING, etc.)
  const hasEVHint = /\belectric\s*vehicle\b|\bev\s+module\b|\bev\s+parking\b|\bev\s+charging\b|\bev\s+fire\b|\bev\s+rescue\b/.test(titleLower);
  if (hasEVHint && allowed.moduleCodes) {
    for (const moduleCode of allowed.moduleCodes) {
      if (seen.has(moduleCode)) continue;
      const codeLower = moduleCode.toLowerCase();
      // Match MODULE_EV_* (ev_parking, ev_charging, etc.)
      if (codeLower.includes('_ev_') || codeLower.startsWith('module_ev')) {
        seen.add(moduleCode);
        matched.push(moduleCode);
        break;
      }
    }
  }

  return matched;
}

/** For analysis prompt: sectors and subsectors only (top tier). */
function getSectorsSubsectorsForPrompt(allowed: ScopeTagAllowedSets): { sectors: string[]; subsectors: string[] } {
  return {
    sectors: [...allowed.sectorIds].sort(),
    subsectors: [...allowed.subsectorIds].sort(),
  };
}

/** Try to map a model response tag to an allowed sector/subsector (exact or case-insensitive). */
function resolveToSectorSubsector(tag: string, allowed: ScopeTagAllowedSets): string | null {
  if (isSectorOrSubsector(tag, allowed)) return tag.trim();
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, '_');
  const list = getSectorSubsectorList(allowed);
  for (const a of list) {
    if (a.toLowerCase() === normalized) return a;
    if (a.toLowerCase().replace(/\s+/g, '_') === normalized) return a;
    if (a.toLowerCase().includes(normalized) || normalized.includes(a.toLowerCase())) return a;
  }
  return null;
}

/** Extract JSON array from raw LLM response (strip code fences, find [...] ). */
function extractTagArray(raw: string): string[] {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = s.match(/\[[\s\S]*\]/);
  const jsonStr = match ? match[0] : s;
  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t && !isNumericTag(t));
  } catch {
    return [];
  }
}

/**
 * Call Ollama to classify document excerpt. Top-tier only: only sector/subsector tags
 * are requested and returned; once tagged at sector/subsector, we're done (cap 2).
 */
export async function analyzeScopeTagsFromExcerpt(
  excerpt: string,
  allowed: ScopeTagAllowedSets
): Promise<string[]> {
  if (!excerpt || excerpt.length < 50) return [];

  const { sectors, subsectors } = getSectorsSubsectorsForPrompt(allowed);
  if (sectors.length === 0 && subsectors.length === 0) return [];

  const raw = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').trim().replace(/\/+$/, '');
  let ollamaHost = raw.replace(/\blocalhost\b/gi, '127.0.0.1').replace(/\b0\.0\.0\.0\b/g, '127.0.0.1');
  if (!/^https?:\/\//i.test(ollamaHost)) ollamaHost = `http://${ollamaHost}`;
  const model = process.env.OLLAMA_SCOPE_TAG_MODEL ?? 'llama3.1';

  const sections: string[] = [];
  if (sectors.length) sections.push(`Sectors: ${sectors.join(', ')}`);
  if (subsectors.length) sections.push(`Subsectors: ${subsectors.join(', ')}`);
  const allowedBlock = sections.join('\n');

  const prompt = `You are a classifier. From the document excerpt below, choose 1 or 2 scope tags that best describe its sector or subsector. Use ONLY exact values from the lists—copy them exactly.

${allowedBlock}

Rules: Return ONLY a JSON array of 1–2 strings. No other text. Use exact spelling from the lists above. Example: ["education_facilities"]

DOCUMENT EXCERPT:
${excerpt.slice(0, 26000)}

JSON array of tags:`;

  try {
    const res = await fetch(`${ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[analyzeScopeTags] Ollama ${res.status}: ${await res.text().catch(() => '')}`);
      return [];
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const raw = (data.message?.content || '').trim();
    if (!raw) return [];

    const tags = extractTagArray(raw);
    const resolved: string[] = [];
    const seen = new Set<string>();
    for (const t of tags) {
      const r = resolveToSectorSubsector(t, allowed);
      if (r && !seen.has(r)) {
        seen.add(r);
        resolved.push(r);
      }
    }
    const capped = restrictToSectorSubsectorAndCap(resolved, allowed);
    return enforceSectorSubsectorConsistency(capped, allowed);
  } catch (e) {
    console.warn('[analyzeScopeTags] Ollama request failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

export type InferScopeTagsResult =
  | { updated: true; from: 'existing' | 'title' | 'excerpt' | 'fallback' }
  | { updated: false; error?: string };

/** Basic physical security docs: store General, General (All Sectors) instead of the fallback label. */
function scopeTagsToWriteForBasicPhysicalSecurity(
  tags: string[],
  title: string,
  allowed: ScopeTagAllowedSets
): string[] {
  if (tags.length === 1 && tags[0] === FALLBACK_TITLE_TAG && isBasicPhysicalSecurityTitle(title)) {
    const general = getGeneralSectorSubsectorTags(allowed);
    if (general) return general;
  }
  return tags;
}

/**
 * Infer sector/subsector from document content for a single source and update source_registry.scope_tags.
 * Uses: existing tags (normalized) → title-derived → excerpt (Ollama). Safe to call after ingestion.
 */
function stringsToScopeTagsJson(strings: string[], allowed: ScopeTagAllowedSets): string {
  const taxonomy = { sectors: allowed.sectorOptions.map((o) => ({ code: o.value, name: o.label })), subsectors: allowed.subsectorOptions.map((o) => ({ code: o.value, sector_code: o.sector_id, name: o.label })) };
  const scopeTags = scopeTagsFromStrings(strings, taxonomy, allowed.moduleCodes);
  return JSON.stringify(scopeTags);
}

export async function inferScopeTagsFromContentForSource(
  corpusPool: Pool,
  sourceRegistryId: string
): Promise<InferScopeTagsResult> {
  try {
    const rowResult = await corpusPool.query<{ id: string; source_key: string; title: string | null; scope_tags: unknown }>(
      `SELECT id, source_key, title, scope_tags FROM public.source_registry WHERE id = $1`,
      [sourceRegistryId]
    );
    const row = rowResult.rows?.[0];
    if (!row) return { updated: false, error: 'Source not found' };

    const allowed = await getAllowedScopeTagValues();
    const title = row.title ?? '';
    let currentStrings = extractScopeTagStrings(row.scope_tags);

    let moduleCode: string | null = null;
    try {
      const hasModule = await corpusPool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'module_source_documents'`
      );
      if (hasModule.rows?.length) {
        const moduleRows = await corpusPool.query<{ module_code: string }>(
          `SELECT DISTINCT msd.module_code FROM public.module_source_documents msd
           JOIN public.corpus_documents cd ON cd.id = msd.corpus_document_id
           WHERE cd.source_registry_id = $1 LIMIT 1`,
          [row.id]
        );
        moduleCode = moduleRows.rows?.[0]?.module_code?.trim() ?? null;
        if (moduleCode && !currentStrings.includes(moduleCode)) currentStrings = [moduleCode, ...currentStrings];
      }
    } catch {
      // ignore
    }

    const normalizedExisting = normalizeScopeTagsByPrecedence(currentStrings, allowed, title);
    const existingFinal = enforceSectorSubsectorConsistency(normalizedExisting, allowed);
    // Keep existing if real sector/subsector, or if "General, General" and doc is basic physical security
    if (existingFinal.length > 0 && (!isGenericSectorSubsectorOnly(existingFinal, allowed) || isBasicPhysicalSecurityTitle(title))) {
      await corpusPool.query(
        `UPDATE public.source_registry SET scope_tags = $1::jsonb, updated_at = now() WHERE id = $2`,
        [stringsToScopeTagsJson(existingFinal, allowed), row.id]
      );
      return { updated: true, from: 'existing' };
    }

    const titleDerived = deriveScopeTagsFromTitle(title, allowed);
    const titleWithModule = moduleCode ? [moduleCode, ...titleDerived] : titleDerived;
    const fromTitleFinal = enforceSectorSubsectorConsistency(
      normalizeScopeTagsByPrecedence(titleWithModule, allowed, title),
      allowed
    );
    if (fromTitleFinal.length > 0) {
      const toWrite = scopeTagsToWriteForBasicPhysicalSecurity(fromTitleFinal, title, allowed);
      await corpusPool.query(
        `UPDATE public.source_registry SET scope_tags = $1::jsonb, updated_at = now() WHERE id = $2`,
        [stringsToScopeTagsJson(toWrite, allowed), row.id]
      );
      return { updated: true, from: 'title' };
    }

    const excerpt = await getChunkExcerptForSource(corpusPool, row.id);
    if (!excerpt || excerpt.length < 50) {
      const fallback = enforceSectorSubsectorConsistency(
        normalizeScopeTagsByPrecedence(moduleCode ? [moduleCode] : [], allowed, title),
        allowed
      );
      const toWrite = scopeTagsToWriteForBasicPhysicalSecurity(fallback, title, allowed);
      await corpusPool.query(
        `UPDATE public.source_registry SET scope_tags = $1::jsonb, updated_at = now() WHERE id = $2`,
        [stringsToScopeTagsJson(toWrite, allowed), row.id]
      );
      return { updated: true, from: 'fallback' };
    }

    const excerptTags = await analyzeScopeTagsFromExcerpt(excerpt, allowed);
    const excerptWithModule = moduleCode ? [moduleCode, ...excerptTags] : excerptTags;
    const fromExcerptFinal = enforceSectorSubsectorConsistency(
      normalizeScopeTagsByPrecedence(excerptWithModule, allowed, title),
      allowed
    );
    const toWrite = scopeTagsToWriteForBasicPhysicalSecurity(fromExcerptFinal, title, allowed);
    await corpusPool.query(
      `UPDATE public.source_registry SET scope_tags = $1::jsonb, updated_at = now() WHERE id = $2`,
      [stringsToScopeTagsJson(toWrite, allowed), row.id]
    );
    return { updated: true, from: 'excerpt' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[inferScopeTagsFromContentForSource]', sourceRegistryId, message);
    return { updated: false, error: message };
  }
}
