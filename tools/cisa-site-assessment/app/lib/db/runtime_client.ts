import { Pool, Client, type PoolConfig } from 'pg';
import { ensureNodePgTls } from './ensure_ssl';
import { applyNodeTls } from './pg_tls';

let runtimePool: Pool | null = null;
let runtimeConnectionInfo: { host: string; port: number; database: string } | null = null;
let runtimeFallbackConfig: {
  host: string;
  database: string;
  password: string;
  poolerPort: number;
  directPort: number;
  connectTimeoutMs: number;
  statementTimeoutMs: number;
  useSsl: boolean;
} | null = null;

/**
 * Connect with fallback: try pooler port first, then direct port
 */
async function connectWithFallback(
  host: string,
  database: string,
  password: string,
  poolerPort: number,
  directPort: number,
  connectTimeoutMs: number,
  statementTimeoutMs: number,
  useSsl: boolean
): Promise<{ pool: Pool; port: number }> {
  const ports = [poolerPort, directPort];
  let lastError: Error | null = null;

  for (const port of ports) {
    try {
      // Libpq-compat TLS params to avoid self-signed cert errors
      let connectionString = `postgresql://postgres:${encodeURIComponent(password)}@${host}:${port}/${database}`;
      const isSupabase = host.includes('.supabase.co');
      if (isSupabase && useSsl) {
        connectionString = ensureNodePgTls(connectionString) ?? connectionString;
      }
      
      const testClient = new Client(
        applyNodeTls({
          connectionString,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: connectTimeoutMs,
        })
      );

      // Try to connect with timeout
      await Promise.race([
        testClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), connectTimeoutMs)
        )
      ]);

      // Set statement timeout
      await testClient.query(`SET statement_timeout TO '${statementTimeoutMs}ms'`);

      // Get connection info
      const infoResult = await testClient.query(`
        SELECT current_database() as db, current_user as user
      `);
      const info = infoResult.rows[0];

      await testClient.end();

      // Create pool with successful connection settings
      const poolConfig: PoolConfig = {
        connectionString,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: connectTimeoutMs,
      };
      const pool = new Pool(applyNodeTls(poolConfig));

      // Set statement timeout for all connections in pool
      pool.on('connect', async (client) => {
        try {
          await client.query(`SET statement_timeout TO '${statementTimeoutMs}ms'`);
        } catch {
          // Ignore errors setting timeout on individual connections
        }
      });

      console.log(`runtime_db_connected host=${host} port=${port} db=${info.db} user=${info.user}`);

      return { pool, port };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next port
    }
  }

  // Both ports failed
  throw new Error(
    `Failed to connect to runtime database after trying both ports. ` +
    `Attempted: ${host}:${poolerPort} (pooler) and ${host}:${directPort} (direct). ` +
    `Last error: ${lastError?.message || 'Unknown error'}. ` +
    `Use Supabase SQL Editor runbook (see tools/RUNTIME_DB_RUNBOOK.md) if connectivity issues persist.`
  );
}

/**
 * Get RUNTIME database connection pool
 * 
 * Uses RUNTIME_DATABASE_URL (full PostgreSQL connection string)
 * 
 * Environment variables:
 * - RUNTIME_DATABASE_URL (required)
 * - SUPABASE_RUNTIME_CONNECT_TIMEOUT_MS (optional; default 8000)
 * - SUPABASE_RUNTIME_STATEMENT_TIMEOUT_MS (optional; default 20000)
 * 
 * HARD RULE: This client is for RUNTIME project only
 * - assessments
 * - assessment_instances
 * - assessment_responses
 * - ofc_nominations
 * - ofc_library
 * - expansion_questions
 * - disciplines
 * - discipline_subtypes
 */
