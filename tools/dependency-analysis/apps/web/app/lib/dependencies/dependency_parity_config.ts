/**
 * Config shape for dependency parity validation.
 * Theme-based: 2–3 findings per dependency. Trigger maps define theme -> evidence question IDs.
 */
import type { DependencyKey } from './dependency_role_map';
import { ENERGY_CURVE_QUESTIONS, ENERGY_QUESTIONS, type EnergyQuestionDef } from './infrastructure/energy_spec';
import { getEnergyOfcList, ENERGY_VULNERABILITY_TEXTS } from './derive_energy_findings';
import { COMMS_CURVE_QUESTIONS, COMMS_QUESTIONS, type CommsQuestionDef } from './infrastructure/comms_spec';
import { getCommsOfcList, COMMS_VULNERABILITY_TEXTS } from './derive_comms_findings';
import { IT_CURVE_QUESTIONS, IT_QUESTIONS, type ItQuestionDef } from './infrastructure/it_spec';
import { getItOfcList, IT_VULNERABILITY_TEXTS } from './derive_it_findings';
import { WATER_CURVE_QUESTIONS, WATER_QUESTIONS, type WaterQuestionDef } from './infrastructure/water_spec';
import { getWaterOfcList, WATER_VULNERABILITY_TEXTS } from './derive_water_findings';
import { WASTEWATER_CURVE_QUESTIONS, WASTEWATER_QUESTIONS, type WastewaterQuestionDef } from './infrastructure/wastewater_spec';
import { getWastewaterOfcList, WASTEWATER_VULNERABILITY_TEXTS } from './derive_wastewater_findings';

/** Theme ID -> contributing question IDs (evidence). */
const ENERGY_THEME_TRIGGERS: Record<string, string[]> = {
  ENERGY_FEED_DIVERSITY: ['E-3', 'E-4', 'E-5'],
  ENERGY_BACKUP_ABSENT: ['E-8'],
  ENERGY_BACKUP_SUSTAIN_TEST: ['E-9', 'E-10'],
};
const COMMS_THEME_TRIGGERS: Record<string, string[]> = {
  COMMS_DIVERSITY: ['COMM-SP1'],
  COMMS_ALTERNATE_CAPABILITY: ['curve_backup_available'],
  COMMS_RESTORATION_REALISM: ['COMM-SP3'],
};
const IT_THEME_TRIGGERS: Record<string, string[]> = {
  IT_PROVIDER_CONCENTRATION: ['IT-1', 'IT-3'],
  IT_TRANSPORT_INDEPENDENCE_UNKNOWN: ['IT-3', 'IT-4'],
  IT_TRANSPORT_DIVERSITY_RECORDED: ['IT-3', 'IT-4'],
  IT_MULTIPLE_CONNECTIONS_INDEPENDENCE_UNKNOWN: ['IT-3', 'IT-4'],
  IT_FALLBACK_AVAILABILITY: ['curve_backup_available', 'IT-5'],
  IT_TRANSPORT_SINGLE_PATH: ['IT-3', 'IT-4'],
  IT_HOSTED_VENDOR_NO_CONTINUITY: ['IT-2', 'IT-5'],
  IT_HOSTED_VENDOR_CONTINUITY_UNKNOWN: ['IT-2', 'IT-5'],
  IT_CONTINUITY_NOT_DEMONSTRATED: ['it_plan_exercised'],
};
const WATER_THEME_TRIGGERS: Record<string, string[]> = {
  W_NO_PRIORITY_RESTORATION: ['W_Q6'],
  W_NO_ALTERNATE_SOURCE: ['W_Q8'],
  W_ALTERNATE_INSUFFICIENT: ['W_Q9'],
};
const WASTEWATER_THEME_TRIGGERS: Record<string, string[]> = {
  WW_NO_PRIORITY_RESTORATION: ['WW_Q6'],
};

export type QuestionConfig = {
  id: string;
  type: string;
  prompt: string;
  required?: boolean;
  triggers?: { vulnerability_id: string }[];
  /** For impact curve: min value (e.g. 0 for hours). */
  min?: number;
  /** For impact curve: max value (e.g. 72 for time_to_impact_hours). */
  max?: number;
};

