import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { ensureNodePgTls } from './ensure_ssl';
import { applyNodeTls } from './pg_tls';

let corpusPool: Pool | null = null;

/**
 * Assert that a SQL query is read-only (SELECT only)
 * Throws if query attempts to modify data
 */
function assertReadOnly(sql: string): void {
  const normalized = sql.trim().toUpperCase();
  const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'];
  for (const keyword of writeKeywords) {
    if (normalized.startsWith(keyword)) {
      throw new Error(
        `CORPUS database is read-only from runtime app. ` +
        `Write operations (${keyword}) are forbidden. ` +
        `Module uploads cannot be promoted to CORPUS. ` +
        `Use module_corpus_links for read-only references.`
      );
    }
  }
}

/**
 * Get CORPUS database connection pool
 * 
 * Uses CORPUS_DATABASE_URL (full PostgreSQL connection string)
 * 
 * HARD RULE: This client is for CORPUS project only
 * - source_registry
 * - canonical_sources
 * - documents
 * - document_chunks
 * - ingestion_runs
 * - ofc_candidate_queue
 * - ofc_candidate_targets
 * 
 * HARD SEGREGATION: Runtime app has READ-ONLY access to CORPUS
 * - Only SELECT queries allowed
 * - No INSERT/UPDATE/DELETE from runtime app
 * - Module uploads remain in RUNTIME only
 */
