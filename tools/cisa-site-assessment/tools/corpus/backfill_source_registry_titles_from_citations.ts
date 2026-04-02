#!/usr/bin/env npx tsx
/**
 * Backfill Source Registry titles from citation data
 *
 * Detects source_registry rows where title looks like a SHA (hash) instead of
 * a document name, then pulls citation data from linked corpus_documents
 * (inferred_title, publication_date) and updates source_registry.
 *
 * Run: npx tsx tools/corpus/backfill_source_registry_titles_from_citations.ts
 *      [--dry-run] [--extract-pdf]
 *
 * - --dry-run: only report what would be updated
 * - --extract-pdf: when no good inferred_title in corpus, try to re-extract
 *   from PDF (requires local_path or canonical_path)
 */

import { existsSync } from "fs";
import { resolve } from "path";
import { spawn } from "child_process";
import { Pool } from "pg";
import { ensureNodePgTls } from "../../app/lib/db/ensure_ssl";
import { loadEnvLocal } from "../../app/lib/db/load_env_local";
import { applyNodeTls } from "../../app/lib/db/pg_tls";

// Load from psa_rebuild so CORPUS_DATABASE_URL is found when run from repo root or psa_rebuild
const psaRebuildRoot = resolve(__dirname, "../..");
loadEnvLocal(psaRebuildRoot);

const HASH_LIKE_TITLE_REGEX = /^[a-f0-9]{32,64}$/i;
const NUMERIC_ONLY_REGEX = /^\d+$/;

function isUsableTitle(title: string | null): boolean {
  if (!title || typeof title !== "string" || title.trim().length < 2) return false;
  const t = title.trim();
  if (HASH_LIKE_TITLE_REGEX.test(t)) return false;
  if (NUMERIC_ONLY_REGEX.test(t)) return false;
  return true;
}

/** Trim and strip surrounding quotes so .env values like "postgresql://..." parse correctly. */
function normalizeConnectionUrl(urlStr: string): string {
  let s = (urlStr ?? "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function parseDbHost(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    return u.hostname || null;
  } catch {
    return null;
  }
}

