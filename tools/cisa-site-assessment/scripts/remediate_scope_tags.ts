#!/usr/bin/env npx tsx
/**
 * Remediate source_registry.scope_tags.
 *
 * Mode 1 (default): Structural + taxonomy cleanup. Normalize to ScopeTag[], filter to canonical taxonomy.
 * Mode 2 (--evidence): Evidence-gated. For each source with sector/subsector tags, check evidence text;
 *   if not supported, remove sector/subsector (keep module tags).
 *
 * Usage:
 *   npx tsx scripts/remediate_scope_tags.ts [--dry-run]           # structure-only, dry-run
 *   npx tsx scripts/remediate_scope_tags.ts --evidence [--dry-run] [--apply] [--limit N]  # evidence-gated
 *
 * Flags:
 *   --evidence   Run evidence-gated cleanup (check excerpt/title; clear unsupported sector/subsector).
 *   --dry-run    No DB updates (default for both modes).
 *   --apply      Persist updates (only with --evidence).
 *   --limit N    Process at most N sources (evidence mode only).
 *
 * Env: CORPUS_DATABASE_URL, RUNTIME_DATABASE_URL (for taxonomy).
 */

import path from 'path';
import { loadEnvLocal } from '../app/lib/db/load_env_local';

const psaRebuildRoot = path.resolve(__dirname, '..');
loadEnvLocal(psaRebuildRoot);

async function main() {
  const args = process.argv.slice(2);
  const evidenceMode = args.includes('--evidence');
  const apply = args.includes('--apply');
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 && args[limitIdx + 1] != null ? parseInt(args[limitIdx + 1], 10) : undefined;
  const isDryRun = evidenceMode ? !apply || dryRun : dryRun;

  if (isDryRun) {
    console.log('[DRY RUN] No DB updates.');
  }

  const { getCorpusPoolForAdmin } = await import('../app/lib/db/corpus_client');
  const { getSectorTaxonomy } = await import('../app/lib/taxonomy/get_sector_taxonomy');
  const { normalizeScopeTags, filterScopeTagsToTaxonomy } = await import('../app/lib/sourceRegistry/scope_tags');
  const { evidenceSupportsSector, evidenceSupportsSubsector } = await import('../app/lib/metadata/extract_document_metadata');
  const { getChunkExcerptForSource } = await import('../app/lib/sourceRegistry/analyzeScopeTags');

  const pool = getCorpusPoolForAdmin();
  const taxonomy = await getSectorTaxonomy();
  console.log(`Taxonomy: ${taxonomy.sectors.length} sectors, ${taxonomy.subsectors.length} subsectors`);

  if (evidenceMode) {
    const rows = await pool.query<{ id: string; source_key: string; title: string | null; scope_tags: unknown }>(
      `SELECT id, source_key, title, scope_tags FROM public.source_registry WHERE scope_tags IS NOT NULL AND scope_tags != '[]'::jsonb ORDER BY source_key`
    );
    let list = rows.rows ?? [];
    const withSectorSubsector = list.filter((row) => {
      const tags = normalizeScopeTags(row.scope_tags);
      return tags.some((t) => t.type === 'sector' || t.type === 'subsector');
    });
    if (limit != null && limit > 0) {
      withSectorSubsector.splice(limit);
    }
    let checked = 0;
    let kept = 0;
    let clearedSector = 0;
    let clearedSubsector = 0;
    let missingEvidenceText = 0;

    for (const row of withSectorSubsector) {
      const tags = normalizeScopeTags(row.scope_tags);
      const sectorTag = tags.find((t) => t.type === 'sector');
      const subsectorTag = tags.find((t) => t.type === 'subsector');
      const sectorCode = sectorTag?.code ?? null;
      const subsectorCode = subsectorTag?.code ?? null;

      const excerpt = await getChunkExcerptForSource(pool, row.id, { maxChunks: 15, maxChars: 12000 });
      const evidenceText = [row.title ?? '', excerpt].filter(Boolean).join(' ').toLowerCase();
      if (!evidenceText.trim()) {
        missingEvidenceText++;
      }

      const sectorOk = evidenceSupportsSector(sectorCode, evidenceText, taxonomy);
      const subsectorOk = evidenceSupportsSubsector(subsectorCode, evidenceText, taxonomy);
      checked++;

      const keptTags: typeof tags = [];
      if (sectorOk && sectorTag) keptTags.push(sectorTag);
      if (subsectorOk && subsectorTag) keptTags.push(subsectorTag);
      keptTags.push(...tags.filter((t) => t.type === 'module'));

      const filtered = filterScopeTagsToTaxonomy(keptTags, taxonomy);
      const same =
        tags.length === filtered.length &&
        tags.every((t, i) => filtered[i]?.type === t.type && filtered[i]?.code === t.code);
      if (same) {
        kept++;
        continue;
      }

      if (!sectorOk && sectorCode) clearedSector++;
      if (!subsectorOk && subsectorCode) clearedSubsector++;
      if (!isDryRun) {
        await pool.query(
          `UPDATE public.source_registry SET scope_tags = $1::jsonb, updated_at = now() WHERE id = $2`,
          [JSON.stringify(filtered), row.id]
        );
      }
      console.log(`  ${row.source_key}: cleared sector=${!sectorOk} subsector=${!subsectorOk} (evidence)`);
    }

    console.log('\nEvidence-gated summary:');
    console.log(`  checked: ${checked}`);
    console.log(`  kept: ${kept}`);
    console.log(`  cleared_sector: ${clearedSector}`);
    console.log(`  cleared_subsector: ${clearedSubsector}`);
    console.log(`  missing_evidence_text: ${missingEvidenceText}`);
    if (isDryRun && clearedSectorSubsector > 0) {
      console.log('  (Run with --apply to persist.)');
    }
    process.exit(0);
  }

  const rows = await pool.query<{ id: string; source_key: string; scope_tags: unknown }>(
    `SELECT id, source_key, scope_tags FROM public.source_registry WHERE scope_tags IS NOT NULL AND scope_tags != '[]'::jsonb`
  );
  const list = rows.rows ?? [];
  console.log(`Sources with non-empty scope_tags: ${list.length}`);

  let updated = 0;
  for (const row of list) {
    const normalized = normalizeScopeTags(row.scope_tags);
    const filtered = filterScopeTagsToTaxonomy(normalized, taxonomy);
    const same =
      normalized.length === filtered.length &&
      normalized.every((t, i) => filtered[i]?.type === t.type && filtered[i]?.code === t.code);
    if (same) continue;

    if (!isDryRun) {
      await pool.query(
        `UPDATE public.source_registry SET scope_tags = $1::jsonb, updated_at = now() WHERE id = $2`,
        [JSON.stringify(filtered), row.id]
      );
    }
    updated++;
    console.log(`  ${row.source_key}: ${normalized.length} -> ${filtered.length} tags`);
  }

  console.log(isDryRun ? `[DRY RUN] Would update ${updated} rows.` : `Updated ${updated} rows.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
