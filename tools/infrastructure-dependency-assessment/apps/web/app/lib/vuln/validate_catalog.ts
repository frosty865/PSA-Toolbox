/**
 * Vulnerability Catalog Validator
 *
 * Validates catalog integrity and metadata requirements.
 * Includes question-driven vulnerability map validation (citations, coverage).
 */

import type { TriggerRule, InfraId, VulnerabilityConfig } from '../report/vulnerability/vulnerability_types';
import type { AnalyticalConsideration } from './consideration_types';
import { ALL_VULNERABILITIES } from './catalog_registry';
import { CONSIDERATIONS_ELECTRIC_POWER } from './considerations_energy';
import { COMMUNICATIONS_CONSIDERATIONS } from './considerations_communications';
import { CONSIDERATIONS_IT } from './considerations_it';
import { WATER_CONSIDERATIONS } from './considerations_water';
import { WASTEWATER_CONSIDERATIONS } from './considerations_wastewater';
import { CROSS_DEPENDENCY_CONSIDERATIONS } from './considerations_cross_dependency';

import { ENERGY_QUESTION_IDS } from '../dependencies/infrastructure/energy_spec';
import { COMMS_QUESTION_IDS } from '../dependencies/infrastructure/comms_spec';
import { IT_QUESTION_IDS } from '../dependencies/infrastructure/it_spec';
import { WATER_QUESTION_IDS } from '../dependencies/infrastructure/water_spec';
import { WASTEWATER_QUESTION_IDS } from '../dependencies/infrastructure/wastewater_spec';
import { QUESTION_CONDITION_MAP } from '../report/conditions/question_condition_map';
import { QUESTION_VULN_MAP } from './question_vuln_map';
import { CITATIONS } from './citations_registry';
import { QUESTION_IDS } from './questions_inventory';
import { QUESTION_ID_ALIASES } from './catalog_question_id_aliases';

/**
 * Validator result.
 */
export type CatalogValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Forbidden prescriptive verbs in catalog text (titles, narratives, OFCs, considerations).
 * Exported for unit tests.
 */
export const FORBIDDEN_VERBS = [
  'should',
  'must',
  'recommend',
  'install',
  'upgrade',
  'implement',
  'deploy',
  'configure',
  'establish',
  'ensure',
];

/** Check text for forbidden verbs; returns first match or null. */
export function findForbiddenVerb(text: string): string | null {
  const lower = (text ?? '').toLowerCase();
  for (const verb of FORBIDDEN_VERBS) {
    if (lower.includes(verb)) return verb;
  }
  return null;
}

/**
 * Consideration library by infrastructure.
 */
const CONSIDERATIONS_BY_INFRA: Record<InfraId, Record<string, AnalyticalConsideration> | AnalyticalConsideration[]> = {
  ELECTRIC_POWER: CONSIDERATIONS_ELECTRIC_POWER,
  COMMUNICATIONS: COMMUNICATIONS_CONSIDERATIONS,
  INFORMATION_TECHNOLOGY: CONSIDERATIONS_IT,
  WATER: WATER_CONSIDERATIONS,
  WASTEWATER: WASTEWATER_CONSIDERATIONS,
  NATURAL_GAS: [],
  CROSS_DEPENDENCY: CROSS_DEPENDENCY_CONSIDERATIONS,
};

/** Curve/schema keys used by all infrastructure (from assessment schema). */
const CURVE_QUESTION_IDS = [
  'curve_requires_service',
  'curve_backup_available',
  'curve_time_to_impact_hours',
  'curve_loss_fraction_no_backup',
  'curve_recovery_time_hours',
  'curve_backup_duration_hours',
  'curve_loss_fraction_with_backup',
  'curve_primary_provider',
] as const;

/** Question IDs from question_condition_map per sector. */
function questionIdsForSector(sector: string): Set<string> {
  const ids = new Set(
    QUESTION_CONDITION_MAP.filter((e) => e.sector === sector).map((e) => e.questionId)
  );
  return ids;
}

/**
 * Question IDs by infrastructure.
 * Includes: spec QUESTION_IDS + curve keys + question_condition_map IDs + catalog-specific.
 */
