/**
 * Dependency parity validator — HARD-FAIL build.
 * Treats Energy as canonical; fails if any dependency lacks Electricity-level rigor.
 * Run: pnpm --filter web exec tsx scripts/validate_dependency_parity.ts
 */
import {
  DEPENDENCY_ROLE_MAP,
  CANONICAL_DEPENDENCY,
  ALL_ROLE_KEYS,
  type DependencyKey,
  type RoleKey,
} from '@/app/lib/dependencies/dependency_role_map';
import { buildEnergyConfig, buildCommunicationsConfig, buildInformationTechnologyConfig, buildWaterConfig, buildWastewaterConfig, type DependencyConfig } from '@/app/lib/dependencies/dependency_parity_config';

const FORBIDDEN_PLACEHOLDERS = ['Choose an item', '____'] as const;
const REQUIRED_NARRATIVE_TOKENS = ['{{impact_onset_hours}}', '{{functional_loss_percent}}', '{{recovery_time_hours}}'] as const;

type Failure = {
  dependency: DependencyKey;
  rule: string;
  message: string;
  detail?: string;
};

const failures: Failure[] = [];

function fail(dep: DependencyKey, rule: string, message: string, detail?: string): void {
  failures.push({ dependency: dep, rule, message, detail });
}

// ─── A) ROLE PARITY ───────────────────────────────────────────────────────
/** Only run role parity for dependencies that are implemented (have at least one question). */
function validateRoles(configs: Record<DependencyKey, DependencyConfig>): void {
  const canonical = DEPENDENCY_ROLE_MAP[CANONICAL_DEPENDENCY];
  const questionIdsByDep = new Map<DependencyKey, Set<string>>();
  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const set = new Set(configs[dep].questions.map((q) => q.id));
    questionIdsByDep.set(dep, set);
  }

  for (const dep of Object.keys(configs) as DependencyKey[]) {
    if (dep === CANONICAL_DEPENDENCY) continue;
    const config = configs[dep];
    if (config.questions.length === 0) continue; // not implemented: skip role parity (no qids to check)
    const mapping = DEPENDENCY_ROLE_MAP[dep];
    const qidSet = questionIdsByDep.get(dep)!;
    for (const role of ALL_ROLE_KEYS) {
      const requiredQids = mapping[role];
      const canonQids = canonical[role];
      if (!canonQids || canonQids.length === 0) continue;
      if (!requiredQids || requiredQids.length === 0) {
        fail(dep, 'ROLE_PARITY', `role "${role}" missing: canonical has qids but dependency has no mapped qids`);
        continue;
      }
      for (const qid of requiredQids) {
        if (!qidSet.has(qid)) {
          fail(dep, 'ROLE_PARITY', `role "${role}" missing qid`, qid);
        }
      }
    }
  }
}

// ─── B) IMPACT CURVE CONTRACT ──────────────────────────────────────────────
const IMPACT_ROLES: RoleKey[] = [
  'dependency_gate',
  'time_to_impact_hours',
  'percent_functional_loss',
  'time_to_recovery_hours',
];

function validateImpactContract(configs: Record<DependencyKey, DependencyConfig>): void {
  const canonical = DEPENDENCY_ROLE_MAP[CANONICAL_DEPENDENCY];
  const expectedRanges: Record<string, { min: number; max: number }> = {
    time_to_impact_hours: { min: 0, max: 72 },
    percent_functional_loss: { min: 0, max: 100 },
    time_to_recovery_hours: { min: 0, max: 168 },
  };

  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];
    if (config.questions.length === 0) continue;
    const qidByRole = dep === CANONICAL_DEPENDENCY ? canonical : DEPENDENCY_ROLE_MAP[dep];
    const questionById = new Map(config.questions.map((q) => [q.id, q]));

    for (const role of IMPACT_ROLES) {
      const qids = qidByRole[role];
      if (!qids || qids.length === 0) {
        fail(dep, 'IMPACT_CURVE', `missing role qid for impact curve`, role);
        continue;
      }
      for (const qid of qids) {
        const q = questionById.get(qid);
        if (!q) continue;
        const range = expectedRanges[role as keyof typeof expectedRanges];
        if (range) {
          if (q.min === undefined || q.min < range.min) {
            fail(dep, 'IMPACT_CURVE', `question "${qid}" missing or invalid min (expected >= ${range.min})`, `min=${q.min}`);
          }
          if (q.max === undefined || q.max > range.max) {
            fail(dep, 'IMPACT_CURVE', `question "${qid}" missing or invalid max (expected <= ${range.max})`, `max=${q.max}`);
          }
        }
      }
    }
  }
}

// ─── C) VULNERABILITY ORIGIN RULE ──────────────────────────────────────────
function validateVulnOrigin(configs: Record<DependencyKey, DependencyConfig>): void {
  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];
    if (config.questions.length === 0 && config.vulnerabilities.length === 0) continue;
    const questionIds = new Set(config.questions.map((q) => q.id));

    for (const v of config.vulnerabilities) {
      if (!v.trigger_question_ids || v.trigger_question_ids.length === 0) {
        fail(dep, 'VULN_ORIGIN', 'orphan vulnerability (no trigger question)', v.id);
        continue;
      }
      for (const qid of v.trigger_question_ids) {
        if (!questionIds.has(qid)) {
          fail(dep, 'VULN_ORIGIN', `vulnerability "${v.id}" trigger question_id not in questions`, qid);
        }
      }
    }

    for (const q of config.questions) {
      if (q.triggers) {
        for (const t of q.triggers) {
          const vuln = config.vulnerabilities.find((v) => v.id === t.vulnerability_id);
          if (!vuln) {
            fail(dep, 'VULN_ORIGIN', `question "${q.id}" declares trigger for non-existent vulnerability`, t.vulnerability_id);
          } else if (!vuln.trigger_question_ids.includes(q.id)) {
            fail(dep, 'VULN_ORIGIN', `question "${q.id}" triggers "${t.vulnerability_id}" but vulnerability does not list question (bidirectional)`, '');
          }
        }
      }
    }
  }
}