export type VulnerabilityConfig = {
  id: string;
  text: string;
  trigger_question_ids: string[];
  ofc_ids?: string[];
};

export type OfcConfig = {
  id: string;
  text: string;
  vulnerability_id: string;
};

export type ReportBindingConfig = {
  token: string;
  source: string; // e.g. "summary.time_to_impact_hours"
};

export type AssetsSchemaConfig = {
  minItemsWhenRequiresService: number;
  requiredFields: string[];
};

export type DependencyConfig = {
  questions: QuestionConfig[];
  vulnerabilities: VulnerabilityConfig[];
  ofcs: OfcConfig[];
  /** Report template content to scan for placeholders; can be empty array if no templates. */
  report_templates: { id: string; content: string }[];
  /** Required when report_templates contain {{token}}; maps token to binding source. */
  report_bindings?: ReportBindingConfig[];
  /** Required when dependency has upstream assets / redundancy / provider count questions. */
  assets_schema?: AssetsSchemaConfig;
};

const CURVE_MIN_MAX: Record<string, { min: number; max: number }> = {
  curve_time_to_impact: { min: 0, max: 72 },
  curve_time_to_impact_hours: { min: 0, max: 72 },
  curve_loss_no_backup: { min: 0, max: 100 },
  curve_loss_fraction_no_backup: { min: 0, max: 100 },
  curve_recovery_time: { min: 0, max: 168 },
  curve_recovery_time_hours: { min: 0, max: 168 },
  curve_backup_duration: { min: 0, max: 96 },
  curve_backup_duration_hours: { min: 0, max: 96 },
};

function getTriggersForQuestion(themeMap: Record<string, string[]>, qid: string): { vulnerability_id: string }[] {
  const triggers: { vulnerability_id: string }[] = [];
  for (const [themeId, qids] of Object.entries(themeMap)) {
    if (qids.includes(qid)) triggers.push({ vulnerability_id: themeId });
  }
  return triggers;
}

function energyQuestionToConfig(q: EnergyQuestionDef): QuestionConfig {
  const triggers = getTriggersForQuestion(ENERGY_THEME_TRIGGERS, q.id as string);
  const minMax = CURVE_MIN_MAX[q.id as string];
  return {
    id: q.id,
    type: q.answerType,
    prompt: q.prompt,
    required: (q.yesRequires?.length ?? 0) > 0,
    triggers: triggers.length ? triggers : undefined,
    min: minMax?.min,
    max: minMax?.max,
  };
}

function commsQuestionToConfig(q: CommsQuestionDef): QuestionConfig {
  const triggers = getTriggersForQuestion(COMMS_THEME_TRIGGERS, q.id as string);
  const minMax = CURVE_MIN_MAX[q.id as string];
  return {
    id: q.id,
    type: q.answerType,
    prompt: q.prompt,
    required: (q.yesRequires?.length ?? 0) > 0,
    triggers: triggers.length ? triggers : undefined,
    min: minMax?.min,
    max: minMax?.max,
  };
}

function itQuestionToConfig(q: ItQuestionDef): QuestionConfig {
  const triggers = getTriggersForQuestion(IT_THEME_TRIGGERS, q.id as string);
  const minMax = CURVE_MIN_MAX[q.id as string];
  return {
    id: q.id,
    type: q.answerType,
    prompt: q.prompt,
    required: (q.yesRequires?.length ?? 0) > 0,
    triggers: triggers.length ? triggers : undefined,
    min: minMax?.min,
    max: minMax?.max,
  };
}

function waterQuestionToConfig(q: WaterQuestionDef): QuestionConfig {
  const triggers = getTriggersForQuestion(WATER_THEME_TRIGGERS, q.id as string);
  const minMax = CURVE_MIN_MAX[q.id as string];
  return {
    id: q.id,
    type: q.answerType,
    prompt: q.prompt,
    required: (q.yesRequires?.length ?? 0) > 0,
    triggers: triggers.length ? triggers : undefined,
    min: minMax?.min,
    max: minMax?.max,
  };
}