const QUESTION_IDS_BY_INFRA: Record<InfraId, Set<string>> = {
  ELECTRIC_POWER: new Set([
    ...ENERGY_QUESTION_IDS,
    'E-7a',
    'E-11',
    ...CURVE_QUESTION_IDS,
    ...questionIdsForSector('ELECTRIC_POWER'),
  ]),
  COMMUNICATIONS: new Set([
    ...COMMS_QUESTION_IDS,
    'CO-7a',
    ...CURVE_QUESTION_IDS,
    ...questionIdsForSector('COMMUNICATIONS'),
  ]),
  INFORMATION_TECHNOLOGY: new Set([
    ...IT_QUESTION_IDS,
    'IT-7a',
    ...CURVE_QUESTION_IDS,
    ...questionIdsForSector('INFORMATION_TECHNOLOGY'),
  ]),
  WATER: new Set([
    ...WATER_QUESTION_IDS,
    ...CURVE_QUESTION_IDS,
    ...questionIdsForSector('WATER'),
  ]),
  WASTEWATER: new Set([
    ...WASTEWATER_QUESTION_IDS,
    ...CURVE_QUESTION_IDS,
    ...questionIdsForSector('WASTEWATER'),
  ]),
  NATURAL_GAS: new Set(),
  CROSS_DEPENDENCY: new Set([
    ...ENERGY_QUESTION_IDS,
    'E-7a',
    'E-11',
    ...COMMS_QUESTION_IDS,
    'CO-7a',
    ...IT_QUESTION_IDS,
    'IT-7a',
    ...WATER_QUESTION_IDS,
    ...WASTEWATER_QUESTION_IDS,
    ...CURVE_QUESTION_IDS,
    ...questionIdsForSector('ELECTRIC_POWER'),
    ...questionIdsForSector('COMMUNICATIONS'),
    ...questionIdsForSector('INFORMATION_TECHNOLOGY'),
    ...questionIdsForSector('WATER'),
    ...questionIdsForSector('WASTEWATER'),
  ]),
};

const TRANSPORT_TYPE_BY_INFRA: Partial<Record<InfraId, 'VOICE_TRANSPORT' | 'DATA_TRANSPORT'>> = {
  COMMUNICATIONS: 'VOICE_TRANSPORT',
  INFORMATION_TECHNOLOGY: 'DATA_TRANSPORT',
};

/**
 * Collect all question IDs referenced in a trigger rule.
 * Exported for use by vuln evaluator (matched_answers).
 */
export function collectQuestionIds(rule: TriggerRule): string[] {
  switch (rule.type) {
    case 'CLAUSE':
      return [rule.clause.question_id];
    case 'AND':
      return rule.rules.flatMap(collectQuestionIds);
    case 'OR':
      return rule.rules.flatMap(collectQuestionIds);
    case 'NOT':
      return collectQuestionIds(rule.rule);
    default:
      return [];
  }
}

/**
 * Validate vulnerability catalog integrity.
 */
