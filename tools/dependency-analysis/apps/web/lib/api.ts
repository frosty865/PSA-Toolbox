import type { Assessment } from 'schema';
import type { VOFCCollection } from 'schema';
import { getApiBase } from '@/lib/platform/apiBase';
import { isFieldStaticMode } from '@/lib/field/isFieldStaticMode';
import * as fieldApi from '@/lib/field/apiFieldStatic';
import {
  getBrowserReportServiceBaseUrl,
  getFieldExportBaseUrl,
  isFieldRemoteDocxEnabled,
} from '@/lib/field/remoteExport';
import { getExportFilename } from '@/lib/uiCopy/reviewExportCopy';
import { purgeAllLocalState } from '@/app/lib/io/purge';
import { buildVofcCollectionFromAssessment } from '@/app/lib/vofc/build_vofc_collection';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';
import { isCrossDependencyEnabled } from '@/lib/cross-dependency-enabled';
import { buildProgressFileV2 } from '@/app/lib/io/progressFile';
import { collectAllSessionsFromLocalStorage } from '@/app/lib/io/collectSessions';
import { sanitizeAssessmentBeforeSave } from '@/app/lib/assessment/sanitize_assessment';

/** Thrown when an API request returns non-2xx. message is user-facing; code and details from server. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export type TemplateCheckResponse = {
  ok: boolean;
  templatePath: string;
  missing: string[];
  duplicates: Array<{ anchor: string; count: number }>;
};

export type VofcReadyResponse = { ready: true } | { ready: false; error: string };

export async function getVofcReady(): Promise<VofcReadyResponse> {
  if (isFieldStaticMode()) return fieldApi.getVofcReady();
  const res = await fetch(`${getApiBase()}/api/vofc/ready`);
  const j = (await res.json().catch(() => ({}))) as { ready?: boolean; error?: string };
  if (j.ready === true) return { ready: true };
  return { ready: false, error: typeof j.error === 'string' && j.error ? j.error : 'VOFC library not configured.' };
}

export async function getTemplateCheck(): Promise<TemplateCheckResponse> {
  if (isFieldStaticMode()) return fieldApi.getTemplateCheck();
  const res = await fetch(`${getApiBase()}/api/template/check`);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? 'Template check failed');
  }
  return res.json() as Promise<TemplateCheckResponse>;
}

/** Strip agreements when PRA/SLA disabled; strip cross_dependencies when cross-dependency disabled. Used for VOFC generation. */
function prepareAssessmentForVofcApi(assessment: Assessment): Assessment {
  let out: Assessment = assessment;
  if (!isPraSlaEnabled(assessment)) {
    const cats = assessment.categories;
    if (cats && typeof cats === 'object') {
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(cats)) {
        if (!v || typeof v !== 'object') {
          next[k] = v;
          continue;
        }
        const vObj = { ...v } as Record<string, unknown>;
        delete vObj.agreements;
        next[k] = vObj;
      }
      out = { ...out, categories: next as Assessment['categories'] };
    }
  }
  if (!isCrossDependencyEnabled(assessment)) {
    out = { ...out, cross_dependencies: undefined };
  }
  return out;
}

/** Builds VOFCs from in-app derived findings/conditions (no external VOFC library dependency). */
export async function getVofcCollection(assessment: Assessment): Promise<VOFCCollection> {
  const payload = prepareAssessmentForVofcApi(assessment);
  return buildVofcCollectionFromAssessment(payload);
}

/** Clear all client-side state (localStorage, IndexedDB). No network call. */
export async function purge(): Promise<void> {
  const res = await purgeAllLocalState();
  if (!res.ok) throw new Error(res.error);
}

export async function exportDraft(assessment: Assessment): Promise<Blob> {
  if (isFieldStaticMode()) return fieldApi.exportDraft(assessment);
  const sessions = collectAllSessionsFromLocalStorage();
  const file = buildProgressFileV2(sanitizeAssessmentBeforeSave(assessment), sessions);
  return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
}

export type ExportFinalErrorPayload = {
  ok: false;
  code: string;
  message: string;
  request_id: string;
  failure_reason?: string;
  details?: Record<string, unknown>;
  debug?: { err: string; stack_top: string[]; timings?: Record<string, number> };
};

export type KnowledgeGapPayload = {
  id: string;
  title: string;
  description: string;
  question_ids?: string[];
  severity?: string;
};

export type ThemeFindingPayload = {
  id: string;
  title: string;
  narrative: string;
  evidence?: Array<{ question_id: string }>;
};