async function main() {
  const raw = process.env.CORPUS_DATABASE_URL;
  if (!raw) {
    throw new Error(
      "CORPUS_DATABASE_URL is required. Set it in psa_rebuild/.env.local (e.g. postgresql://user:pass@db.YOUR_PROJECT_REF.supabase.co:5432/postgres?sslmode=require)."
    );
  }

  const dbUrl = normalizeConnectionUrl(raw);
  if (!dbUrl) {
    throw new Error("CORPUS_DATABASE_URL is empty after trimming. Check psa_rebuild/.env.local.");
  }

  const host = parseDbHost(dbUrl);
  if (host === "base") {
    throw new Error(
      "CORPUS_DATABASE_URL has placeholder host 'base'. Use your real DB host (e.g. db.PROJECT_REF.supabase.co) in psa_rebuild/.env.local."
    );
  }
  if (!host && !/^postgres(ql)?:\/\//i.test(dbUrl)) {
    throw new Error(
      "CORPUS_DATABASE_URL does not look like a Postgres URL. Use e.g. postgresql://user:pass@host:5432/postgres?sslmode=require. Check psa_rebuild/.env.local."
    );
  }

  const connectionString = ensureNodePgTls(dbUrl) ?? dbUrl;
  const pool = new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  );

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const extractPdf = args.includes("--extract-pdf");

  // 1) Find source_registry rows where title looks like a SHA
  const candidates = await pool.query(
    `SELECT id, source_key, title, doc_sha256, publication_date, local_path
     FROM public.source_registry
     WHERE title IS NOT NULL
       AND (
         title ~* '^[a-f0-9]{32,64}$'
         OR (doc_sha256 IS NOT NULL AND trim(title) = doc_sha256)
       )
     ORDER BY source_key`
  );

  if (candidates.rows.length === 0) {
    console.log("[ok] No source_registry rows with hash-like title found.");
    await pool.end();
    return;
  }

  console.log(`[found] ${candidates.rows.length} source_registry row(s) with hash-like title`);

  let updatedFromCorpus = 0;
  let updatedFromPdf = 0;
  let skippedNoCitation = 0;

  for (const sr of candidates.rows) {
    const srId = sr.id as string;
    const sourceKey = sr.source_key as string;
    const currentTitle = sr.title as string;

    // 2) Best citation from corpus_documents: by source_registry_id or doc_sha256 = file_hash
    const citationResult = await pool.query(
      `SELECT cd.id, cd.inferred_title, cd.title_confidence, cd.publication_date
       FROM public.corpus_documents cd
       WHERE (
         cd.source_registry_id = $1
         OR (cd.file_hash = $2 AND $2 IS NOT NULL)
       )
         AND cd.inferred_title IS NOT NULL
         AND cd.inferred_title !~* '^[a-f0-9]{32,64}$'
         AND cd.inferred_title !~ '^\\d+$'
         AND length(trim(cd.inferred_title)) >= 2
       ORDER BY cd.title_confidence DESC NULLS LAST
       LIMIT 1`,
      [srId, sr.doc_sha256]
    );

    if (citationResult.rows.length > 0) {
      const row = citationResult.rows[0];
      const newTitle = (row.inferred_title as string).trim();
      const newPubDate = row.publication_date ?? sr.publication_date;

      if (!dryRun) {
        await pool.query(
          `UPDATE public.source_registry
           SET title = $1, publication_date = $2, updated_at = now()
           WHERE id = $3`,
          [newTitle, newPubDate, srId]
        );
      }
      console.log(`  [corpus] ${sourceKey}: "${currentTitle.substring(0, 20)}..." -> "${newTitle.substring(0, 50)}${newTitle.length > 50 ? "..." : ""}"`);
      updatedFromCorpus++;
      continue;
    }

    // 3) Optional: re-extract from PDF if we have a file path
    if (extractPdf) {
      const localPath = sr.local_path as string | null;
      const corpusRoot = process.env.CORPUS_SOURCES_ROOT || resolve(process.cwd(), "storage", "corpus_sources");
      let pdfPath: string | null = null;
      if (localPath) {
        const abs = resolve(localPath);
        if (existsSync(abs)) pdfPath = abs;
        else if (existsSync(resolve(corpusRoot, localPath))) pdfPath = resolve(corpusRoot, localPath);
      }
      if (!pdfPath) {
        const cdPathResult = await pool.query(
          `SELECT canonical_path FROM public.corpus_documents
           WHERE source_registry_id = $1 OR file_hash = $2
           LIMIT 1`,
          [srId, sr.doc_sha256]
        );
        if (cdPathResult.rows.length > 0 && cdPathResult.rows[0].canonical_path) {
          const rel = cdPathResult.rows[0].canonical_path as string;
          const abs = resolve(rel);
          if (existsSync(abs)) pdfPath = abs;
          else if (existsSync(resolve(corpusRoot, rel))) pdfPath = resolve(corpusRoot, rel);
        }
      }
      if (pdfPath) {
        const meta = await extractPdfMetadata(pdfPath);
        if (meta && isUsableTitle(meta.inferred_title ?? meta.pdf_meta_title ?? null)) {
          const newTitle = (meta.inferred_title ?? meta.pdf_meta_title ?? "").trim();
          const newPubDate = meta.publication_date ?? sr.publication_date;
          if (!dryRun) {
            await pool.query(
              `UPDATE public.source_registry
               SET title = $1, publication_date = $2, updated_at = now()
               WHERE id = $3`,
              [newTitle, newPubDate, srId]
            );
          }
          console.log(`  [pdf]   ${sourceKey}: "${currentTitle.substring(0, 20)}..." -> "${newTitle.substring(0, 50)}${newTitle.length > 50 ? "..." : ""}"`);
          updatedFromPdf++;
          continue;
        }
      }
    }

    console.log(`  [skip] ${sourceKey}: no usable citation (add --extract-pdf to try PDF re-extract)`);
    skippedNoCitation++;
  }

  console.log(`[done] From corpus: ${updatedFromCorpus}, from PDF: ${updatedFromPdf}, skipped: ${skippedNoCitation}${dryRun ? " (dry-run)" : ""}`);
  await pool.end();
}

function extractPdfMetadata(
  pdfPath: string
): Promise<{ inferred_title?: string; pdf_meta_title?: string; publication_date?: string } | null> {
  return new Promise((resolvePromise) => {
    const scriptPath = resolve(process.cwd(), "tools", "extract_pdf_metadata.py");
    if (!existsSync(scriptPath)) {
      resolvePromise(null);
      return;
    }
    const pythonCmd = process.env.PYTHON ?? "python";
    const proc = spawn(pythonCmd, [scriptPath, pdfPath], {
      cwd: process.cwd(),
      stdio: "pipe",
      env: { ...process.env },
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          resolvePromise(result);
        } catch {
          resolvePromise(null);
        }
      } else {
        resolvePromise(null);
      }
    });
    proc.on("error", () => resolvePromise(null));
  });
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
