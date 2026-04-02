#!/usr/bin/env tsx
/**
 * Debug module ingestion - check status, files, and database state.
 *
 * Usage:
 *   npx tsx tools/db/debug_module_ingestion.ts [module_code]
 *   npx tsx tools/db/debug_module_ingestion.ts MODULE_AS_EAP --verbose
 *   npx tsx tools/db/debug_module_ingestion.ts MODULE_AS_EAP -v
 *
 * With -v/--verbose: per-source and per-document detail, sha256 linkage,
 * and whether chunks would get source_id (user label) in standard/generate export.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

dotenv.config({ path: ".env.local" });

import { getRuntimePool } from "../../app/lib/db/runtime_client";
import { getCorpusPool } from "../../app/lib/db/corpus_client";

const MODULE_STORAGE_ROOT =
  process.env.MODULE_SOURCES_ROOT || path.resolve(process.cwd(), "storage", "module_sources");
const MODULE_INCOMING_DIR = path.join(MODULE_STORAGE_ROOT, "incoming");
const MODULE_RAW_DIR = path.join(MODULE_STORAGE_ROOT, "raw");
const MIN_CHUNK_LENGTH_EXPORT = 200;

function sha256File(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}

function extractModuleCode(filePath: string): string | null {
  const parts = filePath.split(path.sep);
  for (const part of parts) {
    const match = part.match(/^(MODULE_[A-Z0-9_]+)$/);
    if (match) return match[1];
  }
  const filename = path.basename(filePath);
  const filenameMatch = filename.match(/^(MODULE_[A-Z0-9_]+)/);
  if (filenameMatch) return filenameMatch[1];
  return null;
}

async function checkIncomingFiles(moduleCode?: string) {
  console.log("\n📁 Incoming Files:");
  console.log("=" .repeat(80));
  
  if (!fs.existsSync(MODULE_INCOMING_DIR)) {
    console.log(`❌ Incoming directory does not exist: ${MODULE_INCOMING_DIR}`);
    return [];
  }
  
  const files: Array<{ path: string; moduleCode: string; size: number; sha256: string }> = [];
  
  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        const code = extractModuleCode(fullPath);
        if (code && (!moduleCode || code === moduleCode)) {
          try {
            const stats = fs.statSync(fullPath);
            const sha256 = sha256File(fullPath);
            files.push({ path: fullPath, moduleCode: code, size: stats.size, sha256 });
          } catch (error) {
            console.log(`⚠️  Error reading ${fullPath}: ${error}`);
          }
        }
      }
    }
  }
  
  scanDir(MODULE_INCOMING_DIR);
  
  if (files.length === 0) {
    console.log(`✅ No PDFs found in ${MODULE_INCOMING_DIR}`);
    if (moduleCode) {
      console.log(`   (filtered by module: ${moduleCode})`);
    }
  } else {
    console.log(`Found ${files.length} PDF(s) waiting for ingestion:\n`);
    const byModule = new Map<string, typeof files>();
    files.forEach(f => {
      if (!byModule.has(f.moduleCode)) byModule.set(f.moduleCode, []);
      byModule.get(f.moduleCode)!.push(f);
    });
    
    for (const [code, moduleFiles] of byModule.entries()) {
      console.log(`  📦 ${code} (${moduleFiles.length} file(s)):`);
      moduleFiles.forEach(f => {
        const relPath = path.relative(MODULE_INCOMING_DIR, f.path);
        const sizeKB = (f.size / 1024).toFixed(1);
        console.log(`     - ${relPath} (${sizeKB} KB, SHA256: ${f.sha256.slice(0, 12)}...)`);
      });
    }
  }
  
  return files;
}

async function checkRawFiles(moduleCode?: string) {
  console.log("\n📦 Raw Storage Files:");
  console.log("=" .repeat(80));
  
  if (!fs.existsSync(MODULE_RAW_DIR)) {
    console.log(`❌ Raw directory does not exist: ${MODULE_RAW_DIR}`);
    return [];
  }
  
  const files: Array<{ path: string; moduleCode: string; size: number }> = [];
  
  const entries = fs.readdirSync(MODULE_RAW_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const code = entry.name;
      if (!moduleCode || code === moduleCode) {
        const moduleDir = path.join(MODULE_RAW_DIR, code);
        const moduleFiles = fs.readdirSync(moduleDir, { withFileTypes: true })
          .filter(e => e.isFile())
          .map(e => {
            const fullPath = path.join(moduleDir, e.name);
            const stats = fs.statSync(fullPath);
            return { path: fullPath, moduleCode: code, size: stats.size };
          });
        files.push(...moduleFiles);
      }
    }
  }
  
  if (files.length === 0) {
    console.log(`✅ No files in raw storage`);
  } else {
    console.log(`Found ${files.length} file(s) in raw storage:\n`);
    const byModule = new Map<string, typeof files>();
    files.forEach(f => {
      if (!byModule.has(f.moduleCode)) byModule.set(f.moduleCode, []);
      byModule.get(f.moduleCode)!.push(f);
    });
    
    for (const [code, moduleFiles] of byModule.entries()) {
      console.log(`  📦 ${code} (${moduleFiles.length} file(s)):`);
      moduleFiles.forEach(f => {
        const relPath = path.relative(MODULE_RAW_DIR, f.path);
        const sizeKB = (f.size / 1024).toFixed(1);
        console.log(`     - ${relPath} (${sizeKB} KB)`);
      });
    }
  }
  
  return files;
}

async function checkRuntimeDatabase(moduleCode?: string, verbose?: boolean) {
  console.log("\n💾 RUNTIME Database Status:");
  console.log("=".repeat(80));

  try {
    const runtimePool = getRuntimePool();
    const params: string[] = moduleCode ? [moduleCode] : [];

    // Check module_documents (aggregate)
    let query = `
      SELECT 
        md.module_code,
        COUNT(*) as doc_count,
        COUNT(DISTINCT md.id) as unique_docs,
        SUM(CASE WHEN md.status = 'INGESTED' THEN 1 ELSE 0 END) as ingested_count
      FROM public.module_documents md
    `;
    if (moduleCode) query += ` WHERE md.module_code = $1`;
    query += ` GROUP BY md.module_code ORDER BY md.module_code`;

    const docResult = await runtimePool.query(query, params);

    if (docResult.rows.length === 0) {
      console.log("❌ No module_documents found");
      if (moduleCode) console.log(`   (filtered by module: ${moduleCode})`);
    } else {
      console.log("Module Documents:");
      docResult.rows.forEach((row: Record<string, unknown>) => {
        console.log(`  📦 ${row.module_code}:`);
        console.log(`     - Total documents: ${row.doc_count}`);
        console.log(`     - Unique documents: ${row.unique_docs}`);
        console.log(`     - Ingested: ${row.ingested_count}`);
      });
    }

    // Check module_chunks (aggregate)
    let chunkQuery = `
      SELECT md.module_code, COUNT(mc.id) as chunk_count
      FROM public.module_documents md
      LEFT JOIN public.module_chunks mc ON mc.module_document_id = md.id
    `;
    if (moduleCode) chunkQuery += ` WHERE md.module_code = $1`;
    chunkQuery += ` GROUP BY md.module_code ORDER BY md.module_code`;
    const chunkResult = await runtimePool.query(chunkQuery, params);
    if (chunkResult.rows.length > 0) {
      console.log("\nModule Chunks:");
      chunkResult.rows.forEach((row: Record<string, unknown>) => {
        console.log(`  📦 ${row.module_code}: ${row.chunk_count} chunks`);
      });
    }

    // Check module_sources (aggregate)
    let sourceQuery = `
      SELECT module_code, source_type, COUNT(*) as count,
             COUNT(CASE WHEN storage_relpath IS NOT NULL THEN 1 END) as with_storage
      FROM public.module_sources
    `;
    if (moduleCode) sourceQuery += ` WHERE module_code = $1`;
    sourceQuery += ` GROUP BY module_code, source_type ORDER BY module_code, source_type`;
    const sourceResult = await runtimePool.query(sourceQuery, params);
    if (sourceResult.rows.length > 0) {
      console.log("\nModule Sources:");
      sourceResult.rows.forEach((row: Record<string, unknown>) => {
        console.log(`  📦 ${row.module_code} (${row.source_type}): ${row.count} total, ${row.with_storage} with storage`);
      });
    }

    // Verbose: per-source, per-document, linkage, export readiness
    if (verbose && moduleCode) {
      await runVerboseRuntimeChecks(runtimePool, moduleCode);
      await printModuleDocCorpusLinkSection(moduleCode);
    }

    await runtimePool.end();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error checking RUNTIME database:`, msg);
  }
}

/** Verbose: list sources, documents, sha256 linkage, and chunks eligible for export (length >= 200). */
async function runVerboseRuntimeChecks(
  runtimePool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  moduleCode: string
): Promise<void> {
  console.log("\n--- Verbose: Sources (module_sources) ---");
  const sources = await runtimePool.query(
    `SELECT id::text AS id, source_label, source_type, sha256, storage_relpath
     FROM public.module_sources WHERE module_code = $1 ORDER BY source_label`,
    [moduleCode]
  );
  const sourceRows = sources.rows as { id: string; source_label: string | null; source_type: string; sha256: string | null; storage_relpath: string | null }[];
  if (sourceRows.length === 0) {
    console.log("  No module_sources for this module.");
  } else {
    sourceRows.forEach((s) => {
      console.log(`  [${s.id.slice(0, 8)}…] label="${s.source_label ?? ""}" type=${s.source_type} sha256=${s.sha256?.slice(0, 12) ?? "NULL"}… storage=${s.storage_relpath ? "yes" : "no"}`);
    });
  }

  console.log("\n--- Verbose: Documents (module_documents) ---");
  const docs = await runtimePool.query(
    `SELECT md.id::text AS id, md.sha256, md.status, COALESCE(md.label, '') AS label,
            (SELECT COUNT(*) FROM public.module_chunks mc WHERE mc.module_document_id = md.id) AS chunk_count,
            (SELECT COUNT(*) FROM public.module_chunks mc WHERE mc.module_document_id = md.id AND length(mc.text) >= $2) AS exportable_chunks
     FROM public.module_documents md WHERE md.module_code = $1 ORDER BY md.id`,
    [moduleCode, MIN_CHUNK_LENGTH_EXPORT]
  );
  const docRows = docs.rows as { id: string; sha256: string | null; status: string; label: string; chunk_count: string; exportable_chunks: string }[];
  if (docRows.length === 0) {
    console.log("  No module_documents for this module.");
  } else {
    docRows.forEach((d) => {
      console.log(`  [${d.id.slice(0, 8)}…] status=${d.status} sha256=${d.sha256?.slice(0, 12) ?? "NULL"}… chunks=${d.chunk_count} exportable(≥${MIN_CHUNK_LENGTH_EXPORT})=${d.exportable_chunks} label="${(d.label || "").slice(0, 50)}…"`);
    });
  }

  console.log("\n--- Linkage: source ↔ document (same sha256, MODULE_UPLOAD) ---");
  const linkage = await runtimePool.query(
    `SELECT ms.id::text AS source_id, ms.source_label, ms.sha256 AS source_sha256,
            md.id::text AS doc_id, md.status AS doc_status, md.label AS doc_label,
            (SELECT COUNT(*) FROM public.module_chunks mc WHERE mc.module_document_id = md.id AND length(mc.text) >= $2) AS exportable
     FROM public.module_sources ms
     LEFT JOIN public.module_documents md ON md.module_code = ms.module_code AND md.sha256 = ms.sha256 AND md.status = 'INGESTED'
     WHERE ms.module_code = $1 AND ms.source_type = 'MODULE_UPLOAD'
     ORDER BY ms.source_label`,
    [moduleCode, MIN_CHUNK_LENGTH_EXPORT]
  );
  const linkRows = linkage.rows as { source_id: string; source_label: string | null; source_sha256: string | null; doc_id: string | null; doc_status: string | null; doc_label: string | null; exportable: string }[];
  if (linkRows.length === 0) {
    console.log("  No MODULE_UPLOAD sources for this module.");
  } else {
    linkRows.forEach((row) => {
      if (row.doc_id) {
        console.log(`  ✓ source [${row.source_id.slice(0, 8)}…] "${(row.source_label || "").slice(0, 40)}…" → doc [${row.doc_id.slice(0, 8)}…] INGESTED, ${row.exportable} exportable chunks`);
      } else {
        console.log(`  ✗ source [${row.source_id.slice(0, 8)}…] "${(row.source_label || "").slice(0, 40)}…" sha256=${row.source_sha256?.slice(0, 12) ?? "NULL"}… → NO matching INGESTED document`);
      }
    });
  }

  console.log("\n--- Export readiness (standard/generate) ---");
  const exportStats = await runtimePool.query(
    `SELECT COUNT(*) AS total_chunks,
            SUM(CASE WHEN link.source_registry_id IS NOT NULL THEN 1 ELSE 0 END) AS chunks_with_corpus_link
     FROM public.module_chunks mc
     JOIN public.module_documents md ON md.id = mc.module_document_id AND md.module_code = $1 AND md.status = 'INGESTED'
     LEFT JOIN public.module_doc_source_link link ON link.module_code = md.module_code AND link.doc_sha256 = md.sha256
     WHERE length(mc.text) >= $2`,
    [moduleCode, MIN_CHUNK_LENGTH_EXPORT]
  );
  const stat = exportStats.rows[0] as { total_chunks: string; chunks_with_corpus_link: string };
  const total = parseInt(stat.total_chunks, 10) || 0;
  const withCorpusLink = parseInt(stat.chunks_with_corpus_link, 10) || 0;
  console.log(`  Chunks eligible for export (INGESTED, length≥${MIN_CHUNK_LENGTH_EXPORT}): ${total}`);
  console.log(`  Of those, linked to CORPUS source_registry (module_doc_source_link): ${withCorpusLink}`);
  if (total > 0 && withCorpusLink === 0) {
    console.log("  ⚠️  No chunks have CORPUS link. Run: npx tsx tools/corpus/backfill_module_sources_to_corpus.ts " + moduleCode);
  }
}

