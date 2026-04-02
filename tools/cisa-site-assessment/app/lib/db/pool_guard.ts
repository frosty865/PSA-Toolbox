/**
 * Pool ownership guard - enforces table ownership rules at runtime.
 * 
 * Hard fails if tables exist on wrong pools or are duplicated across pools.
 * This prevents cross-contamination between CORPUS and RUNTIME databases.
 */

import ownership from "@/config/db_ownership.json";
import { dbIdentity, tableExists, type DbClient } from "@/app/lib/db/pool_introspection";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

type Pool = "CORPUS" | "RUNTIME";

interface OwnershipViolationDetails {
  error_code: "POOL_OWNERSHIP_VIOLATION";
  fqtn: string;
  expected_owner: Pool;
  observed: {
    inCorpus: boolean;
    inRuntime: boolean;
  };
  corpus_identity: unknown;
  runtime_identity: unknown;
  required_state: string;
}

class PoolOwnershipViolation extends Error {
  details: OwnershipViolationDetails;
  
  constructor(details: OwnershipViolationDetails) {
    super(details.required_state);
    this.name = "PoolOwnershipViolation";
    this.details = details;
  }
}

/**
 * Get expected owner pool for a table.
 * 
 * @param fqtn - Fully qualified table name (e.g., 'public.table_name')
 * @returns Expected owner pool or null if table is not in ownership map
 */
function expectedOwner(fqtn: string): Pool | null {
  const owners = (ownership as Record<string, unknown>).owners as Record<string, Pool>;
  return owners[fqtn] ?? null;
}

/**
 * Assert that a table exists ONLY on its owner pool.
 * 
 * Hard fails if:
 * - Table exists on wrong pool
 * - Table exists on both pools (duplicate)
 * - Table is missing from owner pool
 * 
 * @param fqtn - Fully qualified table name (e.g., 'public.table_name')
 * @throws PoolOwnershipViolation if ownership is violated
 */
export async function assertTableOnOwnerPool(fqtn: string): Promise<void> {
  const owner = expectedOwner(fqtn);
  if (!owner) {
    // Unmapped tables are allowed but not guarded
    return;
  }

  const corpusPool = getCorpusPool();
  const runtimePool = getRuntimePool();

  const inCorpus = await tableExists(corpusPool as DbClient, fqtn);
  const inRuntime = await tableExists(runtimePool as DbClient, fqtn);

  const corpusId = await dbIdentity(corpusPool as DbClient);
  const runtimeId = await dbIdentity(runtimePool as DbClient);

  // Owner must exist only on the owner pool
  const ok =
    (owner === "CORPUS" && inCorpus && !inRuntime) ||
    (owner === "RUNTIME" && inRuntime && !inCorpus);

  if (!ok) {
    const details: OwnershipViolationDetails = {
      error_code: "POOL_OWNERSHIP_VIOLATION",
      fqtn,
      expected_owner: owner,
      observed: { inCorpus, inRuntime },
      corpus_identity: corpusId,
      runtime_identity: runtimeId,
      required_state: "Table must exist ONLY on its owner pool. No duplicates."
    };
    
    throw new PoolOwnershipViolation(details);
  }
}

/**
 * Assert multiple tables at once (for convenience).
 * 
 * @param fqtns - Array of fully qualified table names
 * @throws PoolOwnershipViolation if any ownership is violated
 */
export async function assertTablesOnOwnerPools(fqtns: string[]): Promise<void> {
  for (const fqtn of fqtns) {
    await assertTableOnOwnerPool(fqtn);
  }
}
