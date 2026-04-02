import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/diagnostics/source-registry-location
 * 
 * Diagnostic endpoint to determine where source_registry actually exists.
 * Runs identity queries and table searches against both CORPUS and RUNTIME databases.
 */
interface PoolOptions { host?: string; port?: string | number; database?: string }
interface SearchRow { schema_name: string; table_name: string }
interface LocationProbeData {
  identity: Record<string, unknown>;
  connection_info: { host: string | number; port: string | number; database: string | number };
  source_registry_search: SearchRow[];
  source_like_tables: SearchRow[];
  public_source_registry_exists: boolean;
  public_source_registry_regclass: unknown;
  public_source_registry_count?: number | null;
}
interface LocationResult {
  corpus: LocationProbeData | { error: string } | null;
  runtime: LocationProbeData | { error: string } | null;
  errors: Array<{ database: string; error: string; code?: string; detail?: string }>;
  conclusion?: string;
  recommendation?: string;
}
function hasLocationProbeData(value: LocationProbeData | { error: string } | null): value is LocationProbeData {
  return !!value && typeof value === 'object' && 'source_registry_search' in value;
}
export async function GET(
   
  _request: NextRequest
) {
  const results: LocationResult = {
    corpus: null,
    runtime: null,
    errors: []
  };

  // ============================================================================
  // STEP 1: CORPUS Database Diagnostics
  // ============================================================================
  try {
    const corpusPool = getCorpusPool();
    
    // Identity query: proves which DB and schema we're actually on
    const identityResult = await corpusPool.query(`
      SELECT
        current_database() as db,
        current_schema() as schema,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        version() as version
    `);

    // Does ANY schema have source_registry?
    const sourceRegistrySearch = await corpusPool.query(`
      SELECT
        n.nspname as schema_name,
        c.relname as table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','p')
        AND c.relname ILIKE '%source_registry%'
    `);

    // What source-like tables exist?
    const sourceLikeTables = await corpusPool.query(`
      SELECT
        n.nspname as schema_name,
        c.relname as table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','p')
        AND c.relname ILIKE '%source%'
      ORDER BY n.nspname, c.relname
    `);

    // Does public have it?
    const publicCheck = await corpusPool.query(`
      SELECT to_regclass('public.source_registry') as public_source_registry
    `);

    // Count if it exists
    let publicCount = null;
    if (publicCheck.rows[0]?.public_source_registry) {
      const countResult = await corpusPool.query(`
        SELECT COUNT(*) as count FROM public.source_registry
      `);
      publicCount = parseInt(countResult.rows[0].count, 10);
    }

    const poolOpts = (corpusPool as { options?: PoolOptions }).options;
    const corpusConnectionInfo = {
      host: poolOpts?.host ?? 'unknown',
      port: poolOpts?.port ?? 'unknown',
      database: poolOpts?.database ?? 'unknown'
    };

    results.corpus = {
      identity: identityResult.rows[0],
      connection_info: corpusConnectionInfo,
      source_registry_search: sourceRegistrySearch.rows,
      source_like_tables: sourceLikeTables.rows,
      public_source_registry_exists: publicCheck.rows[0]?.public_source_registry !== null,
      public_source_registry_regclass: publicCheck.rows[0]?.public_source_registry,
      public_source_registry_count: publicCount
    };
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; detail?: string };
    results.errors.push({
      database: 'CORPUS',
      error: err.message ?? String(error),
      code: err.code,
      detail: err.detail
    });
    results.corpus = { error: err.message ?? String(error) };
  }

  // ============================================================================
  // STEP 2: RUNTIME Database Diagnostics (for comparison)
  // ============================================================================
  try {
    const runtimePool = getRuntimePool();
    
    // Identity query: proves which DB and schema we're actually on
    const identityResult = await runtimePool.query(`
      SELECT
        current_database() as db,
        current_schema() as schema,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        version() as version
    `);

    // Does ANY schema have source_registry?
    const sourceRegistrySearch = await runtimePool.query(`
      SELECT
        n.nspname as schema_name,
        c.relname as table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','p')
        AND c.relname ILIKE '%source_registry%'
    `);

    // What source-like tables exist?
    const sourceLikeTables = await runtimePool.query(`
      SELECT
        n.nspname as schema_name,
        c.relname as table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','p')
        AND c.relname ILIKE '%source%'
      ORDER BY n.nspname, c.relname
    `);

    // Does public have it?
    const publicCheck = await runtimePool.query(`
      SELECT to_regclass('public.source_registry') as public_source_registry
    `);

    const runtimeOpts = (runtimePool as { options?: PoolOptions }).options;
    const runtimeConnectionInfo = {
      host: runtimeOpts?.host ?? 'unknown',
      port: runtimeOpts?.port ?? 'unknown',
      database: runtimeOpts?.database ?? 'unknown'
    };

    results.runtime = {
      identity: identityResult.rows[0],
      connection_info: runtimeConnectionInfo,
      source_registry_search: sourceRegistrySearch.rows,
      source_like_tables: sourceLikeTables.rows,
      public_source_registry_exists: publicCheck.rows[0]?.public_source_registry !== null,
      public_source_registry_regclass: publicCheck.rows[0]?.public_source_registry
    };
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; detail?: string };
    results.errors.push({
      database: 'RUNTIME',
      error: err.message ?? String(error),
      code: err.code,
      detail: err.detail
    });
    results.runtime = { error: err.message ?? String(error) };
  }

  // ============================================================================
  // STEP 3: Analysis and Conclusion
  // ============================================================================
  let conclusion = '';
  let recommendation = '';

  if (hasLocationProbeData(results.corpus) && results.corpus.public_source_registry_exists) {
    conclusion = 'PATH A: source_registry EXISTS in CORPUS public schema';
    recommendation = 'Table exists correctly. If queries are failing, check schema qualification or connection targeting.';
  } else if (hasLocationProbeData(results.corpus) && results.corpus.source_registry_search.length > 0) {
    const schema = results.corpus.source_registry_search[0].schema_name;
    conclusion = `PATH A (SCHEMA MISMATCH): source_registry EXISTS in CORPUS schema "${schema}" (not public)`;
    recommendation = `Update all queries to use "${schema}.source_registry" instead of "public.source_registry"`;
  } else if (hasLocationProbeData(results.runtime) && results.runtime.public_source_registry_exists) {
    conclusion = 'PATH B: source_registry EXISTS in RUNTIME (WRONG DATABASE)';
    recommendation = 'Migrations were run against RUNTIME instead of CORPUS. Fix getCorpusPool() connection targeting and rerun CORPUS migration.';
  } else if (hasLocationProbeData(results.runtime) && results.runtime.source_registry_search.length > 0) {
    const schema = results.runtime.source_registry_search[0].schema_name;
    conclusion = `PATH B (SCHEMA MISMATCH): source_registry EXISTS in RUNTIME schema "${schema}" (WRONG DATABASE)`;
    recommendation = 'Migrations were run against RUNTIME instead of CORPUS. Fix getCorpusPool() connection targeting and rerun CORPUS migration.';
  } else {
    conclusion = 'PATH C: source_registry DOES NOT EXIST in either database';
    recommendation = 'Migrations have not been run. Run CORPUS migration (20260116_create_source_registry.sql) against CORPUS database.';
  }

  results.conclusion = conclusion;
  results.recommendation = recommendation;

  return NextResponse.json(results, { status: 200 });
}

