#!/usr/bin/env node
/**
 * Module Standard (doctrine) generation: determinism and EV_PARKING regression.
 * Run: npx tsx scripts/tests/moduleStandardGeneration.test.ts
 * Live (persist to RUNTIME): npx tsx scripts/tests/moduleStandardGeneration.test.ts --live
 *
 * Prerequisites:
 * - RUNTIME_DATABASE_URL, CORPUS_DATABASE_URL (or in .env.local)
 * - CORPUS: module_standards and EV_PARKING seed applied (db/migrations/corpus, db/seeds/corpus/EV_PARKING_standard_seed.sql)
 * - RUNTIME: assessment_modules row for MODULE_EV_PARKING (created if missing)
 *
 * Asserts:
 * - No baseline reuse: generate logic does not reference baseline_spines_runtime or canon_id (code guard; this script does not invoke mining).
 * - Determinism: same standard_key + attributes => same criterion_key and template_key sets across two dry-run calls.
 * - EV_PARKING: >0 criteria, >0 OFCs, every APPLIES criterion has ≥1 OFC in the ofcs list.
 */

import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config();

// @ts-ignore — path with [moduleCode]
import { POST } from "../../app/api/admin/modules/[moduleCode]/standard/generate/route";

const MODULE_CODE = "MODULE_EV_PARKING";
const STANDARD_KEY = "EV_PARKING";
const ATTRIBUTES = {
  HAS_CHARGING: true,
  INDOOR_GARAGE: false,
  UNDERGROUND: false,
  CAPACITY_LEVEL: "MEDIUM",
  DC_FAST: false,
};

let failed = 0;

async function ok(name: string, fn: () => void | Promise<void>) {
  try {
    await Promise.resolve(fn());
    console.log(`  OK: ${name}`);
  } catch (e) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

function buildRequest(body: object): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function main() {
  if (!process.env.RUNTIME_DATABASE_URL || !process.env.CORPUS_DATABASE_URL) {
    console.error("Set RUNTIME_DATABASE_URL and CORPUS_DATABASE_URL.");
    process.exit(1);
  }

  console.log("moduleStandardGeneration (determinism + EV_PARKING)\n");

  // Ensure test module exists in RUNTIME
  const { getRuntimePool } = await import("../../app/lib/db/runtime_client");
  const runtime = getRuntimePool();
  const mod = await runtime.query("SELECT 1 FROM public.assessment_modules WHERE module_code = $1", [MODULE_CODE]);
  if (!mod.rowCount) {
    await runtime.query(
      `INSERT INTO public.assessment_modules (module_code, module_name) VALUES ($1, $2)`,
      [MODULE_CODE, "EV Parking (doctrine test)"]
    );
  }

  const ctx = { params: Promise.resolve({ moduleCode: MODULE_CODE }) };

  await ok("Determinism: two dry-runs produce same criterion_key and template_key sets", async () => {
    const req1 = buildRequest({ standard_key: STANDARD_KEY, attributes: ATTRIBUTES, dryRun: true });
    const req2 = buildRequest({ standard_key: STANDARD_KEY, attributes: ATTRIBUTES, dryRun: true });
    const res1 = await POST(req1 as any, ctx as any);
    const res2 = await POST(req2 as any, ctx as any);
    if (res1.status !== 200 || res2.status !== 200) {
      const t1 = await res1.text();
      const t2 = await res2.text();
      throw new Error(`Non-200: res1=${res1.status} ${t1.slice(0,200)} res2=${res2.status} ${t2.slice(0,200)}`);
    }
    const j1 = await res1.json();
    const j2 = await res2.json();
    const keys1 = new Set((j1.criteria || []).map((c: any) => c.criterion_key));
    const keys2 = new Set((j2.criteria || []).map((c: any) => c.criterion_key));
    if (keys1.size !== keys2.size || [...keys1].some((k) => !keys2.has(k))) {
      throw new Error(`criteria keys differ: ${[...keys1].join(",")} vs ${[...keys2].join(",")}`);
    }
    const tpl1 = new Set((j1.ofcs || []).map((o: any) => `${o.criterion_key}:${o.template_key}`));
    const tpl2 = new Set((j2.ofcs || []).map((o: any) => `${o.criterion_key}:${o.template_key}`));
    if (tpl1.size !== tpl2.size || [...tpl1].some((t) => !tpl2.has(t))) {
      throw new Error(`ofc (criterion_key:template_key) sets differ`);
    }
  });

  await ok("EV_PARKING: >0 criteria, >0 OFCs", async () => {
    const req = buildRequest({ standard_key: STANDARD_KEY, attributes: ATTRIBUTES, dryRun: true });
    const res = await POST(req as any, ctx as any);
    if (res.status !== 200) {
      const t = await res.text();
      throw new Error(`Non-200: ${res.status} ${t.slice(0, 300)}`);
    }
    const j = await res.json();
    const criteria = j.criteria || [];
    const ofcs = j.ofcs || [];
    if (criteria.length === 0) throw new Error("EV_PARKING produced 0 criteria");
    if (ofcs.length === 0) throw new Error("EV_PARKING produced 0 OFCs");
  });

  await ok("EV_PARKING: every APPLIES criterion has ≥1 OFC", async () => {
    const req = buildRequest({ standard_key: STANDARD_KEY, attributes: ATTRIBUTES, dryRun: true });
    const res = await POST(req as any, ctx as any);
    if (res.status !== 200) {
      const t = await res.text();
      throw new Error(`Non-200: ${res.status} ${t.slice(0, 200)}`);
    }
    const j = await res.json();
    const criteria = j.criteria || [];
    const ofcs = j.ofcs || [];
    const applies = criteria.filter((c: any) => c.applicability === "APPLIES");
    const ofcByCriterion = new Set(ofcs.map((o: any) => o.criterion_key));
    for (const c of applies) {
      if (!ofcByCriterion.has(c.criterion_key)) {
        throw new Error(`APPLIES criterion ${c.criterion_key} has no OFC in ofcs list`);
      }
    }
  });

  const isLive = process.argv.includes("--live");
  if (isLive) {
    await ok("Live: generate with dryRun=false and verify persistence", async () => {
      const req = buildRequest({ standard_key: STANDARD_KEY, attributes: ATTRIBUTES, dryRun: false });
      const res = await POST(req as any, ctx as any);
      if (res.status !== 200) {
        const t = await res.text();
        throw new Error(`Non-200: ${res.status} ${t.slice(0, 300)}`);
      }
      const inst = await runtime.query(
        `SELECT id FROM public.module_instances WHERE module_code = $1`,
        [MODULE_CODE]
      );
      if (!inst.rowCount) throw new Error("module_instances: no row for " + MODULE_CODE);
      const id = inst.rows[0].id;
      const crit = await runtime.query(
        `SELECT 1 FROM public.module_instance_criteria WHERE module_instance_id = $1`,
        [id]
      );
      if (!crit.rowCount) throw new Error("module_instance_criteria: no rows");
      const ofc = await runtime.query(
        `SELECT 1 FROM public.module_instance_ofcs WHERE module_instance_id = $1`,
        [id]
      );
      if (!ofc.rowCount) throw new Error("module_instance_ofcs: no rows");
    });
  }

  console.log("");
  if (failed > 0) {
    console.error(`${failed} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("All checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
