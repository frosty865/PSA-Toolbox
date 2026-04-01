/**
 * Deterministic dependency parity validator — HARD-FAIL build.
 * Treats Energy as canonical; fails if any dependency is below Energy rigor.
 * Run from repo root: tsx tools/validate_dependency_parity.ts
 */
import {
  DEPENDENCY_ROLE_MAP,
  CANONICAL_DEPENDENCY,
  ALL_ROLE_KEYS,
  type DependencyKey,
  type RoleKey,
} from '../apps/web/app/lib/dependencies/dependency_role_map';
import {
  buildEnergyConfig,
  buildCommunicationsConfig,
  buildInformationTechnologyConfig,
  buildWaterConfig,
  buildWastewaterConfig,
  type DependencyConfig,
  type QuestionConfig,
  type VulnerabilityConfig,
  type OfcConfig,
} from '../apps/web/app/lib/dependencies/dependency_parity_config';

const FORBIDDEN_PLACEHOLDERS = ['Choose an item', '____'] as const;
const TOKENS = ['{{impact_onset_hours}}', '{{functional_loss_percent}}', '{{recovery_time_hours}}'] as const;

const IMPACT_CURVE_ROLES: RoleKey[] = [
  'dependency_gate',
  'time_to_impact_hours',
  'percent_functional_loss',
  'time_to_recovery_hours',
];

const CURVE_MIN_MAX: Record<string, { min: number; max: number }> = {
  time_to_impact_hours: { min: 0, max: 72 },
  percent_functional_loss: { min: 0, max: 100 },
  time_to_recovery_hours: { min: 0, max: 168 },
};

const ENERGY_BACKUP_DURATION_QID = 'curve_backup_duration';
const ENERGY_BACKUP_DURATION_RANGE = { min: 0, max: 96 };

function hasBadPlaceholder(s: string): boolean {
  return s.includes('Choose an item') || s.includes('____');
}

function hasUnresolvedToken(s: string): boolean {
  return s.includes('{{') && s.includes('}}');
}

type ErrorEntry = { dep: DependencyKey; rule: string; message: string; detail?: string };

const errors: ErrorEntry[] = [];

function add(dep: DependencyKey, rule: string, message: string, detail?: string): void {
  errors.push({ dep, rule, message, detail });
}

// ─── B1) ROLE PARITY AGAINST ENERGY ────────────────────────────────────────
function getRequiredRoleKeys(): RoleKey[] {
  const canonical = DEPENDENCY_ROLE_MAP[CANONICAL_DEPENDENCY];
  return ALL_ROLE_KEYS.filter((role) => {
    const qids = canonical[role];
    return qids && qids.length > 0;
  });
}

function validateRoleParity(configs: Record<DependencyKey, DependencyConfig>): void {
  const requiredRoles = getRequiredRoleKeys();
  const canonical = DEPENDENCY_ROLE_MAP[CANONICAL_DEPENDENCY];

  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];
    const qById = new Map<string, QuestionConfig>(config.questions.map((q) => [q.id, q]));

    for (const role of requiredRoles) {
      const depQids = DEPENDENCY_ROLE_MAP[dep][role];
      const canonQids = canonical[role];
      if (!canonQids || canonQids.length === 0) continue;
      if (!depQids || depQids.length === 0) {
        add(dep, 'ROLE_PARITY', `role "${role}" missing: canonical has qids but dependency has no mapped qids`);
        continue;
      }
      for (const qid of depQids) {
        if (!qById.has(qid)) {
          add(dep, 'ROLE_PARITY', `role "${role}" missing question_id`, qid);
        }
      }
    }
  }
}

