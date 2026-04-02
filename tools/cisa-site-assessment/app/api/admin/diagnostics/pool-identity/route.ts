import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/diagnostics/pool-identity
 * 
 * Diagnostic endpoint to prove whether CORPUS and RUNTIME pools connect to distinct databases.
 * Runs identity queries and table existence checks.
 */
interface PoolIdentityResult {
  corpus: PoolProbeData | { error: string } | null;
  runtime: PoolProbeData | { error: string } | null;
  errors: Array<{ database: string; error: string; code?: string }>;
  analysis?: {
    same_database_name: boolean;
    same_user: boolean;
    same_backend: boolean;
    are_distinct: boolean;
  };
}

interface PoolProbeData {
  db: string;
  usr: string;
  server_ip: string | null;
  server_port: number | null;
  server_version: string;
  postmaster_start_time: string | null;
  data_directory: string | null;
  listen_addresses: string | null;
  system_identifier: string | null;
  fingerprint: {
    expected: string;
    actual: string | null;
    status: 'match' | 'mismatch' | 'unavailable';
    match: boolean;
  };
  source_registry: { exists: boolean; regclass: string | null; can_select: boolean | null; count?: number | null };
  ofc_library_citations?: { exists: boolean; regclass: string | null; can_select: boolean | null };
}

