import { NextResponse } from 'next/server';
import { getCorpusPoolForAdmin } from '@/app/lib/db/corpus_client';
import { getAllowedScopeTagValues, normalizeScopeTagsByPrecedence, extractScopeTagStrings, enforceSectorSubsectorConsistency, isGenericSectorSubsectorOnly, isBasicPhysicalSecurityTitle, getGeneralSectorSubsectorTags, FALLBACK_TITLE_TAG } from '@/app/lib/sourceRegistry/scopeTags';
import { scopeTagsFromStrings } from '@/app/lib/sourceRegistry/scope_tags';
import {
  getChunkExcerptForSource,
  analyzeScopeTagsFromExcerpt,
  deriveScopeTagsFromTitle,
} from '@/app/lib/sourceRegistry/analyzeScopeTags';

export const dynamic = 'force-dynamic';

/** For basic physical security docs, store General, General (All Sectors) instead of the fallback label. */
function scopeTagsToWrite(tags: string[], title: string, allowed: Awaited<ReturnType<typeof getAllowedScopeTagValues>>): string[] {
  if (tags.length === 1 && tags[0] === FALLBACK_TITLE_TAG && isBasicPhysicalSecurityTitle(title)) {
    const general = getGeneralSectorSubsectorTags(allowed);
    if (general) return general;
  }
  return tags;
}

function stringsToScopeTagsJson(strings: string[], allowed: Awaited<ReturnType<typeof getAllowedScopeTagValues>>): string {
  const taxonomy = {
    sectors: allowed.sectorOptions.map((o) => ({ code: o.value, name: o.label })),
    subsectors: allowed.subsectorOptions.map((o) => ({ code: o.value, sector_code: o.sector_id, name: o.label })),
  };
  const scopeTags = scopeTagsFromStrings(strings, taxonomy, allowed.moduleCodes);
  return JSON.stringify(scopeTags);
}

/**
 * POST /api/admin/source-registry/rerun-scope-tags
 * Fix scope_tags: filter numerics, order by Sector → Subsector → Discipline → Subtype, max 2.
 * If missing: derive from title, then from excerpt (Ollama). Basic physical security docs → General, General (All Sectors).
 */
export async function POST() {
  try {
    const corpusPool = getCorpusPoolForAdmin();
    const allowed = await getAllowedScopeTagValues();

    const rows = await corpusPool.query<{ id: string; source_key: string; title: string | null; scope_tags: unknown }>(
      `SELECT id, source_key, title, scope_tags FROM public.source_registry`
    );

    let updated = 0;
    let fromExisting = 0;
    let fromTitle = 0;
    let fromExcerpt = 0;
    let noChunks = 0;
    let analysisEmpty = 0;
    const errors: string[] = [];

    const hasModuleSourceDocuments = await corpusPool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'module_source_documents'`
    );
    const canQueryModule = hasModuleSourceDocuments.rows?.length > 0;

    for (const row of rows.rows || []) {
      try {
        const title = row.title ?? '';
        let currentStrings = extractScopeTagStrings(row.scope_tags);
        // If this source is part of a module (has corpus_documents linked via module_source_documents), add that module_code
        let moduleCode: string | null = null;
        if (canQueryModule) {
          const moduleRows = await corpusPool.query<{ module_code: string }>(
            `SELECT DISTINCT msd.module_code
             FROM public.module_source_documents msd
             JOIN public.corpus_documents cd ON cd.id = msd.corpus_document_id
             WHERE cd.source_registry_id = $1
             LIMIT 1`,
            [row.id]
          );
          moduleCode = moduleRows.rows?.[0]?.module_code?.trim() ?? null;
          if (moduleCode && !currentStrings.includes(moduleCode)) {
            currentStrings = [moduleCode, ...currentStrings];
          }
        }
        const normalizedExisting = normalizeScopeTagsByPrecedence(currentStrings, allowed, title);
        const existingFinal = enforceSectorSubsectorConsistency(normalizedExisting, allowed);
        // Keep existing if real sector/subsector, or if "General, General" and doc is basic physical security
        if (existingFinal.length > 0 && (!isGenericSectorSubsectorOnly(existingFinal, allowed) || isBasicPhysicalSecurityTitle(title))) {
          fromExisting++;
          await corpusPool.query(
            `UPDATE public.source_registry SET scope_tags = $1::jsonb, updated_at = now() WHERE id = $2`,
            [stringsToScopeTagsJson(existingFinal, allowed), row.id]
          );
          updated++;
          continue;
        }

        const titleDerived = deriveScopeTagsFromTitle(title, allowed);
        const titleWithModule = moduleCode ? [moduleCode, ...titleDerived] : titleDerived;
        const fromTitleNormalized = normalizeScopeTagsByPrecedence(titleWithModule, allowed, title);
        const fromTitleFinal = enforceSectorSubsectorConsistency(fromTitleNormalized, allowed);
        if (fromTitleFinal.length > 0) {
          fromTitle++;
          const toWrite = scopeTagsToWrite(fromTitleFinal, title, allowed);
          await corpusPool.query(
            `UPDATE public.source_registry SET scope_tags = $1::jsonb, updated_at = now() WHERE id = $2`,
            [stringsToScopeTagsJson(toWrite, allowed), row.id]
          );
          updated++;
          continue;
        }

        const excerpt = await getChunkExcerptForSource(corpusPool, row.id);
        if (!excerpt || excerpt.length < 50) {
          noChunks++;
          const fallback = normalizeScopeTagsByPrecedence(moduleCode ? [moduleCode] : [], allowed, title);
          const fallbackFinal = enforceSectorSubsectorConsistency(fallback, allowed);
          const toWrite = scopeTagsToWrite(fallbackFinal, title, allowed);
          await corpusPool.query(
            `UPDATE public.source_registry SET scope_tags = $1::jsonb, updated_at = now() WHERE id = $2`,
            [stringsToScopeTagsJson(toWrite, allowed), row.id]
          );
          updated++;
          continue;
        }

        const excerptTags = await analyzeScopeTagsFromExcerpt(excerpt, allowed);
        const excerptWithModule = moduleCode ? [moduleCode, ...excerptTags] : excerptTags;
        const fromExcerptNormalized = normalizeScopeTagsByPrecedence(excerptWithModule, allowed, title);
        const fromExcerptFinal = enforceSectorSubsectorConsistency(fromExcerptNormalized, allowed);
        if (fromExcerptFinal.length === 0) analysisEmpty++;
        fromExcerpt++;
        const toWrite = scopeTagsToWrite(fromExcerptFinal, title, allowed);
        await corpusPool.query(
          `UPDATE public.source_registry SET scope_tags = $1::jsonb, updated_at = now() WHERE id = $2`,
          [stringsToScopeTagsJson(toWrite, allowed), row.id]
        );
        updated++;
      } catch (e: unknown) {
        errors.push(`${row.source_key ?? row.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      total: rows.rows?.length ?? 0,
      updated,
      from_existing: fromExisting,
      from_title: fromTitle,
      from_excerpt: fromExcerpt,
      no_chunks: noChunks,
      analysis_empty: analysisEmpty,
      failed: errors.length,
      errors: errors.length ? errors.slice(0, 50) : undefined,
    });
  } catch (error: unknown) {
    console.error('[API /api/admin/source-registry/rerun-scope-tags POST] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

