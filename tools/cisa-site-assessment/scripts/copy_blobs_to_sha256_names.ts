#!/usr/bin/env npx tsx
/**
 * Find PDFs in raw/_blobs/ by SHA256 and copy them to raw/_blobs/<sha256>.pdf
 * so the file-serving fallback can resolve them after DB normalization to raw/<sha256>.pdf.
 *
 * Reads document_blobs from RUNTIME; scans MODULE_SOURCES_ROOT/raw/_blobs/ for PDFs;
 * hashes each file; for each blob whose expected path is missing, copies the
 * matching file to raw/_blobs/<sha256>.pdf (or moves with --move).
 *
 * Env: RUNTIME_DATABASE_URL (or DATABASE_URL), MODULE_SOURCES_ROOT (default: storage/module_sources).
 *
 * Usage:
 *   npx tsx scripts/copy_blobs_to_sha256_names.ts [--dry-run] [--move]
 */

import path from "path";
import { createReadStream } from "fs";
import { createHash } from "crypto";
import { readdir, copyFile, rename, access } from "fs/promises";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

loadEnvLocal(process.cwd());

function getModuleRoot(): string {
  const raw = process.env.MODULE_SOURCES_ROOT ?? "";
  const resolved = raw.trim()
    ? (path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw))
    : path.resolve(process.cwd(), "storage", "module_sources");
  const base = path.basename(resolved);
  if (base === "storage") {
    return path.join(resolved, "module_sources");
  }
  return resolved;
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: Buffer) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function collectPdfsUnder(dir: string): Promise<string[]> {
  const list: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      list.push(...(await collectPdfsUnder(full)));
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".pdf")) {
      list.push(full);
    }
  }
  return list;
}

async function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(() => true).catch(() => false);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const useMove = process.argv.includes("--move");
  if (dryRun) console.log("[DRY RUN] No copies or renames.\n");

  const runtimeUrl = process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!runtimeUrl) {
    console.error("RUNTIME_DATABASE_URL or DATABASE_URL required.");
    process.exit(1);
  }

  const root = getModuleRoot();
  const blobsDir = path.join(root, "raw", "_blobs");
  console.log(`Module root: ${root}`);
  console.log(`Blobs dir:  ${blobsDir}\n`);
  // Scan entire module storage so we find PDFs in raw/, raw/_blobs/, or incoming/ (e.g. _processed/_PENDING)
  const searchDirs = [
    path.join(root, "raw"),
    path.join(root, "incoming"),
  ].filter((d) => d.length > 0);

  const pool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(runtimeUrl) ?? runtimeUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  try {
    const rows = await pool.query<{ id: string; sha256: string; storage_relpath: string }>(
      `SELECT id, sha256, storage_relpath FROM public.document_blobs
       WHERE sha256 IS NOT NULL AND trim(sha256) <> ''
         AND storage_relpath IS NOT NULL AND trim(storage_relpath) <> ''`
    );

    const blobs = rows.rows;
    if (blobs.length === 0) {
      console.log("No document_blobs rows with sha256 and storage_relpath.");
      return;
    }

    const pdfs: string[] = [];
    for (const dir of searchDirs) {
      const found = await collectPdfsUnder(dir);
      pdfs.push(...found);
    }
    if (pdfs.length === 0) {
      console.log("No PDFs found under raw/ or incoming/. Nothing to copy.");
      return;
    }

    console.log(`Building SHA256 index for ${pdfs.length} PDF(s) under raw/ and incoming/…`);
    const sha256ToPath = new Map<string, string>();
    for (const pdfPath of pdfs) {
      try {
        const hash = await sha256File(pdfPath);
        sha256ToPath.set(hash, pdfPath);
      } catch (e) {
        console.warn(`  [skip] ${path.relative(root, pdfPath)}: ${e}`);
      }
    }
    console.log(`  Indexed ${sha256ToPath.size} PDF(s).\n`);

    let copied = 0;
    let skippedExists = 0;
    let skippedNoMatch = 0;

    for (const row of blobs) {
      const relpath = row.storage_relpath.replace(/\\/g, "/").trim();
      const expectedPrimary = path.join(root, relpath);
      const expectedBlob = path.join(root, "raw", "_blobs", `${row.sha256}.pdf`);

      if (await fileExists(expectedPrimary)) {
        skippedExists++;
        continue;
      }
      if (await fileExists(expectedBlob)) {
        skippedExists++;
        continue;
      }

      const sourcePath = sha256ToPath.get(row.sha256);
      if (!sourcePath) {
        skippedNoMatch++;
        console.log(`  [no match] sha256=${row.sha256.slice(0, 12)}… (id=${row.id.slice(0, 8)}…)`);
        continue;
      }

      if (dryRun) {
        console.log(`  [would copy] ${path.relative(root, sourcePath)} → raw/_blobs/${row.sha256}.pdf`);
        copied++;
        continue;
      }

      try {
        if (useMove) {
          await rename(sourcePath, expectedBlob);
          console.log(`  [moved] ${path.relative(root, sourcePath)} → raw/_blobs/${row.sha256}.pdf`);
        } else {
          await copyFile(sourcePath, expectedBlob);
          console.log(`  [copied] ${path.relative(root, sourcePath)} → raw/_blobs/${row.sha256}.pdf`);
        }
        copied++;
      } catch (e) {
        console.warn(`  [error] ${row.sha256.slice(0, 12)}…: ${e}`);
      }
    }

    console.log("");
    console.log(`Done. Copied/moved: ${copied}; already present: ${skippedExists}; no match in _blobs: ${skippedNoMatch}.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
