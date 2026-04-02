import { Pool } from "pg";
import { ensureNodePgTls } from "../../app/lib/db/ensure_ssl";
import { loadEnvLocal } from "../../app/lib/db/load_env_local";
import { applyNodeTls } from "../../app/lib/db/pg_tls";

loadEnvLocal();

type Row = {
  id: string;
  file_hash: string;
  original_filename: string | null;
  inferred_title: string | null;
  canonical_path: string | null;
};

async function main() {
  const dbUrl = process.env.CORPUS_DATABASE_URL;
  if (!dbUrl) throw new Error("CORPUS_DATABASE_URL is required");

  const connectionString = ensureNodePgTls(dbUrl) ?? dbUrl;
  const pool = new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  );

  // 1) Count current untraceables
  const pre = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM public.corpus_documents
    WHERE source_registry_id IS NULL
  `);
  console.log(`[pre] untraceables=${pre.rows[0].count}`);

  if (pre.rows[0].count === 0) {
    console.log("[done] No untraceable documents found. Exiting.");
    await pool.end();
    return;
  }

  // 2) Deterministic backfill by hash match:
  // corpus_documents.file_hash <-> source_registry.doc_sha256
  const link = await pool.query(`
    WITH candidates AS (
      SELECT cd.id AS corpus_document_id, sr.id AS source_registry_id
      FROM public.corpus_documents cd
      JOIN public.source_registry sr
        ON sr.doc_sha256 = cd.file_hash
      WHERE cd.source_registry_id IS NULL
    )
    UPDATE public.corpus_documents cd
    SET source_registry_id = c.source_registry_id
    FROM candidates c
    WHERE cd.id = c.corpus_document_id
    RETURNING cd.id
  `);
  console.log(`[backfill] linked_by_hash=${link.rowCount ?? 0}`);

  // 3) Create or get "UNTRACEABLE" source registry entry for documents we can't link
  // This satisfies the constraint that requires source_registry_id to be NOT NULL
  let untraceableSourceId: string | null = null;
  try {
    const untraceableCheck = await pool.query(`
      SELECT id FROM public.source_registry 
      WHERE source_key = 'UNTRACEABLE_PLACEHOLDER'
      LIMIT 1
    `);
    
    if (untraceableCheck.rows.length > 0) {
      untraceableSourceId = untraceableCheck.rows[0].id;
      console.log(`[quarantine] Using existing UNTRACEABLE source registry entry: ${untraceableSourceId}`);
    } else {
      // Check if ingestion_stream column exists
      const hasIngestionStream = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'source_registry' AND column_name = 'ingestion_stream'
      `);
      
      if (hasIngestionStream.rows.length > 0) {
        const createResult = await pool.query(`
          INSERT INTO public.source_registry (
            source_key, publisher, tier, title, source_type, notes, ingestion_stream
          ) VALUES (
            'UNTRACEABLE_PLACEHOLDER',
            'System',
            3,
            'Untraceable Document Placeholder',
            'pdf',
            '{"source": "system_placeholder", "purpose": "quarantine_untraceable_documents"}'::jsonb,
            'CORPUS'
          )
          RETURNING id
        `);
        untraceableSourceId = createResult.rows[0].id;
      } else {
        const createResult = await pool.query(`
          INSERT INTO public.source_registry (
            source_key, publisher, tier, title, source_type, notes
          ) VALUES (
            'UNTRACEABLE_PLACEHOLDER',
            'System',
            3,
            'Untraceable Document Placeholder',
            'pdf',
            '{"source": "system_placeholder", "purpose": "quarantine_untraceable_documents"}'::jsonb
          )
          RETURNING id
        `);
        untraceableSourceId = createResult.rows[0].id;
      }
      console.log(`[quarantine] Created UNTRACEABLE source registry entry: ${untraceableSourceId}`);
    }
  } catch (e: any) {
    console.error(`[error] Failed to create/get UNTRACEABLE source: ${String(e?.message ?? e)}`);
    throw e;
  }

  // 4) Link remaining untraceables to UNTRACEABLE placeholder, then quarantine
  const quarantine = await pool.query(`
    UPDATE public.corpus_documents
    SET source_registry_id = $1,
        processing_status = 'FAILED',
        chunk_count = COALESCE(chunk_count, 0),
        processed_at = COALESCE(processed_at, now()),
        last_error = COALESCE(
          last_error, 
          'Untraceable: missing source_registry_id. Cannot be processed without Source Registry linkage. Linked to UNTRACEABLE placeholder.'
        ),
        updated_at = now()
    WHERE source_registry_id IS NULL
    RETURNING id, file_hash, original_filename, inferred_title
  `, [untraceableSourceId]);
  const quarantined = quarantine.rowCount ?? 0;
  console.log(`[quarantine] updated=${quarantined}`);
  
  if (quarantined > 0) {
    console.log(`[quarantine] Sample of quarantined documents:`);
    for (const row of quarantine.rows.slice(0, 5)) {
      const name = row.original_filename || row.inferred_title || row.file_hash.substring(0, 16);
      console.log(`  - ${name}... (id: ${row.id})`);
    }
    if (quarantine.rows.length > 5) {
      console.log(`  ... and ${quarantine.rows.length - 5} more`);
    }
  }

  // 5) Optional purge remaining untraceables (env-gated)
  // Note: Documents are now linked to UNTRACEABLE placeholder, so we check by source_key
  if ((process.env.PURGE_UNTRACEABLES ?? "").toUpperCase() === "YES") {
    // Get UNTRACEABLE source ID if we have it
    if (!untraceableSourceId) {
      const untraceableCheck = await pool.query(`
        SELECT id FROM public.source_registry 
        WHERE source_key = 'UNTRACEABLE_PLACEHOLDER'
        LIMIT 1
      `);
      if (untraceableCheck.rows.length > 0) {
        untraceableSourceId = untraceableCheck.rows[0].id;
      }
    }

    if (untraceableSourceId) {
      // Safety: only delete untraceable rows with 0 chunks
      // Also delete associated chunks first (CASCADE should handle this, but be explicit)
      const delChunks = await pool.query(`
        DELETE FROM public.document_chunks
        WHERE document_id IN (
          SELECT id FROM public.corpus_documents
          WHERE source_registry_id = $1
            AND chunk_count = 0
        )
      `, [untraceableSourceId]);
      console.log(`[purge] deleted_chunks=${delChunks.rowCount ?? 0}`);

      const del = await pool.query(`
        DELETE FROM public.corpus_documents
        WHERE source_registry_id = $1
          AND chunk_count = 0
        RETURNING id, file_hash, original_filename
      `, [untraceableSourceId]);
      const purged = del.rowCount ?? 0;
      console.log(`[purge] deleted_documents=${purged}`);
    
      if (purged > 0) {
        console.log(`[purge] Sample of purged documents:`);
        for (const row of del.rows.slice(0, 5)) {
          const name = row.original_filename || row.file_hash.substring(0, 16);
          console.log(`  - ${name}... (id: ${row.id})`);
        }
        if (del.rows.length > 5) {
          console.log(`  ... and ${del.rows.length - 5} more`);
        }
      }
    } else {
      console.log(`[purge] skipped - UNTRACEABLE source not found`);
    }
  } else {
    console.log(`[purge] skipped (set PURGE_UNTRACEABLES=YES to enable)`);
  }

  // 6) Post counts
  // Get UNTRACEABLE source ID for counting if we don't have it
  if (!untraceableSourceId) {
    const untraceableCheck = await pool.query(`
      SELECT id FROM public.source_registry 
      WHERE source_key = 'UNTRACEABLE_PLACEHOLDER'
      LIMIT 1
    `);
    if (untraceableCheck.rows.length > 0) {
      untraceableSourceId = untraceableCheck.rows[0].id;
    }
  }

  const post = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM public.corpus_documents WHERE source_registry_id IS NULL) AS untraceables_null,
      (SELECT COUNT(*)::int FROM public.corpus_documents cd 
       JOIN public.source_registry sr ON cd.source_registry_id = sr.id 
       WHERE sr.source_key = 'UNTRACEABLE_PLACEHOLDER') AS untraceables_placeholder,
      (SELECT COUNT(*)::int FROM public.corpus_documents 
       WHERE source_registry_id IS NOT NULL 
       AND source_registry_id != COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid)) AS traceable,
      (SELECT COUNT(*)::int FROM public.corpus_documents 
       WHERE processing_status = 'FAILED' AND last_error LIKE '%Untraceable%') AS quarantined_count
  `, [untraceableSourceId]);
  const stats = post.rows[0];
  const totalUntraceables = (stats.untraceables_null ?? 0) + (stats.untraceables_placeholder ?? 0);
  console.log(`[post] untraceables_null=${stats.untraceables_null} untraceables_placeholder=${stats.untraceables_placeholder} traceable=${stats.traceable} quarantined=${stats.quarantined_count}`);

  await pool.end();
  
  if (totalUntraceables > 0) {
    console.log(`\n[warning] ${totalUntraceables} untraceable documents remain (${stats.untraceables_null} with NULL, ${stats.untraceables_placeholder} linked to UNTRACEABLE placeholder).`);
    console.log(`[next] Run with PURGE_UNTRACEABLES=YES to delete them, or manually backfill source_registry_id.`);
    process.exit(1);
  } else {
    console.log(`\n[success] All documents are now traceable.`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
