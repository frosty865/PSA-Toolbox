/**
 * Generate module content (questions and OFCs) from sources.
 * Used by the module wizard - no template selection required.
 */

import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { generateModuleQuestionSuggestions, type ModuleQuestionSuggestion } from '@/app/lib/modules/module_suggestions';
import { guardModuleQuery } from '@/app/lib/modules/table_access_guards';

export interface GenerateModuleContentOptions {
  module_code: string;
  sources: Array<{
    id: string;
    url?: string;
    label?: string;
    upload_path?: string;
    corpus_source_id?: string;
  }>;
}

export interface GeneratedQuestion {
  criterion_key: string;
  question_text: string;
  discipline_subtype_id: string;
  asset_or_location: string;
  event_trigger?: string;
  order_index: number;
}

export interface GeneratedOFC {
  criterion_key: string;
  ofc_id: string;
  ofc_text: string;
  order_index: number;
}

export interface GeneratedContent {
  questions: GeneratedQuestion[];
  ofcs: GeneratedOFC[];
}

/**
 * Generate questions and OFCs from module sources.
 * Uses template-based generation (no manual template selection needed).
 */
export async function generateModuleContent(
  options: GenerateModuleContentOptions
): Promise<GeneratedContent> {
  const { module_code, sources } = options;

  if (!sources || sources.length === 0) {
    return { questions: [], ofcs: [] };
  }

  try {
    const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPool();

    // Get source IDs from CORPUS source_registry
    // The sources passed in might be module_sources, but we need source_registry IDs
    const sourceIds: string[] = [];
    
    for (const source of sources) {
      // If source has corpus_source_id (CORPUS_POINTER), use it directly
      const src = source as Record<string, unknown>;
      if (src.corpus_source_id) {
        sourceIds.push(src.corpus_source_id as string);
        continue;
      }
      
      // Try to find source_registry entry by URL or upload_path
      // MUST only read from module corpus (filtered by scope_tags)
      if (source.url) {
        const result = await corpusPool.query(
          `SELECT id::text FROM public.source_registry 
           WHERE (canonical_url = $1 OR local_path = $1)
             AND (scope_tags->>'ingestion_stream') = 'MODULE'
             AND (scope_tags->'tags'->>'module_code') = $2
           LIMIT 1`,
          [source.url, module_code]
        );
        if (result.rows.length > 0) {
          sourceIds.push(result.rows[0].id);
        }
      }
      if (source.upload_path) {
        const result = await corpusPool.query(
          `SELECT id::text FROM public.source_registry 
           WHERE local_path = $1
             AND (scope_tags->>'ingestion_stream') = 'MODULE'
             AND (scope_tags->'tags'->>'module_code') = $2
           LIMIT 1`,
          [source.upload_path, module_code]
        );
        if (result.rows.length > 0) {
          const id = result.rows[0].id;
          if (!sourceIds.includes(id)) {
            sourceIds.push(id);
          }
        }
      }
    }

    if (sourceIds.length === 0) {
      // Fallback: use the source IDs directly if they're already source_registry IDs
      sourceIds.push(...sources.map(s => s.id));
    }

    // Generate questions using template-based system
    // If template doesn't exist, return empty results (user can add questions manually)
    let suggestions: ModuleQuestionSuggestion[] = [];
    try {
      const result = await generateModuleQuestionSuggestions(module_code, sourceIds);
      suggestions = result.suggestions;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      // If template is missing, that's OK - we'll return empty results
      if (msg.includes('Module template not found') || msg.includes('template not found')) {
        console.warn(`[generateModuleContent] Template not found for ${module_code}, returning empty results`);
        suggestions = [];
      } else {
        // Re-throw other errors so they can be handled by the API route
        throw error;
      }
    }

    // Get discipline subtype mappings
    const subtypeQuery = `SELECT id, code, discipline_id FROM public.discipline_subtypes WHERE is_active = true`;
    guardModuleQuery(subtypeQuery, 'generateModuleContent: discipline_subtypes');
    const subRows = await runtimePool.query<{ id: string; code: string; discipline_id: string }>(subtypeQuery);
    const subtypeByCode = new Map<string, { id: string; discipline_id: string }>();
    for (const r of subRows.rows) {
      if (r.code) subtypeByCode.set(r.code.toUpperCase(), { id: r.id, discipline_id: r.discipline_id });
    }

    // Convert suggestions to wizard format
    const questions: GeneratedQuestion[] = [];
    const ofcs: GeneratedOFC[] = [];

    let orderIndex = 1;
    for (const suggestion of suggestions) {
      const subtypeInfo = suggestion.discipline_subtype_code 
        ? subtypeByCode.get(suggestion.discipline_subtype_code.toUpperCase())
        : null;

      if (!subtypeInfo) {
        continue; // Skip if we can't resolve subtype
      }

      const criterionKey = `Q${orderIndex.toString().padStart(3, '0')}`;
      
      questions.push({
        criterion_key: criterionKey,
        question_text: suggestion.question,
        discipline_subtype_id: subtypeInfo.id,
        asset_or_location: 'Module Asset', // Default, can be refined later
        event_trigger: 'TAMPERING', // Default existence question trigger
        order_index: orderIndex
      });

      // Generate corresponding OFC (attached on NO response)
      const ofcId = `MOD_OFC_${module_code}_${criterionKey}`;
      ofcs.push({
        criterion_key: criterionKey,
        ofc_id: ofcId,
        ofc_text: `Implement controls to address: ${suggestion.question}`,
        order_index: orderIndex
      });

      orderIndex++;
    }

    return { questions, ofcs };
  } catch (error: unknown) {
    console.error(`[generateModuleContent] Error for module ${module_code}:`, error);
    const err = error instanceof Error ? error.stack : undefined;
    if (err) console.error(`[generateModuleContent] Error stack:`, err);
    
    // Re-throw so the API route can handle it
    throw error;
  }
}
