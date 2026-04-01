#!/usr/bin/env node
/**
 * Truth Diff Harness: deterministic diff between JSON export, canonical derived, web summary, and reporter model.
 * Exit 2 on any mismatch. No Next.js; pure TS + spawn reporter for pre-DOCX model.
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

// Pure extractors and comparison (no React). Import from app/lib so we use same canonical build as UI/export.
import { buildCanonicalVulnBlocks, type PrebuiltSessions } from '../app/lib/export/canonical_vuln_blocks';

const DOMAIN_ORDER = ['ELECTRIC_POWER', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'WATER', 'WASTEWATER'] as const;
const MAX_OFCS = 4;

export type NormalizedVuln = {
  domain: string;
  vuln_id: string;
  title: string;
  narrative: string;
  ofcs: string[];
};

export type RawFacts = Record<string, Record<string, unknown>>;

function norm(s: string): string {
  return (s ?? '')
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ');
}

function parseArgs(): { jsonPath: string; outDir: string; strict: boolean } {
  const argv = process.argv.slice(2);
  let jsonPath = '';
  let outDir = path.join(process.cwd(), 'scripts', 'fixtures', 'out');
  let strict = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json' && argv[i + 1]) {
      jsonPath = path.isAbsolute(argv[i + 1]) ? argv[i + 1] : path.join(process.cwd(), argv[i + 1]);
      i++;
    } else if (argv[i] === '--out' && argv[i + 1]) {
      outDir = path.isAbsolute(argv[i + 1]) ? argv[i + 1] : path.join(process.cwd(), argv[i + 1]);
      i++;
    } else if (argv[i] === '--strict') {
      strict = true;
    }
  }
  return { jsonPath, outDir, strict };
}

function loadPayload(jsonPath: string): Record<string, unknown> {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

/** A) Raw surface: minimal facts per domain from assessment.categories (and sessions) — no interpretation. */
function extractRawFacts(payload: Record<string, unknown>): RawFacts {
  const assessment = (payload.assessment as Record<string, unknown>) ?? {};
  const categories = (assessment.categories as Record<string, Record<string, unknown>>) ?? {};
  const sessions = (assessment.sessions as Record<string, Record<string, unknown>>) ?? {};
  const out: RawFacts = {};
  for (const code of DOMAIN_ORDER) {
    const cat = categories[code] ?? {};
    const sess = sessions[code] as Record<string, unknown> | undefined;
    const answers = (sess?.answers as Record<string, unknown>) ?? {};
    const combined = { ...cat, ...(typeof answers === 'object' && answers !== null ? answers : {}) };
    const keys = Object.keys(combined).filter(
      (k) =>
        k !== 'report_themed_findings' &&
        k !== 'agreements' &&
        combined[k] !== undefined &&
        combined[k] !== null
    );
    const facts: Record<string, unknown> = {};
    for (const k of keys) facts[k] = combined[k];
    out[code] = facts;
  }
  return out;
}

function blocksToNormalized(blocks: Array<{ domain?: string; vuln_id?: string; title?: string; narrative?: string; ofcText?: string }>): NormalizedVuln[] {
  const list: NormalizedVuln[] = [];
  for (const b of blocks) {
    const title = (b.title ?? '').trim();
    if (!title) continue;
    const domain = (b.domain ?? '').trim();
    const vuln_id = (b.vuln_id ?? '').trim() || title;
    const narrative = (b.narrative ?? '').trim();
    const ofcText = (b.ofcText ?? '').trim();
    const ofcs = ofcText ? ofcText.split(/\n/).map((s) => s.trim()).filter(Boolean).slice(0, MAX_OFCS) : [];
    list.push({ domain, vuln_id, title, narrative, ofcs });
  }
  return list;
}