function hasProbeData(value: PoolProbeData | { error: string } | null): value is PoolProbeData {
  return !!value && typeof value === 'object' && 'source_registry' in value;
}
export async function GET(
   
  _request: NextRequest
) {
  const results: PoolIdentityResult = {
    corpus: null,
    runtime: null,
    errors: []
  };

  // Backend fingerprint + existence + privilege probe query
  // Note: pg_control_system() may not be available in all PG versions; catch and retry without it
  const FINGERPRINT_QUERY = `
    SELECT
      current_database() as db,
      current_user as usr,
      inet_server_addr() as server_ip,
      inet_server_port() as server_port,
      version() as server_version,
      pg_postmaster_start_time() as postmaster_start_time,
      (SELECT setting FROM pg_settings WHERE name='data_directory') as data_directory,
      (SELECT setting FROM pg_settings WHERE name='listen_addresses') as listen_addresses,
      to_regclass('public.source_registry') as sr_regclass,
      CASE 
        WHEN to_regclass('public.source_registry') IS NOT NULL 
        THEN has_table_privilege(current_user, 'public.source_registry', 'SELECT')
        ELSE NULL
      END as sr_select,
      to_regclass('public.ofc_library_citations') as olc_regclass,
      CASE 
        WHEN to_regclass('public.ofc_library_citations') IS NOT NULL 
        THEN has_table_privilege(current_user, 'public.ofc_library_citations', 'SELECT')
        ELSE NULL
      END as olc_select
  `;

  // Try to get system_identifier (may fail in some PG versions)
  const SYSTEM_ID_QUERY = `SELECT system_identifier FROM pg_control_system()`;

  // Check CORPUS pool
  try {
    const corpusPool = getCorpusPool();
    const probeResult = await corpusPool.query(FINGERPRINT_QUERY);
    const probe = probeResult.rows[0];

    // Try to get system_identifier (may not be available)
    let systemIdentifier = null;
    try {
      const sysIdResult = await corpusPool.query(SYSTEM_ID_QUERY);
      systemIdentifier = sysIdResult.rows[0]?.system_identifier || null;
    } catch {
      // pg_control_system() may not be available - that's OK, use fallback fingerprint
    }

    // Get count if source_registry exists
    let sourceRegistryCount = null;
    if (probe.sr_regclass) {
      try {
        const countResult = await corpusPool.query(`SELECT COUNT(*) as count FROM public.source_registry`);
        sourceRegistryCount = parseInt(countResult.rows[0].count, 10);
      } catch {
        // Ignore count errors
      }
    }

    // Check fingerprint match
    const EXPECTED_CORPUS_SYSTEM_IDENTIFIER = '7572288122664293568';
    const fingerprintMatch = systemIdentifier === EXPECTED_CORPUS_SYSTEM_IDENTIFIER;
    const fingerprintStatus = systemIdentifier === null 
      ? 'unavailable' 
      : (fingerprintMatch ? 'match' : 'mismatch');

    results.corpus = {
      db: probe.db,
      usr: probe.usr,
      server_ip: probe.server_ip,
      server_port: probe.server_port,
      server_version: probe.server_version,
      postmaster_start_time: probe.postmaster_start_time,
      data_directory: probe.data_directory,
      listen_addresses: probe.listen_addresses,
      system_identifier: systemIdentifier,
      fingerprint: {
        expected: EXPECTED_CORPUS_SYSTEM_IDENTIFIER,
        actual: systemIdentifier,
        status: fingerprintStatus,
        match: fingerprintMatch
      },
      source_registry: {
        exists: probe.sr_regclass !== null,
        regclass: probe.sr_regclass,
        can_select: probe.sr_select,
        count: sourceRegistryCount
      },
      ofc_library_citations: {
        exists: probe.olc_regclass !== null,
        regclass: probe.olc_regclass,
        can_select: probe.olc_select
      }
    };
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    results.errors.push({
      database: 'CORPUS',
      error: err.message ?? String(error),
      code: err.code
    });
    results.corpus = { error: err.message ?? String(error) };
  }

  // Check RUNTIME pool
  try {
    const runtimePool = getRuntimePool();
    const probeResult = await runtimePool.query(FINGERPRINT_QUERY);
    const probe = probeResult.rows[0];

    // Try to get system_identifier (may not be available)
    let systemIdentifier = null;
    try {
      const sysIdResult = await runtimePool.query(SYSTEM_ID_QUERY);
      systemIdentifier = sysIdResult.rows[0]?.system_identifier || null;
    } catch {
      // pg_control_system() may not be available - that's OK, use fallback fingerprint
    }

    // Check fingerprint match
    const EXPECTED_RUNTIME_SYSTEM_IDENTIFIER = '7554257690872145980';
    const fingerprintMatch = systemIdentifier === EXPECTED_RUNTIME_SYSTEM_IDENTIFIER;
    const fingerprintStatus = systemIdentifier === null 
      ? 'unavailable' 
      : (fingerprintMatch ? 'match' : 'mismatch');

    results.runtime = {
      db: probe.db,
      usr: probe.usr,
      server_ip: probe.server_ip,
      server_port: probe.server_port,
      server_version: probe.server_version,
      postmaster_start_time: probe.postmaster_start_time,
      data_directory: probe.data_directory,
      listen_addresses: probe.listen_addresses,
      system_identifier: systemIdentifier,
      fingerprint: {
        expected: EXPECTED_RUNTIME_SYSTEM_IDENTIFIER,
        actual: systemIdentifier,
        status: fingerprintStatus,
        match: fingerprintMatch
      },
      source_registry: {
        exists: probe.sr_regclass !== null,
        regclass: probe.sr_regclass,
        can_select: probe.sr_select
      },
      ofc_library_citations: {
        exists: probe.olc_regclass !== null,
        regclass: probe.olc_regclass,
        can_select: probe.olc_select
      }
    };
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    results.errors.push({
      database: 'RUNTIME',
      error: err.message ?? String(error),
      code: err.code
    });
    results.runtime = { error: err.message ?? String(error) };
  }

  // Hard assertion: If same backend (fingerprint match), table existence must be consistent
  if (hasProbeData(results.corpus) && hasProbeData(results.runtime)) {
    // Check fingerprint match (primary: system_identifier, fallback: server_ip+port+data_directory+postmaster_start_time)
    const sameBackend = 
      (results.corpus.system_identifier && results.runtime.system_identifier && 
       results.corpus.system_identifier === results.runtime.system_identifier) ||
      (!results.corpus.system_identifier && !results.runtime.system_identifier &&
       results.corpus.server_ip === results.runtime.server_ip &&
       results.corpus.server_port === results.runtime.server_port &&
       results.corpus.data_directory === results.runtime.data_directory &&
       results.corpus.postmaster_start_time === results.runtime.postmaster_start_time);
    
    if (sameBackend) {
      // Same backend: existence should match (both see same tables)
      const srExistsMatch = results.corpus.source_registry.exists === results.runtime.source_registry.exists;
      const olcExistsMatch = results.corpus.ofc_library_citations?.exists === results.runtime.ofc_library_citations?.exists;
      
      if (!srExistsMatch || !olcExistsMatch) {
        return NextResponse.json({
          error: 'Inconsistent existence results in same backend; check schema/connection wiring.',
          details: {
            fingerprint_match: sameBackend,
            fingerprint: {
              corpus: {
                system_identifier: results.corpus.system_identifier,
                server_ip: results.corpus.server_ip,
                server_port: results.corpus.server_port,
                data_directory: results.corpus.data_directory,
                postmaster_start_time: results.corpus.postmaster_start_time
              },
              runtime: {
                system_identifier: results.runtime.system_identifier,
                server_ip: results.runtime.server_ip,
                server_port: results.runtime.server_port,
                data_directory: results.runtime.data_directory,
                postmaster_start_time: results.runtime.postmaster_start_time
              }
            },
            inconsistency: {
              source_registry: {
                corpus: results.corpus.source_registry.exists,
                runtime: results.runtime.source_registry.exists
              },
              ofc_library_citations: {
                corpus: results.corpus.ofc_library_citations?.exists,
                runtime: results.runtime.ofc_library_citations?.exists
              }
            },
            raw_results: results
          }
        }, { status: 500 });
      }
    }
  }

  // Analysis (facts only, no narrative)
  if (hasProbeData(results.corpus) && hasProbeData(results.runtime)) {
    const sameDb = results.corpus.db === results.runtime.db;
    const sameUser = results.corpus.usr === results.runtime.usr;
    const sameBackend = 
      (results.corpus.system_identifier && results.runtime.system_identifier && 
       results.corpus.system_identifier === results.runtime.system_identifier) ||
      (!results.corpus.system_identifier && !results.runtime.system_identifier &&
       results.corpus.server_ip === results.runtime.server_ip &&
       results.corpus.server_port === results.runtime.server_port &&
       results.corpus.data_directory === results.runtime.data_directory &&
       results.corpus.postmaster_start_time === results.runtime.postmaster_start_time);

    results.analysis = {
      same_database_name: sameDb,
      same_user: sameUser,
      same_backend: sameBackend,
      are_distinct: !sameBackend
    };
  }

  return NextResponse.json(results, { status: 200 });
}

