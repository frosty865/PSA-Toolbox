#!/usr/bin/env node
/**
 * Lane guards: prevent dependency wording drift.
 * - Non-ENERGY prompts: no refuel, refueling, fuel, diesel, gasoline, propane
 * - IT prompts: no conduit, entrance, demarc, physically separated, independently routed, fiber, last-mile, route diversity
 */
const path = require('path');
const fs = require('fs');

const WEB_ROOT = path.resolve(__dirname, '..');
const INFRA = path.join(WEB_ROOT, 'app', 'lib', 'dependencies', 'infrastructure');

const ENERGY_SPEC = path.join(INFRA, 'energy_spec.ts');
const IT_SPEC = path.join(INFRA, 'it_spec.ts');

const FUEL_TERMS = /\b(refuel|refueling|fuel|diesel|gasoline|propane)\b/i;
const ENUMERATE_FORBIDDEN = /\benumerate\b/i;
const IT_FORBIDDEN = /\b(conduit|entrance|demarc|last-mile|fiber|physically separated|independently routed|route diversity|path diversity|carrier circuit|POP|central office)\b/i;

function extractPrompts(content) {
  const prompts = [];
  const promptRe = /prompt:\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = promptRe.exec(content)) !== null) {
    prompts.push(m[1]);
  }
  return prompts;
}

function extractHelpTexts(content) {
  const texts = [];
  const helpRe = /helpText:\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = helpRe.exec(content)) !== null) {
    texts.push(m[1]);
  }
  return texts;
}

function readFile(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  let failed = 0;

  // 1) Non-ENERGY specs: prompts and helpText may not include fuel terms
  const nonEnergySpecs = ['comms_spec.ts', 'it_spec.ts', 'water_spec.ts', 'wastewater_spec.ts'];
  for (const name of nonEnergySpecs) {
    const file = path.join(INFRA, name);
    const content = readFile(file);
    const prompts = extractPrompts(content);
    const helpTexts = extractHelpTexts(content);
    for (const p of prompts) {
      if (FUEL_TERMS.test(p)) {
        console.error(`[verify_dependency_wording] ERROR: ${file} prompt contains fuel term: "${p.slice(0, 80)}..."`);
        failed++;
      }
      if (ENUMERATE_FORBIDDEN.test(p)) {
        console.error(`[verify_dependency_wording] ERROR: ${file} prompt contains "enumerate": "${p.slice(0, 80)}..."`);
        failed++;
      }
    }
    for (const h of helpTexts) {
      if (FUEL_TERMS.test(h)) {
        console.error(`[verify_dependency_wording] ERROR: ${file} helpText contains fuel term: "${h.slice(0, 80)}..."`);
        failed++;
      }
      if (ENUMERATE_FORBIDDEN.test(h)) {
        console.error(`[verify_dependency_wording] ERROR: ${file} helpText contains "enumerate": "${h.slice(0, 80)}..."`);
        failed++;
      }
    }
  }

  // 2) IT spec: prompts and helpText may not include transport/routing terms
  const itContent = readFile(IT_SPEC);
  const itPrompts = extractPrompts(itContent);
  const itHelpTexts = extractHelpTexts(itContent);
  for (const p of itPrompts) {
    if (IT_FORBIDDEN.test(p)) {
      console.error(`[verify_dependency_wording] ERROR: ${IT_SPEC} prompt contains IT-forbidden term: "${p.slice(0, 80)}..."`);
      failed++;
    }
  }
  for (const h of itHelpTexts) {
    if (IT_FORBIDDEN.test(h)) {
      console.error(`[verify_dependency_wording] ERROR: ${IT_SPEC} helpText contains IT-forbidden term: "${h.slice(0, 80)}..."`);
      failed++;
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
  return 0;
}

main();
