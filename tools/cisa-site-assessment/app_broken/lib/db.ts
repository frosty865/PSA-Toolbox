import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    try {
      let connectionString = process.env.DATABASE_URL;

      // If DATABASE_URL is not set, try to construct from components
      if (!connectionString && process.env.DATABASE_USER && process.env.DATABASE_PASSWORD) {
        const host = process.env.DATABASE_URL?.match(/@([^:]+)/)?.[1] || 'localhost';
        const encodedPassword = encodeURIComponent(process.env.DATABASE_PASSWORD);
        connectionString = `postgresql://${process.env.DATABASE_USER}:${encodedPassword}@${host}:5432/postgres`;
      }

      if (!connectionString) {
        throw new Error('DATABASE_URL or DATABASE_USER/DATABASE_PASSWORD must be set');
      }

    // Ensure password in connection string is properly encoded
    // Fix common encoding issues
    connectionString = connectionString.replace(/(postgresql:\/\/[^:]+:)([^@]+)@/, (match, prefix, password) => {
      // If password contains unencoded special chars, encode them
      if (password.includes('!') && !password.includes('%21')) {
        password = password.replace(/!/g, '%21');
      }
      return prefix + password + '@';
    });

    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : false,
      max: 5, // Limit connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000, // Increased timeout for Supabase (30 seconds)
      // Note: query_timeout is not a valid pg Pool option, queries use their own timeout
    });

    // Handle connection errors
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });

      // Test connection on pool creation
      pool.on('connect', () => {
        console.log('Database connection established');
      });
    } catch (error) {
      console.error('Failed to create database pool:', error);
      throw error;
    }
  }
  return pool;
}