// ─── B2) IMPACT CURVE CONTRACT ─────────────────────────────────────────────
function validateImpactCurve(configs: Record<DependencyKey, DependencyConfig>): void {
  const canonical = DEPENDENCY_ROLE_MAP[CANONICAL_DEPENDENCY];

  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];
    const qById = new Map(config.questions.map((q) => [q.id, q]));
    const mapping = DEPENDENCY_ROLE_MAP[dep];

    for (const role of IMPACT_CURVE_ROLES) {
      const qids = mapping[role];
      if (!qids || qids.length === 0) {
        add(dep, 'IMPACT_CURVE', `missing role qid for impact curve`, role);
        continue;
      }
      for (const qid of qids) {
        const q = qById.get(qid);
        if (!q) continue;
        const range = CURVE_MIN_MAX[role];
        if (range) {
          if (q.min === undefined || q.min < range.min) {
            add(dep, 'IMPACT_CURVE', `question "${qid}" invalid min (expected >= ${range.min})`, `min=${q.min}`);
          }
          if (q.max === undefined || q.max > range.max) {
            add(dep, 'IMPACT_CURVE', `question "${qid}" invalid max (expected <= ${range.max})`, `max=${q.max}`);
          }
        }
      }
    }

    if (dep === CANONICAL_DEPENDENCY) {
      const backupQids = mapping.backup_runtime_hours ?? [];
      if (backupQids.includes(ENERGY_BACKUP_DURATION_QID)) {
        const q = qById.get(ENERGY_BACKUP_DURATION_QID);
        if (q) {
          if (q.min === undefined || q.min < ENERGY_BACKUP_DURATION_RANGE.min) {
            add(dep, 'IMPACT_CURVE', `question "${ENERGY_BACKUP_DURATION_QID}" invalid min (expected >= 0)`, `min=${q.min}`);
          }
          if (q.max === undefined || q.max > ENERGY_BACKUP_DURATION_RANGE.max) {
            add(dep, 'IMPACT_CURVE', `question "${ENERGY_BACKUP_DURATION_QID}" invalid max (expected <= 96)`, `max=${q.max}`);
          }
        }
      }
    }
  }
}

// ─── B3) VULNERABILITY ORIGIN + BIDIRECTIONAL INTEGRITY ────────────────────
function validateVulnOrigin(configs: Record<DependencyKey, DependencyConfig>): void {
  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];
    const qById = new Map(config.questions.map((q) => [q.id, q]));
    const vById = new Map(config.vulnerabilities.map((v) => [v.id, v]));

    for (const v of config.vulnerabilities) {
      if (!v.trigger_question_ids || v.trigger_question_ids.length === 0) {
        add(dep, 'VULN_ORIGIN', 'orphan vulnerability (no trigger_question_ids)', v.id);
        continue;
      }
      for (const qid of v.trigger_question_ids) {
        if (!qById.has(qid)) {
          add(dep, 'VULN_ORIGIN', `vulnerability "${v.id}" references missing question_id`, qid);
        } else {
          const q = qById.get(qid)!;
          const hasTrigger = q.triggers?.some((t) => t.vulnerability_id === v.id);
          if (!hasTrigger) {
            add(dep, 'VULN_ORIGIN', `question "${qid}" must include triggers containing vulnerability_id "${v.id}" (bidirectional)`, '');
          }
        }
      }
    }

    for (const q of config.questions) {
      if (!q.triggers?.length) continue;
      for (const t of q.triggers) {
        if (!vById.has(t.vulnerability_id)) {
          add(dep, 'VULN_ORIGIN', `question "${q.id}" triggers non-existent vulnerability`, t.vulnerability_id);
        }
      }
    }
  }
}

// ─── B4) OFC COMPLETENESS + PLACEHOLDER GUARD ───────────────────────────────
function validateOfcs(configs: Record<DependencyKey, DependencyConfig>): void {
  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];
    const vById = new Map(config.vulnerabilities.map((v) => [v.id, v]));
    const oById = new Map(config.ofcs.map((o) => [o.id, o]));

    for (const v of config.vulnerabilities) {
      if (!v.ofc_ids || v.ofc_ids.length === 0) {
        add(dep, 'OFC_COMPLETENESS', `vulnerability "${v.id}" has no ofc_ids`, '');
        continue;
      }
      for (const ofcId of v.ofc_ids) {
        if (!oById.has(ofcId)) {
          add(dep, 'OFC_COMPLETENESS', `vulnerability "${v.id}" references missing ofc id`, ofcId);
        }
      }
    }

    for (const ofc of config.ofcs) {
      if (!vById.has(ofc.vulnerability_id)) {
        add(dep, 'OFC_COMPLETENESS', `ofc "${ofc.id}" references unknown vulnerability_id`, ofc.vulnerability_id);
      }
      if (hasBadPlaceholder(ofc.text)) {
        add(dep, 'OFC_PLACEHOLDER', `ofc "${ofc.id}" contains forbidden placeholder`, ofc.text.slice(0, 60));
      }
      if (hasUnresolvedToken(ofc.text)) {
        add(dep, 'OFC_PLACEHOLDER', `ofc "${ofc.id}" contains unresolved token ({{...}})`, '');
      }
    }

    for (const v of config.vulnerabilities) {
      if (hasBadPlaceholder(v.text)) {
        add(dep, 'OFC_PLACEHOLDER', `vulnerability "${v.id}" text contains forbidden placeholder`, v.text.slice(0, 60));
      }
    }
  }
}

