/**
 * PSA metadata extraction via Ollama (psa-metadata:latest).
 * CORPUS only. Output is strict JSON; no VOFC or assessment logic.
 */

import type { SectorTaxonomyResult } from '@/app/lib/taxonomy/get_sector_taxonomy';
import { getMetadataModel } from '@/app/lib/ollama/ollamaModels';
import { getOllamaBaseUrl, ollamaGenerate } from '@/app/lib/ollama/ollama_client';

export type ExtractedMetadata = {
  title: string | null;
  publisher_or_agency: string | null;
  publication_date: string | null;
  synopsis: string | null;
  sector: string | null;
  subsector: string | null;
};

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const OLLAMA_TIMEOUT_MS = 90_000;

function nullResult(): ExtractedMetadata {
  return {
    title: null,
    publisher_or_agency: null,
    publication_date: null,
    synopsis: null,
    sector: null,
    subsector: null,
  };
}

function extractJsonFromResponse(raw: string): string | null {
  const trimmed = raw.trim();
  const stripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function validateAndSanitize(
  parsed: Record<string, unknown>,
  taxonomy: SectorTaxonomyResult
): ExtractedMetadata {
  const sectorCodes = new Set(taxonomy.sectors.map((s) => s.code));
  const subsectorByCode = new Map(taxonomy.subsectors.map((s) => [s.code, s]));

  const title = typeof parsed.title === 'string' ? parsed.title.trim() || null : null;
  const publisher_or_agency = typeof parsed.publisher_or_agency === 'string' ? parsed.publisher_or_agency.trim() || null : null;
  const pubDateRaw = parsed.publication_date;
  const publication_date =
    typeof pubDateRaw === 'string' && ISO_DATE_REGEX.test(pubDateRaw.trim()) ? pubDateRaw.trim() : null;
  const synopsis = typeof parsed.synopsis === 'string' ? parsed.synopsis.trim() || null : null;
  let sector: string | null = typeof parsed.sector === 'string' ? parsed.sector.trim() || null : null;
  let subsector: string | null = typeof parsed.subsector === 'string' ? parsed.subsector.trim() || null : null;

  if (sector !== null && !sectorCodes.has(sector)) sector = null;
  if (subsector !== null) {
    const sub = subsectorByCode.get(subsector);
    if (!sub || (sector !== null && sub.sector_code !== sector)) subsector = null;
    else if (sector === null) sector = sub.sector_code || null;
  }

  return {
    title,
    publisher_or_agency,
    publication_date,
    synopsis,
    sector,
    subsector,
  };
}

/** Escape for regex; require name as whole phrase (word boundaries). */
function phraseInText(text: string, nameLower: string): boolean {
  if (!nameLower.trim()) return false;
  const escaped = nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const re = new RegExp('\\b' + escaped + '\\b', 'i');
  return re.test(text);
}

/**
 * Evidence gate for sector only. High precision; no synonyms.
 * Exported for remediate_scope_tags.ts.
 */
export function evidenceSupportsSector(
  sectorCode: string | null,
  evidenceText: string,
  taxonomy: SectorTaxonomyResult
): boolean {
  if (sectorCode == null) return true;
  const sectors = Array.isArray(taxonomy?.sectors) ? taxonomy.sectors : [];
  const sector = sectors.find((s) => s.code === sectorCode);
  if (!sector) return false;
  const text = evidenceText.toLowerCase().trim();
  const sectorName = sector.name.toLowerCase();
  return (
    phraseInText(text, sectorName) ||
    (text.includes('sector:') && phraseInText(text, sectorName)) ||
    (text.includes('sector-specific') && phraseInText(text, sectorName))
  );
}

/**
 * Evidence gate for subsector only. High precision; no synonyms.
 * Exported for remediate_scope_tags.ts.
 */
export function evidenceSupportsSubsector(
  subsectorCode: string | null,
  evidenceText: string,
  taxonomy: SectorTaxonomyResult
): boolean {
  if (subsectorCode == null) return true;
  const subsectors = Array.isArray(taxonomy?.subsectors) ? taxonomy.subsectors : [];
  const subsector = subsectors.find((s) => s.code === subsectorCode);
  if (!subsector) return false;
  const text = evidenceText.toLowerCase().trim();
  const subsectorName = subsector.name.toLowerCase();
  return (
    phraseInText(text, subsectorName) ||
    (text.includes('subsector:') && phraseInText(text, subsectorName)) ||
    (text.includes('subsector') && phraseInText(text, subsectorName))
  );
}

/**
 * Combined evidence gate (both sector and subsector). For backward compat / remediate.
 * Returns true only if sector passes and (subsector is null or subsector passes).
 */
export function evidenceSupportsTag(
  sectorCode: string | null,
  subsectorCode: string | null,
  taxonomy: SectorTaxonomyResult,
  evidenceText: string
): boolean {
  return (
    evidenceSupportsSector(sectorCode, evidenceText, taxonomy) &&
    evidenceSupportsSubsector(subsectorCode, evidenceText, taxonomy)
  );
}

export type MetadataExtractionInput = {
  /** PDF metadata (title, author, etc.) */
  pdf_metadata?: Record<string, unknown>;
  /** First page or early text excerpt for evidence */
  excerpt?: string;
  /** Optional filename for hints */
  filename?: string;
  /** Taxonomy for sector/subsector validation; if omitted, sector/subsector will be null */
  taxonomy?: SectorTaxonomyResult;
};

/**
 * Call Ollama /api/generate with getMetadataModel() (PSA_METADATA_MODEL).
 * Returns valid ExtractedMetadata; on parse/validation failure returns all fields null.
 */
export async function extractDocumentMetadata(input: MetadataExtractionInput): Promise<ExtractedMetadata> {
  const taxonomy = input.taxonomy ?? { sectors: [], subsectors: [] };
  const payload = {
    pdf_metadata: input.pdf_metadata ?? {},
    excerpt: input.excerpt ?? '',
    filename: input.filename ?? null,
    sectors: taxonomy.sectors,
    subsectors: taxonomy.subsectors,
  };
  const prompt = JSON.stringify(payload);

  const metadataModel = getMetadataModel();
  try {
    const gen = await ollamaGenerate(
      {
        model: metadataModel,
        prompt,
        stream: false,
        options: { temperature: 0, top_p: 0.1 },
      },
      OLLAMA_TIMEOUT_MS,
      'metadata'
    );
    const raw = typeof gen?.response === 'string' ? gen.response.trim() : '';
    if (!raw) return nullResult();

    const jsonStr = extractJsonFromResponse(raw);
    if (!jsonStr) {
      console.warn(`[metadata] model=${metadataModel} baseUrl=${getOllamaBaseUrl()} response not JSON, snippet: ${raw.slice(0, 120)}`);
      return nullResult();
    }

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    let metadata = validateAndSanitize(parsed, taxonomy);
    const evidenceText = [
      input.filename ?? '',
      typeof input.pdf_metadata?.title === 'string' ? input.pdf_metadata.title : '',
      input.excerpt ?? '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const sectors = Array.isArray(taxonomy?.sectors) ? taxonomy.sectors : [];
    const subsectors = Array.isArray(taxonomy?.subsectors) ? taxonomy.subsectors : [];

    if (!evidenceSupportsSector(metadata.sector, evidenceText, taxonomy)) {
      if (metadata.sector != null) {
        const name = sectors.find((s) => s.code === metadata.sector)?.name ?? metadata.sector;
        console.warn(`[metadata] dropped sector code=${metadata.sector} name=${name} (no explicit evidence)`);
      }
      metadata = { ...metadata, sector: null };
    }
    if (!evidenceSupportsSubsector(metadata.subsector, evidenceText, taxonomy)) {
      if (metadata.subsector != null) {
        const name = subsectors.find((s) => s.code === metadata.subsector)?.name ?? metadata.subsector;
        console.warn(`[metadata] dropped subsector code=${metadata.subsector} name=${name} (no explicit evidence)`);
      }
      metadata = { ...metadata, subsector: null };
    }
    if (metadata.subsector != null) {
      const sub = subsectors.find((s) => s.code === metadata.subsector);
      if (sub?.sector_code) metadata = { ...metadata, sector: sub.sector_code };
    }
    return metadata;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(`[metadata] ollama error model=${metadataModel} baseUrl=${getOllamaBaseUrl()} msg=${err.message}`);
    return nullResult();
  }
}