function wastewaterQuestionToConfig(q: WastewaterQuestionDef): QuestionConfig {
  const triggers = getTriggersForQuestion(WASTEWATER_THEME_TRIGGERS, q.id as string);
  const minMax = CURVE_MIN_MAX[q.id as string];
  return {
    id: q.id,
    type: q.answerType,
    prompt: q.prompt,
    required: (q.yesRequires?.length ?? 0) > 0,
    triggers: triggers.length ? triggers : undefined,
    min: minMax?.min,
    max: minMax?.max,
  };
}

/** Theme ID -> question IDs that can contribute evidence. */
function getEnergyVulnTriggerQuestionIds(): Record<string, string[]> {
  return ENERGY_THEME_TRIGGERS;
}
function getCommsVulnTriggerQuestionIds(): Record<string, string[]> {
  return COMMS_THEME_TRIGGERS;
}
function getItVulnTriggerQuestionIds(): Record<string, string[]> {
  return IT_THEME_TRIGGERS;
}
function getWaterVulnTriggerQuestionIds(): Record<string, string[]> {
  return WATER_THEME_TRIGGERS;
}
function getWastewaterVulnTriggerQuestionIds(): Record<string, string[]> {
  return WASTEWATER_THEME_TRIGGERS;
}

export function buildEnergyConfig(): DependencyConfig {
  const allQuestions = [...ENERGY_CURVE_QUESTIONS, ...ENERGY_QUESTIONS];
  const triggerByVuln = getEnergyVulnTriggerQuestionIds();
  const ofcList = getEnergyOfcList();
  const vulnerabilities: VulnerabilityConfig[] = Object.keys(ENERGY_VULNERABILITY_TEXTS).map((id) => ({
    id,
    text: ENERGY_VULNERABILITY_TEXTS[id] ?? '',
    trigger_question_ids: triggerByVuln[id] ?? [],
    ofc_ids: ofcList.filter((o) => o.vulnerability_id === id).map((o) => o.id),
  }));

  return {
    questions: allQuestions.map(energyQuestionToConfig),
    vulnerabilities,
    ofcs: ofcList,
    report_templates: [],
    report_bindings: [
      { token: '{{impact_onset_hours}}', source: 'summary.time_to_impact_hours' },
      { token: '{{functional_loss_percent}}', source: 'summary.functional_loss_percent' },
      { token: '{{recovery_time_hours}}', source: 'summary.recovery_time_hours' },
    ],
    assets_schema: {
      minItemsWhenRequiresService: 1,
      requiredFields: ['name', 'location', 'designation', 'type'],
    },
  };
}

export function buildCommunicationsConfig(): DependencyConfig {
  const allQuestions = [...COMMS_CURVE_QUESTIONS, ...COMMS_QUESTIONS];
  const triggerByVuln = getCommsVulnTriggerQuestionIds();
  const ofcList = getCommsOfcList();
  const vulnerabilities: VulnerabilityConfig[] = Object.keys(COMMS_VULNERABILITY_TEXTS).map((id) => ({
    id,
    text: COMMS_VULNERABILITY_TEXTS[id] ?? '',
    trigger_question_ids: triggerByVuln[id] ?? [],
    ofc_ids: ofcList.filter((o) => o.vulnerability_id === id).map((o) => o.id),
  }));

  return {
    questions: allQuestions.map(commsQuestionToConfig),
    vulnerabilities,
    ofcs: ofcList,
    report_templates: [],
    report_bindings: [
      { token: '{{impact_onset_hours}}', source: 'summary.time_to_impact_hours' },
      { token: '{{functional_loss_percent}}', source: 'summary.functional_loss_percent' },
      { token: '{{recovery_time_hours}}', source: 'summary.recovery_time_hours' },
    ],
    assets_schema: {
      minItemsWhenRequiresService: 1,
      requiredFields: ['name', 'location', 'designation', 'type'],
    },
  };
}

