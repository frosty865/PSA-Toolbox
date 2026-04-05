/**
 * Save/Load progress: file download/import and (via assessmentStorage) localStorage persistence.
 * V1: legacy energy/comms top-level. V2: generic sessions map.
 */
import { AssessmentSchema } from 'schema';
import type { Assessment } from 'schema';
import { normalizeAssessmentNumericFields } from '@/lib/numeric';
import { sanitizeLegacySupplyChainFields } from '@/app/lib/assessment/sanitize_legacy_fields';
import { sanitizeAssessmentBeforeSave } from '@/app/lib/assessment/sanitize_assessment';
import { normalizeCurveStorage } from '@/app/lib/assessment/normalize_curve_storage';
import type { DependencySessionsMap, DependencySessionSnapshot } from './sessionTypes';

const SKIP_NULL_NORMALIZE = new Set([
  'time_to_impact_hours', 'loss_fraction_no_backup', 'backup_duration_hours',
  'loss_fraction_with_backup', 'recovery_time_hours', 'sla_hours',
  'sla_mttr_max_hours', 'lead_time_days', 'load_pct_tested',
  'demarcation_lat', 'demarcation_lon', 'connection_count',
]);

function isLikelyStringKey(key: string): boolean {
  if (SKIP_NULL_NORMALIZE.has(key)) return false;
  if (/^(tool_version|template_version|created_at_iso|asset_name|visit_date_iso|sector|subsector|mailing_address_line1|mailing_address_line2|mailing_address_line3|mailing_city|mailing_state|mailing_zip|mailing_country|physical_address|location|facility_latitude|facility_longitude|assessor|description|from_category|backup_type|pra_category_other|product_or_service|component_or_service|provider_name|alternate_supplier_name|source_id|source_label|demarcation_description|connection_label|facility_entry_location|associated_provider|capability_type|scope|capacity_description|estimated_duration|plan_description|mitigation_description|protection_type)$/.test(key))
    return true;
  return (
    key.endsWith('_name') ||
    key.endsWith('_description') ||
    key.endsWith('_label') ||
    key.endsWith('_location') ||
    key.endsWith('_type') ||
    key.endsWith('_scope') ||
    key === 'notes'
  );
}

function normalizeObjectNullStrings(obj: Record<string, unknown>, depth: number): void {
  if (depth > 15) return;
  for (const [key, val] of Object.entries(obj)) {
    if (val === null && isLikelyStringKey(key)) {
      obj[key] = '';
    } else if (val != null && typeof val === 'object' && !Array.isArray(val)) {
      normalizeObjectNullStrings(val as Record<string, unknown>, depth + 1);
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (item != null && typeof item === 'object' && !Array.isArray(item)) {
          normalizeObjectNullStrings(item as Record<string, unknown>, depth + 1);
        }
      }
    }
  }
}

/** Convert null to empty string for fields that expect string. Prevents "Expected string, received null" on load. */
function normalizeAssessmentNullStrings(assessment: Record<string, unknown>): void {
  normalizeObjectNullStrings(assessment, 0);
}

const TOOL_ID = 'infrastructure-dependency-tool';
const LEGACY_TOOL_IDS = new Set(['asset-dependency-tool']);
const TOOL_DISPLAY_NAME = 'Infrastructure Dependency Tool (IDT)';
export const PROGRESS_VERSION_V1 = 1;
export const PROGRESS_VERSION_V2 = 2;

/** Energy dependency answers + derived findings (optional; included for full session restore). */
export type EnergySnapshot = {
  answers: Record<string, unknown>;
  derived: { vulnerabilities: unknown[]; ofcs: unknown[]; reportBlocks: unknown[] };
  saved_at_iso: string;
};

/** Comms dependency answers + derived (optional; included for full session restore). */
export type CommsSnapshot = {
  answers: Record<string, unknown>;
  derived?: unknown;
  saved_at_iso?: string;
};

export type ProgressFileV1 = {
  tool: string;
  version: number;
  saved_at_iso: string;
  assessment: Assessment;
  energy?: EnergySnapshot;
  comms?: CommsSnapshot;
};

