export type DbClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows?: unknown[] }>;
};

/**
 * Check if a table exists in the database.
 * Uses PostgreSQL's to_regclass() function for reliable existence checking.
 * 
 * @param db - Database client with query method
 * @param schema - Schema name (e.g., 'public')
 * @param table - Table name
 * @returns true if table exists, false otherwise
 */
export async function tableExists(db: DbClient, schema: string, table: string): Promise<boolean> {
  const sql = `select to_regclass($1) as reg`;
  const regname = `${schema}.${table}`;
  const res = await db.query(sql, [regname]);
  const firstRow = (res?.rows?.[0] as { reg?: unknown } | undefined);
  const v = firstRow?.reg;
  return !!v;
}

/**
 * Check if a column exists on a table in the database.
 *
 * @param db - Database client with query method
 * @param schema - Schema name (e.g. 'public')
 * @param table - Table name
 * @param column - Column name
 * @returns true if the column exists, false otherwise
 */
export async function columnExists(
  db: DbClient,
  schema: string,
  table: string,
  column: string
): Promise<boolean> {
  const res = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2
       AND column_name = $3
     LIMIT 1`,
    [schema, table, column]
  );
  return (res?.rows?.length ?? 0) > 0;
}

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
