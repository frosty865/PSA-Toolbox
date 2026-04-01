import type { Assessment } from 'schema';
import type { VOFCCollection } from 'schema';
import { getApiBase } from '@/lib/platform/apiBase';
import { purgeAllLocalState } from '@/app/lib/io/purge';
import { buildVofcCollectionFromAssessment } from '@/app/lib/vofc/build_vofc_collection';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';
import { isCrossDependencyEnabled } from '@/lib/cross-dependency-enabled';

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
  const res = await fetch(`${getApiBase()}/api/vofc/ready`);
  const j = (await res.json().catch(() => ({}))) as { ready?: boolean; error?: string };
  if (j.ready === true) return { ready: true };
  return { ready: false, error: typeof j.error === 'string' && j.error ? j.error : 'VOFC library not configured.' };
}

export async function getTemplateCheck(): Promise<TemplateCheckResponse> {
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

export type DependencySessionsMap = import('@/app/lib/io/sessionTypes').DependencySessionsMap;

export async function exportDraft(
  assessment: Assessment,
  passphrase: string,
  sessions?: DependencySessionsMap
): Promise<Blob> {
  const res = await fetch(`${getApiBase()}/api/export/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assessment, passphrase, sessions }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? 'Draft export failed');
  }
  return res.blob();
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

export async function exportFinal(
  assessment: Assessment,
  options?: {
    timeoutMs?: number;
    energy_dependency?: EnergyReportSectionPayload;
    dependency_sections?: DependencySectionPayload[];
  }
): Promise<Blob> {
  const timeoutMs = options?.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const payload = prepareAssessmentForVofcApi(assessment);
  const body: {
    assessment: Assessment;
    energy_dependency?: EnergyReportSectionPayload;
    dependency_sections?: DependencySectionPayload[];
  } = { assessment: payload };
  if (options?.energy_dependency) body.energy_dependency = options.energy_dependency;
  if (options?.dependency_sections?.length) body.dependency_sections = options.dependency_sections;

  const res = await fetch(`${getApiBase()}/api/export/final`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : '' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (!res.ok) {
    const text = await res.text();
    let payload: ExportFinalErrorPayload | { error?: string } = {};
    try {
      payload = JSON.parse(text) as ExportFinalErrorPayload | { error?: string };
    } catch {
      payload = { message: text?.slice(0, 200) || `HTTP ${res.status}` } as ExportFinalErrorPayload | { error?: string };
    }
    const p = payload as ExportFinalErrorPayload;
    const message = p?.message ?? (p as { error?: string }).error ?? `Final export failed (${res.status})`;
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

export async function exportRevisionPackage(assessment: Assessment, passphrase: string): Promise<Blob> {
  const res = await fetch(`${getApiBase()}/api/revision/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assessment, passphrase }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? 'Revision export failed');
  }
  return res.blob();
}

export type RevisionPackageMetadata = {
  tool_version: string;
  template_version: string;
  created_at_iso: string;
  current_tool_version: string;
};

export async function getRevisionPackageMetadata(file: File, passphrase: string): Promise<RevisionPackageMetadata> {
  const form = new FormData();
  form.set('file', file);
  form.set('passphrase', passphrase);
  const res = await fetch(`${getApiBase()}/api/revision/metadata`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? 'Failed to read package');
  }
  return res.json() as Promise<RevisionPackageMetadata>;
}

export type ImportRevisionResult = { assessment: Assessment; sessions?: DependencySessionsMap };

export async function importRevisionPackage(file: File, passphrase: string): Promise<ImportRevisionResult> {
  const form = new FormData();
  form.set('file', file);
  form.set('passphrase', passphrase);
  const res = await fetch(`${getApiBase()}/api/revision/import`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? 'Import failed');
  }
  const json = await res.json();
  // Backward compat: older API returned assessment directly
  if (json?.assessment != null) {
    return json as ImportRevisionResult;
  }
  return { assessment: json as Assessment };
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadDraftZip(blob: Blob) {
  downloadBlob(blob, 'draft-report-and-revision.zip');
}

export function downloadReportDocx(blob: Blob) {
  downloadBlob(blob, 'Asset-Dependency-Assessment-Report.docx');
}
