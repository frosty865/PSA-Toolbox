#!/usr/bin/env node
/**
 * Smoke test for PLAN mode (Option 1): MODULE_AS_EAP dry run.
 * Run: npx tsx scripts/tests/planModeSmokeTest.ts
 *
 * Expects: 6-12 PLAN capabilities, 3-8 checklist items each, no "What should",
 * OFCs > 0, every unchecked item has 1-3 OFCs.
 * Requires: RUNTIME_DATABASE_URL, CORPUS_DATABASE_URL; MODULE_AS_EAP in assessment_modules;
 * chunk export at data/module_chunks/MODULE_AS_EAP.json (run Standard generate once to create).
 */

import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config();

// @ts-ignore — path with [moduleCode]
import { POST } from "../../app/api/admin/modules/[moduleCode]/standard/generate/route";

const MODULE_CODE = "MODULE_AS_EAP";
const STANDARD_KEY = "PHYSICAL_SECURITY_PLAN";

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

  console.log("PLAN mode smoke test (MODULE_AS_EAP, dry run)\n");

  const ctx = { params: Promise.resolve({ moduleCode: MODULE_CODE }) };
  const req = buildRequest({ standard_key: STANDARD_KEY, dryRun: true });
  const res = await POST(req as any, ctx as any);
  const text = await res.text();
  let j: any;
  try {
    j = JSON.parse(text);
  } catch {
    console.error("Response not JSON:", text.slice(0, 300));
    process.exit(1);
  }

  if (res.status !== 200) {
    console.error("Expected 200, got", res.status, j?.error || j?.message || text.slice(0, 200));
    if (j?.failure_reason) console.error("failure_reason:", j.failure_reason);
    if (j?.planValidation) console.error("planValidation:", j.planValidation);
    process.exit(1);
  }

  const planPreview = j.planPreview;
  if (!planPreview) {
    console.error("Expected planPreview in response (PLAN mode). Got source:", j.source);
    process.exit(1);
  }

  const { capabilities, items, ofcs } = planPreview;
  if (!Array.isArray(capabilities) || !Array.isArray(items) || !Array.isArray(ofcs)) {
    console.error("planPreview missing capabilities/items/ofcs arrays");
    process.exit(1);
  }

  const capabilityCount = capabilities.length;
  const itemCount = items.length;
  const ofcCount = ofcs.length;

  console.log("  Capabilities:", capabilityCount);
  console.log("  Checklist items:", itemCount);
  console.log("  OFCs:", ofcCount);

  const failures: string[] = [];

  if (capabilityCount < 6 || capabilityCount > 12) {
    failures.push(`capabilities count ${capabilityCount} not in 6-12`);
  }

  for (const c of capabilities) {
    if (String(c.title || "").toLowerCase().startsWith("what should")) {
      failures.push(`capability "${c.title}" starts with "What should"`);
    }
    const capItems = items.filter((i: any) => i.criterion_key === c.criterion_key);
    if (capItems.length < 3 || capItems.length > 8) {
      failures.push(`capability ${c.criterion_key} has ${capItems.length} items (expected 3-8)`);
    }
  }

  for (const i of items) {
    if (!(i.rationale && String(i.rationale).trim())) failures.push(`item ${i.item_key} missing rationale`);
    if (String(i.text || "").includes("?")) failures.push(`item text contains "?": ${String(i.text).slice(0, 50)}`);
  }

  for (const i of items) {
    const n = (i.ofcs || []).length;
    if (!i.checked && !i.is_na && n === 0) failures.push(`unchecked item ${i.item_key} has 0 OFCs`);
    if (!i.checked && !i.is_na && n > 3) failures.push(`unchecked item ${i.item_key} has ${n} OFCs (max 3)`);
  }

  if (ofcCount === 0) failures.push("OFCs count is 0");

  if (failures.length > 0) {
    console.error("FAILED:");
    failures.forEach((f) => console.error("  -", f));
    process.exit(1);
  }

  console.log("\nAll PLAN smoke checks passed.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