export function getCorpusPool(): Pool {
  if (!corpusPool) {
    try {
      // HARD REQUIREMENT: Must use explicit CORPUS_DATABASE_URL
      const corpusDatabaseUrl = process.env.CORPUS_DATABASE_URL;

      if (!corpusDatabaseUrl) {
        throw new Error(
          'CORPUS_DATABASE_URL must be set for CORPUS database access. ' +
          'This must be a full PostgreSQL connection string (e.g., postgresql://user:password@host:port/database). ' +
          'Do NOT use SUPABASE_CORPUS_URL - use CORPUS_DATABASE_URL instead.'
        );
      }

      // Parse connection string to extract host/port/db for logging (no secrets)
      let parsedHost = 'unknown';
      let parsedPort = 'unknown';
      let parsedDb = 'unknown';
      try {
        const url = new URL(corpusDatabaseUrl);
        parsedHost = url.hostname;
        parsedPort = url.port || '5432';
        parsedDb = url.pathname.replace('/', '') || 'postgres';
      } catch {
        // Ignore parse errors, will log unknown
      }

      // Check for localhost split-brain (::1 vs 127.0.0.1)
      const corpusHost = parsedHost.toLowerCase();
      const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
      if (runtimeUrl) {
        try {
          const runtimeUrlObj = new URL(runtimeUrl);
          const runtimeHost = runtimeUrlObj.hostname.toLowerCase();
          
          const corpusIsLocalhost = corpusHost === 'localhost' || corpusHost === '127.0.0.1' || corpusHost === '::1';
          const runtimeIsLocalhost = runtimeHost === 'localhost' || runtimeHost === '127.0.0.1' || runtimeHost === '::1';
          
          if (corpusIsLocalhost && runtimeIsLocalhost && corpusHost !== runtimeHost) {
            throw new Error(
              `Split-brain risk: CORPUS and RUNTIME URLs use different localhost forms. ` +
              `CORPUS uses "${corpusHost}", RUNTIME uses "${runtimeHost}". ` +
              `Use consistent localhost form (prefer 127.0.0.1 or explicit hostnames in containers).`
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('Split-brain risk')) {
            throw e;
          }
          // Ignore other parse errors
        }
      }

      // Log connection info (no secrets)
      console.log(`[Corpus DB] Connecting to host=${parsedHost} port=${parsedPort} db=${parsedDb}`);

      // Node-only: inject uselibpqcompat=true at runtime (not in .env — psycopg2 rejects it)
      const connectionString = ensureNodePgTls(corpusDatabaseUrl) ?? corpusDatabaseUrl;

      const connectionTimeout = parseInt(process.env.SUPABASE_CORPUS_CONNECT_TIMEOUT_MS || '15000', 10);

      const poolConfig: PoolConfig = {
        connectionString,
        ssl: { rejectUnauthorized: false }, // Supabase requires SSL
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: connectionTimeout,
      };
      corpusPool = new Pool(applyNodeTls(poolConfig));

      corpusPool.on('error', (err) => {
        console.error('[Corpus DB] Unexpected database pool error:', err);
      });

      // HARD STARTUP ASSERTION: Verify this is actually the CORPUS database
      // RBAC-safe: Check table exists AND is selectable, check privileges (not just existence)
      // Run verification asynchronously with proper error handling to avoid blocking
      (async () => {
        let client = null;
        try {
          // Add timeout wrapper to prevent hanging
          const connectPromise = corpusPool!.connect();
          let timeoutId: NodeJS.Timeout | null = null;
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error(`Connection timeout after ${connectionTimeout}ms. The CORPUS database may be unreachable or the connection string may be incorrect.`));
            }, connectionTimeout + 2000); // Add 2s buffer beyond pool timeout
          });
          
          try {
            client = await Promise.race([connectPromise, timeoutPromise]) as PoolClient;
            // Clear timeout if connection succeeded
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          } catch (err) {
            // Clear timeout on error too
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            throw err;
          }
          
          try {
            // Assert 0: FINGERPRINT GATE - Verify backend system_identifier matches expected CORPUS backend
            const EXPECTED_CORPUS_SYSTEM_IDENTIFIER = '7572288122664293568';
            let actualSystemIdentifier: string | null = null;
            try {
              const sidResult = await client.query(`SELECT (SELECT system_identifier FROM pg_control_system())::text as sid`);
              actualSystemIdentifier = sidResult.rows[0]?.sid || null;
            } catch {
              // pg_control_system() may not be available in some PostgreSQL versions or managed environments
              // If unavailable, we'll rely on table existence checks only
              console.warn('[Corpus DB] ⚠️  system_identifier check unavailable (pg_control_system() not accessible). Relying on table existence checks.');
            }

            if (actualSystemIdentifier !== null && actualSystemIdentifier !== EXPECTED_CORPUS_SYSTEM_IDENTIFIER) {
              throw new Error(
                `CORPUS pool miswired: expected backend system_identifier ${EXPECTED_CORPUS_SYSTEM_IDENTIFIER}, ` +
                `but got ${actualSystemIdentifier}. This pool is connected to the wrong backend. ` +
                `Check CORPUS_DATABASE_URL environment variable.`
              );
            }

            if (actualSystemIdentifier === EXPECTED_CORPUS_SYSTEM_IDENTIFIER) {
              console.log(`[Corpus DB] ✓ Backend fingerprint verified: system_identifier=${actualSystemIdentifier}`);
            }

            // Assert A: source_registry MUST exist AND be selectable
            try {
              await client.query(`SELECT 1 FROM public.source_registry LIMIT 1`);
            } catch (error: unknown) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              if (errorMsg.includes('does not exist') || errorMsg.includes('relation')) {
                throw new Error(
                  'CORPUS pool misconfigured: public.source_registry missing or not accessible. ' +
                  'This pool is not connected to the CORPUS database. ' +
                  'Check CORPUS_DATABASE_URL environment variable. ' +
                  'Run migration: db/migrations/20260116_create_source_registry.sql'
                );
              } else {
                throw new Error(
                  'CORPUS pool misconfigured: Cannot SELECT from public.source_registry. ' +
                  `Error: ${errorMsg}. Check database privileges and connection configuration.`
                );
              }
            }

            // Assert B: Check role identity
            const roleCheck = await client.query(`SELECT current_user as role`);
            const currentRole = roleCheck.rows[0]?.role;
            console.log(`[Corpus DB] Connected as role: ${currentRole}`);

            // Assert C: Check privilege-based separation (RBAC-safe)
            // If CORPUS role can SELECT from runtime table, that's a privilege misconfiguration
            // Note: has_table_privilege returns NULL if table doesn't exist, which is fine
            try {
              const runtimePrivilegeCheck = await client.query(`
                SELECT has_table_privilege(current_user, 'public.ofc_library_citations', 'SELECT') as can_select_runtime
              `);
              const canSelectRuntime = runtimePrivilegeCheck.rows[0]?.can_select_runtime;
              
              if (canSelectRuntime === true) {
                // Table exists and we have SELECT privilege on it
                // This is a privilege misconfiguration, not necessarily wrong database
                console.warn(
                  '[Corpus DB] ⚠️  WARNING: CORPUS role has SELECT privilege on public.ofc_library_citations. ' +
                  'This may indicate privilege misconfiguration. Consider revoking access if separation is required.'
                );
                // Don't fail hard - this is a warning, not a critical error
              }
            } catch {
              // Ignore privilege check errors - table might not exist, which is fine
            }

            console.log('[Corpus DB] ✓ Verified: CORPUS database identity confirmed (source_registry accessible)');

            // Note: Taxonomy tables (disciplines, discipline_subtypes) are now RUNTIME-owned
            // MODULE OFC creation should access taxonomy from RUNTIME database, not CORPUS
          } finally {
            if (client) {
              client.release();
            }
          }
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          
          // Handle timeout errors gracefully - don't destroy pool, just log
          if (errorMsg.includes('timeout') || errorMsg.includes('Connection terminated')) {
            console.error(
              '[Corpus DB] ⚠️  Connection verification timeout. This may indicate:\n' +
              '  1. The CORPUS database is unreachable or slow to respond\n' +
              '  2. Network connectivity issues\n' +
              '  3. The database connection string may be incorrect\n' +
              '  4. Direct database access may not be enabled for the CORPUS project\n' +
              '  The pool will remain available for retry attempts. ' +
              'CORPUS features may be unavailable until connectivity is restored.'
            );
            // Don't destroy the pool - allow retries on actual queries
            return;
          }
          
          // For other errors, log and optionally destroy pool
          console.error('[Corpus DB] Verification failed:', errorMsg);
          
          // Only destroy pool for critical misconfiguration errors
          if (errorMsg.includes('miswired') || errorMsg.includes('misconfigured')) {
            if (corpusPool) {
              await corpusPool.end().catch(() => {});
              corpusPool = null;
            }
            // Re-throw critical errors so they're visible
            throw error;
          }
          
          // For other errors, log but don't destroy pool - allow retries
          console.warn('[Corpus DB] Verification error (non-critical), pool remains available for retry');
        }
      })().catch((err) => {
        // Catch any unhandled rejections from the async IIFE
        const errorMsg = err?.message || String(err);
        if (!errorMsg.includes('timeout') && !errorMsg.includes('Connection terminated')) {
          console.error('[Corpus DB] Unhandled verification error:', errorMsg);
        }
        // Don't rethrow - we've already logged it
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's a DNS/hostname resolution error
      if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        console.error(
          '[Corpus DB] DNS resolution failed. This usually means:\n' +
          '  1. Direct database access is not enabled for the CORPUS project\n' +
          '  2. The project might be paused or in a different state\n' +
          '  3. Check Supabase Dashboard > Project Settings > Database to enable direct access\n' +
          '  CORPUS features will be unavailable until this is resolved.'
        );
      } else {
        console.error('[Corpus DB] Failed to create database pool:', errorMsg);
      }
      throw error;
    }
  }
  
  // Wrap pool.query to enforce read-only for default (runtime) callers
  const originalQuery = corpusPool.query.bind(corpusPool);
  const readOnlyPool = new Proxy(corpusPool, {
    get(target, prop) {
      if (prop === 'query') {
        return function(sql: string | { text: string; values?: unknown[] }, values?: unknown[]) {
          // Extract SQL string from query object or use directly
          const sqlString = typeof sql === 'string' ? sql : sql.text;
          assertReadOnly(sqlString);
          // Call original query method with proper signature
          if (typeof sql === 'string') {
            if (values !== undefined) {
              return originalQuery(sql, values);
            } else {
              return originalQuery(sql);
            }
          } else {
            return originalQuery(sql);
          }
        };
      }
      // Return all other properties/methods as-is
      const value = (target as unknown as Record<string | symbol, unknown>)[prop];
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    }
  });

  return readOnlyPool as Pool;
}

