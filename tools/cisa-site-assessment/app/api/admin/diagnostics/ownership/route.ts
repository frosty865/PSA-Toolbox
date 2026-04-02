/**
 * GET /api/admin/diagnostics/ownership
 * 
 * Admin diagnostics endpoint to show ownership compliance.
 * 
 * Returns status of all tables in the ownership map, verifying they exist
 * ONLY on their owner pool (no duplicates, no wrong-pool placement).
 */

import { NextResponse } from "next/server";
import ownership from "@/config/db_ownership.json";
import { assertTableOnOwnerPool } from "@/app/lib/db/pool_guard";

export const dynamic = "force-dynamic";

interface OwnershipCheckResult {
  fqtn: string;
  expected: "CORPUS" | "RUNTIME";
  ok: boolean;
  details?: unknown;
}

export async function GET() {
  const owners = (ownership as { owners: Record<string, "CORPUS" | "RUNTIME"> }).owners;
  const results: OwnershipCheckResult[] = [];

  for (const fqtn of Object.keys(owners)) {
    try {
      await assertTableOnOwnerPool(fqtn);
      results.push({ 
        fqtn, 
        expected: owners[fqtn], 
        ok: true 
      });
    } catch (e: unknown) {
      const err = e as { details?: unknown; message?: string };
      results.push({ 
        fqtn, 
        expected: owners[fqtn], 
        ok: false, 
        details: err.details ?? String(err.message ?? e) 
      });
    }
  }

  const allOk = results.every(x => x.ok);
  
  return NextResponse.json({ 
    ok: allOk,
    total_tables: results.length,
    compliant: results.filter(r => r.ok).length,
    violations: results.filter(r => !r.ok).length,
    results 
  });
}