// ─── D) OFC COMPLETENESS ───────────────────────────────────────────────────
function validateOfcs(configs: Record<DependencyKey, DependencyConfig>): void {
  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];
    if (config.vulnerabilities.length === 0 && config.ofcs.length === 0) continue;
    const vulnIds = new Set(config.vulnerabilities.map((v) => v.id));

    for (const v of config.vulnerabilities) {
      const ofcsForV = config.ofcs.filter((o) => o.vulnerability_id === v.id);
      if (ofcsForV.length === 0) {
        fail(dep, 'OFC_COMPLETENESS', 'vulnerability has no OFC', v.id);
      }
    }

    for (const ofc of config.ofcs) {
      if (!vulnIds.has(ofc.vulnerability_id)) {
        fail(dep, 'OFC_COMPLETENESS', 'OFC references unknown vulnerability_id', ofc.vulnerability_id);
      }
      if (!ofc.text || ofc.text.trim() === '') {
        fail(dep, 'OFC_COMPLETENESS', 'OFC has empty text', ofc.id);
      }
      for (const phrase of FORBIDDEN_PLACEHOLDERS) {
        if (ofc.text.includes(phrase)) {
          fail(dep, 'OFC_COMPLETENESS', `OFC contains forbidden placeholder`, `ofc ${ofc.id}: "${phrase}"`);
        }
      }
      if (ofc.text.includes('{{') && ofc.text.includes('}}')) {
        fail(dep, 'OFC_COMPLETENESS', 'OFC contains unresolved token ({{...}})', ofc.id);
      }
    }
  }
}

// ─── E) REPORT PLACEHOLDER GUARD ───────────────────────────────────────────
function validateReportPlaceholders(configs: Record<DependencyKey, DependencyConfig>): void {
  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];

    for (const template of config.report_templates) {
      for (const phrase of FORBIDDEN_PLACEHOLDERS) {
        if (template.content.includes(phrase)) {
          fail(dep, 'REPORT_PLACEHOLDER', `report template "${template.id}" contains forbidden text`, phrase);
        }
      }
      for (const token of REQUIRED_NARRATIVE_TOKENS) {
        if (template.content.includes(token)) {
          const binding = config.report_bindings?.find((b) => b.token === token);
          if (!binding) {
            fail(dep, 'REPORT_PLACEHOLDER', `template contains token but report_bindings missing`, token);
          }
        }
      }
    }

    for (const v of config.vulnerabilities) {
      for (const phrase of FORBIDDEN_PLACEHOLDERS) {
        if (v.text.includes(phrase)) {
          fail(dep, 'REPORT_PLACEHOLDER', `vulnerability text contains forbidden placeholder`, `vuln ${v.id}: "${phrase}"`);
        }
      }
    }
  }
}

// ─── F) ASSET CARDINALITY (schema-level) ───────────────────────────────────
function validateAssetsSchema(configs: Record<DependencyKey, DependencyConfig>): void {
  const rolesImplyingAssets: RoleKey[] = ['upstream_assets_enumerated', 'redundancy_present', 'provider_identified'];

  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];
    if (config.questions.length === 0) continue; // not implemented: role map has qids but no config to enforce
    const mapping = DEPENDENCY_ROLE_MAP[dep];
    const hasAssetRoles = rolesImplyingAssets.some((role) => {
      const qids = mapping[role];
      return qids && qids.length > 0;
    });
    if (hasAssetRoles && !config.assets_schema) {
      fail(dep, 'ASSET_CARDINALITY', 'dependency has upstream/redundancy/provider roles but assets_schema missing', '');
    }
    if (config.assets_schema) {
      if (config.assets_schema.minItemsWhenRequiresService < 1) {
        fail(dep, 'ASSET_CARDINALITY', 'assets_schema.minItemsWhenRequiresService must be >= 1', String(config.assets_schema.minItemsWhenRequiresService));
      }
      const required = ['name', 'location', 'designation', 'type'];
      for (const f of required) {
        if (!config.assets_schema.requiredFields.includes(f)) {
          fail(dep, 'ASSET_CARDINALITY', 'assets_schema.requiredFields missing', f);
        }
      }
    }
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
function main(): void {
  const configs: Record<DependencyKey, DependencyConfig> = {
    energy: buildEnergyConfig(),
    communications: buildCommunicationsConfig(),
    information_technology: buildInformationTechnologyConfig(),
    water: buildWaterConfig(),
    wastewater: buildWastewaterConfig(),
  };

  validateRoles(configs);
  validateImpactContract(configs);
  validateVulnOrigin(configs);
  validateOfcs(configs);
  validateReportPlaceholders(configs);
  validateAssetsSchema(configs);

  if (failures.length > 0) {
    console.error('\n--- DEPENDENCY PARITY VALIDATION FAILED ---\n');
    const byDep = new Map<DependencyKey, Failure[]>();
    for (const f of failures) {
      const list = byDep.get(f.dependency) ?? [];
      list.push(f);
      byDep.set(f.dependency, list);
    }
    for (const dep of Object.keys(DEPENDENCY_ROLE_MAP) as DependencyKey[]) {
      const list = byDep.get(dep);
      if (!list?.length) continue;
      console.error(`[${dep}]`);
      for (const f of list) {
        console.error(`  - ${f.rule}: ${f.message}${f.detail ? ` (${f.detail})` : ''}`);
      }
      console.error('');
    }
    process.exit(1);
  }

  console.log('Dependency parity validation passed.');
}

main();