/**
 * Get CORPUS database pool with write access (no read-only proxy).
 * Use ONLY in admin routes that must INSERT/UPDATE/DELETE on CORPUS (e.g. source-registry, rerun-scope-tags).
 * Runtime and read-only flows must use getCorpusPool() instead.
 */
export function getCorpusPoolForAdmin(): Pool {
  // Ensure pool exists (same creation as getCorpusPool, but we need the raw pool)
  getCorpusPool();
  if (!corpusPool) throw new Error('CORPUS pool not initialized');
  return corpusPool;
}

/**
 * Health check for CORPUS database
 * 
 * Returns false if connection fails (DNS, auth, etc.)
 * This is expected if direct database access is not enabled for the CORPUS project.
 */
export async function checkCorpusHealth(): Promise<boolean> {
  try {
    const pool = getCorpusPool();
    // Check if table exists first, then query it
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'canonical_sources'
      )
    `);
    
    if (!tableCheck.rows[0]?.exists) {
      // Table doesn't exist yet - connection works but schema not applied
      return true; // Connection is OK, just need to apply schema
    }
    
    const result = await pool.query('SELECT 1 FROM canonical_sources LIMIT 1');
    return result.rows.length >= 0; // Table exists check
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // DNS/hostname errors are expected if direct access isn't enabled
    if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
      // Don't log as error - this is expected if CORPUS direct access isn't enabled
      console.log('[Corpus DB] Direct database access not available (DNS resolution failed)');
    } else {
      console.error('[Corpus DB] Health check failed:', errorMsg);
    }
    return false;
  }
}