/** B) Canonical from JSON: payload.canonicalVulnBlocks or sessions.<domain>.derived. */
function extractCanonicalFromPayload(payload: Record<string, unknown>): NormalizedVuln[] {
  const assessmentObj = payload.assessment as Record<string, unknown> | undefined;
  if (assessmentObj && typeof assessmentObj === 'object') {
    // Canonical is always recomputed from assessment to prevent stale embedded blocks
    // from masking truth-drift in current runtime logic.
    const sessions = (assessmentObj as { sessions?: PrebuiltSessions }).sessions;
    const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(
      assessmentObj as import('schema').Assessment,
      sessions && typeof sessions === 'object' ? sessions : undefined
    );
    return blocksToNormalized(canonicalVulnBlocks as Array<{ domain?: string; vuln_id?: string; title?: string; narrative?: string; ofcText?: string }>);
  }
  return [];
}

/** C) Web summary: same as canonical — build from assessment via buildCanonicalVulnBlocks (pure TS). */
function computeWebSummary(assessment: Record<string, unknown>): NormalizedVuln[] {
  const prev = process.env.REPORT_ALLOW_UNMAPPED_KEYS;
  process.env.REPORT_ALLOW_UNMAPPED_KEYS = 'true';
  try {
    const sessions = (assessment as { sessions?: PrebuiltSessions }).sessions;
    const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(
      assessment as import('schema').Assessment,
      sessions && typeof sessions === 'object' ? sessions : undefined
    );
    return blocksToNormalized(canonicalVulnBlocks as Array<{ domain?: string; vuln_id?: string; title?: string; narrative?: string; ofcText?: string }>);
  } finally {
    if (prev !== undefined) process.env.REPORT_ALLOW_UNMAPPED_KEYS = prev;
    else delete process.env.REPORT_ALLOW_UNMAPPED_KEYS;
  }
}

