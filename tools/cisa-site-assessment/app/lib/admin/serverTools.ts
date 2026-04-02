import { existsSync } from "fs";
import { join, resolve } from "path";
import { z } from "zod";
import {
  containsConvergenceOnly,
  containsDeepNetworkCyber,
  containsForbiddenPlanElementPrefix,
} from "@/app/lib/scope/psa_scope_filter";

export const WATCHER_COMMANDS = new Set([
  "module:watch",
  "corpus:watch:general",
  "corpus:watch:technology",
]);

const serverToolBodySchema = z.object({
  toolId: z.string().min(1),
  command: z.string().min(1),
  params: z.record(z.string(), z.string()).default({}),
});

export type ServerToolBody = z.infer<typeof serverToolBodySchema>;

type ToolConfig = {
  script: string;
  args?: string[];
};

export function parseServerToolBody(body: unknown): ServerToolBody {
  return serverToolBodySchema.parse(body);
}

export function runScopeFilterDiagnostic(text: string): string {
  const deep = containsDeepNetworkCyber(text);
  const convergence = containsConvergenceOnly(text);
  const forbidden = containsForbiddenPlanElementPrefix(text);

  return [
    "PSA Scope Filter Result",
    "----------------------",
    `containsDeepNetworkCyber:    ${deep}`,
    `containsConvergenceOnly:     ${convergence}`,
    `containsForbiddenPlanElementPrefix: ${forbidden}`,
    "",
    deep ? "→ Text would be EXCLUDED from SCO (deep network/technical cyber)." : "→ No deep network cyber detected.",
    convergence && !deep ? "→ Convergence/coordination language only (allowed)." : "",
    forbidden ? '→ Forbidden "plan element exists:" prefix detected.' : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function resolveServerToolConfig(
  cwd: string,
  command: string,
  params: Record<string, string>
): ToolConfig | null {
  const commandMap: Record<string, ToolConfig> = {
    "module:watch": {
      script: resolve(cwd, "tools/corpus/watch_module_ingestion.ts"),
    },
    "corpus:watch:general": {
      script: resolve(cwd, "tools/corpus/watch_general_corpus_ingestion.ts"),
    },
    "corpus:watch:technology": {
      script: resolve(cwd, "tools/corpus/watch_technology_corpus_ingestion.ts"),
    },
    "db:audit": {
      script: resolve(cwd, "tools/db/audit_pools.ts"),
    },
    "db:review-schema": {
      script: resolve(cwd, "tools/db/review_schema.ts"),
    },
    "db:debug-ingestion": {
      script: resolve(cwd, "tools/db/debug_module_ingestion.ts"),
      args: params.moduleCode ? [params.moduleCode] : [],
    },
    "corpus:remediate-untraceables": {
      script: resolve(cwd, "tools/corpus/remediate_untraceables.ts"),
    },
    "corpus:backfill-sr-id": {
      script: resolve(cwd, "tools/corpus/backfill_source_registry_id.ts"),
    },
    "diagnostics:verify-paths": {
      script: resolve(cwd, "tools/corpus/verify_file_paths.ts"),
    },
    "diagnostics:reprocess-queue": {
      script: resolve(cwd, "tools/corpus/diagnose_reprocess_queue.ts"),
    },
    "maintenance:sync-table-map": {
      script: resolve(cwd, "tools/db/sync_table_map.ts"),
    },
    "maintenance:map-tables": {
      script: resolve(cwd, "tools/db/map_all_tables.ts"),
    },
  };

  return commandMap[command] ?? null;
}

export function getLocalTsxBinary(cwd: string): string | null {
  const isWin = process.platform === "win32";
  const tsxBin = join(cwd, "node_modules", ".bin", `tsx${isWin ? ".cmd" : ""}`);
  return existsSync(tsxBin) ? tsxBin : null;
}
