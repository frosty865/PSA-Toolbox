/**
 * Shared database introspection utilities for pool identity and table existence checks.
 * 
 * Used by pool guards to verify table ownership and database identity.
 */

export type DbClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows?: unknown[] }>;
};

/**
 * Get database identity information (database name, schema, user, search_path).
 * Useful for diagnostics and debugging pool misconfigurations.
 * 
 * @param db - Database client with query method
 * @returns Object with db, schema, db_user, search_path, or null if query fails
 */
export async function dbIdentity(db: DbClient) {
  const res = await db.query(`
    select
      current_database() as db,
      current_schema() as schema,
      current_user as db_user,
      current_setting('search_path') as search_path
  `);
  return res?.rows?.[0] ?? null;
}

/**
 * Check if a table exists in the database.
 * Uses PostgreSQL's to_regclass() function for reliable existence checking.
 * 
 * @param db - Database client with query method
 * @param fqtn - Fully qualified table name (e.g., 'public.table_name')
 * @returns true if table exists, false otherwise
 */
export async function tableExists(db: DbClient, fqtn: string): Promise<boolean> {
  const res = await db.query(`select to_regclass($1) as reg`, [fqtn]);
  const firstRow = (res?.rows?.[0] as { reg?: unknown } | undefined);
  const v = firstRow?.reg;
  return !!v;
}