export function validateCatalog(): CatalogValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1) Unique vulnerability IDs
  const seenIds = new Set<string>();
  for (const vuln of ALL_VULNERABILITIES) {
    const expectedTransport = TRANSPORT_TYPE_BY_INFRA[vuln.infra_id];
    if (expectedTransport && vuln.transport_type !== expectedTransport) {
      errors.push(
        `Invalid transport_type for ${vuln.id}: ${vuln.transport_type ?? 'missing'} (expected ${expectedTransport})`
      );
    }
    if (seenIds.has(vuln.id)) {
      errors.push(`Duplicate vulnerability ID: ${vuln.id}`);
    }
    seenIds.add(vuln.id);
  }

  // 2) Validate each vulnerability
  for (const vuln of ALL_VULNERABILITIES) {
    // driverCategory required
    if (!vuln.driverCategory) {
      errors.push(`Missing driverCategory for ${vuln.id}`);
    }

    // Forbidden verbs in vulnerability title and description
    for (const [field, text] of [
      ['short_name', vuln.short_name ?? ''],
      ['description', vuln.description ?? ''],
    ] as const) {
      const verb = findForbiddenVerb(text);
      if (verb) errors.push(`Forbidden verb "${verb}" in vulnerability ${vuln.id} (${field})`);
    }

    // impactWeight validation
    if (vuln.impactWeight === undefined) {
      warnings.push(`Missing impactWeight for ${vuln.id}; defaulting to 1 at runtime.`);
    } else if (![1, 2, 3].includes(vuln.impactWeight)) {
      errors.push(`Invalid impactWeight for ${vuln.id}: ${vuln.impactWeight}`);
    }

    // consideration IDs length
    if (vuln.consideration_ids.length < 1 || vuln.consideration_ids.length > 4) {
      errors.push(`Considerations count out of range (1-4) for ${vuln.id}`);
    }

    // consideration IDs exist
    const considerationLibrary = CONSIDERATIONS_BY_INFRA[vuln.infra_id];
    const considerationLookup = Array.isArray(considerationLibrary) 
      ? Object.fromEntries(considerationLibrary.map(c => [c.id, c]))
      : considerationLibrary;
    
    for (const considerationId of vuln.consideration_ids) {
      const consideration = considerationLookup[considerationId];
      if (!consideration) {
        errors.push(`Unknown consideration ID ${considerationId} for ${vuln.id}`);
      } else {
        const texts = [
          consideration.heading ?? '',
          consideration.title ?? '',
          consideration.narrative ?? '',
          ...(consideration.paragraphs?.map((p) => p.text) ?? []),
        ].filter(Boolean);
        for (const text of texts) {
          const verb = findForbiddenVerb(text);
          if (verb) {
            errors.push(`Forbidden verb "${verb}" in consideration ${considerationId}`);
            break;
          }
        }
      }
    }

    // trigger question IDs exist (resolve aliases before validation)
    const questionIds = collectQuestionIds(vuln.trigger);
    const validQuestionIds = QUESTION_IDS_BY_INFRA[vuln.infra_id];
    for (const questionId of questionIds) {
      const canonical = QUESTION_ID_ALIASES[questionId] ?? questionId;
      if (!validQuestionIds.has(canonical)) {
        errors.push(`Unknown question ID ${questionId} in trigger for ${vuln.id}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate question-driven vulnerability map (QUESTION_VULN_MAP + CITATIONS).
 * Every vuln must have >= 1 citation, >= 3 OFCs; every citation id must exist.
 * Throws on first violation to prevent 0% cited vulnerabilities from shipping.
 */
export function validateQuestionVulnMap(): CatalogValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const missing = QUESTION_IDS.filter(
    (q) => !QUESTION_VULN_MAP[q] || !Array.isArray(QUESTION_VULN_MAP[q]) || QUESTION_VULN_MAP[q].length === 0
  );
  if (missing.length > 0) {
    throw new Error(
      `[VULN QC] Missing vulnerability mappings for ${missing.length} questions: ${missing.slice(0, 30).join(', ')}${missing.length > 30 ? ' ...' : ''}`
    );
  }

  for (const [qid, vulns] of Object.entries(QUESTION_VULN_MAP)) {
    if (!Array.isArray(vulns) || vulns.length === 0) {
      throw new Error(`[VULN QC] Question ${qid} has no vulnerability templates`);
    }
    for (const v of vulns) {
      if (!v.citations || v.citations.length === 0) {
        throw new Error(`[VULN QC] Missing citations for vuln ${v.id} (question ${qid})`);
      }
      if (!Array.isArray(v.ofcs) || v.ofcs.length < 3) {
        throw new Error(
          `[VULN QC] OFC coverage below minimum for vuln ${v.id} (question ${qid}): ${v.ofcs?.length ?? 0} < 3`
        );
      }
      for (const cid of v.citations) {
        const c = CITATIONS[cid];
        if (!c) {
          throw new Error(`[VULN QC] Vuln ${v.id} references missing citation ${cid}`);
        }
      }
      // Forbidden verbs in VulnTemplate title, summary, and each OFC
      for (const [field, text] of [
        ['title', v.title ?? ''],
        ['summary', v.summary ?? ''],
      ] as const) {
        const verb = findForbiddenVerb(text);
        if (verb) errors.push(`Forbidden verb "${verb}" in VulnTemplate ${v.id} (${field})`);
      }
      for (const ofc of v.ofcs ?? []) {
        for (const [field, text] of [
          ['title', ofc.title ?? ''],
          ['text', ofc.text ?? ''],
        ] as const) {
          const verb = findForbiddenVerb(text);
          if (verb) errors.push(`Forbidden verb "${verb}" in OFC ${ofc.id} (${field})`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