/** Verbose: Module Doc -> CORPUS source_registry link (list linked docs, counts linked/unlinked). */
async function printModuleDocCorpusLinkSection(moduleCode: string): Promise<void> {
  console.log("\n--- Module Doc -> CORPUS source_registry link ---");
  try {
    const runtimePool = getRuntimePool();
    const linkRows = await runtimePool.query(
      `SELECT doc_sha256, source_registry_id::text AS source_registry_id
       FROM public.module_doc_source_link
       WHERE module_code = $1
       ORDER BY doc_sha256`,
      [moduleCode]
    );
    const links = linkRows.rows as { doc_sha256: string; source_registry_id: string }[];

    const docRows = await runtimePool.query(
      `SELECT DISTINCT md.sha256 AS doc_sha256
       FROM public.module_documents md
       WHERE md.module_code = $1 AND md.sha256 IS NOT NULL AND md.sha256 <> '' AND md.status = 'INGESTED'`,
      [moduleCode]
    );
    const docs = (docRows.rows as { doc_sha256: string }[]).map((r) => r.doc_sha256);
    const linkedSet = new Set(links.map((l) => l.doc_sha256));
    const unlinked = docs.filter((d) => !linkedSet.has(d));

    let titles: Record<string, string> = {};
    if (links.length > 0) {
      try {
        const corpusPool = getCorpusPool();
        const ids = links.map((l) => l.source_registry_id);
        const titleRows = await corpusPool.query(
          `SELECT id::text AS id, COALESCE(title, '') AS title FROM public.source_registry WHERE id::text = ANY($1::text[])`,
          [ids]
        );
        for (const row of titleRows.rows as { id: string; title: string }[]) {
          titles[row.id] = (row.title || "").slice(0, 60);
        }
      } catch {
        // CORPUS not available; titles stay empty
      }
    }

    links.forEach((l) => {
      const prefix = l.doc_sha256.slice(0, 12);
      const title = titles[l.source_registry_id] ? ` "${titles[l.source_registry_id]}…"` : "";
      console.log(`  ${prefix}… -> ${l.source_registry_id}${title}`);
    });
    console.log(`  Linked: ${links.length} | Unlinked (INGESTED with sha256): ${unlinked.length}`);
    if (unlinked.length > 0) {
      console.log("  Run backfill to link unlinked docs: npx tsx tools/corpus/backfill_module_sources_to_corpus.ts " + moduleCode);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("  (Could not read module_doc_source_link:", msg + ")");
  }
}

async function checkCorpusDatabase(moduleCode?: string) {
  console.log("\n📚 CORPUS Database Status (Module Corpus):");
  console.log("=" .repeat(80));
  
  try {
    const corpusPool = getCorpusPool();
    
    // Check source_registry for module sources
    let query = `
      SELECT 
        sr.scope_tags->'tags'->>'module_code' as module_code,
        COUNT(*) as source_count,
        COUNT(DISTINCT cd.id) as document_count
      FROM public.source_registry sr
      LEFT JOIN public.corpus_documents cd ON cd.source_registry_id = sr.id
      WHERE (sr.scope_tags->>'ingestion_stream') = 'MODULE'
    `;
    const params: any[] = [];
    
    if (moduleCode) {
      query += ` AND (sr.scope_tags->'tags'->>'module_code') = $1`;
      params.push(moduleCode);
    }
    query += ` GROUP BY sr.scope_tags->'tags'->>'module_code' ORDER BY module_code`;
    
    const result = await corpusPool.query(query, params);
    
    if (result.rows.length === 0) {
      console.log("✅ No module corpus sources found");
      if (moduleCode) {
        console.log(`   (filtered by module: ${moduleCode})`);
      }
    } else {
      console.log("Module Corpus Sources:");
      result.rows.forEach((row: any) => {
        console.log(`  📦 ${row.module_code || 'UNKNOWN'}:`);
        console.log(`     - Sources: ${row.source_count}`);
        console.log(`     - Documents: ${row.document_count}`);
      });
    }
    
    await corpusPool.end();
  } catch (error: any) {
    console.error(`❌ Error checking CORPUS database:`, error.message);
  }
}

function checkWatcherStatus() {
  console.log("\n🔍 Watcher Status:");
  console.log("=" .repeat(80));
  
  console.log("Configuration:");
  console.log(`  MODULE_SOURCES_ROOT: ${MODULE_STORAGE_ROOT}`);
  console.log(`  MODULE_INCOMING_DIR: ${MODULE_INCOMING_DIR}`);
  console.log(`  MODULE_RAW_DIR: ${MODULE_RAW_DIR}`);
  console.log(`  POLL_INTERVAL: ${process.env.CORPUS_WATCHER_POLL_MS || 10000}ms`);
  console.log("\n⚠️  Note: This tool cannot detect if watchers are running.");
  console.log("   Check terminal/process manager for watcher processes.");
  console.log("   Start watcher with: npm run module:watch");
}

function parseArgs(): { moduleCode: string | undefined; verbose: boolean } {
  const args = process.argv.slice(2);
  let moduleCode: string | undefined;
  let verbose = false;
  for (const a of args) {
    if (a === "--verbose" || a === "-v") verbose = true;
    else if (a.startsWith("--")) continue;
    else if (/^MODULE_[A-Z0-9_]+$/i.test(a)) moduleCode = a;
  }
  return { moduleCode, verbose };
}

function printNextSteps(opts: { incomingCount: number; moduleCode?: string; verbose?: boolean }) {
  console.log("\n📋 Next steps (debugging ingestion):");
  console.log("=".repeat(80));
  if (opts.incomingCount > 0) {
    console.log("  • Start the module watcher so incoming PDFs are ingested (then removed from incoming; canonical copy in raw/_blobs):");
    console.log("    npm run module:watch");
    console.log("  • Or run the Python processor for one module:");
    console.log("    python tools/corpus/process_module_pdfs_from_incoming.py --module-code " + (opts.moduleCode || "MODULE_XXX"));
  }
  console.log("  • standard/generate uses chunks from INGESTED docs (length≥200) and requires CORPUS source_registry link per doc.");
  console.log("  • If export shows 0 chunks, run backfill: npx tsx tools/corpus/backfill_module_sources_to_corpus.ts " + (opts.moduleCode || "MODULE_XXX"));
  if (opts.moduleCode && !opts.verbose) {
    console.log("  • For per-source and linkage detail, run with --verbose:");
    console.log("    npx tsx tools/db/debug_module_ingestion.ts " + opts.moduleCode + " --verbose");
  }
}

async function main() {
  const { moduleCode, verbose } = parseArgs();

  console.log("🔍 Module Ingestion Debug Tool");
  console.log("=".repeat(80));

  if (moduleCode) {
    console.log(`Filtering by module: ${moduleCode}`);
    if (verbose) console.log("Verbose: per-source, per-document, linkage, export readiness\n");
    else console.log("");
  }

  checkWatcherStatus();
  const incomingFiles = await checkIncomingFiles(moduleCode);
  const rawFiles = await checkRawFiles(moduleCode);
  await checkRuntimeDatabase(moduleCode, verbose);
  await checkCorpusDatabase(moduleCode);

  console.log("\n📊 Summary:");
  console.log("=".repeat(80));
  console.log(`  Incoming files: ${incomingFiles.length}`);
  console.log(`  Raw storage files: ${rawFiles.length}`);

  if (incomingFiles.length > 0) {
    console.log("\n💡 Files waiting for ingestion:");
    incomingFiles.forEach((f) => {
      console.log(`     - ${path.basename(f.path)} (${f.moduleCode})`);
    });
  } else {
    console.log("\n✅ No files waiting in incoming");
  }

  printNextSteps({ incomingCount: incomingFiles.length, moduleCode, verbose });
}

main().catch(console.error);
