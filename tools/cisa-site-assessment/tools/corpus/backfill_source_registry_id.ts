import { Pool } from "pg";
import { ensureNodePgTls } from "../../app/lib/db/ensure_ssl";
import { loadEnvLocal } from "../../app/lib/db/load_env_local";
import { applyNodeTls } from "../../app/lib/db/pg_tls";

loadEnvLocal();

/**
 * Manual backfill tool for linking specific corpus_documents to source_registry.
 * 
 * Usage:
 *   npm run corpus:backfill-sr-id <corpus_document_id> <source_registry_id>
 * 
 * Or with file_hash:
 *   npm run corpus:backfill-sr-id --file-hash <sha256> <source_registry_id>
 */
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

  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error("Usage:");
    console.error("  node backfill_source_registry_id.ts <corpus_document_id> <source_registry_id>");
    console.error("  node backfill_source_registry_id.ts --file-hash <sha256> <source_registry_id>");
    process.exit(1);
  }

  let corpusDocId: string | null = null;
  let sourceRegId: string;
  let matchByHash = false;

  if (args[0] === "--file-hash") {
    matchByHash = true;
    const fileHash = args[1];
    sourceRegId = args[2];

    if (!fileHash || !sourceRegId) {
      console.error("Error: --file-hash requires <sha256> and <source_registry_id>");
      process.exit(1);
    }

    // Find corpus_document by file_hash
    const docResult = await pool.query(`
      SELECT id, file_hash, original_filename, inferred_title
      FROM public.corpus_documents
      WHERE file_hash = $1
      LIMIT 1
    `, [fileHash]);

    if (docResult.rows.length === 0) {
      console.error(`Error: No corpus_document found with file_hash: ${fileHash}`);
      process.exit(1);
    }

    corpusDocId = docResult.rows[0].id;
    console.log(`[found] corpus_document id=${corpusDocId}, file=${docResult.rows[0].original_filename || docResult.rows[0].inferred_title}`);
  } else {
    corpusDocId = args[0];
    sourceRegId = args[1];
  }

  // Validate UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(corpusDocId)) {
    console.error(`Error: Invalid corpus_document_id format: ${corpusDocId}`);
    process.exit(1);
  }
  if (!uuidRegex.test(sourceRegId)) {
    console.error(`Error: Invalid source_registry_id format: ${sourceRegId}`);
    process.exit(1);
  }

  // Verify corpus_document exists
  const docCheck = await pool.query(`
    SELECT id, file_hash, original_filename, inferred_title, source_registry_id
    FROM public.corpus_documents
    WHERE id = $1
  `, [corpusDocId]);

  if (docCheck.rows.length === 0) {
    console.error(`Error: corpus_document not found: ${corpusDocId}`);
    process.exit(1);
  }

  const doc = docCheck.rows[0];
  console.log(`[document] ${doc.original_filename || doc.inferred_title || doc.file_hash.substring(0, 16)}`);
  console.log(`[current] source_registry_id=${doc.source_registry_id || 'NULL'}`);

  // Verify source_registry exists
  const srCheck = await pool.query(`
    SELECT id, source_key, publisher, title
    FROM public.source_registry
    WHERE id = $1
  `, [sourceRegId]);

  if (srCheck.rows.length === 0) {
    console.error(`Error: source_registry not found: ${sourceRegId}`);
    process.exit(1);
  }

  const sr = srCheck.rows[0];
  console.log(`[source] ${sr.source_key} (${sr.publisher} - ${sr.title})`);

  // Update corpus_document
  const updateResult = await pool.query(`
    UPDATE public.corpus_documents
    SET source_registry_id = $1,
        updated_at = now()
    WHERE id = $2
    RETURNING id, source_registry_id, original_filename
  `, [sourceRegId, corpusDocId]);

  if (updateResult.rowCount === 0) {
    console.error(`Error: Failed to update corpus_document ${corpusDocId}`);
    process.exit(1);
  }

  console.log(`[success] Linked corpus_document ${corpusDocId} to source_registry ${sourceRegId}`);
  console.log(`[updated] ${updateResult.rows[0].original_filename || corpusDocId}`);

  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