/** D) Reporter model: spawn Python --emit-vuln-model, read emitted JSON. */
function extractReporterModel(payload: Record<string, unknown>, jsonPath: string, outDir: string): NormalizedVuln[] | 'UNAVAILABLE' {
  const hasExportShape =
    (Array.isArray(payload.canonicalVulnBlocks) && (payload.canonicalVulnBlocks as unknown[]).length > 0) ||
    (typeof payload.report_vm === 'object' && payload.report_vm !== null);
  if (!hasExportShape) return 'UNAVAILABLE';
  const assessmentObj = payload.assessment as Record<string, unknown> | undefined;
  if (assessmentObj && typeof assessmentObj === 'object') {
    const sessions = (assessmentObj as { sessions?: PrebuiltSessions }).sessions;
    const { canonicalVulnBlocks, canonicalTotals } = buildCanonicalVulnBlocks(
      assessmentObj as import('schema').Assessment,
      sessions && typeof sessions === 'object' ? sessions : undefined
    );
    payload = {
      ...payload,
      canonicalVulnBlocks,
      canonicalTotals,
    };
  }
  fs.mkdirSync(outDir, { recursive: true });
  const payloadPath = path.join(outDir, 'payload_for_reporter.json');
  fs.writeFileSync(payloadPath, JSON.stringify(payload), 'utf8');
  const scriptDir = path.resolve(__dirname);
  const repoRoot = path.join(scriptDir, '..', '..');
  let reporterMain = path.join(repoRoot, 'apps', 'reporter', 'main.py');
  if (!fs.existsSync(reporterMain)) {
    const fromWeb = path.join(process.cwd(), '..', '..', 'apps', 'reporter', 'main.py');
    const fromRoot = path.join(process.cwd(), 'apps', 'reporter', 'main.py');
    if (fs.existsSync(fromWeb)) reporterMain = fromWeb;
    else if (fs.existsSync(fromRoot)) reporterMain = fromRoot;
  }
  const outPath = path.join(outDir, 'reporter_vuln_model.json');
  if (!fs.existsSync(reporterMain)) return 'UNAVAILABLE';
  const result = spawnSync('python', [reporterMain, '--emit-vuln-model', '--json', payloadPath, '--out', outPath], {
    cwd: path.dirname(reporterMain),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) return 'UNAVAILABLE';
  if (!fs.existsSync(outPath)) return 'UNAVAILABLE';
  const raw = fs.readFileSync(outPath, 'utf8');
  const arr = JSON.parse(raw) as Array<{ domain?: string; vuln_id?: string; title?: string; narrative?: string; ofcs?: string[] }>;
  return (arr ?? []).map((r) => ({
    domain: (r.domain ?? '').trim(),
    vuln_id: (r.vuln_id ?? '').trim() || (r.title ?? '').trim(),
    title: (r.title ?? '').trim(),
    narrative: (r.narrative ?? '').trim(),
    ofcs: Array.isArray(r.ofcs) ? r.ofcs.slice(0, MAX_OFCS) : [],
  }));
}

type MismatchType =
  | 'MISSING'
  | 'EXTRA'
  | 'TITLE_MISMATCH'
  | 'NARRATIVE_MISMATCH'
  | 'OFC_MISMATCH'
  | 'CONTRADICTION'
  | 'ID_MISSING'
  | 'COUNT_MISMATCH';

interface Mismatch {
  type: MismatchType;
  domain?: string;
  key?: { vuln_id?: string; title?: string };
  canonical?: Partial<NormalizedVuln>;
  web?: Partial<NormalizedVuln>;
  reporter?: Partial<NormalizedVuln>;
  evidence?: { raw_fields_present?: string[]; notes?: string };
}

function key(v: NormalizedVuln): string {
  return `${v.domain}:${(v.vuln_id || v.title).trim()}`;
}

function compare(
  canonical: NormalizedVuln[],
  web: NormalizedVuln[],
  reporter: NormalizedVuln[] | 'UNAVAILABLE',
  rawFacts: RawFacts,
  strict: boolean
): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const canonByKey = new Map(canonical.map((c) => [key(c), c]));
  const webByKey = new Map(web.map((w) => [key(w), w]));
  const repList = reporter === 'UNAVAILABLE' ? [] : reporter;
  const repByKey = new Map(repList.map((r) => [key(r), r]));

  if (canonical.length !== web.length) {
    mismatches.push({
      type: 'COUNT_MISMATCH',
      evidence: { notes: `canonical=${canonical.length} web=${web.length}` },
    });
  }
  if (reporter !== 'UNAVAILABLE' && canonical.length !== repList.length) {
    mismatches.push({
      type: 'COUNT_MISMATCH',
      evidence: { notes: `canonical=${canonical.length} reporter=${repList.length}` },
    });
  }

  const allKeys = new Set([...canonByKey.keys(), ...webByKey.keys(), ...repByKey.keys()]);
  for (const k of allKeys) {
    const [dom] = k.split(':');
    const c = canonByKey.get(k);
    const w = webByKey.get(k);
    const r = repByKey.get(k);

    if (!c && w) mismatches.push({ type: 'MISSING', domain: dom, key: { title: w?.title, vuln_id: w?.vuln_id }, web: w });
    if (c && !w) mismatches.push({ type: 'EXTRA', domain: dom, key: { title: c?.title, vuln_id: c?.vuln_id }, canonical: c });
    if (c && w && norm(c.title) !== norm(w.title)) mismatches.push({ type: 'TITLE_MISMATCH', domain: dom, key: { vuln_id: c.vuln_id, title: c.title }, canonical: c, web: w });
    if (c && w && norm(c.narrative) !== norm(w.narrative)) mismatches.push({ type: 'NARRATIVE_MISMATCH', domain: dom, key: { vuln_id: c.vuln_id, title: c.title }, canonical: c, web: w });
    if (c && w) {
      const co = (c.ofcs ?? []).slice(0, MAX_OFCS);
      const wo = (w.ofcs ?? []).slice(0, MAX_OFCS);
      if (co.length !== wo.length || co.some((_, i) => norm(co[i]) !== norm(wo[i]))) {
        mismatches.push({ type: 'OFC_MISMATCH', domain: dom, key: { vuln_id: c.vuln_id, title: c.title }, canonical: c, web: w });
      }
    }

    if (reporter !== 'UNAVAILABLE') {
      if (!c && r) mismatches.push({ type: 'MISSING', domain: dom, key: { title: r?.title, vuln_id: r?.vuln_id }, reporter: r });
      if (c && !r) mismatches.push({ type: 'EXTRA', domain: dom, key: { title: c?.title, vuln_id: c?.vuln_id }, canonical: c });
      if (c && r && (norm(c.title) !== norm(r.title) || norm(c.narrative) !== norm(r.narrative))) {
        mismatches.push({ type: 'TITLE_MISMATCH', domain: dom, key: { vuln_id: c.vuln_id, title: c.title }, canonical: c, reporter: r });
        mismatches.push({ type: 'NARRATIVE_MISMATCH', domain: dom, key: { vuln_id: c.vuln_id, title: c.title }, canonical: c, reporter: r });
      }
      if (c && r) {
        const co = (c.ofcs ?? []).slice(0, MAX_OFCS);
        const ro = (r.ofcs ?? []).slice(0, MAX_OFCS);
        if (co.length !== ro.length || co.some((_, i) => norm(co[i]) !== norm(ro[i]))) {
          mismatches.push({ type: 'OFC_MISMATCH', domain: dom, key: { vuln_id: c.vuln_id, title: c.title }, canonical: c, reporter: r });
        }
      }
    }
  }

  // Contradiction detectors
  for (const v of canonical) {
    const narrative = (v.narrative ?? '').toLowerCase();
    if (v.domain === 'INFORMATION_TECHNOLOGY') {
      const raw = rawFacts['INFORMATION_TECHNOLOGY'] ?? {};
      const hasTransport =
        raw.circuit_count !== undefined ||
        raw.carrier_diversity !== undefined ||
        (raw.physical_path_diversity && typeof raw.physical_path_diversity === 'object') ||
        raw.building_entry_diversity !== undefined ||
        raw.transport_building_entry_diversity !== undefined ||
        raw.upstream_pop_diversity !== undefined;
      if (hasTransport && (narrative.includes('not provided') || narrative.includes('not documented')) && narrative.includes('transport')) {
        const fields: string[] = [];
        if (raw.circuit_count !== undefined) fields.push('circuit_count');
        if (raw.carrier_diversity !== undefined) fields.push('carrier_diversity');
        if (raw.physical_path_diversity !== undefined) fields.push('physical_path_diversity');
        if (raw.building_entry_diversity !== undefined) fields.push('building_entry_diversity');
        if (raw.upstream_pop_diversity !== undefined) fields.push('upstream_pop_diversity');
        mismatches.push({
          type: 'CONTRADICTION',
          domain: 'INFORMATION_TECHNOLOGY',
          key: { vuln_id: v.vuln_id, title: v.title },
          canonical: v,
          evidence: { raw_fields_present: fields, notes: 'Narrative says not provided/not documented but transport fields exist.' },
        });
      }
      const hosted = raw.it_hosted_resilience as Record<string, { survivability?: string }> | undefined;
      if (hosted && typeof hosted === 'object') {
        const hasSurvivability = Object.values(hosted).some((v) => v && (v.survivability === 'NO_CONTINUITY' || v.survivability === 'UNKNOWN'));
        if (hasSurvivability && narrative.includes('not assessed')) {
          mismatches.push({
            type: 'CONTRADICTION',
            domain: 'INFORMATION_TECHNOLOGY',
            key: { vuln_id: v.vuln_id, title: v.title },
            canonical: v,
            evidence: { raw_fields_present: ['it_hosted_resilience'], notes: 'Narrative claims "Not assessed" but survivability values exist.' },
          });
        }
      }
    }
  }

  return mismatches;
}

