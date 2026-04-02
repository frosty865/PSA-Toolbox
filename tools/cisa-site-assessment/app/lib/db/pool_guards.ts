import tableMap from "../../../config/db_table_map.json";
import { tableExists, dbIdentity, type DbClient } from "@/app/lib/db/table_exists";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

type PoolName = "CORPUS" | "RUNTIME";

/**
 * Get the expected pool for a table based on the canonical mapping.
 * Returns null if the table is not mapped (unmapped tables are allowed until mapped).
 */
interface TableMapEntry { schema: string; table: string; pool: string }
type TableMapJson = { meta?: unknown; tables: TableMapEntry[] };
function expectedPool(schema: string, table: string): PoolName | null {
  const tables = (tableMap as unknown as TableMapJson).tables;
  const hit = tables?.find((t: TableMapEntry) => t.schema === schema && t.table === table);
  return hit ? (hit.pool as PoolName) : null;
}

/**
 * Assert that a table exists on its expected pool and NOT on the other pool.
 * 
 * This is a hard guard that will throw an error if:
 * - The table is mapped but exists on the wrong pool
 * - The table exists on both pools (duplicate/contamination)
 * 
 * Unmapped tables are allowed (no assertion) until they are added to the mapping.
 * 
 * @param schema - Schema name (e.g., 'public')
 * @param table - Table name
 * @throws Error with POOL_CONTAMINATION code if table is on wrong pool or both pools
 */
export async function assertTableOnExpectedPool(schema: string, table: string) {
  const exp = expectedPool(schema, table);
  if (!exp) {
    // Unmapped table - allow it (no assertion)
    return;
  }

  const corpus = getCorpusPool();
  const runtime = getRuntimePool();

  const inCorpus = await tableExists(corpus as DbClient, schema, table);
  const inRuntime = await tableExists(runtime as DbClient, schema, table);

  const corpusId = await dbIdentity(corpus as DbClient);
  const runtimeId = await dbIdentity(runtime as DbClient);

  const ok =
    (exp === "CORPUS" && inCorpus && !inRuntime) ||
    (exp === "RUNTIME" && inRuntime && !inCorpus);

  if (!ok) {
    const msg = {
      error_code: "POOL_CONTAMINATION",
      message: `Table ${schema}.${table} is not on expected pool: ${exp}`,
      expected: exp,
      observed: { inCorpus, inRuntime },
      corpus_identity: corpusId,
      runtime_identity: runtimeId,
      action: "Fix DB placement OR update config/db_table_map.json only after correcting physical placement."
    };
    throw Object.assign(new Error(msg.message), { details: msg });
  }
}

/**
 * Get the pool that should be used for a given table.
 * Returns the pool name if mapped, or null if unmapped.
 * 
 * @param schema - Schema name (e.g., 'public')
 * @param table - Table name
 * @returns Pool name ("CORPUS" | "RUNTIME") or null if unmapped
 */
export function getTablePool(schema: string, table: string): PoolName | null {
  return expectedPool(schema, table);
}