export function getRuntimePool(): Pool {
  if (!runtimePool) {
    try {
      let host: string;
      let database: string;
      let password: string;

      {
        // HARD REQUIREMENT: Must use explicit RUNTIME_DATABASE_URL
        const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL;

        if (!runtimeDatabaseUrl) {
          throw new Error(
            'RUNTIME_DATABASE_URL must be set for RUNTIME database access. ' +
            'This must be a full PostgreSQL connection string (e.g., postgresql://user:password@host:port/database). ' +
            'Do NOT use SUPABASE_RUNTIME_URL - use RUNTIME_DATABASE_URL instead.'
          );
        }

        // Parse connection string to extract host/port/db for logging (no secrets)
        let parsedHost = 'unknown';
        let parsedPort = 'unknown';
        let parsedDb = 'unknown';
        try {
          const url = new URL(runtimeDatabaseUrl);
          parsedHost = url.hostname;
          parsedPort = url.port || '5432';
          parsedDb = url.pathname.replace('/', '') || 'postgres';
        } catch {
          // Ignore parse errors, will log unknown
        }

        // Check for localhost split-brain (::1 vs 127.0.0.1)
        const runtimeHost = parsedHost.toLowerCase();
        const corpusUrl = process.env.CORPUS_DATABASE_URL;
        if (corpusUrl) {
          try {
            const corpusUrlObj = new URL(corpusUrl);
            const corpusHost = corpusUrlObj.hostname.toLowerCase();
            
            const runtimeIsLocalhost = runtimeHost === 'localhost' || runtimeHost === '127.0.0.1' || runtimeHost === '::1';
            const corpusIsLocalhost = corpusHost === 'localhost' || corpusHost === '127.0.0.1' || corpusHost === '::1';
            
            if (runtimeIsLocalhost && corpusIsLocalhost && runtimeHost !== corpusHost) {
              throw new Error(
                `Split-brain risk: CORPUS and RUNTIME URLs use different localhost forms. ` +
                `CORPUS uses "${corpusHost}", RUNTIME uses "${runtimeHost}". ` +
                `Use consistent localhost form (prefer 127.0.0.1 or explicit hostnames in containers).`
              );
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message.includes('Split-brain risk')) {
              throw e;
            }
            // Ignore other parse errors
          }
        }

        // Log connection info (no secrets)
        console.log(`[Runtime DB] Connecting to host=${parsedHost} port=${parsedPort} db=${parsedDb}`);

        // Parse URL for connection
        const url = new URL(runtimeDatabaseUrl);
        host = url.hostname;
        database = url.pathname.replace('/', '') || 'postgres';
        password = url.password || '';
        
        // RUNTIME must use DIRECT Postgres (5432), never PgBouncer (6543)
        const urlPort = url.port || '5432';
        if (urlPort === '6543') {
          throw new Error(
            'INVALID CONFIG: RUNTIME_DATABASE_URL must use DIRECT Postgres (port 5432), not PgBouncer (6543). ' +
            `Host=${host} DB=${database}. Update .env.local and run: npx tsx tools/assert_runtime_direct.ts`
          );
        }
        
        // Extract project ref if Supabase URL format (reserved for future use)
        const _projectRef = host.replace('db.', '').replace('.supabase.co', '');
        void _projectRef;

        // HARD GUARD AGAINST LOCALHOST IN NON-DEV
        const isLocalhost = host === 'localhost' || 
                            host === '127.0.0.1' || 
                            host === '::1' ||
                            host.includes('localhost') ||
                            host.includes('127.0.0.1');
        
        if (isLocalhost && process.env.NODE_ENV !== 'development') {
          throw new Error(
            `Runtime DB is localhost (host: ${host}); refusing to run in ${process.env.NODE_ENV || 'production'} mode. ` +
            'Check RUNTIME_DATABASE_URL environment variable. ' +
            'If intentionally using localhost, set NODE_ENV=development'
          );
        }

        // Get configuration from environment with defaults
        const port = parseInt(parsedPort, 10) || parseInt(url.port || '5432', 10);
        const connectTimeoutMs = parseInt(process.env.SUPABASE_RUNTIME_CONNECT_TIMEOUT_MS || '8000', 10);
        const statementTimeoutMs = parseInt(process.env.SUPABASE_RUNTIME_STATEMENT_TIMEOUT_MS || '20000', 10);
        const useSsl = url.protocol === 'postgresql:' || url.protocol === 'postgres:' || process.env.SUPABASE_RUNTIME_SSL !== 'false';

        // Node-only: inject uselibpqcompat=true at runtime (not in .env — psycopg2 rejects it)
        const connectionString = ensureNodePgTls(runtimeDatabaseUrl) ?? runtimeDatabaseUrl;
        const _isSupabase = host.includes('.supabase.co');
        void _isSupabase;

        // RUNTIME uses DIRECT only — fallback only to 5432, never 6543
        const directPort = 5432;
        runtimeFallbackConfig = {
          host,
          database,
          password,
          poolerPort: directPort,
          directPort,
          connectTimeoutMs,
          statementTimeoutMs,
          useSsl,
        };

        // Create pool with connection string from RUNTIME_DATABASE_URL
        const poolConfig: PoolConfig = {
          connectionString,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: connectTimeoutMs,
        };
        runtimePool = new Pool(applyNodeTls(poolConfig));

        // Set statement timeout for all connections
        runtimePool.on('connect', async (client) => {
          try {
            await client.query(`SET statement_timeout TO '${statementTimeoutMs}ms'`);
          } catch {
            // Ignore errors setting timeout
          }
        });

        runtimePool.on('error', (err) => {
          console.error('[Runtime DB] Unexpected database pool error:', err);
        });

        runtimeConnectionInfo = { host, port, database };

        // HARD STARTUP ASSERTION: Verify this is actually the RUNTIME database
        // RBAC-safe: Check table exists AND is selectable, check privileges (not just existence)
        (async () => {
          try {
            const client = await runtimePool!.connect();
            try {
              // Assert 0: FINGERPRINT GATE - Verify backend system_identifier matches expected RUNTIME backend
              const EXPECTED_RUNTIME_SYSTEM_IDENTIFIER = '7554257690872145980';
              let actualSystemIdentifier: string | null = null;
              try {
                const sidResult = await client.query(`SELECT (SELECT system_identifier FROM pg_control_system())::text as sid`);
                actualSystemIdentifier = sidResult.rows[0]?.sid || null;
              } catch {
                // pg_control_system() may not be available in some PostgreSQL versions or managed environments
                // If unavailable, we'll rely on table existence checks only
                console.warn('[Runtime DB] ⚠️  system_identifier check unavailable (pg_control_system() not accessible). Relying on table existence checks.');
              }

              if (actualSystemIdentifier !== null && actualSystemIdentifier !== EXPECTED_RUNTIME_SYSTEM_IDENTIFIER) {
                throw new Error(
                  `RUNTIME pool miswired: expected backend system_identifier ${EXPECTED_RUNTIME_SYSTEM_IDENTIFIER}, ` +
                  `but got ${actualSystemIdentifier}. This pool is connected to the wrong backend. ` +
                  `Check RUNTIME_DATABASE_URL environment variable.`
                );
              }

              if (actualSystemIdentifier === EXPECTED_RUNTIME_SYSTEM_IDENTIFIER) {
                console.log(`[Runtime DB] ✓ Backend fingerprint verified: system_identifier=${actualSystemIdentifier}`);
              }

              // Assert A: assessments MUST exist AND be selectable (RUNTIME identity check)
              try {
                await client.query(`SELECT 1 FROM public.assessments LIMIT 1`);
              } catch (error: unknown) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                if (errorMsg.includes('does not exist') || errorMsg.includes('relation')) {
                  throw new Error(
                    'RUNTIME pool misconfigured: public.assessments missing or not accessible. ' +
                    'This pool is not connected to the RUNTIME database. ' +
                    'Check RUNTIME_DATABASE_URL environment variable. ' +
                    'Run migration to create assessments table.'
                  );
                } else {
                  throw new Error(
                    'RUNTIME pool misconfigured: Cannot SELECT from public.assessments. ' +
                    `Error: ${errorMsg}. Check database privileges and connection configuration.`
                  );
                }
              }

              // Assert B: Check role identity
              const roleCheck = await client.query(`SELECT current_user as role`);
              const currentRole = roleCheck.rows[0]?.role;
              console.log(`[Runtime DB] Connected as role: ${currentRole}`);

              // Assert C: Check privilege-based separation (RBAC-safe)
              // If RUNTIME role can SELECT from corpus table, that's a privilege misconfiguration
              // Note: has_table_privilege returns NULL if table doesn't exist, which is fine
              try {
                const corpusPrivilegeCheck = await client.query(`
                  SELECT has_table_privilege(current_user, 'public.source_registry', 'SELECT') as can_select_corpus
                `);
                const canSelectCorpus = corpusPrivilegeCheck.rows[0]?.can_select_corpus;
                
                if (canSelectCorpus === true) {
                  // Table exists and we have SELECT privilege on it
                  // This is a privilege misconfiguration, not necessarily wrong database
                  console.warn(
                    '[Runtime DB] ⚠️  WARNING: RUNTIME role has SELECT privilege on public.source_registry. ' +
                    'This may indicate privilege misconfiguration. Consider revoking access if separation is required.'
                  );
                  // Don't fail hard - this is a warning, not a critical error
                }
              } catch {
                // Ignore privilege check errors - table might not exist, which is fine
              }

              console.log('[Runtime DB] ✓ Verified: RUNTIME database identity confirmed (assessments accessible)');
            } finally {
              client.release();
            }
          } catch (error) {
            // If assertion fails, destroy the pool and rethrow
            if (runtimePool) {
              await runtimePool.end().catch(() => {});
              runtimePool = null;
            }
            throw error;
          }
        })();

        // Optional: background fallback only to direct port 5432 (RUNTIME never uses pooler 6543)
        (async () => {
          try {
            const result = await connectWithFallback(
              host,
              database,
              password,
              directPort,
              directPort,
              connectTimeoutMs,
              statementTimeoutMs,
              useSsl
            );
            if (result.port !== port && runtimePool) {
              await runtimePool.end();
              runtimePool = result.pool;
              runtimeConnectionInfo = { host, port: result.port, database };
            }
          } catch {
            // Ignore; primary pool from RUNTIME_DATABASE_URL is used
          }
        })();
      }
    } catch (error) {
      console.error('[Runtime DB] Failed to create database pool:', error);
      throw error;
    }
  }
  return runtimePool;
}