export function buildInformationTechnologyConfig(): DependencyConfig {
  const allQuestions = [...IT_CURVE_QUESTIONS, ...IT_QUESTIONS];
  const triggerByVuln = getItVulnTriggerQuestionIds();
  const ofcList = getItOfcList();
  const vulnerabilities: VulnerabilityConfig[] = Object.keys(IT_VULNERABILITY_TEXTS).map((id) => ({
    id,
    text: IT_VULNERABILITY_TEXTS[id] ?? '',
    trigger_question_ids: triggerByVuln[id] ?? [],
    ofc_ids: ofcList.filter((o) => o.vulnerability_id === id).map((o) => o.id),
  }));

  return {
    questions: allQuestions.map(itQuestionToConfig),
    vulnerabilities,
    ofcs: ofcList,
    report_templates: [],
    report_bindings: [
      { token: '{{impact_onset_hours}}', source: 'summary.time_to_impact_hours' },
      { token: '{{functional_loss_percent}}', source: 'summary.functional_loss_percent' },
      { token: '{{recovery_time_hours}}', source: 'summary.recovery_time_hours' },
    ],
    assets_schema: {
      minItemsWhenRequiresService: 1,
      requiredFields: ['name', 'location', 'designation', 'type'],
    },
  };
}

export function buildWaterConfig(): DependencyConfig {
  const allQuestions = [...WATER_CURVE_QUESTIONS, ...WATER_QUESTIONS];
  const triggerByVuln = getWaterVulnTriggerQuestionIds();
  const ofcList = getWaterOfcList();
  const vulnerabilities: VulnerabilityConfig[] = Object.keys(WATER_VULNERABILITY_TEXTS).map((id) => ({
    id,
    text: WATER_VULNERABILITY_TEXTS[id] ?? '',
    trigger_question_ids: triggerByVuln[id] ?? [],
    ofc_ids: ofcList.filter((o) => o.vulnerability_id === id).map((o) => o.id),
  }));

  return {
    questions: allQuestions.map(waterQuestionToConfig),
    vulnerabilities,
    ofcs: ofcList,
    report_templates: [],
    report_bindings: [
      { token: '{{impact_onset_hours}}', source: 'summary.time_to_impact_hours' },
      { token: '{{functional_loss_percent}}', source: 'summary.functional_loss_percent' },
      { token: '{{recovery_time_hours}}', source: 'summary.recovery_time_hours' },
    ],
    assets_schema: {
      minItemsWhenRequiresService: 1,
      requiredFields: ['name', 'location', 'designation', 'type'],
    },
  };
}

export function buildWastewaterConfig(): DependencyConfig {
  const allQuestions = [...WASTEWATER_CURVE_QUESTIONS, ...WASTEWATER_QUESTIONS];
  const triggerByVuln = getWastewaterVulnTriggerQuestionIds();
  const ofcList = getWastewaterOfcList();
  const vulnerabilities: VulnerabilityConfig[] = Object.keys(WASTEWATER_VULNERABILITY_TEXTS).map((id) => ({
    id,
    text: WASTEWATER_VULNERABILITY_TEXTS[id] ?? '',
    trigger_question_ids: triggerByVuln[id] ?? [],
    ofc_ids: ofcList.filter((o) => o.vulnerability_id === id).map((o) => o.id),
  }));

  return {
    questions: allQuestions.map(wastewaterQuestionToConfig),
    vulnerabilities,
    ofcs: ofcList,
    report_templates: [],
    report_bindings: [
      { token: '{{impact_onset_hours}}', source: 'summary.time_to_impact_hours' },
      { token: '{{functional_loss_percent}}', source: 'summary.functional_loss_percent' },
      { token: '{{recovery_time_hours}}', source: 'summary.recovery_time_hours' },
    ],
    assets_schema: {
      minItemsWhenRequiresService: 1,
      requiredFields: ['name', 'location', 'designation', 'type'],
    },
  };
}

/** Stub config for dependencies not yet implemented; fails role parity and other checks. */
export function getStubConfig(_dependency: DependencyKey): DependencyConfig {
  return {
    questions: [],
    vulnerabilities: [],
    ofcs: [],
    report_templates: [],
    assets_schema: {
      minItemsWhenRequiresService: 1,
      requiredFields: ['name', 'location', 'designation', 'type'],
    },
  };
}