export type ProgressFileV2 = {
  tool: typeof TOOL_ID;
  version: 2;
  saved_at_iso: string;
  assessment: Assessment;
  sessions?: DependencySessionsMap;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function toSessionSnapshot(
  energy: EnergySnapshot | null | undefined,
  comms?: CommsSnapshot | null
): DependencySessionsMap {
  const sessions: DependencySessionsMap = {};
  if (energy && isObject(energy.answers)) {
    sessions.ELECTRIC_POWER = {
      answers: energy.answers,
      derived: energy.derived ?? { vulnerabilities: [], ofcs: [], reportBlocks: [] },
      saved_at_iso: energy.saved_at_iso ?? new Date().toISOString(),
    };
  }
  if (comms && isObject(comms.answers)) {
    sessions.COMMUNICATIONS = {
      answers: comms.answers,
      derived: comms.derived as DependencySessionSnapshot['derived'],
      saved_at_iso: comms.saved_at_iso ?? new Date().toISOString(),
    };
  }
  return sessions;
}

/** Build V1 (legacy) for backward compat. Prefer buildProgressFileV2. */
export function buildProgressFile(
  assessment: Assessment,
  energy: EnergySnapshot | null | undefined,
  comms?: CommsSnapshot | null
): ProgressFileV1 {
  const sanitized = sanitizeAssessmentBeforeSave(assessment);
  const file: ProgressFileV1 = {
    tool: TOOL_ID,
    version: PROGRESS_VERSION_V1,
    saved_at_iso: new Date().toISOString(),
    assessment: sanitized,
  };
  if (energy && Array.isArray(energy.derived?.vulnerabilities) && Array.isArray(energy.derived?.ofcs) && Array.isArray(energy.derived?.reportBlocks)) {
    file.energy = energy;
  }
  if (comms && isObject(comms.answers)) {
    file.comms = { answers: comms.answers, derived: comms.derived, saved_at_iso: comms.saved_at_iso };
  }
  return file;
}

/** Build V2 with generic sessions map. Preferred for new use. */
export function buildProgressFileV2(
  assessment: Assessment,
  sessions?: DependencySessionsMap | null
): ProgressFileV2 {
  const sanitized = sanitizeAssessmentBeforeSave(assessment);
  const file: ProgressFileV2 = {
    tool: TOOL_ID,
    version: 2,
    saved_at_iso: new Date().toISOString(),
    assessment: sanitized,
  };
  if (sessions && Object.keys(sessions).length > 0) {
    file.sessions = sessions;
  }
  return file;
}

export function downloadProgress(state: ProgressFileV1 | ProgressFileV2): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const filename = `idt-progress-${state.saved_at_iso.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay so the browser can start the download (some browsers need the URL to stay valid)
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

export type ImportResult =
  | { ok: true; assessment: Assessment; sessions: DependencySessionsMap }
  | { ok: false; error: string };

export function importProgress(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      const result = parseProgressFile(raw);
      resolve(result);
    };
    reader.onerror = () => resolve({ ok: false, error: 'Could not read file.' });
    reader.readAsText(file);
  });
}

export function parseProgressFile(raw: string): ImportResult {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON file.' };
  }

  if (!isObject(v)) {
    return { ok: false, error: 'Invalid progress file format.' };
  }

  const toolId = typeof v.tool === 'string' ? v.tool : '';
  if (toolId !== TOOL_ID && !LEGACY_TOOL_IDS.has(toolId)) {
    return { ok: false, error: `This file is not from the ${TOOL_DISPLAY_NAME}.` };
  }

  const version = v.version;
  if (version !== PROGRESS_VERSION_V1 && version !== PROGRESS_VERSION_V2) {
    return { ok: false, error: 'Unsupported file version. Use a file saved by this version of the tool.' };
  }

  const assessment = v.assessment;
  if (!assessment || !isObject(assessment)) {
    return { ok: false, error: 'Progress file is missing assessment data.' };
  }

  normalizeAssessmentNumericFields(assessment);
  normalizeAssessmentNullStrings(assessment);
  sanitizeLegacySupplyChainFields(assessment);

  const parsed = AssessmentSchema.safeParse(assessment);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const msg = first?.message ?? 'Invalid assessment data.';
    return { ok: false, error: msg };
  }

  let sessions: DependencySessionsMap = {};

  if (version === PROGRESS_VERSION_V2 && v.sessions && isObject(v.sessions)) {
    for (const [key, val] of Object.entries(v.sessions)) {
      if (
        val &&
        isObject(val) &&
        isObject((val as DependencySessionSnapshot).answers)
      ) {
        const snap = val as Partial<DependencySessionSnapshot>;
        sessions[key as keyof DependencySessionsMap] = {
          answers: snap.answers as Record<string, unknown>,
          derived: snap.derived,
          saved_at_iso: typeof snap.saved_at_iso === 'string' && snap.saved_at_iso.trim().length > 0
            ? snap.saved_at_iso
            : new Date().toISOString(),
        };
      }
    }
  } else if (version === PROGRESS_VERSION_V1) {
    sessions = toSessionSnapshot(v.energy as EnergySnapshot | undefined, v.comms as CommsSnapshot | undefined);
  }

  const normalizedAssessment = normalizeCurveStorage(parsed.data);
  return { ok: true, assessment: normalizedAssessment, sessions };
}
