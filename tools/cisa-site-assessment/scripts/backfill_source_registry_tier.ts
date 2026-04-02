#!/usr/bin/env npx tsx
/**
 * Backfill source_registry.tier from publisher using model/policy/source_policy.v1.json.
 * Corrects rows where tier does not match the policy (CISA/DHS/National Labs=1, FEMA/ISC/GSA/NIST=2, ASIS/NFPA=3).
 *
 * Env: CORPUS_DATABASE_URL (required). Load .env.local from project root.
 *
 * Usage:
 *   npx tsx scripts/backfill_source_registry_tier.ts [--dry-run]
 */

import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";
import { tierFromPublisherAndUrl } from "../app/lib/sourceRegistry/tierFromPublisher";

loadEnvLocal(path.resolve(process.cwd()));

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("[DRY RUN] No rows will be updated.");
  }

  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  if (!corpusUrl) {
    console.error("CORPUS_DATABASE_URL is required.");
    process.exit(1);
  }

  const pool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(corpusUrl) ?? corpusUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  try {
    const { rows } = await pool.query<{
      id: string;
      source_key: string;
      publisher: string | null;
      tier: number;
      canonical_url: string | null;
    }>(`SELECT id, source_key, publisher, tier, canonical_url FROM public.source_registry ORDER BY source_key`);

    const toUpdate: { id: string; source_key: string; publisher: string | null; current: number; expected: number }[] = [];
    for (const r of rows) {
      const expected = tierFromPublisherAndUrl(r.publisher, r.canonical_url);
      if (expected !== r.tier) {
        toUpdate.push({ id: r.id, source_key: r.source_key, publisher: r.publisher, current: r.tier, expected });
      }
    }

    console.log(`Total source_registry rows: ${rows.length}`);
    console.log(`Rows with wrong tier: ${toUpdate.length}`);
    if (toUpdate.length === 0) {
      return;
    }

    console.log("\nSample (first 20):");
    toUpdate.slice(0, 20).forEach((u) => {
      console.log(`  ${u.source_key}  publisher="${u.publisher ?? "(null)"}"  tier ${u.current} → ${u.expected}`);
    });
    if (toUpdate.length > 20) {
      console.log(`  ... and ${toUpdate.length - 20} more`);
    }

    if (!dryRun && toUpdate.length > 0) {
      let updated = 0;
      for (const u of toUpdate) {
        await pool.query(`UPDATE public.source_registry SET tier = $1, updated_at = now() WHERE id = $2`, [u.expected, u.id]);
        updated++;
      }
      console.log(`\nUpdated ${updated} rows.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