// ─── B5) REPORT BINDING GUARD ──────────────────────────────────────────────
function validateReportBindings(configs: Record<DependencyKey, DependencyConfig>): void {
  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];

    for (const t of config.report_templates) {
      const content = t.content ?? '';
      if (hasBadPlaceholder(content)) {
        add(dep, 'REPORT_PLACEHOLDER', `report_templates["${t.id}"] contains forbidden placeholder`, '');
      }
      for (const token of TOKENS) {
        if (content.includes(token)) {
          const binding = config.report_bindings?.find((b) => b.token === token);
          if (!binding || !binding.source?.trim()) {
            add(dep, 'REPORT_BINDING', `template contains "${token}" but report_bindings missing or empty source`, '');
          }
        }
      }
    }
  }
}

// ─── B6) ASSETS SCHEMA WHEN ASSET ENUMERATION ROLES ────────────────────────
function validateAssetsSchema(configs: Record<DependencyKey, DependencyConfig>): void {
  const canonical = DEPENDENCY_ROLE_MAP[CANONICAL_DEPENDENCY];
  const upstreamRole = 'upstream_assets_enumerated' as RoleKey;
  const requiredAssetRoles = canonical[upstreamRole] && canonical[upstreamRole].length > 0;

  const requiredFields = ['name', 'location', 'designation', 'type'];

  for (const dep of Object.keys(configs) as DependencyKey[]) {
    const config = configs[dep];
    const mapping = DEPENDENCY_ROLE_MAP[dep];
    const hasUpstream = mapping[upstreamRole] && mapping[upstreamRole].length > 0;
    if (!requiredAssetRoles && !hasUpstream) continue;

    if (hasUpstream || dep === CANONICAL_DEPENDENCY) {
      if (!config.assets_schema) {
        add(dep, 'ASSETS_SCHEMA', 'upstream_assets_enumerated is required; assets_schema missing', '');
        continue;
      }
      if (config.assets_schema.minItemsWhenRequiresService < 1) {
        add(dep, 'ASSETS_SCHEMA', 'assets_schema.minItemsWhenRequiresService must be >= 1', String(config.assets_schema.minItemsWhenRequiresService));
      }
      for (const f of requiredFields) {
        if (!config.assets_schema.requiredFields.includes(f)) {
          add(dep, 'ASSETS_SCHEMA', 'assets_schema.requiredFields missing', f);
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

  validateRoleParity(configs);
  validateImpactCurve(configs);
  validateVulnOrigin(configs);
  validateOfcs(configs);
  validateReportBindings(configs);
  validateAssetsSchema(configs);

  if (errors.length > 0) {
    const byDep = new Map<DependencyKey, ErrorEntry[]>();
    for (const e of errors) {
      const list = byDep.get(e.dep) ?? [];
      list.push(e);
      byDep.set(e.dep, list);
    }
    console.error('\n--- DEPENDENCY PARITY VALIDATION FAILED ---\n');
    for (const dep of Object.keys(DEPENDENCY_ROLE_MAP) as DependencyKey[]) {
      const list = byDep.get(dep);
      if (!list?.length) continue;
      console.error(`[${dep}]`);
      for (const e of list) {
        console.error(`  - ${e.rule}: ${e.message}${e.detail ? ` (${e.detail})` : ''}`);
      }
      console.error('');
    }
    process.exit(1);
  }

  console.log('OK');
}

main();