export type EnergyReportSectionPayload = {
  dataBlocks: Array<{ type: string; title?: string; text?: string; items?: string[]; headers?: string[]; rows?: unknown[][] }>;
  vulnerabilities: Array<{ id: string; text: string }>;
  ofcs: Array<{ id: string; text: string; vulnerability_id: string }>;
  themedFindings?: ThemeFindingPayload[];
  knowledgeGaps?: KnowledgeGapPayload[];
};

export type DependencySectionPayload = {
  name: string;
  themedFindings?: ThemeFindingPayload[];
  knowledgeGaps?: KnowledgeGapPayload[];
};

async function postExportFinalRequest(
  url: string,
  payload: Assessment,
  options?: {
    timeoutMs?: number;
    energy_dependency?: EnergyReportSectionPayload;
    dependency_sections?: DependencySectionPayload[];
  },
  crossOrigin?: boolean
): Promise<Blob> {
  const timeoutMs = options?.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const body: {
    assessment: Assessment;
    energy_dependency?: EnergyReportSectionPayload;
    dependency_sections?: DependencySectionPayload[];
  } = { assessment: payload };
  if (options?.energy_dependency) body.energy_dependency = options.energy_dependency;
  if (options?.dependency_sections?.length) body.dependency_sections = options.dependency_sections;

  const res = await fetch(url, {
    method: 'POST',
    ...(crossOrigin ? { mode: 'cors' as const, credentials: 'omit' as const } : {}),
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : '',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (!res.ok) {
    const text = await res.text();
    let errPayload: ExportFinalErrorPayload | { error?: string } = {};
    try {
      errPayload = JSON.parse(text) as ExportFinalErrorPayload | { error?: string };
    } catch {
      errPayload = { message: text?.slice(0, 200) || `HTTP ${res.status}` } as ExportFinalErrorPayload | { error?: string };
    }
    const p = errPayload as ExportFinalErrorPayload;
    const message = p?.message ?? (errPayload as { error?: string }).error ?? `Final export failed (${res.status})`;
    console.error('[export/final]', res.status, message, p?.details ?? {});
    const err = new ApiError(message, res.status, p?.code, {
      request_id: p?.request_id,
      failure_reason: p?.failure_reason,
      details: p?.details,
      debug: p?.debug,
    });
    (err as { serverResponseBody?: string }).serverResponseBody = (text ?? '').slice(0, 2000);
    throw err;
  }
  return res.blob();
}

export async function exportFinal(
  assessment: Assessment,
  options?: {
    timeoutMs?: number;
    energy_dependency?: EnergyReportSectionPayload;
    dependency_sections?: DependencySectionPayload[];
  }
): Promise<Blob> {
  const payload = prepareAssessmentForVofcApi(assessment);
  const remoteReportServiceBaseUrl = getBrowserReportServiceBaseUrl();
  if (remoteReportServiceBaseUrl) {
    return postExportFinalRequest(`${remoteReportServiceBaseUrl}/api/export/final`, payload, options, true);
  }

  if (isFieldStaticMode()) {
    const remote = getFieldExportBaseUrl();
    if (remote) {
      return postExportFinalRequest(`${remote}/api/export/final`, payload, options, true);
    }
    return fieldApi.exportFinal(payload, options);
  }

  return postExportFinalRequest(`${getApiBase()}/api/export/final`, payload, options);
}

export type GenericReportSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type GenericReportPayload = {
  generic_report: {
    template_key: string;
    title: string;
    subtitle?: string;
    header_left?: string;
    header_right?: string;
    footer_left?: string;
    footer_right?: string;
    sections?: GenericReportSection[];
  };
};

export async function generateGenericReport(payload: GenericReportPayload): Promise<Blob> {
  const res = await fetch(`${getApiBase()}/api/report/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? 'Generic report generation failed');
  }
  return res.blob();
}

export async function generateToolReport(toolId: string): Promise<Blob> {
  const res = await fetch(`${getApiBase()}/api/report/tool/${encodeURIComponent(toolId)}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Tool report failed (${res.status})`);
  }
  return res.blob();
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadJson(blob: Blob) {
  downloadBlob(blob, 'idt-progress.json');
}

export function downloadReportDocx(blob: Blob) {
  downloadBlob(blob, 'Infrastructure-Dependency-Tool-Report.docx');
}

/** Final export: DOCX for IT-hosted builds; JSON for field static unless hybrid remote export URL is set at build time. */
export function downloadFinalExport(blob: Blob, assessment: Assessment) {
  if (isFieldStaticMode()) {
    if (isFieldRemoteDocxEnabled()) {
      downloadReportDocx(blob);
      return;
    }
    downloadBlob(blob, getExportFilename(assessment.meta?.created_at_iso, 'json'));
    return;
  }
  downloadReportDocx(blob);
}