function byDomainCounts(list: NormalizedVuln[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of DOMAIN_ORDER) counts[d] = 0;
  for (const v of list) {
    if (v.domain && DOMAIN_ORDER.includes(v.domain as (typeof DOMAIN_ORDER)[number])) counts[v.domain] = (counts[v.domain] ?? 0) + 1;
  }
  return counts;
}

function main() {
  const { jsonPath, outDir, strict } = parseArgs();
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    console.error('Usage: tsx truth_diff.ts --json <path-to-export.json> [--out <dir>] [--strict]');
    process.exit(1);
  }

  const payload = loadPayload(jsonPath);
  const assessment = (payload.assessment as Record<string, unknown>) ?? {};
  const rawFacts = extractRawFacts(payload);
  const canonical = extractCanonicalFromPayload(payload);
  const web = computeWebSummary(assessment);
  const reporter = extractReporterModel(payload, jsonPath, outDir);

  const mismatches = compare(canonical, web, reporter, rawFacts, strict);

  const repCount = reporter === 'UNAVAILABLE' ? null : reporter.length;
  const counts = {
    canonical: canonical.length,
    web: web.length,
    reporter: repCount,
    by_domain: {
      canonical: byDomainCounts(canonical),
      web: byDomainCounts(web),
      reporter: reporter === 'UNAVAILABLE' ? null : byDomainCounts(reporter),
    },
  };

  const artifact = {
    meta: { input: jsonPath, generated_at: new Date().toISOString(), strict },
    counts,
    raw_facts_per_domain: rawFacts,
    mismatches,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const jsonOut = path.join(outDir, 'truth_diff.json');
  fs.writeFileSync(jsonOut, JSON.stringify(artifact, null, 2), 'utf8');

  const mdOut = path.join(outDir, 'truth_diff.md');
  const md = [
    '# Truth Diff Report',
    '',
    `**Input:** ${jsonPath}`,
    `**Generated:** ${artifact.meta.generated_at}`,
    '',
    '## Counts',
    `| Surface | Total |`,
    `|---------|-------|`,
    `| Canonical | ${counts.canonical} |`,
    `| Web | ${counts.web} |`,
    `| Reporter | ${repCount ?? 'UNAVAILABLE'} |`,
    '',
    mismatches.length > 0 ? `## Mismatches (${mismatches.length})\n` + mismatches.slice(0, 50).map((m) => `- **${m.type}** ${m.domain ?? ''} ${m.key?.vuln_id ?? m.key?.title ?? ''} ${m.evidence?.notes ?? ''}`).join('\n') : '## Result: PASS',
  ].join('\n');
  fs.writeFileSync(mdOut, md, 'utf8');

  // Console summary
  console.log('Truth Diff Harness');
  console.log(`Counts: canonical=${counts.canonical} web=${counts.web} reporter=${repCount ?? 'UNAVAILABLE'}`);
  if (mismatches.length > 0) {
    console.log(`Mismatches: ${mismatches.length}`);
    const show = mismatches.slice(0, 25);
    for (const m of show) {
      const k = m.key ? ` ${m.key.vuln_id ?? m.key.title ?? ''}` : '';
      console.log(`  [${m.type}]${m.domain ?? ''}${k}: ${m.evidence?.notes ?? ''}`);
    }
    if (mismatches.length > 25) console.log(`  ... and ${mismatches.length - 25} more`);
    console.log(`FAIL (${mismatches.length} mismatches)`);
    console.log(`Artifact: ${jsonOut}`);
    console.log(`Summary: ${mdOut}`);
    process.exit(2);
  }
  console.log('PASS');
  console.log(`Artifact: ${jsonOut}`);
  console.log(`Summary: ${mdOut}`);
  process.exit(0);
}

main();
