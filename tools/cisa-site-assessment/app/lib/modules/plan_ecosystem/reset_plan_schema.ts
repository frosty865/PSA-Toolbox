/**
 * Hard delete plan schema for a module (registry + cascade to sections/elements).
 * Call before re-deriving to avoid stale rows.
 */

import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { guardModuleQuery } from "@/app/lib/modules/table_access_guards";

export async function resetPlanSchema(module_code: string): Promise<void> {
  const runtimePool = getRuntimePool();
  const sql = `DELETE FROM public.plan_schema_registry WHERE module_code = $1`;
  guardModuleQuery(sql, "resetPlanSchema");
  await runtimePool.query(sql, [module_code]);
}
