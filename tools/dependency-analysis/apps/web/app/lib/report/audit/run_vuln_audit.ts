#!/usr/bin/env node
/**
 * Report Representation Coverage Audit
 * Produces a gap report: weak conditions, fired vulns, unmapped triggers, unmapped keys,
 * normalized field coverage, payload shape, and vulnerability representation.
 * Run: pnpm audit:vuln [path/to/assessment.json]
 * Run with DOCX check: pnpm audit:vuln -- --render-docx [path]
 * Without path: uses fixture apps/web/app/lib/report/audit/fixtures/assessment_full.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseAssessment } from 'schema';
import type { Assessment } from 'schema';
import { normalizeDependencyConditions } from '../normalize_conditions';
import { evaluateVulnerabilitiesFromConditions } from '../vulnerability/evaluate_from_conditions';
import { MAP_BY_SECTOR } from '../conditions/question_condition_map';
import type { SectorKey } from '../conditions/question_condition_map';
import type { SectorConditions } from '../normalize_conditions';
import {
  REQUIRED_NORMALIZED_FIELDS_BY_SECTOR,
  REQUIRED_REPORT_PAYLOAD_FIELDS_BY_SECTOR,
  type SuppressionResult,
  SUPPRESSION_RULES,
} from './representation_contract';
import { buildReportVM } from '../view_model';
import { isCanonicalSector } from '../vulnerability/canonical_sectors';
import { ALL_TRIGGER_CONDITIONS_BY_SECTOR } from '../vulnerability/condition_trigger_map';

const SECTORS: SectorKey[] = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
];

const ANNEX_FULL_VOFC = process.env.ANNEX_FULL_VOFC !== 'false';

type WeakCondition = { key: string; value: string; sourceKeys: string[] };
type VulnTriggered = { id: string; title: string; triggerConditionKey: string; bucket: string };
type UnmappedTrigger = { key: string; value: string };
type SectorReport = {
  weak_conditions: WeakCondition[];
  vulnerabilities_triggered: VulnTriggered[];
  unmapped_trigger_conditions: UnmappedTrigger[];
  unmapped_captured_keys: string[];
  normalized_missing: string[];
  normalized_suppressed: SuppressionResult[];
  payload_missing_fields: string[];
  payload_empty_fields: string[];
  vuln_unrepresented_exec: string[];
  vuln_unrepresented_main: string[];
  vuln_unrepresented_annex: string[];
  excluded_by_cap: Array<{ id: string; reasonCode: string }>;
};

type AuditReport = {
  generated_at: string;
  input_path: string;
  sectors: Record<string, SectorReport>;
  summary: {
    total_weak_conditions: number;
    total_vulns_triggered: number;
    total_unmapped_trigger_conditions: number;
    total_unmapped_captured_keys: number;
    total_normalized_missing: number;
    total_payload_missing: number;
    total_payload_empty: number;
    total_vuln_unrepresented_annex: number;
  };
};

function getSourceKeys(sector: SectorKey, conditionKey: string): string[] {
  return MAP_BY_SECTOR[sector]
    .filter((e) => e.mapsTo === conditionKey)
    .map((e) => e.questionId);
}

function deriveWeakConditions(c: SectorConditions, sector: SectorKey): WeakCondition[] {
  const weak: WeakCondition[] = [];
  if (!c.requires_service) return weak;

  if (c.provider_confirmed !== 'CONFIRMED') {
    weak.push({
      key: 'provider_confirmed',
      value: c.provider_confirmed,
      sourceKeys: getSourceKeys(sector, 'provider_confirmed'),
    });
  }
  if (c.single_provider_or_path === 'YES') {
    weak.push({
      key: 'single_provider_or_path',
      value: 'YES',
      sourceKeys: getSourceKeys(sector, 'single_provider_or_path'),
    });
  }
  if (c.entry_diversity === 'SINGLE') {
    weak.push({
      key: 'entry_diversity',
      value: 'SINGLE',
      sourceKeys: getSourceKeys(sector, 'entry_diversity'),
    });
  }
  if (c.corridor_colocated === 'YES') {
    weak.push({
      key: 'corridor_colocated',
      value: 'YES',
      sourceKeys: getSourceKeys(sector, 'corridor_colocated'),
    });
  }
  if (c.alternate_present === false) {
    weak.push({
      key: 'alternate_present',
      value: 'NO',
      sourceKeys: getSourceKeys(sector, 'alternate_present'),
    });
  } else if (c.alternate_present === true) {
    if (c.alternate_duration_class === 'SHORT') {
      weak.push({
        key: 'alternate_duration_class',
        value: 'SHORT',
        sourceKeys: getSourceKeys(sector, 'alternate_duration_hours'),
      });
    }
    if (c.alternate_materially_reduces_loss === 'NO') {
      weak.push({
        key: 'alternate_materially_reduces_loss',
        value: 'NO',
        sourceKeys: getSourceKeys(sector, 'alternate_materially_reduces_loss'),
      });
    }
  }
  if (c.restoration_priority_established !== 'YES') {
    weak.push({
      key: 'restoration_priority_established',
      value: c.restoration_priority_established,
      sourceKeys: getSourceKeys(sector, 'restoration_priority_established'),
    });
  }
  if (c.recovery_duration_class === 'LONG') {
    weak.push({
      key: 'recovery_duration_class',
      value: 'LONG',
      sourceKeys: getSourceKeys(sector, 'recovery_hours'),
    });
  }
  if (sector === 'COMMUNICATIONS') {
    if (c.pace_depth === 'NONE') {
      weak.push({
        key: 'pace_depth',
        value: 'NONE',
        sourceKeys: getSourceKeys(sector, 'pace_depth'),
      });
    } else if (c.pace_depth === 'P') {
      weak.push({
        key: 'pace_depth',
        value: 'P',
        sourceKeys: getSourceKeys(sector, 'pace_depth'),
      });
    }
    if (c.pace_missing_layers.includes('ALTERNATE')) {
      weak.push({
        key: 'pace_missing_layers',
        value: 'ALTERNATE',
        sourceKeys: getSourceKeys(sector, 'pace_layers_present'),
      });
    }
    if (c.pace_missing_layers.includes('CONTINGENCY')) {
      weak.push({
        key: 'pace_missing_layers',
        value: 'CONTINGENCY',
        sourceKeys: getSourceKeys(sector, 'pace_layers_present'),
      });
    }
    if (c.pace_missing_layers.includes('EMERGENCY')) {
      weak.push({
        key: 'pace_missing_layers',
        value: 'EMERGENCY',
        sourceKeys: getSourceKeys(sector, 'pace_layers_present'),
      });
    }
  }
  return weak;
}

function conditionToTriggerKey(weak: WeakCondition): string {
  if (weak.key === 'provider_confirmed') return 'provider_confirmed != CONFIRMED';
  if (weak.key === 'single_provider_or_path') return 'single_provider_or_path == YES';
  if (weak.key === 'entry_diversity') return 'entry_diversity == SINGLE';
  if (weak.key === 'corridor_colocated') return 'corridor_colocated == YES';
  if (weak.key === 'alternate_present') return 'alternate_present == NO';
  if (weak.key === 'alternate_duration_class') return 'alternate_duration_class == SHORT';
  if (weak.key === 'alternate_materially_reduces_loss') return 'alternate_materially_reduces_loss == NO';
  if (weak.key === 'restoration_priority_established') return 'restoration_priority_established != YES';
  if (weak.key === 'recovery_duration_class') return 'recovery_duration_class == LONG';
  if (weak.key === 'pace_depth') return weak.value === 'NONE' ? 'pace_depth == NONE' : 'pace_depth == P';
  if (weak.key === 'pace_missing_layers')
    return `pace_missing_layers contains ${weak.value}`;
  return `${weak.key} == ${weak.value}`;
}

function hasSourceValue(data: Record<string, unknown>, sourceKeys: string[]): boolean {
  for (const k of sourceKeys) {
    const v = data[k];
    if (v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '')) return true;
  }
  return false;
}

function getVal(c: SectorConditions, key: string): unknown {
  const k = key as keyof SectorConditions;
  return (c as Record<string, unknown>)[k];
}

function getNormalizedMissingAndSuppressed(
  c: SectorConditions,
  sector: SectorKey,
  categoryData: Record<string, unknown>
): { missing: string[]; suppressed: SuppressionResult[] } {
  const missing: string[] = [];
  const suppressed: SuppressionResult[] = [];
  const required = REQUIRED_NORMALIZED_FIELDS_BY_SECTOR[sector] ?? [];

  if (!c.requires_service) {
    for (const key of required) {
      if (key === 'requires_service') continue;
      suppressed.push({ key, reasonCode: SUPPRESSION_RULES.requiresServiceFalse() });
    }
    return { missing, suppressed };
  }

  for (const key of required) {
    if (key === 'requires_service') continue;
    if (key === 'alternate_duration_hours' && !c.alternate_present) {
      suppressed.push({ key, reasonCode: SUPPRESSION_RULES.gatedByAlternateAbsent() });
      continue;
    }
    if (key === 'pace_depth' || key === 'pace_layers_present') {
      if (sector !== 'COMMUNICATIONS') continue;
    }
    let val: unknown = getVal(c, key);
    if (key === 'pace_layers_present') {
      const pace = (c as SectorConditions & { pace?: { layers_present?: unknown } }).pace;
      val = pace?.layers_present;
    }
    const sourceKeys = MAP_BY_SECTOR[sector].filter((e) => e.mapsTo === key).map((e) => e.questionId);
    const hasSource = hasSourceValue(categoryData, sourceKeys);

    if (key === 'recovery_hours') {
      if (val == null && !hasSource) missing.push(key);
      else if (val == null && hasSource) suppressed.push({ key, reasonCode: SUPPRESSION_RULES.answeredUnknown() });
      continue;
    }
    if (val === undefined || val === null) {
      if (hasSource) suppressed.push({ key, reasonCode: SUPPRESSION_RULES.answeredUnknown() });
      else missing.push(key);
    } else if (val === 'UNKNOWN') {
      suppressed.push({ key, reasonCode: SUPPRESSION_RULES.answeredUnknown() });
    }
  }
  return { missing, suppressed };
}

function isEmptyOrUnknown(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (v === 'unknown' || v === 'UNKNOWN') return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

export function loadAssessment(inputPath: string): Assessment {
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const data = raw.assessment ?? raw;
  if (!data.meta) {
    data.meta = { tool_version: '0.1.0', template_version: '1', created_at_iso: new Date().toISOString() };
  }
  if (!data.asset) {
    data.asset = { asset_name: 'Audit Fixture', visit_date_iso: new Date().toISOString().slice(0, 10) };
  }
  if (data.dependencies && !data.categories) {
    data.categories = data.dependencies;
  }
  return parseAssessment(data);
}

export function runAudit(assessment: Assessment, inputPath: string): AuditReport {
  const { normalized, accounting } = normalizeDependencyConditions(assessment);
  const { vulnerabilities, triggeredConditions } = evaluateVulnerabilitiesFromConditions(normalized);

  const vulnsBySector = new Map<string, typeof vulnerabilities>();
  for (const v of vulnerabilities) {
    const s = v.sector ?? v.config.infra_id ?? 'UNKNOWN';
    if (!vulnsBySector.has(s)) vulnsBySector.set(s, []);
    vulnsBySector.get(s)!.push(v);
  }

  const triggeredByKey = new Set(triggeredConditions.map((t) => `${t.sector}:${t.condition}`));

  let reportVM: ReturnType<typeof buildReportVM> | null = null;
  const allowUnmapped = process.env.REPORT_ALLOW_UNMAPPED_KEYS === 'true';
  const prevAllow = process.env.REPORT_ALLOW_UNMAPPED_KEYS;
  try {
    if (!allowUnmapped) process.env.REPORT_ALLOW_UNMAPPED_KEYS = 'true';
    reportVM = buildReportVM(assessment);
  } catch (e) {
    reportVM = null;
  } finally {
    process.env.REPORT_ALLOW_UNMAPPED_KEYS = prevAllow;
  }

  const payloadVulnIds = new Set<string>();
  const execDriverTitles = new Set<string>();
  if (reportVM) {
    for (const infra of reportVM.infrastructures) {
      for (const v of infra.vulnerabilities ?? []) {
        payloadVulnIds.add(v.id);
      }
      const triggered = (infra as { _triggered_vulnerabilities?: Array<{ config: { id: string; short_name?: string } }> })._triggered_vulnerabilities;
      for (const v of triggered ?? []) {
        payloadVulnIds.add(v.config?.id ?? '');
      }
    }
    for (const d of reportVM.executive?.key_risk_drivers ?? []) {
      execDriverTitles.add((d as { title?: string }).title ?? '');
    }
  }

  const sectors: Record<string, SectorReport> = {};
  let totalWeak = 0;
  let totalVulns = 0;
  let totalUnmappedTriggers = 0;
  let totalUnmappedKeys = 0;
  let totalNormalizedMissing = 0;
  let totalPayloadMissing = 0;
  let totalPayloadEmpty = 0;
  let totalVulnUnrepresentedAnnex = 0;

  for (const sector of SECTORS) {
    const c = normalized[sector] as SectorConditions | undefined;
    const cat = assessment.categories?.[sector] as Record<string, unknown> | undefined;
    const categoryData: Record<string, unknown> = cat
      ? { ...cat, ...(cat?.answers as Record<string, unknown>) }
      : {};

    const weak_conditions = c ? deriveWeakConditions(c, sector) : [];
    const sectorVulns = vulnsBySector.get(sector) ?? [];
    const vulnTriggerKeys = new Set(sectorVulns.map((v) => v.triggerCondition).filter(Boolean));

    const unmapped_trigger_conditions: UnmappedTrigger[] = [];
    for (const w of weak_conditions) {
      const triggerKey = conditionToTriggerKey(w);
      let hasMatch = vulnTriggerKeys.has(triggerKey) || triggeredByKey.has(`${sector}:${triggerKey}`);
      if (!hasMatch && isCanonicalSector(sector)) {
        // Canonical sectors: treat as mapped if any vuln definition exists for this trigger
        const registry = ALL_TRIGGER_CONDITIONS_BY_SECTOR[sector];
        if (registry) {
          const matches = (a: string, b: string) =>
            a === b || a.includes(b) || b.includes(a);
          hasMatch = [...registry].some((r) => matches(r, triggerKey));
        }
      }
      if (!hasMatch) {
        unmapped_trigger_conditions.push({ key: w.key, value: w.value });
      }
    }

    const unmapped_captured_keys = accounting.unmappedKeys
      .filter((k) => k.startsWith(`${sector}:`))
      .map((k) => k.slice(sector.length + 1));

    const { missing: normalized_missing, suppressed: normalized_suppressed } = c
      ? getNormalizedMissingAndSuppressed(c, sector, categoryData)
      : { missing: [] as string[], suppressed: [] as SuppressionResult[] };

    const requiredPayloadFields = REQUIRED_REPORT_PAYLOAD_FIELDS_BY_SECTOR[sector] ?? [];
    const payload_missing_fields: string[] = [];
    const payload_empty_fields: string[] = [];
    if (reportVM) {
      const infra = reportVM.infrastructures.find((i) => i.code === sector);
      for (const field of requiredPayloadFields) {
        const val = infra ? (infra as Record<string, unknown>)[field] : undefined;
        if (val === undefined) payload_missing_fields.push(field);
        else if (field === 'vulnerabilities' && Array.isArray(val) && val.length === 0 && sectorVulns.length > 0) {
          payload_empty_fields.push(field);
        } else if (field === 'intro' && val && typeof val === 'object' && isEmptyOrUnknown((val as { purpose?: string }).purpose)) {
          payload_empty_fields.push(field);
        }
      }
    }

    const vuln_unrepresented_exec: string[] = [];
    const vuln_unrepresented_main: string[] = [];
    const vuln_unrepresented_annex: string[] = [];
    const excluded_by_cap: Array<{ id: string; reasonCode: string }> = [];

    for (const v of sectorVulns) {
      const id = v.config.id;
      const inPayload = payloadVulnIds.has(id);
      const inExec = execDriverTitles.has(v.config.short_name);
      if (!inPayload) vuln_unrepresented_main.push(id);
      if (ANNEX_FULL_VOFC && !inPayload) vuln_unrepresented_annex.push(id);
      if (!inExec && sectorVulns.length > 6) {
        excluded_by_cap.push({ id, reasonCode: SUPPRESSION_RULES.excludedByCap() });
      }
    }

    sectors[sector] = {
      weak_conditions,
      vulnerabilities_triggered: sectorVulns.map((v) => ({
        id: v.config.id,
        title: v.config.short_name,
        triggerConditionKey: v.triggerCondition ?? '',
        bucket: v.bucket ?? '',
      })),
      unmapped_trigger_conditions,
      unmapped_captured_keys,
      normalized_missing,
      normalized_suppressed,
      payload_missing_fields,
      payload_empty_fields,
      vuln_unrepresented_exec,
      vuln_unrepresented_main,
      vuln_unrepresented_annex,
      excluded_by_cap,
    };

    totalWeak += weak_conditions.length;
    totalVulns += sectorVulns.length;
    totalUnmappedTriggers += unmapped_trigger_conditions.length;
    totalUnmappedKeys += unmapped_captured_keys.length;
    totalNormalizedMissing += normalized_missing.length;
    totalPayloadMissing += payload_missing_fields.length;
    totalPayloadEmpty += payload_empty_fields.length;
    totalVulnUnrepresentedAnnex += vuln_unrepresented_annex.length;
  }

  return {
    generated_at: new Date().toISOString(),
    input_path: inputPath,
    sectors,
    summary: {
      total_weak_conditions: totalWeak,
      total_vulns_triggered: totalVulns,
      total_unmapped_trigger_conditions: totalUnmappedTriggers,
      total_unmapped_captured_keys: totalUnmappedKeys,
      total_normalized_missing: totalNormalizedMissing,
      total_payload_missing: totalPayloadMissing,
      total_payload_empty: totalPayloadEmpty,
      total_vuln_unrepresented_annex: totalVulnUnrepresentedAnnex,
    },
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const renderDocx = args[0] === '--render-docx';
  const pathArg = renderDocx ? args[1] : args[0];
  const defaultPath = path.join(__dirname, 'fixtures', 'assessment_full.json');
  const inputPath = pathArg ?? defaultPath;

  if (!fs.existsSync(inputPath)) {
    console.error(`Assessment file not found: ${inputPath}`);
    process.exit(1);
  }

  if (renderDocx) {
    console.error('--render-docx: DOCX anchor coverage check not yet implemented from TS CLI.');
    console.error('Use the export route to generate DOCX, then validate anchors manually or via Python script.');
  }

  const assessment = loadAssessment(inputPath);
  const report = runAudit(assessment, inputPath);

  const json = JSON.stringify(report, null, 2);
  console.log(json);

  const outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(outDir, `vuln_audit_${timestamp}.json`);
  fs.writeFileSync(outPath, json, 'utf-8');
  console.error(`\nReport written to: ${outPath}`);
}

main();