/**
 * Ensure runtime pool is connected with fallback
 * Call this before critical operations to ensure connection is established
 */
export async function ensureRuntimePoolConnected(): Promise<Pool> {
  const pool = getRuntimePool();
  
  // If we have fallback config and pool hasn't been verified, test connection
  if (runtimeFallbackConfig) {
    try {
      // Test connection with a simple query and timeout
      await Promise.race([
        pool.query('SELECT 1'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection test timeout')), runtimeFallbackConfig!.connectTimeoutMs)
        )
      ]);
    } catch (error: unknown) {
      // If connection fails, try fallback
      const err = error as { code?: string; message?: string };
      const errCode = err.code ?? '';
      const errMessage = err.message ?? '';
      
      const isConnectionError = 
        errCode === 'ETIMEDOUT' ||
        errCode === 'ECONNREFUSED' ||
        errCode === 'ENOTFOUND' ||
        errCode === 'ECONNRESET' ||
        errMessage.includes('timeout') ||
        errMessage.includes('connect') ||
        errMessage.includes('Connection test timeout');
      
      if (isConnectionError) {
        console.log(`[Runtime DB] Connection test failed on port ${runtimeConnectionInfo?.port} (${errCode || errMessage}), trying fallback...`);
        
        try {
          const result = await connectWithFallback(
            runtimeFallbackConfig.host,
            runtimeFallbackConfig.database,
            runtimeFallbackConfig.password,
            runtimeFallbackConfig.poolerPort,
            runtimeFallbackConfig.directPort,
            runtimeFallbackConfig.connectTimeoutMs,
            runtimeFallbackConfig.statementTimeoutMs,
            runtimeFallbackConfig.useSsl
          );
          
          // Replace pool with successful one
          if (runtimePool) {
            try {
              await runtimePool.end();
            } catch (endError) {
              // Ignore errors ending old pool
              console.warn('[Runtime DB] Error ending old pool:', endError);
            }
          }
          runtimePool = result.pool;
          runtimeConnectionInfo = {
            host: runtimeFallbackConfig.host,
            port: result.port,
            database: runtimeFallbackConfig.database,
          };
          
          console.log(`[Runtime DB] Fallback connection successful on port ${result.port}`);
          return runtimePool;
        } catch (fallbackError: unknown) {
          // Fallback also failed, throw comprehensive error
          const fallbackErr = fallbackError as { code?: string; message?: string };
          const fallbackErrCode = fallbackErr.code ?? '';
          const fallbackErrMessage = fallbackErr.message ?? '';
          throw new Error(
            `Runtime database connection failed on both ports. ` +
            `Primary (${runtimeFallbackConfig.poolerPort}): ${errCode || errMessage}. ` +
            `Fallback (${runtimeFallbackConfig.directPort}): ${fallbackErrCode || fallbackErrMessage}. ` +
            `Host: ${runtimeFallbackConfig.host}. ` +
            `Check RUNTIME_DATABASE_URL environment variable. ` +
            `See docs/DB_TARGETING_RUNBOOK.md for troubleshooting.`
          );
        }
      } else {
        // Not a connection error, rethrow with context
        console.error(`[Runtime DB] Non-connection error during pool verification:`, error);
        throw error;
      }
    }
  }
  
  return pool;
}

/**
 * Health check for RUNTIME database
 */
export async function checkRuntimeHealth(): Promise<boolean> {
  try {
    const pool = await ensureRuntimePoolConnected();
    const result = await pool.query('SELECT 1 FROM assessments LIMIT 1');
    return result.rows.length >= 0; // Table exists check
  } catch (error) {
    console.error('[Runtime DB] Health check failed:', error);
    return false;
  }
}

