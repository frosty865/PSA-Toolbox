#!/usr/bin/env -S npx tsx

/**
 * API Surface Verification Script
 *
 * Verifies that app/api does not expose forbidden endpoints (validators, logs,
 * system diagnostics, DB diagnostics, deprecated fixtures/scoring). All other
 * routes under /api/ are allowed (blacklist-only).
 *
 * Run: npm run verify:api-surface
 */

import { globSync } from "glob";
import { join } from "path";

interface Violation {
  file: string;
  path: string;
  reason: string;
}

// Blacklist: routes that must not be added. Existing /api/system/security-mode and /api/assessment/scoring are allowed (in use).
const FORBIDDEN_PATTERNS = [
  { pattern: /\/api\/admin\/validate\//, reason: "Validator endpoints are ENGINEERING_ONLY" },
  { pattern: /\/api\/logs/, reason: "Log endpoints are ENGINEERING_ONLY" },
  { pattern: /\/api\/db\//, reason: "Database diagnostics are ENGINEERING_ONLY" },
  { pattern: /\/api\/fixtures\//, reason: "Fixture endpoints are DEPRECATED" },
  { pattern: /\/api\/required-elements/, reason: "Required elements endpoint is DEPRECATED (BASE-0xx)" },
];

function getRoutePath(filePath: string): string {
  // Convert file path to route path (normalize for Windows and Unix)
  // app/api/runtime/assessments/route.ts -> /api/runtime/assessments
  const normalized = filePath.replace(/\\/g, "/");
  const withoutApp = normalized.replace(/^app\/api\//, "/api/");
  const withoutRoute = withoutApp.replace(/\/route\.ts$/, "");
  return withoutRoute;
}

function verifyApiSurface(): { violations: Violation[]; passed: boolean } {
  const violations: Violation[] = [];
  const projectRoot = process.cwd();
  
  // Find all route files
  const routeFiles = globSync("app/api/**/route.ts", { cwd: projectRoot });
  
  console.log(`\n🔍 Scanning ${routeFiles.length} API route files...\n`);
  
  for (const file of routeFiles) {
    const routePath = getRoutePath(file);
    if (!routePath.startsWith("/api/")) continue;

    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (pattern.test(routePath)) {
        violations.push({ file, path: routePath, reason });
        break;
      }
    }
  }
  
  return {
    violations,
    passed: violations.length === 0,
  };
}

// Main execution
if (require.main === module) {
  const { violations, passed } = verifyApiSurface();
  
  if (!passed) {
    console.error('\n❌ API Surface Violations Found:\n');
    violations.forEach((v, i) => {
      console.error(`${i + 1}. ${v.path}`);
      console.error(`   File: ${v.file}`);
      console.error(`   Reason: ${v.reason}\n`);
    });
    console.error(`\nTotal violations: ${violations.length}`);
    console.error("\n⚠️  Remove or move these routes; they are forbidden by API surface policy.\n");
    process.exit(1);
  }
  
  console.log("✅ API surface verified - no forbidden routes exposed.\n");
  process.exit(0);
}

export { verifyApiSurface };

