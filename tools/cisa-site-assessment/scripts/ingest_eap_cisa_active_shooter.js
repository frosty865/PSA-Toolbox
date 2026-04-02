#!/usr/bin/env node
/**
 * Ingest Active Shooter Emergency Action Plan (CISA) into CORPUS.
 *
 * 1) Download PDF and store at storage/corpus_sources/raw/active_shooter_emergency_action_plan.pdf
 * 2) Register in source_registry (source_kind PDF, source_label, source_url, ingestion_stream CORPUS, storage_relpath, sha256)
 * 3) Run corpus_ingest_pdf to create corpus_documents + document_chunks (no OFCs, no questions)
 *
 * Requires: CORPUS_DATABASE_URL, or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD (for Python: SUPABASE_CORPUS_*)
 * Run from psa_rebuild: node scripts/ingest_eap_cisa_active_shooter.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { loadEnvLocal } = require("./lib/load_env_local");
const { ensureNodePgTls, applyNodeTls } = require("./lib/pg_tls");

const URL =
  "https://www.cisa.gov/sites/default/files/publications/active-shooter-emergency-action-plan-112017-508v2.pdf";
const STORAGE_RELPATH = "raw/active_shooter_emergency_action_plan.pdf";
const SOURCE_KEY = "CISA_ACTIVE_SHOOTER_EAP_2017";
const TITLE = "Active Shooter Emergency Action Plan Guidance";

async function download(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PSA-Corpus/1.0)" },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  loadEnvLocal(process.cwd());

  const corpusRoot =
    process.env.CORPUS_SOURCES_ROOT || path.join(process.cwd(), "storage", "corpus_sources");
  const rawDir = path.join(corpusRoot, "raw");
  const outPath = path.join(rawDir, "active_shooter_emergency_action_plan.pdf");

  console.log("[1/4] Downloading PDF...");
  const buf = await download(URL);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(outPath, buf);
  console.log(`      Saved: ${outPath} (sha256: ${sha256.slice(0, 16)}...)`);

  let corpusUrl = process.env.CORPUS_DATABASE_URL;
  if (!corpusUrl) {
    const supabaseUrl = process.env.SUPABASE_CORPUS_URL;
    const pw = process.env.SUPABASE_CORPUS_DB_PASSWORD;
    if (supabaseUrl && pw) {
      try {
        const u = new URL(supabaseUrl);
        const projectRef = u.hostname.split(".")[0];
        const clean = pw.trim().replace(/^["']|["']$/g, "").replace(/\\/g, "");
        corpusUrl = `postgresql://postgres:${encodeURIComponent(clean)}@db.${projectRef}.supabase.co:5432/postgres`;
      } catch (e) {
        corpusUrl = null;
      }
    }
  }
  if (!corpusUrl) {
    console.error(
      "Set CORPUS_DATABASE_URL, or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD in .local.env or .env.local."
    );
    process.exit(1);
  }

  console.log("[2/4] Registering in source_registry...");
  const { Client } = require("pg");
  const connectionString = ensureNodePgTls(corpusUrl) ?? corpusUrl;
  const client = new Client(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  );
  await client.connect();

  let sourceRegistryId;
  try {
    // Check if ingestion_stream and storage_relpath exist
    const { rows: cols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'source_registry' AND column_name IN ('ingestion_stream','storage_relpath')
    `);
    const hasIngestion = cols.some((c) => c.column_name === "ingestion_stream");
    const hasStorage = cols.some((c) => c.column_name === "storage_relpath");

    const ins = `
      INSERT INTO public.source_registry (
        source_key, publisher, tier, title, publication_date, source_type,
        canonical_url, doc_sha256, retrieved_at
        ${hasIngestion ? ", ingestion_stream" : ""}
        ${hasStorage ? ", storage_relpath" : ""}
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, now()
        ${hasIngestion ? ", 'CORPUS'" : ""}
        ${hasStorage ? ", $9" : ""}
      )
      ON CONFLICT (source_key) DO UPDATE SET
        doc_sha256 = EXCLUDED.doc_sha256,
        updated_at = now()
        ${hasStorage ? ", storage_relpath = EXCLUDED.storage_relpath" : ""}
      RETURNING id
    `;
    const params = [
      SOURCE_KEY,
      "CISA",
      1,
      TITLE,
      "2017-11-01",
      "pdf",
      URL,
      sha256,
    ];
    if (hasStorage) params.push(STORAGE_RELPATH);
    const { rows } = await client.query(ins, params);
    sourceRegistryId = rows[0].id;
    console.log(`      source_registry.id: ${sourceRegistryId}`);
  } finally {
    await client.end();
  }

  console.log("[3/4] Running corpus_ingest_pdf...");
  const getPythonPath = require("./get_python_path.js").getPythonPath;
  const python = getPythonPath();
  const pdfAbs = path.resolve(outPath);
  const ingestArgs = [
    path.resolve(process.cwd(), "tools", "corpus_ingest_pdf.py"),
    "--pdf_path", pdfAbs,
    "--source_name", "CISA",
    "--title", TITLE,
    "--published_at", "2017-11-01",
    "--authority_scope", "BASELINE_AUTHORITY",
    "--source_registry_id", sourceRegistryId,
  ];

  const proc = spawn(python, ingestArgs, { stdio: "inherit", cwd: process.cwd() });
  const code = await new Promise((res) => proc.on("exit", res));
  if (code !== 0) {
    console.error("[FAIL] corpus_ingest_pdf exited with code", code);
    process.exit(1);
  }

  console.log("[4/4] Done. Document is in CORPUS; chunks are searchable. No OFCs or questions extracted.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
